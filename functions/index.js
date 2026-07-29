"use strict";

/**
 * Vitrina — автоматичне підключення власних доменів клієнтів
 * через Cloudflare for SaaS (Custom Hostnames API).
 *
 * ── Що потрібно налаштувати один раз (в консолях, а не в коді) ─────────────
 * 1. Домен `vitryna-shop.com` має бути підключений до Cloudflare (nameservers
 *    вказують на Cloudflare).
 * 2. У зоні `vitryna-shop.com` увімкнути Cloudflare for SaaS і задати
 *    Fallback origin (куди Cloudflare проксіює трафік кастомних доменів —
 *    ваш сайт на Firebase Hosting).
 * 3. Створити проксійований (orange cloud) DNS-запис
 *    `cname.vitryna-shop.com` → ваш origin. Саме на цей хост клієнти
 *    вказуватимуть CNAME свого домену.
 * 4. Створити API-токен Cloudflare з правами на зону:
 *      - Zone » SSL and Certificates » Edit
 *      - Zone » Custom Hostnames » Edit  (Zone Settings » Read)
 *
 * ── Секрети (задаються з терміналу, у код НЕ потрапляють) ──────────────────
 *   firebase functions:secrets:set CLOUDFLARE_API_TOKEN
 *   firebase functions:secrets:set CLOUDFLARE_ZONE_ID
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const CLOUDFLARE_API_TOKEN = defineSecret("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ZONE_ID = defineSecret("CLOUDFLARE_ZONE_ID");
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");

// Хост, на який клієнти вказують CNAME свого домену.
const CNAME_TARGET = "cname.vitryna-shop.com";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const sanitizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");

const isValidDomain = (value) =>
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value);

const cfRequest = async (path, token, options = {}) => {
  const response = await fetch(`${CF_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !payload || payload.success === false) {
    const firstError =
      payload && Array.isArray(payload.errors) && payload.errors.length
        ? payload.errors[0].message
        : `HTTP ${response.status}`;
    const err = new Error(firstError || "cloudflare-request-failed");
    err.cfErrors = (payload && payload.errors) || [];
    throw err;
  }

  return payload.result;
};

// Формує список DNS-записів, які клієнт має додати у свого реєстратора.
const buildRecords = (domain, cfResult) => {
  const records = [
    {
      type: "CNAME",
      name: domain,
      value: CNAME_TARGET,
      purpose: "Маршрутизація домену"
    }
  ];

  const ssl = (cfResult && cfResult.ssl) || {};
  const validationRecords = Array.isArray(ssl.validation_records)
    ? ssl.validation_records
    : [];

  validationRecords.forEach((record) => {
    if (record && record.txt_name && record.txt_value) {
      records.push({
        type: "TXT",
        name: String(record.txt_name).replace(/\.$/, ""),
        value: String(record.txt_value),
        purpose: "Підтвердження SSL-сертифіката"
      });
    }
  });

  const ownership = cfResult && cfResult.ownership_verification;
  if (ownership && ownership.type === "txt" && ownership.name && ownership.value) {
    records.push({
      type: "TXT",
      name: String(ownership.name).replace(/\.$/, ""),
      value: String(ownership.value),
      purpose: "Підтвердження власності домену"
    });
  }

  return records;
};

const summarize = (domain, cfResult) => {
  const hostnameStatus = String((cfResult && cfResult.status) || "pending");
  const sslStatus = String((cfResult && cfResult.ssl && cfResult.ssl.status) || "pending");
  const connected = hostnameStatus === "active" && sslStatus === "active";

  return {
    ok: true,
    hostnameId: String((cfResult && cfResult.id) || ""),
    domain,
    status: hostnameStatus,
    sslStatus,
    connected,
    cnameTarget: CNAME_TARGET,
    records: buildRecords(domain, cfResult)
  };
};

const mapCfError = (error) => {
  const message = String((error && error.message) || "cloudflare-error");
  if (/already exists|duplicate/i.test(message)) {
    return new HttpsError("already-exists", "Цей домен вже підключено (можливо, іншим магазином).");
  }
  if (/authenticat|permission|forbidden|9109|10000/i.test(message)) {
    return new HttpsError("permission-denied", "Помилка доступу до Cloudflare. Перевірте API-токен і права.");
  }
  return new HttpsError("internal", `Cloudflare: ${message}`);
};

/**
 * Підключити власний домен: створює custom hostname у Cloudflare
 * і повертає DNS-записи, які клієнт має додати.
 */
