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

  const sanitizeStoreId = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 64);
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
    const host = String(window.location.hostname || "").toLowerCase();
    if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
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

  const getStoreId = () => {
    const fromUrl = getStoreIdFromUrl();
    if (fromUrl) return fromUrl;

    const fromHost = getStoreIdFromHost();
    if (fromHost) return fromHost;

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
    const run = async () => {
      await bootstrapFirestore();
      const storeId = getStoreId();
      patchLocalStorageSync(storeId);

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
        flushQueuedDomListeners(event);
      });
  });
})();
