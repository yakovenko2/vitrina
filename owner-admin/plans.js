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
  var BILLING_KEY = "lavkaBilling";
  var BILLING_INVOICES_COLLECTION = "billing_invoices";
  var DASH = "-";

  var PLAN_CONFIG = {
    starter: { id: "starter", name: "Старт", amount: 109, periodMonths: 1 },
    business: { id: "business", name: "Бізнес", amount: 209, periodMonths: 1 },
    pro: { id: "pro", name: "Про", amount: 449, periodMonths: 1 }
  };

  var activeBadgeEl = document.getElementById("plansActiveBadge");
  var kpiActiveEl = document.getElementById("kpiActiveSubscriptions");
  var kpiTrialEl = document.getElementById("kpiTrialStores");
  var kpiOverdueEl = document.getElementById("kpiOverduePayments");
  var plansTableBodyEl = document.getElementById("plansTableBody");

  var searchInputEl = document.getElementById("planSearchInput");
  var searchClearEl = document.getElementById("planSearchClear");
  var searchStatusEl = document.getElementById("planSearchStatus");
  var searchResultsBodyEl = document.getElementById("planSearchResultsBody");

  var modalEl = document.getElementById("planDetailsModal");
  var modalCloseEl = document.getElementById("planDetailsClose");
  var detailNameEl = document.getElementById("detailStoreName");
  var detailPhoneEl = document.getElementById("detailStorePhone");
  var detailAddressEl = document.getElementById("detailStoreAddress");
  var detailRegisteredAtEl = document.getElementById("detailStoreRegisteredAt");
  var detailCurrentPlanEl = document.getElementById("detailCurrentPlan");
  var detailValidUntilEl = document.getElementById("detailPlanValidUntil");
  var detailTrialNoticeEl = document.getElementById("detailTrialNotice");
  var detailPaymentsBodyEl = document.getElementById("detailPaymentsBody");
  var detailPlanSelectEl = document.getElementById("detailPlanSelect");
  var detailApplyPlanEl = document.getElementById("detailApplyPlan");
  var detailCancelPlanEl = document.getElementById("detailCancelPlan");
  var detailGrantDaysEl = document.getElementById("detailGrantDays");
  var detailGrantAccessEl = document.getElementById("detailGrantAccess");
  var modalStatusEl = document.getElementById("planModalStatus");

  var storesState = [];
  var activeStoreId = "";
  var isApplyingPlan = false;

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

  function normalizePhoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseDate(raw) {
    if (!raw) {
      return null;
    }

    if (typeof raw.toDate === "function") {
      var converted = raw.toDate();
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted;
      }
      return null;
    }

    var date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(raw) {
    var date = parseDate(raw);
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

  function formatDate(raw) {
    var date = parseDate(raw);
    if (!date) {
      return DASH;
    }

    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function formatMoney(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount)) {
      amount = 0;
    }

    return new Intl.NumberFormat("uk-UA").format(Math.round(amount));
  }

  function getPlanName(planId) {
    var key = normalizePlanId(cleanText(planId).toLowerCase());
    if (!key) {
      return "Trial";
    }
    return PLAN_CONFIG[key] ? PLAN_CONFIG[key].name : key;
  }

  function normalizePlanId(planId) {
    var key = cleanText(planId).toLowerCase();
    if (key === "start") {
      return "starter";
    }
    return key;
  }

  function pickAddress(registrationValue, registryData) {
    var candidates = [
      registrationValue && registrationValue.address,
      registrationValue && registrationValue.storeAddress,
      registrationValue && registrationValue.domain,
      registryData && registryData.address,
      registryData && registryData.storeAddress,
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

  function setSearchStatus(message, kind) {
    if (!searchStatusEl) {
      return;
    }

    searchStatusEl.textContent = message || "";
    searchStatusEl.classList.remove("error", "success");
    if (kind) {
      searchStatusEl.classList.add(kind);
    }
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

  function dedupeByStoreIdentity(stores) {
    var list = Array.isArray(stores) ? stores.slice() : [];
    var usedKeys = {};
    var result = [];

    function getScore(row) {
      var score = 0;
      var id = cleanText(row && row.storeId).toLowerCase();
      if (id && id !== "default-store") {
        score += 50;
      }
      if (cleanText(row && row.address).toLowerCase().indexOf("http") === 0) {
        score += 20;
      }
      if (normalizePhoneDigits(row && row.phone)) {
        score += 10;
      }
      var time = parseDate(row && row.registeredAt);
      score += (time ? time.getTime() : 0) / 1e13;
      return score;
    }

    list.sort(function (a, b) {
      return getScore(b) - getScore(a);
    });

    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      var keys = [];
      var idKey = cleanText(row && row.storeId).toLowerCase();
      var phoneDigits = normalizePhoneDigits(row && row.phone);
      var nameKey = cleanText(row && row.storeName).toLowerCase();
      var addressKey = cleanText(row && row.address).toLowerCase();

      if (idKey) {
        keys.push("id:" + idKey);
      }
      if (addressKey && addressKey !== "не вказано") {
        keys.push("address:" + addressKey);
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

    return result;
  }

  async function fetchStores() {
    var db = initDb();
    var registrySnap = await db.collection("stores_registry").get();
    var rows = [];

    for (var i = 0; i < registrySnap.docs.length; i += 1) {
      var registryDoc = registrySnap.docs[i];
      var storeId = registryDoc.id;
      var registryData = registryDoc.data() || {};

      var registrationRef = db.collection("stores").doc(storeId).collection("data").doc(REGISTRATION_KEY);
      var billingRef = db.collection("stores").doc(storeId).collection("data").doc(BILLING_KEY);

      var snaps = await Promise.all([registrationRef.get(), billingRef.get()]);
      var registrationData = snaps[0].exists ? snaps[0].data() || {} : {};
      var billingData = snaps[1].exists ? snaps[1].data() || {} : {};

      var registrationValue = registrationData.value || {};
      var billingValue = billingData.value || {};
      var phone = cleanText(registrationValue.phone) || cleanText(registryData.phone) || DASH;
      var storeName = cleanText(registrationValue.storeName) || cleanText(registryData.storeName) || DASH;
      var address = pickAddress(registrationValue, registryData);
      var registeredAt = registrationValue.registeredAt || registrationData.updatedAt || registryData.createdAt || registryData.updatedAt || null;

      rows.push({
        storeId: storeId,
        phone: phone,
        phoneDigits: normalizePhoneDigits(phone),
        storeName: storeName,
        address: address,
        addressLower: cleanText(address).toLowerCase(),
        registeredAt: registeredAt,
        billing: {
          currentPlanId: cleanText(billingValue.currentPlanId).toLowerCase(),
          validUntil: billingValue.validUntil || "",
          payments: Array.isArray(billingValue.payments) ? billingValue.payments : [],
          trial: Boolean(billingValue.trial)
        }
      });
    }

    var deduped = dedupeByStoreIdentity(rows);
    deduped.sort(function (a, b) {
      var left = parseDate(a.registeredAt);
      var right = parseDate(b.registeredAt);
      var leftValue = left ? left.getTime() : 0;
      var rightValue = right ? right.getTime() : 0;
      return rightValue - leftValue;
    });

    return deduped;
  }

  function buildFilteredStores(query) {
    var q = cleanText(query).toLowerCase();
    if (!q) {
      return storesState.slice();
    }

    var qDigits = normalizePhoneDigits(q);

    return storesState.filter(function (store) {
      var phoneMatches = qDigits && store.phoneDigits.indexOf(qDigits) !== -1;
      var addressMatches = store.addressLower.indexOf(q) !== -1;
      return phoneMatches || addressMatches;
    });
  }

  function renderSearchResults(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      searchResultsBodyEl.innerHTML = '<tr><td colspan="5">Нічого не знайдено за вашим запитом.</td></tr>';
      return;
    }

    var html = rows.map(function (store) {
      var planName = getPlanName(store.billing.currentPlanId);
      return "<tr>"
        + "<td>" + escapeHtml(store.storeName || DASH) + "</td>"
        + "<td>" + escapeHtml(store.phone || DASH) + "</td>"
        + "<td>" + escapeHtml(store.address || DASH) + "</td>"
        + "<td><span class=\"pill blue\">" + escapeHtml(planName) + "</span></td>"
        + "<td><button class=\"plan-details-btn\" type=\"button\" data-action=\"details\" data-store-id=\"" + escapeHtml(store.storeId) + "\">Деталі</button></td>"
        + "</tr>";
    }).join("");

    searchResultsBodyEl.innerHTML = html;
  }

  function renderPlanTable(stores) {
    if (!plansTableBodyEl) {
      return;
    }

    var starterCount = 0;
    var businessCount = 0;
    var proCount = 0;

    for (var i = 0; i < stores.length; i += 1) {
      var planId = normalizePlanId(cleanText(stores[i].billing.currentPlanId).toLowerCase());
      if (planId === "starter") starterCount += 1;
      if (planId === "business") businessCount += 1;
      if (planId === "pro") proCount += 1;
    }

    plansTableBodyEl.innerHTML = ""
      + "<tr><td>Старт</td><td>₴109</td><td>" + starterCount + "</td><td><span class=\"pill green\">Активний</span></td></tr>"
      + "<tr><td>Бізнес</td><td>₴209</td><td>" + businessCount + "</td><td><span class=\"pill green\">Активний</span></td></tr>"
      + "<tr><td>Про</td><td>₴449</td><td>" + proCount + "</td><td><span class=\"pill blue\">Рекомендований</span></td></tr>";
  }

  function renderKpis(stores) {
    var activeCount = 0;
    var trialCount = 0;
    var overdueCount = 0;
    var planSet = {};
    var now = Date.now();

    for (var i = 0; i < stores.length; i += 1) {
      var billing = stores[i].billing || {};
      var planId = normalizePlanId(cleanText(billing.currentPlanId).toLowerCase());
      var validUntilDate = parseDate(billing.validUntil);

      if (planId) {
        activeCount += 1;
        planSet[planId] = true;
      } else {
        trialCount += 1;
      }

      if (planId && validUntilDate && validUntilDate.getTime() < now) {
        overdueCount += 1;
      }
    }

    if (kpiActiveEl) {
      kpiActiveEl.textContent = String(activeCount);
    }
    if (kpiTrialEl) {
      kpiTrialEl.textContent = String(trialCount);
    }
    if (kpiOverdueEl) {
      kpiOverdueEl.textContent = String(overdueCount);
    }

    var activePlans = Object.keys(planSet).length;
    if (activeBadgeEl) {
      activeBadgeEl.textContent = activePlans + " тарифи активні";
    }
  }

  function getStoreById(storeId) {
    var id = cleanText(storeId);
    return storesState.find(function (store) {
      return store.storeId === id;
    }) || null;
  }

  function openModal(store) {
    if (!store) {
      return;
    }

    activeStoreId = store.storeId;
    setModalStatus("", "");

    detailNameEl.textContent = store.storeName || DASH;
    detailPhoneEl.textContent = store.phone || DASH;
    detailAddressEl.textContent = store.address || DASH;
    detailRegisteredAtEl.textContent = formatDateTime(store.registeredAt);
    detailCurrentPlanEl.textContent = getPlanName(store.billing.currentPlanId);
    detailValidUntilEl.textContent = formatDate(store.billing.validUntil);

    if (detailTrialNoticeEl) {
      var isOnTrial = Boolean(store.billing.trial) && !(store.billing.payments || []).length;
      detailTrialNoticeEl.hidden = !isOnTrial;
      if (isOnTrial) {
        detailTrialNoticeEl.textContent = "Це тестовий період тарифу «" + getPlanName(store.billing.currentPlanId) + "», наданий автоматично при реєстрації. Оплата ще не проводилась.";
      }
    }

    if (detailPlanSelectEl) {
      var selected = normalizePlanId(cleanText(store.billing.currentPlanId).toLowerCase());
      detailPlanSelectEl.value = PLAN_CONFIG[selected] ? selected : "starter";
    }

    if (detailCancelPlanEl) {
      detailCancelPlanEl.disabled = !cleanText(store.billing.currentPlanId);
    }

    renderPaymentHistory(dedupePayments(store.billing.payments || []));
    void hydratePaymentHistoryFromInvoices(store);

    modalEl.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function normalizeInvoiceToPayment(invoice) {
    var raw = invoice && typeof invoice === "object" ? invoice : {};
    var amountKop = Number(raw.amountKop);
    var paidAt = raw.activatedDoneAt || raw.updatedAt || raw.createdAt || raw.modifiedDate || null;
    var status = cleanText(raw.status).toLowerCase() || cleanText(raw.monoStatus).toLowerCase();
    var normalizedPlanId = normalizePlanId(raw.tariffId);
    var invoiceId = cleanText(raw.invoiceId);
    var normalizedId = invoiceId
      ? (invoiceId.indexOf("mono-") === 0 ? invoiceId : ("mono-" + invoiceId))
      : "";

    return {
      id: normalizedId,
      reference: invoiceId,
      planId: normalizedPlanId,
      planName: cleanText(raw.tariffName) || getPlanName(normalizedPlanId),
      amount: Number.isFinite(amountKop) ? Math.round(amountKop / 100) : 0,
      periodMonths: Number(raw.periodMonths) || 1,
      paidAt: paidAt,
      status: status === "success" ? "paid" : status,
      actorRole: "user",
      source: "monobank-acquiring"
    };
  }

  function normalizePaymentReference(payment) {
    var ref = cleanText(payment && (payment.reference || payment.invoiceId || payment.id)).toLowerCase();
    return ref.indexOf("mono-") === 0 ? ref.slice(5) : ref;
  }

  function getPaymentStatusRank(statusKey) {
    var status = cleanText(statusKey).toLowerCase();
    if (status === "paid" || status === "success" || status === "granted") {
      return 3;
    }
    if (status === "pending" || status === "processing") {
      return 2;
    }
    if (status === "unpaid" || status === "cancelled" || status === "canceled" || status === "failed") {
      return 1;
    }
    return 0;
  }

  function scorePaymentRecord(payment) {
    var item = payment || {};
    var score = 0;
    var paidAt = parseDate(item.paidAt);

    score += getPaymentStatusRank(item.status) * 1000;
    if (normalizePaymentReference(item)) {
      score += 100;
    }
    if (cleanText(item.id)) {
      score += 50;
    }
    if (Number.isFinite(Number(item.amount)) && Number(item.amount) > 0) {
      score += 25;
    }
    if (paidAt) {
      score += Math.floor(paidAt.getTime() / 1000000);
    }

    return score;
  }

  function dedupePayments(payments) {
    var list = Array.isArray(payments) ? payments : [];
    var indexByKey = {};
    var result = [];

    for (var i = 0; i < list.length; i += 1) {
      var item = list[i] || {};
      var refPart = normalizePaymentReference(item);
      var stamp = cleanText(item.paidAt);
      var plan = cleanText(item.planId || item.planName).toLowerCase();
      var amount = String(Number(item.amount) || 0);
      var actor = cleanText(item.actorRole || item.source).toLowerCase();
      var key = refPart || [stamp, plan, amount, actor].join("|");

      if (!key) {
        continue;
      }

      var existingIndex = indexByKey[key];
      if (typeof existingIndex !== "number") {
        indexByKey[key] = result.length;
        result.push(item);
        continue;
      }

      var existing = result[existingIndex] || {};
      var existingScore = scorePaymentRecord(existing);
      var incomingScore = scorePaymentRecord(item);

      if (incomingScore > existingScore) {
        result[existingIndex] = item;
      }
    }

    return result;
  }

  async function fetchInvoicePaymentsForStore(storeId) {
    var id = cleanText(storeId);
    if (!id) {
      return [];
    }

    try {
      var db = initDb();
      var snap = await db
        .collection(BILLING_INVOICES_COLLECTION)
        .where("storeId", "==", id)
        .limit(120)
        .get();

      if (snap.empty) {
        return [];
      }

      return snap.docs
        .map(function (doc) {
          return normalizeInvoiceToPayment(doc.data() || {});
        })
        .filter(function (payment) {
          return cleanText(payment && payment.status).toLowerCase() === "paid";
        });
    } catch (error) {
      console.warn("[owner-admin/plans] failed to load billing_invoices:", error);
      return [];
    }
  }

  async function hydratePaymentHistoryFromInvoices(store) {
    var safeStore = store || {};
    var storeId = cleanText(safeStore.storeId);
    if (!storeId || !activeStoreId || activeStoreId !== storeId) {
      return;
    }

    var invoicePayments = await fetchInvoicePaymentsForStore(storeId);
    if (!activeStoreId || activeStoreId !== storeId) {
      return;
    }

    if (!invoicePayments.length) {
      return;
    }

    var billingPayments = Array.isArray(safeStore.billing && safeStore.billing.payments)
      ? safeStore.billing.payments
      : [];
    var merged = dedupePayments(billingPayments.concat(invoicePayments));
    renderPaymentHistory(merged);
  }

  function closeModal() {
    activeStoreId = "";
    modalEl.hidden = true;
    document.body.style.overflow = "";
    setModalStatus("", "");
  }

  function renderPaymentHistory(payments) {
    var list = dedupePayments(Array.isArray(payments) ? payments : []);
    if (!list.length) {
      detailPaymentsBodyEl.innerHTML = '<tr><td colspan="6">Оплат ще немає.</td></tr>';
      return;
    }

    list.sort(function (a, b) {
      var left = parseDate(a && a.paidAt);
      var right = parseDate(b && b.paidAt);
      var leftTime = left ? left.getTime() : 0;
      var rightTime = right ? right.getTime() : 0;
      return rightTime - leftTime;
    });

    function resolveActorLabel(payment) {
      var role = cleanText(payment && payment.actorRole).toLowerCase();
      if (role === "admin") {
        return "Адмін";
      }
      if (role === "user") {
        return "Користувач";
      }

      var source = cleanText(payment && payment.source).toLowerCase();
      if (source.indexOf("owner-admin") !== -1) {
        return "Адмін";
      }
      if (source.indexOf("store-admin") !== -1 || source.indexOf("self-service") !== -1) {
        return "Користувач";
      }

      return "Користувач";
    }

    detailPaymentsBodyEl.innerHTML = list.map(function (payment) {
      var planName = cleanText(payment && payment.planName) || getPlanName(payment && payment.planId);
      var months = Number(payment && payment.periodMonths);
      var days = Number(payment && payment.periodDays);
      var amount = Number(payment && payment.amount);
      var statusKey = cleanText(payment && payment.status).toLowerCase();
      var isUnpaid = statusKey === "unpaid" || statusKey === "cancelled" || statusKey === "canceled";
      var isGrant = statusKey === "granted";
      var statusLabel = isUnpaid ? "Не оплачено" : (isGrant ? "Доступ" : "Оплачено");
      var statusClass = isUnpaid ? "red" : "green";
      var periodText = Number.isFinite(days) && days > 0
        ? String(days) + " дн."
        : (Number.isFinite(months) && months > 0 ? String(months) + " міс." : DASH);
      var actorLabel = resolveActorLabel(payment);

      return "<tr>"
        + "<td>" + escapeHtml(formatDateTime(payment && payment.paidAt)) + "</td>"
        + "<td>" + escapeHtml(planName || DASH) + "</td>"
        + "<td>" + escapeHtml(periodText) + "</td>"
        + "<td>₴" + escapeHtml(formatMoney(Number.isFinite(amount) ? amount : 0)) + "</td>"
        + "<td><span class=\"pill " + statusClass + "\">" + statusLabel + "</span></td>"
        + "<td>" + escapeHtml(actorLabel) + "</td>"
        + "</tr>";
    }).join("");
  }

  function renderAfterBillingMutation() {
    renderKpis(storesState);
    renderPlanTable(storesState);
    renderSearchResults(buildFilteredStores(searchInputEl.value));
  }

  async function applyPlanChange() {
    if (isApplyingPlan) {
      return;
    }

    var store = getStoreById(activeStoreId);
    if (!store) {
      setModalStatus("Не вдалося знайти магазин для зміни тарифу.", "error");
      return;
    }

    var planId = normalizePlanId(cleanText(detailPlanSelectEl && detailPlanSelectEl.value).toLowerCase());
    var plan = PLAN_CONFIG[planId];
    if (!plan) {
      setModalStatus("Оберіть коректний тариф.", "error");
      return;
    }

    var now = new Date();
    var currentValidUntil = parseDate(store.billing && store.billing.validUntil);
    var baseDate = currentValidUntil && currentValidUntil.getTime() > now.getTime()
      ? new Date(currentValidUntil)
      : new Date(now);
    baseDate.setMonth(baseDate.getMonth() + plan.periodMonths);

    var payment = {
      id: "manual-" + Date.now(),
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      periodMonths: plan.periodMonths,
      paidAt: now.toISOString(),
      actorRole: "admin",
      source: "owner-admin-manual"
    };

    var currentPayments = Array.isArray(store.billing && store.billing.payments) ? store.billing.payments : [];
    var nextBilling = {
      currentPlanId: plan.id,
      validUntil: baseDate.toISOString(),
      payments: [payment].concat(currentPayments).slice(0, 50)
    };

    isApplyingPlan = true;
    detailApplyPlanEl.disabled = true;
    setModalStatus("Застосовуємо тариф...", "");

    try {
      var db = initDb();
      await db.collection("stores")
        .doc(store.storeId)
        .collection("data")
        .doc(BILLING_KEY)
        .set({
          key: BILLING_KEY,
          value: nextBilling,
          updatedAt: new Date().toISOString()
        }, { merge: true });

      store.billing = nextBilling;
      detailCurrentPlanEl.textContent = plan.name;
      detailValidUntilEl.textContent = formatDate(nextBilling.validUntil);
      renderPaymentHistory(nextBilling.payments);
        renderAfterBillingMutation();
      setModalStatus("Тариф успішно оновлено.", "success");
    } catch (error) {
      console.error("[owner-admin/plans] failed to apply plan:", error);
      var code = String((error && error.code) || "");
      if (/permission-denied/i.test(code)) {
        setModalStatus("Немає прав для зміни тарифу. Перевірте правила Firestore.", "error");
      } else {
        setModalStatus("Не вдалося змінити тариф. Спробуйте ще раз.", "error");
      }
    } finally {
      isApplyingPlan = false;
      detailApplyPlanEl.disabled = false;
    }
  }

  async function cancelPlan() {
    if (isApplyingPlan) {
      return;
    }

    var store = getStoreById(activeStoreId);
    if (!store) {
      setModalStatus("Не вдалося знайти магазин для відміни тарифу.", "error");
      return;
    }

    var prevPlanId = normalizePlanId(cleanText(store.billing && store.billing.currentPlanId).toLowerCase());
    var prevPlan = PLAN_CONFIG[prevPlanId] || null;
    var currentPayments = Array.isArray(store.billing && store.billing.payments) ? store.billing.payments : [];
    var nowIso = new Date().toISOString();

    var cancelRecord = {
      id: "cancel-" + Date.now(),
      planId: prevPlanId || "trial",
      planName: prevPlan ? prevPlan.name : "Trial",
      amount: prevPlan ? prevPlan.amount : 0,
      periodMonths: prevPlan ? prevPlan.periodMonths : 0,
      paidAt: nowIso,
      status: "unpaid",
      actorRole: "admin",
      source: "owner-admin-cancel"
    };

    var nextBilling = {
      currentPlanId: "",
      validUntil: "",
      payments: [cancelRecord].concat(currentPayments).slice(0, 50)
    };

    isApplyingPlan = true;
    detailApplyPlanEl.disabled = true;
    if (detailCancelPlanEl) {
      detailCancelPlanEl.disabled = true;
    }
    setModalStatus("Відміняємо тариф...", "");

    try {
      var db = initDb();
      await db.collection("stores")
        .doc(store.storeId)
        .collection("data")
        .doc(BILLING_KEY)
        .set({
          key: BILLING_KEY,
          value: nextBilling,
          updatedAt: nowIso
        }, { merge: true });

      store.billing = nextBilling;
      detailCurrentPlanEl.textContent = "Trial";
      detailValidUntilEl.textContent = DASH;
      renderPaymentHistory(nextBilling.payments);
      renderAfterBillingMutation();
      setModalStatus("Тариф відмінено. Стан: не оплачено.", "success");
    } catch (error) {
      console.error("[owner-admin/plans] failed to cancel plan:", error);
      var code = String((error && error.code) || "");
      if (/permission-denied/i.test(code)) {
        setModalStatus("Немає прав для відміни тарифу. Перевірте правила Firestore.", "error");
      } else {
        setModalStatus("Не вдалося відмінити тариф. Спробуйте ще раз.", "error");
      }
    } finally {
      isApplyingPlan = false;
      detailApplyPlanEl.disabled = false;
      if (detailCancelPlanEl) {
        detailCancelPlanEl.disabled = false;
      }
    }
  }

  async function grantAccessDays() {
    if (isApplyingPlan) {
      return;
    }

    var store = getStoreById(activeStoreId);
    if (!store) {
      setModalStatus("Не вдалося знайти магазин для надання доступу.", "error");
      return;
    }

    var days = Math.floor(Number(detailGrantDaysEl && detailGrantDaysEl.value));
    if (!Number.isFinite(days) || days < 1) {
      setModalStatus("Вкажіть кількість днів (більше 0).", "error");
      return;
    }
    if (days > 3650) {
      days = 3650;
    }

    var now = new Date();
    var currentValidUntil = parseDate(store.billing && store.billing.validUntil);
    var baseDate = currentValidUntil && currentValidUntil.getTime() > now.getTime()
      ? new Date(currentValidUntil)
      : new Date(now);
    baseDate.setDate(baseDate.getDate() + days);

    var prevPlanId = normalizePlanId(cleanText(store.billing && store.billing.currentPlanId).toLowerCase());
    var nextPlanId = PLAN_CONFIG[prevPlanId] ? prevPlanId : "starter";

    var grantRecord = {
      id: "grant-" + Date.now(),
      planId: nextPlanId,
      planName: getPlanName(nextPlanId),
      amount: 0,
      periodMonths: 0,
      periodDays: days,
      paidAt: now.toISOString(),
      status: "granted",
      actorRole: "admin",
      source: "owner-admin-grant"
    };

    var currentPayments = Array.isArray(store.billing && store.billing.payments) ? store.billing.payments : [];
    var nextBilling = {
      currentPlanId: nextPlanId,
      validUntil: baseDate.toISOString(),
      payments: [grantRecord].concat(currentPayments).slice(0, 50)
    };

    isApplyingPlan = true;
    if (detailGrantAccessEl) {
      detailGrantAccessEl.disabled = true;
    }
    detailApplyPlanEl.disabled = true;
    setModalStatus("Надаємо доступ...", "");

    try {
      var db = initDb();
      await db.collection("stores")
        .doc(store.storeId)
        .collection("data")
        .doc(BILLING_KEY)
        .set({
          key: BILLING_KEY,
          value: nextBilling,
          updatedAt: new Date().toISOString()
        }, { merge: true });

      store.billing = nextBilling;
      detailCurrentPlanEl.textContent = getPlanName(nextPlanId);
      detailValidUntilEl.textContent = formatDate(nextBilling.validUntil);
      if (detailGrantDaysEl) {
        detailGrantDaysEl.value = "";
      }
      if (detailCancelPlanEl) {
        detailCancelPlanEl.disabled = false;
      }
      renderPaymentHistory(nextBilling.payments);
      renderAfterBillingMutation();
      setModalStatus("Доступ надано на " + days + " дн. до " + formatDate(nextBilling.validUntil) + ".", "success");
    } catch (error) {
      console.error("[owner-admin/plans] failed to grant access:", error);
      var code = String((error && error.code) || "");
      if (/permission-denied/i.test(code)) {
        setModalStatus("Немає прав для надання доступу. Перевірте правила Firestore.", "error");
      } else {
        setModalStatus("Не вдалося надати доступ. Спробуйте ще раз.", "error");
      }
    } finally {
      isApplyingPlan = false;
      if (detailGrantAccessEl) {
        detailGrantAccessEl.disabled = false;
      }
      detailApplyPlanEl.disabled = false;
    }
  }

  function bindEvents() {
    if (searchInputEl) {
      searchInputEl.addEventListener("input", function () {
        var query = cleanText(searchInputEl.value);
        var rows = buildFilteredStores(query);
        renderSearchResults(rows);

        if (!query) {
          setSearchStatus("Введіть номер телефону або адресу магазину.", "");
        } else {
          setSearchStatus("Знайдено: " + rows.length, rows.length ? "success" : "error");
        }
      });
    }

    if (searchClearEl) {
      searchClearEl.addEventListener("click", function () {
        searchInputEl.value = "";
        renderSearchResults(storesState);
        setSearchStatus("Введіть номер телефону або адресу магазину.", "");
      });
    }

    searchResultsBodyEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== "function") {
        return;
      }

      var detailsBtn = target.closest("[data-action='details']");
      if (!detailsBtn) {
        return;
      }

      var storeId = cleanText(detailsBtn.getAttribute("data-store-id"));
      var store = getStoreById(storeId);
      openModal(store);
    });

    if (modalCloseEl) {
      modalCloseEl.addEventListener("click", closeModal);
    }

    if (modalEl) {
      modalEl.addEventListener("click", function (event) {
        if (event.target === modalEl) {
          closeModal();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modalEl && !modalEl.hidden) {
        closeModal();
      }
    });

    if (detailApplyPlanEl) {
      detailApplyPlanEl.addEventListener("click", applyPlanChange);
    }

    if (detailCancelPlanEl) {
      detailCancelPlanEl.addEventListener("click", cancelPlan);
    }

    if (detailGrantAccessEl) {
      detailGrantAccessEl.addEventListener("click", grantAccessDays);
    }

    if (detailGrantDaysEl) {
      detailGrantDaysEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          grantAccessDays();
        }
      });
    }
  }

  async function bootstrap() {
    try {
      storesState = await fetchStores();
      renderKpis(storesState);
      renderPlanTable(storesState);
      renderSearchResults(storesState);
      setSearchStatus("Введіть номер телефону або адресу магазину.", "");
    } catch (error) {
      console.error("[owner-admin/plans] load failed:", error);
      if (activeBadgeEl) {
        activeBadgeEl.textContent = "Помилка завантаження";
      }
      if (plansTableBodyEl) {
        plansTableBodyEl.innerHTML = '<tr><td colspan="4">Не вдалося завантажити тарифи.</td></tr>';
      }
      searchResultsBodyEl.innerHTML = '<tr><td colspan="5">Не вдалося завантажити магазини.</td></tr>';
      setSearchStatus("Помилка завантаження даних з бази.", "error");
    }
  }

  bindEvents();
  bootstrap();
})();