exports.connectCustomDomain = onCall(
  { secrets: [CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID] },
  async (request) => {
    const domain = sanitizeDomain(request.data && request.data.domain);
    if (!domain || !isValidDomain(domain)) {
      throw new HttpsError("invalid-argument", "Введіть коректний домен, наприклад my-shop.com.");
    }

    const token = CLOUDFLARE_API_TOKEN.value();
    const zoneId = CLOUDFLARE_ZONE_ID.value();
    if (!token || !zoneId) {
      throw new HttpsError("failed-precondition", "Cloudflare ще не налаштовано на сервері.");
    }

    try {
      const result = await cfRequest(`/zones/${zoneId}/custom_hostnames`, token, {
        method: "POST",
        body: JSON.stringify({
          hostname: domain,
          ssl: {
            method: "txt",
            type: "dv",
            settings: { min_tls_version: "1.2" }
          }
        })
      });

      return summarize(domain, result);
    } catch (error) {
      throw mapCfError(error);
    }
  }
);

/**
 * Оновити статус підключення (перевірити, чи вже видано сертифікат).
 */
exports.refreshCustomDomain = onCall(
  { secrets: [CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID] },
  async (request) => {
    const hostnameId = String((request.data && request.data.hostnameId) || "").trim();
    const domain = sanitizeDomain(request.data && request.data.domain);

    const token = CLOUDFLARE_API_TOKEN.value();
    const zoneId = CLOUDFLARE_ZONE_ID.value();
    if (!token || !zoneId) {
      throw new HttpsError("failed-precondition", "Cloudflare ще не налаштовано на сервері.");
    }

    try {
      let result = null;

      if (hostnameId) {
        result = await cfRequest(`/zones/${zoneId}/custom_hostnames/${hostnameId}`, token, {
          method: "GET"
        });
      } else if (domain) {
        // Немає збереженого id — знаходимо hostname за назвою домену.
        const list = await cfRequest(
          `/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(domain)}`,
          token,
          { method: "GET" }
        );
        result = Array.isArray(list) && list.length ? list[0] : null;
      }

      if (!result) {
        throw new HttpsError("not-found", "Домен не знайдено. Спробуйте підключити його заново.");
      }

      return summarize(domain || sanitizeDomain(result.hostname), result);
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      throw mapCfError(error);
    }
  }
);

/**
 * Відключити власний домен: видаляє custom hostname з Cloudflare.
 */
exports.disconnectCustomDomain = onCall(
  { secrets: [CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID] },
  async (request) => {
    const hostnameId = String((request.data && request.data.hostnameId) || "").trim();
    const domain = sanitizeDomain(request.data && request.data.domain);

    const token = CLOUDFLARE_API_TOKEN.value();
    const zoneId = CLOUDFLARE_ZONE_ID.value();
    if (!token || !zoneId) {
      throw new HttpsError("failed-precondition", "Cloudflare ще не налаштовано на сервері.");
    }

    try {
      let idToDelete = hostnameId;

      if (!idToDelete && domain) {
        const list = await cfRequest(
          `/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(domain)}`,
          token,
          { method: "GET" }
        );
        if (Array.isArray(list) && list.length) {
          idToDelete = String(list[0].id || "");
        }
      }

      if (idToDelete) {
        await cfRequest(`/zones/${zoneId}/custom_hostnames/${idToDelete}`, token, {
          method: "DELETE"
        });
      }

      return { ok: true };
    } catch (error) {
      throw mapCfError(error);
    }
  }
);

/* ────────────────────────────────────────────────────────────────────────
 * Telegram-сповіщення про нові замовлення (Deep Linking)
 *
 * Один бот @lavkaorders_bot обслуговує всі магазини. Прив'язка відбувається
 * через deep link `https://t.me/lavkaorders_bot?start=store_<STORE_ID>`.
 * chat_id зберігається у колекції `store_telegram/{storeId}`.
 *
 * ── Секрет (задається з терміналу, у код НЕ потрапляє) ────────────────────
 *   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
 *
 * ── Після деплою один раз прив'язати webhook ──────────────────────────────
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<telegramWebhook URL>
 * ──────────────────────────────────────────────────────────────────────── */

