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
  const SETTINGS_KEY = "lavkaStoreSettings";
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
  const MAX_NAME_LENGTH = 60;
  const MAX_DESCRIPTION_LENGTH = 140;
  const MAX_AVATAR_FILE_SIZE = 3 * 1024 * 1024;
  const MAX_PRODUCT_NAME_LENGTH = 60;
  const MAX_PRODUCT_DESCRIPTION_LENGTH = 240;
  const MAX_PRODUCT_PHOTOS = 4;
  const MAX_PRODUCT_PHOTO_SIZE = 3 * 1024 * 1024;
  const MAX_BACKGROUND_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_CATEGORY_NAME_LENGTH = 40;
  const PRODUCTS_PER_PAGE = 5;
  const STOCKS_PER_PAGE = 4;

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
    logout: "Вихід"
  };

  const settingsSections = ["settings", "notifications", "payments", "shipping"];
  let currentSection = "home";

  const isMobileViewport = () => window.matchMedia("(max-width: 640px)").matches;

  const getStorefrontUrl = () => {
    const baseOrigin = window.location.origin;
    const pathname = window.location.pathname || "/";

    if (pathname.endsWith("/admin.html")) {
      return `${baseOrigin}${pathname.replace(/admin\.html$/, "index.html")}`;
    }

    if (pathname.endsWith("/admin")) {
      return `${baseOrigin}${pathname.slice(0, -"/admin".length) || "/"}`;
    }

    return `${baseOrigin}/`;
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
    currentSection = sectionId;

    localStorage.setItem(ADMIN_ACTIVE_SECTION_KEY, sectionId);

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

    if (sectionId === "notifications") {
      renderAdminTelegramSubscriptionControls();
      startTelegramSubscriptionPolling();
    } else {
      stopTelegramSubscriptionPolling();
    }
  };

  primaryMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
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

  if (homeStoreDomainInput) {
    homeStoreDomainInput.value = getStorefrontUrl();
  }

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
  const telegramNotificationsForm = document.getElementById("telegramNotificationsForm");
  const telegramOrderNotifyEnabled = document.getElementById("telegramOrderNotifyEnabled");
  const telegramAdminSubscriberId = document.getElementById("telegramAdminSubscriberId");
  const telegramAdminSubscribeLink = document.getElementById("telegramAdminSubscribeLink");
  const telegramSubscriptionStatus = document.getElementById("telegramSubscriptionStatus");
  const telegramNotificationsSavedMessage = document.getElementById("telegramNotificationsSavedMessage");
  const paymentMethodsForm = document.getElementById("paymentMethodsForm");
  const paymentMonoEnabled = document.getElementById("paymentMonoEnabled");
  const paymentMonoMerchantId = document.getElementById("paymentMonoMerchantId");
  const paymentMonoSecret = document.getElementById("paymentMonoSecret");
  const paymentLiqpayEnabled = document.getElementById("paymentLiqpayEnabled");
  const paymentLiqpayPublicKey = document.getElementById("paymentLiqpayPublicKey");
  const paymentLiqpayPrivateKey = document.getElementById("paymentLiqpayPrivateKey");
  const paymentCodEnabled = document.getElementById("paymentCodEnabled");
  const paymentCodFee = document.getElementById("paymentCodFee");
  const paymentPrepaymentEnabled = document.getElementById("paymentPrepaymentEnabled");
  const paymentPrepaymentAmount = document.getElementById("paymentPrepaymentAmount");
  const paymentBankTransferEnabled = document.getElementById("paymentBankTransferEnabled");
  const paymentBankRequisites = document.getElementById("paymentBankRequisites");
  const paymentsSavedMessage = document.getElementById("paymentsSavedMessage");
  const shippingMethodsForm = document.getElementById("shippingMethodsForm");
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
  const productOldPrice = document.getElementById("productOldPrice");
  const productNewPrice = document.getElementById("productNewPrice");
  const productVisible = document.getElementById("productVisible");
  const productPhotos = document.getElementById("productPhotos");
  const productSavedMessage = document.getElementById("productSavedMessage");
  const productEditingId = document.getElementById("productEditingId");
  const productModalTitle = document.getElementById("productModalTitle");
  const productSubmitButton = document.getElementById("productSubmitButton");
  const productNameCounter = document.getElementById("productNameCounter");
  const productDescriptionCounter = document.getElementById("productDescriptionCounter");
  const productsTableBody = document.getElementById("productsTableBody");
  const productsPagination = document.getElementById("productsPagination");
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
  const clearBulkSelection = document.getElementById("clearBulkSelection");
  const bulkActionMessage = document.getElementById("bulkActionMessage");
  const categoryCreateForm = document.getElementById("categoryCreateForm");
  const categoryNameInput = document.getElementById("categoryNameInput");
  const categoryNameCounter = document.getElementById("categoryNameCounter");
  const categorySavedMessage = document.getElementById("categorySavedMessage");
  const categoriesList = document.getElementById("categoriesList");
  const ordersTableBody = document.getElementById("ordersTableBody");
  const ordersSearchInput = document.getElementById("ordersSearchInput");
  const ordersStatusFilter = document.getElementById("ordersStatusFilter");
  const ordersPaymentFilter = document.getElementById("ordersPaymentFilter");
  const ordersAmountFromFilter = document.getElementById("ordersAmountFromFilter");
  const ordersAmountToFilter = document.getElementById("ordersAmountToFilter");
  const ordersFiltersReset = document.getElementById("ordersFiltersReset");
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
  const billingCurrentPlanName = document.getElementById("billingCurrentPlanName");
  const billingValidUntil = document.getElementById("billingValidUntil");
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
    "paymentMonoMerchantId",
    "paymentMonoSecret",
    "paymentLiqpayEnabled",
    "paymentLiqpayPublicKey",
    "paymentLiqpayPrivateKey",
    "paymentCodEnabled",
    "paymentCodFee",
    "paymentPrepaymentEnabled",
    "paymentPrepaymentAmount",
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
      botUsername: TELEGRAM_BOT_USERNAME,
      apiBaseUrl: String(settings.telegramApiBaseUrl || "http://localhost:8787").trim()
    };
  };

  const createRandomId = () => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const getOrCreateAdminTelegramSubscriberId = () => {
    const existing = String(localStorage.getItem(TELEGRAM_ADMIN_SUBSCRIBER_KEY) || "").trim();
    if (existing) return existing;
    const next = createRandomId();
    localStorage.setItem(TELEGRAM_ADMIN_SUBSCRIBER_KEY, next);
    return next;
  };

  const buildAdminTelegramSubscribeLink = (botUsername, subscriberId) => {
    const normalizedBot = String(botUsername || "").replace(/^@+/, "").trim();
    if (!normalizedBot || !subscriberId) return "#";
    return `https://t.me/${encodeURIComponent(normalizedBot)}?start=${encodeURIComponent(`sub_${subscriberId}`)}`;
  };

  const checkAdminTelegramSubscription = async (apiBaseUrl, subscriberId) => {
    const normalizedApiBaseUrl = String(apiBaseUrl || "").trim().replace(/\/$/, "");
    if (!normalizedApiBaseUrl || !subscriberId) {
      return { ok: false, linked: false };
    }

    try {
      const response = await fetch(
        `${normalizedApiBaseUrl}/api/telegram/subscription-status?subscriberId=${encodeURIComponent(subscriberId)}`
      );
      if (!response.ok) {
        return { ok: false, linked: false };
      }
      const payload = await response.json();
      return {
        ok: true,
        linked: Boolean(payload?.linked)
      };
    } catch {
      return { ok: false, linked: false };
    }
  };

  const registerAdminSubscribeIntent = async (apiBaseUrl, subscriberId) => {
    const normalizedApiBaseUrl = String(apiBaseUrl || "").trim().replace(/\/$/, "");
    if (!normalizedApiBaseUrl || !subscriberId) return false;

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/api/telegram/subscribe-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subscriberId
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const renderAdminTelegramSubscriptionControls = () => {
    const settings = readTelegramOrderNotificationsSettings();
    const subscriberId = getOrCreateAdminTelegramSubscriberId();
    const botUsername = TELEGRAM_BOT_USERNAME;

    if (telegramAdminSubscriberId) {
      telegramAdminSubscriberId.textContent = subscriberId;
    }

    if (telegramAdminSubscribeLink) {
      telegramAdminSubscribeLink.href = buildAdminTelegramSubscribeLink(botUsername, subscriberId);
      telegramAdminSubscribeLink.setAttribute("aria-disabled", "false");
      telegramAdminSubscribeLink.classList.remove("disabled");
    }
  };

  let telegramSubscriptionPollTimer = null;
  const stopTelegramSubscriptionPolling = () => {
    if (!telegramSubscriptionPollTimer) return;
    window.clearInterval(telegramSubscriptionPollTimer);
    telegramSubscriptionPollTimer = null;
  };

  const startTelegramSubscriptionPolling = () => {
    stopTelegramSubscriptionPolling();
    telegramSubscriptionPollTimer = window.setInterval(async () => {
      if (currentSection !== "notifications") return;
      const settings = readTelegramOrderNotificationsSettings();
      const subscriberId = getOrCreateAdminTelegramSubscriberId();
      const status = await checkAdminTelegramSubscription(settings.apiBaseUrl, subscriberId);
      if (!status.ok || !status.linked) return;

      applyTelegramNotificationsEnabledState(true);
      if (telegramOrderNotifyEnabled) {
        telegramOrderNotifyEnabled.checked = true;
      }
      if (telegramSubscriptionStatus) {
        telegramSubscriptionStatus.classList.remove("error");
        telegramSubscriptionStatus.textContent = "Підписка підтверджена. Сповіщення активовано.";
      }
    }, 3000);
  };

  const buildTelegramOrderMessage = (order) => {
    const customerName = String(order?.customerName || "Клієнт").trim();
    const customerPhone = String(order?.customerPhone || "-").trim() || "-";
    const orderId = String(order?.id || "#-").trim();
    const deliveryMethod = String(order?.deliveryMethod || "-").trim() || "-";
    const total = formatNumber(Number(order?.total) || 0);
    const itemsSummary = Array.isArray(order?.items)
      ? order.items
        .slice(0, 3)
        .map((item) => `${String(item?.name || "Товар").trim()} x${Number(item?.qty) || 1}`)
        .join(", ")
      : "";

    const lines = [
      "Нове замовлення у магазині",
      `Номер: ${orderId}`,
      `Клієнт: ${customerName}`,
      `Телефон: ${customerPhone}`,
      `Доставка: ${deliveryMethod}`,
      `Сума: ${total} ${getCurrencyLabel(getCurrentCurrency())}`
    ];

    if (itemsSummary) {
      lines.push(`Товари: ${itemsSummary}`);
    }

    return lines.join("\n");
  };

  const sendTelegramOrderNotification = async (order) => {
    const settings = readTelegramOrderNotificationsSettings();
    const subscriberId = getOrCreateAdminTelegramSubscriberId();
    if (!settings.enabled || !settings.apiBaseUrl || !subscriberId) return false;

    try {
      const response = await fetch(`${settings.apiBaseUrl.replace(/\/$/, "")}/api/telegram/order-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subscriberId,
          message: buildTelegramOrderMessage(order),
          orderId: String(order?.id || "").trim(),
          botUsername: settings.botUsername
        })
      });

      if (!response.ok) return false;
      const result = await response.json();
      return Boolean(result?.ok);
    } catch {
      return false;
    }
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
      name: "Starter",
      price: 399,
      periodMonths: 1,
      description: "Базовий план для невеликого магазину."
    },
    {
      id: "business",
      name: "Business",
      price: 899,
      periodMonths: 1,
      description: "Оптимальний план для активних продажів."
    },
    {
      id: "pro",
      name: "Pro",
      price: 2399,
      periodMonths: 3,
      description: "Розширений план для масштабування бізнесу."
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
          payments: []
        };
      }

      const payments = Array.isArray(parsed.payments)
        ? parsed.payments.filter((payment) => payment && typeof payment === "object")
        : [];

      return {
        currentPlanId: String(parsed.currentPlanId || ""),
        validUntil: String(parsed.validUntil || ""),
        payments
      };
    } catch {
      return {
        currentPlanId: "",
        validUntil: "",
        payments: []
      };
    }
  };

  const saveBilling = (billing) => {
    localStorage.setItem(BILLING_KEY, JSON.stringify(billing));
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

    if (billingCurrentPlanName) {
      billingCurrentPlanName.textContent = currentPlan ? currentPlan.name : "Без тарифу";
    }

    if (billingValidUntil) {
      billingValidUntil.textContent = formatDateLong(billing.validUntil);
    }

    if (billingPlansGrid) {
      billingPlansGrid.innerHTML = "";
      BILLING_PLANS.forEach((plan) => {
        const card = document.createElement("article");
        card.className = `billing-plan-card ${currentPlan?.id === plan.id ? "current" : ""}`;
        card.innerHTML = `
          <div class="billing-plan-head">
            <h3 class="billing-plan-name">${plan.name}</h3>
            ${currentPlan?.id === plan.id ? '<span class="billing-badge">Поточний</span>' : ""}
          </div>
          <p class="billing-plan-price">${formatNumber(plan.price)} ${getCurrencyLabel(getCurrentCurrency())} / ${plan.periodMonths} міс.</p>
          <p class="billing-plan-desc">${plan.description}</p>
          <button type="button" class="action-btn billing-pay-btn" data-plan-id="${plan.id}">Оплатити</button>
        `;
        billingPlansGrid.append(card);
      });
    }

    if (billingHistoryBody) {
      billingHistoryBody.innerHTML = "";

      if (!billing.payments.length) {
        const row = document.createElement("tr");
        row.innerHTML = '<td colspan="5">Оплат ще немає.</td>';
        billingHistoryBody.append(row);
      } else {
        billing.payments.forEach((payment) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${formatDateLong(payment.paidAt)}</td>
            <td>${String(payment.planName || "-")}</td>
            <td>${Number(payment.periodMonths) || 1} міс.</td>
            <td>${formatNumber(Number(payment.amount) || 0)} ${getCurrencyLabel(getCurrentCurrency())}</td>
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
      `Підтвердьте оплату тарифу ${selectedPlan.name} на ${selectedPlan.periodMonths} міс. за ${formatNumber(selectedPlan.price)} ${getCurrencyLabel(getCurrentCurrency())}.`
    );
    if (!confirmed) return;

    const billing = readBilling();
    const now = new Date();
    const nowIso = now.toISOString();
    const baseDate = billing.validUntil && new Date(billing.validUntil) > now
      ? new Date(billing.validUntil)
      : new Date(now);

    baseDate.setMonth(baseDate.getMonth() + selectedPlan.periodMonths);

    const payment = {
      id: `pay-${Date.now()}`,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      amount: selectedPlan.price,
      periodMonths: selectedPlan.periodMonths,
      paidAt: nowIso
    };

    const nextBilling = {
      currentPlanId: selectedPlan.id,
      validUntil: baseDate.toISOString(),
      payments: [payment, ...billing.payments].slice(0, 30)
    };

    saveBilling(nextBilling);
    renderBillingSection();
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
    qty: Number.isFinite(Number(item?.qty)) ? Math.max(1, Number(item.qty)) : 1
  });

  const normalizeOrder = (order) => {
    const items = Array.isArray(order?.items) ? order.items.map((item) => normalizeOrderItem(item)) : [];
    const total = Number.isFinite(Number(order?.total)) ? Math.max(0, Number(order.total)) : 0;
    const discount = Number.isFinite(Number(order?.discount)) ? Math.max(0, Number(order.discount)) : 0;
    const fallbackPromoByOrderId = {
      "#1024": { promoCode: "SUMMER10", promoDiscount: 40 },
      "#1022": { promoCode: "WELCOME", promoDiscount: 80 }
    };
    const fallbackPromo = fallbackPromoByOrderId[String(order?.id || "")] || { promoCode: "", promoDiscount: 0 };
    const normalizedPromoCode = String(order?.promoCode || "").trim();
    const normalizedPromoDiscountValue = Number(order?.promoDiscount);
    const hasPromoCode = normalizedPromoCode.length > 0;
    const hasPromoDiscount = Number.isFinite(normalizedPromoDiscountValue) && normalizedPromoDiscountValue > 0;
    const shouldUseFallbackPromo = !hasPromoCode && !hasPromoDiscount && (fallbackPromo.promoCode || fallbackPromo.promoDiscount > 0);
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
      trackingNumber: String(order?.trackingNumber || ""),
      total,
      discount,
      promoCode: shouldUseFallbackPromo ? fallbackPromo.promoCode : normalizedPromoCode,
      promoDiscount: shouldUseFallbackPromo
        ? fallbackPromo.promoDiscount
        : (Number.isFinite(normalizedPromoDiscountValue) ? Math.max(0, normalizedPromoDiscountValue) : 0),
      inventoryApplied: Boolean(order?.inventoryApplied),
      items
    };
  };

  const renderOrdersTable = (orders) => {
    if (!ordersTableBody) return;
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
      row.innerHTML = '<td colspan="8">За вашим запитом замовлень не знайдено.</td>';
      ordersTableBody.append(row);
      return;
    }

    filteredOrders.forEach((order) => {
      const row = document.createElement("tr");
      const firstItem = order.items[0];
      const shortProductText = firstItem
        ? `${firstItem.name} x${firstItem.qty}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}`
        : "-";
      const statusClass = getOrderStatusClass(order.status);
      const paymentStatusClass = getPaymentStatusClass(order.paymentStatus);
      const createdAtLabel = formatDateTime(order.createdAt || order.updatedAt);

      row.innerHTML = `
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
              <span aria-hidden="true" class="trash-icon">🗑</span>
            </button>
          </div>
        </td>
      `;

      ordersTableBody.append(row);
    });
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
        row.innerHTML = `
          <td><img class="order-items-thumb" src="${item.photo}" alt="${item.name}"></td>
          <td>${item.sku}</td>
          <td>${item.name}</td>
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

    const oldPrice = Number.parseFloat(product?.oldPrice);
    const newPrice = Number.parseFloat(product?.newPrice);
    const hasValidComparePrices = Number.isFinite(oldPrice)
      && Number.isFinite(newPrice)
      && oldPrice > 0
      && newPrice > 0
      && oldPrice > newPrice;
    const normalizedOldPrice = hasValidComparePrices ? Math.round(oldPrice * 100) / 100 : null;
    const normalizedNewPrice = hasValidComparePrices ? Math.round(newPrice * 100) / 100 : null;
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
      oldPrice: normalizedOldPrice,
      newPrice: normalizedNewPrice,
      price: normalizedNewPrice || fallbackPrice
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
    const canUseBulkTools = selectedCount > 1;

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

  const renderCategoriesList = (categories) => {
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

      actions.append(editButton, saveButton, dragHandle);
      item.append(nameInput, actions);
      categoriesList.append(item);
    });
  };

  const renderProductsTable = (products) => {
    if (!productsTableBody) return;
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
      row.innerHTML = `<td colspan="10">${emptyMessage}</td>`;
      productsTableBody.append(row);
      updateBulkSelectionState();
      renderProductsPagination(filteredProducts.length);
      renderStockTable(products);
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
      const hasComparePrices = Number.isFinite(product.oldPrice)
        && Number.isFinite(product.newPrice)
        && product.oldPrice > 0
        && product.newPrice > 0
        && product.oldPrice > product.newPrice;
      const priceHtml = hasComparePrices
        ? `<span class="product-price-compare"><s>${formatPrice(product.oldPrice)}</s><strong>${formatPrice(product.newPrice)}</strong></span>`
        : formatPrice(product.price);

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
          </div>
        </td>
      `;
      productsTableBody.append(row);
    });

    updateBulkSelectionState();
    renderProductsPagination(filteredProducts.length);
    renderStockTable(products);
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

  const validatePhotos = (files) => {
    if (files.length > MAX_PRODUCT_PHOTOS) {
      return `Можна додати максимум ${MAX_PRODUCT_PHOTOS} фото.`;
    }

    const oversized = files.find((file) => file.size > MAX_PRODUCT_PHOTO_SIZE);
    if (oversized) {
      return "Кожне фото має бути до 3 МБ.";
    }

    return "";
  };

  const setProductModalOpen = (open) => {
    if (!productModal) return;
    productModal.classList.toggle("open", open);
    productModal.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open && productUnitSelect && productUnitOptions) {
      productUnitSelect.classList.remove("open");
      productUnitSelect.setAttribute("aria-expanded", "false");
      productUnitOptions.hidden = true;
    }
    updateModalScrollLock();
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
    updateProductNameCounter();
    updateProductDescriptionCounter();
    productSavedMessage.classList.remove("error");
    productSavedMessage.textContent = "";

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
      productOldPrice.value = product.oldPrice || "";
      productNewPrice.value = product.newPrice || "";
      productVisible.checked = product.visible !== false;
      const categoryNames = getCategoryNames(categories);
      const selectedCategories = Array.isArray(product.categories) && product.categories.length
        ? product.categories
        : [product.category].filter(Boolean);
      Array.from(productCategories.querySelectorAll('input[type="checkbox"]')).forEach((checkbox) => {
        checkbox.checked = selectedCategories.includes(checkbox.value) && categoryNames.includes(checkbox.value);
      });
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
    productOldPrice.value = "";
    productNewPrice.value = "";
    productVisible.checked = true;
    Array.from(productCategories.querySelectorAll('input[type="checkbox"]')).forEach((checkbox) => {
      checkbox.checked = false;
    });
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
    storeName.value = settings.name || storeName.value;
    storeDescription.value = settings.description || storeDescription.value;
    storeAvatar.value = settings.avatar || storeAvatar.value;
    avatarPreview.src = settings.avatar || avatarPreview.src;
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
    if (paymentMonoMerchantId) {
      paymentMonoMerchantId.value = String(settings.paymentMonoMerchantId || "").trim();
    }
    if (paymentMonoSecret) {
      paymentMonoSecret.value = String(settings.paymentMonoSecret || "").trim();
    }
    if (paymentLiqpayEnabled) {
      paymentLiqpayEnabled.checked = Boolean(settings.paymentLiqpayEnabled);
    }
    if (paymentLiqpayPublicKey) {
      paymentLiqpayPublicKey.value = String(settings.paymentLiqpayPublicKey || "").trim();
    }
    if (paymentLiqpayPrivateKey) {
      paymentLiqpayPrivateKey.value = String(settings.paymentLiqpayPrivateKey || "").trim();
    }
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

  applySettings(readSettings());
  mergeAndSaveSettings({
    currency: normalizeCurrencyCode(readSettings()?.currency || "uah"),
    telegramBotUsername: TELEGRAM_BOT_USERNAME,
    telegramApiBaseUrl: String((readSettings() || {}).telegramApiBaseUrl || "http://localhost:8787").trim(),
    shippingNovaPostEnabled: readSettings()?.shippingNovaPostEnabled ?? true,
    shippingUkrPostEnabled: readSettings()?.shippingUkrPostEnabled ?? true,
    shippingNovaCourierEnabled: readSettings()?.shippingNovaCourierEnabled ?? false,
    paymentDeliveryMatrix: normalizePaymentDeliveryMatrix(readSettings()?.paymentDeliveryMatrix)
  });
  renderAdminTelegramSubscriptionControls();
  applyBackgroundPreview();
  updateNameCounter();
  updateDescriptionCounter();

  const defaultOrders = [
    {
      id: "#1024",
      customerName: "Марія Ковальчук",
      customerPhone: "+380671112233",
      deliveryMethod: "Нова Пошта, відділення",
      deliveryAddress: "м. Львів, вул. Шевченка, 12, відділення №14",
      comment: "Будь ласка, подзвоніть перед відправкою.",
      managerComment: "",
      total: 840,
      discount: 60,
      promoCode: "SUMMER10",
      promoDiscount: 40,
      status: "Очікує",
      paymentStatus: "Не оплачено",
      trackingNumber: "",
      createdAt: (() => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString();
      })(),
      items: [
        {
          photo: "https://picsum.photos/seed/lavka-order-1024-1/80/80",
          sku: "LK-CUP-010",
          name: "Чашка \"Терра\"",
          price: 420,
          qty: 2
        }
      ]
    },
    {
      id: "#1023",
      customerName: "Олег Петренко",
      customerPhone: "+380501234567",
      deliveryMethod: "Кур'єр по місту",
      deliveryAddress: "м. Київ, вул. Антоновича, 31, кв. 18",
      comment: "Доставка після 18:00.",
      managerComment: "",
      total: 890,
      discount: 0,
      promoCode: "",
      promoDiscount: 0,
      status: "В обробці",
      paymentStatus: "Частково оплачено",
      trackingNumber: "",
      createdAt: new Date().toISOString(),
      items: [
        {
          photo: "https://picsum.photos/seed/lavka-order-1023-1/80/80",
          sku: "LK-VASE-003",
          name: "Ваза \"Гай\"",
          price: 890,
          qty: 1
        }
      ]
    },
    {
      id: "#1022",
      customerName: "Ірина Лисенко",
      customerPhone: "+380931998877",
      deliveryMethod: "Нова Пошта, поштомат",
      deliveryAddress: "м. Дніпро, просп. Поля, 24, поштомат 3571",
      comment: "Коментар відсутній",
      managerComment: "",
      total: 1250,
      discount: 120,
      promoCode: "WELCOME",
      promoDiscount: 80,
      status: "Відправлено",
      paymentStatus: "Оплачено",
      trackingNumber: "59000999888776",
      createdAt: (() => {
        const date = new Date();
        date.setDate(date.getDate() - 3);
        return date.toISOString();
      })(),
      items: [
        {
          photo: "https://picsum.photos/seed/lavka-order-1022-1/80/80",
          sku: "LK-SET-021",
          name: "Набір \"Дует\"",
          price: 1250,
          qty: 1
        }
      ]
    }
  ];

  let orders = readOrders();
  let currentOrdersSearch = "";
  let currentOrderStatusFilter = "all";
  let currentOrderPaymentFilter = "all";
  let currentOrdersAmountFrom = null;
  let currentOrdersAmountTo = null;
  if (!orders || !orders.length) {
    orders = defaultOrders;
    saveOrders(orders);
  }
  orders = orders.map((order) => normalizeOrder(order));
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

      if (!newOrders.length) {
        knownOrderIds = latestOrderIds;
        return;
      }

      orders = latestOrders;
      saveOrders(orders);
      renderOrdersTable(orders);
      if (currentSection === "sales") {
        renderSalesFromForm();
      }

      for (const order of newOrders) {
        const orderId = String(order.id || "").trim();
        if (!orderId || notifiedOrderIds.has(orderId)) continue;

        const isSent = await sendTelegramOrderNotification(order);
        if (isSent) {
          notifiedOrderIds.add(orderId);
        }
      }

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
      renderOrdersTable(orders);
    });
  }

  const applyOrdersFilters = () => {
    currentOrderStatusFilter = ordersStatusFilter?.value || "all";
    currentOrderPaymentFilter = ordersPaymentFilter?.value || "all";

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
      }
      if (ordersPaymentFilter) {
        ordersPaymentFilter.value = "all";
      }
      if (ordersAmountFromFilter) {
        ordersAmountFromFilter.value = "";
      }
      if (ordersAmountToFilter) {
        ordersAmountToFilter.value = "";
      }

      renderOrdersTable(orders);
    });
  }

  const defaultPromoCodes = [
    {
      id: "promo-default-1",
      code: "SUMMER10",
      charset: "letters",
      discountType: "percent",
      discountValue: 10,
      minOrderAmount: 500,
      maxDiscountPerOrder: 300,
      maxUsesPerClient: 1,
      maxUsesTotal: 200,
      usedTotal: 0,
      managerComment: "Літня акція для нових клієнтів"
    },
    {
      id: "promo-default-2",
      code: "2026",
      charset: "digits",
      discountType: "uah",
      discountValue: 120,
      minOrderAmount: 800,
      maxDiscountPerOrder: 120,
      maxUsesPerClient: 2,
      maxUsesTotal: 300,
      usedTotal: 0,
      managerComment: "Швидка знижка у гривнях"
    }
  ];

  let promoCodes = readPromoCodes();
  if (!promoCodes || !promoCodes.length) {
    promoCodes = defaultPromoCodes;
    savePromoCodes(promoCodes);
  }
  promoCodes = promoCodes.map((promoCode) => normalizePromoCode(promoCode));
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

  let products = readProducts();
  if (!products || !products.length) {
    products = extractProductsFromTable();
    saveProducts(products);
  }
  products = products.map((product) => normalizeProduct(product));
  saveProducts(products);

  applyInventoryForPendingOrders();

  let categories = readCategories();
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

    categoryCreateForm.addEventListener("submit", (event) => {
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

      const duplicate = categories.some((category) => category.name.toLowerCase() === normalized.toLowerCase());
      if (duplicate) {
        categorySavedMessage.textContent = "Категорія з такою назвою вже існує.";
        categorySavedMessage.classList.add("error");
        return;
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
        return;
      }
      productSavedMessage.textContent = "";
      productSavedMessage.classList.remove("error");
    });

    productCreateForm.addEventListener("submit", (event) => {
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
      const parsedOldPrice = productOldPrice.value.trim() ? Number.parseFloat(productOldPrice.value) : null;
      const parsedNewPrice = productNewPrice.value.trim() ? Number.parseFloat(productNewPrice.value) : null;
      const isVisible = Boolean(productVisible.checked);
      const files = Array.from(productPhotos.files || []);
      const categoryNames = getCategoryNames(categories);
      const existingProduct = editingId ? products.find((product) => product.id === editingId) : null;

      productSavedMessage.classList.remove("error");

      if (editingId && !existingProduct) {
        productSavedMessage.textContent = "Не вдалося знайти товар для редагування.";
        productSavedMessage.classList.add("error");
        return;
      }

      if (!normalizedName || !normalizedSku || !normalizedDescription || !normalizedCategories.length || !parsedPrice) {
        productSavedMessage.textContent = "Заповніть усі поля товару.";
        productSavedMessage.classList.add("error");
        return;
      }

      const hasOldPrice = Number.isFinite(parsedOldPrice) && parsedOldPrice > 0;
      const hasNewPrice = Number.isFinite(parsedNewPrice) && parsedNewPrice > 0;

      if ((hasOldPrice && !hasNewPrice) || (!hasOldPrice && hasNewPrice)) {
        productSavedMessage.textContent = "Для порівняння ціни вкажіть і стару, і нову ціну.";
        productSavedMessage.classList.add("error");
        return;
      }

      if (hasOldPrice && hasNewPrice && parsedOldPrice <= parsedNewPrice) {
        productSavedMessage.textContent = "Для знижки стара ціна має бути більшою за нову.";
        productSavedMessage.classList.add("error");
        return;
      }

      const normalizedOldPrice = hasOldPrice ? Math.round(parsedOldPrice * 100) / 100 : null;
      const normalizedNewPrice = hasNewPrice ? Math.round(parsedNewPrice * 100) / 100 : null;

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

      const nextPhotos = files.length
        ? files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type
          }))
        : existingProduct?.photos || [];

      const preservedSizeStocks = isClothing
        ? selectedSizes.reduce((acc, sizeKey) => {
            const current = Number.parseInt(existingProduct?.sizeStocks?.[sizeKey], 10);
            acc[sizeKey] = Number.isFinite(current) && current > 0 ? current : 0;
            return acc;
          }, {})
        : {};
      const totalStockFromSizes = Object.values(preservedSizeStocks).reduce((sum, value) => sum + value, 0);

      const nextProduct = {
        id: editingId || `product-${Date.now()}`,
        sku: normalizedSku,
        name: normalizedName,
        category: normalizedCategories[0],
        categories: normalizedCategories,
        description: normalizedDescription,
        price: normalizedNewPrice || parsedPrice,
        unit: normalizedUnit,
        isClothing,
        sizes: selectedSizes,
        sizeStocks: preservedSizeStocks,
        oldPrice: normalizedOldPrice,
        newPrice: normalizedNewPrice,
        stock: isClothing ? totalStockFromSizes : (existingProduct?.stock ?? 0),
        discount: existingProduct?.discount || null,
        visible: isVisible,
        photos: nextPhotos,
        createdAt: existingProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

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

          const sourcePrice = Number.isFinite(product.newPrice) && product.newPrice > 0
            ? product.newPrice
            : product.price;

          const nextPrice = operation === "decrease"
            ? Math.max(1, sourcePrice - delta)
            : sourcePrice + delta;

          const roundedNextPrice = Math.round(nextPrice * 100) / 100;

          const hasComparePrices = Number.isFinite(product.oldPrice)
            && Number.isFinite(product.newPrice)
            && product.oldPrice > 0
            && product.newPrice > 0;

          const nextOldPrice = hasComparePrices && product.oldPrice > roundedNextPrice
            ? product.oldPrice
            : null;
          const nextNewPrice = hasComparePrices && product.oldPrice > roundedNextPrice
            ? roundedNextPrice
            : null;

          return {
            ...product,
            price: roundedNextPrice,
            oldPrice: nextOldPrice,
            newPrice: nextNewPrice,
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
      avatarPreview.src = "https://picsum.photos/seed/lavka-keramiky/160/160";
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
      savedMessage.textContent = "";

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          storeAvatar.value = reader.result;
          avatarPreview.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
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
        instagram: socialInstagram.value.trim(),
        instagramEnabled: socialInstagramEnabled.checked,
        facebook: socialFacebook.value.trim(),
        facebookEnabled: socialFacebookEnabled.checked,
        telegram: socialTelegram.value.trim(),
        telegramEnabled: socialTelegramEnabled.checked,
        tiktok: socialTiktok.value.trim(),
        tiktokEnabled: socialTiktokEnabled.checked
      });

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

  const applyTelegramNotificationsEnabledState = (enabled) => {
    mergeAndSaveSettings({
      telegramOrderNotifyEnabled: enabled,
      telegramBotUsername: TELEGRAM_BOT_USERNAME,
      telegramApiBaseUrl: String((readSettings() || {}).telegramApiBaseUrl || "http://localhost:8787").trim(),
      telegramChatId: "",
      telegramBotToken: ""
    });

    if (enabled) {
      const baselineNotifiedOrderIds = new Set(
        orders.map((order) => String(order.id || "").trim()).filter(Boolean)
      );
      saveNotifiedOrderIds(baselineNotifiedOrderIds);
      notifiedOrderIds = baselineNotifiedOrderIds;
      knownOrderIds = new Set(baselineNotifiedOrderIds);
    }
  };

  const verifyAdminSubscriptionAndApplyToggle = async () => {
    const desiredEnabled = Boolean(telegramOrderNotifyEnabled?.checked);
    const subscriberId = getOrCreateAdminTelegramSubscriberId();
    const apiBaseUrlValue = String((readSettings() || {}).telegramApiBaseUrl || "http://localhost:8787").trim();

    if (!desiredEnabled) {
      applyTelegramNotificationsEnabledState(false);
      if (telegramSubscriptionStatus) {
        telegramSubscriptionStatus.classList.remove("error");
        telegramSubscriptionStatus.textContent = "Сповіщення вимкнено.";
      }
      if (telegramNotificationsSavedMessage) {
        telegramNotificationsSavedMessage.textContent = "";
      }
      return;
    }

    const subscription = await checkAdminTelegramSubscription(apiBaseUrlValue, subscriberId);
    if (!subscription.ok || !subscription.linked) {
      if (telegramOrderNotifyEnabled) {
        telegramOrderNotifyEnabled.checked = false;
      }
      applyTelegramNotificationsEnabledState(false);
      void registerAdminSubscribeIntent(apiBaseUrlValue, subscriberId);
      if (telegramAdminSubscribeLink && telegramAdminSubscribeLink.href && telegramAdminSubscribeLink.href !== "#") {
        window.open(telegramAdminSubscribeLink.href, "_blank", "noopener");
      }
      if (telegramSubscriptionStatus) {
        telegramSubscriptionStatus.classList.add("error");
        telegramSubscriptionStatus.textContent = "Підписка ще не підтверджена. Натисніть Підписатися на бота і виконайте /start.";
      }
      if (telegramNotificationsSavedMessage) {
        telegramNotificationsSavedMessage.classList.add("error");
        telegramNotificationsSavedMessage.textContent = "Сповіщення не активовано: немає підписки на бота.";
      }
      return;
    }

    applyTelegramNotificationsEnabledState(true);
    if (telegramSubscriptionStatus) {
      telegramSubscriptionStatus.classList.remove("error");
      telegramSubscriptionStatus.textContent = "Підписка підтверджена. Сповіщення активовано.";
    }
    if (telegramNotificationsSavedMessage) {
      telegramNotificationsSavedMessage.classList.remove("error");
      telegramNotificationsSavedMessage.textContent = "Сповіщення успішно увімкнено.";
      setTimeout(() => {
        if (telegramNotificationsSavedMessage) {
          telegramNotificationsSavedMessage.textContent = "";
        }
      }, 2200);
    }
  };

  if (telegramOrderNotifyEnabled) {
    telegramOrderNotifyEnabled.addEventListener("change", () => {
      void verifyAdminSubscriptionAndApplyToggle();
    });
  }

  if (telegramAdminSubscribeLink) {
    telegramAdminSubscribeLink.addEventListener("click", () => {
      const settings = readTelegramOrderNotificationsSettings();
      const subscriberId = getOrCreateAdminTelegramSubscriberId();
      void registerAdminSubscribeIntent(settings.apiBaseUrl, subscriberId);
      if (telegramSubscriptionStatus) {
        telegramSubscriptionStatus.classList.remove("error");
        telegramSubscriptionStatus.textContent = "Після /start у боті сповіщення увімкнеться автоматично.";
      }
      startTelegramSubscriptionPolling();
    });
  }

  if (telegramNotificationsForm) {
    telegramNotificationsForm.addEventListener("submit", (event) => {
      event.preventDefault();
    });
  }

  if (paymentMethodsForm) {
    paymentMethodsForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const monoEnabled = Boolean(paymentMonoEnabled?.checked);
      const liqpayEnabled = Boolean(paymentLiqpayEnabled?.checked);
      const codEnabled = Boolean(paymentCodEnabled?.checked);
      const prepaymentEnabled = Boolean(paymentPrepaymentEnabled?.checked);
      const bankTransferEnabled = Boolean(paymentBankTransferEnabled?.checked);
      const monoMerchantId = String(paymentMonoMerchantId?.value || "").trim();
      const monoSecret = String(paymentMonoSecret?.value || "").trim();
      const liqpayPublicKey = String(paymentLiqpayPublicKey?.value || "").trim();
      const liqpayPrivateKey = String(paymentLiqpayPrivateKey?.value || "").trim();
      const codFee = String(paymentCodFee?.value || "").trim();
      const prepaymentAmount = Math.max(0, Math.round(Number(paymentPrepaymentAmount?.value) || 0));
      const bankRequisites = String(paymentBankRequisites?.value || "").trim();

      if (paymentsSavedMessage) {
        paymentsSavedMessage.classList.remove("error");
      }

      if (monoEnabled && (!monoMerchantId || !monoSecret)) {
        if (paymentsSavedMessage) {
          paymentsSavedMessage.textContent = "Для Plata by mono вкажіть Merchant ID і Secret key.";
          paymentsSavedMessage.classList.add("error");
        }
        return;
      }

      if (liqpayEnabled && (!liqpayPublicKey || !liqpayPrivateKey)) {
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

      mergeAndSaveSettings({
        paymentMonoEnabled: monoEnabled,
        paymentMonoMerchantId: monoMerchantId,
        paymentMonoSecret: monoSecret,
        paymentLiqpayEnabled: liqpayEnabled,
        paymentLiqpayPublicKey: liqpayPublicKey,
        paymentLiqpayPrivateKey: liqpayPrivateKey,
        paymentCodEnabled: codEnabled,
        paymentCodFee: codFee,
        paymentPrepaymentEnabled: prepaymentEnabled,
        paymentPrepaymentAmount: prepaymentAmount,
        paymentBankTransferEnabled: bankTransferEnabled,
        paymentBankRequisites: bankRequisites,
        paymentDeliveryMatrix: collectPaymentDeliveryMatrixFromUi()
      });

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

  if (salesRangeForm) {
    salesRangeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      renderSalesFromForm();
    });
  }

  renderViewsStats();
  ensureSalesRangeDefaults();
  renderSalesFromForm();
  renderBillingSection();

  const availableSections = new Set(Array.from(panels).map((panel) => panel.id));
  const savedSection = localStorage.getItem(ADMIN_ACTIVE_SECTION_KEY);
  const initialSection = savedSection && availableSections.has(savedSection) ? savedSection : "home";

  activateSection(initialSection);
});
