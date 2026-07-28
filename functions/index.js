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

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");

const CLOUDFLARE_API_TOKEN = defineSecret("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ZONE_ID = defineSecret("CLOUDFLARE_ZONE_ID");

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
