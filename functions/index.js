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
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const CLOUDFLARE_API_TOKEN = defineSecret("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ZONE_ID = defineSecret("CLOUDFLARE_ZONE_ID");
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const MONO_X_TOKEN = defineSecret("MONO_X_TOKEN");
const TURBOSMS_TOKEN = defineSecret("TURBOSMS_TOKEN");
// Токен Telegram Gateway API (https://gateway.telegram.org), окремий від TELEGRAM_BOT_TOKEN.
const TELEGRAM_GATEWAY_TOKEN = defineSecret("TELEGRAM_GATEWAY_TOKEN");

// Хост, на який клієнти вказують CNAME свого домену.
const CNAME_TARGET = "cname.vitryna-shop.com";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// ─────────────────────────────────────────────────────────────────────────
// One-time infra fix: Storage bucket CORS doesn't allow uploads from store
// custom domains (browsers block the preflight request). This endpoint sets
// bucket CORS via the already-authenticated Admin SDK, since gsutil/gcloud
// aren't available in this environment. Call it once, then it can stay —
// it's idempotent and safe to re-run.
const STORAGE_CORS_SETUP_TOKEN = "vitrina-storage-cors-setup-2026";
const STORAGE_CORS_BUCKETS = ["lavka-shop.firebasestorage.app", "lavka-shop.appspot.com"];

exports.configureStorageCors = onRequest(async (req, res) => {
  if (String(req.query.token || "") !== STORAGE_CORS_SETUP_TOKEN) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  if (req.query.list === "1") {
    try {
      const defaultBucket = admin.storage().bucket();
      const [defaultExists] = await defaultBucket.exists();
      const checks = [];
      for (const name of [...STORAGE_CORS_BUCKETS, defaultBucket.name]) {
        try {
          const [exists] = await admin.storage().bucket(name).exists();
          checks.push({ bucket: name, exists });
        } catch (error) {
          checks.push({ bucket: name, error: String((error && error.message) || error) });
        }
      }
      res.status(200).json({ ok: true, defaultBucketName: defaultBucket.name, defaultExists, checks });
    } catch (error) {
      res.status(500).json({ ok: false, error: String((error && error.message) || error) });
    }
    return;
  }

  const corsConfig = [
    {
      origin: ["*"],
      method: ["GET", "HEAD", "PUT", "POST", "DELETE"],
      responseHeader: ["Content-Type", "Content-Length", "x-goog-resumable", "x-goog-meta-*"],
      maxAgeSeconds: 3600
    }
  ];

  const results = [];
  for (const bucketName of STORAGE_CORS_BUCKETS) {
    try {
      await admin.storage().bucket(bucketName).setMetadata({ cors: corsConfig });
      results.push({ bucket: bucketName, ok: true });
    } catch (error) {
      results.push({ bucket: bucketName, ok: false, error: String((error && error.message) || error) });
    }
  }

  res.status(200).json({ ok: true, results });
});

const STOREFRONT_HOST = "vitryna-shop.com";
const SITEMAP_STATIC_URLS = [
  { loc: `https://${STOREFRONT_HOST}/landing.html`, changefreq: "weekly", priority: "1.0" },
  { loc: `https://${STOREFRONT_HOST}/login.html`, changefreq: "monthly", priority: "0.7" },
  { loc: `https://${STOREFRONT_HOST}/registration.html`, changefreq: "monthly", priority: "0.8" }
];

const xmlEscape = (value) => String(value == null ? "" : value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const formatLastMod = (value) => {
  if (!value) return "";
  const directDate = value instanceof Date ? value : null;
  const timestampDate = typeof value.toDate === "function" ? value.toDate() : null;
  const parsedDate = !directDate && !timestampDate ? new Date(value) : null;
  const resolved = directDate || timestampDate || parsedDate;
  if (!(resolved instanceof Date) || Number.isNaN(resolved.getTime())) {
    return "";
  }
  return resolved.toISOString();
};

const isStoreIndexable = (statusValue) => {
  const status = String(statusValue || "").trim().toLowerCase();
  if (!status) return true;
  return !["blocked", "deleted", "disabled", "inactive", "suspended"].includes(status);
};

const buildSitemapXml = (entries) => {
  const rows = entries.map((entry) => {
    const parts = [`    <loc>${xmlEscape(entry.loc)}</loc>`];
    if (entry.lastmod) parts.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) parts.push(`    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`);
    if (entry.priority) parts.push(`    <priority>${xmlEscape(entry.priority)}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
};

exports.storefrontSitemap = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const mapByLoc = new Map();
    SITEMAP_STATIC_URLS.forEach((entry) => mapByLoc.set(entry.loc, { ...entry }));

    const storesSnap = await db.collection("stores_registry").get();
    storesSnap.forEach((docSnap) => {
      const storeId = sanitizeStoreId(docSnap.id);
      if (!storeId) return;

      const data = docSnap.data() || {};
      if (!isStoreIndexable(data.status)) return;

      const subdomain = sanitizeStoreId(data.subdomain || storeId);
      if (!subdomain) return;

      const loc = `https://${subdomain}.${STOREFRONT_HOST}/`;
      const lastmod = formatLastMod(data.updatedAt || data.createdAt || null);

      mapByLoc.set(loc, {
        loc,
        lastmod,
        changefreq: "daily",
        priority: "0.9"
      });
    });

    const xml = buildSitemapXml(Array.from(mapByLoc.values()));
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=1800, s-maxage=1800");
    res.status(200).send(xml);
  } catch (error) {
    console.error("storefrontSitemap error:", error);
    res.status(500).send("internal-error");
  }
});

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

