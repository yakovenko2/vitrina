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
  var AUTH_KEY = "lavkaAuth";
  var BILLING_KEY = "lavkaBilling";
  var CLIENTS_KEY = "clients_registry";
  var DASH = "-";

  var PLAN_CONFIG = {
    starter: { id: "starter", name: "Старт" },
    business: { id: "business", name: "Бізнес" },
    pro: { id: "pro", name: "Про" }
  };

  var badgeEl = document.getElementById("clientsTotalBadge");
  var kpiTotalEl = document.getElementById("kpiClientsTotal");
  var kpiActiveEl = document.getElementById("kpiClientsActive");
  var kpiDeletedEl = document.getElementById("kpiClientsDeleted");
  var tableBodyEl = document.getElementById("clientsTableBody");
  var searchInputEl = document.getElementById("clientSearchInput");
  var searchClearEl = document.getElementById("clientSearchClear");
  var searchStatusEl = document.getElementById("clientSearchStatus");

  var editingStoreId = "";
  var savingStoreId = "";
  var rowErrorMessages = {};

  var clientsState = [];

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

  function normalizePhoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizePhoneInput(value) {
    return String(value || "").trim().replace(/[^0-9+]/g, "");
  }

  function isValidPhoneValue(value) {
    return /^\+?\d{10,14}$/.test(value);
  }

  function normalizeIp(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getPlanName(planId) {
    var id = cleanText(planId).toLowerCase();
    if (PLAN_CONFIG[id]) {
      return PLAN_CONFIG[id].name;
    }
    return "Trial";
  }

  function pickDomain(registrationValue, settingsValue, registryData, subdomainData) {
    var candidates = [
      settingsValue && settingsValue.customDomain,
      registrationValue && registrationValue.customDomain,
      registryData && registryData.customDomain,
      registrationValue && registrationValue.domain,
      settingsValue && settingsValue.domain,
      registryData && registryData.domain,
      subdomainData && subdomainData.domain
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var normalized = cleanText(candidates[i]);
      if (normalized) {
        return normalized;
      }
    }
    return "";
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

  function resolveStatus(rawStatus) {
    var status = cleanText(rawStatus).toLowerCase();
    if (status === "deleted") {
      return { key: "deleted", label: "Видалений", className: "red" };
    }
    if (status === "blocked") {
      return { key: "blocked", label: "Заблокований", className: "orange" };
    }
    return { key: "active", label: "Активний", className: "green" };
  }

  function pickClientName(registrationValue, settingsValue, registryData) {
    var candidates = [
      registrationValue && registrationValue.clientName,
      registrationValue && registrationValue.ownerName,
      registrationValue && registrationValue.fullName,
      registrationValue && registrationValue.name,
      settingsValue && settingsValue.ownerName,
      settingsValue && settingsValue.clientName,
      registryData && registryData.clientName,
      registryData && registryData.ownerName
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var normalized = cleanText(candidates[i]);
      if (normalized) {
        return normalized;
      }
    }
    return "";
  }

  async function fetchLiveClients(db) {
    var registrySnap = await db.collection("stores_registry").get();
    var clients = [];

    for (var i = 0; i < registrySnap.docs.length; i += 1) {
      var registryDoc = registrySnap.docs[i];
      var storeId = registryDoc.id;
      var registryData = registryDoc.data() || {};

      var dataCol = db.collection("stores").doc(storeId).collection("data");
      var snaps = await Promise.all([
        dataCol.doc(REGISTRATION_KEY).get(),
        dataCol.doc(STORE_SETTINGS_KEY).get(),
        dataCol.doc(AUTH_KEY).get(),
        dataCol.doc(BILLING_KEY).get(),
        db.collection("store_subdomains").doc(storeId).get()
      ]);

      var registrationValue = (snaps[0].exists ? snaps[0].data() || {} : {}).value || {};
      var settingsValue = (snaps[1].exists ? snaps[1].data() || {} : {}).value || {};
      var authValue = (snaps[2].exists ? snaps[2].data() || {} : {}).value || {};
      var billingValue = (snaps[3].exists ? snaps[3].data() || {} : {}).value || {};
      var subdomainData = snaps[4].exists ? snaps[4].data() || {} : {};

      var planId = cleanText(billingValue.currentPlanId).toLowerCase();
      var statusRaw = cleanText(subdomainData.status || registryData.status || "active") || "active";

      clients.push({
        storeId: storeId,
        clientName: pickClientName(registrationValue, settingsValue, registryData) || DASH,
        registeredAt: registrationValue.registeredAt || registryData.createdAt || registryData.updatedAt || null,
        phone: cleanText(registrationValue.phone) || cleanText(registryData.phone) || DASH,
        storeName: cleanText(registrationValue.storeName) || cleanText(settingsValue.storeName) || cleanText(registryData.storeName) || DASH,
        category: cleanText(registrationValue.category) || cleanText(settingsValue.category) || cleanText(registryData.category) || DASH,
        domain: pickDomain(registrationValue, settingsValue, registryData, subdomainData) || DASH,
        planId: planId,
        planName: getPlanName(planId),
        status: statusRaw,
        ipAddress: cleanText(authValue.lastIpAddress || authValue.ipAddress || registryData.lastIpAddress || subdomainData.lastIpAddress || "") || DASH,
        isLive: true
      });
    }

    return clients;
  }

  async function fetchArchivedClients(db) {
    var snap = await db.collection(CLIENTS_KEY).get();
    var clients = [];
    snap.docs.forEach(function (doc) {
      var data = doc.data() || {};
      clients.push({
        storeId: doc.id,
        clientName: cleanText(data.clientName) || DASH,
        registeredAt: data.registeredAt || null,
        phone: cleanText(data.phone) || DASH,
        storeName: cleanText(data.storeName) || DASH,
        category: cleanText(data.category) || DASH,
        domain: cleanText(data.domain) || DASH,
        planId: cleanText(data.planId).toLowerCase(),
        planName: cleanText(data.planName) || getPlanName(data.planId),
        status: cleanText(data.status) || "deleted",
        ipAddress: cleanText(data.ipAddress) || DASH,
        isLive: false
      });
    });
    return clients;
  }

  function upsertSnapshot(db, client) {
    if (!client || !client.storeId) {
      return;
    }
    db.collection(CLIENTS_KEY).doc(client.storeId).set({
      storeId: client.storeId,
      clientName: client.clientName === DASH ? "" : client.clientName,
      registeredAt: client.registeredAt || "",
      phone: client.phone === DASH ? "" : client.phone,
      storeName: client.storeName === DASH ? "" : client.storeName,
      category: client.category === DASH ? "" : client.category,
      domain: client.domain === DASH ? "" : client.domain,
      planId: client.planId || "",
      planName: client.planName || "",
      status: client.status || "active",
      ipAddress: client.ipAddress === DASH ? "" : client.ipAddress,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(function (error) {
      console.warn("[owner-admin/clients] snapshot upsert failed:", error);
    });
  }

  function getDomainHost(raw) {
    var domain = cleanText(raw);
    if (!domain || domain === DASH) {
      return "";
    }
    try {
      return String(new URL(domain).hostname || "").toLowerCase();
    } catch (error) {
      return domain
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
    }
  }

  function statusRank(status) {
    var key = resolveStatus(status).key;
    if (key === "active") {
      return 3;
    }
    if (key === "blocked") {
      return 2;
    }
    return 1;
  }

  function planRank(planId) {
    var id = cleanText(planId).toLowerCase();
    if (id === "pro") {
      return 3;
    }
    if (id === "business") {
      return 2;
    }
    if (id === "starter") {
      return 1;
    }
    return 0;
  }

  function clientPriority(client) {
    var score = statusRank(client.status) * 1000;
    score += planRank(client.planId) * 60;
    if (client.ipAddress && client.ipAddress !== DASH) {
      score += 20;
    }
    if (client.domain && client.domain !== DASH) {
      score += 10;
    }
    var date = toDate(client.registeredAt);
    score += (date ? date.getTime() : 0) / 1e13;
    return score;
  }

  function dedupeClients(clients) {
    var list = clients.slice();

    list.sort(function (a, b) {
      return clientPriority(b) - clientPriority(a);
    });

    var usedKeys = {};
    var result = [];

    for (var i = 0; i < list.length; i += 1) {
      var client = list[i];
      var keys = [];

      var domainHost = getDomainHost(client.domain);
      var phoneDigits = normalizePhoneDigits(client.phone);
      var nameKey = cleanText(client.storeName).toLowerCase();

      if (domainHost) {
        keys.push("domain:" + domainHost);
      }
      if (phoneDigits && nameKey && nameKey !== DASH) {
        keys.push("phoneName:" + phoneDigits + "|" + nameKey);
      } else if (phoneDigits) {
        keys.push("phone:" + phoneDigits);
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
      result.push(client);
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

  async function fetchClients() {
    var db = initDb();
    var results = await Promise.all([fetchLiveClients(db), fetchArchivedClients(db)]);
    var liveClients = results[0];
    var archivedClients = results[1];

    var map = {};
    var liveIds = {};

    archivedClients.forEach(function (client) {
      map[client.storeId] = client;
    });

    liveClients.forEach(function (client) {
      liveIds[client.storeId] = true;
      map[client.storeId] = client;
      upsertSnapshot(db, client);
    });

    var list = Object.keys(map).map(function (key) {
      var client = map[key];
      if (!liveIds[client.storeId]) {
        client.status = "deleted";
      }
      return client;
    });

    return dedupeClients(list);
  }

  function renderKpis(clients) {
    var total = clients.length;
    var active = 0;
    var deleted = 0;
    clients.forEach(function (client) {
      var statusKey = resolveStatus(client.status).key;
      if (statusKey === "deleted") {
        deleted += 1;
      } else if (statusKey === "active") {
        active += 1;
      }
    });

    if (kpiTotalEl) {
      kpiTotalEl.textContent = String(total);
    }
    if (kpiActiveEl) {
      kpiActiveEl.textContent = String(active);
    }
    if (kpiDeletedEl) {
      kpiDeletedEl.textContent = String(deleted);
    }
    if (badgeEl) {
      badgeEl.textContent = "Клієнтів: " + total;
    }
  }

  function renderRows(clients) {
    if (!clients.length) {
      tableBodyEl.innerHTML = '<tr><td colspan="10">Клієнтів не знайдено.</td></tr>';
      return;
    }

    tableBodyEl.innerHTML = clients.map(function (client) {
      var status = resolveStatus(client.status);
      var storeId = client.storeId;
      var isEditing = editingStoreId === storeId;
      var isSaving = savingStoreId === storeId;
      var rowError = rowErrorMessages[storeId] || "";

      if (isEditing) {
        var nameValue = escapeHtml(client.clientName === DASH ? "" : client.clientName);
        var phoneValue = escapeHtml(client.phone === DASH ? "" : client.phone);
        var storeNameValue = escapeHtml(client.storeName === DASH ? "" : client.storeName);
        var categoryValue = escapeHtml(client.category === DASH ? "" : client.category);
        var disabledAttr = isSaving ? " disabled" : "";
        var statusHtml = rowError
          ? '<p class="table-action-status error client-row-status">' + escapeHtml(rowError) + '</p>'
          : '';

        return "<tr data-store-id=\"" + escapeHtml(storeId) + "\">"
          + "<td><input type=\"text\" class=\"client-edit-input\" data-field=\"clientName\" maxlength=\"60\" value=\"" + nameValue + "\"" + disabledAttr + "></td>"
          + "<td>" + escapeHtml(formatDateTime(client.registeredAt)) + "</td>"
          + "<td><input type=\"tel\" class=\"client-edit-input\" data-field=\"phone\" maxlength=\"16\" value=\"" + phoneValue + "\"" + disabledAttr + "></td>"
          + "<td><input type=\"text\" class=\"client-edit-input\" data-field=\"storeName\" maxlength=\"60\" value=\"" + storeNameValue + "\"" + disabledAttr + "></td>"
          + "<td><input type=\"text\" class=\"client-edit-input\" data-field=\"category\" maxlength=\"60\" value=\"" + categoryValue + "\"" + disabledAttr + "></td>"
          + "<td>" + escapeHtml(client.domain || DASH) + "</td>"
          + "<td>" + escapeHtml(client.planName || DASH) + "</td>"
          + "<td><span class=\"pill " + status.className + "\">" + escapeHtml(status.label) + "</span></td>"
          + "<td>" + escapeHtml(client.ipAddress || DASH) + "</td>"
          + "<td>"
          + "<button type=\"button\" class=\"secondary-btn\" data-action=\"save-client\" data-store-id=\"" + escapeHtml(storeId) + "\"" + disabledAttr + ">" + (isSaving ? "Зберігаємо..." : "Зберегти") + "</button> "
          + "<button type=\"button\" class=\"danger-btn\" data-action=\"cancel-client-edit\" data-store-id=\"" + escapeHtml(storeId) + "\"" + disabledAttr + ">Скасувати</button>"
          + statusHtml
          + "</td>"
          + "</tr>";
      }

      return "<tr data-store-id=\"" + escapeHtml(storeId) + "\">"
        + "<td>" + escapeHtml(client.clientName || DASH) + "</td>"
        + "<td>" + escapeHtml(formatDateTime(client.registeredAt)) + "</td>"
        + "<td>" + escapeHtml(client.phone || DASH) + "</td>"
        + "<td>" + escapeHtml(client.storeName || DASH) + "</td>"
        + "<td>" + escapeHtml(client.category || DASH) + "</td>"
        + "<td>" + escapeHtml(client.domain || DASH) + "</td>"
        + "<td>" + escapeHtml(client.planName || DASH) + "</td>"
        + "<td><span class=\"pill " + status.className + "\">" + escapeHtml(status.label) + "</span></td>"
        + "<td>" + escapeHtml(client.ipAddress || DASH) + "</td>"
        + "<td><button type=\"button\" class=\"secondary-btn\" data-action=\"edit-client\" data-store-id=\"" + escapeHtml(storeId) + "\">Редагувати</button></td>"
        + "</tr>";
    }).join("");
  }

  function buildFiltered(query) {
    var normalized = cleanText(query).toLowerCase();
    if (!normalized) {
      return clientsState.slice();
    }
    var digits = normalizePhoneDigits(normalized);

    return clientsState.filter(function (client) {
      var haystack = [
        client.clientName,
        client.phone,
        client.storeName,
        client.category,
        client.domain,
        client.planName,
        client.ipAddress
      ].join(" ").toLowerCase();

      if (haystack.indexOf(normalized) !== -1) {
        return true;
      }
      if (digits && normalizePhoneDigits(client.phone).indexOf(digits) !== -1) {
        return true;
      }
      return false;
    });
  }

  function setSearchStatus(message, tone) {
    if (!searchStatusEl) {
      return;
    }
    searchStatusEl.textContent = message || "";
    searchStatusEl.classList.remove("success", "error");
    if (tone === "success") {
      searchStatusEl.classList.add("success");
    } else if (tone === "error") {
      searchStatusEl.classList.add("error");
    }
  }

  function currentFilteredRows() {
    var query = cleanText(searchInputEl && searchInputEl.value);
    return query ? buildFiltered(query) : clientsState.slice();
  }

  function refreshTable() {
    renderRows(currentFilteredRows());
  }

  function findRowElement(storeId) {
    var rows = tableBodyEl.querySelectorAll("tr[data-store-id]");
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].getAttribute("data-store-id") === storeId) {
        return rows[i];
      }
    }
    return null;
  }

  async function persistClientEdits(client, values) {
    var db = initDb();
    var storeId = client.storeId;
    var nowIso = new Date().toISOString();
    var writes = [];

    writes.push(db.collection(CLIENTS_KEY).doc(storeId).set({
      storeId: storeId,
      clientName: values.clientName,
      phone: values.phone,
      storeName: values.storeName,
      category: values.category,
      updatedAt: nowIso
    }, { merge: true }));

    if (client.isLive) {
      var dataCol = db.collection("stores").doc(storeId).collection("data");

      writes.push(dataCol.doc(REGISTRATION_KEY).set({
        key: REGISTRATION_KEY,
        value: {
          clientName: values.clientName,
          phone: values.phone,
          storeName: values.storeName,
          category: values.category
        },
        updatedAt: nowIso,
        updatedAtMs: Date.now()
      }, { merge: true }));

      writes.push(dataCol.doc(STORE_SETTINGS_KEY).set({
        key: STORE_SETTINGS_KEY,
        value: {
          storeName: values.storeName,
          category: values.category
        },
        updatedAt: nowIso
      }, { merge: true }));

      // Overwriting phone here is what actually revokes the old number: login
      // looks accounts up by querying store_subdomains for an exact phone match.
      writes.push(db.collection("store_subdomains").doc(storeId).set({
        phone: values.phone,
        storeName: values.storeName,
        updatedAt: nowIso
      }, { merge: true }));

      writes.push(db.collection("stores_registry").doc(storeId).set({
        storeId: storeId,
        clientName: values.clientName,
        phone: values.phone,
        storeName: values.storeName,
        category: values.category,
        updatedAt: nowIso
      }, { merge: true }));
    }

    await Promise.all(writes);
  }

  async function saveClientEdits(storeId) {
    var client = clientsState.find(function (item) {
      return item.storeId === storeId;
    });
    var rowEl = findRowElement(storeId);
    if (!client || !rowEl) {
      return;
    }

    var nameInput = rowEl.querySelector('[data-field="clientName"]');
    var phoneInput = rowEl.querySelector('[data-field="phone"]');
    var storeNameInput = rowEl.querySelector('[data-field="storeName"]');
    var categoryInput = rowEl.querySelector('[data-field="category"]');

    var nextClientName = cleanText(nameInput && nameInput.value);
    var nextPhone = normalizePhoneInput(phoneInput && phoneInput.value);
    var nextStoreName = cleanText(storeNameInput && storeNameInput.value);
    var nextCategory = cleanText(categoryInput && categoryInput.value);

    if (!nextClientName) {
      rowErrorMessages[storeId] = "Вкажіть ім'я клієнта.";
      refreshTable();
      return;
    }
    if (!nextStoreName) {
      rowErrorMessages[storeId] = "Вкажіть назву магазину.";
      refreshTable();
      return;
    }
    if (!isValidPhoneValue(nextPhone)) {
      rowErrorMessages[storeId] = "Введіть коректний номер телефону.";
      refreshTable();
      return;
    }

    delete rowErrorMessages[storeId];
    savingStoreId = storeId;
    refreshTable();

    try {
      await persistClientEdits(client, {
        clientName: nextClientName,
        phone: nextPhone,
        storeName: nextStoreName,
        category: nextCategory
      });

      client.clientName = nextClientName;
      client.phone = nextPhone;
      client.storeName = nextStoreName;
      client.category = nextCategory || DASH;

      savingStoreId = "";
      editingStoreId = "";
      refreshTable();
      setSearchStatus("Дані клієнта збережено.", "success");
    } catch (error) {
      console.error("[owner-admin/clients] failed to save client edits:", error);
      savingStoreId = "";
      var code = String((error && error.code) || "").toLowerCase();
      rowErrorMessages[storeId] = /permission-denied/.test(code)
        ? "Немає прав на збереження. Перевірте правила Firestore."
        : "Не вдалося зберегти зміни. Спробуйте ще раз.";
      refreshTable();
    }
  }

  function applySearch() {
    var query = cleanText(searchInputEl && searchInputEl.value);
    var rows = buildFiltered(query);
    renderRows(rows);
    if (!query) {
      setSearchStatus("Введіть запит для пошуку.", "");
    } else {
      setSearchStatus("Знайдено: " + rows.length, rows.length ? "success" : "error");
    }
  }

  function bindEvents() {
    if (searchInputEl) {
      searchInputEl.addEventListener("input", applySearch);
    }
    if (searchClearEl) {
      searchClearEl.addEventListener("click", function () {
        if (searchInputEl) {
          searchInputEl.value = "";
        }
        renderRows(clientsState);
        setSearchStatus("Введіть запит для пошуку.", "");
      });
    }
    if (tableBodyEl) {
      tableBodyEl.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== "function") {
          return;
        }

        var editBtn = target.closest('[data-action="edit-client"]');
        if (editBtn) {
          editingStoreId = editBtn.getAttribute("data-store-id");
          delete rowErrorMessages[editingStoreId];
          refreshTable();
          return;
        }

        var cancelBtn = target.closest('[data-action="cancel-client-edit"]');
        if (cancelBtn) {
          var cancelStoreId = cancelBtn.getAttribute("data-store-id");
          if (editingStoreId === cancelStoreId) {
            editingStoreId = "";
          }
          delete rowErrorMessages[cancelStoreId];
          refreshTable();
          return;
        }

        var saveBtn = target.closest('[data-action="save-client"]');
        if (saveBtn) {
          saveClientEdits(saveBtn.getAttribute("data-store-id"));
        }
      });
    }
  }

  async function bootstrap() {
    try {
      clientsState = await fetchClients();
      renderKpis(clientsState);
      renderRows(clientsState);
      setSearchStatus("Введіть запит для пошуку.", "");
    } catch (error) {
      console.error("[owner-admin/clients] bootstrap failed:", error);
      if (tableBodyEl) {
        tableBodyEl.innerHTML = '<tr><td colspan="8">Не вдалося завантажити базу клієнтів.</td></tr>';
      }
      if (badgeEl) {
        badgeEl.textContent = "Помилка завантаження";
      }
    }
  }

  bindEvents();
  bootstrap();
})();
