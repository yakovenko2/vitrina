document.addEventListener("DOMContentLoaded", () => {
  const primaryMenuItems = document.querySelectorAll(".menu-item[data-section]");
  const settingsItems = document.querySelectorAll(".settings-subnav .settings-item");
  const settingsSubnav = document.getElementById("settingsSubnav");
  const adminSidebar = document.getElementById("adminSidebar");
  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  const panels = document.querySelectorAll(".panel");
  const sectionTitle = document.getElementById("sectionTitle");
  const homeStoreDomainInput = document.getElementById("homeStoreDomainInput");
  const copyHomeStoreDomain = document.getElementById("copyHomeStoreDomain");
  const homeDomainCopyMessage = document.getElementById("homeDomainCopyMessage");
  const homeOpenStorefront = document.getElementById("homeOpenStorefront");
  const storefrontHeadLink = document.querySelector(".store-link.store-link-head");
  const domainSubdomainInput = document.getElementById("domainSubdomainInput");
  const copyDomainSubdomain = document.getElementById("copyDomainSubdomain");
  const domainSubdomainCopyMessage = document.getElementById("domainSubdomainCopyMessage");
  const domainStatusBadge = document.getElementById("domainStatusBadge");
  const domainStatusText = document.getElementById("domainStatusText");
  const customDomainForm = document.getElementById("customDomainForm");
  const customDomainInput = document.getElementById("customDomainInput");
  const checkDomainBtn = document.getElementById("checkDomainBtn");
  const disconnectDomainBtn = document.getElementById("disconnectDomainBtn");
  const customDomainSavedMessage = document.getElementById("customDomainSavedMessage");
  const dnsCopyMessage = document.getElementById("dnsCopyMessage");
  const dnsRecordsPanel = document.getElementById("dnsRecordsPanel");
  const dnsRecordsDynamic = document.getElementById("dnsRecordsDynamic");
  const AUTH_KEY = "lavkaAuth";
  const SETTINGS_KEY = "lavkaStoreSettings";
  const REGISTRATION_KEY = "lavkaRegistration";
  const CHECKOUT_SETTINGS_KEY = "lavkaCheckoutSettings";
  const PRODUCTS_KEY = "lavkaProducts";
  const CATEGORIES_KEY = "lavkaCategories";
  const ORDERS_KEY = "lavkaOrders";
  const PROMO_CODES_KEY = "lavkaPromoCodes";
  const VISITOR_EVENTS_KEY = "lavkaVisitEvents";
  const BILLING_KEY = "lavkaBilling";
  const TELEGRAM_NOTIFIED_ORDERS_KEY = "lavkaTelegramNotifiedOrders";
  const TELEGRAM_ADMIN_SUBSCRIBER_KEY = "lavkaTelegramAdminSubscriberId";
  const ADMIN_ACTIVE_SECTION_KEY = "lavkaAdminActiveSection";
  const TELEGRAM_BOT_USERNAME = "lavkaorders_bot";
  const SUPPORT_TELEGRAM_URL = "https://t.me/vitryna_manager";
  const FUNCTIONS_REGION = "us-central1";
  const FIREBASE_CONFIG = {
    apiKey: "<SECRET>",
    authDomain: "lavka-shop.firebaseapp.com",
    projectId: "lavka-shop",
    storageBucket: "lavka-shop.firebasestorage.app",
    messagingSenderId: "446966778081",
    appId: "1:446966778081:web:a9f60f4c27bb93fd45b8ee"
  };
  const STORAGE_BUCKET_CANDIDATES = ["lavka-shop.firebasestorage.app", "lavka-shop.appspot.com"];
  const SESSION_CHECK_INTERVAL_MS = 15000;
  const MAX_NAME_LENGTH = 60;
  const MAX_DESCRIPTION_LENGTH = 140;
  const MAX_AVATAR_FILE_SIZE = 3 * 1024 * 1024;
  const MAX_AVATAR_DIMENSION = 512;
  const MAX_PRODUCT_NAME_LENGTH = 60;
  const MAX_PRODUCT_DESCRIPTION_LENGTH = 240;
  const MAX_PRODUCT_PHOTOS = 10;
  const MAX_PRODUCT_PHOTO_SIZE = 3 * 1024 * 1024;
  const PRODUCT_PHOTO_MAX_DIMENSION = 1920;
  const PRODUCT_PHOTO_TARGET_UPLOAD_BYTES = 1100 * 1024;
  const STORAGE_UPLOAD_TIMEOUT_MS = 60000;
  const STORAGE_URL_TIMEOUT_MS = 25000;
  const STORAGE_UPLOAD_RETRY_ATTEMPTS = 3;
  const PRODUCT_UPLOAD_CONCURRENCY = 2;
  const MAX_BACKGROUND_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_CATEGORY_NAME_LENGTH = 40;
  const PRODUCTS_PER_PAGE = 5;
  const ORDERS_PER_PAGE = 5;
  const STOCKS_PER_PAGE = 4;
  const EMPTY_AVATAR_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  const profanityPatterns = [
    /бля/i,
    /хуй/i,
    /пизд/i,
    /пізд/i,
    /йоб/i,
    /еба/i,
    /сука/i,
    /fuck/i,
    /shit/i
  ];

  const titles = {
    home: "Головна",
    orders: "Замовлення",
    products: "Товари",
    stock: "Склад",
    categories: "Категорії",
    views: "Статистика переглядів",
    sales: "Статистика продажів",
    billing: "Тарифний план",
    promocodes: "Промо-коди",
    settings: "Налаштування",
    notifications: "Сповіщення",
    payments: "Оплата",
    shipping: "Доставка",
    domain: "Домен",
    logout: "Вихід"
  };

  const settingsSections = ["settings", "notifications", "payments", "shipping", "domain"];
  // Maps each section id to a readable URL slug (shown in the address bar hash).
  const SECTION_SLUGS = {
    home: "home",
    orders: "orders",
    products: "products",
    stock: "stock",
    categories: "categories",
    views: "stats/views",
    sales: "stats/sales",
    billing: "billing",
    promocodes: "promocodes",
    settings: "settings/osnova",
    notifications: "settings/notifications",
    payments: "settings/payments",
    shipping: "settings/shipping",
    domain: "settings/domain"
  };
  const SLUG_TO_SECTION = Object.keys(SECTION_SLUGS).reduce((acc, key) => {
    acc[SECTION_SLUGS[key]] = key;
    return acc;
  }, {});
  const parseSectionFromHash = () => {
    const raw = String(window.location.hash || "").replace(/^#\/?/, "").trim().toLowerCase();
    if (!raw) return "";
    return SLUG_TO_SECTION[raw] || "";
  };
  const syncSectionHash = (sectionId) => {
    const slug = SECTION_SLUGS[sectionId];
    if (!slug) return;
    const target = "#/" + slug;
    if (window.location.hash === target) return;
    try {
      window.history.replaceState(null, "", target);
    } catch {
      window.location.hash = target;
    }
  };
  let currentSection = "home";
  let authSessionWatcher = null;
  let isRedirectingToLogin = false;

  const isMobileViewport = () => window.matchMedia("(max-width: 640px)").matches;

  const sanitizeStoreId = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 64);
  };

  const readJsonFromStorage = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const extractSubdomainFromDomain = (domainValue) => {
    const domain = String(domainValue || "").trim();
    if (!domain) return "";
    try {
      const parsed = new URL(domain);
      const first = parsed.hostname.split(".")[0] || "";
      return sanitizeStoreId(first);
    } catch {
      return "";
    }
  };

  const getCurrentStoreContext = () => {
    const registration = readJsonFromStorage(REGISTRATION_KEY) || {};
    const settings = readJsonFromStorage(SETTINGS_KEY) || {};
    const subdomain = sanitizeStoreId(registration.subdomain || extractSubdomainFromDomain(registration.domain) || extractSubdomainFromDomain(settings.domain));
    const registeredDomain = String(registration.domain || settings.domain || "").trim();

    return {
      subdomain,
      registeredDomain
    };
  };

  const getLandingUrl = () => {
    const baseOrigin = window.location.origin;
    const pathname = window.location.pathname || "/";

    if (pathname.endsWith("/admin.html")) {
      return `${baseOrigin}${pathname.replace(/admin\.html$/, "landing.html")}`;
    }

    if (pathname.endsWith("/admin")) {
      return `${baseOrigin}${pathname.slice(0, -"/admin".length) || "/"}landing.html`;
    }

    return `${baseOrigin}/landing.html`;
  };

  const getLoginUrl = (reason) => {
    const baseOrigin = window.location.origin;
    const pathname = window.location.pathname || "/";
    let url = `${baseOrigin}/login.html`;

    if (pathname.endsWith("/admin.html")) {
      url = `${baseOrigin}${pathname.replace(/admin\.html$/, "login.html")}`;
    } else if (pathname.endsWith("/admin")) {
      url = `${baseOrigin}${pathname.slice(0, -"/admin".length) || "/"}login.html`;
    }

    if (!reason) {
      return url;
    }

    try {
      var parsed = new URL(url);
      parsed.searchParams.set("reason", reason);
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const clearAdminSession = () => {
    [
      AUTH_KEY,
      REGISTRATION_KEY,
      SETTINGS_KEY,
      CHECKOUT_SETTINGS_KEY,
      PRODUCTS_KEY,
      CATEGORIES_KEY,
      ORDERS_KEY,
      PROMO_CODES_KEY,
      VISITOR_EVENTS_KEY,
      BILLING_KEY,
      TELEGRAM_NOTIFIED_ORDERS_KEY,
      TELEGRAM_ADMIN_SUBSCRIBER_KEY,
      ADMIN_ACTIVE_SECTION_KEY
    ].forEach((key) => {
      localStorage.removeItem(key);
    });
  };

  const redirectToLogin = (reason) => {
    if (isRedirectingToLogin) {
      return;
    }
    isRedirectingToLogin = true;
    clearAdminSession();
    window.location.href = getLoginUrl(reason || "auth-required");
  };

  const getAuthDb = () => {
    if (!window.firebase) {
      throw new Error("firebase-unavailable");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    return firebase.firestore();
  };

  const getFunctionsClient = () => {
    if (!window.firebase || typeof firebase.functions !== "function") {
      throw new Error("firebase-functions-unavailable");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    return firebase.app().functions(FUNCTIONS_REGION);
  };

  const getStorageClient = () => {
    if (!window.firebase || typeof firebase.storage !== "function") {
      throw new Error("firebase-storage-unavailable");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    const storage = firebase.storage();
    if (typeof storage.setMaxUploadRetryTime === "function") {
      storage.setMaxUploadRetryTime(120000);
    }
    if (typeof storage.setMaxOperationRetryTime === "function") {
      storage.setMaxOperationRetryTime(60000);
    }
    return storage;
  };

  const getStorageClientForBucket = (bucketName) => {
    const normalizedBucket = String(bucketName || "").trim();
    const storage = normalizedBucket
      ? firebase.app().storage(`gs://${normalizedBucket}`)
      : getStorageClient();

    if (typeof storage.setMaxUploadRetryTime === "function") {
      storage.setMaxUploadRetryTime(120000);
    }
    if (typeof storage.setMaxOperationRetryTime === "function") {
      storage.setMaxOperationRetryTime(60000);
    }

    return storage;
  };

  const isStoreDocActive = (docData) => {
    const status = String(docData?.status || "").toLowerCase();
    return !status || status === "active";
  };

  const normalizePhoneForAuth = (raw) => String(raw || "").trim().replace(/[^0-9+]/g, "");
  const normalizePhoneDigits = (raw) => String(raw || "").replace(/\D/g, "");
  const phonesMatch = (left, right) => {
    const leftDigits = normalizePhoneDigits(left);
    const rightDigits = normalizePhoneDigits(right);
    return Boolean(leftDigits && rightDigits && leftDigits === rightDigits);
  };

  const readAuthState = () => {
    const auth = readJsonFromStorage(AUTH_KEY) || {};
    const registration = readJsonFromStorage(REGISTRATION_KEY) || {};
    const fallbackStoreId = sanitizeStoreId(registration.subdomain || extractSubdomainFromDomain(registration.domain) || "");
    return {
      phone: normalizePhoneForAuth(auth.phone || registration.phone),
      storeId: sanitizeStoreId(auth.storeId || auth.subdomain || fallbackStoreId),
      domain: String(auth.domain || registration.domain || "").trim(),
      storeName: String(auth.storeName || registration.storeName || "").trim()
    };
  };

  const persistAuthState = (authState) => {
    const safe = authState || {};
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      phone: normalizePhoneForAuth(safe.phone),
      storeId: sanitizeStoreId(safe.storeId || safe.subdomain || ""),
      subdomain: sanitizeStoreId(safe.storeId || safe.subdomain || ""),
      domain: String(safe.domain || "").trim(),
      storeName: String(safe.storeName || "").trim(),
      authorizedAt: new Date().toISOString()
    }));
  };

  const syncRegistrationFromAuth = (authState) => {
    if (!authState || !authState.storeId) {
      return;
    }

    const current = readJsonFromStorage(REGISTRATION_KEY) || {};
    const next = {
      ...current,
      phone: normalizePhoneForAuth(authState.phone || current.phone),
      storeName: String(authState.storeName || current.storeName || "").trim(),
      subdomain: sanitizeStoreId(authState.storeId || current.subdomain),
      domain: String(authState.domain || current.domain || "").trim()
    };
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify(next));
  };

  const resolveActiveStoreForSession = async (authState) => {
    const db = getAuthDb();

    if (authState.storeId) {
      const storeDoc = await db.collection("store_subdomains").doc(authState.storeId).get();
      if (storeDoc.exists) {
        const storeData = storeDoc.data() || {};
        const storedPhone = normalizePhoneForAuth(storeData.phone);
        if (isStoreDocActive(storeData) && (!authState.phone || !storedPhone || phonesMatch(storedPhone, authState.phone))) {
          return {
            storeId: storeDoc.id,
            phone: storedPhone || authState.phone,
            domain: String(storeData.domain || authState.domain || "").trim(),
            storeName: String(storeData.storeName || authState.storeName || "").trim()
          };
        }
      }
    }

    if (!authState.phone) {
      return null;
    }

    const phoneCandidates = [];
    const normalizedPhone = String(authState.phone || "").trim();
    const digitsPhone = normalizePhoneDigits(normalizedPhone);
    if (normalizedPhone) {
      phoneCandidates.push(normalizedPhone);
    }
    if (digitsPhone && digitsPhone !== normalizedPhone) {
      phoneCandidates.push(digitsPhone);
    }
    if (digitsPhone && ("+" + digitsPhone) !== normalizedPhone) {
      phoneCandidates.push("+" + digitsPhone);
    }

    const uniqueCandidates = phoneCandidates.filter((item, index) => item && phoneCandidates.indexOf(item) === index);
    const docsById = new Map();

    for (let i = 0; i < uniqueCandidates.length; i += 1) {
      const byPhoneSnap = await db.collection("store_subdomains").where("phone", "==", uniqueCandidates[i]).limit(20).get();
      byPhoneSnap.docs.forEach((doc) => {
        docsById.set(doc.id, doc);
      });
    }

    const candidateDocs = Array.from(docsById.values());
    if (!candidateDocs.length) {
      return null;
    }

    let activeDoc = null;
    candidateDocs.some((doc) => {
      const data = doc.data() || {};
      if (isStoreDocActive(data)) {
        activeDoc = doc;
        return true;
      }
      return false;
    });

    if (!activeDoc) {
      return null;
    }

    const activeData = activeDoc.data() || {};
    return {
      storeId: activeDoc.id,
      phone: normalizePhoneForAuth(activeData.phone || authState.phone),
      domain: String(activeData.domain || authState.domain || "").trim(),
      storeName: String(activeData.storeName || authState.storeName || "").trim()
    };
  };

  const verifySessionStoreStillActive = async (storeId) => {
    if (!storeId) {
      redirectToLogin("user-not-found");
      return;
    }

    try {
      const db = getAuthDb();
      const doc = await db.collection("store_subdomains").doc(storeId).get();
      if (!doc.exists || !isStoreDocActive(doc.data() || {})) {
        redirectToLogin("user-not-found");
      }
    } catch (error) {
      console.warn("[admin] session check failed:", error);
    }
  };

  const startAuthSessionWatcher = (storeId) => {
    if (!storeId) {
      return;
    }

    if (authSessionWatcher) {
      window.clearInterval(authSessionWatcher);
    }

    authSessionWatcher = window.setInterval(() => {
      verifySessionStoreStillActive(storeId);
    }, SESSION_CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        verifySessionStoreStillActive(storeId);
      }
    });
  };

  const enforceSessionAccess = async () => {
    const authState = readAuthState();
    if (!authState.phone && !authState.storeId) {
      redirectToLogin("auth-required");
      return;
    }

    try {
      const activeStore = await resolveActiveStoreForSession(authState);
      if (!activeStore || !activeStore.storeId) {
        redirectToLogin("user-not-found");
        return;
      }

      persistAuthState(activeStore);
      syncRegistrationFromAuth(activeStore);
      startAuthSessionWatcher(activeStore.storeId);
    } catch (error) {
      console.warn("[admin] access validation failed:", error);
    }
  };

  const getStorefrontUrl = () => {
    const context = getCurrentStoreContext();
    if (context.registeredDomain) {
      return context.registeredDomain;
    }

    const baseOrigin = window.location.origin;
    const pathname = window.location.pathname || "/";

    const withStoreParam = (urlValue) => {
      if (!context.subdomain) return urlValue;
      try {
        const url = new URL(urlValue, baseOrigin);
        url.searchParams.set("store", context.subdomain);
        return url.toString();
      } catch {
        return urlValue;
      }
    };

    if (pathname.endsWith("/admin.html")) {
      return withStoreParam(`${baseOrigin}${pathname.replace(/admin\.html$/, "index.html")}`);
    }

    if (pathname.endsWith("/admin")) {
      return withStoreParam(`${baseOrigin}${pathname.slice(0, -"/admin".length) || "/"}`);
    }

    return withStoreParam(`${baseOrigin}/`);
  };

  const copyTextToClipboard = async (value) => {
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "absolute";
    helper.style.left = "-9999px";
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  };

  const setMenuOpen = (open) => {
    if (!adminSidebar || !mobileMenuToggle) return;
    adminSidebar.classList.toggle("menu-open", open);
    mobileMenuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const activateSection = (sectionId) => {
    if (isSectionLocked(sectionId)) {
      sectionId = "billing";
    }
    currentSection = sectionId;

    localStorage.setItem(ADMIN_ACTIVE_SECTION_KEY, sectionId);
    syncSectionHash(sectionId);

    primaryMenuItems.forEach((item) => {
      const isSettingsRoot = item.dataset.section === "settings";
      const isActive = item.dataset.section === sectionId || (isSettingsRoot && settingsSections.includes(sectionId));
      item.classList.toggle("active", isActive);
    });

    settingsItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.section === sectionId);
    });

    const showSettingsSubnav = settingsSections.includes(sectionId);
    if (settingsSubnav) {
      settingsSubnav.classList.toggle("open", showSettingsSubnav);
    }

    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === sectionId);
    });

    sectionTitle.textContent = titles[sectionId] || "Адмін панель";

    if (sectionId === "views") {
      renderViewsStats();
    }

    if (sectionId === "sales") {
      ensureSalesRangeDefaults();
      renderSalesFromForm();
    }

    if (sectionId === "domain") {
      renderDomainSection();
    }

    if (sectionId === "notifications") {
      void openTelegramNotificationsSection();
    } else {
      stopTelegramStatusPolling();
    }

    if (sectionId === "products") {
      setProductsLoading(true);
      window.setTimeout(() => {
        renderProductsTable(products);
        setProductsLoading(false);
      }, 0);
    }
  };

  const notifyPlanRestriction = (sectionId) => {
    if (isSubscriptionExpired()) {
      window.alert(
        "Пробний період завершився. Оплатіть будь-який тариф, щоб продовжити користуватися магазином."
      );
      return;
    }
    const requiredPlan = SECTION_PLAN_REQUIREMENT[sectionId] || "вищому";
    const sectionName = titles[sectionId] || "Ця функція";
    window.alert(`«${sectionName}» доступна на тарифі «${requiredPlan}». Оберіть відповідний тариф, щоб розблокувати цю функцію.`);
  };

  primaryMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (item.dataset.section === "logout") {
        window.location.href = getLandingUrl();
        return;
      }

      if (item.dataset.section === "support") {
        window.location.href = SUPPORT_TELEGRAM_URL;
        return;
      }

      if (isSectionLocked(item.dataset.section)) {
        notifyPlanRestriction(item.dataset.section);
        activateSection("billing");
        if (isMobileViewport()) {
          setMenuOpen(false);
        }
        return;
      }

      if (item.dataset.section === "settings") {
        const nextSection = settingsSections.includes(currentSection) ? currentSection : "settings";
        activateSection(nextSection);
        if (isMobileViewport()) {
          setMenuOpen(false);
        }
        return;
      }

      activateSection(item.dataset.section);
      if (isMobileViewport()) {
        setMenuOpen(false);
      }
    });
  });

  settingsItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (isSectionLocked(item.dataset.section)) {
        notifyPlanRestriction(item.dataset.section);
        activateSection("billing");
        if (isMobileViewport()) {
          setMenuOpen(false);
        }
        return;
      }

      activateSection(item.dataset.section);
      if (isMobileViewport()) {
        setMenuOpen(false);
      }
    });
  });

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", () => {
      const shouldOpen = !adminSidebar.classList.contains("menu-open");
      setMenuOpen(shouldOpen);
    });
  }

  window.addEventListener("resize", () => {
    if (!isMobileViewport()) {
      setMenuOpen(false);
    }
  });

  window.addEventListener("hashchange", () => {
    const section = parseSectionFromHash();
    if (!section || section === currentSection) return;
    if (isSectionLocked(section)) {
      syncSectionHash(currentSection);
      return;
    }
    activateSection(section);
  });

  const settingsForm = document.getElementById("storeSettingsForm");
  const personalizationForm = document.getElementById("personalizationForm");
  const productCreateForm = document.getElementById("productCreateForm");
  const openProductModal = document.getElementById("openProductModal");
  const closeProductModal = document.getElementById("closeProductModal");
  const productModal = document.getElementById("productModal");

  const storeName = document.getElementById("storeName");
  const storeDescription = document.getElementById("storeDescription");
  const storeAvatar = document.getElementById("storeAvatar");
  const storeAvatarFile = document.getElementById("storeAvatarFile");
  const storeCurrencySelect = document.getElementById("storeCurrencySelect");
  const storeCurrencyTrigger = document.getElementById("storeCurrencyTrigger");
  const storeCurrencyLabel = document.getElementById("storeCurrencyLabel");
  const storeCurrencyOptions = document.getElementById("storeCurrencyOptions");
  const storeCurrencyOptionButtons = Array.from(document.querySelectorAll("#storeCurrencyOptions .custom-unit-option"));
  const storeCurrency = document.getElementById("storeCurrency");
  const avatarPreview = document.getElementById("avatarPreview");
  const socialInstagram = document.getElementById("socialInstagram");
  const socialFacebook = document.getElementById("socialFacebook");
  const socialTelegram = document.getElementById("socialTelegram");
  const socialTiktok = document.getElementById("socialTiktok");
  const socialInstagramEnabled = document.getElementById("socialInstagramEnabled");
  const socialFacebookEnabled = document.getElementById("socialFacebookEnabled");
  const socialTelegramEnabled = document.getElementById("socialTelegramEnabled");
  const socialTiktokEnabled = document.getElementById("socialTiktokEnabled");
  const minimumOrderEnabled = document.getElementById("minimumOrderEnabled");
  const minimumOrderAmount = document.getElementById("minimumOrderAmount");
  const hideWatermarkEnabled = document.getElementById("hideWatermarkEnabled");
  const watermarkFieldset = document.getElementById("watermarkFieldset");
  const watermarkPlanNote = document.getElementById("watermarkPlanNote");
  const cartIconColor = document.getElementById("cartIconColor");
  const siteColor = document.getElementById("siteColor");
  const siteBackgroundType = document.getElementById("siteBackgroundType");
  const siteBackgroundColor = document.getElementById("siteBackgroundColor");
  const siteBackgroundImage = document.getElementById("siteBackgroundImage");
  const siteBackgroundImageFile = document.getElementById("siteBackgroundImageFile");
  const clearBackgroundImage = document.getElementById("clearBackgroundImage");
  const backgroundPreview = document.getElementById("backgroundPreview");
  const savedMessage = document.getElementById("settingsSavedMessage");
  const personalizationSavedMessage = document.getElementById("personalizationSavedMessage");

  const applyStorefrontContextUi = () => {
    const storefrontUrl = getStorefrontUrl();

    if (homeStoreDomainInput) {
      homeStoreDomainInput.value = storefrontUrl;
    }

    if (homeOpenStorefront) {
      homeOpenStorefront.href = storefrontUrl || "#";
    }

    if (storefrontHeadLink) {
      storefrontHeadLink.href = storefrontUrl;
    }
  };

  applyStorefrontContextUi();
  window.setTimeout(applyStorefrontContextUi, 900);
  window.setTimeout(applyStorefrontContextUi, 2500);
  enforceSessionAccess();
  window.addEventListener("storage", function (event) {
    if (!event) return;
    if (event.key === AUTH_KEY && !event.newValue) {
      redirectToLogin("auth-required");
      return;
    }
    if (event.key === REGISTRATION_KEY || event.key === SETTINGS_KEY) {
      applyStorefrontContextUi();
      updateAdminDocumentTitle();
    }
  });

  if (copyHomeStoreDomain) {
    copyHomeStoreDomain.addEventListener("click", async () => {
      const valueToCopy = homeStoreDomainInput?.value?.trim();

      try {
        const copied = await copyTextToClipboard(valueToCopy);
        if (homeDomainCopyMessage) {
          homeDomainCopyMessage.classList.toggle("error", !copied);
          homeDomainCopyMessage.textContent = copied ? "Адресу скопійовано." : "Не вдалося скопіювати адресу.";
        }
      } catch (error) {
        if (homeDomainCopyMessage) {
          homeDomainCopyMessage.classList.add("error");
          homeDomainCopyMessage.textContent = "Не вдалося скопіювати адресу.";
        }
      }

      setTimeout(() => {
        if (homeDomainCopyMessage) {
          homeDomainCopyMessage.textContent = "";
          homeDomainCopyMessage.classList.remove("error");
        }
      }, 2200);
    });
  }

  const sanitizeCustomDomain = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  const isValidCustomDomain = (value) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value);

  const callDomainFunction = async (name, payload) => {
    const functionsClient = getFunctionsClient();
    const callable = functionsClient.httpsCallable(name);
    const response = await callable(payload || {});
    return (response && response.data) || {};
  };

  const reconcileTariffInvoicesForCurrentStore = async () => {
    const authState = readAuthState();
    const storeContext = getCurrentStoreContext();
    const storeId = sanitizeStoreId(authState?.storeId || storeContext?.subdomain || "") || "default-store";
    if (!storeId || storeId === "default-store") {
      return;
    }

    try {
      await fetch("https://us-central1-lavka-shop.cloudfunctions.net/reconcileStoreTariffInvoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId })
      });
    } catch (error) {
      console.warn("reconcileTariffInvoicesForCurrentStore error:", error);
    }
  };

  const applyDomainResult = (result) => {
    if (!result || typeof result !== "object") {
      return;
    }

    mergeAndSaveSettings({
      customDomain: String(result.domain || readSettings()?.customDomain || "").trim(),
      customDomainStatus: result.connected ? "connected" : "pending",
      customDomainHostnameId: String(result.hostnameId || readSettings()?.customDomainHostnameId || ""),
      customDomainCfStatus: String(result.status || ""),
      customDomainSslStatus: String(result.sslStatus || ""),
      customDomainRecords: Array.isArray(result.records) ? result.records : [],
      customDomainConnectedAt: result.connected ? new Date().toISOString() : (readSettings()?.customDomainConnectedAt || null),
      customDomainLastCheckAt: new Date().toISOString()
    });
  };

  const renderDnsRecords = (records) => {
    if (!dnsRecordsDynamic) return;

    const escapeDns = (value) => String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const list = Array.isArray(records) ? records : [];
    if (!list.length) {
      dnsRecordsDynamic.innerHTML = "";
      if (dnsRecordsPanel) dnsRecordsPanel.hidden = true;
      return;
    }

    if (dnsRecordsPanel) dnsRecordsPanel.hidden = false;

    const copyIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    dnsRecordsDynamic.innerHTML = list.map((record, index) => {
      const type = escapeDns(record.type);
      const name = escapeDns(record.name);
      const value = escapeDns(record.value);
      const purpose = escapeDns(record.purpose);
      const valueId = `dnsDynValue${index}`;
      return `
        <div class="dns-record-card">
          <p class="dns-record-title">${purpose}</p>
          <div class="dns-record-row">
            <span class="dns-record-label">Тип</span>
            <span class="dns-record-value">${type}</span>
          </div>
          <div class="dns-record-row">
            <span class="dns-record-label">Ім'я/Хост</span>
            <span class="dns-record-value-copy">
              <code id="${valueId}Name">${name}</code>
              <button type="button" class="mini-btn dns-copy-btn" data-copy-target="${valueId}Name" aria-label="Скопіювати ім'я запису">${copyIcon}</button>
            </span>
          </div>
          <div class="dns-record-row">
            <span class="dns-record-label">Значення</span>
            <span class="dns-record-value-copy">
              <code id="${valueId}">${value}</code>
              <button type="button" class="mini-btn dns-copy-btn" data-copy-target="${valueId}" aria-label="Скопіювати значення запису">${copyIcon}</button>
            </span>
          </div>
        </div>`;
    }).join("");
  };

  const renderDomainSection = () => {
    if (domainSubdomainInput) {
      domainSubdomainInput.value = getStorefrontUrl();
    }

    const settings = readSettings() || {};
    const customDomain = String(settings.customDomain || "").trim();
    const status = String(settings.customDomainStatus || "none");
    const sslStatus = String(settings.customDomainSslStatus || "");
    const lastCheckAt = settings.customDomainLastCheckAt || null;

    if (customDomainInput && document.activeElement !== customDomainInput) {
      customDomainInput.value = customDomain;
    }

    renderDnsRecords(customDomain ? settings.customDomainRecords : []);

    if (domainStatusBadge && domainStatusText) {
      domainStatusBadge.classList.remove("pending", "connected", "error");

      if (!customDomain) {
        domainStatusBadge.textContent = "Домен не підключено";
        domainStatusText.textContent = "Ще жоден домен не додано до цього магазину.";
      } else if (status === "connected") {
        domainStatusBadge.classList.add("connected");
        domainStatusBadge.textContent = "Підключено";
        domainStatusText.textContent = `Домен ${customDomain} підключено, сертифікат активний.${lastCheckAt ? ` Остання перевірка: ${formatDateTime(lastCheckAt)}.` : ""}`;
      } else if (status === "error") {
        domainStatusBadge.classList.add("error");
        domainStatusBadge.textContent = "Помилка";
        domainStatusText.textContent = `Не вдалося підключити ${customDomain}. Перевірте DNS-записи нижче і спробуйте ще раз.`;
      } else {
        domainStatusBadge.classList.add("pending");
        domainStatusBadge.textContent = "Очікує підтвердження";
        const sslNote = sslStatus && sslStatus !== "active" ? ` Статус сертифіката: ${sslStatus}.` : "";
        domainStatusText.textContent = `Домен ${customDomain} додано. Додайте DNS-записи нижче, тоді натисніть "Перевірити підключення".${sslNote}`;
      }
    }

    if (checkDomainBtn) checkDomainBtn.disabled = !customDomain;
    if (disconnectDomainBtn) disconnectDomainBtn.disabled = !customDomain;
  };

  const showTemporaryMessage = (element, text, isError) => {
    if (!element) return;
    element.classList.toggle("error", Boolean(isError));
    element.textContent = text;
    setTimeout(() => {
      element.textContent = "";
      element.classList.remove("error");
    }, 2600);
  };

  if (copyDomainSubdomain) {
    copyDomainSubdomain.addEventListener("click", async () => {
      const valueToCopy = domainSubdomainInput?.value?.trim();
      try {
        const copied = await copyTextToClipboard(valueToCopy);
        showTemporaryMessage(domainSubdomainCopyMessage, copied ? "Адресу скопійовано." : "Не вдалося скопіювати адресу.", !copied);
      } catch {
        showTemporaryMessage(domainSubdomainCopyMessage, "Не вдалося скопіювати адресу.", true);
      }
    });
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest && event.target.closest(".dns-copy-btn");
    if (!button) return;

    const targetId = button.dataset.copyTarget;
    const valueToCopy = targetId ? document.getElementById(targetId)?.textContent?.trim() : "";
    try {
      const copied = await copyTextToClipboard(valueToCopy);
      showTemporaryMessage(dnsCopyMessage, copied ? "Значення скопійовано." : "Не вдалося скопіювати значення.", !copied);
    } catch {
      showTemporaryMessage(dnsCopyMessage, "Не вдалося скопіювати значення.", true);
    }
  });

  if (customDomainForm) {
    customDomainForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const rawValue = sanitizeCustomDomain(customDomainInput?.value);

      if (!rawValue || !isValidCustomDomain(rawValue)) {
        showTemporaryMessage(customDomainSavedMessage, "Введіть коректний домен, наприклад my-shop.com.", true);
        return;
      }

      const submitBtn = customDomainForm.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Підключаємо...";
      }

      try {
        const result = await callDomainFunction("connectCustomDomain", { domain: rawValue });
        applyDomainResult(result);
        showTemporaryMessage(customDomainSavedMessage, "Домен додано. Додайте показані нижче DNS-записи і перевірте підключення.", false);
      } catch (error) {
        const message = (error && error.message) || "Не вдалося підключити домен. Спробуйте ще раз.";
        showTemporaryMessage(customDomainSavedMessage, message, true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
        renderDomainSection();
      }
    });
  }

  if (checkDomainBtn) {
    checkDomainBtn.addEventListener("click", async () => {
      const settings = readSettings() || {};
      const customDomain = String(settings.customDomain || "").trim();
      if (!customDomain) return;

      checkDomainBtn.disabled = true;
      const originalLabel = checkDomainBtn.textContent;
      checkDomainBtn.textContent = "Перевіряємо...";

      try {
        const result = await callDomainFunction("refreshCustomDomain", {
          hostnameId: settings.customDomainHostnameId || "",
          domain: customDomain
        });
        applyDomainResult(result);
        if (result.connected) {
          showTemporaryMessage(customDomainSavedMessage, "Домен підключено, сертифікат активний.", false);
        } else {
          showTemporaryMessage(customDomainSavedMessage, "Домен ще не готовий. Перевірте DNS-записи і спробуйте за кілька хвилин.", true);
        }
      } catch (error) {
        const message = (error && error.message) || "Не вдалося перевірити підключення зараз.";
        showTemporaryMessage(customDomainSavedMessage, message, true);
      } finally {
        checkDomainBtn.textContent = originalLabel;
        renderDomainSection();
      }
    });
  }

  if (disconnectDomainBtn) {
    disconnectDomainBtn.addEventListener("click", async () => {
      const settings = readSettings() || {};
      const customDomain = String(settings.customDomain || "").trim();
      if (!customDomain) return;

      disconnectDomainBtn.disabled = true;
      const originalLabel = disconnectDomainBtn.textContent;
      disconnectDomainBtn.textContent = "Відключаємо...";

      try {
        await callDomainFunction("disconnectCustomDomain", {
          hostnameId: settings.customDomainHostnameId || "",
          domain: customDomain
        });
      } catch (error) {
        // Навіть якщо видалення на боці Cloudflare не вдалося — прибираємо домен локально.
      }

      mergeAndSaveSettings({
        customDomain: "",
        customDomainStatus: "none",
        customDomainHostnameId: "",
        customDomainCfStatus: "",
        customDomainSslStatus: "",
        customDomainRecords: []
      });

      if (customDomainInput) {
        customDomainInput.value = "";
      }

      disconnectDomainBtn.textContent = originalLabel;
      showTemporaryMessage(customDomainSavedMessage, "Домен відключено.", false);
      renderDomainSection();
    });
  }

  const telegramNotificationsForm = document.getElementById("telegramNotificationsForm");
  const telegramOrderNotifyEnabled = document.getElementById("telegramOrderNotifyEnabled");
  const telegramConnectBox = document.getElementById("telegramConnectBox");
  const telegramConnectTitle = document.getElementById("telegramConnectTitle");
  const telegramConnectDesc = document.getElementById("telegramConnectDesc");
  const telegramConnectBadge = document.getElementById("telegramConnectBadge");
  const telegramConnectBtn = document.getElementById("telegramConnectBtn");
  const telegramDisconnectBtn = document.getElementById("telegramDisconnectBtn");
  const telegramNotificationsSavedMessage = document.getElementById("telegramNotificationsSavedMessage");
  const paymentMethodsForm = document.getElementById("paymentMethodsForm");
  const paymentMonoEnabled = document.getElementById("paymentMonoEnabled");
  const paymentMonoSecret = document.getElementById("paymentMonoSecret");
  const paymentLiqpayEnabled = document.getElementById("paymentLiqpayEnabled");
  const paymentLiqpayPublicKey = document.getElementById("paymentLiqpayPublicKey");
  const paymentLiqpayPrivateKey = document.getElementById("paymentLiqpayPrivateKey");
  const paymentCodEnabled = document.getElementById("paymentCodEnabled");
  const paymentCodFee = document.getElementById("paymentCodFee");
  const paymentPrepaymentEnabled = document.getElementById("paymentPrepaymentEnabled");
  const paymentPrepaymentAmount = document.getElementById("paymentPrepaymentAmount");
  const paymentPrepaymentViaMono = document.getElementById("paymentPrepaymentViaMono");
  const paymentPrepaymentViaLiqpay = document.getElementById("paymentPrepaymentViaLiqpay");
  const paymentPrepaymentHint = document.getElementById("paymentPrepaymentHint");
  const paymentBankTransferEnabled = document.getElementById("paymentBankTransferEnabled");
  const paymentBankRequisites = document.getElementById("paymentBankRequisites");
  const paymentsSavedMessage = document.getElementById("paymentsSavedMessage");
  const shippingMethodsForm = document.getElementById("shippingMethodsForm");
  const logoutActionButton = document.querySelector("#logout .action-btn.danger");
  const shippingNovaPostEnabled = document.getElementById("shippingNovaPostEnabled");
  const shippingUkrPostEnabled = document.getElementById("shippingUkrPostEnabled");
  const shippingNovaCourierEnabled = document.getElementById("shippingNovaCourierEnabled");
  const deliveryPaymentMatrix = document.getElementById("deliveryPaymentMatrix");
  const deliveryPaymentMatrixInputs = Array.from(document.querySelectorAll("#deliveryPaymentMatrix input[type='checkbox'][data-delivery-id][data-payment-id]"));
  const shippingSavedMessage = document.getElementById("shippingSavedMessage");
  const nameCounter = document.getElementById("nameCounter");
  const descriptionCounter = document.getElementById("descriptionCounter");
  const productName = document.getElementById("productName");
  const productSku = document.getElementById("productSku");
  const productCategories = document.getElementById("productCategories");
  const productDescription = document.getElementById("productDescription");
  const productPrice = document.getElementById("productPrice");
  const productUnitSelect = document.getElementById("productUnitSelect");
  const productUnitTrigger = document.getElementById("productUnitTrigger");
  const productUnitLabel = document.getElementById("productUnitLabel");
  const productUnitOptions = document.getElementById("productUnitOptions");
  const productUnitOptionButtons = Array.from(document.querySelectorAll("#productUnitOptions .custom-unit-option"));
  const productUnit = document.getElementById("productUnit");
  const productIsClothing = document.getElementById("productIsClothing");
  const productSizesWrap = document.getElementById("productSizesWrap");
  const productSizes = document.getElementById("productSizes");
  const productSizesCustom = document.getElementById("productSizesCustom");
  const productVisible = document.getElementById("productVisible");
  const productPhotos = document.getElementById("productPhotos");
  const productPhotosPolicyLabel = document.getElementById("productPhotosPolicyLabel");
  const productPhotosPolicyHint = document.getElementById("productPhotosPolicyHint");
  const productPhotosPreview = document.getElementById("productPhotosPreview");
  const productSavedMessage = document.getElementById("productSavedMessage");
  const productEditingId = document.getElementById("productEditingId");
  const productModalTitle = document.getElementById("productModalTitle");
  const productSubmitButton = document.getElementById("productSubmitButton");
  const productNameCounter = document.getElementById("productNameCounter");
  const productDescriptionCounter = document.getElementById("productDescriptionCounter");
  const productsTableBody = document.getElementById("productsTableBody");
  const productsPanel = document.getElementById("products");
  const productsTableWrap = document.querySelector("#products .products-table-wrap");
  const productsLoadingOverlay = document.getElementById("productsLoadingOverlay");
  const productsPagination = document.getElementById("productsPagination");
  const productLimitBadge = document.getElementById("productLimitBadge");
  const categoryLimitBadge = document.getElementById("categoryLimitBadge");
  const showVisibleProducts = document.getElementById("showVisibleProducts");
  const showHiddenProducts = document.getElementById("showHiddenProducts");
  const selectAllProductsOnPage = document.getElementById("selectAllProductsOnPage");
  const bulkSelectionInfo = document.getElementById("bulkSelectionInfo");
  const bulkToolsPanel = document.getElementById("bulkToolsPanel");
  const bulkToolsHint = document.getElementById("bulkToolsHint");
  const bulkPriceOperation = document.getElementById("bulkPriceOperation");
  const bulkPriceValue = document.getElementById("bulkPriceValue");
  const bulkPriceUnit = document.getElementById("bulkPriceUnit");
  const applyBulkPrice = document.getElementById("applyBulkPrice");
  const bulkVisibilityValue = document.getElementById("bulkVisibilityValue");
  const applyBulkVisibility = document.getElementById("applyBulkVisibility");
  const bulkDiscountValue = document.getElementById("bulkDiscountValue");
  const bulkDiscountUnit = document.getElementById("bulkDiscountUnit");
  const applyBulkDiscount = document.getElementById("applyBulkDiscount");
  const applyBulkDelete = document.getElementById("applyBulkDelete");
  const clearBulkSelection = document.getElementById("clearBulkSelection");
  const bulkActionMessage = document.getElementById("bulkActionMessage");
  const categoryCreateForm = document.getElementById("categoryCreateForm");
  const categoryNameInput = document.getElementById("categoryNameInput");
  const categoryNameCounter = document.getElementById("categoryNameCounter");
  const categorySavedMessage = document.getElementById("categorySavedMessage");
  const categoriesList = document.getElementById("categoriesList");
  let currentProductStoredPhotos = [];
  let currentProductSelectedFiles = [];
  let productPreviewObjectUrls = [];
  let productsLoadingTimer = null;
  let productsLoadingStartedAt = Date.now();
  const ordersTableBody = document.getElementById("ordersTableBody");
  const ordersSearchInput = document.getElementById("ordersSearchInput");
  const ordersStatusFilter = document.getElementById("ordersStatusFilter");
  const ordersPaymentFilter = document.getElementById("ordersPaymentFilter");
  const ordersAmountFromFilter = document.getElementById("ordersAmountFromFilter");
  const ordersAmountToFilter = document.getElementById("ordersAmountToFilter");
  const ordersFiltersReset = document.getElementById("ordersFiltersReset");
  const ordersPagination = document.getElementById("ordersPagination");
  const ordersSelectAll = document.getElementById("ordersSelectAll");
  const ordersBulkBar = document.getElementById("ordersBulkBar");
  const ordersBulkCount = document.getElementById("ordersBulkCount");
  const ordersBulkStatusSelect = document.getElementById("ordersBulkStatusSelect");
  const ordersBulkStatusApply = document.getElementById("ordersBulkStatusApply");
  const ordersBulkDelete = document.getElementById("ordersBulkDelete");
  const ordersBulkClear = document.getElementById("ordersBulkClear");
  const ordersNewBadge = document.getElementById("ordersNewBadge");
  const ordersKpiCards = Array.from(document.querySelectorAll(".orders-kpi-card"));
  const ordersKpiNewToday = document.getElementById("ordersKpiNewToday");
  const ordersKpiProcessing = document.getElementById("ordersKpiProcessing");
  const ordersKpiShipped = document.getElementById("ordersKpiShipped");
  const orderDetailsModal = document.getElementById("orderDetailsModal");
  const closeOrderDetailsModal = document.getElementById("closeOrderDetailsModal");
  const orderUpdateForm = document.getElementById("orderUpdateForm");
  const orderEditingId = document.getElementById("orderEditingId");
  const orderStatusSelect = document.getElementById("orderStatusSelect");
  const orderPaymentStatusSelect = document.getElementById("orderPaymentStatusSelect");
  const orderTrackingNumber = document.getElementById("orderTrackingNumber");
  const orderManagerCommentInput = document.getElementById("orderManagerCommentInput");
  const orderSavedMessage = document.getElementById("orderSavedMessage");
  const orderClientName = document.getElementById("orderClientName");
  const orderClientPhone = document.getElementById("orderClientPhone");
  const orderDeliveryMethod = document.getElementById("orderDeliveryMethod");
  const orderDeliveryAddress = document.getElementById("orderDeliveryAddress");
  const orderTotalAmount = document.getElementById("orderTotalAmount");
  const orderDiscountAmount = document.getElementById("orderDiscountAmount");
  const orderPromoCode = document.getElementById("orderPromoCode");
  const orderPromoDiscount = document.getElementById("orderPromoDiscount");
  const orderPaymentStatus = document.getElementById("orderPaymentStatus");
  const orderPaymentMethod = document.getElementById("orderPaymentMethod");
  const orderCreatedAt = document.getElementById("orderCreatedAt");
  const orderClientComment = document.getElementById("orderClientComment");
  const orderManagerComment = document.getElementById("orderManagerComment");
  const orderItemsTableBody = document.getElementById("orderItemsTableBody");
  const promoCodeForm = document.getElementById("promoCodeForm");
  const promoCodeCharset = document.getElementById("promoCodeCharset");
  const promoCodeValue = document.getElementById("promoCodeValue");
  const generatePromoCodeBtn = document.getElementById("generatePromoCodeBtn");
  const promoDiscountType = document.getElementById("promoDiscountType");
  const promoDiscountValue = document.getElementById("promoDiscountValue");
  const promoMinOrderAmount = document.getElementById("promoMinOrderAmount");
  const promoMaxDiscountPerOrder = document.getElementById("promoMaxDiscountPerOrder");
  const promoMaxUsesPerClient = document.getElementById("promoMaxUsesPerClient");
  const promoMaxUsesTotal = document.getElementById("promoMaxUsesTotal");
  const promoManagerComment = document.getElementById("promoManagerComment");
  const promoCodeMessage = document.getElementById("promoCodeMessage");
  const promoCodesTableBody = document.getElementById("promoCodesTableBody");
  const openPromoCodeModal = document.getElementById("openPromoCodeModal");
  const closePromoCodeModal = document.getElementById("closePromoCodeModal");
  const promoCodeModal = document.getElementById("promoCodeModal");
  const stockTableBody = document.getElementById("stockTableBody");
  const stockPagination = document.getElementById("stockPagination");
  const stockModal = document.getElementById("stockModal");
  const closeStockModal = document.getElementById("closeStockModal");
  const stockUpdateForm = document.getElementById("stockUpdateForm");
  const stockEditingProductId = document.getElementById("stockEditingProductId");
  const stockQuantityWrap = document.getElementById("stockQuantityWrap");
  const stockQuantityInput = document.getElementById("stockQuantityInput");
  const stockSizeFieldsWrap = document.getElementById("stockSizeFieldsWrap");
  const stockSizeFields = document.getElementById("stockSizeFields");
  const stockSizeTotalHint = document.getElementById("stockSizeTotalHint");
  const stockProductLabel = document.getElementById("stockProductLabel");
  const stockSavedMessage = document.getElementById("stockSavedMessage");
  const viewsTodayCount = document.getElementById("viewsTodayCount");
  const viewsYesterdayCount = document.getElementById("viewsYesterdayCount");
  const viewsLastFiveMinutesCount = document.getElementById("viewsLastFiveMinutesCount");
  const viewsSevenDaysCount = document.getElementById("viewsSevenDaysCount");
  const viewsThirtyDaysCount = document.getElementById("viewsThirtyDaysCount");
  const viewsRangeForm = document.getElementById("viewsRangeForm");
  const viewsRangeFrom = document.getElementById("viewsRangeFrom");
  const viewsRangeTo = document.getElementById("viewsRangeTo");
  const viewsRangeResult = document.getElementById("viewsRangeResult");
  const salesRevenue = document.getElementById("salesRevenue");
  const salesAverageCheck = document.getElementById("salesAverageCheck");
  const salesOrdersCount = document.getElementById("salesOrdersCount");
  const salesRangeForm = document.getElementById("salesRangeForm");
  const salesRangeFrom = document.getElementById("salesRangeFrom");
  const salesRangeTo = document.getElementById("salesRangeTo");
  const salesRangeResult = document.getElementById("salesRangeResult");
  const salesTopProductsBody = document.getElementById("salesTopProductsBody");
  const viewsRangePresets = document.getElementById("viewsRangePresets");
  const salesRangePresets = document.getElementById("salesRangePresets");
  const billingCurrentPlanName = document.getElementById("billingCurrentPlanName");
  const billingValidUntil = document.getElementById("billingValidUntil");
  const billingTrialBanner = document.getElementById("billingTrialBanner");
  const billingPlansGrid = document.getElementById("billingPlansGrid");
  const billingHistoryBody = document.getElementById("billingHistoryBody");

  const containsProfanity = (value) => {
    const text = (value || "").toLowerCase();
    return profanityPatterns.some((pattern) => pattern.test(text));
  };

  const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || ""));

  const applyBackgroundPreview = () => {
    if (!backgroundPreview) return;
    const mode = siteBackgroundType?.value === "image" ? "image" : "color";
    const color = isHexColor(siteBackgroundColor?.value) ? siteBackgroundColor.value : "#eef1f4";
    const imageSource = String(siteBackgroundImage?.value || "").trim();
    const hasImage = mode === "image" && imageSource.length > 0;

    if (hasImage) {
      backgroundPreview.style.backgroundColor = color;
      backgroundPreview.style.backgroundImage = `linear-gradient(rgba(17, 24, 39, 0.24), rgba(17, 24, 39, 0.24)), url("${imageSource}")`;
      backgroundPreview.style.backgroundSize = "cover";
      backgroundPreview.style.backgroundPosition = "center";
    } else {
      backgroundPreview.style.backgroundColor = color;
      backgroundPreview.style.backgroundImage = "none";
      backgroundPreview.style.backgroundSize = "auto";
      backgroundPreview.style.backgroundPosition = "center";
    }
  };

  const updateDescriptionCounter = () => {
    const length = storeDescription.value.length;
    descriptionCounter.textContent = `${length}/${MAX_DESCRIPTION_LENGTH}`;
  };

  const updateNameCounter = () => {
    const length = storeName.value.length;
    nameCounter.textContent = `${length}/${MAX_NAME_LENGTH}`;
  };

  const syncMinimumOrderControls = () => {
    if (!minimumOrderEnabled || !minimumOrderAmount) return;
    minimumOrderAmount.disabled = !minimumOrderEnabled.checked;
    if (!minimumOrderEnabled.checked) {
      minimumOrderAmount.value = "";
    }
  };

  const updateCategoryNameCounter = () => {
    if (!categoryNameInput || !categoryNameCounter) return;
    const length = categoryNameInput.value.length;
    categoryNameCounter.textContent = `${length}/${MAX_CATEGORY_NAME_LENGTH}`;
  };

  const readSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const getAdminStoreNameForTitle = () => {
    const settings = readSettings() || {};
    const registration = readJsonFromStorage(REGISTRATION_KEY) || {};
    const authState = readAuthState();

    const candidates = [
      settings.name,
      settings.storeName,
      registration.storeName,
      authState?.storeName
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      const value = String(candidates[index] || "").trim();
      if (value) {
        return value;
      }
    }

    return "";
  };

  const updateAdminDocumentTitle = (explicitName) => {
    const resolvedName = String(explicitName || "").trim() || getAdminStoreNameForTitle();
    document.title = resolvedName ? `${resolvedName} Admin` : "Admin";
  };

  const MATRIX_DELIVERY_IDS = [
    "shipping-nova-post",
    "shipping-ukr-post",
    "shipping-nova-courier"
  ];

  const MATRIX_PAYMENT_IDS = [
    "payment-mono",
    "payment-liqpay",
    "payment-cod",
    "payment-prepayment",
    "payment-bank-transfer"
  ];

  const buildDefaultPaymentDeliveryMatrix = () => MATRIX_DELIVERY_IDS.reduce((acc, deliveryId) => {
    acc[deliveryId] = [...MATRIX_PAYMENT_IDS];
    return acc;
  }, {});

  const normalizePaymentDeliveryMatrix = (rawMatrix) => {
    const defaults = buildDefaultPaymentDeliveryMatrix();
    if (!rawMatrix || typeof rawMatrix !== "object") {
      return defaults;
    }

    return MATRIX_DELIVERY_IDS.reduce((acc, deliveryId) => {
      const hasDeliveryKey = Object.prototype.hasOwnProperty.call(rawMatrix, deliveryId);
      const rawPayments = hasDeliveryKey && Array.isArray(rawMatrix[deliveryId])
        ? rawMatrix[deliveryId]
        : defaults[deliveryId];
      const normalized = rawPayments
        .map((paymentId) => String(paymentId || "").trim())
        .filter((paymentId, index, array) => MATRIX_PAYMENT_IDS.includes(paymentId) && array.indexOf(paymentId) === index);

      acc[deliveryId] = hasDeliveryKey ? normalized : [...defaults[deliveryId]];
      return acc;
    }, {});
  };

  const collectPaymentDeliveryMatrixFromUi = () => {
    const matrix = MATRIX_DELIVERY_IDS.reduce((acc, deliveryId) => {
      acc[deliveryId] = [];
      return acc;
    }, {});

    deliveryPaymentMatrixInputs.forEach((input) => {
      if (!input.checked) return;
      const deliveryId = String(input.dataset.deliveryId || "").trim();
      const paymentId = String(input.dataset.paymentId || "").trim();
      if (!MATRIX_DELIVERY_IDS.includes(deliveryId) || !MATRIX_PAYMENT_IDS.includes(paymentId)) return;
      if (!matrix[deliveryId].includes(paymentId)) {
        matrix[deliveryId].push(paymentId);
      }
    });

    return normalizePaymentDeliveryMatrix(matrix);
  };

  const applyPaymentDeliveryMatrixToUi = (rawMatrix) => {
    const matrix = normalizePaymentDeliveryMatrix(rawMatrix);

    deliveryPaymentMatrixInputs.forEach((input) => {
      const deliveryId = String(input.dataset.deliveryId || "").trim();
      const paymentId = String(input.dataset.paymentId || "").trim();
      input.checked = Boolean(matrix[deliveryId]?.includes(paymentId));
    });
  };

  const CHECKOUT_SETTINGS_FIELDS = [
    "paymentMonoEnabled",
    "paymentLiqpayEnabled",
    "paymentLiqpayPublicKey",
    "paymentCodEnabled",
    "paymentCodFee",
    "paymentPrepaymentEnabled",
    "paymentPrepaymentAmount",
    "paymentPrepaymentAcquirer",
    "paymentBankTransferEnabled",
    "paymentBankRequisites",
    "shippingNovaPostEnabled",
    "shippingUkrPostEnabled",
    "shippingNovaCourierEnabled",
    "paymentDeliveryMatrix"
  ];

  const readCheckoutSettings = () => {
    try {
      const raw = localStorage.getItem(CHECKOUT_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const pickCheckoutSettings = (source) => {
    const safeSource = source && typeof source === "object" ? source : {};
    return CHECKOUT_SETTINGS_FIELDS.reduce((acc, field) => {
      if (safeSource[field] !== undefined) {
        acc[field] = safeSource[field];
      }
      return acc;
    }, {});
  };

  const persistCheckoutSettings = (source) => {
    const current = readCheckoutSettings() || {};
    const payload = {
      ...current,
      ...pickCheckoutSettings(source),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(CHECKOUT_SETTINGS_KEY, JSON.stringify(payload));
    return payload;
  };

  const readProducts = () => {
    try {
      const raw = localStorage.getItem(PRODUCTS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const saveProducts = (products) => {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  };

  const readOrders = () => {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const saveOrders = (orders) => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  };

  const readCategories = () => {
    try {
      const raw = localStorage.getItem(CATEGORIES_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const saveCategories = (categories) => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  };

  const readPromoCodes = () => {
    try {
      const raw = localStorage.getItem(PROMO_CODES_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const savePromoCodes = (promoCodes) => {
    localStorage.setItem(PROMO_CODES_KEY, JSON.stringify(promoCodes));
  };

  const normalizeVisitEvent = (event) => {
    const timestamp = Number.parseInt(event?.timestamp, 10);
    const visitorId = String(event?.visitorId || "").trim();
    if (!Number.isFinite(timestamp) || timestamp <= 0 || !visitorId) return null;

    return {
      timestamp,
      visitorId
    };
  };

  const readVisitorEvents = () => {
    try {
      const raw = localStorage.getItem(VISITOR_EVENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((event) => normalizeVisitEvent(event)).filter(Boolean);
    } catch {
      return [];
    }
  };

  const countUniqueVisitorsByRange = (events, fromInclusive, toExclusive) => {
    const uniqueVisitors = new Set();
    events.forEach((event) => {
      if (event.timestamp < fromInclusive || event.timestamp >= toExclusive) return;
      uniqueVisitors.add(event.visitorId);
    });
    return uniqueVisitors.size;
  };

  const startOfDay = (date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value.getTime();
  };

  const addDays = (time, days) => {
    const next = new Date(time);
    next.setDate(next.getDate() + days);
    return next.getTime();
  };

  const subtractDays = (time, days) => addDays(time, -days);
  const formatNumber = (value) => new Intl.NumberFormat("uk-UA").format(Number(value) || 0);
  const formatVisitorsLabel = (count) => {
    const value = Math.abs(Number(count) || 0) % 100;
    const tail = value % 10;

    if (value > 10 && value < 20) return "унікальних відвідувачів";
    if (tail === 1) return "унікальний відвідувач";
    if (tail >= 2 && tail <= 4) return "унікальні відвідувачі";
    return "унікальних відвідувачів";
  };

  const formatOrdersLabel = (count) => {
    const value = Math.abs(Number(count) || 0) % 100;
    const tail = value % 10;

    if (value > 10 && value < 20) return "замовлень";
    if (tail === 1) return "замовлення";
    if (tail >= 2 && tail <= 4) return "замовлення";
    return "замовлень";
  };

  const readNotifiedOrderIds = () => {
    try {
      const raw = localStorage.getItem(TELEGRAM_NOTIFIED_ORDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map((id) => String(id || "").trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  };

  const saveNotifiedOrderIds = (idsSet) => {
    const payload = Array.from(idsSet).map((id) => String(id || "").trim()).filter(Boolean);
    localStorage.setItem(TELEGRAM_NOTIFIED_ORDERS_KEY, JSON.stringify(payload));
  };

  const readTelegramOrderNotificationsSettings = () => {
    const settings = readSettings() || {};
    return {
      enabled: Boolean(settings.telegramOrderNotifyEnabled),
      botUsername: TELEGRAM_BOT_USERNAME
    };
  };

  let telegramConnectionState = { linked: false, enabled: false, chatId: "" };
  let telegramStatusPollTimer = null;

  const getAdminStoreId = async () => {
    if (window.__lavkaStoreId) return String(window.__lavkaStoreId);
    if (typeof window.lavkaResolveStoreId === "function") {
      try {
        return String((await window.lavkaResolveStoreId()) || "");
      } catch {
        return "";
      }
    }
    return "";
  };

  const buildStoreTelegramLink = (storeId) => {
    const safe = String(storeId || "").trim();
    if (!safe || safe === "default-store") return "";
    return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(`store_${safe}`)}`;
  };

  const setTelegramMessage = (text, isError) => {
    if (!telegramNotificationsSavedMessage) return;
    telegramNotificationsSavedMessage.classList.toggle("error", Boolean(isError));
    telegramNotificationsSavedMessage.textContent = text || "";
  };

  const renderTelegramConnectionState = () => {
    const linked = Boolean(telegramConnectionState.linked);
    const enabled = Boolean(telegramConnectionState.enabled);

    if (telegramConnectBox) {
      telegramConnectBox.classList.toggle("is-connected", linked);
    }
    if (telegramConnectBadge) {
      telegramConnectBadge.hidden = !linked;
    }
    if (telegramConnectTitle) {
      telegramConnectTitle.textContent = linked ? "Telegram підключено" : "Telegram не підключено";
    }
    if (telegramConnectDesc) {
      telegramConnectDesc.textContent = linked
        ? (telegramConnectionState.chatId ? `Chat ID: ${telegramConnectionState.chatId}` : "Магазин підключено до бота.")
        : "Натисніть кнопку нижче і виконайте /start у Telegram — магазин підключиться автоматично.";
    }
    if (telegramConnectBtn) {
      telegramConnectBtn.hidden = linked;
    }
    if (telegramDisconnectBtn) {
      telegramDisconnectBtn.hidden = !linked;
    }
    if (telegramOrderNotifyEnabled) {
      telegramOrderNotifyEnabled.checked = linked && enabled;
      telegramOrderNotifyEnabled.disabled = !linked;
    }
  };

  const refreshTelegramConnectLink = async () => {
    const storeId = await getAdminStoreId();
    const link = buildStoreTelegramLink(storeId);
    if (telegramConnectBtn) {
      if (link) {
        telegramConnectBtn.href = link;
        telegramConnectBtn.classList.remove("disabled");
        telegramConnectBtn.setAttribute("aria-disabled", "false");
      } else {
        telegramConnectBtn.href = "#";
        telegramConnectBtn.classList.add("disabled");
        telegramConnectBtn.setAttribute("aria-disabled", "true");
      }
    }
    return storeId;
  };

  const fetchTelegramStatus = async () => {
    const storeId = await getAdminStoreId();
    if (!storeId || storeId === "default-store") return null;
    try {
      const data = await callDomainFunction("telegramStatus", { storeId });
      telegramConnectionState = {
        linked: Boolean(data.linked),
        enabled: Boolean(data.enabled),
        chatId: String(data.chatId || "")
      };
      const nextEnabled = telegramConnectionState.linked && telegramConnectionState.enabled;
      if (Boolean((readSettings() || {}).telegramOrderNotifyEnabled) !== nextEnabled) {
        mergeAndSaveSettings({ telegramOrderNotifyEnabled: nextEnabled });
      }
      return telegramConnectionState;
    } catch {
      return null;
    }
  };

  const renderAdminTelegramSubscriptionControls = () => {
    void refreshTelegramConnectLink();
    renderTelegramConnectionState();
  };

  const stopTelegramStatusPolling = () => {
    if (!telegramStatusPollTimer) return;
    window.clearInterval(telegramStatusPollTimer);
    telegramStatusPollTimer = null;
  };

  const startTelegramStatusPolling = () => {
    stopTelegramStatusPolling();
    telegramStatusPollTimer = window.setInterval(async () => {
      if (currentSection !== "notifications") {
        stopTelegramStatusPolling();
        return;
      }
      const wasLinked = telegramConnectionState.linked;
      await fetchTelegramStatus();
      renderTelegramConnectionState();
      if (!wasLinked && telegramConnectionState.linked) {
        setTelegramMessage("Telegram підключено. Сповіщення активовано.", false);
      }
    }, 4000);
  };

  const openTelegramNotificationsSection = async () => {
    await refreshTelegramConnectLink();
    renderTelegramConnectionState();
    await fetchTelegramStatus();
    renderTelegramConnectionState();
    startTelegramStatusPolling();
  };


  const renderViewsStats = () => {
    if (!viewsTodayCount) return;

    const now = Date.now();
    const todayStart = startOfDay(now);
    const yesterdayStart = subtractDays(todayStart, 1);
    const tomorrowStart = addDays(todayStart, 1);
    const sevenDaysStart = subtractDays(todayStart, 6);
    const thirtyDaysStart = subtractDays(todayStart, 29);
    const fiveMinutesStart = now - (5 * 60 * 1000);
    const events = readVisitorEvents();

    viewsTodayCount.textContent = formatNumber(countUniqueVisitorsByRange(events, todayStart, now + 1));
    viewsYesterdayCount.textContent = formatNumber(countUniqueVisitorsByRange(events, yesterdayStart, todayStart));
    viewsLastFiveMinutesCount.textContent = formatNumber(countUniqueVisitorsByRange(events, fiveMinutesStart, now + 1));
    viewsSevenDaysCount.textContent = formatNumber(countUniqueVisitorsByRange(events, sevenDaysStart, tomorrowStart));
    viewsThirtyDaysCount.textContent = formatNumber(countUniqueVisitorsByRange(events, thirtyDaysStart, tomorrowStart));
  };

  const renderViewsCustomRange = () => {
    if (!viewsRangeResult || !viewsRangeFrom || !viewsRangeTo) return;

    const fromValue = viewsRangeFrom.value;
    const toValue = viewsRangeTo.value;

    if (!fromValue || !toValue) {
      viewsRangeResult.textContent = "Оберіть дату початку та дату завершення.";
      viewsRangeResult.classList.add("error");
      return;
    }

    const fromDate = new Date(`${fromValue}T00:00:00`);
    const toDate = new Date(`${toValue}T00:00:00`);

    if (toDate.getTime() < fromDate.getTime()) {
      viewsRangeResult.textContent = "Дата завершення має бути не раніше за дату початку.";
      viewsRangeResult.classList.add("error");
      return;
    }

    const fromTime = fromDate.getTime();
    const toTime = addDays(toDate.getTime(), 1);
    const visitors = countUniqueVisitorsByRange(readVisitorEvents(), fromTime, toTime);
    const label = formatVisitorsLabel(visitors);

    viewsRangeResult.classList.remove("error");
    viewsRangeResult.textContent = `За період ${fromValue} - ${toValue}: ${formatNumber(visitors)} ${label}.`;
  };

  const formatDateInputValue = (value) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getPresetDateRange = (preset) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    switch (preset) {
      case "today":
        return { from: todayStart, to: todayStart };
      case "yesterday": {
        const yesterday = new Date(todayStart);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday, to: yesterday };
      }
      case "7d": {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - 6);
        return { from: start, to: todayStart };
      }
      case "30d": {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - 29);
        return { from: start, to: todayStart };
      }
      case "month": {
        const start = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
        return { from: start, to: todayStart };
      }
      default:
        return null;
    }
  };

  const setupRangePresets = (container, fromInput, toInput, onApply) => {
    if (!container || !fromInput || !toInput) return;

    const clearActive = () => {
      container.querySelectorAll(".range-preset-btn").forEach((btn) => btn.classList.remove("active"));
    };

    container.addEventListener("click", (event) => {
      const button = event.target.closest(".range-preset-btn");
      if (!button) return;

      const range = getPresetDateRange(button.dataset.preset);
      if (!range) return;

      fromInput.value = formatDateInputValue(range.from);
      toInput.value = formatDateInputValue(range.to);

      container.querySelectorAll(".range-preset-btn").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
      });

      onApply();
    });

    fromInput.addEventListener("input", clearActive);
    toInput.addEventListener("input", clearActive);
  };

  const parseOrderTimestamp = (order) => {
    const source = order?.createdAt || order?.updatedAt || null;
    if (!source) return null;
    const timestamp = Date.parse(source);
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  const isCanceledOrder = (order) => String(order?.status || "").toLowerCase().includes("скас");

  const ensureSalesRangeDefaults = () => {
    if (!salesRangeFrom || !salesRangeTo) return;
    if (salesRangeFrom.value && salesRangeTo.value) return;

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29);

    salesRangeFrom.value = formatDateInputValue(start);
    salesRangeTo.value = formatDateInputValue(now);
  };

  const getSalesOrdersByRange = (fromInclusive, toExclusive) => {
    return orders.filter((order) => {
      if (isCanceledOrder(order)) return false;
      const timestamp = parseOrderTimestamp(order);
      if (!Number.isFinite(timestamp)) return false;
      return timestamp >= fromInclusive && timestamp < toExclusive;
    });
  };

  const renderSalesTopProducts = (topProducts) => {
    if (!salesTopProductsBody) return;

    salesTopProductsBody.innerHTML = "";
    if (!topProducts.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      row.innerHTML = '<td colspan="2">За обраний період продажів не знайдено.</td>';
      salesTopProductsBody.append(row);
      return;
    }

    topProducts.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.name}</td>
        <td>${formatNumber(item.qty)}</td>
      `;
      salesTopProductsBody.append(row);
    });
  };

  const renderSalesStatsByRange = (fromValue, toValue) => {
    if (!salesRevenue || !salesAverageCheck || !salesOrdersCount || !salesRangeResult) return;

    const fromDate = new Date(`${fromValue}T00:00:00`);
    const toDate = new Date(`${toValue}T00:00:00`);

    if (toDate.getTime() < fromDate.getTime()) {
      salesRangeResult.textContent = "Дата завершення має бути не раніше за дату початку.";
      salesRangeResult.classList.add("error");
      salesRevenue.textContent = `0 ${getCurrencyLabel(getCurrentCurrency())}`;
      salesAverageCheck.textContent = `0 ${getCurrencyLabel(getCurrentCurrency())}`;
      salesOrdersCount.textContent = "0";
      renderSalesTopProducts([]);
      return;
    }

    const fromTime = fromDate.getTime();
    const toTime = addDays(toDate.getTime(), 1);
    const salesOrders = getSalesOrdersByRange(fromTime, toTime);
    const totalRevenue = salesOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const ordersCount = salesOrders.length;
    const averageCheck = ordersCount ? totalRevenue / ordersCount : 0;

    const topProductsMap = new Map();
    salesOrders.forEach((order) => {
      order.items.forEach((item) => {
        const qty = Number.isFinite(Number(item.qty)) ? Math.max(1, Number(item.qty)) : 1;
        const key = `${String(item.sku || "").trim()}|${String(item.name || "Без назви").trim()}`;
        const current = topProductsMap.get(key) || {
          name: String(item.name || "Без назви").trim(),
          qty: 0
        };
        current.qty += qty;
        topProductsMap.set(key, current);
      });
    });

    const topProducts = Array.from(topProductsMap.values())
      .sort((left, right) => {
        if (right.qty !== left.qty) return right.qty - left.qty;
        return left.name.localeCompare(right.name, "uk");
      })
      .slice(0, 5);

    salesRevenue.textContent = `${formatNumber(Math.round(totalRevenue))} ${getCurrencyLabel(getCurrentCurrency())}`;
    salesAverageCheck.textContent = `${formatNumber(Math.round(averageCheck))} ${getCurrencyLabel(getCurrentCurrency())}`;
    salesOrdersCount.textContent = formatNumber(ordersCount);
    salesRangeResult.classList.remove("error");
    salesRangeResult.textContent = `Період ${fromValue} - ${toValue}: ${formatNumber(ordersCount)} ${formatOrdersLabel(ordersCount)}.`;

    renderSalesTopProducts(topProducts);
  };

  const renderSalesFromForm = () => {
    if (!salesRangeFrom || !salesRangeTo || !salesRangeResult) return;

    const fromValue = salesRangeFrom.value;
    const toValue = salesRangeTo.value;

    if (!fromValue || !toValue) {
      salesRangeResult.textContent = "Оберіть дату початку та дату завершення.";
      salesRangeResult.classList.add("error");
      renderSalesTopProducts([]);
      return;
    }

    renderSalesStatsByRange(fromValue, toValue);
  };

  const BILLING_PLANS = [
    {
      id: "starter",
      name: "Старт",
      price: 109,
      periodMonths: 1,
      description: "Базовий план для запуску невеликого магазину.",
      includes: [
        "До 15 товарів",
        "До 3 фото на товар (макс. 2 МБ кожне)",
        "До 3 категорій товарів",
        "Онлайн-оплата",
        "7-денний тестовий період з повним доступом до можливостей \"Про\"",
        "Підтримка у Telegram-чаті"
      ],
      excludes: [
        "Промокоди",
        "Статистика продажів і візитів",
        "Telegram-сповіщення",
        "Прибирання водяного знаку \"Створено на Вітрині\"",
        "Власний домен",
        "SEO-налаштування"
      ]
    },
    {
      id: "business",
      name: "Бізнес",
      price: 209,
      periodMonths: 1,
      description: "Оптимальний план для активних продажів.",
      includes: [
        "До 150 товарів",
        "До 6 фото на товар (макс. 2 МБ кожне)",
        "Необмежена кількість категорій",
        "Онлайн-оплата",
        "Промокоди",
        "Статистика продажів і візитів",
        "Telegram-сповіщення про замовлення",
        "Можливість прибрати водяний знак",
        "Базове SEO",
        "7-денний тестовий період",
        "Підтримка у Telegram-чаті"
      ],
      excludes: [
        "Власний домен",
        "Розширене SEO"
      ]
    },
    {
      id: "pro",
      name: "Про",
      price: 449,
      periodMonths: 1,
      description: "Максимальний набір функцій для масштабування.",
      includes: [
        "Необмежена кількість товарів",
        "До 10 фото на товар (макс. 3 МБ кожне)",
        "Необмежена кількість категорій",
        "Онлайн-оплата",
        "Промокоди",
        "Статистика продажів і візитів",
        "Telegram-сповіщення про замовлення",
        "Водяний знак прибрано",
        "Власний домен",
        "Розширене SEO-налаштування",
        "7-денний тестовий період",
        "Підтримка у Telegram-чаті"
      ],
      excludes: []
    }
  ];

  const readBilling = () => {
    try {
      const raw = localStorage.getItem(BILLING_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") {
        return {
          currentPlanId: "",
          validUntil: "",
          trial: false,
          trialStartedAt: "",
          payments: []
        };
      }

      const payments = Array.isArray(parsed.payments)
        ? parsed.payments.filter((payment) => payment && typeof payment === "object")
        : [];

      return {
        currentPlanId: String(parsed.currentPlanId || ""),
        validUntil: String(parsed.validUntil || ""),
        trial: Boolean(parsed.trial),
        trialStartedAt: String(parsed.trialStartedAt || ""),
        payments
      };
    } catch {
      return {
        currentPlanId: "",
        validUntil: "",
        trial: false,
        trialStartedAt: "",
        payments: []
      };
    }
  };

  const saveBilling = (billing) => {
    localStorage.setItem(BILLING_KEY, JSON.stringify(billing));
  };

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const TRIAL_PLAN_ID = "pro";
  const TRIAL_DAYS = 7;

  const parseBillingValidUntil = (billing) => {
    const date = new Date(billing?.validUntil || "");
    return Number.isFinite(date.getTime()) ? date : null;
  };

  const isSubscriptionActive = () => {
    const until = parseBillingValidUntil(readBilling());
    return !!until && until.getTime() > Date.now();
  };

  // Expired = there was a plan/trial period (validUntil set) that has now passed.
  const isSubscriptionExpired = () => {
    const until = parseBillingValidUntil(readBilling());
    return !!until && until.getTime() <= Date.now();
  };

  const getTrialDaysLeft = () => {
    const billing = readBilling();
    if (!billing.trial) return 0;
    const until = parseBillingValidUntil(billing);
    if (!until) return 0;
    const diff = until.getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / MS_PER_DAY) : 0;
  };

  // Grants a one-time 7-day Pro trial to brand-new accounts. Remote billing is
  // hydrated into localStorage by firebase-sync before this runs, so existing
  // paid/trial accounts (which carry validUntil / payments) are never reset.
  const ensureTrialInitialized = () => {
    const billing = readBilling();
    const hasHistory =
      Boolean(billing.trialStartedAt) ||
      Boolean(billing.currentPlanId) ||
      Boolean(parseBillingValidUntil(billing)) ||
      billing.payments.length > 0;
    if (hasHistory) return;

    const now = new Date();
    const until = new Date(now.getTime() + TRIAL_DAYS * MS_PER_DAY);
    saveBilling({
      currentPlanId: TRIAL_PLAN_ID,
      validUntil: until.toISOString(),
      trial: true,
      trialStartedAt: now.toISOString(),
      payments: []
    });
  };

  const getPhotoPolicyByPlan = () => {
    const billing = readBilling();
    const planId = String(billing?.currentPlanId || "").trim().toLowerCase();

    if (planId === "pro") {
      return {
        planId: "pro",
        planName: "Про",
        maxPhotos: 10,
        maxUploadBytes: 3 * 1024 * 1024,
        targetStoredBytes: 90 * 1024,
        maxDimension: 1800
      };
    }

    if (planId === "business") {
      return {
        planId: "business",
        planName: "Бізнес",
        maxPhotos: 6,
        maxUploadBytes: 2 * 1024 * 1024,
        targetStoredBytes: 110 * 1024,
        maxDimension: 1600
      };
    }

    return {
      planId: "starter",
      planName: "Старт",
      maxPhotos: 3,
      maxUploadBytes: 2 * 1024 * 1024,
      targetStoredBytes: 120 * 1024,
      maxDimension: 1400
    };
  };

  const PLAN_CAPABILITIES = {
    starter: {
      planId: "starter",
      planName: "Старт",
      maxProducts: 15,
      maxCategories: 3,
      maxPhotos: 3,
      promoCodes: false,
      statistics: false,
      telegramNotifications: false,
      removeWatermark: false,
      customDomain: false,
      seo: "none"
    },
    business: {
      planId: "business",
      planName: "Бізнес",
      maxProducts: 150,
      maxCategories: Infinity,
      maxPhotos: 6,
      promoCodes: true,
      statistics: true,
      telegramNotifications: true,
      removeWatermark: true,
      customDomain: false,
      seo: "basic"
    },
    pro: {
      planId: "pro",
      planName: "Про",
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 10,
      promoCodes: true,
      statistics: true,
      telegramNotifications: true,
      removeWatermark: true,
      customDomain: true,
      seo: "advanced"
    }
  };

  // Capabilities when the trial/subscription has expired: everything locked
  // until the user pays for any plan.
  const EXPIRED_CAPABILITIES = {
    planId: "expired",
    planName: "Не активний",
    maxProducts: 0,
    maxCategories: 0,
    maxPhotos: 0,
    promoCodes: false,
    statistics: false,
    telegramNotifications: false,
    removeWatermark: false,
    customDomain: false,
    seo: "none"
  };

  const getPlanCapabilities = () => {
    if (isSubscriptionExpired()) {
      return EXPIRED_CAPABILITIES;
    }
    const billing = readBilling();
    const planId = String(billing?.currentPlanId || "").trim().toLowerCase();
    return PLAN_CAPABILITIES[planId] || PLAN_CAPABILITIES.starter;
  };

  // Sections that get locked when the subscription/trial has expired (all except billing).
  const ALL_LOCKABLE_SECTIONS = [
    "home",
    "orders",
    "products",
    "categories",
    "stock",
    "promocodes",
    "sales",
    "views",
    "settings",
    "notifications",
    "payments",
    "shipping",
    "domain"
  ];

  // Maps a locked section id to the minimum plan name required to unlock it.
  const SECTION_PLAN_REQUIREMENT = {
    promocodes: "Бізнес",
    sales: "Бізнес",
    views: "Бізнес",
    notifications: "Бізнес",
    domain: "Про"
  };

  const getLockedSections = () => {
    if (isSubscriptionExpired()) {
      return new Set(ALL_LOCKABLE_SECTIONS);
    }
    const caps = getPlanCapabilities();
    const locked = new Set();
    if (!caps.promoCodes) locked.add("promocodes");
    if (!caps.statistics) {
      locked.add("sales");
      locked.add("views");
    }
    if (!caps.telegramNotifications) locked.add("notifications");
    if (!caps.customDomain) locked.add("domain");
    return locked;
  };

  const isSectionLocked = (sectionId) => getLockedSections().has(sectionId);

  const refreshPlanLocks = () => {
    const locked = getLockedSections();
    document.querySelectorAll("[data-section]").forEach((item) => {
      const sectionId = item.dataset.section;
      const isLocked = locked.has(sectionId);
      item.classList.toggle("plan-locked", isLocked);
      let badge = item.querySelector(".plan-lock-badge");
      if (isLocked) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "plan-lock-badge";
          badge.setAttribute("aria-hidden", "true");
          badge.innerHTML = '<svg class="plan-lock-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="5" y="10" width="14" height="10" rx="3" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/><path d="M12 16.2v1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
          item.append(badge);
        }
        item.setAttribute("aria-disabled", "true");
        const requiredPlan = SECTION_PLAN_REQUIREMENT[sectionId];
        if (requiredPlan) {
          item.title = `Доступно на тарифі «${requiredPlan}»`;
        }
      } else {
        if (badge) badge.remove();
        item.removeAttribute("aria-disabled");
        item.removeAttribute("title");
      }
    });
  };

  // Enables the "hide watermark" toggle only for plans that allow it
  // (Business/Pro). On other plans the toggle is forced off and disabled.
  const syncWatermarkControl = () => {
    if (!hideWatermarkEnabled) return;
    const canRemove = Boolean(getPlanCapabilities().removeWatermark);
    hideWatermarkEnabled.disabled = !canRemove;
    if (watermarkFieldset) {
      watermarkFieldset.classList.toggle("plan-locked-field", !canRemove);
    }
    if (!canRemove) {
      hideWatermarkEnabled.checked = false;
    }
    if (watermarkPlanNote) {
      watermarkPlanNote.textContent = canRemove
        ? "Увімкніть, щоб прибрати водяний знак «Створено на Вітрина» з вашого магазину."
        : "Доступно на тарифах «Бізнес» та «Про». На інших тарифах водяний знак показується завжди.";
    }
  };

  const formatDateLong = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const renderBillingSection = () => {
    const billing = readBilling();
    const currentPlan = BILLING_PLANS.find((plan) => plan.id === billing.currentPlanId) || null;
    const hasActiveSubscription = isSubscriptionActive();

    if (!hasActiveSubscription) {
      void reconcileTariffInvoicesForCurrentStore();
    }

    if (billingCurrentPlanName) {
      const trialLabel = billing.trial && hasActiveSubscription ? " (пробний)" : "";
      billingCurrentPlanName.textContent = hasActiveSubscription
        ? (currentPlan ? `${currentPlan.name}${trialLabel}` : (billing.trial ? `Про${trialLabel}` : "Прострочено"))
        : "Прострочено";
    }

    if (billingValidUntil) {
      billingValidUntil.textContent = formatDateLong(billing.validUntil);
    }

    if (billingTrialBanner) {
      const paymentStatus = String(new URLSearchParams(window.location.search).get("payment") || "").trim().toLowerCase();
      if (paymentStatus === "success") {
        void reconcileTariffInvoicesForCurrentStore();
        billingTrialBanner.hidden = false;
        billingTrialBanner.className = "billing-trial-banner active";
        billingTrialBanner.innerHTML =
          "<strong>Оплату отримано.</strong> Тариф оновлюється, зачекайте кілька секунд і оновіть сторінку.";
      } else if (paymentStatus === "fail") {
        billingTrialBanner.hidden = false;
        billingTrialBanner.className = "billing-trial-banner expired";
        billingTrialBanner.innerHTML =
          "<strong>Оплата не завершена.</strong> Спробуйте ще раз або оберіть інший спосіб оплати.";
      } else if (isSubscriptionExpired()) {
        billingTrialBanner.hidden = false;
        billingTrialBanner.className = "billing-trial-banner expired";
        billingTrialBanner.innerHTML =
          "<strong>Доступ обмежено.</strong> Пробний період завершився. Оплатіть будь-який тариф нижче, щоб розблокувати всі функції магазину.";
      } else if (billing.trial && isSubscriptionActive()) {
        const daysLeft = getTrialDaysLeft();
        const daysWord = daysLeft === 1 ? "день" : daysLeft >= 2 && daysLeft <= 4 ? "дні" : "днів";
        billingTrialBanner.hidden = false;
        billingTrialBanner.className = "billing-trial-banner active";
        billingTrialBanner.innerHTML =
          `<strong>Пробний період «Про».</strong> Залишилось ${daysLeft} ${daysWord} (до ${formatDateLong(billing.validUntil)}). Оберіть тариф, щоб зберегти доступ після завершення.`;
      } else {
        billingTrialBanner.hidden = true;
        billingTrialBanner.innerHTML = "";
      }
    }

    if (billingPlansGrid) {
      billingPlansGrid.innerHTML = "";
      BILLING_PLANS.forEach((plan) => {
        const includeItems = (plan.includes || []).map((item) => `<li>${item}</li>`).join("");
        const excludeItems = (plan.excludes || []).length
          ? plan.excludes.map((item) => `<li>${item}</li>`).join("")
          : "<li>Обмежень немає.</li>";

        const card = document.createElement("article");
        card.className = `billing-plan-card ${currentPlan?.id === plan.id ? "current" : ""}`;
        card.innerHTML = `
          <div class="billing-plan-head">
            <h3 class="billing-plan-name">${plan.name}</h3>
            ${currentPlan?.id === plan.id ? '<span class="billing-badge">Поточний</span>' : ""}
          </div>
          <p class="billing-plan-price">${formatNumber(plan.price)} грн / ${plan.periodMonths} міс.</p>
          <p class="billing-plan-desc">${plan.description}</p>
          <div class="billing-plan-accordions">
            <details class="billing-plan-accordion">
              <summary>Що входить</summary>
              <ul>${includeItems}</ul>
            </details>
            <details class="billing-plan-accordion billing-plan-accordion-muted">
              <summary>Що не входить</summary>
              <ul>${excludeItems}</ul>
            </details>
          </div>
          <button type="button" class="action-btn billing-pay-btn" data-plan-id="${plan.id}">Оплатити</button>
        `;
        billingPlansGrid.append(card);
      });
    }

    if (billingHistoryBody) {
      billingHistoryBody.innerHTML = "";

      if (!billing.payments.length) {
        const row = document.createElement("tr");
        row.className = "empty-row";
        row.innerHTML = '<td colspan="5">Оплат ще немає.</td>';
        billingHistoryBody.append(row);
      } else {
        billing.payments.forEach((payment) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${formatDateLong(payment.paidAt)}</td>
            <td>${String(payment.planName || "-")}</td>
            <td>${Number(payment.periodMonths) || 1} міс.</td>
            <td>${formatNumber(Number(payment.amount) || 0)} грн</td>
            <td><span class="status paid">Оплачено</span></td>
          `;
          billingHistoryBody.append(row);
        });
      }
    }
  };

  const activatePlanPayment = (planId) => {
    const selectedPlan = BILLING_PLANS.find((plan) => plan.id === planId);
    if (!selectedPlan) return;

    const confirmed = window.confirm(
      `Переходимо до оплати Monobank: тариф ${selectedPlan.name}, ${selectedPlan.periodMonths} міс., ${formatNumber(selectedPlan.price)} грн. Продовжити?`
    );
    if (!confirmed) return;

    const authState = readAuthState();
    const storeContext = getCurrentStoreContext();
    const storeId = sanitizeStoreId(authState?.storeId || storeContext?.subdomain || "") || "default-store";
    if (!storeId || storeId === "default-store") {
      window.alert("Не вдалося визначити магазин для оплати. Увійдіть повторно в адмінку.");
      return;
    }

    const userId = String(authState?.phone || authState?.storeId || storeId).trim();
    const createInvoiceUrl = "https://us-central1-lavka-shop.cloudfunctions.net/createTariffInvoice";

    const payButtons = billingPlansGrid
      ? Array.from(billingPlansGrid.querySelectorAll(".billing-pay-btn"))
      : [];

    payButtons.forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });

    fetch(createInvoiceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tariffId: selectedPlan.id,
        storeId,
        userId,
        returnBaseUrl: window.location.origin
      })
    })
      .then(async (response) => {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || !payload?.ok || !payload?.pageUrl) {
          const errorCode = String(payload?.error || "payment-create-failed");
          throw new Error(errorCode);
        }

        window.location.href = String(payload.pageUrl);
      })
      .catch((error) => {
        console.error("createTariffInvoice error:", error);
        const code = String(error?.message || "payment-create-failed");
        if (code === "mono-rate-limit") {
          window.alert("Забагато запитів до платіжного сервісу. Спробуйте ще раз за хвилину.");
          return;
        }
        if (code === "mono-invalid-token") {
          window.alert("Платіжний сервіс тимчасово недоступний. Зверніться до підтримки.");
          return;
        }
        window.alert("Не вдалося створити рахунок для оплати. Спробуйте ще раз.");
      })
      .finally(() => {
        payButtons.forEach((button) => {
          button.disabled = false;
          button.setAttribute("aria-disabled", "false");
        });
      });
  };

  const generatePromoCode = (charset = "letters", length = 8) => {
    const source = charset === "digits" ? "0123456789" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let index = 0; index < length; index += 1) {
      result += source[Math.floor(Math.random() * source.length)];
    }
    return result;
  };

  const normalizePromoCode = (promoCode) => {
    const charset = promoCode?.charset === "digits" ? "digits" : "letters";
    const discountType = promoCode?.discountType === "uah" ? "uah" : "percent";
    const discountValue = Number.parseFloat(promoCode?.discountValue);
    const minOrderAmount = Number.parseFloat(promoCode?.minOrderAmount);
    const maxDiscountPerOrder = Number.parseFloat(promoCode?.maxDiscountPerOrder);
    const maxUsesPerClient = Number.parseInt(promoCode?.maxUsesPerClient, 10);
    const maxUsesTotal = Number.parseInt(promoCode?.maxUsesTotal, 10);
    const usedTotal = Number.parseInt(promoCode?.usedTotal, 10);

    return {
      id: String(promoCode?.id || `promo-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      code: String(promoCode?.code || "").trim().toUpperCase(),
      charset,
      discountType,
      discountValue: Number.isFinite(discountValue) ? Math.max(0, discountValue) : 0,
      minOrderAmount: Number.isFinite(minOrderAmount) ? Math.max(0, minOrderAmount) : null,
      maxDiscountPerOrder: Number.isFinite(maxDiscountPerOrder) ? Math.max(0, maxDiscountPerOrder) : null,
      maxUsesPerClient: Number.isFinite(maxUsesPerClient) ? Math.max(1, maxUsesPerClient) : 1,
      maxUsesTotal: Number.isFinite(maxUsesTotal) ? Math.max(1, maxUsesTotal) : 1,
      usedTotal: Number.isFinite(usedTotal) ? Math.max(0, usedTotal) : 0,
      managerComment: String(promoCode?.managerComment || "").trim(),
      createdAt: String(promoCode?.createdAt || new Date().toISOString())
    };
  };

  const extractProductsFromTable = () => {
    if (!productsTableBody) return [];
    const rows = Array.from(productsTableBody.querySelectorAll("tr"));
    return rows
      .map((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 5) return null;

        const hasSelectionColumn = Boolean(cells[0]?.querySelector('input[type="checkbox"]'));
        const offset = hasSelectionColumn ? 1 : 0;
        const hasDiscountColumn = cells.length >= offset + 9;
        const photoCount = hasDiscountColumn
          ? Number.parseInt(cells[offset + 5].textContent, 10) || 0
          : Number.parseInt(cells[offset + 4]?.textContent || "0", 10) || 0;
        const description = hasDiscountColumn ? cells[offset + 6].textContent.trim() : cells[offset + 5]?.textContent.trim() || "";
        const visibilityCellIndex = hasDiscountColumn ? offset + 7 : offset + 6;
        const visibilityText = visibilityCellIndex >= 0 ? cells[visibilityCellIndex].textContent.trim().toLowerCase() : "";
        const visible = visibilityCellIndex >= 0 ? !(visibilityText.includes("прихован") || visibilityText.includes("скрит")) : true;

        const categoryCell = cells[offset + 2];
        const categoriesFromPills = Array.from(categoryCell.querySelectorAll(".product-category-pill")).map((pill) => pill.textContent.trim()).filter(Boolean);
        const rawCategoryText = categoryCell.textContent.trim();
        const categories = categoriesFromPills.length
          ? categoriesFromPills
          : rawCategoryText
            ? rawCategoryText.split(",").map((item) => item.trim()).filter(Boolean)
            : [];

        const discountText = hasDiscountColumn ? cells[offset + 4].textContent.trim().toLowerCase() : "";
        let discount = null;
        if (discountText && !discountText.includes("без")) {
          if (discountText.includes("%")) {
            discount = {
              type: "percent",
              value: Math.max(0, Number.parseFloat(discountText) || 0)
            };
          } else {
            discount = {
              type: "uah",
              value: Math.max(0, Number.parseFloat(discountText) || 0)
            };
          }
        }

        return {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          sku: cells[offset].textContent.trim(),
          name: cells[offset + 1].textContent.trim(),
          category: categories[0] || "",
          categories,
          price: Number.parseInt(cells[offset + 3].textContent, 10) || 0,
          stock: 0,
          discount,
          visible,
          description,
          photos: Array.from({ length: photoCount }, (_, index) => ({
            name: `photo-${index + 1}`,
            size: 0,
            type: "image/*"
          }))
        };
      })
      .filter(Boolean);
  };

  const DEMO_PRODUCT_SKUS = new Set([
    "LK-CUP-001",
    "LK-PLT-002",
    "LK-VAS-003"
  ]);

  const DEMO_PRODUCT_NAMES = new Set([
    "чашка \"терра\"",
    "тарілка \"хвиля\"",
    "ваза \"гай\""
  ]);

  const DEMO_CATEGORY_NAMES = new Set([
    "чашки",
    "тарілки",
    "вази"
  ]);

  const DEMO_ORDER_IDS = new Set([
    "#1024",
    "#1023",
    "#1022"
  ]);

  const DEMO_PROMO_CODES = new Set([
    "SUMMER10",
    "WELCOME",
    "2026"
  ]);

  const isDemoProduct = (product) => {
    const sku = String(product?.sku || "").trim().toUpperCase();
    const name = String(product?.name || "").trim().toLowerCase();
    return DEMO_PRODUCT_SKUS.has(sku) || DEMO_PRODUCT_NAMES.has(name);
  };

  const isDemoOrder = (order) => {
    const orderId = String(order?.id || "").trim();
    if (DEMO_ORDER_IDS.has(orderId)) return true;

    const items = Array.isArray(order?.items) ? order.items : [];
    return items.some((item) => {
      const name = String(item?.name || "").trim().toLowerCase();
      return DEMO_PRODUCT_NAMES.has(name);
    });
  };

  const isDemoPromoCode = (promoCode) => {
    const code = String(promoCode?.code || "").trim().toUpperCase();
    const id = String(promoCode?.id || "").trim().toLowerCase();
    return DEMO_PROMO_CODES.has(code) || id.startsWith("promo-default-");
  };

  const isDemoCategory = (category) => {
    const name = String(category?.name || "").trim().toLowerCase();
    return DEMO_CATEGORY_NAMES.has(name);
  };

  const normalizeCurrencyCode = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "usd") return "usd";
    if (normalized === "eur") return "eur";
    return "uah";
  };

  const getCurrencyLabel = (code) => {
    if (code === "usd") return "USD";
    if (code === "eur") return "EUR";
    return "грн";
  };

  const getCurrentCurrency = () => normalizeCurrencyCode(readSettings()?.currency || "uah");

  const formatPrice = (value) => {
    const amount = Math.round((Math.max(0, Number(value) || 0)) * 100) / 100;
    return `${amount} ${getCurrencyLabel(getCurrentCurrency())}`;
  };

  const getOrderStatusClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("нов")) return "new";
    if (normalized.includes("очіку")) return "wait";
    if (normalized.includes("оброб")) return "progress";
    if (normalized.includes("відправ") || normalized.includes("достав")) return "done";
    if (normalized.includes("скас")) return "cancel";
    return "delivery";
  };

  const getPaymentStatusClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("не оплач") || normalized.includes("не сплач")) return "unpaid";
    if (normalized.includes("оплачено") && normalized.includes("част")) return "partial";
    if (normalized.includes("оплачено")) return "paid";
    if (normalized.includes("повер")) return "refund";
    return "unpaid";
  };

  const normalizeOrderItem = (item) => ({
    photo: String(item?.photo || "https://picsum.photos/seed/lavka-order-item/80/80"),
    sku: String(item?.sku || "-"),
    name: String(item?.name || "Без назви"),
    price: Number.isFinite(Number(item?.price)) ? Math.max(0, Number(item.price)) : 0,
    qty: Number.isFinite(Number(item?.qty)) ? Math.max(1, Number(item.qty)) : 1,
    size: String(item?.size || "").trim().toUpperCase()
  });

  const normalizeOrder = (order) => {
    const items = Array.isArray(order?.items) ? order.items.map((item) => normalizeOrderItem(item)) : [];
    const total = Number.isFinite(Number(order?.total)) ? Math.max(0, Number(order.total)) : 0;
    const discount = Number.isFinite(Number(order?.discount)) ? Math.max(0, Number(order.discount)) : 0;
    const normalizedPromoCode = String(order?.promoCode || "").trim();
    const normalizedPromoDiscountValue = Number(order?.promoDiscount);
    return {
      id: String(order?.id || `#${Date.now()}`),
      createdAt: String(order?.createdAt || new Date().toISOString()),
      updatedAt: String(order?.updatedAt || order?.createdAt || new Date().toISOString()),
      customerName: String(order?.customerName || "Невідомий клієнт"),
      customerPhone: String(order?.customerPhone || "-") ,
      deliveryMethod: String(order?.deliveryMethod || "-") ,
      deliveryAddress: String(order?.deliveryAddress || "-") ,
      comment: String(order?.comment || "Коментар відсутній"),
      subscriberId: String(order?.subscriberId || order?.visitorId || "").trim(),
      managerComment: String(order?.managerComment || ""),
      status: String(order?.status || "Очікує"),
      paymentStatus: String(order?.paymentStatus || "Не оплачено"),
      paymentMethodId: String(order?.paymentMethodId || "").trim(),
      paymentMethod: String(order?.paymentMethod || "").trim(),
      monoInvoiceId: String(order?.monoInvoiceId || "").trim(),
      monoStatus: String(order?.monoStatus || "").trim(),
      monoPageUrl: String(order?.monoPageUrl || "").trim(),
      liqpayInvoiceId: String(order?.liqpayInvoiceId || "").trim(),
      liqpayStatus: String(order?.liqpayStatus || "").trim(),
      liqpayPageUrl: String(order?.liqpayPageUrl || "").trim(),
      trackingNumber: String(order?.trackingNumber || ""),
      total,
      discount,
      promoCode: normalizedPromoCode,
      promoDiscount: Number.isFinite(normalizedPromoDiscountValue) ? Math.max(0, normalizedPromoDiscountValue) : 0,
      inventoryApplied: Boolean(order?.inventoryApplied),
      items
    };
  };

  const selectedOrderIds = new Set();
  let lastVisibleOrderIds = [];

  const updateOrdersNewBadge = () => {
    if (!ordersNewBadge) return;
    const newCount = orders.reduce((count, order) => {
      const status = String(order?.status || "").trim().toLowerCase();
      return status.includes("нов") ? count + 1 : count;
    }, 0);
    if (newCount > 0) {
      ordersNewBadge.textContent = newCount > 99 ? "99+" : String(newCount);
      ordersNewBadge.hidden = false;
    } else {
      ordersNewBadge.textContent = "0";
      ordersNewBadge.hidden = true;
    }
  };

  const isSameCalendarDay = (isoLikeValue, dateValue) => {
    const parsed = new Date(isoLikeValue);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getFullYear() === dateValue.getFullYear()
      && parsed.getMonth() === dateValue.getMonth()
      && parsed.getDate() === dateValue.getDate();
  };

  const updateOrdersKpiCards = (allOrders) => {
    if (!ordersKpiCards.length) return;
    const now = new Date();
    const list = Array.isArray(allOrders) ? allOrders : [];

    const newTodayCount = list.reduce((count, order) => {
      const status = String(order?.status || "").trim().toLowerCase();
      const createdSource = order?.createdAt || order?.updatedAt;
      return status.includes("нов") && isSameCalendarDay(createdSource, now) ? count + 1 : count;
    }, 0);

    const processingCount = list.reduce((count, order) => {
      const status = String(order?.status || "").trim().toLowerCase();
      return status.includes("оброб") ? count + 1 : count;
    }, 0);

    const shippedCount = list.reduce((count, order) => {
      const status = String(order?.status || "").trim().toLowerCase();
      return status.includes("відправ") ? count + 1 : count;
    }, 0);

    if (ordersKpiNewToday) {
      ordersKpiNewToday.textContent = String(newTodayCount);
    }
    if (ordersKpiProcessing) {
      ordersKpiProcessing.textContent = String(processingCount);
    }
    if (ordersKpiShipped) {
      ordersKpiShipped.textContent = String(shippedCount);
    }

    const activeMap = {
      "new-today": currentOrderStatusFilter === "Нове",
      processing: currentOrderStatusFilter === "В обробці",
      shipped: currentOrderStatusFilter === "Відправлено"
    };

    ordersKpiCards.forEach((card) => {
      const key = String(card.dataset.ordersKpiFilter || "");
      const isActive = Boolean(activeMap[key]);
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const updateOrdersBulkUI = () => {
    const selectedCount = selectedOrderIds.size;
    if (ordersBulkBar) {
      ordersBulkBar.hidden = selectedCount === 0;
    }
    if (ordersBulkCount) {
      ordersBulkCount.textContent = `Обрано: ${selectedCount}`;
    }
    if (ordersSelectAll) {
      const visibleCount = lastVisibleOrderIds.length;
      const visibleSelected = lastVisibleOrderIds.filter((id) => selectedOrderIds.has(id)).length;
      ordersSelectAll.checked = visibleCount > 0 && visibleSelected === visibleCount;
      ordersSelectAll.indeterminate = visibleSelected > 0 && visibleSelected < visibleCount;
    }
  };

  const renderOrdersTable = (orders) => {
    if (!ordersTableBody) return;
    updateOrdersKpiCards(orders);
    ordersTableBody.innerHTML = "";
    const query = String(currentOrdersSearch || "").trim().toLowerCase();
    const searchedOrders = !query
      ? orders
      : orders.filter((order) => {
          const itemsText = order.items
            .map((item) => `${item.name} ${item.sku}`)
            .join(" ")
            .toLowerCase();

          const searchableValues = [
            String(order.id || "").toLowerCase(),
            String(order.id || "").replace("#", "").toLowerCase(),
            String(order.customerName || "").toLowerCase(),
            String(order.customerPhone || "").toLowerCase(),
            String(order.total || "").toLowerCase(),
            formatPrice(order.total).toLowerCase(),
            itemsText
          ];

          return searchableValues.some((value) => value.includes(query));
        });

    const filteredOrders = searchedOrders.filter((order) => {
      const orderStatusFilter = currentOrderStatusFilter;
      const paymentStatusFilter = currentOrderPaymentFilter;
      const minAmount = currentOrdersAmountFrom;
      const maxAmount = currentOrdersAmountTo;

      if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) {
        return false;
      }

      if (paymentStatusFilter !== "all" && order.paymentStatus !== paymentStatusFilter) {
        return false;
      }

      if (Number.isFinite(minAmount) && order.total < minAmount) {
        return false;
      }

      if (Number.isFinite(maxAmount) && order.total > maxAmount) {
        return false;
      }

      return true;
    });

    if (!filteredOrders.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      row.innerHTML = '<td colspan="9">За вашим запитом замовлень не знайдено.</td>';
      ordersTableBody.append(row);
      lastVisibleOrderIds = [];
      const existingIds = new Set(orders.map((order) => String(order.id || "").trim()));
      Array.from(selectedOrderIds).forEach((id) => {
        if (!existingIds.has(id)) selectedOrderIds.delete(id);
      });
      updateOrdersBulkUI();
      updateOrdersNewBadge();
      return;
    }

    const existingIds = new Set(orders.map((order) => String(order.id || "").trim()));
    Array.from(selectedOrderIds).forEach((id) => {
      if (!existingIds.has(id)) selectedOrderIds.delete(id);
    });
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
    if (currentOrdersPage > totalPages) {
      currentOrdersPage = totalPages;
    }
    const startIndex = (currentOrdersPage - 1) * ORDERS_PER_PAGE;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE);

    lastVisibleOrderIds = paginatedOrders.map((order) => String(order.id || "").trim());
    renderOrdersPagination(filteredOrders.length);

    paginatedOrders.forEach((order) => {
      const row = document.createElement("tr");
      const firstItem = order.items[0];
      const shortProductText = firstItem
        ? `${firstItem.name} x${firstItem.qty}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}`
        : "-";
      const statusClass = getOrderStatusClass(order.status);
      const paymentStatusClass = getPaymentStatusClass(order.paymentStatus);
      const createdAtLabel = formatDateTime(order.createdAt || order.updatedAt);
      const isSelected = selectedOrderIds.has(String(order.id || "").trim());

      row.innerHTML = `
        <td class="orders-select-cell"><input type="checkbox" class="order-select" data-order-id="${order.id}"${isSelected ? " checked" : ""} aria-label="Обрати замовлення ${order.id}"></td>
        <td>${order.id}</td>
        <td>${createdAtLabel}</td>
        <td>${order.customerName}</td>
        <td>${shortProductText}</td>
        <td>${formatPrice(order.total)}</td>
        <td><span class="status ${statusClass}">${order.status}</span></td>
        <td><span class="status ${paymentStatusClass}">${order.paymentStatus}</span></td>
        <td>
          <div class="order-actions">
            <button type="button" class="mini-btn order-open-btn" data-order-id="${order.id}">Деталі</button>
            <button
              type="button"
              class="mini-btn order-delete-btn"
              data-order-id="${order.id}"
              title="Видалити замовлення"
              aria-label="Видалити замовлення"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </td>
      `;

      ordersTableBody.append(row);
    });

    updateOrdersBulkUI();
    updateOrdersNewBadge();
  };

  const renderOrdersPagination = (totalItems) => {
    if (!ordersPagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / ORDERS_PER_PAGE));
    if (currentOrdersPage > totalPages) {
      currentOrdersPage = totalPages;
    }

    ordersPagination.innerHTML = "";
    ordersPagination.hidden = totalItems <= ORDERS_PER_PAGE;
    if (ordersPagination.hidden) return;

    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.className = "products-page-btn";
    previousButton.textContent = "‹";
    previousButton.dataset.page = String(currentOrdersPage - 1);
    previousButton.disabled = currentOrdersPage === 1;
    ordersPagination.append(previousButton);

    for (let page = 1; page <= totalPages; page += 1) {
      const pageButton = document.createElement("button");
      pageButton.type = "button";
      pageButton.className = "products-page-btn";
      if (page === currentOrdersPage) {
        pageButton.classList.add("active");
      }
      pageButton.textContent = String(page);
      pageButton.dataset.page = String(page);
      ordersPagination.append(pageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "products-page-btn";
    nextButton.textContent = "›";
    nextButton.dataset.page = String(currentOrdersPage + 1);
    nextButton.disabled = currentOrdersPage === totalPages;
    ordersPagination.append(nextButton);
  };

  const formatPromoDiscount = (promoCode) => {
    if (!promoCode || !Number.isFinite(promoCode.discountValue) || promoCode.discountValue <= 0) {
      return "-";
    }
    return promoCode.discountType === "uah"
      ? `${promoCode.discountValue} ${getCurrencyLabel(getCurrentCurrency())}`
      : `${promoCode.discountValue}%`;
  };

  const renderPromoCodesTable = (promoCodes) => {
    if (!promoCodesTableBody) return;
    promoCodesTableBody.innerHTML = "";

    if (!promoCodes.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      row.innerHTML = '<td colspan="8">Промо-коди ще не створені.</td>';
      promoCodesTableBody.append(row);
      return;
    }

    promoCodes.forEach((promoCode) => {
      const row = document.createElement("tr");
      const charsetLabel = promoCode.charset === "digits" ? "Цифри" : "Букви";
      const minOrder = Number.isFinite(promoCode.minOrderAmount) ? `${promoCode.minOrderAmount} ${getCurrencyLabel(getCurrentCurrency())}` : "Без обмежень";
      const maxDiscount = Number.isFinite(promoCode.maxDiscountPerOrder) ? `${promoCode.maxDiscountPerOrder} ${getCurrencyLabel(getCurrentCurrency())}` : "Без ліміту";
      const managerCommentText = promoCode.managerComment || "-";

      row.innerHTML = `
        <td><strong>${promoCode.code}</strong></td>
        <td>${charsetLabel}</td>
        <td>${formatPromoDiscount(promoCode)}</td>
        <td>${minOrder}</td>
        <td>${maxDiscount}</td>
        <td>${promoCode.maxUsesPerClient} / ${promoCode.maxUsesTotal}</td>
        <td>${managerCommentText}</td>
        <td><button type="button" class="mini-btn warn promo-delete-btn" data-promo-id="${promoCode.id}">Видалити</button></td>
      `;

      promoCodesTableBody.append(row);
    });
  };

  const renderStockTable = (products) => {
    if (!stockTableBody) return;
    stockTableBody.innerHTML = "";

    const escapeHtml = (value) =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    if (!products.length) {
      currentStockPage = 1;
      const row = document.createElement("tr");
      row.className = "empty-row";
      row.innerHTML = '<td colspan="6">Товари ще не створені.</td>';
      stockTableBody.append(row);
      renderStockPagination(0);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(products.length / STOCKS_PER_PAGE));
    if (currentStockPage > totalPages) {
      currentStockPage = totalPages;
    }

    const startIndex = (currentStockPage - 1) * STOCKS_PER_PAGE;
    const paginatedProducts = products.slice(startIndex, startIndex + STOCKS_PER_PAGE);

    paginatedProducts.forEach((product) => {
      const row = document.createElement("tr");
      const categoryList = Array.isArray(product.categories) && product.categories.length
        ? product.categories.join(", ")
        : String(product.category || "-");
      const stockValue = getProductTotalStock(product);
      const stockClassName = stockValue <= 1 ? "stock-pill low-stock" : "stock-pill";

      row.innerHTML = `
        <td>${escapeHtml(product.sku)}</td>
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(categoryList)}</td>
        <td>${formatPrice(product.price)}</td>
        <td><span class="${stockClassName}">${stockValue}</span></td>
        <td>
          <button type="button" class="mini-btn stock-edit-btn" data-product-id="${escapeHtml(product.id)}" aria-label="Редагувати залишок ${escapeHtml(product.name)}">
            <span class="stock-edit-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </span>
            Редагувати
          </button>
        </td>
      `;

      stockTableBody.append(row);
    });

    renderStockPagination(products.length);
  };

  const renderStockPagination = (totalItems) => {
    if (!stockPagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / STOCKS_PER_PAGE));
    if (currentStockPage > totalPages) {
      currentStockPage = totalPages;
    }

    stockPagination.innerHTML = "";
    stockPagination.hidden = totalItems <= STOCKS_PER_PAGE;
    if (stockPagination.hidden) return;

    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.className = "products-page-btn";
    previousButton.textContent = "‹";
    previousButton.dataset.page = String(currentStockPage - 1);
    previousButton.disabled = currentStockPage === 1;
    stockPagination.append(previousButton);

    for (let page = 1; page <= totalPages; page += 1) {
      const pageButton = document.createElement("button");
      pageButton.type = "button";
      pageButton.className = "products-page-btn";
      if (page === currentStockPage) {
        pageButton.classList.add("active");
      }
      pageButton.textContent = String(page);
      pageButton.dataset.page = String(page);
      stockPagination.append(pageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "products-page-btn";
    nextButton.textContent = "›";
    nextButton.dataset.page = String(currentStockPage + 1);
    nextButton.disabled = currentStockPage === totalPages;
    stockPagination.append(nextButton);
  };

  const setStockModalOpen = (open) => {
    if (!stockModal) return;
    stockModal.classList.toggle("open", open);
    stockModal.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open && stockSavedMessage) {
      stockSavedMessage.textContent = "";
      stockSavedMessage.classList.remove("error");
    }
    updateModalScrollLock();
  };

  const shouldApplyInventoryForOrder = (order) => {
    const normalizedStatus = String(order?.status || "").toLowerCase();
    return !normalizedStatus.includes("скас");
  };

  const applyInventoryForOrder = (order) => {
    if (!order || order.inventoryApplied || !shouldApplyInventoryForOrder(order)) {
      return { order, applied: false };
    }

    let matchedItemsCount = 0;

    const nextProducts = products.map((product) => ({ ...product }));
    order.items.forEach((item) => {
      const normalizedSku = String(item?.sku || "").trim().toUpperCase();
      const normalizedName = String(item?.name || "").trim().toLowerCase();
      const qty = Number.isFinite(Number(item?.qty)) ? Math.max(1, Number(item.qty)) : 1;

      let targetIndex = -1;
      if (normalizedSku && normalizedSku !== "-") {
        targetIndex = nextProducts.findIndex((product) => String(product.sku || "").trim().toUpperCase() === normalizedSku);
      }

      if (targetIndex < 0 && normalizedName) {
        targetIndex = nextProducts.findIndex((product) => String(product.name || "").trim().toLowerCase() === normalizedName);
      }

      if (targetIndex < 0) {
        return;
      }

      matchedItemsCount += 1;
      const targetProduct = nextProducts[targetIndex];
      const currentStock = getProductTotalStock(targetProduct);

      if (hasSizedStockAccounting(targetProduct)) {
        const sizeStockMap = { ...(targetProduct.sizeStocks || {}) };
        let remainingToSubtract = qty;

        const orderedSizeKey = String(item?.size || "").trim().toUpperCase();
        if (orderedSizeKey && Object.prototype.hasOwnProperty.call(sizeStockMap, orderedSizeKey)) {
          const currentByOrderedSize = Math.max(0, Number.parseInt(sizeStockMap[orderedSizeKey], 10) || 0);
          const subtractByOrderedSize = Math.min(currentByOrderedSize, remainingToSubtract);
          sizeStockMap[orderedSizeKey] = currentByOrderedSize - subtractByOrderedSize;
          remainingToSubtract -= subtractByOrderedSize;
        }

        targetProduct.sizes.forEach((size) => {
          if (remainingToSubtract <= 0) return;
          const key = String(size || "").trim().toUpperCase();
          if (orderedSizeKey && key === orderedSizeKey) return;
          const current = Math.max(0, Number.parseInt(sizeStockMap[key], 10) || 0);
          const subtract = Math.min(current, remainingToSubtract);
          sizeStockMap[key] = current - subtract;
          remainingToSubtract -= subtract;
        });
        nextProducts[targetIndex].sizeStocks = sizeStockMap;
      }

      nextProducts[targetIndex].stock = Math.max(0, currentStock - qty);
      nextProducts[targetIndex].updatedAt = new Date().toISOString();
    });

    if (!matchedItemsCount) {
      return { order, applied: false };
    }

    products = nextProducts;

    return {
      order: {
        ...order,
        inventoryApplied: true
      },
      applied: true
    };
  };

  const applyInventoryForPendingOrders = () => {
    let hasAnyOrderApplied = false;
    orders = orders.map((order) => {
      const result = applyInventoryForOrder(order);
      if (!result.applied) return order;
      hasAnyOrderApplied = true;
      return result.order;
    });

    if (!hasAnyOrderApplied) return;

    saveProducts(products);
    saveOrders(orders);
    renderProductsTable(products);
    renderOrdersTable(orders);
  };

  const restoreInventoryForOrder = (order) => {
    if (!order || !order.inventoryApplied) {
      return { order, restored: false };
    }

    let matchedItemsCount = 0;
    const nextProducts = products.map((product) => ({ ...product }));

    order.items.forEach((item) => {
      const normalizedSku = String(item?.sku || "").trim().toUpperCase();
      const normalizedName = String(item?.name || "").trim().toLowerCase();
      const qty = Number.isFinite(Number(item?.qty)) ? Math.max(1, Number(item.qty)) : 1;

      let targetIndex = -1;
      if (normalizedSku && normalizedSku !== "-") {
        targetIndex = nextProducts.findIndex((product) => String(product.sku || "").trim().toUpperCase() === normalizedSku);
      }
      if (targetIndex < 0 && normalizedName) {
        targetIndex = nextProducts.findIndex((product) => String(product.name || "").trim().toLowerCase() === normalizedName);
      }
      if (targetIndex < 0) return;

      matchedItemsCount += 1;
      const targetProduct = nextProducts[targetIndex];

      if (hasSizedStockAccounting(targetProduct)) {
        const sizeStockMap = { ...(targetProduct.sizeStocks || {}) };
        const orderedSizeKey = String(item?.size || "").trim().toUpperCase();
        if (orderedSizeKey && Object.prototype.hasOwnProperty.call(sizeStockMap, orderedSizeKey)) {
          sizeStockMap[orderedSizeKey] = Math.max(0, (Number.parseInt(sizeStockMap[orderedSizeKey], 10) || 0) + qty);
        }
        nextProducts[targetIndex].sizeStocks = sizeStockMap;
      }

      const currentStock = getProductTotalStock(targetProduct);
      nextProducts[targetIndex].stock = currentStock + qty;
      nextProducts[targetIndex].updatedAt = new Date().toISOString();
    });

    if (!matchedItemsCount) {
      return { order, restored: false };
    }

    products = nextProducts;
    return {
      order: { ...order, inventoryApplied: false },
      restored: true
    };
  };

  const updateModalScrollLock = () => {
    const isProductOpen = Boolean(productModal?.classList.contains("open"));
    const isOrderOpen = Boolean(orderDetailsModal?.classList.contains("open"));
    const isPromoOpen = Boolean(promoCodeModal?.classList.contains("open"));
    const isStockOpen = Boolean(stockModal?.classList.contains("open"));
    document.body.style.overflow = isProductOpen || isOrderOpen || isPromoOpen || isStockOpen ? "hidden" : "";
  };

  const setPromoCodeModalOpen = (open) => {
    if (!promoCodeModal) return;
    promoCodeModal.classList.toggle("open", open);
    promoCodeModal.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open && promoCodeMessage) {
      promoCodeMessage.textContent = "";
      promoCodeMessage.classList.remove("error");
    }
    updateModalScrollLock();
  };

  const setOrderDetailsModalOpen = (open) => {
    if (!orderDetailsModal) return;
    orderDetailsModal.classList.toggle("open", open);
    orderDetailsModal.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open && orderSavedMessage) {
      orderSavedMessage.textContent = "";
      orderSavedMessage.classList.remove("error");
    }
    updateModalScrollLock();
  };

  const fillOrderDetails = (order) => {
    if (!order) return;
    if (orderEditingId) {
      orderEditingId.value = order.id;
    }
    if (orderStatusSelect) {
      orderStatusSelect.value = order.status;
    }
    if (orderTrackingNumber) {
      orderTrackingNumber.value = order.trackingNumber || "";
    }
    if (orderManagerCommentInput) {
      orderManagerCommentInput.value = order.managerComment || "";
    }
    if (orderPaymentStatusSelect) {
      orderPaymentStatusSelect.value = order.paymentStatus || "Не оплачено";
    }
    if (orderClientName) {
      orderClientName.textContent = order.customerName;
    }
    if (orderClientPhone) {
      orderClientPhone.textContent = order.customerPhone;
    }
    if (orderDeliveryMethod) {
      orderDeliveryMethod.textContent = order.deliveryMethod;
    }
    if (orderDeliveryAddress) {
      orderDeliveryAddress.textContent = order.deliveryAddress;
    }
    if (orderTotalAmount) {
      orderTotalAmount.textContent = formatPrice(order.total);
    }
    if (orderDiscountAmount) {
      orderDiscountAmount.textContent = order.discount > 0 ? formatPrice(order.discount) : "Немає";
    }
    if (orderPromoCode) {
      orderPromoCode.textContent = order.promoCode?.trim() || "Немає";
    }
    if (orderPromoDiscount) {
      orderPromoDiscount.textContent = order.promoDiscount > 0 ? formatPrice(order.promoDiscount) : "Немає";
    }
    if (orderPaymentStatus) {
      orderPaymentStatus.textContent = order.paymentStatus || "Не оплачено";
      orderPaymentStatus.className = `status ${getPaymentStatusClass(order.paymentStatus)}`;
    }
    if (orderPaymentMethod) {
      orderPaymentMethod.textContent = String(order.paymentMethod || "").trim() || "Немає";
    }
    if (orderCreatedAt) {
      orderCreatedAt.textContent = formatDateTime(order.createdAt || order.updatedAt);
    }
    if (orderClientComment) {
      orderClientComment.textContent = order.comment || "Коментар відсутній";
    }
    if (orderManagerComment) {
      orderManagerComment.textContent = order.managerComment?.trim() || "Коментар відсутній";
    }
    if (orderItemsTableBody) {
      orderItemsTableBody.innerHTML = "";
      order.items.forEach((item) => {
        const row = document.createElement("tr");
        const size = String(item.size || "").trim();
        row.innerHTML = `
          <td><img class="order-items-thumb" src="${item.photo}" alt="${item.name}"></td>
          <td>${item.sku}</td>
          <td>${item.name}</td>
          <td>${size || "-"}</td>
          <td>${formatPrice(item.price)}</td>
          <td>${item.qty}</td>
        `;
        orderItemsTableBody.append(row);
      });
    }
  };

  const normalizeProduct = (product) => {
    const normalizedCategories = Array.isArray(product?.categories) && product.categories.length
      ? product.categories.map((item) => normalizeCategoryName(item)).filter(Boolean)
      : [normalizeCategoryName(product?.category)].filter(Boolean);

    const discountValue = Number.parseFloat(product?.discount?.value);
    const discountType = product?.discount?.type === "percent" ? "percent" : "uah";
    const normalizedDiscount = Number.isFinite(discountValue) && discountValue > 0
      ? {
          type: discountType,
          value: discountType === "percent"
            ? Math.min(100, discountValue)
            : discountValue
        }
      : null;

    const normalizedPrice = Number.parseFloat(product?.price);
    const fallbackPrice = Number.isFinite(normalizedPrice) && normalizedPrice > 0
      ? Math.round(normalizedPrice * 100) / 100
      : 1;
    const parsedStock = Number.parseInt(product?.stock, 10);
    const normalizedUnit = String(product?.unit || "шт").trim() || "шт";
    const normalizedSizes = Array.isArray(product?.sizes)
      ? product.sizes.map((size) => String(size || "").trim().toUpperCase()).filter(Boolean)
      : [];
    const normalizedSizeStocks = normalizedSizes.reduce((acc, size) => {
      const raw = product?.sizeStocks?.[size];
      const parsed = Number.parseInt(raw, 10);
      acc[size] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      return acc;
    }, {});
    const hasSizes = normalizedSizes.length > 0;
    const sizeBasedStock = normalizedSizes.reduce((sum, size) => sum + (normalizedSizeStocks[size] || 0), 0);
    const isClothing = Boolean(product?.isClothing);

    return {
      ...product,
      category: normalizedCategories[0] || "",
      categories: normalizedCategories,
      unit: normalizedUnit,
      isClothing,
      sizes: normalizedSizes,
      sizeStocks: normalizedSizeStocks,
      stock: hasSizes
        ? Math.max(0, sizeBasedStock)
        : (Number.isFinite(parsedStock) ? Math.max(0, parsedStock) : 0),
      visible: product?.visible !== false,
      discount: normalizedDiscount,
      price: fallbackPrice
    };
  };

  const formatDiscount = (discount) => {
    if (!discount || !Number.isFinite(discount.value) || discount.value <= 0) {
      return "Без знижки";
    }
    if (discount.type === "percent") {
      return `${Math.round(discount.value * 100) / 100}%`;
    }
    return `${Math.round(discount.value * 100) / 100} ${getCurrencyLabel(getCurrentCurrency())}`;
  };

  const hasSizedStockAccounting = (product) => Boolean(Array.isArray(product?.sizes) && product.sizes.length);

  const getProductTotalStock = (product) => {
    if (!hasSizedStockAccounting(product)) {
      return Number.isFinite(Number(product?.stock)) ? Math.max(0, Number(product.stock)) : 0;
    }
    return product.sizes.reduce((sum, size) => {
      const key = String(size || "").trim().toUpperCase();
      const value = Number.parseInt(product?.sizeStocks?.[key], 10);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);
  };

  const setStockSizeTotalHint = () => {
    if (!stockSizeTotalHint || !stockSizeFields) return;
    const total = Array.from(stockSizeFields.querySelectorAll('input[data-size-stock-input="1"]')).reduce((sum, input) => {
      const parsed = Number.parseInt(input.value || "", 10);
      return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    }, 0);
    stockSizeTotalHint.textContent = `Загальний залишок: ${total}`;
  };

  const renderStockSizeFields = (product) => {
    if (!stockSizeFieldsWrap || !stockSizeFields || !stockQuantityWrap || !stockQuantityInput) return;
    const useSizeAccounting = hasSizedStockAccounting(product);

    stockQuantityWrap.hidden = useSizeAccounting;
    stockQuantityInput.required = !useSizeAccounting;
    stockSizeFieldsWrap.hidden = !useSizeAccounting;
    stockSizeFields.innerHTML = "";

    if (!useSizeAccounting) {
      stockSizeTotalHint.textContent = "";
      return;
    }

    const sizeStocks = product?.sizeStocks || {};
    product.sizes.forEach((size) => {
      const key = String(size || "").trim().toUpperCase();
      const row = document.createElement("label");
      row.className = "stock-size-field";
      row.innerHTML = `
        <span>${key}</span>
        <input type="number" min="0" step="1" data-size-stock-input="1" data-size-key="${key}" value="${Math.max(0, Number.parseInt(sizeStocks[key], 10) || 0)}">
      `;
      stockSizeFields.append(row);
    });

    setStockSizeTotalHint();
  };

  const selectedProductIds = new Set();
  let currentPageProductIds = [];

  const showBulkMessage = (message, isError = false) => {
    if (!bulkActionMessage) return;
    bulkActionMessage.classList.toggle("error", isError);
    bulkActionMessage.textContent = message;
  };

  const updateBulkSelectionState = () => {
    const selectedCount = selectedProductIds.size;
    const canUseBulkTools = selectedCount >= 1;

    if (bulkToolsPanel) {
      bulkToolsPanel.hidden = !canUseBulkTools;
    }

    if (bulkToolsHint) {
      bulkToolsHint.hidden = canUseBulkTools;
    }

    if (bulkSelectionInfo) {
      bulkSelectionInfo.textContent = `Вибрано товарів: ${selectedCount}`;
    }

    if (!canUseBulkTools && bulkActionMessage) {
      bulkActionMessage.textContent = "";
      bulkActionMessage.classList.remove("error");
    }

    if (selectAllProductsOnPage) {
      const selectableCount = currentPageProductIds.length;
      const selectedOnPage = currentPageProductIds.filter((id) => selectedProductIds.has(id)).length;
      selectAllProductsOnPage.checked = selectableCount > 0 && selectedOnPage === selectableCount;
      selectAllProductsOnPage.indeterminate = selectedOnPage > 0 && selectedOnPage < selectableCount;
    }
  };

  const clearBulkSelectionState = () => {
    selectedProductIds.clear();
    updateBulkSelectionState();
  };

  const normalizeCategoryName = (value) => {
    return (value || "").trim().replace(/\s+/g, " ").slice(0, MAX_CATEGORY_NAME_LENGTH);
  };

  const extractCategoriesFromProducts = (products) => {
    const names = [];
    products.forEach((product) => {
      const productCategoriesList = Array.isArray(product.categories) && product.categories.length
        ? product.categories
        : [product.category];

      productCategoriesList.forEach((categoryName) => {
        const normalized = normalizeCategoryName(categoryName);
        if (!normalized) return;
        if (names.some((name) => name.toLowerCase() === normalized.toLowerCase())) return;
        names.push(normalized);
      });
    });
    return names.map((name, index) => ({
      id: `cat-${Date.now()}-${index}`,
      name
    }));
  };

  const getCategoryNames = (categories) => categories.map((category) => category.name);

  const renderCategoryOptions = (categories) => {
    if (!productCategories) return;
    const previousValues = new Set(
      Array.from(productCategories.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => checkbox.value)
    );
    productCategories.innerHTML = "";
    productCategories.classList.remove("is-empty");

    if (!categories.length) {
      productCategories.classList.add("is-empty");
      productCategories.textContent = "Немає доступних категорій";
      return;
    }

    categories.forEach((category) => {
      const optionLabel = document.createElement("label");
      optionLabel.className = "product-category-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = category;
      checkbox.checked = previousValues.has(category);

      const optionText = document.createElement("span");
      optionText.textContent = category;

      optionLabel.append(checkbox, optionText);
      productCategories.append(optionLabel);
    });
  };

  const updateCategoryLimitBadge = (count) => {
    if (!categoryLimitBadge) return;
    const total = typeof count === "number" ? count : readCategories().length;
    const caps = getPlanCapabilities();
    const max = caps.maxCategories;

    if (max === Infinity) {
      categoryLimitBadge.textContent = `${total} без ліміту`;
      categoryLimitBadge.setAttribute("aria-label", `Категорії: ${total}, без ліміту`);
      categoryLimitBadge.classList.remove("is-full");
      categoryLimitBadge.classList.add("is-unlimited");
      categoryLimitBadge.title = `Тариф «${caps.planName}»: без обмежень`;
      return;
    }

    categoryLimitBadge.textContent = `${total} з ${max}`;
    categoryLimitBadge.setAttribute("aria-label", `Категорії: ${total} з ${max}`);
    categoryLimitBadge.classList.remove("is-unlimited");
    const isFull = total >= max;
    categoryLimitBadge.classList.toggle("is-full", isFull);
    const remaining = Math.max(0, max - total);
    categoryLimitBadge.title = isFull
      ? `Ліміт вичерпано: ${total} з ${max}. Оновіть тариф, щоб додати більше.`
      : `Залишилось ${remaining} із ${max}`;
  };

  const renderCategoriesList = (categories) => {
    updateCategoryLimitBadge(categories.length);
    if (!categoriesList) return;
    categoriesList.innerHTML = "";

    let draggingCategoryId = "";

    const applyCategoryOrder = (sourceCategoryId, targetCategoryId) => {
      if (!sourceCategoryId || !targetCategoryId || sourceCategoryId === targetCategoryId) return;

      const sourceIndex = categories.findIndex((category) => category.id === sourceCategoryId);
      const targetIndex = categories.findIndex((category) => category.id === targetCategoryId);
      if (sourceIndex < 0 || targetIndex < 0) return;

      const [moved] = categories.splice(sourceIndex, 1);
      categories.splice(targetIndex, 0, moved);
      saveCategories(categories);
      renderCategoryOptions(getCategoryNames(categories));
      renderCategoriesList(categories);
      categorySavedMessage.classList.remove("error");
      categorySavedMessage.textContent = "Порядок категорій оновлено";
    };

    if (!categories.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "saved-message error";
      emptyState.textContent = "Додайте хоча б одну категорію, щоб створювати товари.";
      categoriesList.append(emptyState);
      return;
    }

    categories.forEach((category, index) => {
      const item = document.createElement("article");
      item.className = "category-item";
      item.dataset.categoryId = category.id;
      item.draggable = true;

      const nameInput = document.createElement("input");
      nameInput.className = "category-name-input";
      nameInput.type = "text";
      nameInput.maxLength = MAX_CATEGORY_NAME_LENGTH;
      nameInput.value = category.name;
      nameInput.disabled = true;

      const actions = document.createElement("div");
      actions.className = "category-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "mini-btn";
      editButton.textContent = "Редагувати";

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "mini-btn save";
      saveButton.textContent = "Зберегти";
      saveButton.disabled = true;

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "mini-btn danger";
      deleteButton.textContent = "Видалити";

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "drag-handle";
      dragHandle.textContent = "::";
      dragHandle.title = "Перетягніть для зміни порядку";
      dragHandle.setAttribute("aria-label", "Перетягніть для зміни порядку");
      dragHandle.draggable = true;

      const startDragging = (event) => {
        draggingCategoryId = category.id;
        item.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", category.id);
        }
      };

      const endDragging = () => {
        draggingCategoryId = "";
        item.classList.remove("dragging");
        categoriesList.querySelectorAll(".category-item").forEach((categoryElement) => {
          categoryElement.classList.remove("drag-over", "dragging");
        });
      };

      item.addEventListener("dragstart", startDragging);
      dragHandle.addEventListener("dragstart", startDragging);

      item.addEventListener("dragover", (event) => {
        if (!draggingCategoryId || draggingCategoryId === category.id) return;
        event.preventDefault();
        item.classList.add("drag-over");
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });

      item.addEventListener("drop", (event) => {
        event.preventDefault();
        item.classList.remove("drag-over");
        const sourceCategoryId = event.dataTransfer?.getData("text/plain") || draggingCategoryId;
        applyCategoryOrder(sourceCategoryId, category.id);
      });

      item.addEventListener("dragend", endDragging);
      dragHandle.addEventListener("dragend", endDragging);

      editButton.addEventListener("click", () => {
        nameInput.disabled = false;
        nameInput.focus();
        nameInput.select();
        saveButton.disabled = false;
      });

      saveButton.addEventListener("click", () => {
        const normalized = normalizeCategoryName(nameInput.value);
        if (!normalized) {
          categorySavedMessage.textContent = "Назва категорії не може бути порожньою.";
          categorySavedMessage.classList.add("error");
          return;
        }

        if (containsProfanity(normalized)) {
          categorySavedMessage.textContent = "Назва категорії містить нецензурні слова.";
          categorySavedMessage.classList.add("error");
          return;
        }

        const duplicate = categories.some((itemCategory) => itemCategory.id !== category.id && itemCategory.name.toLowerCase() === normalized.toLowerCase());
        if (duplicate) {
          categorySavedMessage.textContent = "Категорія з такою назвою вже існує.";
          categorySavedMessage.classList.add("error");
          return;
        }

        const previousName = category.name;
        category.name = normalized;

        products = products.map((product) => {
          const currentCategories = Array.isArray(product.categories) && product.categories.length
            ? product.categories
            : [product.category].filter(Boolean);

          const nextCategories = currentCategories.map((categoryName) =>
            categoryName.toLowerCase() === previousName.toLowerCase() ? normalized : categoryName
          );

          return {
            ...product,
            categories: nextCategories,
            category: nextCategories[0] || ""
          };
        });

        saveProducts(products);
        saveCategories(categories);
        renderProductsTable(products);
        renderCategoryOptions(getCategoryNames(categories));
        renderCategoriesList(categories);

        categorySavedMessage.classList.remove("error");
        categorySavedMessage.textContent = "Категорію оновлено";
      });

      deleteButton.addEventListener("click", () => {
        const confirmed = window.confirm(
          `Видалити категорію «${category.name}»?
Увага: всі товари, що мали лише цю категорію, залишаться без категорії і будуть приховані на вітрині. Продовжити?`
        );
        if (!confirmed) return;

        const removedName = String(category.name || "").trim().toLowerCase();
        categories = categories.filter((itemCategory) => itemCategory.id !== category.id);

        products = products.map((product) => {
          const currentCategories = Array.isArray(product.categories) && product.categories.length
            ? product.categories
            : [product.category].filter(Boolean);

          const nextCategories = currentCategories.filter(
            (categoryName) => String(categoryName || "").trim().toLowerCase() !== removedName
          );

          return {
            ...product,
            categories: nextCategories,
            category: nextCategories[0] || ""
          };
        });

        // Persist products first, then update categories.
        saveProducts(products);
        if (!categories.length) {
          // If no categories remain, remove the key so remote doc is deleted as well.
          try {
            localStorage.removeItem(CATEGORIES_KEY);
          } catch (e) {
            saveCategories(categories);
          }
        } else {
          saveCategories(categories);
        }
        renderProductsTable(products);
        renderCategoryOptions(getCategoryNames(categories));
        renderCategoriesList(categories);

        categorySavedMessage.classList.remove("error");
        categorySavedMessage.textContent = "Категорію видалено";
      });

      actions.append(editButton, saveButton, deleteButton, dragHandle);
      item.append(nameInput, actions);
      categoriesList.append(item);
    });
  };

  const setProductsLoading = (isLoading) => {
    if (!productsLoadingOverlay) return;

    if (productsLoadingTimer) {
      window.clearTimeout(productsLoadingTimer);
      productsLoadingTimer = null;
    }

    if (isLoading) {
      productsLoadingStartedAt = Date.now();
      productsLoadingOverlay.hidden = false;
      productsPanel?.setAttribute("aria-busy", "true");
      productsTableWrap?.classList.add("is-loading");
      return;
    }

    const elapsed = Date.now() - productsLoadingStartedAt;
    const minVisibleMs = 450;
    const delay = elapsed >= minVisibleMs ? 0 : minVisibleMs - elapsed;
    productsLoadingTimer = window.setTimeout(() => {
      productsLoadingOverlay.hidden = true;
      productsPanel?.setAttribute("aria-busy", "false");
      productsTableWrap?.classList.remove("is-loading");
      productsLoadingTimer = null;
    }, delay);
  };

  // Shows how many products are added versus the current plan's limit (e.g. 7/10).
  const updateProductLimitBadge = (count) => {
    if (!productLimitBadge) return;
    const total = typeof count === "number" ? count : readProducts().length;
    const caps = getPlanCapabilities();
    const max = caps.maxProducts;

    if (max === Infinity) {
      productLimitBadge.textContent = `${total} без ліміту`;
      productLimitBadge.setAttribute("aria-label", `Товари: ${total}, без ліміту`);
      productLimitBadge.classList.remove("is-full");
      productLimitBadge.classList.add("is-unlimited");
      productLimitBadge.title = `Тариф «${caps.planName}»: без обмежень`;
      return;
    }

    productLimitBadge.textContent = `${total} з ${max}`;
    productLimitBadge.setAttribute("aria-label", `Товари: ${total} з ${max}`);
    productLimitBadge.classList.remove("is-unlimited");
    const isFull = total >= max;
    productLimitBadge.classList.toggle("is-full", isFull);
    const remaining = Math.max(0, max - total);
    productLimitBadge.title = isFull
      ? `Ліміт вичерпано: ${total} з ${max}. Оновіть тариф, щоб додати більше.`
      : `Залишилось ${remaining} із ${max}`;
  };

  const renderProductsTable = (products) => {
    updateProductLimitBadge(products.length);
    if (!productsTableBody) {
      setProductsLoading(false);
      return;
    }
    productsTableBody.innerHTML = "";

    const escapeHtml = (value) =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const truncateText = (value, maxLength) => {
      const normalized = String(value || "").trim();
      if (normalized.length <= maxLength) return normalized;
      return `${normalized.slice(0, maxLength - 1)}…`;
    };

    const filteredProducts = products.filter((product) => {
      if (currentProductsVisibilityFilter === "visible") {
        return product.visible !== false;
      }
      if (currentProductsVisibilityFilter === "hidden") {
        return product.visible === false;
      }
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
    if (currentProductsPage > totalPages) {
      currentProductsPage = totalPages;
    }

    const startIndex = (currentProductsPage - 1) * PRODUCTS_PER_PAGE;
    const visibleProducts = filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
    currentPageProductIds = visibleProducts.map((product) => product.id);

    if (!visibleProducts.length) {
      const row = document.createElement("tr");
      const emptyMessage = currentProductsVisibilityFilter === "hidden"
        ? "Наразі немає прихованих товарів."
        : "Наразі немає видимих товарів.";
      row.className = "empty-row";
      row.innerHTML = `<td colspan="10">${emptyMessage}</td>`;
      productsTableBody.append(row);
      updateBulkSelectionState();
      renderProductsPagination(filteredProducts.length);
      renderStockTable(products);
      setProductsLoading(false);
      return;
    }

    visibleProducts.forEach((product) => {
      const row = document.createElement("tr");
      const categoryList = Array.isArray(product.categories) && product.categories.length
        ? product.categories
        : [product.category].filter(Boolean);
      const categoriesHtml = categoryList
        .map((categoryName) => `<span class="product-category-pill">${escapeHtml(categoryName)}</span>`)
        .join("");
      const isVisible = product.visible !== false;
      const visibilityLabel = isVisible ? "Видимий" : "Прихований";
      const visibilityClass = isVisible ? "is-visible" : "is-hidden";
      const toggleLabel = isVisible ? "Приховати" : "Відобразити";
      const discountLabel = formatDiscount(product.discount);
      const priceHtml = formatPrice(product.price);

      row.innerHTML = `
        <td class="products-select-col">
          <input
            type="checkbox"
            class="product-select-checkbox"
            data-product-id="${escapeHtml(product.id)}"
            aria-label="Вибрати товар ${escapeHtml(product.sku)}"
            ${selectedProductIds.has(product.id) ? "checked" : ""}
          >
        </td>
        <td>${escapeHtml(product.sku)}</td>
        <td>${escapeHtml(product.name)}</td>
        <td><span class="product-category-list">${categoriesHtml}</span></td>
        <td>${priceHtml}</td>
        <td>${escapeHtml(discountLabel)}</td>
        <td><span class="product-photo-count">${(product.photos || []).length}</span></td>
        <td><span class="product-desc-preview">${escapeHtml(truncateText(product.description || "", 72))}</span></td>
        <td><span class="visibility-pill ${visibilityClass}">${visibilityLabel}</span></td>
        <td>
          <div class="product-actions">
            <button type="button" class="mini-btn product-edit-btn" data-product-id="${escapeHtml(product.id)}">Редагувати</button>
            <button type="button" class="mini-btn warn product-toggle-visibility-btn" data-product-id="${escapeHtml(product.id)}">${toggleLabel}</button>
            <button type="button" class="mini-btn danger product-delete-btn" data-product-id="${escapeHtml(product.id)}" title="Видалити товар" aria-label="Видалити товар ${escapeHtml(product.name)}">
              <span class="product-delete-label">Видалити</span>
              <svg class="product-delete-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </td>
      `;
      productsTableBody.append(row);
    });

    updateBulkSelectionState();
    renderProductsPagination(filteredProducts.length);
    renderStockTable(products);
    setProductsLoading(false);
  };

  const renderProductsPagination = (totalItems) => {
    if (!productsPagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
    if (currentProductsPage > totalPages) {
      currentProductsPage = totalPages;
    }

    productsPagination.innerHTML = "";
    productsPagination.hidden = totalItems <= PRODUCTS_PER_PAGE;
    if (productsPagination.hidden) return;

    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.className = "products-page-btn";
    previousButton.textContent = "‹";
    previousButton.dataset.page = String(currentProductsPage - 1);
    previousButton.disabled = currentProductsPage === 1;
    productsPagination.append(previousButton);

    for (let page = 1; page <= totalPages; page += 1) {
      const pageButton = document.createElement("button");
      pageButton.type = "button";
      pageButton.className = "products-page-btn";
      if (page === currentProductsPage) {
        pageButton.classList.add("active");
      }
      pageButton.textContent = String(page);
      pageButton.dataset.page = String(page);
      productsPagination.append(pageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "products-page-btn";
    nextButton.textContent = "›";
    nextButton.dataset.page = String(currentProductsPage + 1);
    nextButton.disabled = currentProductsPage === totalPages;
    productsPagination.append(nextButton);
  };

  const updateProductNameCounter = () => {
    if (!productName || !productNameCounter) return;
    const length = productName.value.length;
    productNameCounter.textContent = `${length}/${MAX_PRODUCT_NAME_LENGTH}`;
  };

  const updateProductDescriptionCounter = () => {
    if (!productDescription || !productDescriptionCounter) return;
    const length = productDescription.value.length;
    productDescriptionCounter.textContent = `${length}/${MAX_PRODUCT_DESCRIPTION_LENGTH}`;
  };

  const formatMegabytes = (bytes) => {
    const value = Number(bytes) / (1024 * 1024);
    if (!Number.isFinite(value) || value <= 0) return "0";
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  };

  const updateProductPhotoPolicyUi = () => {
    if (!productPhotos) return;
    const policy = getPhotoPolicyByPlan();
    const maxMb = formatMegabytes(policy.maxUploadBytes);
    const filesLabel = policy.maxPhotos === 1 ? "файлу" : "файлів";
    const eachLabel = policy.maxPhotos === 1 ? "файл" : "кожен";

    if (productPhotosPolicyLabel) {
      productPhotosPolicyLabel.textContent = `Фото товару (до ${policy.maxPhotos} ${filesLabel}, ${eachLabel} до ${maxMb} МБ)`;
    }

    if (productPhotosPolicyHint) {
      productPhotosPolicyHint.textContent = `Тариф «${policy.planName}»: максимум ${policy.maxPhotos} фото, до ${maxMb} МБ на файл.`;
    }

    productPhotos.multiple = policy.maxPhotos > 1;
  };

  const getPhotoPolicyHint = () => {
    const policy = getPhotoPolicyByPlan();
    const maxMb = formatMegabytes(policy.maxUploadBytes);
    return `Тариф «${policy.planName}»: до ${policy.maxPhotos} фото, до ${maxMb} МБ на файл.`;
  };

  const validatePhotos = (files) => {
    const list = Array.isArray(files) ? files : [];
    const policy = getPhotoPolicyByPlan();

    if (list.length > policy.maxPhotos) {
      return `${getPhotoPolicyHint()} Обрано ${list.length}, дозволено ${policy.maxPhotos}.`;
    }

    const oversized = list.find((file) => Number(file?.size) > policy.maxUploadBytes);
    if (oversized) {
      return `${getPhotoPolicyHint()} Файл ${oversized.name} перевищує ліміт ${formatMegabytes(policy.maxUploadBytes)} МБ.`;
    }

    return "";
  };

  const resolveProductPhotoSrc = (photo) => {
    if (typeof photo === "string") {
      return String(photo).trim();
    }
    if (!photo || typeof photo !== "object") {
      return "";
    }
    return String(photo.src || photo.url || photo.dataUrl || "").trim();
  };

  const moveListItem = (list, fromIndex, toIndex) => {
    if (!Array.isArray(list)) return [];
    const next = [...list];
    if (fromIndex < 0 || fromIndex >= next.length || toIndex < 0 || toIndex >= next.length || fromIndex === toIndex) {
      return next;
    }
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  };

  const revokeProductPreviewObjectUrls = () => {
    productPreviewObjectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore URL cleanup errors
      }
    });
    productPreviewObjectUrls = [];
  };

  const refreshProductPhotoPreview = () => {
    renderProductPhotoPreview({
      selectedFiles: currentProductSelectedFiles,
      storedPhotos: currentProductStoredPhotos
    });
  };

  const createProductPhotoPreviewCard = ({ src, name, badge, badgeClass, alt, index, total, onMove }) => {
    const card = document.createElement("div");
    card.className = "product-photo-preview-item";

    const stopFilePickerActivation = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    card.append(image);

    const nameNode = document.createElement("span");
    nameNode.className = "product-photo-preview-name";
    nameNode.textContent = name;
    card.append(nameNode);

    const badgeNode = document.createElement("span");
    badgeNode.className = `product-photo-preview-badge ${badgeClass}`;
    badgeNode.textContent = badge;
    card.append(badgeNode);

    const controls = document.createElement("div");
    controls.className = "product-photo-preview-controls";

    const moveLeftButton = document.createElement("button");
    moveLeftButton.type = "button";
    moveLeftButton.className = "product-photo-preview-move-btn";
    moveLeftButton.textContent = "<";
    moveLeftButton.setAttribute("aria-label", "Перемістити фото лівіше");
    moveLeftButton.disabled = index <= 0;
    moveLeftButton.addEventListener("mousedown", stopFilePickerActivation);
    moveLeftButton.addEventListener("touchstart", stopFilePickerActivation, { passive: false });
    moveLeftButton.addEventListener("click", (event) => {
      stopFilePickerActivation(event);
      onMove(index, index - 1);
    });
    controls.append(moveLeftButton);

    const moveRightButton = document.createElement("button");
    moveRightButton.type = "button";
    moveRightButton.className = "product-photo-preview-move-btn";
    moveRightButton.textContent = ">";
    moveRightButton.setAttribute("aria-label", "Перемістити фото правіше");
    moveRightButton.disabled = index >= total - 1;
    moveRightButton.addEventListener("mousedown", stopFilePickerActivation);
    moveRightButton.addEventListener("touchstart", stopFilePickerActivation, { passive: false });
    moveRightButton.addEventListener("click", (event) => {
      stopFilePickerActivation(event);
      onMove(index, index + 1);
    });
    controls.append(moveRightButton);

    card.append(controls);

    return card;
  };

  const renderProductPhotoPreview = ({ selectedFiles = [], storedPhotos = [] } = {}) => {
    if (!productPhotosPreview) return;

    revokeProductPreviewObjectUrls();
    productPhotosPreview.innerHTML = "";

    const files = Array.isArray(selectedFiles) ? selectedFiles : [];
    const saved = Array.isArray(storedPhotos) ? storedPhotos : [];

    if (files.length) {
      files.forEach((file, index) => {
        const objectUrl = URL.createObjectURL(file);
        productPreviewObjectUrls.push(objectUrl);
        const card = createProductPhotoPreviewCard({
          src: objectUrl,
          name: String(file?.name || `Фото ${index + 1}`),
          badge: "Нове фото",
          badgeClass: "pending",
          alt: String(file?.name || `Нове фото ${index + 1}`),
          index,
          total: files.length,
          onMove: (fromIndex, toIndex) => {
            currentProductSelectedFiles = moveListItem(currentProductSelectedFiles, fromIndex, toIndex);
            refreshProductPhotoPreview();
          }
        });
        productPhotosPreview.append(card);
      });
      return;
    }

    const savedWithSrc = saved
      .map((photo, index) => ({
        src: resolveProductPhotoSrc(photo),
        name: String(photo?.name || `Фото ${index + 1}`).trim() || `Фото ${index + 1}`
      }))
      .filter((entry) => Boolean(entry.src));

    if (savedWithSrc.length) {
      savedWithSrc.forEach((photo, index) => {
        const card = createProductPhotoPreviewCard({
          src: photo.src,
          name: photo.name,
          badge: "У базі",
          badgeClass: "stored",
          alt: `Збережене фото ${index + 1}`,
          index,
          total: savedWithSrc.length,
          onMove: (fromIndex, toIndex) => {
            currentProductStoredPhotos = moveListItem(currentProductStoredPhotos, fromIndex, toIndex);
            refreshProductPhotoPreview();
          }
        });
        productPhotosPreview.append(card);
      });
      return;
    }

    const empty = document.createElement("div");
    empty.className = "product-photos-preview-empty";
    empty.textContent = "Фото ще не обрано.";
    productPhotosPreview.append(empty);
  };

  const setProductModalOpen = (open) => {
    if (!productModal) return;
    productModal.classList.toggle("open", open);
    productModal.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open && productUnitSelect && productUnitOptions) {
      productUnitSelect.classList.remove("open");
      productUnitSelect.setAttribute("aria-expanded", "false");
      productUnitOptions.hidden = true;
      currentProductSelectedFiles = [];
      revokeProductPreviewObjectUrls();
    }
    updateModalScrollLock();
  };

  const resolveStoreIdForUploads = () => {
    const authState = readAuthState();
    if (authState?.storeId) {
      return sanitizeStoreId(authState.storeId);
    }

    const search = new URLSearchParams(window.location.search || "");
    const hashParams = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    const fromUrl = sanitizeStoreId(search.get("store") || search.get("subdomain") || hashParams.get("store") || hashParams.get("subdomain") || "");
    if (fromUrl) {
      return fromUrl;
    }

    const host = String(window.location.hostname || "").toLowerCase();
    if (host && host.includes(".")) {
      const hostPrefix = sanitizeStoreId(host.split(".")[0] || "");
      if (hostPrefix && hostPrefix !== "www") {
        return hostPrefix;
      }
    }

    const context = getCurrentStoreContext();
    return sanitizeStoreId(context.subdomain || "") || "default-store";
  };

  const buildStorageBucketCandidates = () => {
    const fromApp = String(firebase?.apps?.[0]?.options?.storageBucket || "").trim();
    const raw = [
      fromApp,
      FIREBASE_CONFIG.storageBucket,
      ...STORAGE_BUCKET_CANDIDATES
    ].map((value) => String(value || "").trim()).filter(Boolean);

    const expanded = [];
    raw.forEach((bucket) => {
      expanded.push(bucket);
      if (bucket.endsWith(".appspot.com")) {
        expanded.push(bucket.replace(/\.appspot\.com$/i, ".firebasestorage.app"));
      }
      if (bucket.endsWith(".firebasestorage.app")) {
        expanded.push(bucket.replace(/\.firebasestorage\.app$/i, ".appspot.com"));
      }
    });

    return expanded.filter((value, index, arr) => arr.indexOf(value) === index);
  };

  const sanitizeStorageFileName = (name) => {
    const normalized = String(name || "photo")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    return normalized || "photo";
  };

  const withTimeout = (promise, timeoutMs, errorCode) => {
    const timeout = Math.max(1000, Number(timeoutMs) || 12000);
    return new Promise((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        reject(new Error(errorCode || "operation-timeout"));
      }, timeout);

      promise
        .then((value) => {
          window.clearTimeout(timerId);
          resolve(value);
        })
        .catch((error) => {
          window.clearTimeout(timerId);
          reject(error);
        });
    });
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });

  const loadImageFromDataUrl = (dataUrl) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = dataUrl;
  });

  const clampDimension = (width, height, maxDimension) => {
    const w = Math.max(1, Number(width) || 1);
    const h = Math.max(1, Number(height) || 1);
    const max = Math.max(1, Number(maxDimension) || 1);
    if (w <= max && h <= max) {
      return { width: w, height: h };
    }

    if (w >= h) {
      return { width: max, height: Math.max(1, Math.round((h * max) / w)) };
    }

    return { width: Math.max(1, Math.round((w * max) / h)), height: max };
  };

  const canvasToDataUrl = (canvas, quality) => {
    const q = Math.min(0.92, Math.max(0.45, Number(quality) || 0.85));
    return canvas.toDataURL("image/jpeg", q);
  };

  const estimateDataUrlBytes = (dataUrl) => {
    const value = String(dataUrl || "");
    const base64 = value.split(",")[1] || "";
    return Math.max(0, Math.floor((base64.length * 3) / 4));
  };

  const dataUrlToBlob = (dataUrl) => {
    const parts = String(dataUrl || "").split(",");
    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mimeType = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "image/jpeg";
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  };

  const sleep = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });

  const optimizeProductPhotoForUpload = async (file, index) => {
    const rawType = String(file?.type || "").toLowerCase();
    const isImage = rawType.startsWith("image/");
    if (!isImage) {
      return file;
    }

    // Small photos are uploaded as-is to avoid unnecessary recompression.
    if ((Number(file?.size) || 0) <= PRODUCT_PHOTO_TARGET_UPLOAD_BYTES * 0.8) {
      return file;
    }

    const sourceDataUrl = await readFileAsDataUrl(file);
    const sourceImage = await loadImageFromDataUrl(sourceDataUrl);
    const size = clampDimension(sourceImage.width, sourceImage.height, PRODUCT_PHOTO_MAX_DIMENSION);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(sourceImage, 0, 0, size.width, size.height);

    let quality = 0.9;
    let dataUrl = canvasToDataUrl(canvas, quality);
    let bytes = estimateDataUrlBytes(dataUrl);
    while (bytes > PRODUCT_PHOTO_TARGET_UPLOAD_BYTES && quality > 0.56) {
      quality -= 0.06;
      dataUrl = canvasToDataUrl(canvas, quality);
      bytes = estimateDataUrlBytes(dataUrl);
    }

    const blob = dataUrlToBlob(dataUrl);
    if (!blob || !blob.size || blob.size >= (Number(file?.size) || 0)) {
      return file;
    }

    const baseName = String(file?.name || `photo-${index + 1}`).replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  };

  const buildEmbeddedProductPhoto = async (file, policy, index, uploadErrorCode) => {
    const sourceDataUrl = await readFileAsDataUrl(file);
    const sourceImage = await loadImageFromDataUrl(sourceDataUrl);
    const size = clampDimension(sourceImage.width, sourceImage.height, policy.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("canvas-context-unavailable");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(sourceImage, 0, 0, size.width, size.height);

    var quality = 0.9;
    var dataUrl = canvasToDataUrl(canvas, quality);
    var bytes = estimateDataUrlBytes(dataUrl);
    var maxBytes = Math.max(24 * 1024, Number(policy.targetStoredBytes) || 120 * 1024);

    while (bytes > maxBytes && quality > 0.5) {
      quality -= 0.08;
      dataUrl = canvasToDataUrl(canvas, quality);
      bytes = estimateDataUrlBytes(dataUrl);
    }

    return {
      id: `photo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: String(file?.name || `photo-${index + 1}`).trim() || `photo-${index + 1}`,
      type: "image/jpeg",
      size: bytes,
      dataUrl,
      src: dataUrl,
      storageSync: "embedded-fallback",
      storageErrorCode: String(uploadErrorCode || "storage-upload-failed"),
      width: size.width,
      height: size.height,
      updatedAt: new Date().toISOString()
    };
  };

  const getExtensionFromFile = (file) => {
    const rawName = String(file?.name || "").trim();
    const dotIndex = rawName.lastIndexOf(".");
    if (dotIndex > -1 && dotIndex < rawName.length - 1) {
      return rawName.slice(dotIndex + 1).toLowerCase();
    }

    const type = String(file?.type || "").toLowerCase();
    if (type === "image/png") return "png";
    if (type === "image/webp") return "webp";
    return "jpg";
  };

  const uploadProductPhotoToStorage = async (file, storeId, productId, index) => {
    const uploadFile = await optimizeProductPhotoForUpload(file, index);
    const extension = getExtensionFromFile(uploadFile);
    const nameRoot = sanitizeStorageFileName(String(file?.name || `photo-${index + 1}`)).replace(/\.[^.]+$/, "");
    const objectPath = `stores/${storeId}/products/${productId}/${Date.now()}-${index + 1}-${nameRoot}.${extension}`;
    const metadata = {
      contentType: String(uploadFile?.type || file?.type || "image/jpeg"),
      cacheControl: "public,max-age=31536000,immutable"
    };
    const bucketCandidates = buildStorageBucketCandidates();

    let lastError = null;
    for (let i = 0; i < bucketCandidates.length; i += 1) {
      const bucket = bucketCandidates[i];
      const storage = getStorageClientForBucket(bucket);
      const ref = storage.ref().child(objectPath);

      for (let attempt = 1; attempt <= STORAGE_UPLOAD_RETRY_ATTEMPTS; attempt += 1) {
        try {
          const snapshot = await withTimeout(ref.put(uploadFile, metadata), STORAGE_UPLOAD_TIMEOUT_MS, "storage-upload-timeout");
          const downloadUrl = await withTimeout(snapshot.ref.getDownloadURL(), STORAGE_URL_TIMEOUT_MS, "storage-url-timeout");

          return {
            id: `photo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            name: String(file?.name || `photo-${index + 1}`).trim() || `photo-${index + 1}`,
            type: String(uploadFile?.type || file?.type || "image/jpeg"),
            size: Number(uploadFile?.size || file?.size) || 0,
            url: downloadUrl,
            src: downloadUrl,
            path: objectPath,
            bucket,
            storageSync: "firebase-storage",
            updatedAt: new Date().toISOString()
          };
        } catch (error) {
          lastError = error;
          if (attempt < STORAGE_UPLOAD_RETRY_ATTEMPTS) {
            await sleep(400 * attempt);
          }
        }
      }
    }

    console.warn("[admin] storage upload failed", {
      storeId,
      productId,
      fileName: String(file?.name || ""),
      error: lastError
    });

    const uploadError = new Error("storage-upload-failed");
    uploadError.code = lastError?.code || lastError?.message || "storage-upload-failed";
    uploadError.cause = lastError || null;
    throw uploadError;
  };

  // Uploads the store avatar to Firebase Storage so it stays small enough to sync
  // through Firestore and shows up on the storefront on any device.
  const uploadStoreAvatarToStorage = async (file, storeId) => {
    const extension = getExtensionFromFile(file);
    const nameRoot = sanitizeStorageFileName(String(file?.name || "avatar")).replace(/\.[^.]+$/, "");
    const objectPath = `stores/${storeId}/avatar/${Date.now()}-${nameRoot}.${extension}`;
    const metadata = { contentType: String(file?.type || "image/jpeg") };
    const bucketCandidates = buildStorageBucketCandidates();

    let lastError = null;
    for (let i = 0; i < bucketCandidates.length; i += 1) {
      try {
        const bucket = bucketCandidates[i];
        const storage = getStorageClientForBucket(bucket);
        const ref = storage.ref().child(objectPath);
        const snapshot = await withTimeout(ref.put(file, metadata), 15000, "storage-upload-timeout");
        return await withTimeout(snapshot.ref.getDownloadURL(), 10000, "storage-url-timeout");
      } catch (error) {
        lastError = error;
      }
    }

    console.warn("[admin] avatar storage upload failed, using embedded fallback", { storeId, error: lastError });

    // Firestore documents are capped at ~1 MiB, so resize/compress before embedding.
    const sourceDataUrl = await readFileAsDataUrl(file);
    const sourceImage = await loadImageFromDataUrl(sourceDataUrl);
    const size = clampDimension(sourceImage.width, sourceImage.height, MAX_AVATAR_DIMENSION);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw lastError || new Error("canvas-context-unavailable");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(sourceImage, 0, 0, size.width, size.height);

    let quality = 0.85;
    let dataUrl = canvasToDataUrl(canvas, quality);
    while (estimateDataUrlBytes(dataUrl) > 180 * 1024 && quality > 0.5) {
      quality -= 0.08;
      dataUrl = canvasToDataUrl(canvas, quality);
    }

    return dataUrl;
  };

  const convertProductFilesToStoredPhotos = async (files, productId) => {
    const list = Array.isArray(files) ? files : [];
    if (!list.length) {
      return [];
    }

    const storeId = resolveStoreIdForUploads();
    const safeProductId = sanitizeStorageFileName(String(productId || `product-${Date.now()}`));
    const photoPolicy = getPhotoPolicyByPlan();
    const results = new Array(list.length);
    const concurrency = Math.max(1, Math.min(PRODUCT_UPLOAD_CONCURRENCY, list.length));
    let cursor = 0;

    const worker = async () => {
      while (cursor < list.length) {
        const index = cursor;
        cursor += 1;
        let entry;
        try {
          entry = await uploadProductPhotoToStorage(list[index], storeId, safeProductId, index);
        } catch (error) {
          console.warn("[admin] product photo storage upload failed, using embedded fallback", {
            storeId,
            productId: safeProductId,
            index,
            fileName: String(list[index]?.name || ""),
            error
          });
          entry = await buildEmbeddedProductPhoto(list[index], photoPolicy, index, error?.code || error?.message);
        }
        results[index] = entry;
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  };

  const applyProductUnitValue = (value) => {
    const normalizedValue = String(value || "").trim();
    const fallbackOption = productUnitOptionButtons[0] || null;
    const matchedOption = productUnitOptionButtons.find((option) => String(option.dataset.value || "").trim() === normalizedValue) || fallbackOption;
    if (!matchedOption) return;

    if (productUnit) {
      productUnit.value = String(matchedOption.dataset.value || "шт");
    }
    if (productUnitLabel) {
      productUnitLabel.textContent = String(matchedOption.dataset.label || matchedOption.textContent || "Штуки (шт)").trim();
    }
    productUnitOptionButtons.forEach((option) => {
      option.classList.toggle("active", option === matchedOption);
      option.setAttribute("aria-selected", option === matchedOption ? "true" : "false");
    });
  };

  const applyStoreCurrencyValue = (value) => {
    const normalizedValue = normalizeCurrencyCode(value);
    const fallbackOption = storeCurrencyOptionButtons[0] || null;
    const matchedOption = storeCurrencyOptionButtons.find((option) => String(option.dataset.value || "").trim() === normalizedValue) || fallbackOption;
    if (!matchedOption) return;

    if (storeCurrency) {
      storeCurrency.value = String(matchedOption.dataset.value || "uah");
    }
    if (storeCurrencyLabel) {
      storeCurrencyLabel.textContent = String(matchedOption.dataset.label || matchedOption.textContent || "Гривня (грн)").trim();
    }

    storeCurrencyOptionButtons.forEach((option) => {
      option.classList.toggle("active", option === matchedOption);
      option.setAttribute("aria-selected", option === matchedOption ? "true" : "false");
    });
  };

  const setStoreCurrencyOpen = (open) => {
    if (!storeCurrencySelect || !storeCurrencyOptions) return;
    storeCurrencyOptions.hidden = !open;
    storeCurrencySelect.classList.toggle("open", open);
    storeCurrencySelect.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const syncProductSizesVisibility = () => {
    if (!productIsClothing || !productSizesWrap) return;
    productSizesWrap.hidden = !productIsClothing.checked;
  };

  const clearProductSizesSelection = () => {
    Array.from(productSizes?.querySelectorAll('input[type="checkbox"]') || []).forEach((checkbox) => {
      checkbox.checked = false;
    });
    if (productSizesCustom) {
      productSizesCustom.value = "";
    }
  };

  const collectProductSizes = () => {
    const selected = Array.from(productSizes?.querySelectorAll('input[type="checkbox"]:checked') || [])
      .map((checkbox) => String(checkbox.value || "").trim().toUpperCase())
      .filter(Boolean);
    const custom = String(productSizesCustom?.value || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set([...selected, ...custom]));
  };

  const applyProductSizes = (sizes) => {
    const normalized = Array.isArray(sizes)
      ? sizes.map((size) => String(size || "").trim().toUpperCase()).filter(Boolean)
      : [];
    const selectedSet = new Set(normalized);
    const knownValues = new Set(
      Array.from(productSizes?.querySelectorAll('input[type="checkbox"]') || []).map((checkbox) => String(checkbox.value || "").trim().toUpperCase())
    );

    Array.from(productSizes?.querySelectorAll('input[type="checkbox"]') || []).forEach((checkbox) => {
      checkbox.checked = selectedSet.has(String(checkbox.value || "").trim().toUpperCase());
    });

    const customOnly = normalized.filter((size) => !knownValues.has(size));
    if (productSizesCustom) {
      productSizesCustom.value = customOnly.join(", ");
    }
  };

  const setProductFormMode = (mode, product = null) => {
    if (!productCreateForm) return;

    productCreateForm.reset();
    updateProductPhotoPolicyUi();
    updateProductNameCounter();
    updateProductDescriptionCounter();
    productSavedMessage.classList.remove("error");
    productSavedMessage.textContent = "";
    currentProductStoredPhotos = [];
    currentProductSelectedFiles = [];
    refreshProductPhotoPreview();

    if (mode === "edit" && product) {
      productEditingId.value = product.id;
      productModalTitle.textContent = "Редагування товару";
      productSubmitButton.textContent = "Зберегти зміни";
      productName.value = product.name || "";
      productSku.value = product.sku || "";
      productDescription.value = product.description || "";
      productPrice.value = product.price || "";
      applyProductUnitValue(String(product.unit || "шт"));
      if (productIsClothing) {
        productIsClothing.checked = Boolean(product.isClothing);
      }
      syncProductSizesVisibility();
      applyProductSizes(product.sizes || []);
      productVisible.checked = product.visible !== false;
      const categoryNames = getCategoryNames(categories);
      const selectedCategories = Array.isArray(product.categories) && product.categories.length
        ? product.categories
        : [product.category].filter(Boolean);
      Array.from(productCategories.querySelectorAll('input[type="checkbox"]')).forEach((checkbox) => {
        checkbox.checked = selectedCategories.includes(checkbox.value) && categoryNames.includes(checkbox.value);
      });
      currentProductStoredPhotos = Array.isArray(product.photos) ? product.photos : [];
      currentProductSelectedFiles = [];
      refreshProductPhotoPreview();
      updateProductNameCounter();
      updateProductDescriptionCounter();
      return;
    }

    productEditingId.value = "";
    productModalTitle.textContent = "Створення товару";
    productSubmitButton.textContent = "Створити товар";
    applyProductUnitValue("шт");
    if (productIsClothing) {
      productIsClothing.checked = false;
    }
    syncProductSizesVisibility();
    clearProductSizesSelection();
    productVisible.checked = true;
    Array.from(productCategories.querySelectorAll('input[type="checkbox"]')).forEach((checkbox) => {
      checkbox.checked = false;
    });
    refreshProductPhotoPreview();
  };

  const SAVE_ACQUIRER_SECRETS_URL = "https://us-central1-lavka-shop.cloudfunctions.net/saveStoreAcquirerSecrets";
  const GET_ACQUIRER_SECRETS_STATUS_URL = "https://us-central1-lavka-shop.cloudfunctions.net/getStoreAcquirerSecretsStatus";
  let acquirerSecretsStatus = { hasMonoSecret: false, hasLiqpayPrivateKey: false };

  // Mono/LiqPay secret keys never round-trip through localStorage/Firestore
  // (open rules would expose them) — only this endpoint tells us whether a
  // key is already saved, so the password fields can show a placeholder
  // instead of the real value.
  const refreshAcquirerSecretsStatus = async () => {
    const storeId = resolveStoreIdForUploads();
    if (!storeId || storeId === "default-store") return;

    try {
      const response = await fetch(`${GET_ACQUIRER_SECRETS_STATUS_URL}?storeId=${encodeURIComponent(storeId)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !data.ok) return;

      acquirerSecretsStatus = {
        hasMonoSecret: Boolean(data.hasMonoSecret),
        hasLiqpayPrivateKey: Boolean(data.hasLiqpayPrivateKey)
      };

      if (paymentMonoSecret) {
        paymentMonoSecret.placeholder = acquirerSecretsStatus.hasMonoSecret
          ? "Збережено • введіть новий, щоб змінити"
          : "Вставте API key еквайрингу mono";
      }
      if (paymentLiqpayPrivateKey) {
        paymentLiqpayPrivateKey.placeholder = acquirerSecretsStatus.hasLiqpayPrivateKey
          ? "Збережено • введіть новий, щоб змінити"
          : "Приватний ключ LiqPay";
      }
    } catch (error) {
      console.warn("refreshAcquirerSecretsStatus error:", error);
    }
  };

  const saveAcquirerSecrets = async ({ monoSecret, liqpayPrivateKey }) => {
    const storeId = resolveStoreIdForUploads();
    if (!storeId || storeId === "default-store") return;

    const payload = { storeId };
    if (monoSecret) payload.paymentMonoSecret = monoSecret;
    if (liqpayPrivateKey) payload.paymentLiqpayPrivateKey = liqpayPrivateKey;
    if (!("paymentMonoSecret" in payload) && !("paymentLiqpayPrivateKey" in payload)) return;

    const response = await fetch(SAVE_ACQUIRER_SECRETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !data.ok) {
      throw new Error(String(data && data.error || "save-secrets-failed"));
    }

    await refreshAcquirerSecretsStatus();
  };

  const mergeAndSaveSettings = (partialPayload) => {
    let payload = null;

    try {
      const current = readSettings() || {};
      payload = {
        ...current,
        ...partialPayload,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      payload = {
        ...(readSettings() || {}),
        ...partialPayload,
        updatedAt: new Date().toISOString()
      };
    }

    persistCheckoutSettings(payload);
    return payload;
  };

  const applySettings = (settings) => {
    if (!settings) return;
    const normalizedName = String(settings.name || settings.storeName || "").trim();
    const normalizedDescription = String(settings.description || settings.storeDescription || "").trim();
    const normalizedAvatar = String(settings.avatar || settings.storeAvatar || "").trim();

    storeName.value = normalizedName;
    storeDescription.value = normalizedDescription;
    storeAvatar.value = normalizedAvatar;
    avatarPreview.src = normalizedAvatar || EMPTY_AVATAR_SRC;
    socialInstagram.value = settings.instagram || "";
    socialFacebook.value = settings.facebook || "";
    socialTelegram.value = settings.telegram || "";
    socialTiktok.value = settings.tiktok || "";
    socialInstagramEnabled.checked = settings.instagramEnabled ?? true;
    socialFacebookEnabled.checked = settings.facebookEnabled ?? true;
    socialTelegramEnabled.checked = settings.telegramEnabled ?? true;
    socialTiktokEnabled.checked = settings.tiktokEnabled ?? true;
    if (minimumOrderEnabled) {
      minimumOrderEnabled.checked = Boolean(settings.minimumOrderEnabled);
    }
    if (minimumOrderAmount) {
      const normalizedMinimum = Number(settings.minimumOrderAmount);
      minimumOrderAmount.value = Number.isFinite(normalizedMinimum) && normalizedMinimum > 0
        ? String(Math.round(normalizedMinimum))
        : "";
    }
    syncMinimumOrderControls();
    if (hideWatermarkEnabled) {
      hideWatermarkEnabled.checked = Boolean(settings.hideWatermark);
    }
    syncWatermarkControl();
    if (cartIconColor) {
      cartIconColor.value = settings.cartIconColor || "#2b4c85";
    }
    if (siteColor) {
      siteColor.value = settings.siteColor || "#2b4c85";
    }
    if (siteBackgroundType) {
      siteBackgroundType.value = settings.siteBackgroundType === "image" ? "image" : "color";
    }
    if (siteBackgroundColor) {
      siteBackgroundColor.value = isHexColor(settings.siteBackgroundColor) ? settings.siteBackgroundColor : "#eef1f4";
    }
    if (siteBackgroundImage) {
      siteBackgroundImage.value = String(settings.siteBackgroundImage || "").trim();
    }
    applyStoreCurrencyValue(settings.currency || "uah");
    if (telegramOrderNotifyEnabled) {
      telegramOrderNotifyEnabled.checked = Boolean(settings.telegramOrderNotifyEnabled);
    }
    if (paymentMonoEnabled) {
      paymentMonoEnabled.checked = Boolean(settings.paymentMonoEnabled);
    }
    if (paymentMonoSecret) {
      paymentMonoSecret.value = "";
    }
    if (paymentLiqpayEnabled) {
      paymentLiqpayEnabled.checked = Boolean(settings.paymentLiqpayEnabled);
    }
    if (paymentLiqpayPublicKey) {
      paymentLiqpayPublicKey.value = String(settings.paymentLiqpayPublicKey || "").trim();
    }
    if (paymentLiqpayPrivateKey) {
      paymentLiqpayPrivateKey.value = "";
    }
    void refreshAcquirerSecretsStatus();
    if (paymentCodEnabled) {
      paymentCodEnabled.checked = settings.paymentCodEnabled ?? true;
    }
    if (paymentCodFee) {
      paymentCodFee.value = String(settings.paymentCodFee || "").trim();
    }
    if (paymentPrepaymentEnabled) {
      paymentPrepaymentEnabled.checked = Boolean(settings.paymentPrepaymentEnabled);
    }
    if (paymentPrepaymentAmount) {
      const normalizedPrepayment = Number(settings.paymentPrepaymentAmount);
      paymentPrepaymentAmount.value = Number.isFinite(normalizedPrepayment) && normalizedPrepayment > 0
        ? String(Math.round(normalizedPrepayment))
        : "";
    }
    if (paymentPrepaymentViaMono || paymentPrepaymentViaLiqpay) {
      // Мігруємо старі окремі чекбокси (paymentPrepaymentViaMono/ViaLiqpay) в один вибір.
      let acquirer = String(settings.paymentPrepaymentAcquirer || "").trim().toLowerCase();
      if (acquirer !== "mono" && acquirer !== "liqpay") {
        if (settings.paymentPrepaymentViaMono) {
          acquirer = "mono";
        } else if (settings.paymentPrepaymentViaLiqpay) {
          acquirer = "liqpay";
        }
      }
      if (paymentPrepaymentViaMono) {
        paymentPrepaymentViaMono.checked = acquirer === "mono";
      }
      if (paymentPrepaymentViaLiqpay) {
        paymentPrepaymentViaLiqpay.checked = acquirer === "liqpay";
      }
    }
    if (paymentBankTransferEnabled) {
      paymentBankTransferEnabled.checked = Boolean(settings.paymentBankTransferEnabled);
    }
    if (paymentBankRequisites) {
      paymentBankRequisites.value = String(settings.paymentBankRequisites || "").trim();
    }
    if (shippingNovaPostEnabled) {
      shippingNovaPostEnabled.checked = settings.shippingNovaPostEnabled ?? true;
    }
    if (shippingUkrPostEnabled) {
      shippingUkrPostEnabled.checked = settings.shippingUkrPostEnabled ?? true;
    }
    if (shippingNovaCourierEnabled) {
      shippingNovaCourierEnabled.checked = Boolean(settings.shippingNovaCourierEnabled);
    }
    applyPaymentDeliveryMatrixToUi(settings.paymentDeliveryMatrix);
    renderAdminTelegramSubscriptionControls();
    applyBackgroundPreview();
    if (storeName.value.length > MAX_NAME_LENGTH) {
      storeName.value = storeName.value.slice(0, MAX_NAME_LENGTH);
    }
    if (storeDescription.value.length > MAX_DESCRIPTION_LENGTH) {
      storeDescription.value = storeDescription.value.slice(0, MAX_DESCRIPTION_LENGTH);
    }
    updateNameCounter();
    updateDescriptionCounter();
  };

  const hasEnabledAcquiring = () => Boolean(paymentMonoEnabled?.checked || paymentLiqpayEnabled?.checked);

  const syncPrepaymentControls = () => {
    const acquiringEnabled = hasEnabledAcquiring();

    if (paymentPrepaymentEnabled) {
      paymentPrepaymentEnabled.disabled = !acquiringEnabled;
      if (!acquiringEnabled && paymentPrepaymentEnabled.checked) {
        paymentPrepaymentEnabled.checked = false;
      }
    }

    const prepaymentChecked = Boolean(paymentPrepaymentEnabled?.checked);
    if (paymentPrepaymentAmount) {
      paymentPrepaymentAmount.disabled = !acquiringEnabled || !prepaymentChecked;
      if (!prepaymentChecked) {
        paymentPrepaymentAmount.value = "";
      }
    }

    const monoEnabledNow = Boolean(paymentMonoEnabled?.checked);
    const liqpayEnabledNow = Boolean(paymentLiqpayEnabled?.checked);

    if (paymentPrepaymentViaMono) {
      paymentPrepaymentViaMono.disabled = !acquiringEnabled || !prepaymentChecked || !monoEnabledNow;
      if (!monoEnabledNow) {
        paymentPrepaymentViaMono.checked = false;
      }
    }

    if (paymentPrepaymentViaLiqpay) {
      paymentPrepaymentViaLiqpay.disabled = !acquiringEnabled || !prepaymentChecked || !liqpayEnabledNow;
      if (!liqpayEnabledNow) {
        paymentPrepaymentViaLiqpay.checked = false;
      }
    }

    if (paymentPrepaymentHint) {
      paymentPrepaymentHint.textContent = acquiringEnabled
        ? "Клієнт сплачує вказану суму онлайн через підключений еквайринг, а залишок — при отриманні."
        : "Клієнт сплачує вказану суму онлайн через підключений еквайринг, а залишок — при отриманні. Щоб увімкнути Передоплату, активуйте Plata by mono або LiqPay.";
    }
  };

  applySettings(readSettings());
  updateAdminDocumentTitle();
  syncPrepaymentControls();
  mergeAndSaveSettings({
    currency: normalizeCurrencyCode(readSettings()?.currency || "uah"),
    telegramBotUsername: TELEGRAM_BOT_USERNAME,
    shippingNovaPostEnabled: readSettings()?.shippingNovaPostEnabled ?? true,
    shippingUkrPostEnabled: readSettings()?.shippingUkrPostEnabled ?? true,
    shippingNovaCourierEnabled: readSettings()?.shippingNovaCourierEnabled ?? false,
    paymentDeliveryMatrix: normalizePaymentDeliveryMatrix(readSettings()?.paymentDeliveryMatrix)
  });
  renderAdminTelegramSubscriptionControls();
  applyBackgroundPreview();
  updateNameCounter();
  updateDescriptionCounter();

  let orders = readOrders();
  let currentOrdersSearch = "";
  let currentOrderStatusFilter = "all";
  let currentOrderPaymentFilter = "all";
  let currentOrdersAmountFrom = null;
  let currentOrdersAmountTo = null;
  let currentOrdersPage = 1;
  if (!Array.isArray(orders)) {
    orders = [];
  }
  orders = orders
    .map((order) => normalizeOrder(order))
    .filter((order) => !isDemoOrder(order));
  saveOrders(orders);
  renderOrdersTable(orders);

  let knownOrderIds = new Set(orders.map((order) => String(order.id || "").trim()).filter(Boolean));
  let notifiedOrderIds = readNotifiedOrderIds();
  if (!notifiedOrderIds.size) {
    notifiedOrderIds = new Set(knownOrderIds);
    saveNotifiedOrderIds(notifiedOrderIds);
  }

  let isOrderNotificationSyncInProgress = false;
  const syncNewOrdersAndTelegramNotifications = async () => {
    if (isOrderNotificationSyncInProgress) return;
    isOrderNotificationSyncInProgress = true;

    try {
      const latestRawOrders = readOrders();
      if (!Array.isArray(latestRawOrders) || !latestRawOrders.length) return;

      const latestOrders = latestRawOrders.map((order) => normalizeOrder(order));
      const latestOrderIds = new Set(latestOrders.map((order) => String(order.id || "").trim()).filter(Boolean));
      const newOrders = latestOrders.filter((order) => {
        const orderId = String(order.id || "").trim();
        return orderId && !knownOrderIds.has(orderId);
      });

      // Замовлення, оплачені через Plata by mono, оновлюють paymentStatus у Firestore
      // асинхронно (вебхук), тому треба також оновлювати вже відомі замовлення,
      // а не лише додавати нові.
      const previousOrdersById = new Map(orders.map((order) => [String(order.id || "").trim(), order]));
      const hasUpdatedOrder = latestOrders.some((order) => {
        const orderId = String(order.id || "").trim();
        if (!orderId || !knownOrderIds.has(orderId)) return false;
        const previous = previousOrdersById.get(orderId);
        if (!previous) return false;
        return (
          previous.paymentStatus !== order.paymentStatus
          || previous.status !== order.status
          || previous.monoStatus !== order.monoStatus
          || previous.liqpayStatus !== order.liqpayStatus
          || previous.updatedAt !== order.updatedAt
        );
      });

      if (!newOrders.length && !hasUpdatedOrder) {
        knownOrderIds = latestOrderIds;
        return;
      }

      orders = latestOrders;
      saveOrders(orders);

      // Списати залишки для нових замовлень, що прийшли в реальному часі.
      applyInventoryForPendingOrders();

      renderOrdersTable(orders);
      if (currentSection === "sales") {
        renderSalesFromForm();
      }

      // Якщо зараз відкрита картка деталей саме цього замовлення, оновлюємо і її.
      const openOrderId = String(orderEditingId?.value || "").trim();
      if (openOrderId && orderDetailsModal?.classList.contains("open")) {
        const updatedOpenOrder = orders.find((order) => String(order.id || "").trim() === openOrderId);
        if (updatedOpenOrder) {
          fillOrderDetails(updatedOpenOrder);
        }
      }

      // Сповіщення надсилає бекенд (Cloud Function) під час оформлення
      // замовлення на вітрині. Тут лише позначаємо як опрацьовані.
      newOrders.forEach((order) => {
        const orderId = String(order.id || "").trim();
        if (orderId) {
          notifiedOrderIds.add(orderId);
        }
      });

      saveNotifiedOrderIds(notifiedOrderIds);
      knownOrderIds = latestOrderIds;
    } finally {
      isOrderNotificationSyncInProgress = false;
    }
  };

  window.addEventListener("storage", (event) => {
    if (event.key === ORDERS_KEY) {
      void syncNewOrdersAndTelegramNotifications();
    }
  });

  window.setInterval(() => {
    void syncNewOrdersAndTelegramNotifications();
  }, 5000);

  if (ordersSearchInput) {
    ordersSearchInput.addEventListener("input", () => {
      currentOrdersSearch = ordersSearchInput.value || "";
      currentOrdersPage = 1;
      renderOrdersTable(orders);
    });
  }

  const applyOrdersFilters = () => {
    currentOrderStatusFilter = ordersStatusFilter?.value || "all";
    currentOrderPaymentFilter = ordersPaymentFilter?.value || "all";
    currentOrdersPage = 1;

    const rawFrom = Number.parseFloat(ordersAmountFromFilter?.value || "");
    const rawTo = Number.parseFloat(ordersAmountToFilter?.value || "");

    currentOrdersAmountFrom = Number.isFinite(rawFrom) ? Math.max(0, rawFrom) : null;
    currentOrdersAmountTo = Number.isFinite(rawTo) ? Math.max(0, rawTo) : null;

    if (Number.isFinite(currentOrdersAmountFrom) && Number.isFinite(currentOrdersAmountTo) && currentOrdersAmountFrom > currentOrdersAmountTo) {
      const swappedFrom = currentOrdersAmountTo;
      const swappedTo = currentOrdersAmountFrom;
      currentOrdersAmountFrom = swappedFrom;
      currentOrdersAmountTo = swappedTo;

      if (ordersAmountFromFilter) {
        ordersAmountFromFilter.value = String(swappedFrom);
      }
      if (ordersAmountToFilter) {
        ordersAmountToFilter.value = String(swappedTo);
      }
    }

    renderOrdersTable(orders);
  };

  [ordersStatusFilter, ordersPaymentFilter, ordersAmountFromFilter, ordersAmountToFilter].forEach((control) => {
    if (!control) return;
    control.addEventListener("input", applyOrdersFilters);
    control.addEventListener("change", applyOrdersFilters);
  });

  if (ordersKpiCards.length) {
    const applyKpiFilter = (filterKey) => {
      let nextStatus = "all";
      if (filterKey === "new-today") nextStatus = "Нове";
      if (filterKey === "processing") nextStatus = "В обробці";
      if (filterKey === "shipped") nextStatus = "Відправлено";

      const shouldResetToAll = currentOrderStatusFilter === nextStatus;
      const finalStatus = shouldResetToAll ? "all" : nextStatus;

      if (ordersStatusFilter) {
        ordersStatusFilter.value = finalStatus;
        ordersStatusFilter.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        currentOrderStatusFilter = finalStatus;
        renderOrdersTable(orders);
      }
    };

    ordersKpiCards.forEach((card) => {
      const filterKey = String(card.dataset.ordersKpiFilter || "");
      if (!filterKey) return;

      card.addEventListener("click", () => {
        applyKpiFilter(filterKey);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        applyKpiFilter(filterKey);
      });
    });
  }

  const enhanceCustomSelect = (selectEl) => {
    if (!selectEl || selectEl.dataset.enhanced === "true") return;
    selectEl.dataset.enhanced = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-field";
    wrapper.setAttribute("role", "combobox");
    wrapper.setAttribute("aria-haspopup", "listbox");
    wrapper.setAttribute("aria-expanded", "false");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-field-trigger";
    const ariaLabel = selectEl.getAttribute("aria-label");
    if (ariaLabel) {
      trigger.setAttribute("aria-label", ariaLabel);
    }

    const valueSpan = document.createElement("span");
    valueSpan.className = "custom-select-field-value";

    const caret = document.createElement("span");
    caret.className = "custom-select-field-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "▾";

    trigger.appendChild(valueSpan);
    trigger.appendChild(caret);

    const list = document.createElement("ul");
    list.className = "custom-select-field-options";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    Array.from(selectEl.options).forEach((opt) => {
      const li = document.createElement("li");
      const optionBtn = document.createElement("button");
      optionBtn.type = "button";
      optionBtn.className = "custom-select-field-option";
      optionBtn.setAttribute("role", "option");
      optionBtn.dataset.value = opt.value;
      optionBtn.textContent = opt.textContent;
      li.appendChild(optionBtn);
      list.appendChild(li);
    });

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    wrapper.appendChild(trigger);
    wrapper.appendChild(list);
    selectEl.classList.add("custom-select-native-hidden");
    selectEl.setAttribute("tabindex", "-1");

    const syncLabel = () => {
      const selected = selectEl.options[selectEl.selectedIndex];
      valueSpan.textContent = selected ? selected.textContent : "";
      Array.from(list.querySelectorAll(".custom-select-field-option")).forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.value === selectEl.value);
      });
    };

    const setOpen = (open) => {
      list.hidden = !open;
      wrapper.classList.toggle("open", open);
      wrapper.setAttribute("aria-expanded", open ? "true" : "false");
    };

    trigger.addEventListener("click", () => setOpen(list.hidden));

    list.addEventListener("click", (event) => {
      const optionBtn = event.target.closest(".custom-select-field-option");
      if (!optionBtn) return;
      selectEl.value = optionBtn.dataset.value;
      syncLabel();
      setOpen(false);
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    });

    selectEl.addEventListener("change", syncLabel);

    document.addEventListener("mousedown", (event) => {
      if (wrapper.contains(event.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !list.hidden) {
        setOpen(false);
      }
    });

    syncLabel();
  };

  [ordersStatusFilter, ordersPaymentFilter, ordersBulkStatusSelect].forEach(enhanceCustomSelect);

  if (ordersFiltersReset) {
    ordersFiltersReset.addEventListener("click", () => {
      currentOrdersSearch = "";
      currentOrderStatusFilter = "all";
      currentOrderPaymentFilter = "all";
      currentOrdersAmountFrom = null;
      currentOrdersAmountTo = null;

      if (ordersSearchInput) {
        ordersSearchInput.value = "";
      }
      if (ordersStatusFilter) {
        ordersStatusFilter.value = "all";
        ordersStatusFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (ordersPaymentFilter) {
        ordersPaymentFilter.value = "all";
        ordersPaymentFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (ordersAmountFromFilter) {
        ordersAmountFromFilter.value = "";
      }
      if (ordersAmountToFilter) {
        ordersAmountToFilter.value = "";
      }

      currentOrdersPage = 1;
      renderOrdersTable(orders);
    });
  }

  if (ordersTableBody) {
    ordersTableBody.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".order-select");
      if (!checkbox) return;
      const orderId = String(checkbox.dataset.orderId || "").trim();
      if (!orderId) return;
      if (checkbox.checked) {
        selectedOrderIds.add(orderId);
      } else {
        selectedOrderIds.delete(orderId);
      }
      updateOrdersBulkUI();
    });
  }

  if (ordersSelectAll) {
    ordersSelectAll.addEventListener("change", () => {
      if (ordersSelectAll.checked) {
        lastVisibleOrderIds.forEach((id) => selectedOrderIds.add(id));
      } else {
        lastVisibleOrderIds.forEach((id) => selectedOrderIds.delete(id));
      }
      if (ordersTableBody) {
        ordersTableBody.querySelectorAll(".order-select").forEach((cb) => {
          cb.checked = selectedOrderIds.has(String(cb.dataset.orderId || "").trim());
        });
      }
      updateOrdersBulkUI();
    });
  }

  if (ordersBulkClear) {
    ordersBulkClear.addEventListener("click", () => {
      selectedOrderIds.clear();
      renderOrdersTable(orders);
    });
  }

  if (ordersBulkDelete) {
    ordersBulkDelete.addEventListener("click", () => {
      if (!selectedOrderIds.size) return;

      const confirmed = window.confirm(
        `Підтвердіть видалення обраних замовлень (${selectedOrderIds.size}).\n\nЦю дію неможливо скасувати.`
      );
      if (!confirmed) return;

      const deletedIds = new Set(selectedOrderIds);
      orders = orders.filter((item) => !deletedIds.has(String(item.id || "").trim()));
      selectedOrderIds.clear();
      saveOrders(orders);
      renderOrdersTable(orders);
      if (currentSection === "sales") {
        renderSalesFromForm();
      }

      if (orderDetailsModal?.classList.contains("open") && deletedIds.has(String(orderEditingId?.value || "").trim())) {
        setOrderDetailsModalOpen(false);
      }
    });
  }

  if (ordersBulkStatusApply) {
    ordersBulkStatusApply.addEventListener("click", () => {
      if (!selectedOrderIds.size) return;

      const nextStatus = String(ordersBulkStatusSelect?.value || "").trim();
      if (!nextStatus) return;

      const nowIso = new Date().toISOString();
      orders = orders.map((item) => {
        if (selectedOrderIds.has(String(item.id || "").trim())) {
          return { ...item, status: nextStatus, updatedAt: nowIso };
        }
        return item;
      });
      saveOrders(orders);
      renderOrdersTable(orders);
      if (currentSection === "sales") {
        renderSalesFromForm();
      }
    });
  }

  let promoCodes = readPromoCodes();
  if (!Array.isArray(promoCodes)) {
    promoCodes = [];
  }
  promoCodes = promoCodes
    .map((promoCode) => normalizePromoCode(promoCode))
    .filter((promoCode) => !isDemoPromoCode(promoCode));
  savePromoCodes(promoCodes);
  renderPromoCodesTable(promoCodes);

  const setPromoMessage = (message, isError = false) => {
    if (!promoCodeMessage) return;
    promoCodeMessage.classList.toggle("error", isError);
    promoCodeMessage.textContent = message;
  };

  if (generatePromoCodeBtn) {
    generatePromoCodeBtn.addEventListener("click", () => {
      if (!promoCodeValue) return;
      promoCodeValue.value = generatePromoCode(promoCodeCharset?.value || "letters");
      setPromoMessage("");
    });
  }

  if (promoCodeCharset) {
    promoCodeCharset.addEventListener("change", () => {
      if (promoCodeValue && /^\s*$/.test(promoCodeValue.value)) {
        promoCodeValue.value = generatePromoCode(promoCodeCharset.value);
      }
    });
  }

  if (promoCodeForm) {
    promoCodeForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const charset = promoCodeCharset?.value === "digits" ? "digits" : "letters";
      const discountType = promoDiscountType?.value === "uah" ? "uah" : "percent";
      const discountValue = Number.parseFloat(promoDiscountValue?.value || "0");
      const minOrderAmount = Number.parseFloat(promoMinOrderAmount?.value || "");
      const maxDiscountPerOrder = Number.parseFloat(promoMaxDiscountPerOrder?.value || "");
      const maxUsesPerClient = Number.parseInt(promoMaxUsesPerClient?.value || "1", 10);
      const maxUsesTotal = Number.parseInt(promoMaxUsesTotal?.value || "", 10);
      const managerComment = String(promoManagerComment?.value || "").trim().slice(0, 280);

      let code = String(promoCodeValue?.value || "").trim().toUpperCase();

      if (!code) {
        setPromoMessage("Вкажіть промо-код або згенеруйте його.", true);
        return;
      }

      if (charset === "digits" && !/^\d+$/.test(code)) {
        setPromoMessage("Для типу 'Цифри' промо-код має складатися лише з цифр.", true);
        return;
      }

      if (charset === "letters" && !/^[A-Z]+$/.test(code)) {
        setPromoMessage("Для типу 'Букви' промо-код має містити лише латинські літери A-Z.", true);
        return;
      }

      const duplicate = promoCodes.some((promoCode) => promoCode.code.toUpperCase() === code.toUpperCase());
      if (duplicate) {
        setPromoMessage("Промо-код з такою назвою вже існує.", true);
        return;
      }

      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        setPromoMessage("Вкажіть коректне значення знижки.", true);
        return;
      }

      if (discountType === "percent" && discountValue > 100) {
        setPromoMessage("Знижка у відсотках не може бути більшою за 100%.", true);
        return;
      }

      if (!Number.isFinite(maxUsesPerClient) || maxUsesPerClient < 1) {
        setPromoMessage("Ліміт використань для одного клієнта має бути не менше 1.", true);
        return;
      }

      if (!Number.isFinite(maxUsesTotal) || maxUsesTotal < 1) {
        setPromoMessage("Загальний ліміт використань має бути не менше 1.", true);
        return;
      }

      if (maxUsesPerClient > maxUsesTotal) {
        setPromoMessage("Ліміт для одного клієнта не може бути більшим за загальний ліміт.", true);
        return;
      }

      if (containsProfanity(managerComment)) {
        setPromoMessage("Коментар менеджера містить нецензурні слова.", true);
        return;
      }

      const promoCodePayload = normalizePromoCode({
        id: `promo-${Date.now()}`,
        code,
        charset,
        discountType,
        discountValue,
        minOrderAmount: Number.isFinite(minOrderAmount) ? minOrderAmount : null,
        maxDiscountPerOrder: Number.isFinite(maxDiscountPerOrder) ? maxDiscountPerOrder : null,
        maxUsesPerClient,
        maxUsesTotal,
        usedTotal: 0,
        managerComment,
        createdAt: new Date().toISOString()
      });

      promoCodes = [promoCodePayload, ...promoCodes];
      savePromoCodes(promoCodes);
      renderPromoCodesTable(promoCodes);

      promoCodeForm.reset();
      if (promoMaxUsesPerClient) {
        promoMaxUsesPerClient.value = "1";
      }
      setPromoMessage("Промо-код збережено");
      setPromoCodeModalOpen(false);
    });
  }

  if (openPromoCodeModal) {
    openPromoCodeModal.addEventListener("click", () => {
      if (promoCodeForm) {
        promoCodeForm.reset();
      }
      if (promoMaxUsesPerClient) {
        promoMaxUsesPerClient.value = "1";
      }
      setPromoMessage("");
      setPromoCodeModalOpen(true);
    });
  }

  if (closePromoCodeModal) {
    closePromoCodeModal.addEventListener("click", () => {
      setPromoCodeModalOpen(false);
    });
  }

  if (promoCodeModal) {
    promoCodeModal.addEventListener("click", (event) => {
      if (event.target === promoCodeModal) {
        setPromoCodeModalOpen(false);
      }
    });
  }

  if (promoCodesTableBody) {
    promoCodesTableBody.addEventListener("click", (event) => {
      const deleteButton = event.target.closest(".promo-delete-btn");
      if (!deleteButton) return;

      const promoId = deleteButton.dataset.promoId;
      if (!promoId) return;

      promoCodes = promoCodes.filter((promoCode) => promoCode.id !== promoId);
      savePromoCodes(promoCodes);
      renderPromoCodesTable(promoCodes);
      setPromoMessage("Промо-код видалено");
    });
  }

  if (billingPlansGrid) {
    billingPlansGrid.addEventListener("click", (event) => {
      const payButton = event.target.closest(".billing-pay-btn");
      if (!payButton) return;
      const planId = String(payButton.dataset.planId || "").trim();
      if (!planId) return;
      activatePlanPayment(planId);
    });
  }

  let currentProductsPage = 1;
  let currentProductsVisibilityFilter = "visible";
  let currentStockPage = 1;

  setProductsLoading(true);

  let products = readProducts();
  if (!Array.isArray(products)) {
    products = [];
  }
  products = products
    .map((product) => normalizeProduct(product))
    .filter((product) => !isDemoProduct(product));
  saveProducts(products);

  applyInventoryForPendingOrders();

  let categories = readCategories();
  if (!Array.isArray(categories)) {
    categories = [];
  }

  categories = categories.filter((category) => {
    if (!isDemoCategory(category)) return true;

    const categoryName = String(category?.name || "").trim().toLowerCase();
    const usedInProducts = products.some((product) => {
      const list = Array.isArray(product.categories) ? product.categories : [product.category];
      return list.some((value) => String(value || "").trim().toLowerCase() === categoryName);
    });

    return usedInProducts;
  });

  if (!categories || !categories.length) {
    categories = extractCategoriesFromProducts(products);
    saveCategories(categories);
  }

  renderProductsTable(products);
  renderCategoryOptions(getCategoryNames(categories));
  renderCategoriesList(categories);
  updateProductNameCounter();
  updateProductDescriptionCounter();
  updateCategoryNameCounter();

  if (categoryCreateForm) {
    categoryNameInput.addEventListener("input", () => {
      if (categoryNameInput.value.length > MAX_CATEGORY_NAME_LENGTH) {
        categoryNameInput.value = categoryNameInput.value.slice(0, MAX_CATEGORY_NAME_LENGTH);
      }
      updateCategoryNameCounter();
    });

    categoryCreateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const normalized = normalizeCategoryName(categoryNameInput.value);

      categorySavedMessage.classList.remove("error");

      if (!normalized) {
        categorySavedMessage.textContent = "Введіть назву категорії.";
        categorySavedMessage.classList.add("error");
        return;
      }

      if (containsProfanity(normalized)) {
        categorySavedMessage.textContent = "Назва категорії містить нецензурні слова.";
        categorySavedMessage.classList.add("error");
        return;
      }

      const categoryCapabilities = getPlanCapabilities();
      if (categories.length >= categoryCapabilities.maxCategories) {
        categorySavedMessage.textContent = `Ліміт тарифу «${categoryCapabilities.planName}»: до ${categoryCapabilities.maxCategories} категорій. Оновіть тариф, щоб додати більше.`;
        categorySavedMessage.classList.add("error");
        return;
      }

      const duplicate = categories.some((category) => category.name.toLowerCase() === normalized.toLowerCase());
      if (duplicate) {
        categorySavedMessage.textContent = "Категорія з такою назвою вже існує.";
        categorySavedMessage.classList.add("error");
        return;
      }

      if (typeof window.lavkaCheckActionRateLimit === "function") {
        const storeIdForLimit = await getAdminStoreId();
        const rateLimit = await window.lavkaCheckActionRateLimit("create-category", storeIdForLimit);
        if (!rateLimit.ok) {
          categorySavedMessage.textContent = "Забагато категорій створено за короткий час. Спробуйте трохи пізніше.";
          categorySavedMessage.classList.add("error");
          return;
        }
      }

      categories.push({
        id: `cat-${Date.now()}`,
        name: normalized
      });
      saveCategories(categories);
      renderCategoryOptions(getCategoryNames(categories));
      renderCategoriesList(categories);

      categoryCreateForm.reset();
      updateCategoryNameCounter();
      categorySavedMessage.textContent = "Категорію додано";
      setTimeout(() => {
        categorySavedMessage.textContent = "";
      }, 1600);
    });
  }

  if (ordersTableBody) {
    ordersTableBody.addEventListener("click", (event) => {
      const deleteButton = event.target.closest(".order-delete-btn");
      if (deleteButton) {
        const orderIdToDelete = String(deleteButton.dataset.orderId || "").trim();
        if (!orderIdToDelete) return;

        const orderToDelete = orders.find((item) => item.id === orderIdToDelete);
        if (!orderToDelete) return;

        const confirmed = window.confirm(
          `Підтвердіть видалення замовлення ${orderIdToDelete}.\n\nЦю дію неможливо скасувати.`
        );
        if (!confirmed) return;

        const restoreResult = restoreInventoryForOrder(orderToDelete);
        if (restoreResult.restored) {
          saveProducts(products);
          renderProductsTable(products);
        }

        orders = orders.filter((item) => item.id !== orderIdToDelete);
        saveOrders(orders);
        renderOrdersTable(orders);
        if (currentSection === "sales") {
          renderSalesFromForm();
        }

        if (orderDetailsModal?.classList.contains("open") && orderEditingId?.value === orderIdToDelete) {
          setOrderDetailsModalOpen(false);
        }

        return;
      }

      const detailsButton = event.target.closest(".order-open-btn");
      if (!detailsButton) return;

      const orderId = detailsButton.dataset.orderId;
      const order = orders.find((item) => item.id === orderId);
      if (!order) return;

      fillOrderDetails(order);
      setOrderDetailsModalOpen(true);
    });
  }

  if (closeOrderDetailsModal) {
    closeOrderDetailsModal.addEventListener("click", () => {
      setOrderDetailsModalOpen(false);
    });
  }

  if (orderDetailsModal) {
    orderDetailsModal.addEventListener("click", (event) => {
      if (event.target === orderDetailsModal) {
        setOrderDetailsModalOpen(false);
      }
    });
  }

  if (stockTableBody) {
    stockTableBody.addEventListener("click", (event) => {
      const editButton = event.target.closest(".stock-edit-btn");
      if (!editButton) return;

      const productId = String(editButton.dataset.productId || "").trim();
      const product = products.find((item) => item.id === productId);
      if (!product) return;

      if (stockEditingProductId) {
        stockEditingProductId.value = product.id;
      }
      if (stockProductLabel) {
        stockProductLabel.textContent = `${product.name} (${product.sku})`;
      }
      if (stockQuantityInput) {
        const stockValue = getProductTotalStock(product);
        stockQuantityInput.value = String(stockValue);
      }
      renderStockSizeFields(product);
      if (stockSavedMessage) {
        stockSavedMessage.textContent = "";
        stockSavedMessage.classList.remove("error");
      }

      setStockModalOpen(true);
    });
  }

  if (closeStockModal) {
    closeStockModal.addEventListener("click", () => {
      setStockModalOpen(false);
    });
  }

  if (stockModal) {
    stockModal.addEventListener("click", (event) => {
      if (event.target === stockModal) {
        setStockModalOpen(false);
      }
    });
  }

  if (stockSizeFields) {
    stockSizeFields.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.dataset.sizeStockInput !== "1") return;
      const parsed = Number.parseInt(target.value || "", 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        target.value = "0";
      }
      setStockSizeTotalHint();
    });
  }

  if (stockUpdateForm) {
    stockUpdateForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const editingId = String(stockEditingProductId?.value || "").trim();
      if (!editingId) return;

      const editingProduct = products.find((product) => product.id === editingId);
      if (!editingProduct) return;

      if (hasSizedStockAccounting(editingProduct)) {
        const sizeInputs = Array.from(stockSizeFields?.querySelectorAll('input[data-size-stock-input="1"]') || []);
        const nextSizeStocks = {};
        let hasInvalidValue = false;
        sizeInputs.forEach((input) => {
          const sizeKey = String(input.dataset.sizeKey || "").trim().toUpperCase();
          const parsed = Number.parseInt(input.value || "", 10);
          if (!sizeKey || !Number.isFinite(parsed) || parsed < 0) {
            hasInvalidValue = true;
            return;
          }
          nextSizeStocks[sizeKey] = parsed;
        });

        if (hasInvalidValue) {
          if (stockSavedMessage) {
            stockSavedMessage.classList.add("error");
            stockSavedMessage.textContent = "Вкажіть коректний залишок по кожному розміру (0 або більше).";
          }
          return;
        }

        const totalStock = Object.values(nextSizeStocks).reduce((sum, value) => sum + value, 0);
        products = products.map((product) => {
          if (product.id !== editingId) return product;
          return {
            ...product,
            sizeStocks: nextSizeStocks,
            stock: totalStock,
            updatedAt: new Date().toISOString()
          };
        });

        saveProducts(products);
        renderProductsTable(products);

        if (stockSavedMessage) {
          stockSavedMessage.classList.remove("error");
          stockSavedMessage.textContent = "Залишок по розмірах оновлено";
        }

        setTimeout(() => {
          setStockModalOpen(false);
        }, 300);
        return;
      }

      const parsedQty = Number.parseInt(stockQuantityInput?.value || "", 10);
      if (!Number.isFinite(parsedQty) || parsedQty < 0) {
        if (stockSavedMessage) {
          stockSavedMessage.classList.add("error");
          stockSavedMessage.textContent = "Вкажіть коректну кількість (0 або більше).";
        }
        return;
      }

      products = products.map((product) => {
        if (product.id !== editingId) return product;
        return {
          ...product,
          stock: parsedQty,
          updatedAt: new Date().toISOString()
        };
      });

      saveProducts(products);
      renderProductsTable(products);

      if (stockSavedMessage) {
        stockSavedMessage.classList.remove("error");
        stockSavedMessage.textContent = "Залишок оновлено";
      }

      setTimeout(() => {
        setStockModalOpen(false);
      }, 300);
    });
  }

  if (orderUpdateForm) {
    orderUpdateForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const editingId = orderEditingId?.value?.trim();
      if (!editingId) return;

      const status = orderStatusSelect?.value?.trim() || "Очікує";
      const paymentStatus = orderPaymentStatusSelect?.value?.trim() || "Не оплачено";
      const trackingNumber = orderTrackingNumber?.value?.trim() || "";
      const managerComment = orderManagerCommentInput?.value?.trim().slice(0, 280) || "";

      orders = orders.map((order) => {
        if (order.id !== editingId) return order;
        return {
          ...order,
          status,
          paymentStatus,
          trackingNumber,
          managerComment,
          updatedAt: new Date().toISOString()
        };
      });

      orders = orders.map((order) => {
        if (order.id !== editingId) return order;
        const result = applyInventoryForOrder(order);
        return result.order;
      });

      saveProducts(products);
      saveOrders(orders);
      renderOrdersTable(orders);
      renderProductsTable(products);
      if (currentSection === "sales") {
        renderSalesFromForm();
      }

      if (orderSavedMessage) {
        orderSavedMessage.classList.remove("error");
        orderSavedMessage.textContent = "Статус, оплата і ТТН збережено";
      }

      const updatedOrder = orders.find((order) => order.id === editingId);
      if (updatedOrder) {
        fillOrderDetails(updatedOrder);
      }
    });
  }

  if (productCreateForm) {
    applyProductUnitValue(productUnit?.value || "шт");

    if (storeCurrencyTrigger && storeCurrencyOptions) {
      storeCurrencyTrigger.addEventListener("click", () => {
        const shouldOpen = storeCurrencyOptions.hidden;
        setStoreCurrencyOpen(shouldOpen);
      });
    }

    if (storeCurrencyOptions) {
      storeCurrencyOptions.addEventListener("click", (event) => {
        const option = event.target.closest(".custom-unit-option");
        if (!option) return;
        const value = String(option.dataset.value || "").trim();
        applyStoreCurrencyValue(value);
        setStoreCurrencyOpen(false);
      });
    }

    document.addEventListener("mousedown", (event) => {
      if (!storeCurrencySelect) return;
      if (storeCurrencySelect.contains(event.target)) return;
      setStoreCurrencyOpen(false);
    });

    if (productUnitTrigger && productUnitSelect && productUnitOptions) {
      productUnitTrigger.addEventListener("click", () => {
        const shouldOpen = productUnitOptions.hidden;
        productUnitOptions.hidden = !shouldOpen;
        productUnitSelect.classList.toggle("open", shouldOpen);
        productUnitSelect.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      });
    }

    if (productUnitOptions && productUnitSelect) {
      productUnitOptions.addEventListener("click", (event) => {
        const option = event.target.closest(".custom-unit-option");
        if (!option) return;
        const value = String(option.dataset.value || "").trim();
        applyProductUnitValue(value);
        productUnitOptions.hidden = true;
        productUnitSelect.classList.remove("open");
        productUnitSelect.setAttribute("aria-expanded", "false");
      });
    }

    if (productIsClothing) {
      productIsClothing.addEventListener("change", () => {
        syncProductSizesVisibility();
        if (!productIsClothing.checked) {
          clearProductSizesSelection();
        }
      });
      syncProductSizesVisibility();
    }

    document.addEventListener("mousedown", (event) => {
      if (!productUnitSelect || !productUnitOptions) return;
      if (productUnitSelect.contains(event.target)) return;
      productUnitOptions.hidden = true;
      productUnitSelect.classList.remove("open");
      productUnitSelect.setAttribute("aria-expanded", "false");
    });

    productName.addEventListener("input", () => {
      if (productName.value.length > MAX_PRODUCT_NAME_LENGTH) {
        productName.value = productName.value.slice(0, MAX_PRODUCT_NAME_LENGTH);
      }
      updateProductNameCounter();
    });

    productDescription.addEventListener("input", () => {
      if (productDescription.value.length > MAX_PRODUCT_DESCRIPTION_LENGTH) {
        productDescription.value = productDescription.value.slice(0, MAX_PRODUCT_DESCRIPTION_LENGTH);
      }
      updateProductDescriptionCounter();
    });

    productPhotos.addEventListener("change", () => {
      if (!productSavedMessage) return;
      const files = Array.from(productPhotos.files || []);
      const photoError = validatePhotos(files);
      if (photoError) {
        productSavedMessage.textContent = photoError;
        productSavedMessage.classList.add("error");
        productPhotos.value = "";
        currentProductSelectedFiles = [];
        refreshProductPhotoPreview();
        return;
      }
      if (files.length) {
        const totalBytes = files.reduce((sum, file) => sum + (Number(file?.size) || 0), 0);
        const policy = getPhotoPolicyByPlan();
        productSavedMessage.textContent = `Обрано ${files.length} з ${policy.maxPhotos}. Загальна вага: ${formatMegabytes(totalBytes)} МБ.`;
        currentProductSelectedFiles = files;
        refreshProductPhotoPreview();
      } else {
        currentProductSelectedFiles = [];
        productSavedMessage.textContent = getPhotoPolicyHint();
        refreshProductPhotoPreview();
      }
      productSavedMessage.classList.remove("error");
    });

    productCreateForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const editingId = productEditingId.value.trim();
      const normalizedName = productName.value.trim().slice(0, MAX_PRODUCT_NAME_LENGTH);
      const normalizedDescription = productDescription.value.trim().slice(0, MAX_PRODUCT_DESCRIPTION_LENGTH);
      const normalizedSku = productSku.value.trim().toUpperCase();
      const normalizedCategories = Array.from(productCategories.querySelectorAll('input[type="checkbox"]:checked'))
        .map((checkbox) => normalizeCategoryName(checkbox.value))
        .filter(Boolean);
      const parsedPrice = Number.parseInt(productPrice.value, 10);
      const normalizedUnit = String(productUnit?.value || "шт").trim() || "шт";
      const isClothing = Boolean(productIsClothing?.checked);
      const selectedSizes = isClothing ? collectProductSizes() : [];
      const isVisible = Boolean(productVisible.checked);
      const files = Array.isArray(currentProductSelectedFiles) ? currentProductSelectedFiles : [];
      const categoryNames = getCategoryNames(categories);
      const existingProduct = editingId ? products.find((product) => product.id === editingId) : null;

      productSavedMessage.classList.remove("error");

      if (editingId && !existingProduct) {
        productSavedMessage.textContent = "Не вдалося знайти товар для редагування.";
        productSavedMessage.classList.add("error");
        return;
      }

      if (!editingId) {
        const capabilities = getPlanCapabilities();
        if (products.length >= capabilities.maxProducts) {
          productSavedMessage.textContent = `Ліміт тарифу «${capabilities.planName}»: до ${capabilities.maxProducts} товарів. Оновіть тариф, щоб додати більше.`;
          productSavedMessage.classList.add("error");
          return;
        }
      }

      if (!normalizedName || !normalizedSku || !normalizedDescription || !normalizedCategories.length || !parsedPrice) {
        productSavedMessage.textContent = "Заповніть усі поля товару.";
        productSavedMessage.classList.add("error");
        return;
      }

      if (containsProfanity(normalizedName) || containsProfanity(normalizedDescription)) {
        productSavedMessage.textContent = "Назва або опис містять нецензурні слова.";
        productSavedMessage.classList.add("error");
        return;
      }

      const containsUnknownCategory = normalizedCategories.some((categoryName) => !categoryNames.includes(categoryName));
      if (containsUnknownCategory) {
        productSavedMessage.textContent = "Категорію можна обирати лише з наявного списку.";
        productSavedMessage.classList.add("error");
        return;
      }

      if (isClothing && !selectedSizes.length) {
        productSavedMessage.textContent = "Для одягу оберіть хоча б один розмір.";
        productSavedMessage.classList.add("error");
        return;
      }

      const skuExists = products.some((product) => product.sku.toUpperCase() === normalizedSku && product.id !== editingId);
      if (skuExists) {
        productSavedMessage.textContent = "Товар з таким артикулом вже існує.";
        productSavedMessage.classList.add("error");
        return;
      }

      const photoError = validatePhotos(files);
      if (photoError) {
        productSavedMessage.textContent = photoError;
        productSavedMessage.classList.add("error");
        return;
      }

      if (!editingId && typeof window.lavkaCheckActionRateLimit === "function") {
        const storeIdForLimit = await getAdminStoreId();
        const rateLimit = await window.lavkaCheckActionRateLimit("create-product", storeIdForLimit);
        if (!rateLimit.ok) {
          productSavedMessage.textContent = "Забагато товарів створено за короткий час. Спробуйте трохи пізніше.";
          productSavedMessage.classList.add("error");
          return;
        }
      }

      const nextProductId = editingId || `product-${Date.now()}`;

      let nextPhotos = Array.isArray(currentProductStoredPhotos)
        ? [...currentProductStoredPhotos]
        : (existingProduct?.photos || []);
      if (files.length) {
        try {
          productSavedMessage.textContent = "Завантажуємо фото у базу...";
          nextPhotos = await convertProductFilesToStoredPhotos(files, nextProductId);
        } catch (photoProcessingError) {
          console.error("[admin] photo upload failed", photoProcessingError);
          productSavedMessage.textContent = "Не вдалося завантажити фото у базу. Спробуйте ще раз.";
          productSavedMessage.classList.add("error");
          return;
        }
      }

      const preservedSizeStocks = isClothing
        ? selectedSizes.reduce((acc, sizeKey) => {
            const current = Number.parseInt(existingProduct?.sizeStocks?.[sizeKey], 10);
            acc[sizeKey] = Number.isFinite(current) && current > 0 ? current : 0;
            return acc;
          }, {})
        : {};
      const totalStockFromSizes = Object.values(preservedSizeStocks).reduce((sum, value) => sum + value, 0);

      const nextProduct = {
        id: nextProductId,
        sku: normalizedSku,
        name: normalizedName,
        category: normalizedCategories[0],
        categories: normalizedCategories,
        description: normalizedDescription,
        price: parsedPrice,
        unit: normalizedUnit,
        isClothing,
        sizes: selectedSizes,
        sizeStocks: preservedSizeStocks,
        stock: isClothing ? totalStockFromSizes : (existingProduct?.stock ?? 0),
        discount: existingProduct?.discount || null,
        visible: isVisible,
        photos: nextPhotos,
        createdAt: existingProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      currentProductStoredPhotos = Array.isArray(nextProduct.photos) ? nextProduct.photos : [];
      currentProductSelectedFiles = [];
      productPhotos.value = "";
      refreshProductPhotoPreview();

      if (editingId) {
        products = products.map((product) => (product.id === editingId ? nextProduct : product));
      } else {
        products = [nextProduct, ...products];
        currentProductsPage = 1;
      }

      saveProducts(products);
      renderProductsTable(products);
      renderCategoryOptions(getCategoryNames(categories));

      productSavedMessage.textContent = editingId ? "Товар оновлено" : "Товар створено";
      setProductModalOpen(false);
      setTimeout(() => {
        productSavedMessage.textContent = "";
      }, 1800);
    });

    productsTableBody.addEventListener("click", (event) => {
      const toggleButton = event.target.closest(".product-toggle-visibility-btn");
      if (toggleButton) {
        const { productId } = toggleButton.dataset;
        products = products.map((product) => {
          if (product.id !== productId) return product;
          return {
            ...product,
            visible: !(product.visible !== false),
            updatedAt: new Date().toISOString()
          };
        });
        saveProducts(products);
        renderProductsTable(products);
        return;
      }

      const deleteButton = event.target.closest(".product-delete-btn");
      if (deleteButton) {
        const { productId } = deleteButton.dataset;
        const product = products.find((item) => item.id === productId);
        if (!product) return;

        const confirmed = window.confirm(
          `Видалити товар «${product.name}»?\n\nЦю дію неможливо скасувати.`
        );
        if (!confirmed) return;

        products = products.filter((item) => item.id !== productId);
        selectedProductIds.delete(productId);
        saveProducts(products);
        renderProductsTable(products);
        return;
      }

      const editButton = event.target.closest(".product-edit-btn");
      if (!editButton) return;

      const { productId } = editButton.dataset;
      const product = products.find((item) => item.id === productId);
      if (!product) return;

      setProductFormMode("edit", product);
      setProductModalOpen(true);
    });

    productsTableBody.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".product-select-checkbox");
      if (!checkbox) return;
      const { productId } = checkbox.dataset;
      if (!productId) return;

      if (checkbox.checked) {
        selectedProductIds.add(productId);
      } else {
        selectedProductIds.delete(productId);
      }
      updateBulkSelectionState();
    });

    if (selectAllProductsOnPage) {
      selectAllProductsOnPage.addEventListener("change", () => {
        if (!currentPageProductIds.length) return;

        currentPageProductIds.forEach((id) => {
          if (selectAllProductsOnPage.checked) {
            selectedProductIds.add(id);
          } else {
            selectedProductIds.delete(id);
          }
        });
        renderProductsTable(products);
      });
    }

    const getSelectedProducts = () => products.filter((product) => selectedProductIds.has(product.id));

    if (applyBulkPrice) {
      applyBulkPrice.addEventListener("click", () => {
        const selected = getSelectedProducts();
        if (!selected.length) {
          showBulkMessage("Оберіть хоча б один товар.", true);
          return;
        }

        const value = Number.parseFloat(bulkPriceValue?.value || "0");
        if (!Number.isFinite(value) || value <= 0) {
          showBulkMessage("Вкажіть коректне значення для зміни ціни.", true);
          return;
        }

        const operation = bulkPriceOperation?.value === "decrease" ? "decrease" : "increase";
        const unit = bulkPriceUnit?.value === "percent" ? "percent" : "uah";

        products = products.map((product) => {
          if (!selectedProductIds.has(product.id)) return product;

          const delta = unit === "percent"
            ? product.price * (value / 100)
            : value;

          const nextPrice = operation === "decrease"
            ? Math.max(1, product.price - delta)
            : product.price + delta;

          const roundedNextPrice = Math.round(nextPrice * 100) / 100;

          return {
            ...product,
            price: roundedNextPrice,
            updatedAt: new Date().toISOString()
          };
        });

        saveProducts(products);
        renderProductsTable(products);
        showBulkMessage("Ціну для вибраних товарів оновлено.");
      });
    }

    if (applyBulkVisibility) {
      applyBulkVisibility.addEventListener("click", () => {
        const selected = getSelectedProducts();
        if (!selected.length) {
          showBulkMessage("Оберіть хоча б один товар.", true);
          return;
        }

        const nextVisible = bulkVisibilityValue?.value !== "hidden";
        products = products.map((product) => {
          if (!selectedProductIds.has(product.id)) return product;
          return {
            ...product,
            visible: nextVisible,
            updatedAt: new Date().toISOString()
          };
        });

        saveProducts(products);
        renderProductsTable(products);
        showBulkMessage("Видимість вибраних товарів оновлено.");
      });
    }

    if (applyBulkDiscount) {
      applyBulkDiscount.addEventListener("click", () => {
        const selected = getSelectedProducts();
        if (!selected.length) {
          showBulkMessage("Оберіть хоча б один товар.", true);
          return;
        }

        const value = Number.parseFloat(bulkDiscountValue?.value || "0");
        if (!Number.isFinite(value) || value < 0) {
          showBulkMessage("Вкажіть коректне значення знижки.", true);
          return;
        }

        const unit = bulkDiscountUnit?.value === "percent" ? "percent" : "uah";
        if (unit === "percent" && value > 100) {
          showBulkMessage("Знижка у відсотках не може бути більшою за 100%.", true);
          return;
        }

        const nextDiscount = value === 0
          ? null
          : {
              type: unit,
              value: unit === "percent" ? Math.min(100, value) : value
            };

        products = products.map((product) => {
          if (!selectedProductIds.has(product.id)) return product;
          return {
            ...product,
            discount: nextDiscount,
            updatedAt: new Date().toISOString()
          };
        });

        saveProducts(products);
        renderProductsTable(products);
        showBulkMessage("Знижку для вибраних товарів оновлено.");
      });
    }

    if (applyBulkDelete) {
      applyBulkDelete.addEventListener("click", () => {
        const selected = getSelectedProducts();
        if (!selected.length) {
          showBulkMessage("Оберіть хоча б один товар.", true);
          return;
        }

        const confirmed = window.confirm(
          `Видалити вибрані товари (${selected.length})?\n\nЦю дію неможливо скасувати.`
        );
        if (!confirmed) return;

        const selectedIds = new Set(selected.map((item) => item.id));
        products = products.filter((item) => !selectedIds.has(item.id));
        selectedProductIds.clear();

        saveProducts(products);
        renderProductsTable(products);
        showBulkMessage(`Видалено товарів: ${selected.length}.`);
      });
    }

    if (clearBulkSelection) {
      clearBulkSelection.addEventListener("click", () => {
        clearBulkSelectionState();
        renderProductsTable(products);
        showBulkMessage("Вибір очищено.");
      });
    }

    if (productsPagination) {
      productsPagination.addEventListener("click", (event) => {
        const button = event.target.closest(".products-page-btn");
        if (!button || button.disabled) return;

        const nextPage = Number.parseInt(button.dataset.page || "", 10);
        if (!Number.isFinite(nextPage) || nextPage < 1) return;

        currentProductsPage = nextPage;
        renderProductsTable(products);
      });
    }

    if (stockPagination) {
      stockPagination.addEventListener("click", (event) => {
        const button = event.target.closest(".products-page-btn");
        if (!button || button.disabled) return;

        const nextPage = Number.parseInt(button.dataset.page || "", 10);
        if (!Number.isFinite(nextPage) || nextPage < 1) return;

        currentStockPage = nextPage;
        renderStockTable(products);
      });
    }

    if (ordersPagination) {
      ordersPagination.addEventListener("click", (event) => {
        const button = event.target.closest(".products-page-btn");
        if (!button || button.disabled) return;

        const nextPage = Number.parseInt(button.dataset.page || "", 10);
        if (!Number.isFinite(nextPage) || nextPage < 1) return;

        currentOrdersPage = nextPage;
        renderOrdersTable(orders);
      });
    }

    const setProductsVisibilityFilter = (filter) => {
      currentProductsVisibilityFilter = filter;
      currentProductsPage = 1;

      if (showVisibleProducts) {
        showVisibleProducts.classList.toggle("active", filter === "visible");
      }
      if (showHiddenProducts) {
        showHiddenProducts.classList.toggle("active", filter === "hidden");
      }

      renderProductsTable(products);
      updateBulkSelectionState();
    };

    if (showVisibleProducts) {
      showVisibleProducts.addEventListener("click", () => {
        setProductsVisibilityFilter("visible");
      });
    }

    if (showHiddenProducts) {
      showHiddenProducts.addEventListener("click", () => {
        setProductsVisibilityFilter("hidden");
      });
    }
  }

  if (openProductModal) {
    openProductModal.addEventListener("click", () => {
      setProductFormMode("create");
      setProductModalOpen(true);
    });
  }

  if (closeProductModal) {
    closeProductModal.addEventListener("click", () => {
      setProductModalOpen(false);
    });
  }

  if (productModal) {
    productModal.addEventListener("click", (event) => {
      if (event.target === productModal) {
        setProductModalOpen(false);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && stockModal && stockModal.classList.contains("open")) {
      setStockModalOpen(false);
      return;
    }

    if (event.key === "Escape" && promoCodeModal && promoCodeModal.classList.contains("open")) {
      setPromoCodeModalOpen(false);
      return;
    }

    if (event.key === "Escape" && orderDetailsModal && orderDetailsModal.classList.contains("open")) {
      setOrderDetailsModalOpen(false);
      return;
    }

    if (event.key === "Escape" && productModal && productModal.classList.contains("open")) {
      setProductModalOpen(false);
    }
  });

  if (settingsForm) {
    if (minimumOrderEnabled) {
      minimumOrderEnabled.addEventListener("change", () => {
        syncMinimumOrderControls();
      });
    }

    storeName.addEventListener("input", () => {
      if (storeName.value.length > MAX_NAME_LENGTH) {
        storeName.value = storeName.value.slice(0, MAX_NAME_LENGTH);
      }
      updateAdminDocumentTitle(storeName.value);
      updateNameCounter();
    });

    storeDescription.addEventListener("input", () => {
      if (storeDescription.value.length > MAX_DESCRIPTION_LENGTH) {
        storeDescription.value = storeDescription.value.slice(0, MAX_DESCRIPTION_LENGTH);
      }
      updateDescriptionCounter();
    });

    storeAvatar.addEventListener("input", () => {
      if (storeAvatar.value.trim()) {
        avatarPreview.src = storeAvatar.value.trim();
      }
    });

    avatarPreview.addEventListener("error", () => {
      avatarPreview.src = EMPTY_AVATAR_SRC;
    });

    storeAvatarFile.addEventListener("change", () => {
      const [file] = storeAvatarFile.files || [];
      if (!file) return;

      if (file.size > MAX_AVATAR_FILE_SIZE) {
        savedMessage.textContent = "Файл завеликий. Максимальний розмір аватарки: 3 МБ.";
        savedMessage.classList.add("error");
        storeAvatarFile.value = "";
        return;
      }

      savedMessage.classList.remove("error");
      savedMessage.textContent = "Завантажуємо фото...";
      storeAvatarFile.disabled = true;

      const storeId = resolveStoreIdForUploads();
      uploadStoreAvatarToStorage(file, storeId)
        .then((url) => {
          storeAvatar.value = url;
          avatarPreview.src = url;
          savedMessage.classList.remove("error");
          savedMessage.textContent = "Фото завантажено. Натисніть «Зберегти», щоб застосувати.";
        })
        .catch((error) => {
          console.error("[admin] avatar upload failed", error);
          savedMessage.classList.add("error");
          savedMessage.textContent = "Не вдалося завантажити фото. Спробуйте ще раз.";
        })
        .finally(() => {
          storeAvatarFile.disabled = false;
          storeAvatarFile.value = "";
        });
    });

    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const normalizedName = storeName.value.trim().slice(0, MAX_NAME_LENGTH);
      const normalizedDescription = storeDescription.value.trim().slice(0, MAX_DESCRIPTION_LENGTH);

      savedMessage.classList.remove("error");

      if (containsProfanity(normalizedName) || containsProfanity(normalizedDescription)) {
        savedMessage.textContent = "Текст містить нецензурні слова. Виправте опис або назву.";
        savedMessage.classList.add("error");
        return;
      }

      storeName.value = normalizedName;
      storeDescription.value = normalizedDescription;
      updateNameCounter();
      updateDescriptionCounter();

      const minimumEnabled = Boolean(minimumOrderEnabled?.checked);
      const minimumValueRaw = Number.parseFloat(minimumOrderAmount?.value || "");
      const minimumValue = Number.isFinite(minimumValueRaw) ? Math.max(1, Math.round(minimumValueRaw)) : null;

      if (minimumEnabled && !minimumValue) {
        savedMessage.textContent = "Вкажіть мінімальну суму замовлення (1 грн і більше).";
        savedMessage.classList.add("error");
        return;
      }

      mergeAndSaveSettings({
        name: normalizedName,
        description: normalizedDescription,
        avatar: storeAvatar.value.trim(),
        currency: normalizeCurrencyCode(storeCurrency?.value || "uah"),
        minimumOrderEnabled: minimumEnabled,
        minimumOrderAmount: minimumEnabled ? minimumValue : null,
        hideWatermark: Boolean(getPlanCapabilities().removeWatermark) && Boolean(hideWatermarkEnabled?.checked),
        instagram: socialInstagram.value.trim(),
        instagramEnabled: socialInstagramEnabled.checked,
        facebook: socialFacebook.value.trim(),
        facebookEnabled: socialFacebookEnabled.checked,
        telegram: socialTelegram.value.trim(),
        telegramEnabled: socialTelegramEnabled.checked,
        tiktok: socialTiktok.value.trim(),
        tiktokEnabled: socialTiktokEnabled.checked
      });

      updateAdminDocumentTitle(normalizedName);

      savedMessage.textContent = "Зміни збережено";
      setTimeout(() => {
        savedMessage.textContent = "";
      }, 1800);
    });
  }

  if (personalizationForm) {
    if (siteBackgroundType) {
      siteBackgroundType.addEventListener("change", () => {
        applyBackgroundPreview();
      });
    }

    if (siteBackgroundColor) {
      siteBackgroundColor.addEventListener("input", () => {
        applyBackgroundPreview();
      });
    }

    if (siteBackgroundImage) {
      siteBackgroundImage.addEventListener("input", () => {
        applyBackgroundPreview();
      });
    }

    if (siteBackgroundImageFile) {
      siteBackgroundImageFile.addEventListener("change", () => {
        const [file] = siteBackgroundImageFile.files || [];
        if (!file) return;

        if (file.size > MAX_BACKGROUND_FILE_SIZE) {
          personalizationSavedMessage.textContent = "Файл завеликий. Максимальний розмір фону: 5 МБ.";
          personalizationSavedMessage.classList.add("error");
          siteBackgroundImageFile.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            siteBackgroundImage.value = reader.result;
            siteBackgroundType.value = "image";
            personalizationSavedMessage.classList.remove("error");
            personalizationSavedMessage.textContent = "";
            applyBackgroundPreview();
          }
        };
        reader.readAsDataURL(file);
      });
    }

    if (clearBackgroundImage) {
      clearBackgroundImage.addEventListener("click", () => {
        siteBackgroundImage.value = "";
        siteBackgroundImageFile.value = "";
        siteBackgroundType.value = "color";
        applyBackgroundPreview();
      });
    }

    personalizationForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const normalizedBackgroundType = siteBackgroundType.value === "image" ? "image" : "color";
      const normalizedBackgroundColor = isHexColor(siteBackgroundColor.value) ? siteBackgroundColor.value : "#eef1f4";
      const normalizedBackgroundImage = String(siteBackgroundImage.value || "").trim();

      mergeAndSaveSettings({
        cartIconColor: cartIconColor.value,
        siteColor: siteColor.value,
        siteBackgroundType: normalizedBackgroundType,
        siteBackgroundColor: normalizedBackgroundColor,
        siteBackgroundImage: normalizedBackgroundImage
      });

      personalizationSavedMessage.classList.remove("error");
      personalizationSavedMessage.textContent = "Персоналізацію збережено";
      setTimeout(() => {
        personalizationSavedMessage.textContent = "";
      }, 1800);
    });
  }

  const handleTelegramEnabledToggle = async () => {
    const desiredEnabled = Boolean(telegramOrderNotifyEnabled?.checked);

    if (!telegramConnectionState.linked) {
      if (telegramOrderNotifyEnabled) {
        telegramOrderNotifyEnabled.checked = false;
      }
      setTelegramMessage("Спочатку підключіть Telegram.", true);
      return;
    }

    const storeId = await getAdminStoreId();
    if (!storeId || storeId === "default-store") return;

    try {
      await callDomainFunction("telegramSetEnabled", { storeId, enabled: desiredEnabled });
      telegramConnectionState.enabled = desiredEnabled;
      mergeAndSaveSettings({ telegramOrderNotifyEnabled: desiredEnabled });
      renderTelegramConnectionState();
      setTelegramMessage(desiredEnabled ? "Сповіщення увімкнено." : "Сповіщення вимкнено.", false);
    } catch {
      if (telegramOrderNotifyEnabled) {
        telegramOrderNotifyEnabled.checked = !desiredEnabled;
      }
      setTelegramMessage("Не вдалося оновити стан. Спробуйте ще раз.", true);
    }
  };

  const handleTelegramDisconnect = async () => {
    const storeId = await getAdminStoreId();
    if (!storeId || storeId === "default-store") return;

    if (telegramDisconnectBtn) {
      telegramDisconnectBtn.disabled = true;
    }
    try {
      await callDomainFunction("telegramDisconnect", { storeId });
      telegramConnectionState = { linked: false, enabled: false, chatId: "" };
      mergeAndSaveSettings({ telegramOrderNotifyEnabled: false });
      renderTelegramConnectionState();
      setTelegramMessage("Telegram відключено.", false);
    } catch {
      setTelegramMessage("Не вдалося відключити. Спробуйте ще раз.", true);
    } finally {
      if (telegramDisconnectBtn) {
        telegramDisconnectBtn.disabled = false;
      }
    }
  };

  if (telegramOrderNotifyEnabled) {
    telegramOrderNotifyEnabled.addEventListener("change", () => {
      void handleTelegramEnabledToggle();
    });
  }

  if (telegramConnectBtn) {
    telegramConnectBtn.addEventListener("click", () => {
      if (telegramConnectBtn.getAttribute("aria-disabled") === "true") {
        return;
      }
      setTelegramMessage("Після /start у боті магазин підключиться автоматично.", false);
      startTelegramStatusPolling();
    });
  }

  if (telegramDisconnectBtn) {
    telegramDisconnectBtn.addEventListener("click", () => {
      void handleTelegramDisconnect();
    });
  }

  if (telegramNotificationsForm) {
    telegramNotificationsForm.addEventListener("submit", (event) => {
      event.preventDefault();
    });
  }

  if (paymentMethodsForm) {
    if (paymentMonoEnabled) {
      paymentMonoEnabled.addEventListener("change", syncPrepaymentControls);
    }
    if (paymentLiqpayEnabled) {
      paymentLiqpayEnabled.addEventListener("change", syncPrepaymentControls);
    }
    if (paymentPrepaymentEnabled) {
      paymentPrepaymentEnabled.addEventListener("change", syncPrepaymentControls);
    }

    paymentMethodsForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const monoEnabled = Boolean(paymentMonoEnabled?.checked);
      const liqpayEnabled = Boolean(paymentLiqpayEnabled?.checked);
      const codEnabled = Boolean(paymentCodEnabled?.checked);
      const acquiringEnabled = Boolean(monoEnabled || liqpayEnabled);
      const prepaymentEnabled = acquiringEnabled && Boolean(paymentPrepaymentEnabled?.checked);
      const bankTransferEnabled = Boolean(paymentBankTransferEnabled?.checked);
      const monoSecret = String(paymentMonoSecret?.value || "").trim();
      const liqpayPublicKey = String(paymentLiqpayPublicKey?.value || "").trim();
      const liqpayPrivateKey = String(paymentLiqpayPrivateKey?.value || "").trim();
      const hasMonoSecret = Boolean(monoSecret || acquirerSecretsStatus.hasMonoSecret);
      const hasLiqpayPrivateKey = Boolean(liqpayPrivateKey || acquirerSecretsStatus.hasLiqpayPrivateKey);
      const codFee = String(paymentCodFee?.value || "").trim();
      const prepaymentAmount = Math.max(0, Math.round(Number(paymentPrepaymentAmount?.value) || 0));
      const prepaymentAcquirer = (monoEnabled && paymentPrepaymentViaMono?.checked)
        ? "mono"
        : ((liqpayEnabled && paymentPrepaymentViaLiqpay?.checked) ? "liqpay" : "");
      const bankRequisites = String(paymentBankRequisites?.value || "").trim();

      if (paymentsSavedMessage) {
        paymentsSavedMessage.classList.remove("error");
      }

      if (monoEnabled && !hasMonoSecret) {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Для Plata by mono вкажіть Secret key (API key).";
          paymentsSavedMessage.classList.add("error");
        }
        return;
      }

      if (liqpayEnabled && (!liqpayPublicKey || !hasLiqpayPrivateKey)) {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Для LiqPay вкажіть Public key і Private key.";
          paymentsSavedMessage.classList.add("error");
        }
        return;
      }

      if (bankTransferEnabled && !bankRequisites) {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Для оплати на реквізити заповніть банківські дані.";
          paymentsSavedMessage.classList.add("error");
        }
        return;
      }

      if (prepaymentEnabled && prepaymentAmount <= 0) {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Для Передоплати вкажіть суму більше 0 грн.";
          paymentsSavedMessage.classList.add("error");
        }
        return;
      }

      if (prepaymentEnabled && !prepaymentAcquirer) {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Оберіть еквайринг (Plata by mono або LiqPay) для прийому Передоплати.";
          paymentsSavedMessage.classList.add("error");
        }
        return;
      }

      if (!acquiringEnabled && Boolean(paymentPrepaymentEnabled?.checked)) {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Передоплата доступна лише з активним еквайрингом (Plata by mono або LiqPay).";
          paymentsSavedMessage.classList.add("error");
        }
        syncPrepaymentControls();
        return;
      }

      try {
        await saveAcquirerSecrets({ monoSecret, liqpayPrivateKey });
      } catch (error) {
        console.warn("saveAcquirerSecrets error:", error);
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Не вдалося зберегти API ключі. Спробуйте ще раз.";
          paymentsSavedMessage.classList.add("error");
        }
        return;
      }

      mergeAndSaveSettings({
        paymentMonoEnabled: monoEnabled,
        paymentLiqpayEnabled: liqpayEnabled,
        paymentLiqpayPublicKey: liqpayPublicKey,
        paymentCodEnabled: codEnabled,
        paymentCodFee: codFee,
        paymentPrepaymentEnabled: prepaymentEnabled,
        paymentPrepaymentAmount: prepaymentAmount,
        paymentPrepaymentAcquirer: prepaymentAcquirer,
        paymentBankTransferEnabled: bankTransferEnabled,
        paymentBankRequisites: bankRequisites,
        paymentDeliveryMatrix: collectPaymentDeliveryMatrixFromUi()
      });

      if (paymentMonoSecret) paymentMonoSecret.value = "";
      if (paymentLiqpayPrivateKey) paymentLiqpayPrivateKey.value = "";

      syncPrepaymentControls();

      if (paymentsSavedMessage) {
        paymentsSavedMessage.textContent = "Способи оплати збережено.";
      }

      setTimeout(() => {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "";
        }
      }, 2200);
    });
  }

  if (shippingMethodsForm) {
    shippingMethodsForm.addEventListener("submit", (event) => {
      event.preventDefault();

      mergeAndSaveSettings({
        shippingNovaPostEnabled: Boolean(shippingNovaPostEnabled?.checked),
        shippingUkrPostEnabled: Boolean(shippingUkrPostEnabled?.checked),
        shippingNovaCourierEnabled: Boolean(shippingNovaCourierEnabled?.checked),
        paymentDeliveryMatrix: collectPaymentDeliveryMatrixFromUi()
      });

      if (shippingSavedMessage) {
        shippingSavedMessage.classList.remove("error");
        shippingSavedMessage.textContent = "Налаштування доставки збережено.";
      }

      setTimeout(() => {
        if (shippingSavedMessage) {
          shippingSavedMessage.textContent = "";
        }
      }, 2200);
    });
  }

  if (viewsRangeForm) {
    viewsRangeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      renderViewsCustomRange();
    });
  }

  setupRangePresets(viewsRangePresets, viewsRangeFrom, viewsRangeTo, renderViewsCustomRange);

  const resetViewsStatsBtn = document.getElementById("resetViewsStatsBtn");
  if (resetViewsStatsBtn) {
    resetViewsStatsBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Скинути всю статистику переглядів до нуля?\n\nЦю дію неможливо скасувати."
      );
      if (!confirmed) return;
      localStorage.removeItem(VISITOR_EVENTS_KEY);
      renderViewsStats();
      if (viewsRangeResult) {
        viewsRangeResult.classList.remove("error");
        viewsRangeResult.textContent = "Оберіть дати, щоб побачити кількість унікальних відвідувачів.";
      }
    });
  }

  if (salesRangeForm) {
    salesRangeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      renderSalesFromForm();
    });
  }

  setupRangePresets(salesRangePresets, salesRangeFrom, salesRangeTo, renderSalesFromForm);

  if (logoutActionButton) {
    logoutActionButton.addEventListener("click", () => {
      window.location.href = getLandingUrl();
    });
  }

  renderViewsStats();
  ensureSalesRangeDefaults();
  renderSalesFromForm();
  ensureTrialInitialized();
  renderBillingSection();

  const availableSections = new Set(Array.from(panels).map((panel) => panel.id));
  const hashSection = parseSectionFromHash();
  const savedSection = localStorage.getItem(ADMIN_ACTIVE_SECTION_KEY);
  let initialSection = "home";
  if (hashSection && availableSections.has(hashSection)) {
    initialSection = hashSection;
  } else if (savedSection && availableSections.has(savedSection)) {
    initialSection = savedSection;
  }

  refreshPlanLocks();
  syncWatermarkControl();
  updateProductLimitBadge();
  updateCategoryLimitBadge();
  updateProductPhotoPolicyUi();
  activateSection(initialSection);

  // Remove the early anti-flash boot styles now that JS controls panel visibility.
  const bootSectionStyle = document.getElementById("bootSectionStyle");
  if (bootSectionStyle) bootSectionStyle.remove();
  document.documentElement.removeAttribute("data-boot-section");
});