const cleanText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeIp = (value) => String(value || "").trim().toLowerCase();

const encodeIpKey = (ip) => normalizeIp(ip).replace(/[^a-z0-9:.]/g, "_");

const deleteCollectionDocsAdmin = async (collectionRef, chunkSize = 200) => {
  const size = Math.max(1, Number(chunkSize) || 200);
  while (true) {
    const pageSnap = await collectionRef.limit(size).get();
    if (pageSnap.empty) break;

    const batch = db.batch();
    pageSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    if (pageSnap.size < size) break;
  }
};

const deleteQueryDocsAdmin = async (queryRef, chunkSize = 200) => {
  const size = Math.max(1, Number(chunkSize) || 200);
  while (true) {
    const pageSnap = await queryRef.limit(size).get();
    if (pageSnap.empty) break;

    const batch = db.batch();
    pageSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    if (pageSnap.size < size) break;
  }
};

const archiveClientBeforeDeleteAdmin = async (storeId) => {
  const safeStoreId = sanitizeStoreId(storeId);
  if (!safeStoreId) return;

  const dataCol = db.collection("stores").doc(safeStoreId).collection("data");
  const snaps = await Promise.all([
    dataCol.doc("lavkaRegistration").get().catch(() => null),
    dataCol.doc("lavkaStoreSettings").get().catch(() => null),
    dataCol.doc("lavkaAuth").get().catch(() => null),
    dataCol.doc("lavkaBilling").get().catch(() => null),
    db.collection("store_subdomains").doc(safeStoreId).get().catch(() => null),
    db.collection("stores_registry").doc(safeStoreId).get().catch(() => null)
  ]);

  const registrationValue = (snaps[0] && snaps[0].exists ? (snaps[0].data() || {}) : {}).value || {};
  const settingsValue = (snaps[1] && snaps[1].exists ? (snaps[1].data() || {}) : {}).value || {};
  const authValue = (snaps[2] && snaps[2].exists ? (snaps[2].data() || {}) : {}).value || {};
  const billingValue = (snaps[3] && snaps[3].exists ? (snaps[3].data() || {}) : {}).value || {};
  const subdomainData = snaps[4] && snaps[4].exists ? (snaps[4].data() || {}) : {};
  const registryData = snaps[5] && snaps[5].exists ? (snaps[5].data() || {}) : {};

  const planId = cleanText(billingValue.currentPlanId).toLowerCase();
  const planNames = { starter: "Старт", business: "Бізнес", pro: "Про" };
  const domain = cleanText(settingsValue.customDomain)
    || cleanText(registrationValue.customDomain)
    || cleanText(registrationValue.domain)
    || cleanText(settingsValue.domain)
    || cleanText(registryData.domain)
    || cleanText(subdomainData.domain);
  const clientName = cleanText(registrationValue.clientName)
    || cleanText(registrationValue.ownerName)
    || cleanText(registrationValue.fullName)
    || cleanText(registrationValue.name)
    || cleanText(registryData.clientName);

  await db.collection("clients_registry").doc(safeStoreId).set({
    storeId: safeStoreId,
    clientName,
    registeredAt: registrationValue.registeredAt || registryData.createdAt || registryData.updatedAt || "",
    phone: cleanText(registrationValue.phone) || cleanText(registryData.phone),
    storeName: cleanText(registrationValue.storeName) || cleanText(settingsValue.storeName) || cleanText(registryData.storeName),
    domain,
    planId,
    planName: planId && planNames[planId] ? planNames[planId] : (planId || ""),
    status: "deleted",
    ipAddress: cleanText(authValue.lastIpAddress || authValue.ipAddress || registryData.lastIpAddress || subdomainData.lastIpAddress || ""),
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

exports.deleteStoreAccountCascade = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method-not-allowed" });
    return;
  }

  const safeStoreId = sanitizeStoreId(req.body && req.body.storeId);
  if (!safeStoreId) {
    res.status(400).json({ ok: false, error: "invalid-store-id" });
    return;
  }

  try {
    const storeRef = db.collection("stores").doc(safeStoreId);
    const dataCollectionRef = storeRef.collection("data");
    const privateCollectionRef = storeRef.collection("private");

    await archiveClientBeforeDeleteAdmin(safeStoreId).catch((error) => {
      console.warn("[deleteStoreAccountCascade] archive before delete failed:", error);
    });

    const snapshots = await Promise.all([
      dataCollectionRef.doc("lavkaAuth").get().catch(() => null),
      db.collection("store_subdomains").doc(safeStoreId).get().catch(() => null),
      db.collection("stores_registry").doc(safeStoreId).get().catch(() => null)
    ]);

    const authValue = (snapshots[0] && snapshots[0].exists ? (snapshots[0].data() || {}) : {}).value || {};
    const subdomainValue = snapshots[1] && snapshots[1].exists ? (snapshots[1].data() || {}) : {};
    const registryValue = snapshots[2] && snapshots[2].exists ? (snapshots[2].data() || {}) : {};
    const normalizedIp = normalizeIp(
      authValue.lastIpAddress
      || authValue.ipAddress
      || subdomainValue.lastIpAddress
      || registryValue.lastIpAddress
      || ""
    );

    await deleteCollectionDocsAdmin(dataCollectionRef, 200);
    await deleteCollectionDocsAdmin(privateCollectionRef, 200);

    const batch = db.batch();
    batch.delete(storeRef);
    batch.delete(db.collection("stores_registry").doc(safeStoreId));
    batch.delete(db.collection("store_subdomains").doc(safeStoreId));
    batch.delete(db.collection("store_telegram").doc(safeStoreId));
    if (normalizedIp) {
      batch.delete(db.collection("blocked_ips").doc(encodeIpKey(normalizedIp)));
    }
    await batch.commit();

    await Promise.all([
      deleteQueryDocsAdmin(db.collection("billing_invoices").where("storeId", "==", safeStoreId), 200),
      deleteQueryDocsAdmin(db.collection("store_order_invoices").where("storeId", "==", safeStoreId), 200),
      deleteQueryDocsAdmin(db.collection("store_order_liqpay_invoices").where("storeId", "==", safeStoreId), 200)
    ]);

    res.status(200).json({ ok: true, storeId: safeStoreId });
  } catch (error) {
    console.error("deleteStoreAccountCascade error:", error);
    res.status(500).json({ ok: false, error: "internal" });
  }
});

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