const TELEGRAM_BOT_USERNAME = "lavkaorders_bot";
const TELEGRAM_STORE_COLLECTION = "store_telegram";

const sanitizeStoreId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64);

const parseStorePayload = (payload) => {
  const raw = String(payload || "").trim();
  if (!raw) return "";
  const withoutPrefix = raw.startsWith("store_") ? raw.slice(6) : raw;
  return sanitizeStoreId(withoutPrefix);
};

const escapeTelegramHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const telegramApiCall = async (token, method, body) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  return {
    ok: Boolean(response.ok && data && data.ok),
    status: response.status,
    errorCode: data && data.error_code,
    data
  };
};

const getStoreName = async (storeId) => {
  try {
    const reg = await db.collection("stores_registry").doc(storeId).get();
    if (reg.exists) {
      const name = String((reg.data() || {}).storeName || "").trim();
      if (name) return name;
    }
  } catch (error) {
    // ignore
  }
  try {
    const settingsSnap = await db
      .collection("stores")
      .doc(storeId)
      .collection("data")
      .doc("lavkaStoreSettings")
      .get();
    if (settingsSnap.exists) {
      const value = (settingsSnap.data() || {}).value || {};
      const name = String(value.storeName || "").trim();
      if (name) return name;
    }
  } catch (error) {
    // ignore
  }
  return storeId;
};

