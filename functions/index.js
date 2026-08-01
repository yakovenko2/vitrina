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
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
const MONO_X_TOKEN = defineSecret("MONO_X_TOKEN");

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

/**
 * Очистити кеш Cloudflare для всієї зони (кастомні домени клієнтів +
 * *.vitryna-shop.com отдають статичні файли через Cloudflare, тож після
 * кожного `firebase deploy` край-кеш може ще довго віддавати старі
 * HTML/JS. Викликається вручну з owner-admin після деплою.
 */
exports.purgeStorefrontCache = onCall(
  { secrets: [CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Потрібна автентифікація.");
    }

    const token = CLOUDFLARE_API_TOKEN.value();
    const zoneId = CLOUDFLARE_ZONE_ID.value();
    if (!token || !zoneId) {
      throw new HttpsError("failed-precondition", "Cloudflare ще не налаштовано на сервері.");
    }

    try {
      await cfRequest(`/zones/${zoneId}/purge_cache`, token, {
        method: "POST",
        body: JSON.stringify({ purge_everything: true })
      });
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
  const payment = escapeTelegramHtml(String(safeOrder.paymentMethod || "").trim());
  const comment = escapeTelegramHtml(String(safeOrder.comment || "").trim());
  const total = Number(safeOrder.total) || 0;
  const totalText = escapeTelegramHtml(total.toLocaleString("uk-UA"));

  const lines = [
    `🛍 <b>Нове замовлення №${orderId}</b>`,
    "",
    `<b>Клієнт:</b> ${customer}`,
    `<b>Телефон:</b> ${phone}`
  ];
  if (delivery) {
    lines.push(`<b>Доставка:</b> ${delivery}`);
  }
  if (payment) {
    lines.push(`Оплата: ${payment}`);
  }
  lines.push(`<b>Сума:</b> ${totalText} грн`);
  if (comment) {
    lines.push(`Коментар клієнта: ${comment}`);
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

/* ────────────────────────────────────────────────────────────────────────
 * Monobank acquiring: оплата тарифів
 * ──────────────────────────────────────────────────────────────────────── */

const MONO_API_BASE = "https://api.monobank.ua";
const MONO_CCY_UAH = 980;
const BILLING_INVOICES_COLLECTION = "billing_invoices";
const BILLING_KEY = "lavkaBilling";
const TARIFF_PLANS = {
  start: {
    id: "start",
    name: "Старт",
    amountKop: 10900,
    periodMonths: 1,
    code: "tariff_start_1m"
  },
  business: {
    id: "business",
    name: "Бізнес",
    amountKop: 20900,
    periodMonths: 1,
    code: "tariff_business_1m"
  },
  pro: {
    id: "pro",
    name: "Про",
    amountKop: 44900,
    periodMonths: 1,
    code: "tariff_pro_1m"
  }
};

const sanitizeStoreIdStrict = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64);

const sanitizeUserIdentity = (value) => String(value || "").trim().slice(0, 160);

const normalizeTariffId = (value) => String(value || "").trim().toLowerCase();

const sanitizeReturnBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const protocol = String(url.protocol || "").toLowerCase();
    const isLocalhost = ["localhost", "127.0.0.1"].includes(String(url.hostname || "").toLowerCase());
    if (protocol === "https:" || (isLocalhost && protocol === "http:")) {
      url.hash = "";
      url.search = "";
      return url.toString().replace(/\/$/, "");
    }
  } catch (error) {
    return "";
  }
  return "";
};

const buildPaymentUrls = (baseUrl) => {
  const normalizedBase = sanitizeReturnBaseUrl(baseUrl);
  const fallback = "https://lavka-shop.web.app";
  const origin = normalizedBase || fallback;
  return {
    redirectUrl: `${origin}/admin.html#/billing?payment=processing`,
    successUrl: `${origin}/admin.html#/billing?payment=success`,
    failUrl: `${origin}/admin.html#/billing?payment=fail`
  };
};

const toSafeMonoError = async (response) => {
  let details = "";
  try {
    const payload = await response.json();
    details = payload && (payload.errText || payload.errorDescription || payload.message || "");
  } catch (error) {
    details = "";
  }
  return `${response.status}${details ? `:${details}` : ""}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

const monoRequest = async (path, token, options = {}) => {
  const maxAttempts = 4;
  const baseDelayMs = 350;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetch(`${MONO_API_BASE}${path}`, {
      ...options,
      headers: {
        "X-Token": token,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (response.ok) {
      return response.json();
    }

    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt >= maxAttempts) {
      const detail = await toSafeMonoError(response);
      const error = new Error(`mono-request-failed:${detail}`);
      error.httpStatus = response.status;
      throw error;
    }

    const jitter = Math.floor(Math.random() * 120);
    const delayMs = baseDelayMs * (2 ** (attempt - 1)) + jitter;
    await sleep(delayMs);
  }

  throw new Error("mono-request-failed:retry-exhausted");
};

const parseMonoModifiedDate = (value) => {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    // Monobank may send unix time in seconds; normalize to milliseconds.
    return asNumber > 0 && asNumber < 1e12 ? asNumber * 1000 : asNumber;
  }
  const asDate = new Date(value || "");
  const time = asDate.getTime();
  return Number.isFinite(time) ? time : 0;
};

const createTariffReference = (storeId) => {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `tariff_${storeId}_${Date.now()}_${randomPart}`;
};

const addMonthsIso = (baseDate, months) => {
  const base = new Date(baseDate || Date.now());
  base.setMonth(base.getMonth() + Math.max(1, Number(months) || 1));
  return base.toISOString();
};

const readBillingForStore = async (storeId) => {
  const snap = await db.collection("stores").doc(storeId).collection("data").doc(BILLING_KEY).get();
  const payload = snap.exists ? (snap.data() || {}) : {};
  const value = payload && payload.value && typeof payload.value === "object" ? payload.value : {};
  const payments = Array.isArray(value.payments) ? value.payments.filter((item) => item && typeof item === "object") : [];
  return {
    currentPlanId: String(value.currentPlanId || ""),
    validUntil: String(value.validUntil || ""),
    trial: Boolean(value.trial),
    trialStartedAt: String(value.trialStartedAt || ""),
    payments
  };
};

const writeBillingForStore = async (storeId, billingValue) => {
  const payload = {
    key: BILLING_KEY,
    value: billingValue,
    updatedAt: new Date().toISOString()
  };

  await db.collection("stores").doc(storeId).collection("data").doc(BILLING_KEY).set(payload, { merge: true });
};

const activateTariffForStore = async ({ storeId, invoiceId, tariff, amountKop }) => {
  const billing = await readBillingForStore(storeId);
  const existingPayment = (billing.payments || []).find((item) => {
    const ref = String(item && item.reference || "").trim();
    const id = String(item && item.id || "").trim();
    return ref === String(invoiceId) || id === `mono-${invoiceId}`;
  });

  // Idempotency guard: if this invoice was already applied, do nothing.
  if (existingPayment) {
    return;
  }

  const nowIso = new Date().toISOString();
  const currentUntil = new Date(billing.validUntil || "");
  const isCurrentActive = Number.isFinite(currentUntil.getTime()) && currentUntil.getTime() > Date.now();
  const baseDate = isCurrentActive ? currentUntil : new Date();
  const nextValidUntil = addMonthsIso(baseDate, tariff.periodMonths);

  const payment = {
    id: `mono-${invoiceId}`,
    planId: tariff.id,
    planName: tariff.name,
    amount: Math.round((Number(amountKop) || 0) / 100),
    periodMonths: tariff.periodMonths,
    paidAt: nowIso,
    actorRole: "user",
    source: "monobank-acquiring",
    reference: invoiceId
  };

  const nextBilling = {
    currentPlanId: tariff.id,
    validUntil: nextValidUntil,
    trial: false,
    trialStartedAt: billing.trialStartedAt || "",
    payments: [payment, ...billing.payments].slice(0, 40)
  };

  await writeBillingForStore(storeId, nextBilling);
};

const resolveWebhookUrl = () => "https://us-central1-lavka-shop.cloudfunctions.net/monoTariffWebhook";

exports.createTariffInvoice = onRequest(
  { secrets: [MONO_X_TOKEN], cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const token = MONO_X_TOKEN.value();
    if (!token) {
      res.status(500).json({ ok: false, error: "mono-token-missing" });
      return;
    }

    const tariffId = normalizeTariffId(req.body && req.body.tariffId);
    const storeId = sanitizeStoreIdStrict(req.body && req.body.storeId);
    const userId = sanitizeUserIdentity((req.body && req.body.userId) || (req.body && req.body.email));
    const returnBaseUrl = sanitizeReturnBaseUrl(req.body && req.body.returnBaseUrl);
    const withAppUrl = Boolean(req.body && req.body.withAppUrl);

    const tariff = TARIFF_PLANS[tariffId] || null;
    if (!tariff) {
      res.status(400).json({ ok: false, error: "invalid-tariff" });
      return;
    }

    if (!storeId) {
      res.status(400).json({ ok: false, error: "invalid-store-id" });
      return;
    }

    try {
      const storeSnap = await db.collection("stores_registry").doc(storeId).get();
      if (!storeSnap.exists) {
        res.status(404).json({ ok: false, error: "store-not-found" });
        return;
      }

      const urls = buildPaymentUrls(returnBaseUrl);
      const reference = createTariffReference(storeId);
      const nowMs = Date.now();
      const validitySec = 3600;
      const expiresAtMs = nowMs + validitySec * 1000;
      const commentUser = userId ? ` для ${userId}` : "";

      const body = {
        amount: tariff.amountKop,
        ccy: MONO_CCY_UAH,
        merchantPaymInfo: {
          reference,
          destination: `Оплата тарифу \u00ab${tariff.name}\u00bb`,
          comment: `Оплата тарифу \u00ab${tariff.name}\u00bb${commentUser}`,
          basketOrder: [
            {
              code: tariff.code,
              name: `Тариф ${tariff.name} (${tariff.periodMonths} міс.)`,
              qty: 1,
              sum: tariff.amountKop,
              total: tariff.amountKop,
              unit: "шт."
            }
          ]
        },
        redirectUrl: urls.redirectUrl,
        successUrl: urls.successUrl,
        failUrl: urls.failUrl,
        webHookUrl: resolveWebhookUrl(),
        validity: validitySec,
        paymentType: "debit",
        withAppUrl
      };

      const monoPayload = await monoRequest("/api/merchant/invoice/create", token, {
        method: "POST",
        body: JSON.stringify(body)
      });

      const invoiceId = String(monoPayload && monoPayload.invoiceId || "").trim();
      const pageUrl = String(monoPayload && monoPayload.pageUrl || "").trim();
      const appUrl = String(monoPayload && monoPayload.appUrl || "").trim();

      if (!invoiceId || !pageUrl) {
        res.status(500).json({ ok: false, error: "mono-invalid-response" });
        return;
      }

      const invoiceDoc = {
        invoiceId,
        reference,
        storeId,
        userId,
        tariffId: tariff.id,
        tariffName: tariff.name,
        periodMonths: tariff.periodMonths,
        amountKop: tariff.amountKop,
        ccy: MONO_CCY_UAH,
        status: "created",
        monoStatus: "created",
        modifiedDate: 0,
        createdAtMs: nowMs,
        pageUrl,
        appUrl,
        validitySec,
        expiresAtMs,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection(BILLING_INVOICES_COLLECTION).doc(invoiceId).set(invoiceDoc, { merge: true });

      res.status(200).json({
        ok: true,
        invoiceId,
        pageUrl,
        appUrl: appUrl || ""
      });
    } catch (error) {
      console.error("createTariffInvoice error:", error);
      const status = Number(error && error.httpStatus) || 500;
      if (status === 400) {
        res.status(400).json({ ok: false, error: "mono-bad-request" });
        return;
      }
      if (status === 403) {
        res.status(500).json({ ok: false, error: "mono-invalid-token" });
        return;
      }
      if (status === 404) {
        res.status(404).json({ ok: false, error: "mono-entity-not-found" });
        return;
      }
      if (status === 429) {
        res.status(429).json({ ok: false, error: "mono-rate-limit" });
        return;
      }
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

const verifyInvoiceWithMono = async (token, invoiceId) => {
  try {
    const payload = await monoRequest(`/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`, token, {
      method: "GET"
    });
    return {
      verified: true,
      payload
    };
  } catch (error) {
    console.error("verifyInvoiceWithMono error:", error);
    return {
      verified: false,
      payload: null
    };
  }
};

const applyMonoInvoiceStatus = async (webhookPayload, monoStatusPayload, tokenPresent) => {
  const source = (monoStatusPayload && typeof monoStatusPayload === "object") ? monoStatusPayload : webhookPayload;
  const invoiceId = String(source && source.invoiceId || "").trim();
  if (!invoiceId) return;

  const modifiedDate = parseMonoModifiedDate(source.modifiedDate || source.createdDate || Date.now());
  const status = String(source.status || webhookPayload.status || "").trim().toLowerCase();

  const invoiceRef = db.collection(BILLING_INVOICES_COLLECTION).doc(invoiceId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(invoiceRef);
    if (!snap.exists) return;

    const data = snap.data() || {};
    const previousModifiedDate = Number(data.modifiedDate) || 0;
    if (modifiedDate <= previousModifiedDate) {
      return;
    }

    tx.set(invoiceRef, {
      monoStatus: status || String(data.monoStatus || "created"),
      status: status || String(data.status || "created"),
      modifiedDate,
      rawLastWebhook: webhookPayload,
      rawLastStatus: monoStatusPayload || null,
      verifiedByStatusApi: Boolean(tokenPresent && monoStatusPayload),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const shouldActivate = status === "success" && !Boolean(data.activatedAt);
    if (!shouldActivate) {
      return;
    }

    const storeId = sanitizeStoreIdStrict(data.storeId);
    const tariff = TARIFF_PLANS[normalizeTariffId(data.tariffId)] || null;
    if (!storeId || !tariff) {
      return;
    }

    tx.set(invoiceRef, {
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      activatedStatus: "queued"
    }, { merge: true });
  });

  const latestSnap = await invoiceRef.get();
  if (!latestSnap.exists) return;
  const latestData = latestSnap.data() || {};
  const shouldActivateNow = String(latestData.status || "").toLowerCase() === "success"
    && Boolean(latestData.activatedAt)
    && String(latestData.activatedStatus || "").toLowerCase() !== "done";
  if (!shouldActivateNow) return;

  const storeId = sanitizeStoreIdStrict(latestData.storeId);
  const tariff = TARIFF_PLANS[normalizeTariffId(latestData.tariffId)] || null;
  if (!storeId || !tariff) return;

  try {
    await activateTariffForStore({
      storeId,
      invoiceId,
      tariff,
      amountKop: Number(latestData.amountKop) || tariff.amountKop
    });

    await invoiceRef.set({
      activatedStatus: "done",
      activatedDoneAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("activateTariffForStore error:", error);
    await invoiceRef.set({
      activatedStatus: "failed",
      activationError: String(error && error.message || "activation-failed").slice(0, 500),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
};

exports.monoTariffWebhook = onRequest(
  { secrets: [MONO_X_TOKEN], cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const webhookPayload = req.body && typeof req.body === "object" ? req.body : {};
    const invoiceId = String(webhookPayload.invoiceId || "").trim();
    if (!invoiceId) {
      res.status(200).send("ok");
      return;
    }

    try {
      const token = MONO_X_TOKEN.value();
      const monoStatusResult = token ? await verifyInvoiceWithMono(token, invoiceId) : { verified: false, payload: null };

      await applyMonoInvoiceStatus(
        webhookPayload,
        monoStatusResult.verified ? monoStatusResult.payload : null,
        Boolean(token)
      );
      res.status(200).send("ok");
    } catch (error) {
      console.error("monoTariffWebhook error:", error);
      // Return 200 to avoid aggressive retries; reconciliation job will recover state.
      res.status(200).send("ok");
    }
  }
);

exports.getTariffInvoiceStatus = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const invoiceId = String((req.query && req.query.invoiceId) || "").trim();
    if (!invoiceId) {
      res.status(400).json({ ok: false, error: "invoice-id-required" });
      return;
    }

    try {
      const snap = await db.collection(BILLING_INVOICES_COLLECTION).doc(invoiceId).get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, error: "not-found" });
        return;
      }

      const data = snap.data() || {};
      res.status(200).json({
        ok: true,
        invoiceId,
        status: String(data.status || "created"),
        monoStatus: String(data.monoStatus || "created"),
        modifiedDate: Number(data.modifiedDate) || 0,
        activatedStatus: String(data.activatedStatus || ""),
        tariffId: String(data.tariffId || ""),
        amountKop: Number(data.amountKop) || 0
      });
    } catch (error) {
      console.error("getTariffInvoiceStatus error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

exports.getStoreOrderInvoiceStatus = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const invoiceId = String((req.query && req.query.invoiceId) || "").trim();
    const orderId = String((req.query && req.query.orderId) || "").trim();
    if (!invoiceId && !orderId) {
      res.status(400).json({ ok: false, error: "invoice-id-or-order-id-required" });
      return;
    }

    try {
      let snap = null;
      let foundInvoiceId = invoiceId;
      if (invoiceId) {
        snap = await db.collection(STORE_ORDER_INVOICES_COLLECTION).doc(invoiceId).get();
      } else {
        // search by orderId - pick the latest matching invoice
        const q = await db.collection(STORE_ORDER_INVOICES_COLLECTION).where('orderId', '==', orderId).orderBy('createdAt', 'desc').limit(1).get();
        if (!q.empty) {
          snap = q.docs[0];
          foundInvoiceId = String(snap.id || "");
        }
      }

      if (!snap || (snap.exists === false)) {
        res.status(404).json({ ok: false, error: "not-found" });
        return;
      }

      const data = snap.data ? snap.data() : snap.data() || {};
      res.status(200).json({
        ok: true,
        invoiceId: foundInvoiceId,
        status: String(data.status || "created"),
        monoStatus: String(data.monoStatus || "created"),
        modifiedDate: Number(data.modifiedDate) || 0,
        storeId: String(data.storeId || ""),
        orderId: String(data.orderId || ""),
        pageUrl: String(data.pageUrl || "")
      });
    } catch (error) {
      console.error("getStoreOrderInvoiceStatus error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

exports.reconcileStoreTariffInvoices = onRequest(
  { secrets: [MONO_X_TOKEN], cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const token = MONO_X_TOKEN.value();
    if (!token) {
      res.status(500).json({ ok: false, error: "mono-token-missing" });
      return;
    }

    const storeId = sanitizeStoreIdStrict(req.body && req.body.storeId);
    if (!storeId) {
      res.status(400).json({ ok: false, error: "invalid-store-id" });
      return;
    }

    try {
      const snap = await db
        .collection(BILLING_INVOICES_COLLECTION)
        .where("storeId", "==", storeId)
        .where("status", "==", "created")
        .limit(20)
        .get();

      if (snap.empty) {
        res.status(200).json({ ok: true, processed: 0 });
        return;
      }

      let processed = 0;
      for (const docSnap of snap.docs) {
        const data = docSnap.data() || {};
        const invoiceId = String(data.invoiceId || docSnap.id || "").trim();
        if (!invoiceId) continue;

        try {
          const monoStatusPayload = await monoRequest(`/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`, token, {
            method: "GET"
          });

          await applyMonoInvoiceStatus(
            { invoiceId, source: "manual-reconcile" },
            monoStatusPayload,
            true
          );
          processed += 1;
        } catch (error) {
          console.error("reconcileStoreTariffInvoices item error:", invoiceId, error);
        }
      }

      res.status(200).json({ ok: true, processed });
    } catch (error) {
      console.error("reconcileStoreTariffInvoices error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

exports.expireMonoTariffInvoices = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Europe/Kyiv"
  },
  async () => {
    const nowMs = Date.now();
    const snap = await db
      .collection(BILLING_INVOICES_COLLECTION)
      .where("status", "==", "created")
      .where("expiresAtMs", "<=", nowMs)
      .limit(200)
      .get();

    if (snap.empty) {
      return;
    }

    const batch = db.batch();
    snap.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        status: "expired",
        monoStatus: "expired",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        modifiedDate: nowMs
      }, { merge: true });
    });

    await batch.commit();
  }
);

exports.reconcileMonoTariffInvoices = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: "Europe/Kyiv",
    secrets: [MONO_X_TOKEN]
  },
  async () => {
    const token = MONO_X_TOKEN.value();
    if (!token) {
      return;
    }

    const nowMs = Date.now();
    const snap = await db
      .collection(BILLING_INVOICES_COLLECTION)
      .where("status", "==", "created")
      .where("expiresAtMs", ">", nowMs)
      .limit(60)
      .get();

    if (snap.empty) {
      return;
    }

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const invoiceId = String(data.invoiceId || docSnap.id || "").trim();
      if (!invoiceId) continue;

      try {
        const monoStatusPayload = await monoRequest(`/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`, token, {
          method: "GET"
        });

        await applyMonoInvoiceStatus(
          { invoiceId, source: "scheduler-reconcile" },
          monoStatusPayload,
          true
        );
      } catch (error) {
        console.error("reconcileMonoTariffInvoices item error:", invoiceId, error);
      }
    }
  }
);

/* ────────────────────────────────────────────────────────────────────────
 * Monobank acquiring: оплата замовлень магазину (store checkout)
 * ──────────────────────────────────────────────────────────────────────── */

const STORE_CHECKOUT_KEY = "lavkaCheckoutSettings";
const STORE_SETTINGS_KEY = "lavkaStoreSettings";
const STORE_ORDERS_KEY = "lavkaOrders";
const STORE_ORDER_INVOICES_COLLECTION = "store_order_invoices";

const sanitizeOrderId = (value) => String(value || "").trim().slice(0, 64);

const resolveStoreOrderWebhookUrl = () => "https://us-central1-lavka-shop.cloudfunctions.net/monoStoreOrderWebhook";

const normalizeStoreCurrency = (value) => {
  const code = String(value || "").trim().toLowerCase();
  if (code === "uah" || code === "980") {
    return MONO_CCY_UAH;
  }
  return MONO_CCY_UAH;
};

const readStoreCheckoutConfig = async (storeId) => {
  const baseRef = db.collection("stores").doc(storeId).collection("data");
  const [checkoutSnap, settingsSnap] = await Promise.all([
    baseRef.doc(STORE_CHECKOUT_KEY).get(),
    baseRef.doc(STORE_SETTINGS_KEY).get()
  ]);

  const checkoutValue = checkoutSnap.exists ? ((checkoutSnap.data() || {}).value || {}) : {};
  const settingsValue = settingsSnap.exists ? ((settingsSnap.data() || {}).value || {}) : {};

  const enabled = Boolean(
    checkoutValue.paymentMonoEnabled !== undefined
      ? checkoutValue.paymentMonoEnabled
      : settingsValue.paymentMonoEnabled
  );
  const token = String(checkoutValue.paymentMonoSecret || settingsValue.paymentMonoSecret || "").trim();
  const merchantId = String(checkoutValue.paymentMonoMerchantId || settingsValue.paymentMonoMerchantId || "").trim();

  return {
    enabled,
    token,
    merchantId
  };
};

const buildStoreOrderPaymentUrls = (baseUrl, orderId) => {
  const normalizedBase = sanitizeReturnBaseUrl(baseUrl);
  const fallback = "https://lavka-shop.web.app";
  const origin = normalizedBase || fallback;
  const encodedOrder = encodeURIComponent(String(orderId || ""));

  return {
    redirectUrl: `${origin}/checkout.html?payment=processing&order=${encodedOrder}`,
    successUrl: `${origin}/checkout.html?payment=success&order=${encodedOrder}`,
    failUrl: `${origin}/checkout.html?payment=fail&order=${encodedOrder}`
  };
};

const createStoreOrderReference = (storeId, orderId) => {
  const randomPart = Math.random().toString(36).slice(2, 9);
  const compactOrder = String(orderId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "order";
  return `store_${storeId}_${compactOrder}_${Date.now()}_${randomPart}`;
};

const updateStoreOrderPaymentStatus = async ({
  storeId,
  orderId,
  paymentStatus,
  monoInvoiceId,
  monoStatus,
  pageUrl
}) => {
  const safeStoreId = sanitizeStoreIdStrict(storeId);
  const safeOrderId = sanitizeOrderId(orderId);
  if (!safeStoreId || !safeOrderId) {
    return false;
  }

  const orderDocRef = db.collection("stores").doc(safeStoreId).collection("data").doc(STORE_ORDERS_KEY);
  const snap = await orderDocRef.get();
  if (!snap.exists) {
    return false;
  }

  const payload = snap.data() || {};
  const list = Array.isArray(payload.value) ? payload.value.slice() : [];
  const index = list.findIndex((item) => String(item && item.id || "").trim() === safeOrderId);
  if (index < 0) {
    return false;
  }

  const current = list[index] && typeof list[index] === "object" ? list[index] : {};
  list[index] = {
    ...current,
    paymentStatus: String(paymentStatus || current.paymentStatus || "Не оплачено"),
    monoInvoiceId: String(monoInvoiceId || current.monoInvoiceId || ""),
    monoStatus: String(monoStatus || current.monoStatus || ""),
    monoPageUrl: String(pageUrl || current.monoPageUrl || ""),
    updatedAt: new Date().toISOString()
  };

  await orderDocRef.set({
    key: STORE_ORDERS_KEY,
    value: list,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return true;
};

exports.createStoreOrderMonoInvoice = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const storeId = sanitizeStoreIdStrict(req.body && req.body.storeId);
    const orderId = sanitizeOrderId(req.body && req.body.orderId);
    const amount = Math.max(0, Math.round(Number(req.body && req.body.amount) || 0));
    const amountKop = amount * 100;
    const returnBaseUrl = String(req.body && req.body.returnBaseUrl || "");
    const customerName = sanitizeUserIdentity(req.body && req.body.customerName);
    const customerPhone = sanitizeUserIdentity(req.body && req.body.customerPhone);
    const paymentMethod = sanitizeUserIdentity(req.body && req.body.paymentMethod);
    const currency = normalizeStoreCurrency(req.body && req.body.currency);
    const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];

    if (!storeId) {
      res.status(400).json({ ok: false, error: "invalid-store-id" });
      return;
    }
    if (!orderId || amountKop <= 0) {
      res.status(400).json({ ok: false, error: "invalid-order" });
      return;
    }

    try {
      const monoConfig = await readStoreCheckoutConfig(storeId);
      if (!monoConfig.enabled) {
        res.status(400).json({ ok: false, error: "mono-disabled" });
        return;
      }
      if (!monoConfig.token) {
        res.status(400).json({ ok: false, error: "mono-config-missing" });
        return;
      }

      const nowMs = Date.now();
      const validitySec = 60 * 45;
      const expiresAtMs = nowMs + (validitySec * 1000);
      const reference = createStoreOrderReference(storeId, orderId);
      const urls = buildStoreOrderPaymentUrls(returnBaseUrl, orderId);

      const basketOrder = items.slice(0, 50).map((item) => {
        const qty = Math.max(1, Math.round(Number(item && item.qty) || 1));
        const unitSum = Math.max(0, Math.round(Number(item && item.price) || 0)) * 100;
        const total = qty * unitSum;
        return {
          code: sanitizeUserIdentity(item && item.code).slice(0, 64) || "item",
          name: sanitizeUserIdentity(item && item.name).slice(0, 120) || "Товар",
          qty,
          sum: unitSum,
          total,
          unit: "шт."
        };
      });

      const body = {
        amount: amountKop,
        ccy: currency,
        merchantPaymInfo: {
          reference,
          destination: `Оплата замовлення ${orderId}`,
          comment: `Магазин ${storeId}. ${paymentMethod || "Plata by mono"}. ${customerName || "Клієнт"} ${customerPhone || ""}`.trim(),
          basketOrder: basketOrder.length
            ? basketOrder
            : [
              {
                code: "order",
                name: `Замовлення ${orderId}`,
                qty: 1,
                sum: amountKop,
                total: amountKop,
                unit: "шт."
              }
            ]
        },
        redirectUrl: urls.redirectUrl,
        successUrl: urls.successUrl,
        failUrl: urls.failUrl,
        webHookUrl: resolveStoreOrderWebhookUrl(),
        validity: validitySec,
        paymentType: "debit",
        withAppUrl: true
      };

      const monoPayload = await monoRequest("/api/merchant/invoice/create", monoConfig.token, {
        method: "POST",
        body: JSON.stringify(body)
      });

      const invoiceId = String(monoPayload && monoPayload.invoiceId || "").trim();
      const pageUrl = String(monoPayload && monoPayload.pageUrl || "").trim();
      const appUrl = String(monoPayload && monoPayload.appUrl || "").trim();

      if (!invoiceId || !pageUrl) {
        res.status(500).json({ ok: false, error: "mono-invalid-response" });
        return;
      }

      const invoiceDoc = {
        invoiceId,
        reference,
        storeId,
        orderId,
        amount,
        amountKop,
        ccy: currency,
        paymentMethod: paymentMethod || "Plata by mono",
        status: "created",
        monoStatus: "created",
        modifiedDate: 0,
        createdAtMs: nowMs,
        expiresAtMs,
        pageUrl,
        appUrl,
        merchantId: monoConfig.merchantId || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection(STORE_ORDER_INVOICES_COLLECTION).doc(invoiceId).set(invoiceDoc, { merge: true });

      await updateStoreOrderPaymentStatus({
        storeId,
        orderId,
        paymentStatus: "Очікує оплати",
        monoInvoiceId: invoiceId,
        monoStatus: "created",
        pageUrl
      });

      res.status(200).json({
        ok: true,
        invoiceId,
        pageUrl,
        appUrl: appUrl || ""
      });
    } catch (error) {
      console.error("createStoreOrderMonoInvoice error:", error);
      const status = Number(error && error.httpStatus) || 500;
      if (status === 400) {
        res.status(400).json({ ok: false, error: "mono-bad-request" });
        return;
      }
      if (status === 403) {
        res.status(500).json({ ok: false, error: "mono-invalid-token" });
        return;
      }
      if (status === 429) {
        res.status(429).json({ ok: false, error: "mono-rate-limit" });
        return;
      }
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

exports.monoStoreOrderWebhook = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method-not-allowed" });
      return;
    }

    const webhookPayload = req.body && typeof req.body === "object" ? req.body : {};
    const invoiceId = String(webhookPayload.invoiceId || "").trim();
    if (!invoiceId) {
      res.status(200).send("ok");
      return;
    }

    try {
      const invoiceRef = db.collection(STORE_ORDER_INVOICES_COLLECTION).doc(invoiceId);
      const snap = await invoiceRef.get();
      if (!snap.exists) {
        res.status(200).send("ok");
        return;
      }

      const current = snap.data() || {};
      const storeId = sanitizeStoreIdStrict(current.storeId);
      if (!storeId) {
        res.status(200).send("ok");
        return;
      }

      const monoConfig = await readStoreCheckoutConfig(storeId);
      if (!monoConfig.token) {
        await invoiceRef.set({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "config-missing",
          monoStatus: "config-missing",
          rawLastWebhook: webhookPayload
        }, { merge: true });
        res.status(200).send("ok");
        return;
      }

      const monoStatusPayload = await monoRequest(
        `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
        monoConfig.token,
        { method: "GET" }
      );

      const status = String(monoStatusPayload && monoStatusPayload.status || "").trim().toLowerCase() || "created";
      const modifiedDate = toMonoModifiedDate(monoStatusPayload && monoStatusPayload.modifiedDate);
      const prevModified = Number(current.modifiedDate) || 0;
      if (modifiedDate > prevModified || !prevModified) {
        await invoiceRef.set({
          status,
          monoStatus: status,
          modifiedDate,
          rawLastWebhook: webhookPayload,
          rawLastStatus: monoStatusPayload,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const orderId = sanitizeOrderId(current.orderId);
      if (status === "success" && orderId) {
        await updateStoreOrderPaymentStatus({
          storeId,
          orderId,
          paymentStatus: "Оплачено",
          monoInvoiceId: invoiceId,
          monoStatus: status,
          pageUrl: String(current.pageUrl || "")
        });

        await invoiceRef.set({
          activatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      if ((status === "failure" || status === "expired") && orderId) {
        await updateStoreOrderPaymentStatus({
          storeId,
          orderId,
          paymentStatus: "Не оплачено",
          monoInvoiceId: invoiceId,
          monoStatus: status,
          pageUrl: String(current.pageUrl || "")
        });
      }

      res.status(200).send("ok");
    } catch (error) {
      console.error("monoStoreOrderWebhook error:", error);
      res.status(200).send("ok");
    }
  }
);
