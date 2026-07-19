const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "telegram-subscriptions.json");

const ensureStoreFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    const initial = {
      subscribers: {},
      deliveredOrderIds: {},
      pendingSubscribers: {}
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
};

const readStore = () => {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      subscribers: parsed?.subscribers && typeof parsed.subscribers === "object" ? parsed.subscribers : {},
      deliveredOrderIds: parsed?.deliveredOrderIds && typeof parsed.deliveredOrderIds === "object" ? parsed.deliveredOrderIds : {},
      pendingSubscribers: parsed?.pendingSubscribers && typeof parsed.pendingSubscribers === "object" ? parsed.pendingSubscribers : {}
    };
  } catch {
    return {
      subscribers: {},
      deliveredOrderIds: {},
      pendingSubscribers: {}
    };
  }
};

const writeStore = (store) => {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
};

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
};

const parseBody = (req) => {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        body = "";
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
};

const normalizeSubscriberId = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.replace(/^sub_/, "");
};

const parseStartPayload = (text) => {
  const message = String(text || "").trim();
  if (!message.startsWith("/start")) return "";
  const payload = message.slice(6).trim();
  return normalizeSubscriberId(payload);
};

const pickPendingSubscriberId = (store) => {
  const now = Date.now();
  const pendingEntries = Object.entries(store.pendingSubscribers || {})
    .filter(([, value]) => {
      const expiresAt = Date.parse(value?.expiresAt || "");
      return Number.isFinite(expiresAt) && expiresAt > now;
    })
    .sort((a, b) => Date.parse(b[1].createdAt || "") - Date.parse(a[1].createdAt || ""));

  if (!pendingEntries.length) {
    return "";
  }

  return String(pendingEntries[0][0] || "").trim();
};

const sendTelegramMessage = async ({ chatId, text }) => {
  if (!BOT_TOKEN) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    if (!response.ok) {
      return { ok: false, error: `Telegram HTTP ${response.status}` };
    }

    const data = await response.json();
    return { ok: Boolean(data?.ok), data };
  } catch {
    return { ok: false, error: "Telegram request failed" };
  }
};

const handleWebhook = async (req, res) => {
  const update = await parseBody(req);
  const message = update?.message;
  const chatId = String(message?.chat?.id || "").trim();
  const subscriberIdFromPayload = parseStartPayload(message?.text);
  const store = readStore();
  const subscriberId = subscriberIdFromPayload || pickPendingSubscriberId(store);

  if (!chatId || !subscriberId) {
    json(res, 200, { ok: true, linked: false });
    return;
  }

  store.subscribers[subscriberId] = {
    chatId,
    username: String(message?.from?.username || "").trim(),
    firstName: String(message?.from?.first_name || "").trim(),
    lastName: String(message?.from?.last_name || "").trim(),
    updatedAt: new Date().toISOString()
  };
  if (store.pendingSubscribers?.[subscriberId]) {
    delete store.pendingSubscribers[subscriberId];
  }
  writeStore(store);

  await sendTelegramMessage({
    chatId,
    text: "Підписка активована. Ви будете отримувати лише ваші замовлення."
  });

  await sendTelegramMessage({
    chatId,
    text: "Підписка успішна. Тепер нові замовлення будуть надходити сюди автоматично."
  });

  json(res, 200, { ok: true, linked: true, subscriberId });
};

const handleSubscribeIntent = async (req, res) => {
  const payload = await parseBody(req);
  const subscriberId = normalizeSubscriberId(payload?.subscriberId);
  if (!subscriberId) {
    json(res, 400, { ok: false, error: "subscriberId is required" });
    return;
  }

  const store = readStore();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (30 * 60 * 1000));
  store.pendingSubscribers[subscriberId] = {
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
  writeStore(store);
  json(res, 200, { ok: true, subscriberId, expiresAt: expiresAt.toISOString() });
};

const handleSubscriptionStatus = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const subscriberId = normalizeSubscriberId(url.searchParams.get("subscriberId"));
  if (!subscriberId) {
    json(res, 400, { ok: false, error: "subscriberId is required" });
    return;
  }

  const store = readStore();
  const linked = Boolean(store.subscribers[subscriberId]?.chatId);
  json(res, 200, { ok: true, linked });
};

const handleOrderNotify = async (req, res) => {
  const payload = await parseBody(req);
  const subscriberId = normalizeSubscriberId(payload?.subscriberId);
  const message = String(payload?.message || "").trim();
  const orderId = String(payload?.orderId || "").trim();

  if (!subscriberId || !message || !orderId) {
    json(res, 400, { ok: false, error: "subscriberId, orderId and message are required" });
    return;
  }

  const store = readStore();
  const subscriber = store.subscribers[subscriberId];
  if (!subscriber?.chatId) {
    json(res, 404, { ok: false, error: "subscriber is not linked" });
    return;
  }

  const deliveryKey = `${subscriberId}:${orderId}`;
  if (store.deliveredOrderIds[deliveryKey]) {
    json(res, 200, { ok: true, skipped: true });
    return;
  }

  const result = await sendTelegramMessage({
    chatId: subscriber.chatId,
    text: message
  });

  if (!result.ok) {
    json(res, 502, { ok: false, error: result.error || "telegram send failed" });
    return;
  }

  store.deliveredOrderIds[deliveryKey] = new Date().toISOString();
  writeStore(store);
  json(res, 200, { ok: true });
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  if (req.method === "POST" && req.url === "/api/telegram/webhook") {
    await handleWebhook(req, res);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/telegram/subscription-status")) {
    handleSubscriptionStatus(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/telegram/subscribe-intent") {
    await handleSubscribeIntent(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/telegram/order-notify") {
    await handleOrderNotify(req, res);
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, () => {
  process.stdout.write(`Telegram gateway is running on http://localhost:${PORT}\n`);
});