const buildOrderMessage = (order) => {
  const safeOrder = order && typeof order === "object" ? order : {};
  const orderId = escapeTelegramHtml(String(safeOrder.id || "").replace(/^#/, "") || "—");
  const customer = escapeTelegramHtml(String(safeOrder.customerName || "Клієнт").trim() || "Клієнт");
  const phone = escapeTelegramHtml(String(safeOrder.customerPhone || "—").trim() || "—");
  const delivery = escapeTelegramHtml(String(safeOrder.deliveryMethod || "").trim());
  const total = Number(safeOrder.total) || 0;
  const totalText = escapeTelegramHtml(total.toLocaleString("uk-UA"));

  const items = Array.isArray(safeOrder.items) ? safeOrder.items : [];
  const itemsLines = items
    .slice(0, 30)
    .map((item) => {
      const name = escapeTelegramHtml(String((item && item.name) || "Товар").trim() || "Товар");
      const qty = Math.max(1, Number(item && item.qty) || 1);
      return `— ${name} x${qty}`;
    })
    .join("\n");

  const lines = [
    `🛍 <b>Нове замовлення №${orderId}</b>`,
    "",
    `<b>Клієнт:</b> ${customer}`,
    `<b>Телефон:</b> ${phone}`
  ];
  if (delivery) {
    lines.push(`<b>Доставка:</b> ${delivery}`);
  }
  lines.push(`<b>Сума:</b> ${totalText} грн`);
  if (itemsLines) {
    lines.push("", "<b>Товари:</b>", itemsLines);
  }
  return lines.join("\n");
};

/**
 * Webhook Telegram: обробляє /start store_<STORE_ID>, зберігає chat_id
 * і надсилає вітальне повідомлення.
 */
exports.telegramWebhook = onRequest(
  { secrets: [TELEGRAM_BOT_TOKEN] },
  async (req, res) => {
    const token = TELEGRAM_BOT_TOKEN.value();
    if (!token) {
      res.status(200).send("ok");
      return;
    }

    try {
      const update = req.body || {};
      const message = update.message || update.edited_message;
      if (!message || !message.chat || message.chat.id == null) {
        res.status(200).send("ok");
        return;
      }

      const chatId = String(message.chat.id);
      const text = String(message.text || "").trim();

      if (/^\/start\b/.test(text)) {
        const payload = text.replace(/^\/start\b/, "").trim();
        const storeId = parseStorePayload(payload);

        if (!storeId) {
          await telegramApiCall(token, "sendMessage", {
            chat_id: chatId,
            text: "Будь ласка, перейдіть за посиланням із вашого особистого кабінету магазину, щоб підключити сповіщення."
          });
          res.status(200).send("ok");
          return;
        }

        const storeName = await getStoreName(storeId);
        await db.collection(TELEGRAM_STORE_COLLECTION).doc(storeId).set(
          {
            storeId,
            chatId,
            enabled: true,
            storeName,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        await telegramApiCall(token, "sendMessage", {
          chat_id: chatId,
          parse_mode: "HTML",
          text: `✅ Вітаємо! Ваш магазин <b>${escapeTelegramHtml(storeName)}</b> успішно підключено до сповіщень про нові замовлення.`
        });
      }

      res.status(200).send("ok");
    } catch (error) {
      console.error("telegramWebhook error:", error);
      // Telegram очікує 200, інакше повторюватиме доставку.
      res.status(200).send("ok");
    }
  }
);

/**
 * Статус підключення магазину до Telegram (для адмін-панелі).
 */
exports.telegramStatus = onCall(async (request) => {
  const storeId = sanitizeStoreId(request.data && request.data.storeId);
  if (!storeId) {
    throw new HttpsError("invalid-argument", "Не передано storeId.");
  }

  const snap = await db.collection(TELEGRAM_STORE_COLLECTION).doc(storeId).get();
  if (!snap.exists) {
    return { linked: false, enabled: false, chatId: "", storeName: "" };
  }

  const data = snap.data() || {};
  const chatId = String(data.chatId || "");
  return {
    linked: Boolean(chatId),
    enabled: chatId ? data.enabled !== false : false,
    chatId,
    storeName: String(data.storeName || "")
  };
});

/**
 * Увімкнути/вимкнути сповіщення без відв'язки chat_id.
 */
exports.telegramSetEnabled = onCall(async (request) => {
  const storeId = sanitizeStoreId(request.data && request.data.storeId);
  if (!storeId) {
    throw new HttpsError("invalid-argument", "Не передано storeId.");
  }
  const enabled = Boolean(request.data && request.data.enabled);

  await db.collection(TELEGRAM_STORE_COLLECTION).doc(storeId).set(
    { storeId, enabled, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { ok: true, enabled };
});

/**
 * Відв'язати Telegram від магазину.
 */
exports.telegramDisconnect = onCall(async (request) => {
  const storeId = sanitizeStoreId(request.data && request.data.storeId);
  if (!storeId) {
    throw new HttpsError("invalid-argument", "Не передано storeId.");
  }

  await db.collection(TELEGRAM_STORE_COLLECTION).doc(storeId).set(
    { chatId: "", enabled: false, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { ok: true };
});

/**
 * Надіслати сповіщення про нове замовлення. Викликається з вітрини
 * (checkout) під час оформлення замовлення.
 */
exports.notifyOrder = onRequest(
  { secrets: [TELEGRAM_BOT_TOKEN], cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const storeId = sanitizeStoreId(req.body && req.body.storeId);
    const order = req.body && req.body.order;
    if (!storeId || !order || typeof order !== "object") {
      res.status(400).json({ ok: false, error: "invalid-request" });
      return;
    }

    try {
      const snap = await db.collection(TELEGRAM_STORE_COLLECTION).doc(storeId).get();
      if (!snap.exists) {
        res.status(200).json({ ok: true, skipped: "not-linked" });
        return;
      }

      const data = snap.data() || {};
      const chatId = String(data.chatId || "");
      if (!chatId || data.enabled === false) {
        res.status(200).json({ ok: true, skipped: "disabled" });
        return;
      }

      const token = TELEGRAM_BOT_TOKEN.value();
      const result = await telegramApiCall(token, "sendMessage", {
        chat_id: chatId,
        parse_mode: "HTML",
        text: buildOrderMessage(order)
      });

      if (!result.ok) {
        if (result.status === 403 || result.errorCode === 403) {
          // Користувач заблокував бота — вимикаємо сповіщення.
          await db.collection(TELEGRAM_STORE_COLLECTION).doc(storeId).set(
            { enabled: false, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          res.status(200).json({ ok: false, error: "forbidden", disabled: true });
          return;
        }
        res.status(200).json({ ok: false, error: "send-failed" });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("notifyOrder error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);
