(function () {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDzJ3zOCHvuAnZQA-90va3xZxoBSVqnwLs",
    authDomain: "lavka-shop.firebaseapp.com",
    projectId: "lavka-shop",
    storageBucket: "lavka-shop.firebasestorage.app",
    messagingSenderId: "437450554587",
    appId: "1:437450554587:web:2448c9e6fa0cd9c0d520fe"
  };

  const SYNCED_KEYS = [
    "lavkaStoreSettings",
    "lavkaCheckoutSettings",
    "lavkaProducts",
    "lavkaCategories",
    "lavkaOrders",
    "lavkaPromoCodes",
    "lavkaVisitEvents",
    "lavkaBilling",
    "lavkaRegistration",
    "lavkaAuth",
    "lavkaTelegramNotifiedOrders",
    "lavkaTelegramAdminSubscriberId"
  ];
  const BLOCKED_IPS_COLLECTION = "blocked_ips";
  const IP_CACHE_KEY = "lavkaClientIpCache";
  const IP_CACHE_TTL_MS = 10 * 60 * 1000;

  const originalAddEventListener = document.addEventListener.bind(document);
  const queuedDomListeners = [];
  let domListenersQueued = document.readyState === "loading";

  document.addEventListener = function (type, listener, options) {
    if (type === "DOMContentLoaded" && domListenersQueued) {
      queuedDomListeners.push({ listener, options });
      return;
    }

    return originalAddEventListener(type, listener, options);
  };

  const readJson = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const normalizeIp = (value) => String(value || "").trim().toLowerCase();

  const encodeIpKey = (ip) => normalizeIp(ip).replace(/[^a-z0-9:.]/g, "_");

  const readIpCache = () => {
    try {
      const raw = localStorage.getItem(IP_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      const ip = normalizeIp(parsed.ip);
      const at = Number(parsed.at);
      if (!ip || !Number.isFinite(at)) {
        return null;
      }
      if ((Date.now() - at) > IP_CACHE_TTL_MS) {
        return null;
      }
      return ip;
    } catch {
      return null;
    }
  };

  const writeIpCache = (ip) => {
    try {
      localStorage.setItem(IP_CACHE_KEY, JSON.stringify({ ip: normalizeIp(ip), at: Date.now() }));
    } catch {
      // ignore cache failures
    }
  };

  const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), Math.max(1000, Number(timeoutMs) || 5000));
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

  const fetchClientIp = async () => {
    const cached = readIpCache();
    if (cached) {
      return cached;
    }

    try {
      const response = await withTimeout(fetch("https://api64.ipify.org?format=json", { cache: "no-store" }), 6000);
      if (!response.ok) {
        throw new Error("ip-service-failed");
      }
      const payload = await response.json();
      const ip = normalizeIp(payload && payload.ip);
      if (!ip) {
        return "";
      }
      writeIpCache(ip);
      return ip;
    } catch (error) {
      console.warn("[lavka-sync] Failed to resolve client IP:", error);
      return "";
    }
  };

  const isIpBlocked = async (ip) => {
    if (!firestore) return false;
    const normalizedIp = normalizeIp(ip);
    if (!normalizedIp) return false;

    const key = encodeIpKey(normalizedIp);

    try {
      const directDoc = await firestore.collection(BLOCKED_IPS_COLLECTION).doc(key).get();
      if (directDoc.exists) {
        const data = directDoc.data() || {};
        return data.blocked !== false;
      }

      const byIp = await firestore
        .collection(BLOCKED_IPS_COLLECTION)
        .where("ip", "==", normalizedIp)
        .limit(1)
        .get();

      if (byIp.empty) {
        return false;
      }

      const row = byIp.docs[0].data() || {};
      return row.blocked !== false;
    } catch (error) {
      console.warn("[lavka-sync] Failed to check IP block:", error);
      return false;
    }
  };

  const renderBlockedByIpPage = () => {
    try {
      localStorage.removeItem("lavkaAuth");
      localStorage.removeItem("lavkaRegistration");
    } catch {
      // ignore
    }

    document.documentElement.innerHTML = "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Доступ обмежено</title><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7fbff;color:#10243f;display:grid;place-items:center;min-height:100vh}.box{max-width:560px;margin:24px;padding:22px 20px;border:1px solid #cde0f5;background:#fff;border-radius:14px;box-shadow:0 10px 24px rgba(16,36,63,.08)}h1{margin:0 0 10px;font-size:24px}p{margin:0;line-height:1.6;color:#324f73}</style></head><body><div class=\"box\"><h1>Доступ обмежено</h1><p>Доступ до сайту для вашої IP-адреси тимчасово заблоковано адміністратором.</p></div></body>";
  };

  const persistLastIpForStore = async (storeId, ip) => {
    if (!firestore) return;
    const safeStoreId = sanitizeStoreId(storeId);
    const normalizedIp = normalizeIp(ip);
    if (!safeStoreId || safeStoreId === "default-store" || !normalizedIp) {
      return;
    }

    const payload = {
      lastIpAddress: normalizedIp,
      updatedAt: toTimestamp()
    };

    await Promise.all([
      firestore.collection("stores_registry").doc(safeStoreId).set(payload, { merge: true }),
      firestore.collection("store_subdomains").doc(safeStoreId).set(payload, { merge: true })
    ]);
  };

  const sanitizeStoreId = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 64);
  };

  const normalizeDomainHost = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";

    try {
      return String(new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname || "").toLowerCase();
    } catch {
      return raw
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
    }
  };

  const stripWww = (host) => String(host || "").toLowerCase().replace(/^www\./, "");

  const isLocalHostLike = (host) => {
    const value = String(host || "").toLowerCase();
    return !value || value === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(value);
  };

  const isPlatformBaseHost = (host) => {
    const value = String(host || "").toLowerCase();
    return [
      "lavka-shop.web.app",
      "lavka-shop.firebaseapp.com",
      "vitryna-shop.com",
      "vitrina-shop.com",
      "www.vitryna-shop.com",
      "www.vitrina-shop.com"
    ].includes(value);
  };

  const isPlatformStoreHost = (host) => {
    const value = String(host || "").toLowerCase();
    return value.endsWith(".vitryna-shop.com") || value.endsWith(".vitrina-shop.com");
  };

  const getStoreIdFromUrl = () => {
    const searchParams = new URLSearchParams(window.location.search || "");
    const hashParams = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    const fromSearch = sanitizeStoreId(searchParams.get("store") || searchParams.get("subdomain"));
    if (fromSearch) return fromSearch;

    const fromHash = sanitizeStoreId(hashParams.get("store") || hashParams.get("subdomain"));
    return fromHash;
  };

  const getStoreIdFromHost = () => {
    const host = normalizeDomainHost(window.location.hostname || "");
    if (isLocalHostLike(host) || isPlatformBaseHost(host) || !isPlatformStoreHost(host)) {
      return "";
    }

    const first = sanitizeStoreId(host.split(".")[0]);
    if (
      first
      && first !== "www"
      && first !== "lavka-shop"
      && first !== "vitryna-shop"
      && first !== "vitrina-shop"
    ) {
      return first;
    }

    return "";
  };

  const resolveStoreIdFromCustomDomain = async () => {
    if (!firestore) {
      return "";
    }

    const host = normalizeDomainHost(window.location.hostname || "");
    if (isLocalHostLike(host) || isPlatformBaseHost(host) || isPlatformStoreHost(host)) {
      return "";
    }

    try {
      const registrySnap = await firestore.collection("stores_registry").get();
      const hostVariants = [host, stripWww(host)].filter(Boolean);

      for (let i = 0; i < registrySnap.docs.length; i += 1) {
        const doc = registrySnap.docs[i];
        const data = doc.data() || {};
        const candidates = [
          normalizeDomainHost(data.domain),
          normalizeDomainHost(data.customDomain),
          normalizeDomainHost(data.storeDomain)
        ].filter(Boolean);

        for (let j = 0; j < candidates.length; j += 1) {
          const candidate = candidates[j];
          const candidateVariants = [candidate, stripWww(candidate)].filter(Boolean);
          const matches = hostVariants.some((variant) => candidateVariants.includes(variant));
          if (matches) {
            return sanitizeStoreId(doc.id);
          }
        }
      }
    } catch (error) {
      console.warn("[lavka-sync] Failed to resolve store by custom domain:", error);
    }

    return "";
  };

  const getStoreId = async () => {
    const fromUrl = getStoreIdFromUrl();
    if (fromUrl) return fromUrl;

    const fromHost = getStoreIdFromHost();
    if (fromHost) return fromHost;

    const fromCustomDomain = await resolveStoreIdFromCustomDomain();
    if (fromCustomDomain) return fromCustomDomain;

    const reg = readJson("lavkaRegistration") || {};
    const fromRegistration = sanitizeStoreId(reg.subdomain || "");
    if (fromRegistration) return fromRegistration;

    return "default-store";
  };

  const toTimestamp = () => new Date().toISOString();

  let firestore = null;
  let syncingFromRemote = false;

  const parseStoredValue = (raw) => {
    if (raw === null || typeof raw === "undefined") return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const serializeValue = (value) => {
    if (typeof value === "string") {
      const parsed = parseStoredValue(value);
      return parsed;
    }

    return value;
  };

  const updateStoreRegistry = async (storeId) => {
    if (!firestore) return;

    const reg = readJson("lavkaRegistration") || {};
    const settings = readJson("lavkaStoreSettings") || {};

    const payload = {
      storeId,
      storeName: String(reg.storeName || settings.storeName || settings.name || "").trim(),
      domain: String(reg.domain || settings.domain || "").trim(),
      customDomain: String(settings.customDomain || "").trim(),
      phone: String(reg.phone || "").trim(),
      updatedAt: toTimestamp()
    };

    await firestore.collection("stores_registry").doc(storeId).set(payload, { merge: true });
  };

  const writeKeyToRemote = async (storeId, key, rawValue) => {
    if (!firestore) return;

    const value = serializeValue(rawValue);
    const payload = {
      key,
      value,
      updatedAt: toTimestamp()
    };

    await firestore
      .collection("stores")
      .doc(storeId)
      .collection("data")
      .doc(key)
      .set(payload, { merge: true });

    if (key === "lavkaRegistration" || key === "lavkaStoreSettings") {
      await updateStoreRegistry(storeId);
    }
  };

  const patchLocalStorageSync = (storeId) => {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);

    localStorage.setItem = function (key, value) {
      originalSetItem(key, value);
      if (!firestore || syncingFromRemote) return;
      if (!SYNCED_KEYS.includes(String(key))) return;

      writeKeyToRemote(storeId, String(key), value).catch((error) => {
        console.warn("[lavka-sync] Failed to write key:", key, error);
      });
    };

    localStorage.removeItem = function (key) {
      originalRemoveItem(key);
      if (!firestore || syncingFromRemote) return;
      if (!SYNCED_KEYS.includes(String(key))) return;

      firestore
        .collection("stores")
        .doc(storeId)
        .collection("data")
        .doc(String(key))
        .delete()
        .catch((error) => {
          console.warn("[lavka-sync] Failed to remove key:", key, error);
        });
    };
  };

  const hydrateLocalStorageFromRemote = async (storeId) => {
    if (!firestore) return;

    syncingFromRemote = true;
    try {
      const tasks = SYNCED_KEYS.map(async (key) => {
        const snap = await firestore
          .collection("stores")
          .doc(storeId)
          .collection("data")
          .doc(key)
          .get();

        if (!snap.exists) {
          localStorage.removeItem(key);
          return;
        }

        const payload = snap.data() || {};
        if (!Object.prototype.hasOwnProperty.call(payload, "value")) return;

        localStorage.setItem(key, JSON.stringify(payload.value));
      });

      await Promise.all(tasks);
    } finally {
      syncingFromRemote = false;
    }
  };

  const bootstrapFirestore = async () => {
    if (!window.firebase) return;

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      firestore = firebase.firestore();
    } catch (error) {
      console.warn("[lavka-sync] Firebase init failed:", error);
      firestore = null;
    }
  };

  const flushQueuedDomListeners = (event) => {
    domListenersQueued = false;

    queuedDomListeners.forEach(({ listener }) => {
      try {
        listener.call(document, event);
      } catch (error) {
        console.error("[lavka-sync] DOMContentLoaded listener error:", error);
      }
    });

    queuedDomListeners.length = 0;
  };

  originalAddEventListener("DOMContentLoaded", function (event) {
    let shouldFlushListeners = true;

    const run = async () => {
      await bootstrapFirestore();

      const clientIp = await fetchClientIp();
      if (firestore && clientIp) {
        const blocked = await isIpBlocked(clientIp);
        if (blocked) {
          shouldFlushListeners = false;
          renderBlockedByIpPage();
          return;
        }
      }

      const storeId = await getStoreId();
      patchLocalStorageSync(storeId);

      if (firestore && clientIp) {
        await persistLastIpForStore(storeId, clientIp);
      }

      if (firestore) {
        await hydrateLocalStorageFromRemote(storeId);

        const hasRemoteBaseline = SYNCED_KEYS.some((key) => localStorage.getItem(key) !== null);
        if (hasRemoteBaseline) {
          await Promise.all(
            SYNCED_KEYS
              .filter((key) => localStorage.getItem(key) !== null)
              .map((key) => writeKeyToRemote(storeId, key, localStorage.getItem(key)))
          );
        }
      }
    };

    run()
      .catch((error) => {
        console.warn("[lavka-sync] Sync bootstrap failed:", error);
      })
      .finally(() => {
        if (shouldFlushListeners) {
          flushQueuedDomListeners(event);
        }
      });
  });
})();
