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
  var STORE_SETTINGS_KEY = "lavkaStoreSettings";
  var DELETE_STORE_ACCOUNT_URL = "https://us-central1-lavka-shop.cloudfunctions.net/deleteStoreAccountCascade";
  var DASH = "-";

  var badgeEl = document.getElementById("usersTotalBadge");
  var totalStoresEl = document.getElementById("kpiTotalStores");
  var withPhoneEl = document.getElementById("kpiWithPhone");
  var withAddressEl = document.getElementById("kpiWithAddress");
  var tableBodyEl = document.getElementById("usersTableBody");
  var actionStatusEl = document.getElementById("usersActionStatus");
  var storeProfileCardEl = document.getElementById("storeProfileCard");
  var storeProfileStatusEl = document.getElementById("storeProfileStatus");
  var storeDefaultDomainEl = document.getElementById("storeDefaultDomain");
  var storeCustomDomainEl = document.getElementById("storeCustomDomain");
  var storeCustomDomainStatusEl = document.getElementById("storeCustomDomainStatus");
  var storeProductsStatsEl = document.getElementById("storeProductsStats");
  var storeCategoriesStatsEl = document.getElementById("storeCategoriesStats");
  var storeStorageStatsEl = document.getElementById("storeStorageStats");
  var storeMonthRevenueEl = document.getElementById("storeMonthRevenue");
  var storeMonthOrdersEl = document.getElementById("storeMonthOrders");
  var storeMonthAverageEl = document.getElementById("storeMonthAverage");
  var storeActivityBodyEl = document.getElementById("storeActivityBody");
  var STORE_CARD_CONTEXT_KEY = "ownerAdminSelectedStoreCard";
  var searchParams = new URLSearchParams(window.location.search || "");
  var hashParams = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));

  function readContextPayload() {
    try {
      var raw = sessionStorage.getItem(STORE_CARD_CONTEXT_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  var contextPayload = readContextPayload() || {};
  var selectedStoreId = sanitizeStoreId(searchParams.get("store") || hashParams.get("store") || contextPayload.storeId || "");
  var selectedPhoneDigits = normalizePhoneDigits(searchParams.get("phone") || hashParams.get("phone") || contextPayload.phone || "");
  var selectedDomainHint = getDomainHost(searchParams.get("domain") || hashParams.get("domain") || contextPayload.domain || "");
  var resolvedSelectedStoreId = "";
  var storesState = [];
  var deletingMap = {};
  var togglingAccessMap = {};

  function initDb() {
    if (!window.firebase) {
      throw new Error("firebase-unavailable");
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    return firebase.firestore();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function normalizePhoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizeIp(value) {
    return String(value || "").trim().toLowerCase();
  }

  function encodeIpKey(ip) {
    return normalizeIp(ip).replace(/[^a-z0-9:.]/g, "_");
  }

  function getDomainHost(raw) {
    var domain = cleanText(raw);
    if (!domain) {
      return "";
    }

    try {
      return String(new URL(domain).hostname || "").toLowerCase();
    } catch (error) {
      var fallback = domain
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
      return fallback;
    }
  }

  function parseRegistrationTime(raw) {
    var date = toDate(raw);
    return date ? date.getTime() : 0;
  }

  function buildStorePriorityScore(row) {
    var score = 0;
    var storeId = sanitizeStoreId(row && row.storeId);
    var registryStoreId = sanitizeStoreId(row && row.registryStoreId);

    if (storeId && storeId !== "default-store") {
      score += 50;
    }
    if (registryStoreId && registryStoreId !== "default-store") {
      score += 30;
    }
    if (row && row.domainHost) {
      score += 20;
    }
    if (row && row.phoneDigits) {
      score += 10;
    }

    score += parseRegistrationTime(row && row.registeredAt) / 1e13;
    return score;
  }

  function dedupeStores(rows) {
    var list = Array.isArray(rows) ? rows.slice() : [];
    var usedKeys = {};
    var result = [];

    list.sort(function (a, b) {
      var scoreDiff = buildStorePriorityScore(b) - buildStorePriorityScore(a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      var leftTime = parseRegistrationTime(a && a.registeredAt);
      var rightTime = parseRegistrationTime(b && b.registeredAt);
      return rightTime - leftTime;
    });

    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      var keys = [];
      var storeId = sanitizeStoreId(row && row.storeId);
      var registryStoreId = sanitizeStoreId(row && row.registryStoreId);
      var domainHost = cleanText(row && row.domainHost).toLowerCase();
      var phoneDigits = cleanText(row && row.phoneDigits);
      var nameKey = cleanText(row && row.storeName).toLowerCase();

      if (storeId) {
        keys.push("id:" + storeId);
      }
      if (registryStoreId) {
        keys.push("rid:" + registryStoreId);
      }
      if (domainHost) {
        keys.push("domain:" + domainHost);
      }
      if (phoneDigits && nameKey && nameKey !== DASH.toLowerCase()) {
        keys.push("phoneName:" + phoneDigits + "|" + nameKey);
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

    result.sort(function (a, b) {
      var left = toDate(a.registeredAt);
      var right = toDate(b.registeredAt);
      var leftTime = left ? left.getTime() : 0;
      var rightTime = right ? right.getTime() : 0;
      return rightTime - leftTime;
    });

    return result;
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
      var normalized = cleanText(candidates[i]);
      if (normalized) {
        return normalized;
      }
    }

    return "не вказано";
  }

  function toDate(value) {
    if (!value) {
      return null;
    }

    if (typeof value.toDate === "function") {
      var tsDate = value.toDate();
      if (tsDate instanceof Date && !Number.isNaN(tsDate.getTime())) {
        return tsDate;
      }
      return null;
    }

    var asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate;
    }

    return null;
  }

  function formatDateTime(raw) {
    var date = toDate(raw);
    if (!date) {
      return DASH;
    }

    return new Intl.DateTimeFormat("uk-UA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
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

  function toArray(value) {
    return Array.isArray(value) ? value : [];
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

    var pushItem = function (at, eventLabel, details) {
      var date = toDate(at);
      if (!date) {
        return;
      }
      items.push({
        at: date,
        eventLabel: eventLabel,
        details: details || DASH
      });
    };

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
      if (!productAt) {
        continue;
      }
      if (!latestProduct || productAt.getTime() > latestProduct.at.getTime()) {
        latestProduct = {
          at: productAt,
          name: cleanText(product.name) || "Товар"
        };
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
      if (!hasPriceInfo) {
        continue;
      }
      var priceAt = toDate(productRow.updatedAt || productRow.createdAt);
      if (!priceAt) {
        continue;
      }
      if (!latestPriceUpdate || priceAt.getTime() > latestPriceUpdate.at.getTime()) {
        latestPriceUpdate = {
          at: priceAt,
          name: cleanText(productRow.name) || "Товар"
        };
      }
    }

    if (latestPriceUpdate) {
      pushItem(latestPriceUpdate.at, "Змінено ціну", latestPriceUpdate.name);
    }

    var latestOrder = null;
    for (var k = 0; k < orders.length; k += 1) {
      var order = orders[k] || {};
      var orderAt = toDate(order.updatedAt || order.createdAt);
      if (!orderAt) {
        continue;
      }
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

  async function fetchSelectedStoreDetails(storeId) {
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
      baseRef.doc(STORE_SETTINGS_KEY).get(),
      baseRef.doc("lavkaCheckoutSettings").get(),
      baseRef.doc("lavkaProducts").get(),
      baseRef.doc("lavkaCategories").get(),
      baseRef.doc("lavkaOrders").get(),
      baseRef.doc("lavkaBilling").get(),
      baseRef.doc("lavkaAuth").get()
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

  function renderStoreProfile(details) {
    if (!storeProfileCardEl || !selectedStoreId) {
      return;
    }

    if (!details) {
      storeProfileCardEl.hidden = true;
      return;
    }

    storeProfileCardEl.hidden = false;

    var registration = details.registration || {};
    var settings = details.settings || {};
    var registry = details.registry || {};
    var defaultDomain = cleanText(registration.domain) || cleanText(settings.domain) || cleanText(registry.domain);
    var defaultDomainUrl = defaultDomain
      ? (/^https?:\/\//i.test(defaultDomain) ? defaultDomain : "https://" + defaultDomain)
      : ("https://" + details.storeId + ".vitryna-shop.com");

    if (storeDefaultDomainEl) {
      storeDefaultDomainEl.textContent = defaultDomainUrl;
      storeDefaultDomainEl.href = defaultDomainUrl;
    }

    var customDomain = cleanText(settings.customDomain);
    var customDomainStatus = normalizeCustomDomainStatus(settings.customDomainStatus);
    if (storeCustomDomainEl) {
      storeCustomDomainEl.textContent = customDomain || DASH;
    }
    if (storeCustomDomainStatusEl) {
      storeCustomDomainStatusEl.textContent = customDomainStatus.label;
      storeCustomDomainStatusEl.classList.remove("green", "blue", "orange", "red");
      storeCustomDomainStatusEl.classList.add(customDomainStatus.className);
    }

    var productStats = getProductStats(details.products);
    if (storeProductsStatsEl) {
      storeProductsStatsEl.textContent = productStats.total + " (активні: " + productStats.active + ", приховані: " + productStats.hidden + ")";
    }

    var categoryStats = getCategoryStats(details.categories, details.products);
    if (storeCategoriesStatsEl) {
      storeCategoriesStatsEl.textContent = categoryStats.total + " (активні: " + categoryStats.active + ", приховані: " + categoryStats.hidden + ")";
    }

    if (storeStorageStatsEl) {
      storeStorageStatsEl.textContent = formatMb(productStats.photoMegabytes);
    }

    var monthStats = getMonthlySalesStats(details.orders);
    if (storeMonthRevenueEl) {
      storeMonthRevenueEl.textContent = formatMoney(monthStats.revenue);
    }
    if (storeMonthOrdersEl) {
      storeMonthOrdersEl.textContent = String(monthStats.count);
    }
    if (storeMonthAverageEl) {
      storeMonthAverageEl.textContent = formatMoney(monthStats.average);
    }

    var activityItems = buildActivityItems({
      settings: settings,
      checkout: Object.assign({}, details.checkout || {}, { updatedAt: details.checkoutUpdatedAt || (details.checkout || {}).updatedAt }),
      billing: details.billing || {},
      auth: details.auth || {},
      products: details.products || [],
      orders: details.orders || []
    });

    if (storeActivityBodyEl) {
      if (!activityItems.length) {
        storeActivityBodyEl.innerHTML = '<tr><td colspan="3">Активність поки відсутня.</td></tr>';
      } else {
        storeActivityBodyEl.innerHTML = activityItems.map(function (item) {
          return "<tr>"
            + "<td>" + escapeHtml(formatDateTime(item.at)) + "</td>"
            + "<td>" + escapeHtml(item.eventLabel) + "</td>"
            + "<td>" + escapeHtml(item.details) + "</td>"
            + "</tr>";
        }).join("");
      }
    }

    if (storeProfileStatusEl) {
      storeProfileStatusEl.textContent = "Детальна картка магазину: " + details.storeId;
      storeProfileStatusEl.classList.remove("error");
      storeProfileStatusEl.classList.add("success");
    }
  }

  function setActionStatus(message, kind) {
    if (!actionStatusEl) {
      return;
    }

    actionStatusEl.textContent = message || "";
    actionStatusEl.classList.remove("error", "success");
    if (kind) {
      actionStatusEl.classList.add(kind);
    }
  }

  function isDeleting(storeId) {
    return Boolean(deletingMap[storeId]);
  }

  function closeAllActionMenus() {
    tableBodyEl.querySelectorAll(".users-actions-menu .users-actions").forEach(function (node) {
      node.hidden = true;
      node.classList.remove("open-up");
      node.style.position = "";
      node.style.left = "";
      node.style.top = "";
      node.style.right = "";
      node.style.bottom = "";
    });
    tableBodyEl.querySelectorAll(".users-actions-toggle").forEach(function (node) {
      node.setAttribute("aria-expanded", "false");
    });
  }

  function getEventTargetElement(event) {
    var raw = event && event.target;
    if (!raw) {
      return null;
    }
    if (raw.nodeType === 1) {
      return raw;
    }
    return raw.parentElement || null;
  }

  function isTogglingAccess(storeId) {
    return Boolean(togglingAccessMap[storeId]);
  }

  function getStoreAccessState(row) {
    var status = cleanText(row && row.accountStatus).toLowerCase();
    return status === "blocked" ? "blocked" : "active";
  }

  function getAccessIp(row) {
    var ip = cleanText(row && row.lastIpAddress);
    return ip || DASH;
  }

  function renderRows(rows) {
    var activeStoreFilter = resolvedSelectedStoreId || selectedStoreId;
    var sourceRows = Array.isArray(rows) ? rows : [];
    var visibleRows = activeStoreFilter
      ? sourceRows.filter(function (row) {
          return sanitizeStoreId(row && row.storeId) === activeStoreFilter;
        })
      : sourceRows;

    if (!visibleRows.length) {
      tableBodyEl.innerHTML = "<tr><td colspan=\"9\">Магазини поки не зареєстровані.</td></tr>";
      return;
    }

    var html = visibleRows
      .map(function (row, index) {
        var number = index + 1;
        var phone = escapeHtml(row.phone || DASH);
        var clientName = escapeHtml(row.clientName || DASH);
        var storeName = escapeHtml(row.storeName || DASH);
        var category = escapeHtml(row.category || DASH);
        var address = escapeHtml(row.address || "не вказано");
        var ipAddress = escapeHtml(getAccessIp(row));
        var accessState = getStoreAccessState(row);
        var registeredAt = escapeHtml(formatDateTime(row.registeredAt));
        var storeId = escapeHtml(row.storeId);
        var disabledAttr = isDeleting(row.storeId) ? " disabled" : "";
        var actionLabel = isDeleting(row.storeId) ? "Видаляємо..." : "Видалити назавжди";
        var accessBusy = isTogglingAccess(row.storeId);
        var accessDisabledAttr = accessBusy || isDeleting(row.storeId) ? " disabled" : "";
        var blockButtonLabel = accessBusy && accessState !== "blocked" ? "Оновлюємо..." : "Заблокувати";
        var unblockButtonLabel = accessBusy && accessState === "blocked" ? "Оновлюємо..." : "Розблокувати";
        var blockDisabledAttr = accessState === "blocked" ? " disabled" : accessDisabledAttr;
        var unblockDisabledAttr = accessState === "active" ? " disabled" : accessDisabledAttr;

        return "<tr>"
          + "<td>" + number + "</td>"
          + "<td>" + phone + "</td>"
          + "<td>" + clientName + "</td>"
          + "<td>" + storeName + "</td>"
          + "<td>" + category + "</td>"
          + "<td>" + address + "</td>"
          + "<td>" + ipAddress + "</td>"
          + "<td>" + registeredAt + "</td>"
            + "<td><div class=\"users-actions-menu\">"
            + "<button type=\"button\" class=\"users-actions-toggle\" data-action=\"toggle-actions\" aria-label=\"Відкрити дії\" aria-expanded=\"false\">...</button>"
            + "<div class=\"users-actions\" hidden>"
            + "<button type=\"button\" class=\"danger-btn\" data-action=\"block-store\" data-store-id=\"" + storeId + "\"" + blockDisabledAttr + ">" + blockButtonLabel + "</button>"
            + "<button type=\"button\" class=\"secondary-btn\" data-action=\"unblock-store\" data-store-id=\"" + storeId + "\"" + unblockDisabledAttr + ">" + unblockButtonLabel + "</button>"
            + "<button type=\"button\" class=\"danger-btn\" data-action=\"delete-store\" data-store-id=\"" + storeId + "\"" + disabledAttr + ">" + actionLabel + "</button>"
            + "</div>"
          + "</div></td>"
          + "</tr>";
      })
      .join("");

    tableBodyEl.innerHTML = html;
  }

  async function fetchStores() {
    var db = initDb();
    var registrySnap = await db.collection("stores_registry").get();
    var stores = [];

    for (var i = 0; i < registrySnap.docs.length; i += 1) {
      var registryDoc = registrySnap.docs[i];
      var storeId = registryDoc.id;
      var registryData = registryDoc.data() || {};

      var registrationRef = db.collection("stores").doc(storeId).collection("data").doc(REGISTRATION_KEY);
      var settingsRef = db.collection("stores").doc(storeId).collection("data").doc(STORE_SETTINGS_KEY);
      var authRef = db.collection("stores").doc(storeId).collection("data").doc("lavkaAuth");
      var subdomainRef = db.collection("store_subdomains").doc(storeId);

      var snaps = await Promise.all([registrationRef.get(), settingsRef.get(), authRef.get(), subdomainRef.get()]);
      var registrationData = snaps[0].exists ? snaps[0].data() || {} : {};
      var settingsData = snaps[1].exists ? snaps[1].data() || {} : {};
      var authData = snaps[2].exists ? snaps[2].data() || {} : {};
      var subdomainData = snaps[3].exists ? snaps[3].data() || {} : {};

      var registrationValue = registrationData.value || {};
      var settingsValue = settingsData.value || {};
      var authValue = authData.value || {};
      var registryStoreId = cleanText(registryData.storeId) || storeId;

      var phone = cleanText(registrationValue.phone) || cleanText(registryData.phone) || DASH;
      var storeName = cleanText(registrationValue.storeName) || cleanText(settingsValue.storeName) || cleanText(registryData.storeName) || DASH;
      var address = pickAddress(registrationValue, settingsValue, registryData);
      var domain = cleanText(registrationValue.domain) || cleanText(settingsValue.domain) || cleanText(registryData.domain);
      var registeredAt = registrationValue.registeredAt || registrationData.updatedAt || registryData.createdAt || registryData.updatedAt || null;
      var clientName = cleanText(registrationValue.clientName) || cleanText(registrationValue.ownerName) || cleanText(registryData.clientName) || DASH;
      var category = cleanText(registrationValue.category) || cleanText(settingsValue.category) || cleanText(registryData.category) || DASH;

      stores.push({
        storeId: storeId,
        registryStoreId: registryStoreId,
        phone: phone,
        phoneDigits: normalizePhoneDigits(phone),
        storeName: storeName,
        clientName: clientName,
        category: category,
        address: address,
        lastIpAddress: cleanText(authValue.lastIpAddress || authValue.ipAddress || registryData.lastIpAddress || subdomainData.lastIpAddress || ""),
        accountStatus: cleanText(subdomainData.status || registryData.status || "active") || "active",
        domainHost: getDomainHost(domain),
        registeredAt: registeredAt
      });
    }

    return dedupeStores(stores);
  }

  async function deleteCollectionDocs(collectionRef, chunkSize) {
    var size = Number(chunkSize) > 0 ? Number(chunkSize) : 100;

    while (true) {
      var pageSnap = await collectionRef.limit(size).get();
      if (pageSnap.empty) {
        break;
      }

      var batch = initDb().batch();
      pageSnap.docs.forEach(function (doc) {
        batch.delete(doc.ref);
      });
      await batch.commit();

      if (pageSnap.size < size) {
        break;
      }
    }
  }

  async function deleteQueryDocs(queryRef, chunkSize) {
    var size = Number(chunkSize) > 0 ? Number(chunkSize) : 100;

    while (true) {
      var pageSnap = await queryRef.limit(size).get();
      if (pageSnap.empty) {
        break;
      }

      var batch = initDb().batch();
      pageSnap.docs.forEach(function (doc) {
        batch.delete(doc.ref);
      });
      await batch.commit();

      if (pageSnap.size < size) {
        break;
      }
    }
  }

  async function archiveClientBeforeDelete(db, storeId) {
    var safeStoreId = sanitizeStoreId(storeId);
    if (!safeStoreId) {
      return;
    }

    try {
      var dataCol = db.collection("stores").doc(safeStoreId).collection("data");
      var snaps = await Promise.all([
        dataCol.doc(REGISTRATION_KEY).get(),
        dataCol.doc(STORE_SETTINGS_KEY).get(),
        dataCol.doc("lavkaAuth").get(),
        dataCol.doc("lavkaBilling").get(),
        db.collection("store_subdomains").doc(safeStoreId).get(),
        db.collection("stores_registry").doc(safeStoreId).get()
      ]);

      var registrationValue = (snaps[0].exists ? snaps[0].data() || {} : {}).value || {};
      var settingsValue = (snaps[1].exists ? snaps[1].data() || {} : {}).value || {};
      var authValue = (snaps[2].exists ? snaps[2].data() || {} : {}).value || {};
      var billingValue = (snaps[3].exists ? snaps[3].data() || {} : {}).value || {};
      var subdomainData = snaps[4].exists ? snaps[4].data() || {} : {};
      var registryData = snaps[5].exists ? snaps[5].data() || {} : {};

      var planId = cleanText(billingValue.currentPlanId).toLowerCase();
      var planNames = { starter: "Старт", business: "Бізнес", pro: "Про" };
      var domain = cleanText(settingsValue.customDomain)
        || cleanText(registrationValue.customDomain)
        || cleanText(registrationValue.domain)
        || cleanText(settingsValue.domain)
        || cleanText(registryData.domain)
        || cleanText(subdomainData.domain);
      var clientName = cleanText(registrationValue.clientName)
        || cleanText(registrationValue.ownerName)
        || cleanText(registrationValue.fullName)
        || cleanText(registrationValue.name)
        || cleanText(registryData.clientName);

      await db.collection("clients_registry").doc(safeStoreId).set({
        storeId: safeStoreId,
        clientName: clientName,
        registeredAt: registrationValue.registeredAt || registryData.createdAt || registryData.updatedAt || "",
        phone: cleanText(registrationValue.phone) || cleanText(registryData.phone),
        storeName: cleanText(registrationValue.storeName) || cleanText(settingsValue.storeName) || cleanText(registryData.storeName),
        category: cleanText(registrationValue.category) || cleanText(settingsValue.category) || cleanText(registryData.category),
        domain: domain,
        planId: planId,
        planName: planId && planNames[planId] ? planNames[planId] : (planId ? planId : ""),
        status: "deleted",
        ipAddress: cleanText(authValue.lastIpAddress || authValue.ipAddress || registryData.lastIpAddress || subdomainData.lastIpAddress || ""),
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.warn("[owner-admin/users] archive before delete failed:", error);
    }
  }

  async function deleteStoreAccount(storeId) {
    var safeStoreId = sanitizeStoreId(storeId);
    if (!safeStoreId) {
      throw new Error("invalid-store-id");
    }

    var response = await fetch(DELETE_STORE_ACCOUNT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: safeStoreId })
    });

    var payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload || payload.ok !== true) {
      var code = String((payload && payload.error) || "delete-failed");
      var error = new Error(code);
      error.code = code;
      throw error;
    }
  }

  async function handleDeleteClick(storeId) {
    if (!storeId || isDeleting(storeId)) {
      return;
    }

    var target = storesState.find(function (item) {
      return item.storeId === storeId;
    });
    var storeName = target && target.storeName && target.storeName !== DASH ? target.storeName : storeId;
    var confirmed = window.confirm("Видалити акаунт магазину \"" + storeName + "\" назавжди? Цю дію не можна скасувати.");
    if (!confirmed) {
      return;
    }

    deletingMap[storeId] = true;
    setActionStatus("Видаляємо магазин з бази...", "");
    renderRows(storesState);

    try {
      await deleteStoreAccount(storeId);
      storesState = storesState.filter(function (item) {
        return item.storeId !== storeId;
      });
      delete deletingMap[storeId];
      renderKpis(storesState);
      renderRows(storesState);
      setActionStatus("Магазин успішно видалено з бази.", "success");
    } catch (error) {
      delete deletingMap[storeId];
      renderRows(storesState);
      console.error("[owner-admin/users] delete failed:", error);
      var code = String((error && error.code) || "");
      if (/permission-denied/i.test(code)) {
        setActionStatus("Немає прав на видалення. Перевірте правила доступу Firestore.", "error");
      } else {
        setActionStatus("Не вдалося видалити магазин. Спробуйте ще раз.", "error");
      }
    }
  }

  async function setStoreAccessStatus(storeId, nextStatus, ipAddress) {
    var db = initDb();
    var safeStoreId = sanitizeStoreId(storeId);
    if (!safeStoreId) {
      return;
    }

    var statusValue = cleanText(nextStatus).toLowerCase() === "blocked" ? "blocked" : "active";
    var nowIso = new Date().toISOString();
    var normalizedIp = normalizeIp(ipAddress);

    await Promise.all([
      db.collection("store_subdomains").doc(safeStoreId).set({
        status: statusValue,
        updatedAt: nowIso
      }, { merge: true }),
      db.collection("stores_registry").doc(safeStoreId).set({
        status: statusValue,
        updatedAt: nowIso
      }, { merge: true })
    ]);

    if (normalizedIp) {
      if (statusValue === "blocked") {
        await db.collection("blocked_ips").doc(encodeIpKey(normalizedIp)).set({
          ip: normalizedIp,
          blocked: true,
          storeId: safeStoreId,
          reason: "owner-admin-block",
          updatedAt: nowIso
        }, { merge: true });
      } else {
        await db.collection("blocked_ips").doc(encodeIpKey(normalizedIp)).delete().catch(function () {
          return null;
        });
      }
    }
  }

  async function handleAccessToggleClick(storeId, shouldBlock) {
    var safeStoreId = sanitizeStoreId(storeId);
    if (!safeStoreId || isTogglingAccess(safeStoreId) || isDeleting(safeStoreId)) {
      return;
    }

    var target = storesState.find(function (item) {
      return sanitizeStoreId(item && item.storeId) === safeStoreId;
    });
    var storeName = target && target.storeName && target.storeName !== DASH ? target.storeName : safeStoreId;
    var targetIp = normalizeIp(target && target.lastIpAddress);
    var actionLabel = shouldBlock ? "заблокувати" : "розблокувати";
    var confirmed = window.confirm("Ви впевнені, що хочете " + actionLabel + " доступ до магазину \"" + storeName + "\"?");
    if (!confirmed) {
      return;
    }

    togglingAccessMap[safeStoreId] = true;
    setActionStatus((shouldBlock ? "Блокуємо" : "Розблоковуємо") + " доступ...", "");
    renderRows(storesState);

    try {
      await setStoreAccessStatus(safeStoreId, shouldBlock ? "blocked" : "active", targetIp);
      storesState = storesState.map(function (item) {
        if (sanitizeStoreId(item && item.storeId) !== safeStoreId) {
          return item;
        }
        return Object.assign({}, item, {
          accountStatus: shouldBlock ? "blocked" : "active"
        });
      });
      delete togglingAccessMap[safeStoreId];
      renderRows(storesState);
      if (shouldBlock && !targetIp) {
        setActionStatus("Доступ до магазину заблоковано. IP не знайдено, тому глобальне IP-блокування не застосовано.", "error");
      } else if (!shouldBlock && !targetIp) {
        setActionStatus("Доступ до магазину розблоковано. IP не знайдено, тому глобальне IP-розблокування пропущено.", "success");
      } else {
        setActionStatus(shouldBlock ? "Доступ до магазину заблоковано (включно з блоком по IP на всьому сайті)." : "Доступ до магазину розблоковано (IP-блок знято).", "success");
      }
    } catch (error) {
      delete togglingAccessMap[safeStoreId];
      renderRows(storesState);
      console.error("[owner-admin/users] access toggle failed:", error);
      var code = String((error && error.code) || "");
      if (/permission-denied/i.test(code)) {
        setActionStatus("Немає прав змінити статус доступу. Перевірте правила Firestore.", "error");
      } else {
        setActionStatus("Не вдалося змінити статус доступу. Спробуйте ще раз.", "error");
      }
    }
  }

  function renderKpis(stores) {
    var total = stores.length;
    var withPhone = 0;
    var withAddress = 0;

    for (var i = 0; i < stores.length; i += 1) {
      if (stores[i].phone && stores[i].phone !== DASH) {
        withPhone += 1;
      }
      if (stores[i].address && stores[i].address !== "не вказано") {
        withAddress += 1;
      }
    }

    totalStoresEl.textContent = String(total);
    withPhoneEl.textContent = String(withPhone);
    withAddressEl.textContent = String(withAddress);
    badgeEl.textContent = total + " магазинів";
  }

  async function bootstrap() {
    try {
      var stores = await fetchStores();
      storesState = stores;
      renderKpis(storesState);
      renderRows(storesState);

      if (selectedStoreId || selectedPhoneDigits || selectedDomainHint) {
        var matchedStore = storesState.find(function (row) {
          return selectedStoreId && sanitizeStoreId(row && row.storeId) === selectedStoreId;
        }) || storesState.find(function (row) {
          if (selectedPhoneDigits && normalizePhoneDigits(row && row.phone) === selectedPhoneDigits) {
            return true;
          }
          if (selectedDomainHint && getDomainHost(row && row.address) === selectedDomainHint) {
            return true;
          }
          return false;
        }) || null;

        var targetStoreId = matchedStore ? sanitizeStoreId(matchedStore.storeId) : selectedStoreId;
  resolvedSelectedStoreId = targetStoreId;
  renderRows(storesState);
        var found = Boolean(matchedStore);
        if (found) {
          setActionStatus("Відкрита картка користувача для магазину: " + targetStoreId, "success");
          try {
            sessionStorage.removeItem(STORE_CARD_CONTEXT_KEY);
          } catch (ignoreError) {
          }
          try {
            var details = await fetchSelectedStoreDetails(targetStoreId);
            renderStoreProfile(details);
          } catch (profileError) {
            console.error("[owner-admin/users] failed to load selected store profile:", profileError);
            if (storeProfileCardEl) {
              storeProfileCardEl.hidden = false;
            }
            if (storeProfileStatusEl) {
              storeProfileStatusEl.textContent = "Не вдалося завантажити детальну картку магазину.";
              storeProfileStatusEl.classList.remove("success");
              storeProfileStatusEl.classList.add("error");
            }
          }
        } else {
          setActionStatus("Користувача для магазину " + selectedStoreId + " не знайдено.", "error");
          if (storeProfileCardEl) {
            storeProfileCardEl.hidden = true;
          }
        }
      } else {
        setActionStatus("", "");
        if (storeProfileCardEl) {
          storeProfileCardEl.hidden = true;
        }
      }
    } catch (error) {
      console.error("[owner-admin/users] load failed:", error);
      badgeEl.textContent = "Помилка завантаження";
      tableBodyEl.innerHTML = "<tr><td colspan=\"7\">Не вдалося завантажити дані з бази.</td></tr>";
      setActionStatus("Помилка завантаження даних.", "error");
    }
  }

  tableBodyEl.addEventListener("click", function (event) {
    var target = getEventTargetElement(event);
    if (!target || typeof target.closest !== "function") {
      return;
    }

    var toggleButton = target.closest("[data-action='toggle-actions']");
    if (toggleButton) {
      event.preventDefault();
      var menuWrap = toggleButton.closest(".users-actions-menu");
      if (!menuWrap) {
        return;
      }
      var menu = menuWrap.querySelector(".users-actions");
      if (!menu) {
        return;
      }

      var isOpen = !menu.hidden;
      closeAllActionMenus();

      if (isOpen) {
        return;
      }

      menu.hidden = false;
      menu.classList.remove("open-up");

      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var safeGap = 8;
      var anchorRect = toggleButton.getBoundingClientRect();
      var menuRect = menu.getBoundingClientRect();

      var left = anchorRect.right - menuRect.width;
      if (left < safeGap) {
        left = safeGap;
      }
      if ((left + menuRect.width) > (viewportWidth - safeGap)) {
        left = Math.max(safeGap, viewportWidth - safeGap - menuRect.width);
      }

      var top = anchorRect.bottom + 6;
      if ((top + menuRect.height) > (viewportHeight - safeGap)) {
        top = Math.max(safeGap, anchorRect.top - menuRect.height - 6);
      }

      menu.style.position = "fixed";
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      menu.style.right = "auto";
      menu.style.bottom = "auto";

      toggleButton.setAttribute("aria-expanded", "true");
      return;
    }

    var deleteButton = target.closest("[data-action='delete-store']");
    if (deleteButton) {
      var deleteStoreId = cleanText(deleteButton.getAttribute("data-store-id"));
      closeAllActionMenus();
      handleDeleteClick(deleteStoreId);
      return;
    }

    var blockButton = target.closest("[data-action='block-store']");
    if (blockButton) {
      var blockStoreId = cleanText(blockButton.getAttribute("data-store-id"));
      closeAllActionMenus();
      handleAccessToggleClick(blockStoreId, true);
      return;
    }

    var unblockButton = target.closest("[data-action='unblock-store']");
    if (unblockButton) {
      var unblockStoreId = cleanText(unblockButton.getAttribute("data-store-id"));
      closeAllActionMenus();
      handleAccessToggleClick(unblockStoreId, false);
    }
  });

  document.addEventListener("pointerdown", function (event) {
    var target = getEventTargetElement(event);
    if (!target || typeof target.closest !== "function") {
      closeAllActionMenus();
      return;
    }
    if (target.closest(".users-actions-menu")) {
      return;
    }

    closeAllActionMenus();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeAllActionMenus();
    }
  });

  window.addEventListener("resize", closeAllActionMenus);
  window.addEventListener("scroll", closeAllActionMenus, true);

  bootstrap();
})();
