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
  var DASH = "-";

  var badgeEl = document.getElementById("usersTotalBadge");
  var totalStoresEl = document.getElementById("kpiTotalStores");
  var withPhoneEl = document.getElementById("kpiWithPhone");
  var withAddressEl = document.getElementById("kpiWithAddress");
  var tableBodyEl = document.getElementById("usersTableBody");
  var actionStatusEl = document.getElementById("usersActionStatus");
  var storesState = [];
  var deletingMap = {};

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

  function renderRows(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      tableBodyEl.innerHTML = "<tr><td colspan=\"6\">Магазини поки не зареєстровані.</td></tr>";
      return;
    }

    var html = rows
      .map(function (row, index) {
        var number = index + 1;
        var phone = escapeHtml(row.phone || DASH);
        var storeName = escapeHtml(row.storeName || DASH);
        var address = escapeHtml(row.address || "не вказано");
        var registeredAt = escapeHtml(formatDateTime(row.registeredAt));
        var storeId = escapeHtml(row.storeId);
        var disabledAttr = isDeleting(row.storeId) ? " disabled" : "";
        var actionLabel = isDeleting(row.storeId) ? "Видаляємо..." : "Видалити назавжди";

        return "<tr>"
          + "<td>" + number + "</td>"
          + "<td>" + phone + "</td>"
          + "<td>" + storeName + "</td>"
          + "<td>" + address + "</td>"
          + "<td>" + registeredAt + "</td>"
          + "<td><button type=\"button\" class=\"danger-btn\" data-action=\"delete-store\" data-store-id=\"" + storeId + "\"" + disabledAttr + ">" + actionLabel + "</button></td>"
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

      var snaps = await Promise.all([registrationRef.get(), settingsRef.get()]);
      var registrationData = snaps[0].exists ? snaps[0].data() || {} : {};
      var settingsData = snaps[1].exists ? snaps[1].data() || {} : {};

      var registrationValue = registrationData.value || {};
      var settingsValue = settingsData.value || {};

      var phone = cleanText(registrationValue.phone) || cleanText(registryData.phone) || DASH;
      var storeName = cleanText(registrationValue.storeName) || cleanText(settingsValue.storeName) || cleanText(registryData.storeName) || DASH;
      var address = pickAddress(registrationValue, settingsValue, registryData);
      var registeredAt = registrationValue.registeredAt || registrationData.updatedAt || registryData.createdAt || registryData.updatedAt || null;

      stores.push({
        storeId: storeId,
        phone: phone,
        storeName: storeName,
        address: address,
        registeredAt: registeredAt
      });
    }

    stores.sort(function (a, b) {
      var left = toDate(a.registeredAt);
      var right = toDate(b.registeredAt);
      var leftTime = left ? left.getTime() : 0;
      var rightTime = right ? right.getTime() : 0;
      return rightTime - leftTime;
    });

    return stores;
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

  async function deleteStoreAccount(storeId) {
    var db = initDb();
    var storeRef = db.collection("stores").doc(storeId);
    var dataCollectionRef = storeRef.collection("data");

    await deleteCollectionDocs(dataCollectionRef, 200);

    var batch = db.batch();
    batch.delete(storeRef);
    batch.delete(db.collection("stores_registry").doc(storeId));
    batch.delete(db.collection("store_subdomains").doc(storeId));
    await batch.commit();
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
      setActionStatus("", "");
    } catch (error) {
      console.error("[owner-admin/users] load failed:", error);
      badgeEl.textContent = "Помилка завантаження";
      tableBodyEl.innerHTML = "<tr><td colspan=\"6\">Не вдалося завантажити дані з бази.</td></tr>";
      setActionStatus("Помилка завантаження даних.", "error");
    }
  }

  tableBodyEl.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    var button = target.closest("[data-action='delete-store']");
    if (!button) {
      return;
    }

    var storeId = cleanText(button.getAttribute("data-store-id"));
    handleDeleteClick(storeId);
  });

  bootstrap();
})();