// ─────────────────────────────────────────────────────────────────────────
// TurboSMS — реальна відправка коду підтвердження при вході/реєстрації.
// Код генерується та зберігається тільки на сервері (Firestore, недоступний
// клієнтам напряму — див. firestore.rules), клієнт лише передає телефон/код.
// ─────────────────────────────────────────────────────────────────────────
const TURBOSMS_API_URL = "https://api.turbosms.ua/message/send.json";
const TURBOSMS_SENDER = "latiao_info";
const AUTH_CODES_COLLECTION = "auth_codes";
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const AUTH_CODE_RESEND_COOLDOWN_MS = 30 * 1000;
const AUTH_CODE_MAX_ATTEMPTS = 5;

// Перетворює будь-який ввід телефону в формат 380XXXXXXXXX, який очікує TurboSMS.
const normalizePhoneForTurboSms = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("380") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `380${digits.slice(1)}`;
  if (digits.length === 9) return `380${digits}`;
  return digits;
};

const sanitizeAuthCodeKey = (raw) => String(raw || "").replace(/\D/g, "").slice(-15);

const sendTurboSmsCode = async (token, recipientPhone, code) => {
  const response = await fetch(TURBOSMS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      recipients: [recipientPhone],
      sms: {
        sender: TURBOSMS_SENDER,
        text: `Код підтвердження: ${code}. Нікому його не повідомляйте.`
      }
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  const result = data && Array.isArray(data.response_result) ? data.response_result[0] : null;
  const ok = Boolean(response.ok && result && result.response_code === 0);
  return {
    ok,
    status: response.status,
    messageId: result && result.message_id,
    errorStatus: (result && result.response_status) || (data && data.response_status),
    data
  };
};

// ─────────────────────────────────────────────────────────────────────────
// Telegram Gateway (https://gateway.telegram.org) — надсилає той самий код
// у службовий чат "Verification Codes" користувача, якщо його номер
// зареєстрований у Telegram. Швидше й дешевше за SMS, використовується як
// пріоритетний канал, з резервним переходом на TurboSMS у разі невдачі.
// ─────────────────────────────────────────────────────────────────────────
const TELEGRAM_GATEWAY_API_URL = "https://gatewayapi.telegram.org";

const normalizePhoneForTelegramGateway = (raw) => {
  const smsFormat = normalizePhoneForTurboSms(raw);
  return smsFormat ? `+${smsFormat}` : "";
};

const sendTelegramGatewayCode = async (token, phoneE164, code) => {
  const response = await fetch(`${TELEGRAM_GATEWAY_API_URL}/sendVerificationMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      phone_number: phoneE164,
      code,
      ttl: Math.round(AUTH_CODE_TTL_MS / 1000)
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok || !data || !data.ok) {
    return { ok: false, status: response.status, error: (data && data.error) || `http-${response.status}` };
  }

  return { ok: true, status: response.status, requestId: data.result && data.result.request_id };
};

// POST { phone } -> генерує 4-значний код, надсилає його через Telegram Gateway
// (якщо номер зареєстрований у Telegram) з резервним переходом на TurboSMS SMS,
// зберігає в auth_codes/{phone} для подальшої перевірки методом verifyAuthCode.
exports.sendAuthCode = onRequest({ cors: true, secrets: [TURBOSMS_TOKEN, TELEGRAM_GATEWAY_TOKEN] }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method-not-allowed" });
    return;
  }

  const smsPhone = normalizePhoneForTurboSms(req.body && req.body.phone);
  const phoneKey = sanitizeAuthCodeKey(req.body && req.body.phone);
  if (!phoneKey || !/^380\d{9}$/.test(smsPhone)) {
    res.status(400).json({ ok: false, error: "invalid-phone" });
    return;
  }

  const ref = db.collection(AUTH_CODES_COLLECTION).doc(phoneKey);

  try {
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() || {} : {};
    const lastSentAtMs = Number(existing.lastSentAtMs) || 0;
    if (lastSentAtMs && Date.now() - lastSentAtMs < AUTH_CODE_RESEND_COOLDOWN_MS) {
      res.status(429).json({
        ok: false,
        error: "too-soon",
        retryAfterSeconds: Math.ceil((lastSentAtMs + AUTH_CODE_RESEND_COOLDOWN_MS - Date.now()) / 1000)
      });
      return;
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));

    let channel = "";
    let messageId = "";
    const telegramToken = TELEGRAM_GATEWAY_TOKEN.value();
    if (telegramToken) {
      const telegramPhone = normalizePhoneForTelegramGateway(req.body && req.body.phone);
      const telegramResult = await sendTelegramGatewayCode(telegramToken, telegramPhone, code);
      if (telegramResult.ok) {
        channel = "telegram";
        messageId = telegramResult.requestId || "";
        console.log("sendAuthCode: Telegram Gateway accepted message", telegramPhone, messageId);
      } else {
        console.warn("sendAuthCode: Telegram Gateway send failed, falling back to SMS:", telegramResult.error);
      }
    }

    if (!channel) {
      const smsResult = await sendTurboSmsCode(TURBOSMS_TOKEN.value(), smsPhone, code);

      if (!smsResult.ok) {
        console.error("sendAuthCode: TurboSMS send failed:", smsResult.errorStatus, smsResult.data);
        res.status(502).json({ ok: false, error: "sms-send-failed" });
        return;
      }

      // Diagnostic log: message_id lets us query TurboSMS message/status for delivery issues.
      console.log("sendAuthCode: TurboSMS accepted message", smsPhone, smsResult.messageId);
      channel = "sms";
      messageId = smsResult.messageId || "";
    }

    await ref.set({
      code,
      attempts: 0,
      channel,
      messageId,
      createdAtMs: Date.now(),
      lastSentAtMs: Date.now(),
      expiresAtMs: Date.now() + AUTH_CODE_TTL_MS
    });

    res.status(200).json({ ok: true, channel });
  } catch (error) {
    console.error("sendAuthCode error:", error);
    res.status(500).json({ ok: false, error: "internal" });
  }
});

// POST { phone, code } -> перевіряє код, збережений методом sendAuthCode.
exports.verifyAuthCode = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method-not-allowed" });
    return;
  }

  const phoneKey = sanitizeAuthCodeKey(req.body && req.body.phone);
  const enteredCode = String((req.body && req.body.code) || "").trim();
  if (!phoneKey || !/^\d{4}$/.test(enteredCode)) {
    res.status(400).json({ ok: false, error: "invalid-request" });
    return;
  }

  const ref = db.collection(AUTH_CODES_COLLECTION).doc(phoneKey);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(200).json({ ok: false, error: "not-found" });
      return;
    }

    const data = snap.data() || {};
    const attempts = Number(data.attempts) || 0;
    const expiresAtMs = Number(data.expiresAtMs) || 0;

    if (Date.now() > expiresAtMs) {
      await ref.delete();
      res.status(200).json({ ok: false, error: "expired" });
      return;
    }

    if (attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      await ref.delete();
      res.status(200).json({ ok: false, error: "too-many-attempts" });
      return;
    }

    if (String(data.code || "") !== enteredCode) {
      await ref.update({ attempts: attempts + 1 });
      res.status(200).json({ ok: false, error: "invalid-code" });
      return;
    }

    await ref.delete();
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("verifyAuthCode error:", error);
    res.status(500).json({ ok: false, error: "internal" });
  }
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
const MONO_CCY_USD = 840;
const MONO_CCY_EUR = 978;
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

// TEMPORARY one-off endpoint to reconcile orders stuck at "Очікує оплати"
// because monoStoreOrderWebhook was crashing (toMonoModifiedDate ReferenceError).
// Remove after running once.
exports.reconcileStuckMonoOrdersOnce = onRequest({ cors: true }, async (req, res) => {
  if (String(req.query.key || "") !== "reconcile-2026-08-01") {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  const results = [];
  const snap = await db.collection("store_order_invoices").get();

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const status = String(data.status || data.monoStatus || "").trim().toLowerCase();
    const storeId = sanitizeStoreIdStrict(data.storeId);
    const orderId = sanitizeOrderId(data.orderId);
    if (!storeId || !orderId) continue;

    if (status === "success") {
      const applied = await updateStoreOrderPaymentStatus({
        storeId,
        orderId,
        paymentStatus: "Оплачено",
        monoInvoiceId: doc.id,
        monoStatus: status,
        pageUrl: data.pageUrl || ""
      });
      results.push({ invoiceId: doc.id, storeId, orderId, status, applied });
    } else if (status === "failure" || status === "expired") {
      const applied = await updateStoreOrderPaymentStatus({
        storeId,
        orderId,
        paymentStatus: "Не оплачено",
        monoInvoiceId: doc.id,
        monoStatus: status,
        pageUrl: data.pageUrl || ""
      });
      results.push({ invoiceId: doc.id, storeId, orderId, status, applied });
    }
  }

  res.status(200).json({ ok: true, checked: snap.size, results });
});

const STORE_CHECKOUT_KEY = "lavkaCheckoutSettings";
const STORE_SETTINGS_KEY = "lavkaStoreSettings";
const STORE_ORDERS_KEY = "lavkaOrders";
const STORE_ORDER_INVOICES_COLLECTION = "store_order_invoices";
const STORE_ORDER_LIQPAY_INVOICES_COLLECTION = "store_order_liqpay_invoices";

const sanitizeOrderId = (value) => String(value || "").trim().slice(0, 64);

const resolveStoreOrderWebhookUrl = () => "https://us-central1-lavka-shop.cloudfunctions.net/monoStoreOrderWebhook";

const normalizeStoreCurrency = (value) => {
  const code = String(value || "").trim().toLowerCase();
  if (code === "usd" || code === "840") {
    return MONO_CCY_USD;
  }
  if (code === "eur" || code === "978") {
    return MONO_CCY_EUR;
  }
  return MONO_CCY_UAH;
};

const normalizeLiqpayCurrency = (value) => {
  const code = String(value || "").trim().toLowerCase();
  if (code === "usd") return "USD";
  if (code === "eur") return "EUR";
  return "UAH";
};

const STORE_PRIVATE_ACQUIRER_DOC = "acquirer";
const ACQUIRER_SECRET_FIELDS = ["paymentMonoSecret", "paymentLiqpayPrivateKey"];

// One-time, self-healing migration: acquirer secrets used to live in the
// publicly-readable settings/checkout docs (open Firestore rules). This moves
// them into stores/{storeId}/private/acquirer, which the rules always deny to
// clients — only this Admin SDK code (Cloud Functions) can read/write it —
// and scrubs the plaintext copies left behind in the public docs.
const migrateAcquirerSecrets = async (storeId, checkoutValue, settingsValue) => {
  const privateRef = db.collection("stores").doc(storeId).collection("private").doc(STORE_PRIVATE_ACQUIRER_DOC);
  const privateSnap = await privateRef.get();
  const privateData = privateSnap.exists ? (privateSnap.data() || {}) : {};

  const resolved = {};
  const toMigrate = {};
  const toScrubCheckout = {};
  const toScrubSettings = {};

  ACQUIRER_SECRET_FIELDS.forEach((field) => {
    const stored = String(privateData[field] || "").trim();
    const legacyFromCheckout = String(checkoutValue[field] || "").trim();
    const legacyFromSettings = String(settingsValue[field] || "").trim();
    resolved[field] = stored || legacyFromCheckout || legacyFromSettings;

    if (!stored && resolved[field]) {
      toMigrate[field] = resolved[field];
    }
    if (legacyFromCheckout) toScrubCheckout[field] = "";
    if (legacyFromSettings) toScrubSettings[field] = "";
  });

  const tasks = [];
  if (Object.keys(toMigrate).length) {
    tasks.push(privateRef.set({ ...toMigrate, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
  }
  const baseRef = db.collection("stores").doc(storeId).collection("data");
  if (Object.keys(toScrubCheckout).length) {
    tasks.push(baseRef.doc(STORE_CHECKOUT_KEY).set({ value: toScrubCheckout }, { merge: true }));
  }
  if (Object.keys(toScrubSettings).length) {
    tasks.push(baseRef.doc(STORE_SETTINGS_KEY).set({ value: toScrubSettings }, { merge: true }));
  }
  if (tasks.length) {
    await Promise.all(tasks).catch((error) => {
      console.error("migrateAcquirerSecrets error:", error);
    });
  }

  return resolved;
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
  const secrets = await migrateAcquirerSecrets(storeId, checkoutValue, settingsValue);
  const token = secrets.paymentMonoSecret;
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

/* ────────────────────────────────────────────────────────────────────────
 * LiqPay acquiring: оплата замовлень магазину (store checkout)
 * ──────────────────────────────────────────────────────────────────────── */

const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout/";
const LIQPAY_API_REQUEST_URL = "https://www.liqpay.ua/api/request";

const resolveStoreOrderLiqpayWebhookUrl = () => "https://us-central1-lavka-shop.cloudfunctions.net/liqpayStoreOrderWebhook";

const readStoreLiqpayConfig = async (storeId) => {
  const baseRef = db.collection("stores").doc(storeId).collection("data");
  const [checkoutSnap, settingsSnap] = await Promise.all([
    baseRef.doc(STORE_CHECKOUT_KEY).get(),
    baseRef.doc(STORE_SETTINGS_KEY).get()
  ]);

  const checkoutValue = checkoutSnap.exists ? ((checkoutSnap.data() || {}).value || {}) : {};
  const settingsValue = settingsSnap.exists ? ((settingsSnap.data() || {}).value || {}) : {};

  const enabled = Boolean(
    checkoutValue.paymentLiqpayEnabled !== undefined
      ? checkoutValue.paymentLiqpayEnabled
      : settingsValue.paymentLiqpayEnabled
  );
  const publicKey = String(checkoutValue.paymentLiqpayPublicKey || settingsValue.paymentLiqpayPublicKey || "").trim();
  const secrets = await migrateAcquirerSecrets(storeId, checkoutValue, settingsValue);
  const privateKey = secrets.paymentLiqpayPrivateKey;

  return {
    enabled,
    publicKey,
    privateKey
  };
};

const createLiqpayOrderReference = (storeId, orderId) => {
  const randomPart = Math.random().toString(36).slice(2, 9);
  const compactOrder = String(orderId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "order";
  return `liqpay_${storeId}_${compactOrder}_${Date.now()}_${randomPart}`;
};

// Admin panel calls this to save the mono/LiqPay secret keys. It writes
// straight to stores/{storeId}/private/acquirer via Admin SDK (rules deny
// clients access to that path), and never echoes the secret back in the
// response.
exports.saveStoreAcquirerSecrets = onRequest(
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
    if (!storeId) {
      res.status(400).json({ ok: false, error: "invalid-store-id" });
      return;
    }

    const update = {};
    if (typeof req.body?.paymentMonoSecret === "string" && req.body.paymentMonoSecret.trim()) {
      update.paymentMonoSecret = req.body.paymentMonoSecret.trim();
    }
    if (typeof req.body?.paymentLiqpayPrivateKey === "string" && req.body.paymentLiqpayPrivateKey.trim()) {
      update.paymentLiqpayPrivateKey = req.body.paymentLiqpayPrivateKey.trim();
    }

    if (!Object.keys(update).length) {
      res.status(200).json({ ok: true, updated: false });
      return;
    }

    try {
      await db.collection("stores").doc(storeId).collection("private").doc(STORE_PRIVATE_ACQUIRER_DOC).set({
        ...update,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      res.status(200).json({ ok: true, updated: true });
    } catch (error) {
      console.error("saveStoreAcquirerSecrets error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

// Lets the admin panel know whether mono/LiqPay secrets are already
// configured (to show "збережено" instead of the real value) without ever
// exposing the secret itself back to the client.
exports.getStoreAcquirerSecretsStatus = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const storeId = sanitizeStoreIdStrict(req.method === "GET" ? req.query.storeId : (req.body && req.body.storeId));
    if (!storeId) {
      res.status(400).json({ ok: false, error: "invalid-store-id" });
      return;
    }

    try {
      const snap = await db.collection("stores").doc(storeId).collection("private").doc(STORE_PRIVATE_ACQUIRER_DOC).get();
      const data = snap.exists ? (snap.data() || {}) : {};
      res.status(200).json({
        ok: true,
        hasMonoSecret: Boolean(String(data.paymentMonoSecret || "").trim()),
        hasLiqpayPrivateKey: Boolean(String(data.paymentLiqpayPrivateKey || "").trim())
      });
    } catch (error) {
      console.error("getStoreAcquirerSecretsStatus error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

// One-time cleanup utility: scrubs plaintext acquirer secrets left behind in
// the (previously public) checkout/settings docs for every store, moving
// them into the protected private/acquirer doc. Safe to call repeatedly
// (idempotent) — it never returns secret values, only a per-store summary.
exports.migrateAllStoresAcquirerSecrets = onRequest(
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

    try {
      // stores/{storeId} documents are often never written directly (they
      // only exist implicitly as parents of subcollections), so they don't
      // show up via db.collection("stores").get(). Use a collectionGroup
      // query on "data" instead, keyed by the known settings/checkout doc ids.
      const dataDocs = await db.collectionGroup("data").get();
      const storeIds = new Set();
      dataDocs.docs.forEach((doc) => {
        if (doc.id !== STORE_CHECKOUT_KEY && doc.id !== STORE_SETTINGS_KEY) return;
        const storeId = doc.ref.parent.parent?.id;
        if (storeId) storeIds.add(storeId);
      });

      const results = [];

      for (const storeId of storeIds) {
        const baseRef = db.collection("stores").doc(storeId).collection("data");
        const [checkoutSnap, settingsSnap] = await Promise.all([
          baseRef.doc(STORE_CHECKOUT_KEY).get(),
          baseRef.doc(STORE_SETTINGS_KEY).get()
        ]);
        const checkoutValue = checkoutSnap.exists ? ((checkoutSnap.data() || {}).value || {}) : {};
        const settingsValue = settingsSnap.exists ? ((settingsSnap.data() || {}).value || {}) : {};

        const hadLegacySecret = ACQUIRER_SECRET_FIELDS.some((field) =>
          String(checkoutValue[field] || "").trim() || String(settingsValue[field] || "").trim());

        if (hadLegacySecret) {
          await migrateAcquirerSecrets(storeId, checkoutValue, settingsValue);
        }

        results.push({ storeId, migrated: hadLegacySecret });
      }

      res.status(200).json({ ok: true, storesChecked: results.length, results });
    } catch (error) {
      console.error("migrateAllStoresAcquirerSecrets error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

// LiqPay signs every request as base64(sha1(private_key + data + private_key)).
const buildLiqpaySignature = (privateKey, dataBase64) =>
  crypto.createHash("sha1").update(`${privateKey}${dataBase64}${privateKey}`).digest("base64");

const buildLiqpayPayload = (params, publicKey, privateKey) => {
  const json = JSON.stringify({ ...params, public_key: publicKey, version: 3 });
  const data = Buffer.from(json, "utf8").toString("base64");
  const signature = buildLiqpaySignature(privateKey, data);
  return { data, signature };
};

const liqpayStatusRequest = async (orderId, publicKey, privateKey) => {
  const { data, signature } = buildLiqpayPayload({ action: "status", order_id: orderId }, publicKey, privateKey);
  const response = await fetch(LIQPAY_API_REQUEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`
  });

  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

// Applies a LiqPay status payload (from webhook or a live status check) to the
// cached invoice doc and, for final states, to the order's paymentStatus.
const applyLiqpayStatusUpdate = async (invoiceRef, current, storeId, statusPayload) => {
  const status = String((statusPayload && statusPayload.status) || "").trim().toLowerCase();
  if (!status) return;

  await invoiceRef.set({
    status,
    liqpayStatus: status,
    rawLastStatus: statusPayload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const orderId = sanitizeOrderId(current.orderId);
  if (!orderId) return;

  const liqpayInvoiceId = String(current.liqpayOrderId || "");
  const liqpayPageUrl = String(current.pageUrl || "");

  if (status === "success" || status === "sandbox") {
    await updateStoreOrderPaymentStatus({
      storeId,
      orderId,
      paymentStatus: "Оплачено",
      liqpayInvoiceId,
      liqpayStatus: status,
      liqpayPageUrl
    });
    await invoiceRef.set({
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }

  if (status === "failure" || status === "error") {
    await updateStoreOrderPaymentStatus({
      storeId,
      orderId,
      paymentStatus: "Не оплачено",
      liqpayInvoiceId,
      liqpayStatus: status,
      liqpayPageUrl
    });
  }
  // wait_secure/processing/subscribed тощо — проміжні статуси, paymentStatus не чіпаємо.
};

exports.createStoreOrderLiqpayInvoice = onRequest(
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
    const returnBaseUrl = String(req.body && req.body.returnBaseUrl || "");
    const paymentMethod = sanitizeUserIdentity(req.body && req.body.paymentMethod);
    const currency = normalizeLiqpayCurrency(req.body && req.body.currency);

    if (!storeId) {
      res.status(400).json({ ok: false, error: "invalid-store-id" });
      return;
    }
    if (!orderId || amount <= 0) {
      res.status(400).json({ ok: false, error: "invalid-order" });
      return;
    }

    try {
      const liqpayConfig = await readStoreLiqpayConfig(storeId);
      if (!liqpayConfig.enabled) {
        res.status(400).json({ ok: false, error: "liqpay-disabled" });
        return;
      }
      if (!liqpayConfig.publicKey || !liqpayConfig.privateKey) {
        res.status(400).json({ ok: false, error: "liqpay-config-missing" });
        return;
      }

      const reference = createLiqpayOrderReference(storeId, orderId);
      const urls = buildStoreOrderPaymentUrls(returnBaseUrl, orderId);

      const params = {
        action: "pay",
        amount,
        currency,
        description: `Оплата замовлення ${orderId}`,
        order_id: reference,
        language: "uk",
        result_url: urls.redirectUrl,
        server_url: resolveStoreOrderLiqpayWebhookUrl()
      };

      const { data, signature } = buildLiqpayPayload(params, liqpayConfig.publicKey, liqpayConfig.privateKey);
      const pageUrl = `${LIQPAY_CHECKOUT_URL}?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`;

      await db.collection(STORE_ORDER_LIQPAY_INVOICES_COLLECTION).doc(reference).set({
        liqpayOrderId: reference,
        storeId,
        orderId,
        amount,
        currency: params.currency,
        paymentMethod: paymentMethod || "LiqPay",
        status: "created",
        liqpayStatus: "created",
        pageUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await updateStoreOrderPaymentStatus({
        storeId,
        orderId,
        paymentStatus: "Очікує оплати",
        liqpayInvoiceId: reference,
        liqpayStatus: "created",
        liqpayPageUrl: pageUrl
      });

      res.status(200).json({ ok: true, invoiceId: reference, pageUrl });
    } catch (error) {
      console.error("createStoreOrderLiqpayInvoice error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

exports.liqpayStoreOrderWebhook = onRequest(
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

    const dataB64 = String((req.body && req.body.data) || "").trim();
    const signature = String((req.body && req.body.signature) || "").trim();
    if (!dataB64 || !signature) {
      res.status(200).send("ok");
      return;
    }

    let decoded = null;
    try {
      decoded = JSON.parse(Buffer.from(dataB64, "base64").toString("utf8"));
    } catch (error) {
      decoded = null;
    }

    const liqpayOrderId = String((decoded && decoded.order_id) || "").trim();
    if (!decoded || !liqpayOrderId) {
      res.status(200).send("ok");
      return;
    }

    try {
      const invoiceRef = db.collection(STORE_ORDER_LIQPAY_INVOICES_COLLECTION).doc(liqpayOrderId);
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

      const liqpayConfig = await readStoreLiqpayConfig(storeId);
      if (!liqpayConfig.privateKey) {
        await invoiceRef.set({
          status: "config-missing",
          liqpayStatus: "config-missing",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        res.status(200).send("ok");
        return;
      }

      // Не довіряємо вебхуку, доки підпис не перевірено ключем саме цього магазину.
      const expectedSignature = buildLiqpaySignature(liqpayConfig.privateKey, dataB64);
      if (expectedSignature !== signature) {
        console.warn("liqpayStoreOrderWebhook: signature mismatch", { liqpayOrderId, storeId });
        res.status(403).send("invalid-signature");
        return;
      }

      await applyLiqpayStatusUpdate(invoiceRef, current, storeId, decoded);

      res.status(200).send("ok");
    } catch (error) {
      console.error("liqpayStoreOrderWebhook error:", error);
      res.status(200).send("ok");
    }
  }
);

exports.getStoreOrderLiqpayInvoiceStatus = onRequest(
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
        snap = await db.collection(STORE_ORDER_LIQPAY_INVOICES_COLLECTION).doc(invoiceId).get();
      } else {
        const q = await db.collection(STORE_ORDER_LIQPAY_INVOICES_COLLECTION).where("orderId", "==", orderId).orderBy("createdAt", "desc").limit(1).get();
        if (!q.empty) {
          snap = q.docs[0];
          foundInvoiceId = String(snap.id || "");
        }
      }

      if (!snap || snap.exists === false) {
        res.status(404).json({ ok: false, error: "not-found" });
        return;
      }

      let current = snap.data() || {};
      const storeId = sanitizeStoreIdStrict(current.storeId);
      const pendingStatuses = ["created", "wait_secure", "processing", "subscribed"];

      // Вебхук міг ще не прийти (покупець повертається одразу після оплати),
      // тож для проміжних статусів звіряємось з LiqPay наживо.
      if (storeId && pendingStatuses.includes(String(current.liqpayStatus || current.status || "").toLowerCase())) {
        try {
          const liqpayConfig = await readStoreLiqpayConfig(storeId);
          if (liqpayConfig.publicKey && liqpayConfig.privateKey) {
            const statusPayload = await liqpayStatusRequest(foundInvoiceId, liqpayConfig.publicKey, liqpayConfig.privateKey);
            if (statusPayload && statusPayload.status) {
              const invoiceRef = db.collection(STORE_ORDER_LIQPAY_INVOICES_COLLECTION).doc(foundInvoiceId);
              await applyLiqpayStatusUpdate(invoiceRef, current, storeId, statusPayload);
              const refreshedSnap = await invoiceRef.get();
              current = refreshedSnap.data() || current;
            }
          }
        } catch (error) {
          console.warn("getStoreOrderLiqpayInvoiceStatus live-check failed:", error);
        }
      }

      res.status(200).json({
        ok: true,
        invoiceId: foundInvoiceId,
        status: String(current.status || "created"),
        liqpayStatus: String(current.liqpayStatus || "created"),
        storeId: String(current.storeId || ""),
        orderId: String(current.orderId || ""),
        pageUrl: String(current.pageUrl || "")
      });
    } catch (error) {
      console.error("getStoreOrderLiqpayInvoiceStatus error:", error);
      res.status(500).json({ ok: false, error: "internal" });
    }
  }
);

const updateStoreOrderPaymentStatus = async ({
  storeId,
  orderId,
  paymentStatus,
  monoInvoiceId,
  monoStatus,
  pageUrl,
  liqpayInvoiceId,
  liqpayStatus,
  liqpayPageUrl
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
    liqpayInvoiceId: String(liqpayInvoiceId || current.liqpayInvoiceId || ""),
    liqpayStatus: String(liqpayStatus || current.liqpayStatus || ""),
    liqpayPageUrl: String(liqpayPageUrl || current.liqpayPageUrl || ""),
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
      const modifiedDate = parseMonoModifiedDate(monoStatusPayload && monoStatusPayload.modifiedDate);
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

// ─────────────────────────────────────────────────────────────────────────
// Anти-бот rate limiting для масових дій
// ─────────────────────────────────────────────────────────────────────────
// Клієнт (checkout.js / admin.js / registration.html / login.html) звертається
// сюди ПЕРЕД тим, як створити замовлення/товар/категорію або зареєструватись/
// увійти. Лічильники прив'язані до IP-адреси виклику (доступна тільки тут,
// на сервері — у Firestore Rules IP недоступний), тому це реальний захист від
// скриптів-ботів, а не лише клієнтський UI-throttling.
//
// Firestore rules (`stores/{storeId}/data/{key}`) додатково обмежують темп
// прямих записів у Firestore як другий рубіж захисту (на випадок, якщо бот
// оминає сайт і пише напряму через Firestore SDK/REST).

const RATE_LIMIT_COLLECTION = "rate_limits";

// { limit: максимум спроб, windowSeconds: тривалість вікна }
const RATE_LIMIT_RULES = {
  register: { limit: 5, windowSeconds: 3600 },
  "login-code": { limit: 10, windowSeconds: 3600 },
  "login-verify": { limit: 20, windowSeconds: 3600 },
  "create-order": { limit: 30, windowSeconds: 3600 },
  "create-product": { limit: 90, windowSeconds: 3600 },
  "create-category": { limit: 60, windowSeconds: 3600 }
};

const getClientIp = (req) => {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || String(req.ip || "").trim() || "unknown";
};

const sanitizeRateLimitKeyPart = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_")
    .slice(0, 120);

// Просте fixed-window обмеження темпу, що зберігається в Firestore
// (works across all Cloud Functions instances, on-line for the caller's IP).
const consumeRateLimit = async (key, limit, windowSeconds) => {
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(sanitizeRateLimitKeyPart(key) || "unknown");
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const windowStart = Number(data.windowStart) || 0;
    const isSameWindow = windowStart > 0 && nowMs - windowStart < windowMs;
    const count = isSameWindow ? Number(data.count) || 0 : 0;

    if (count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    tx.set(ref, {
      count: count + 1,
      windowStart: isSameWindow ? windowStart : nowMs,
      updatedAt: FieldValue.serverTimestamp()
    });

    return { allowed: true, retryAfterSeconds: 0 };
  });
};

// POST { action: "register"|"login-code"|"login-verify"|"create-order"|"create-product"|"create-category", storeId?: string }
// -> 200 { ok: true } якщо дозволено, 429 { ok: false, error: "rate-limited", retryAfterSeconds } якщо перевищено ліміт.
exports.checkActionRateLimit = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method-not-allowed" });
    return;
  }

  const action = String((req.body && req.body.action) || "").trim();
  const rule = RATE_LIMIT_RULES[action];
  if (!rule) {
    res.status(400).json({ ok: false, error: "invalid-action" });
    return;
  }

  const storeId = sanitizeRateLimitKeyPart(req.body && req.body.storeId);
  const ip = sanitizeRateLimitKeyPart(getClientIp(req));
  const key = storeId ? `${action}__${storeId}__${ip}` : `${action}__${ip}`;

  try {
    const result = await consumeRateLimit(key, rule.limit, rule.windowSeconds);
    if (!result.allowed) {
      res.status(429).json({ ok: false, error: "rate-limited", retryAfterSeconds: result.retryAfterSeconds });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("checkActionRateLimit error:", error);
    // Fail open: не блокуємо реальних користувачів, якщо сам лімітер впав.
    res.status(200).json({ ok: true });
  }
});
