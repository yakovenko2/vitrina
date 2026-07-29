(function () {
  var FIREBASE_CONFIG = {
    apiKey: "<SECRET>",
    authDomain: "lavka-shop.firebaseapp.com",
    projectId: "lavka-shop",
    storageBucket: "lavka-shop.firebasestorage.app",
    messagingSenderId: "446966778081",
    appId: "1:446966778081:web:a9f60f4c27bb93fd45b8ee"
  };

  var REGISTRATION_KEY = "lavkaRegistration";
  var SETTINGS_KEY = "lavkaStoreSettings";
  var BILLING_KEY = "lavkaBilling";
  var PRODUCTS_KEY = "lavkaProducts";
  var CATEGORIES_KEY = "lavkaCategories";
  var ORDERS_KEY = "lavkaOrders";
  var AUTH_KEY = "lavkaAuth";
  var DASH = "-";

  var PLAN_LABELS = {
    starter: "Старт",
    business: "Бізнес",
    pro: "Про"
  };

  var badgeEl = document.getElementById("storesTotalBadge");
  var statusEl = document.getElementById("storesStatus");
  var tableBodyEl = document.getElementById("storesTableBody");
  var modalEl = document.getElementById("storeDetailsModal");
  var modalCloseEl = document.getElementById("storeDetailsClose");
  var modalStatusEl = document.getElementById("storeDetailsStatus");
  var modalDefaultDomainEl = document.getElementById("storeModalDefaultDomain");
  var modalCustomDomainInputEl = document.getElementById("storeModalCustomDomainInput");
  var modalCustomDomainSaveEl = document.getElementById("storeModalCustomDomainSave");
  var modalCustomDomainMessageEl = document.getElementById("storeModalCustomDomainMessage");
  var modalCustomDomainStatusEl = document.getElementById("storeModalCustomDomainStatus");
  var modalProductsStatsEl = document.getElementById("storeModalProductsStats");
  var modalCategoriesStatsEl = document.getElementById("storeModalCategoriesStats");
  var modalStorageStatsEl = document.getElementById("storeModalStorageStats");
  var modalPlanNameEl = document.getElementById("storeModalPlanName");
  var modalPaymentStatusEl = document.getElementById("storeModalPaymentStatus");
  var modalLastPaymentAtEl = document.getElementById("storeModalLastPaymentAt");
  var modalMonthRevenueEl = document.getElementById("storeModalMonthRevenue");
  var modalMonthOrdersEl = document.getElementById("storeModalMonthOrders");
  var modalMonthAverageEl = document.getElementById("storeModalMonthAverage");
  var modalActivityBodyEl = document.getElementById("storeModalActivityBody");
  var storesState = [];
  var activeStoreId = "";

  function initDb() {
    if (!window.firebase) {
      throw new Error("firebase-unavailable");
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    return firebase.firestore();
  }

  function cleanText(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).trim();
  }

  function sanitizeStoreId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 64);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toDate(value) {
    if (!value) {
      return null;
    }

    if (typeof value.toDate === "function") {
      var asTsDate = value.toDate();
      if (asTsDate instanceof Date && !Number.isNaN(asTsDate.getTime())) {
        return asTsDate;
      }
      return null;
    }

    var asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }

  function formatDateTime(value) {
    var date = toDate(value);
    if (!date) {
      return DASH;
    }

    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function normalizeStoreLink(rawDomain, storeId) {
    var domain = cleanText(rawDomain);
    if (!domain) {
      var fallbackStoreId = sanitizeStoreId(storeId);
      return fallbackStoreId ? "https://" + fallbackStoreId + ".vitryna-shop.com" : "";
    }

    if (/^https?:\/\//i.test(domain)) {
      return domain;
    }

    return "https://" + domain;
  }

  function toHost(raw) {
    var value = cleanText(raw);
    if (!value) {
      return "";
    }

    try {
      return String(new URL(value).hostname || "").toLowerCase();
    } catch (error) {
      return value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
    }
  }

  function pickAddress(registrationValue, settingsValue, registryData) {
    var candidates = [
      registrationValue && registrationValue.address,
      registrationValue && registrationValue.storeAddress,
      settingsValue && settingsValue.address,
      settingsValue && settingsValue.storeAddress,
      settingsValue && settingsValue.pickupAddress,
      settingsValue && settingsValue.deliveryAddress,
      registryData && registryData.address,
      registryData && registryData.storeAddress,
      registrationValue && registrationValue.domain,
      settingsValue && settingsValue.domain,
      registryData && registryData.domain
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var value = cleanText(candidates[i]);
      if (value) {
        return value;
      }
    }

    return "не вказано";
  }

  function getPlanName(planId) {
    var key = cleanText(planId).toLowerCase();
    return key ? (PLAN_LABELS[key] || key) : "Trial";
  }

  function formatMoney(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount)) {
      amount = 0;
    }
    return "₴" + new Intl.NumberFormat("uk-UA").format(Math.round(amount));
  }

  function formatMb(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      amount = 0;
    }
    return amount.toFixed(2) + " МБ";
  }

  function normalizeCustomDomainStatus(rawStatus) {
    var status = cleanText(rawStatus).toLowerCase();
    if (status === "connected") {
      return { label: "активний", className: "green" };
    }
    if (status === "error") {
      return { label: "помилка SSL", className: "red" };
    }
    if (status === "pending") {
      return { label: "очікує DNS", className: "orange" };
    }
    return { label: "не підключено", className: "blue" };
  }

  function getMonthStart(now) {
    var d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getProductStats(products) {
    var list = toArray(products);
    var activeCount = 0;
    var hiddenCount = 0;
    var photosBytes = 0;

    for (var i = 0; i < list.length; i += 1) {
      var product = list[i] || {};
      if (product.visible === false) {
        hiddenCount += 1;
      } else {
        activeCount += 1;
      }

      var photos = toArray(product.photos);
      for (var j = 0; j < photos.length; j += 1) {
        var size = Number(photos[j] && photos[j].size);
        if (Number.isFinite(size) && size > 0) {
          photosBytes += size;
        }
      }
    }

    return {
      total: list.length,
      active: activeCount,
      hidden: hiddenCount,
      photoMegabytes: photosBytes / (1024 * 1024)
    };
  }

  function getCategoryStats(categories, products) {
    var list = toArray(categories);
    var map = {};
    for (var i = 0; i < list.length; i += 1) {
      var name = cleanText(list[i] && list[i].name).toLowerCase();
      if (name) {
        map[name] = { active: 0, hidden: 0 };
      }
    }

    var productList = toArray(products);
    for (var k = 0; k < productList.length; k += 1) {
      var product = productList[k] || {};
      var names = toArray(product.categories);
      if (!names.length && product.category) {
        names = [product.category];
      }

      for (var p = 0; p < names.length; p += 1) {
        var categoryName = cleanText(names[p]).toLowerCase();
        if (!categoryName) {
          continue;
        }

        if (!map[categoryName]) {
          map[categoryName] = { active: 0, hidden: 0 };
        }

        if (product.visible === false) {
          map[categoryName].hidden += 1;
        } else {
          map[categoryName].active += 1;
        }
      }
    }

    var activeCategories = 0;
    var hiddenCategories = 0;
    var categoryNames = Object.keys(map);
    for (var c = 0; c < categoryNames.length; c += 1) {
      var stat = map[categoryNames[c]];
      if (stat.active > 0) {
        activeCategories += 1;
      }
      if (stat.hidden > 0 && stat.active === 0) {
        hiddenCategories += 1;
      }
    }

    return {
      total: categoryNames.length,
      active: activeCategories,
      hidden: hiddenCategories
    };
  }

  function normalizeOrderTotal(order) {
    var direct = Number(order && order.total);
    if (Number.isFinite(direct) && direct >= 0) {
      return direct;
    }

    var subtotal = Number(order && order.subtotal);
    if (Number.isFinite(subtotal) && subtotal >= 0) {
      return subtotal;
    }

    var amount = Number(order && order.amount);
    if (Number.isFinite(amount) && amount >= 0) {
      return amount;
    }

    return 0;
  }

  function getMonthlySalesStats(orders) {
    var now = new Date();
    var monthStart = getMonthStart(now);
    var list = toArray(orders);
    var count = 0;
    var revenue = 0;

    for (var i = 0; i < list.length; i += 1) {
      var order = list[i] || {};
      var date = toDate(order.createdAt || order.updatedAt);
      if (!date || date.getTime() < monthStart.getTime() || date.getTime() > now.getTime()) {
        continue;
      }

      var status = cleanText(order.status).toLowerCase();
      if (status.indexOf("скас") !== -1) {
        continue;
      }

      count += 1;
      revenue += normalizeOrderTotal(order);
    }

    return {
      revenue: revenue,
      count: count,
      average: count ? revenue / count : 0
    };
  }

  function buildActivityItems(payload) {
    var items = [];
    var settings = (payload && payload.settings) || {};
    var checkout = (payload && payload.checkout) || {};
    var billing = (payload && payload.billing) || {};
    var auth = (payload && payload.auth) || {};
    var products = toArray(payload && payload.products);
    var orders = toArray(payload && payload.orders);

    function pushItem(at, eventLabel, details) {
      var date = toDate(at);
      if (!date) {
        return;
      }
      items.push({ at: date, eventLabel: eventLabel, details: details || DASH });
    }

    pushItem(auth.authorizedAt || auth.updatedAt, "Вхід в адмінку", "Остання авторизація власника");
    pushItem(settings.updatedAt, "Оновлено налаштування", "Зміни в загальних налаштуваннях магазину");
    pushItem(checkout.updatedAt, "Підключено/оновлено оплату", "Оновлено платіжні методи");

    var domainStatus = normalizeCustomDomainStatus(settings.customDomainStatus);
    if (cleanText(settings.customDomain)) {
      pushItem(settings.updatedAt, "Оновлено власний домен", cleanText(settings.customDomain) + " (" + domainStatus.label + ")");
    }

    var latestProduct = null;
    for (var i = 0; i < products.length; i += 1) {
      var product = products[i] || {};
      var productAt = toDate(product.updatedAt || product.createdAt);
      if (!productAt) continue;
      if (!latestProduct || productAt.getTime() > latestProduct.at.getTime()) {
        latestProduct = { at: productAt, name: cleanText(product.name) || "Товар" };
      }
    }
    if (latestProduct) {
      pushItem(latestProduct.at, "Додано/оновлено товар", latestProduct.name);
    }

    var latestPriceUpdate = null;
    for (var j = 0; j < products.length; j += 1) {
      var productRow = products[j] || {};
      var hasPriceInfo = Number.isFinite(Number(productRow.price))
        || Number.isFinite(Number(productRow.newPrice))
        || Number.isFinite(Number(productRow.oldPrice));
      if (!hasPriceInfo) continue;
      var priceAt = toDate(productRow.updatedAt || productRow.createdAt);
      if (!priceAt) continue;
      if (!latestPriceUpdate || priceAt.getTime() > latestPriceUpdate.at.getTime()) {
        latestPriceUpdate = { at: priceAt, name: cleanText(productRow.name) || "Товар" };
      }
    }
    if (latestPriceUpdate) {
      pushItem(latestPriceUpdate.at, "Змінено ціну", latestPriceUpdate.name);
    }

    var latestOrder = null;
    for (var k = 0; k < orders.length; k += 1) {
      var order = orders[k] || {};
      var orderAt = toDate(order.updatedAt || order.createdAt);
      if (!orderAt) continue;
      if (!latestOrder || orderAt.getTime() > latestOrder.at.getTime()) {
        latestOrder = {
          at: orderAt,
          id: cleanText(order.id) || "Замовлення",
          total: normalizeOrderTotal(order)
        };
      }
    }
    if (latestOrder) {
      pushItem(latestOrder.at, "Оновлено замовлення", latestOrder.id + ", сума " + formatMoney(latestOrder.total));
    }

    var payments = toArray(billing.payments);
    if (payments.length) {
      var recentPayment = payments[0] || {};
      pushItem(recentPayment.paidAt, "Оновлено тариф", cleanText(recentPayment.planName) || "Платіж тарифу");
    }

    items.sort(function (a, b) {
      return b.at.getTime() - a.at.getTime();
    });

    return items.slice(0, 8);
  }

  async function fetchStoreDetails(storeId) {
    var id = sanitizeStoreId(storeId);
    if (!id) {
      return null;
    }

    var db = initDb();
    var registryRef = db.collection("stores_registry").doc(id);
    var baseRef = db.collection("stores").doc(id).collection("data");

    var snaps = await Promise.all([
      registryRef.get(),
      baseRef.doc(REGISTRATION_KEY).get(),
      baseRef.doc(SETTINGS_KEY).get(),
      baseRef.doc("lavkaCheckoutSettings").get(),
      baseRef.doc(PRODUCTS_KEY).get(),
      baseRef.doc(CATEGORIES_KEY).get(),
      baseRef.doc(ORDERS_KEY).get(),
      baseRef.doc(BILLING_KEY).get(),
      baseRef.doc(AUTH_KEY).get()
    ]);

    var registryDoc = snaps[0].exists ? (snaps[0].data() || {}) : {};
    var registrationDoc = snaps[1].exists ? (snaps[1].data() || {}) : {};
    var settingsDoc = snaps[2].exists ? (snaps[2].data() || {}) : {};
    var checkoutDoc = snaps[3].exists ? (snaps[3].data() || {}) : {};
    var productsDoc = snaps[4].exists ? (snaps[4].data() || {}) : {};
    var categoriesDoc = snaps[5].exists ? (snaps[5].data() || {}) : {};
    var ordersDoc = snaps[6].exists ? (snaps[6].data() || {}) : {};
    var billingDoc = snaps[7].exists ? (snaps[7].data() || {}) : {};
    var authDoc = snaps[8].exists ? (snaps[8].data() || {}) : {};

    return {
      storeId: id,
      registry: registryDoc,
      registration: registrationDoc.value || {},
      settings: settingsDoc.value || {},
      checkout: checkoutDoc.value || {},
      products: toArray(productsDoc.value),
      categories: toArray(categoriesDoc.value),
      orders: toArray(ordersDoc.value),
      billing: billingDoc.value || {},
      auth: authDoc.value || {},
      checkoutUpdatedAt: checkoutDoc.updatedAt || null
    };
  }

  function setModalStatus(message, kind) {
    if (!modalStatusEl) {
      return;
    }
    modalStatusEl.textContent = message || "";
    modalStatusEl.classList.remove("error", "success");
    if (kind) {
      modalStatusEl.classList.add(kind);
    }
  }

  function openModal() {
    if (!modalEl) return;
    modalEl.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.style.overflow = "";
  }

  function renderStoreModal(details) {
    if (!details) {
      return;
    }

    var registration = details.registration || {};
    var settings = details.settings || {};
    var registry = details.registry || {};
    var defaultDomain = cleanText(registration.domain) || cleanText(settings.domain) || cleanText(registry.domain);
    var defaultDomainUrl = defaultDomain
      ? (/^https?:\/\//i.test(defaultDomain) ? defaultDomain : "https://" + defaultDomain)
      : ("https://" + details.storeId + ".vitryna-shop.com");

    if (modalDefaultDomainEl) {
      modalDefaultDomainEl.textContent = defaultDomainUrl;
      modalDefaultDomainEl.href = defaultDomainUrl;
    }

    var customDomain = cleanText(settings.customDomain);
    var customDomainStatus = normalizeCustomDomainStatus(settings.customDomainStatus);
    if (modalCustomDomainInputEl && document.activeElement !== modalCustomDomainInputEl) {
      modalCustomDomainInputEl.value = customDomain;
    }
    if (modalCustomDomainMessageEl) {
      modalCustomDomainMessageEl.textContent = "";
      modalCustomDomainMessageEl.classList.remove("error", "success");
    }
    if (modalCustomDomainStatusEl) {
      modalCustomDomainStatusEl.textContent = customDomainStatus.label;
      modalCustomDomainStatusEl.classList.remove("green", "blue", "orange", "red");
      modalCustomDomainStatusEl.classList.add(customDomainStatus.className);
    }

    var productStats = getProductStats(details.products);
    if (modalProductsStatsEl) {
      modalProductsStatsEl.textContent = productStats.total + " (активні: " + productStats.active + ", приховані: " + productStats.hidden + ")";
    }

    var categoryStats = getCategoryStats(details.categories, details.products);
    if (modalCategoriesStatsEl) {
      modalCategoriesStatsEl.textContent = categoryStats.total + " (активні: " + categoryStats.active + ", приховані: " + categoryStats.hidden + ")";
    }

    if (modalStorageStatsEl) {
      modalStorageStatsEl.textContent = formatMb(productStats.photoMegabytes);
    }

    var billing = details.billing || {};
    var planName = getPlanName(billing.currentPlanId);
    var payments = toArray(billing.payments);
    var latestPayment = payments.length ? (payments[0] || {}) : null;
    var isPaid = latestPayment && latestPayment.paidAt;

    if (modalPlanNameEl) {
      modalPlanNameEl.textContent = planName || "Trial";
      modalPlanNameEl.classList.remove("green", "blue", "orange", "red");
      modalPlanNameEl.classList.add(cleanText(planName).toLowerCase() === "trial" ? "orange" : "green");
    }
    if (modalPaymentStatusEl) {
      modalPaymentStatusEl.textContent = isPaid ? "Оплачено" : "Не оплачено";
    }
    if (modalLastPaymentAtEl) {
      modalLastPaymentAtEl.textContent = latestPayment ? formatDateTime(latestPayment.paidAt || latestPayment.createdAt) : DASH;
    }

    var monthStats = getMonthlySalesStats(details.orders);
    if (modalMonthRevenueEl) {
      modalMonthRevenueEl.textContent = formatMoney(monthStats.revenue);
    }
    if (modalMonthOrdersEl) {
      modalMonthOrdersEl.textContent = String(monthStats.count);
    }
    if (modalMonthAverageEl) {
      modalMonthAverageEl.textContent = formatMoney(monthStats.average);
    }

    var activityItems = buildActivityItems({
      settings: settings,
      checkout: Object.assign({}, details.checkout || {}, { updatedAt: details.checkoutUpdatedAt || (details.checkout || {}).updatedAt }),
      billing: details.billing || {},
      auth: details.auth || {},
      products: details.products || [],
      orders: details.orders || []
    });

    if (modalActivityBodyEl) {
      if (!activityItems.length) {
        modalActivityBodyEl.innerHTML = '<tr><td colspan="3">Активність поки відсутня.</td></tr>';
      } else {
        modalActivityBodyEl.innerHTML = activityItems.map(function (item) {
          return "<tr>"
            + "<td>" + escapeHtml(formatDateTime(item.at)) + "</td>"
            + "<td>" + escapeHtml(item.eventLabel) + "</td>"
            + "<td>" + escapeHtml(item.details) + "</td>"
            + "</tr>";
        }).join("");
      }
    }

    setModalStatus("Детальна картка магазину: " + details.storeId, "success");
  }

  async function openStoreCard(storeId) {
    var id = sanitizeStoreId(storeId);
    if (!id) {
      return;
    }

    activeStoreId = id;
    openModal();
    setModalStatus("Завантажуємо картку магазину...", "");
    if (modalActivityBodyEl) {
      modalActivityBodyEl.innerHTML = '<tr><td colspan="3">Завантажуємо активність...</td></tr>';
    }

    try {
      var details = await fetchStoreDetails(id);
      renderStoreModal(details);
    } catch (error) {
      console.error("[owner-admin/stores] failed to open store card:", error);
      setModalStatus("Не вдалося завантажити картку магазину.", "error");
    }
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function setStatus(message, kind) {
    if (!statusEl) {
      return;
    }

    statusEl.textContent = message || "";
    statusEl.classList.remove("error", "success");
    if (kind) {
      statusEl.classList.add(kind);
    }
  }

  function dedupeRows(rows) {
    var list = Array.isArray(rows) ? rows.slice() : [];
    var usedKeys = {};
    var result = [];

    function buildScore(row) {
      var score = 0;
      var id = sanitizeStoreId(row && row.storeId);
      var host = toHost(row && row.storeUrl);
      var plan = cleanText(row && row.planName).toLowerCase();
      var lastActivity = toDate(row && row.lastActivity);

      if (id && id !== "default-store") {
        score += 50;
      }
      if (host) {
        score += 20;
      }
      if (plan && plan !== "trial") {
        score += 10;
      }
      if (Number(row && row.ordersCount) > 0) {
        score += 5;
      }
      if (lastActivity) {
        score += lastActivity.getTime() / 1e13;
      }

      return score;
    }

    list.sort(function (a, b) {
      return buildScore(b) - buildScore(a);
    });

    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      var id = sanitizeStoreId(row && row.storeId);
      var host = toHost(row && row.storeUrl);
      var owner = cleanText(row && row.ownerLabel).toLowerCase();
      var name = cleanText(row && row.storeName).toLowerCase();
      var address = cleanText(row && row.storeAddress).toLowerCase();
      var keys = [];

      if (id) {
        keys.push("id:" + id);
      }
      if (host) {
        keys.push("host:" + host);
      }
      if (name && owner) {
        keys.push("nameOwner:" + name + "|" + owner);
      }
      if (name && address && address !== "не вказано") {
        keys.push("nameAddress:" + name + "|" + address);
      }

      if (!keys.length) {
        continue;
      }

      var hasDuplicate = keys.some(function (key) {
        return Boolean(usedKeys[key]);
      });
      if (hasDuplicate) {
        continue;
      }

      keys.forEach(function (key) {
        usedKeys[key] = true;
      });
      result.push(row);
    }

    return result;
  }

  async function fetchStoresTableRows() {
    var db = initDb();
    var registrySnap = await db.collection("stores_registry").get();
    var rows = [];

    for (var i = 0; i < registrySnap.docs.length; i += 1) {
      var registryDoc = registrySnap.docs[i];
      var storeId = registryDoc.id;
      var registryData = registryDoc.data() || {};

      var baseRef = db.collection("stores").doc(storeId).collection("data");
      var snaps = await Promise.all([
        baseRef.doc(REGISTRATION_KEY).get(),
        baseRef.doc(SETTINGS_KEY).get(),
        baseRef.doc(BILLING_KEY).get(),
        baseRef.doc(PRODUCTS_KEY).get(),
        baseRef.doc(CATEGORIES_KEY).get(),
        baseRef.doc(ORDERS_KEY).get(),
        baseRef.doc(AUTH_KEY).get()
      ]);

      var registrationData = snaps[0].exists ? (snaps[0].data() || {}) : {};
      var settingsData = snaps[1].exists ? (snaps[1].data() || {}) : {};
      var billingData = snaps[2].exists ? (snaps[2].data() || {}) : {};
      var productsData = snaps[3].exists ? (snaps[3].data() || {}) : {};
      var categoriesData = snaps[4].exists ? (snaps[4].data() || {}) : {};
      var ordersData = snaps[5].exists ? (snaps[5].data() || {}) : {};
      var authData = snaps[6].exists ? (snaps[6].data() || {}) : {};

      var registration = registrationData.value || {};
      var settings = settingsData.value || {};
      var billing = billingData.value || {};
      var products = toArray(productsData.value);
      var categories = toArray(categoriesData.value);
      var orders = toArray(ordersData.value);
      var auth = authData.value || {};

      var storeName = cleanText(registration.storeName)
        || cleanText(settings.storeName)
        || cleanText(settings.name)
        || cleanText(registryData.storeName)
        || DASH;

      var phone = cleanText(registration.phone)
        || cleanText(registryData.phone)
        || DASH;

      var ownerName = cleanText(registration.ownerName)
        || cleanText(registration.contactName)
        || cleanText(settings.ownerName)
        || cleanText(settings.contactName)
        || "Власник";

      var ownerLabel = phone !== DASH ? ownerName + " (" + phone + ")" : ownerName;
      var domain = cleanText(registration.domain) || cleanText(settings.domain) || cleanText(registryData.domain);
      var storeUrl = normalizeStoreLink(domain, storeId);
      var domainHost = toHost(storeUrl);
      var customDomain = cleanText(settings.customDomain) || cleanText(registryData.customDomain);
      customDomain = customDomain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/\.$/, "");
      var storeAddress = pickAddress(registration, settings, registryData);
      var planName = getPlanName(billing.currentPlanId);
      var lastActivity = auth.authorizedAt || auth.updatedAt || authData.updatedAt || null;
      var registeredAt = registration.registeredAt || registrationData.updatedAt || registryData.createdAt || null;

      var ownerHref = "/owner-admin/users.html?store=" + encodeURIComponent(storeId)
        + "&phone=" + encodeURIComponent(phone)
        + "&domain=" + encodeURIComponent(domainHost || domain);

      rows.push({
        storeId: storeId,
        storeName: storeName,
        storeUrl: storeUrl,
        customDomain: customDomain,
        storeAddress: storeAddress,
        ownerLabel: ownerLabel,
        ownerHref: ownerHref,
        planName: planName,
        productsCount: products.length,
        categoriesCount: categories.length,
        ordersCount: orders.length,
        lastActivity: lastActivity,
        registeredAt: registeredAt
      });
    }

    return dedupeRows(rows);
  }

  function renderRows(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      tableBodyEl.innerHTML = '<tr><td colspan="6">Магазини поки не знайдено.</td></tr>';
      return;
    }

    var html = rows.map(function (row) {
      var planClass = cleanText(row.planName).toLowerCase() === "trial" ? "orange" : "green";
      var url = escapeHtml(row.storeUrl || "");
      var storeLinkHtml = row.storeUrl
        ? '<a class="table-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(row.storeName) + '</a>'
        : '<span>' + escapeHtml(row.storeName) + '</span>';

      var customDomainHtml = row.customDomain
        ? '<div class="inline-meta">' + escapeHtml(row.customDomain) + '</div>'
        : '';

      return "<tr>"
        + '<td>'
        + storeLinkHtml
        + '<div class="inline-meta">' + escapeHtml(row.storeAddress || DASH) + '</div>'
        + customDomainHtml
        + '</td>'
        + '<td>'
        + '<div>' + escapeHtml(row.ownerLabel || DASH) + '</div>'
        + '<button type="button" class="owner-card-link owner-card-btn" data-action="open-store-card" data-store-id="' + escapeHtml(row.storeId) + '">Картка користувача</button>'
        + '</td>'
        + '<td><span class="pill ' + planClass + '">' + escapeHtml(row.planName || "Trial") + '</span></td>'
        + '<td>' + escapeHtml(String(row.productsCount)) + ' / ' + escapeHtml(String(row.categoriesCount)) + '</td>'
        + '<td>' + escapeHtml(String(row.ordersCount)) + '</td>'
        + '<td>' + escapeHtml(formatDateTime(row.lastActivity)) + '</td>'
        + '</tr>';
    }).join("");

    tableBodyEl.innerHTML = html;
  }

  function normalizeDomainInput(value) {
    var raw = cleanText(value).toLowerCase();
    if (!raw) {
      return "";
    }
    raw = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
    return raw;
  }

  function isValidDomainInput(value) {
    return /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(value);
  }

  function setDomainMessage(message, kind) {
    if (!modalCustomDomainMessageEl) {
      return;
    }
    modalCustomDomainMessageEl.textContent = message || "";
    modalCustomDomainMessageEl.classList.remove("error", "success");
    if (kind) {
      modalCustomDomainMessageEl.classList.add(kind);
    }
  }

  async function saveCustomDomain() {
    var id = sanitizeStoreId(activeStoreId);
    if (!id) {
      return;
    }

    var domain = normalizeDomainInput(modalCustomDomainInputEl ? modalCustomDomainInputEl.value : "");
    if (domain && !isValidDomainInput(domain)) {
      setDomainMessage("Введіть коректний домен, наприклад my-shop.com.", "error");
      return;
    }

    if (modalCustomDomainSaveEl) {
      modalCustomDomainSaveEl.disabled = true;
    }
    setDomainMessage("Зберігаємо...", "");

    try {
      var db = initDb();
      var now = new Date().toISOString();
      var settingsRef = db.collection("stores").doc(id).collection("data").doc(SETTINGS_KEY);

      var snap = await settingsRef.get();
      var currentDoc = snap.exists ? (snap.data() || {}) : {};
      var value = Object.assign({}, currentDoc.value || {});
      value.customDomain = domain;
      value.customDomainStatus = domain ? "connected" : "";
      value.updatedAt = now;

      await settingsRef.set({ key: SETTINGS_KEY, value: value, updatedAt: now }, { merge: true });
      await db.collection("stores_registry").doc(id).set({
        storeId: id,
        customDomain: domain,
        updatedAt: now
      }, { merge: true });

      if (modalCustomDomainInputEl && document.activeElement !== modalCustomDomainInputEl) {
        modalCustomDomainInputEl.value = domain;
      }
      if (modalCustomDomainStatusEl) {
        var savedStatus = normalizeCustomDomainStatus(value.customDomainStatus);
        modalCustomDomainStatusEl.textContent = savedStatus.label;
        modalCustomDomainStatusEl.classList.remove("green", "blue", "orange", "red");
        modalCustomDomainStatusEl.classList.add(savedStatus.className);
      }
      setDomainMessage(domain ? "Домен збережено." : "Домен очищено.", "success");
    } catch (error) {
      console.error("[owner-admin/stores] failed to save custom domain:", error);
      setDomainMessage("Не вдалося зберегти домен.", "error");
    } finally {
      if (modalCustomDomainSaveEl) {
        modalCustomDomainSaveEl.disabled = false;
      }
    }
  }

  function bindEvents() {
    if (!tableBodyEl) {
      return;
    }

    tableBodyEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== "function") {
        return;
      }

      var link = target.closest(".owner-card-link");
      if (link && link.classList.contains("owner-card-btn")) {
        event.preventDefault();
        openStoreCard(cleanText(link.getAttribute("data-store-id")));
        return;
      }

      if (modalEl && !modalEl.hidden && event.target === modalEl) {
        closeModal();
      }
    });

    if (modalCloseEl) {
      modalCloseEl.addEventListener("click", closeModal);
    }

    if (modalCustomDomainSaveEl) {
      modalCustomDomainSaveEl.addEventListener("click", saveCustomDomain);
    }

    if (modalCustomDomainInputEl) {
      modalCustomDomainInputEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          saveCustomDomain();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modalEl && !modalEl.hidden) {
        closeModal();
      }
    });
  }

  async function bootstrap() {
    try {
      var rows = await fetchStoresTableRows();
      storesState = rows;
      renderRows(rows);
      if (badgeEl) {
        badgeEl.textContent = rows.length + " магазинів";
      }
      setStatus("", "");
    } catch (error) {
      console.error("[owner-admin/stores] load failed:", error);
      if (badgeEl) {
        badgeEl.textContent = "Помилка завантаження";
      }
      tableBodyEl.innerHTML = '<tr><td colspan="6">Не вдалося завантажити дані з бази.</td></tr>';
      setStatus("Помилка завантаження даних з Firestore.", "error");
    }
  }

  bindEvents();
  bootstrap();
})();
