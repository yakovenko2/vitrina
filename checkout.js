document.addEventListener("DOMContentLoaded", () => {
  const SETTINGS_KEY = "lavkaStoreSettings";
  const CHECKOUT_SETTINGS_KEY = "lavkaCheckoutSettings";
  const CART_KEY = "lavkaCart";
  const ORDERS_KEY = "lavkaOrders";
  const PROMO_CODES_KEY = "lavkaPromoCodes";
  const NOVA_POSHTA_API_URL = "https://api.novaposhta.ua/v2.0/json/";
  const NOVA_POSHTA_API_KEY = "8e24dc6bb36a0ee95f254d203bb3cc92";

  const checkoutForm = document.getElementById("checkoutForm");
  const customerName = document.getElementById("customerName");
  const customerPhone = document.getElementById("customerPhone");
  const orderComment = document.getElementById("orderComment");
  const shippingOptions = document.getElementById("shippingOptions");
  const paymentOptions = document.getElementById("paymentOptions");
  const shippingEmpty = document.getElementById("shippingEmpty");
  const paymentEmpty = document.getElementById("paymentEmpty");
  const bankTransferInfo = document.getElementById("bankTransferInfo");
  const bankTransferText = document.getElementById("bankTransferText");
  const deliveryAddressGroup = document.getElementById("deliveryAddressGroup");
  const addressNovaPost = document.getElementById("addressNovaPost");
  const addressUkrPost = document.getElementById("addressUkrPost");
  const addressCourier = document.getElementById("addressCourier");
  const addressHint = document.getElementById("addressHint");
  const novaCity = document.getElementById("novaCity");
  const novaBranch = document.getElementById("novaBranch");
  const novaCityCombo = document.getElementById("novaCityCombo");
  const novaCityOptions = document.getElementById("novaCityOptions");
  const novaCityToggle = document.getElementById("novaCityToggle");
  const novaBranchCombo = document.getElementById("novaBranchCombo");
  const novaBranchOptions = document.getElementById("novaBranchOptions");
  const novaBranchToggle = document.getElementById("novaBranchToggle");
  const novaPostStatus = document.getElementById("novaPostStatus");
  const ukrCity = document.getElementById("ukrCity");
  const ukrRegion = document.getElementById("ukrRegion");
  const ukrDistrict = document.getElementById("ukrDistrict");
  const ukrPostalCode = document.getElementById("ukrPostalCode");
  const courierCity = document.getElementById("courierCity");
  const courierAddress = document.getElementById("courierAddress");
  const cartSummaryItems = document.getElementById("cartSummaryItems");
  const summaryItems = document.getElementById("summaryItems");
  const summarySubtotalRow = document.getElementById("summarySubtotalRow");
  const summarySubtotal = document.getElementById("summarySubtotal");
  const summaryDiscountRow = document.getElementById("summaryDiscountRow");
  const summaryDiscount = document.getElementById("summaryDiscount");
  const summaryTotal = document.getElementById("summaryTotal");
  const summaryPostpayRow = document.getElementById("summaryPostpayRow");
  const summaryPostpay = document.getElementById("summaryPostpay");
  const promoCodeInput = document.getElementById("promoCodeInput");
  const applyPromoBtn = document.getElementById("applyPromoBtn");
  const promoMessage = document.getElementById("promoMessage");
  const submitOrderBtn = document.getElementById("submitOrderBtn");
  const checkoutMessage = document.getElementById("checkoutMessage");
  const checkoutCard = document.querySelector(".checkout-card");

  const readSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsedStore = raw ? JSON.parse(raw) : {};

      const checkoutRaw = localStorage.getItem(CHECKOUT_SETTINGS_KEY);
      if (checkoutRaw) {
        const parsedCheckout = JSON.parse(checkoutRaw);
        if (parsedCheckout && typeof parsedCheckout === "object") {
          return {
            ...(parsedStore && typeof parsedStore === "object" ? parsedStore : {}),
            ...parsedCheckout
          };
        }
      }

      return parsedStore && typeof parsedStore === "object" ? parsedStore : {};
    } catch {
      return {};
    }
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

  const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || "").trim());

  const hexToRgb = (hex) => {
    const normalized = String(hex || "").replace("#", "");
    const intValue = Number.parseInt(normalized, 16);
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255
    };
  };

  const applyAccentColor = () => {
    if (!isHexColor(settings.siteColor)) return;
    const rgb = hexToRgb(settings.siteColor);
    document.documentElement.style.setProperty("--button-accent", settings.siteColor);
    document.documentElement.style.setProperty("--button-accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
    document.documentElement.style.setProperty("--button-accent-deep", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`);
    document.documentElement.style.setProperty("--button-accent-shadow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`);
  };

  const applySiteBackground = () => {
    const backgroundType = settings.siteBackgroundType === "image" ? "image" : "color";
    const backgroundColor = isHexColor(settings.siteBackgroundColor) ? settings.siteBackgroundColor : "#eef1f4";
    const backgroundImage = String(settings.siteBackgroundImage || "").trim();
    const hasCustomBackground = Boolean(String(settings.siteBackgroundColor || "").trim()) || (backgroundType === "image" && backgroundImage.length > 0);

    document.body.style.backgroundColor = "";
    document.body.style.backgroundImage = "";
    document.body.style.backgroundRepeat = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundSize = "";

    if (!checkoutCard) return;

    if (!hasCustomBackground) {
      checkoutCard.classList.remove("custom-background");
      checkoutCard.style.backgroundColor = "";
      checkoutCard.style.backgroundImage = "";
      checkoutCard.style.backgroundRepeat = "";
      checkoutCard.style.backgroundPosition = "";
      checkoutCard.style.backgroundSize = "";
      return;
    }

    checkoutCard.classList.add("custom-background");
    checkoutCard.style.backgroundColor = backgroundColor;

    if (backgroundType === "image" && backgroundImage) {
      checkoutCard.style.backgroundImage = `url("${backgroundImage}")`;
      checkoutCard.style.backgroundRepeat = "no-repeat";
      checkoutCard.style.backgroundPosition = "center";
      checkoutCard.style.backgroundSize = "cover";
      return;
    }

    checkoutCard.style.backgroundImage = "none";
    checkoutCard.style.backgroundRepeat = "repeat";
    checkoutCard.style.backgroundPosition = "center";
    checkoutCard.style.backgroundSize = "auto";
  };

  const readCart = () => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveCart = (items) => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  };

  const readOrders = () => {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const readPromoCodes = () => {
    try {
      const raw = localStorage.getItem(PROMO_CODES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveOrders = (orders) => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  };

  const formatPrice = (value) => {
    const amount = Math.round((Math.max(0, Number(value) || 0)) * 100) / 100;
    const currency = normalizeCurrencyCode(settings?.currency || "uah");
    return `${amount} ${getCurrencyLabel(currency)}`;
  };
  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  let settings = readSettings();
  let cartState = readCart();
  let appliedPromo = null;
  let novaCitySearchTimer = null;
  let novaLastCities = [];
  let novaLastBranches = [];
  let novaSelectedCityRef = "";
  let activeCityOptionIndex = -1;
  let activeBranchOptionIndex = -1;

  const buildShippingMethods = (activeSettings) => [
    {
      id: "shipping-nova-post",
      enabled: activeSettings.shippingNovaPostEnabled ?? true,
      value: "Нова Пошта (відділення або поштомат)",
      title: "Нова Пошта (відділення або поштомат)",
      subtitle: "Доставка у відділення або до поштомату",
      logo: "nova-poshta.png"
    },
    {
      id: "shipping-ukr-post",
      enabled: activeSettings.shippingUkrPostEnabled ?? true,
      value: "Укрпошта",
      title: "Укрпошта",
      subtitle: "Доставка у відділення Укрпошти",
      logo: "ukr-poshta.png"
    },
    {
      id: "shipping-nova-courier",
      enabled: Boolean(activeSettings.shippingNovaCourierEnabled),
      value: "Нова Пошта (кур'єр)",
      title: "Нова Пошта (кур'єр)",
      subtitle: "Кур'єрська доставка до дверей",
      logo: "image/courier.png"
    }
  ].filter((item) => item.enabled);

  const buildPaymentMethods = (activeSettings) => [
    {
      id: "payment-mono",
      enabled: Boolean(activeSettings.paymentMonoEnabled),
      value: "Plata by mono",
      title: "Plata by mono",
      subtitle: "Еквайринг Monobank",
      logo: "plata-by-mono.png"
    },
    {
      id: "payment-liqpay",
      enabled: Boolean(activeSettings.paymentLiqpayEnabled),
      value: "LiqPay",
      title: "LiqPay",
      subtitle: "Еквайринг ПриватБанк",
      logo: "liqpay.png"
    },
    {
      id: "payment-cod",
      enabled: activeSettings.paymentCodEnabled ?? true,
      value: "Оплата при отриманні",
      title: "Оплата при отриманні",
      subtitle: String(activeSettings.paymentCodFee || "Розрахунок при отриманні").trim() || "Розрахунок при отриманні",
      logo: ""
    },
    {
      id: "payment-prepayment",
      enabled: Boolean(activeSettings.paymentPrepaymentEnabled)
        && Math.max(0, Math.round(Number(activeSettings.paymentPrepaymentAmount) || 0)) > 0,
      value: "Передоплата",
      title: "Передоплата",
      subtitle: `До сплати зараз: ${formatPrice(Math.max(0, Math.round(Number(activeSettings.paymentPrepaymentAmount) || 0)))}`,
      logo: ""
    },
    {
      id: "payment-bank-transfer",
      enabled: Boolean(activeSettings.paymentBankTransferEnabled)
        || Boolean(String(activeSettings.paymentBankRequisites || "").trim()),
      value: "Оплата на реквізити",
      title: "Оплата на реквізити",
      subtitle: "Переказ за реквізитами магазину",
      logo: ""
    }
  ].filter((item) => item.enabled);

  const CHECKOUT_DELIVERY_IDS = [
    "shipping-nova-post",
    "shipping-ukr-post",
    "shipping-nova-courier"
  ];

  const CHECKOUT_PAYMENT_IDS = [
    "payment-mono",
    "payment-liqpay",
    "payment-cod",
    "payment-prepayment",
    "payment-bank-transfer"
  ];

  const isPrepaymentMethod = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized.includes("передоплат");
  };

  const buildDefaultPaymentDeliveryMatrix = () => CHECKOUT_DELIVERY_IDS.reduce((acc, deliveryId) => {
    acc[deliveryId] = [...CHECKOUT_PAYMENT_IDS];
    return acc;
  }, {});

  const normalizePaymentDeliveryMatrix = (rawMatrix) => {
    const defaults = buildDefaultPaymentDeliveryMatrix();
    if (!rawMatrix || typeof rawMatrix !== "object") {
      return defaults;
    }

    return CHECKOUT_DELIVERY_IDS.reduce((acc, deliveryId) => {
      const hasDeliveryKey = Object.prototype.hasOwnProperty.call(rawMatrix, deliveryId);
      const rawPayments = hasDeliveryKey && Array.isArray(rawMatrix[deliveryId])
        ? rawMatrix[deliveryId]
        : defaults[deliveryId];
      const normalized = rawPayments
        .map((paymentId) => String(paymentId || "").trim())
        .filter((paymentId, index, array) => CHECKOUT_PAYMENT_IDS.includes(paymentId) && array.indexOf(paymentId) === index);

      acc[deliveryId] = hasDeliveryKey ? normalized : [...defaults[deliveryId]];
      return acc;
    }, {});
  };

  const getSelectedDeliveryId = () => {
    const selectedDeliveryValue = String(checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
    if (!selectedDeliveryValue) return "";
    const selectedDelivery = shippingMethods.find((method) => method.value === selectedDeliveryValue);
    return String(selectedDelivery?.id || "").trim();
  };

  const filterPaymentMethodsByDelivery = (allMethods, deliveryId, matrix) => {
    if (!deliveryId) return [];
    if (!Object.prototype.hasOwnProperty.call(matrix || {}, deliveryId)) return [];
    const allowedPayments = Array.isArray(matrix?.[deliveryId]) ? matrix[deliveryId] : [];
    return allMethods.filter((method) => allowedPayments.includes(method.id));
  };

  let shippingMethods = [];
  let paymentMethods = [];

  const renderOptions = (container, options, fieldName, autoSelectFirst = true) => {
    if (!container) return;
    const requiredAttr = (fieldName === "deliveryMethod" || fieldName === "paymentMethod") ? "required" : "";
    container.innerHTML = options
      .map((option, index) => `
        <label class="option-item">
          <input type="radio" name="${fieldName}" value="${option.value}" ${autoSelectFirst && index === 0 ? "checked" : ""} ${requiredAttr}>
          ${option.logo ? `<img class="option-logo" src="${option.logo}" alt="">` : ""}
          <span class="option-meta">
            <span class="option-title">${option.title}</span>
            <span class="option-subtitle">${option.subtitle}</span>
          </span>
        </label>
      `)
      .join("");
  };

  const setNovaStatus = (message, isError = false) => {
    if (!novaPostStatus) return;
    novaPostStatus.textContent = message;
    novaPostStatus.classList.toggle("error", isError);
  };

  const closeComboList = (listNode, inputNode) => {
    if (!listNode || !inputNode) return;
    listNode.hidden = true;
    inputNode.setAttribute("aria-expanded", "false");
  };

  const openComboList = (listNode, inputNode) => {
    if (!listNode || !inputNode) return;
    listNode.hidden = false;
    inputNode.setAttribute("aria-expanded", "true");
  };

  const renderComboOptions = (listNode, values, emptyLabel) => {
    if (!listNode) return;

    if (!values.length) {
      listNode.innerHTML = `<li class="combo-empty">${escapeHtml(emptyLabel)}</li>`;
      return;
    }

    listNode.innerHTML = values
      .map((value, index) => `
        <li role="presentation">
          <button type="button" class="combo-option" role="option" data-index="${index}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>
        </li>
      `)
      .join("");
  };

  const setActiveOption = (listNode, nextIndex) => {
    if (!listNode) return;
    const options = Array.from(listNode.querySelectorAll(".combo-option"));
    options.forEach((node) => node.classList.remove("active"));
    if (nextIndex < 0 || nextIndex >= options.length) return;
    options[nextIndex].classList.add("active");
    options[nextIndex].scrollIntoView({ block: "nearest" });
  };

  const callNovaPoshtaApi = async (modelName, calledMethod, methodProperties) => {
    const response = await fetch(NOVA_POSHTA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: NOVA_POSHTA_API_KEY,
        modelName,
        calledMethod,
        methodProperties
      })
    });

    if (!response.ok) {
      throw new Error("network_error");
    }

    const payload = await response.json();
    if (!payload?.success) {
      throw new Error("api_error");
    }

    return Array.isArray(payload.data) ? payload.data : [];
  };

  const searchNovaCities = async (query) => {
    const normalized = String(query || "").trim();
    if (normalized.length < 2) {
      novaLastCities = [];
      activeCityOptionIndex = -1;
      renderComboOptions(novaCityOptions, [], "Почніть вводити місто...");
      closeComboList(novaCityOptions, novaCity);
      setNovaStatus("Введіть мінімум 2 символи для пошуку міста.");
      return;
    }

    setNovaStatus("Шукаємо міста...");
    renderComboOptions(novaCityOptions, [], "Завантаження...");
    openComboList(novaCityOptions, novaCity);
    try {
      const data = await callNovaPoshtaApi("Address", "searchSettlements", {
        CityName: normalized,
        Limit: 20,
        Page: 1
      });

      const addresses = Array.isArray(data?.[0]?.Addresses) ? data[0].Addresses : [];
      novaLastCities = addresses.map((entry) => ({
        present: String(entry.Present || "").trim(),
        ref: String(entry.DeliveryCity || entry.Ref || "").trim()
      })).filter((entry) => entry.present && entry.ref);

      activeCityOptionIndex = -1;
      renderComboOptions(novaCityOptions, novaLastCities.map((entry) => entry.present), "Нічого не знайдено");

      if (!novaLastCities.length) {
        openComboList(novaCityOptions, novaCity);
        setNovaStatus("Місто не знайдено. Спробуйте інший запит.", true);
        return;
      }

      openComboList(novaCityOptions, novaCity);
      setNovaStatus(`Знайдено міст: ${novaLastCities.length}. Оберіть місто зі списку.`);
    } catch {
      renderComboOptions(novaCityOptions, [], "Помилка завантаження");
      openComboList(novaCityOptions, novaCity);
      setNovaStatus("Не вдалося отримати міста Нова Пошта. Перевірте підключення.", true);
    }
  };

  const loadNovaBranches = async (cityRef) => {
    const normalizedRef = String(cityRef || "").trim();
    if (!normalizedRef) return;

    setNovaStatus("Завантажуємо відділення...");
    try {
      const data = await callNovaPoshtaApi("AddressGeneral", "getWarehouses", {
        CityRef: normalizedRef,
        Limit: 200,
        Language: "UA"
      });

      const branches = data
        .map((entry) => String(entry.Description || "").trim())
        .filter(Boolean);

      novaLastBranches = branches;
      activeBranchOptionIndex = -1;
      renderComboOptions(novaBranchOptions, branches, "Для цього міста немає доступних відділень");
      openComboList(novaBranchOptions, novaBranch);
      if (novaBranch) {
        novaBranch.value = "";
      }

      if (!branches.length) {
        setNovaStatus("Для цього міста не знайдено відділень.", true);
        return;
      }

      setNovaStatus(`Завантажено відділень: ${branches.length}.`);
    } catch {
      novaLastBranches = [];
      activeBranchOptionIndex = -1;
      renderComboOptions(novaBranchOptions, [], "Помилка завантаження");
      openComboList(novaBranchOptions, novaBranch);
      setNovaStatus("Не вдалося отримати відділення Нова Пошта.", true);
    }
  };

  const connectNovaPoshtaAutocomplete = () => {
    if (!novaCity || !novaBranch || !novaCityOptions || !novaBranchOptions) return;

    setNovaStatus("Введіть місто для автопошуку Нова Пошта.");

    const applyCityByIndex = (index) => {
      if (index < 0 || index >= novaLastCities.length) return;
      const selected = novaLastCities[index];
      novaCity.value = selected.present;
      novaSelectedCityRef = selected.ref;
      closeComboList(novaCityOptions, novaCity);
      setNovaStatus("Місто обрано. Завантажуємо відділення...");
      void loadNovaBranches(novaSelectedCityRef);
    };

    const applyBranchValue = (value) => {
      const selectedValue = String(value || "").trim();
      if (!selectedValue) return;
      novaBranch.value = selectedValue;
      closeComboList(novaBranchOptions, novaBranch);
    };

    novaCity.addEventListener("input", () => {
      const query = String(novaCity.value || "").trim();
      novaSelectedCityRef = "";
      novaLastBranches = [];
      activeBranchOptionIndex = -1;
      renderComboOptions(novaBranchOptions, [], "Спочатку оберіть місто");
      closeComboList(novaBranchOptions, novaBranch);

      if (novaBranch) {
        novaBranch.value = "";
      }

      if (novaCitySearchTimer) {
        clearTimeout(novaCitySearchTimer);
      }

      novaCitySearchTimer = setTimeout(() => {
        void searchNovaCities(query);
      }, 320);
    });

    novaCity.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (novaCityOptions.hidden) {
          openComboList(novaCityOptions, novaCity);
        }
        if (!novaLastCities.length) return;
        activeCityOptionIndex = Math.min(novaLastCities.length - 1, activeCityOptionIndex + 1);
        setActiveOption(novaCityOptions, activeCityOptionIndex);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!novaLastCities.length) return;
        activeCityOptionIndex = Math.max(0, activeCityOptionIndex - 1);
        setActiveOption(novaCityOptions, activeCityOptionIndex);
      }

      if (event.key === "Enter") {
        if (activeCityOptionIndex >= 0 && !novaCityOptions.hidden) {
          event.preventDefault();
          applyCityByIndex(activeCityOptionIndex);
        }
      }

      if (event.key === "Escape") {
        closeComboList(novaCityOptions, novaCity);
      }
    });

    novaCity.addEventListener("blur", () => {
      const current = String(novaCity.value || "").trim();
      const selected = novaLastCities.find((entry) => entry.present === current);
      novaSelectedCityRef = selected?.ref || "";

      if (current && !novaSelectedCityRef) {
        setNovaStatus("Оберіть місто зі списку підказок.", true);
        novaLastBranches = [];
        renderComboOptions(novaBranchOptions, [], "Спочатку оберіть місто");
        closeComboList(novaBranchOptions, novaBranch);
        if (novaBranch) {
          novaBranch.value = "";
        }
      }
    });

    novaBranch.addEventListener("focus", () => {
      if (!novaSelectedCityRef) {
        setNovaStatus("Спочатку оберіть місто зі списку.", true);
        return;
      }

      if (novaLastBranches.length) {
        renderComboOptions(novaBranchOptions, novaLastBranches, "Для цього міста немає доступних відділень");
        openComboList(novaBranchOptions, novaBranch);
      }
    });

    novaBranch.addEventListener("input", () => {
      const query = String(novaBranch.value || "").trim().toLowerCase();
      if (!query) {
        activeBranchOptionIndex = -1;
        renderComboOptions(novaBranchOptions, novaLastBranches, "Для цього міста немає доступних відділень");
        if (novaLastBranches.length) openComboList(novaBranchOptions, novaBranch);
        return;
      }

      const filtered = novaLastBranches.filter((item) => item.toLowerCase().includes(query));
      activeBranchOptionIndex = -1;
      renderComboOptions(novaBranchOptions, filtered, "Нічого не знайдено");
      openComboList(novaBranchOptions, novaBranch);
    });

    novaBranch.addEventListener("keydown", (event) => {
      const currentOptions = Array.from(novaBranchOptions.querySelectorAll(".combo-option"));

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (novaBranchOptions.hidden) {
          openComboList(novaBranchOptions, novaBranch);
        }
        if (!currentOptions.length) return;
        activeBranchOptionIndex = Math.min(currentOptions.length - 1, activeBranchOptionIndex + 1);
        setActiveOption(novaBranchOptions, activeBranchOptionIndex);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!currentOptions.length) return;
        activeBranchOptionIndex = Math.max(0, activeBranchOptionIndex - 1);
        setActiveOption(novaBranchOptions, activeBranchOptionIndex);
      }

      if (event.key === "Enter") {
        if (activeBranchOptionIndex >= 0 && !novaBranchOptions.hidden) {
          event.preventDefault();
          const chosen = currentOptions[activeBranchOptionIndex]?.dataset.value;
          if (chosen) {
            applyBranchValue(chosen);
          }
        }
      }

      if (event.key === "Escape") {
        closeComboList(novaBranchOptions, novaBranch);
      }
    });

    if (novaCityToggle) {
      novaCityToggle.addEventListener("click", () => {
        if (novaCityOptions.hidden) {
          if (novaLastCities.length) {
            renderComboOptions(novaCityOptions, novaLastCities.map((entry) => entry.present), "Нічого не знайдено");
            openComboList(novaCityOptions, novaCity);
          }
          novaCity.focus();
          return;
        }
        closeComboList(novaCityOptions, novaCity);
      });
    }

    if (novaBranchToggle) {
      novaBranchToggle.addEventListener("click", () => {
        if (!novaSelectedCityRef) {
          setNovaStatus("Спочатку оберіть місто зі списку.", true);
          novaCity.focus();
          return;
        }

        if (novaBranchOptions.hidden) {
          renderComboOptions(novaBranchOptions, novaLastBranches, "Для цього міста немає доступних відділень");
          openComboList(novaBranchOptions, novaBranch);
          novaBranch.focus();
          return;
        }

        closeComboList(novaBranchOptions, novaBranch);
      });
    }

    novaCityOptions.addEventListener("mousedown", (event) => {
      const button = event.target.closest(".combo-option");
      if (!button) return;
      event.preventDefault();
      const index = Number(button.dataset.index);
      if (!Number.isNaN(index)) {
        applyCityByIndex(index);
      }
    });

    novaBranchOptions.addEventListener("mousedown", (event) => {
      const button = event.target.closest(".combo-option");
      if (!button) return;
      event.preventDefault();
      const value = String(button.dataset.value || "").trim();
      if (!value) return;
      applyBranchValue(value);
    });

    document.addEventListener("mousedown", (event) => {
      if (novaCityCombo && !novaCityCombo.contains(event.target)) {
        closeComboList(novaCityOptions, novaCity);
      }

      if (novaBranchCombo && !novaBranchCombo.contains(event.target)) {
        closeComboList(novaBranchOptions, novaBranch);
      }
    });

    novaBranch.addEventListener("blur", () => {
      const typed = String(novaBranch.value || "").trim();
      if (!typed) return;
      const matched = novaLastBranches.find((item) => item === typed);
      if (!matched) {
        setNovaStatus("Оберіть відділення зі списку підказок.", true);
      }
    });

    novaCity.addEventListener("change", () => {
      const current = String(novaCity.value || "").trim();
      const selected = novaLastCities.find((entry) => entry.present === current);
      if (!selected) return;
      novaSelectedCityRef = selected.ref;
      void loadNovaBranches(novaSelectedCityRef);
    });
  };

  const clearAddressRequirements = () => {
    [novaCity, novaBranch, ukrCity, ukrRegion, ukrDistrict, ukrPostalCode, courierCity, courierAddress].forEach((field) => {
      if (!field) return;
      field.required = false;
    });
  };

  const setAddressView = (deliveryMethod) => {
    if (!deliveryAddressGroup || !addressNovaPost || !addressUkrPost || !addressCourier || !addressHint) return;

    const method = String(deliveryMethod || "").toLowerCase();
    clearAddressRequirements();

    deliveryAddressGroup.hidden = !method;

    addressNovaPost.hidden = true;
    addressUkrPost.hidden = true;
    addressCourier.hidden = true;

    if (method.includes("нова пошта") && (method.includes("відділення") || method.includes("поштомат"))) {
      addressNovaPost.hidden = false;
      addressHint.hidden = true;
      if (novaCity) novaCity.required = true;
      if (novaBranch) novaBranch.required = true;
      return;
    }

    if (method.includes("укрпошта") || method.includes("укр пошта")) {
      addressUkrPost.hidden = false;
      addressHint.hidden = true;
      if (ukrCity) ukrCity.required = true;
      if (ukrRegion) ukrRegion.required = true;
      if (ukrDistrict) ukrDistrict.required = true;
      if (ukrPostalCode) ukrPostalCode.required = true;
      return;
    }

    if (method.includes("кур") || method.includes("courier")) {
      addressCourier.hidden = false;
      addressHint.hidden = true;
      if (courierCity) courierCity.required = true;
      if (courierAddress) courierAddress.required = true;
      return;
    }

    addressHint.hidden = false;
  };

  const buildDeliveryAddress = (deliveryMethod) => {
    const method = String(deliveryMethod || "").toLowerCase();

    if (method.includes("нова пошта") && (method.includes("відділення") || method.includes("поштомат"))) {
      const city = String(novaCity?.value || "").trim();
      const branch = String(novaBranch?.value || "").trim();
      if (!city || !branch) {
        return { ok: false, value: "", message: "Для Нової пошти вкажіть місто та номер відділення/поштомату." };
      }
      return { ok: true, value: `${city}, ${branch}`, message: "" };
    }

    if (method.includes("укрпошта") || method.includes("укр пошта")) {
      const city = String(ukrCity?.value || "").trim();
      const region = String(ukrRegion?.value || "").trim();
      const district = String(ukrDistrict?.value || "").trim();
      const postalCode = String(ukrPostalCode?.value || "").trim();
      if (!city || !region || !district || !postalCode) {
        return { ok: false, value: "", message: "Для Укрпошти вкажіть місто, область, район та індекс." };
      }
      return { ok: true, value: `${postalCode}, ${region} обл., ${district} р-н, м. ${city}`, message: "" };
    }

    if (method.includes("кур") || method.includes("courier")) {
      const city = String(courierCity?.value || "").trim();
      const address = String(courierAddress?.value || "").trim();
      if (!city || !address) {
        return { ok: false, value: "", message: "Для кур'єра вкажіть місто та адресу доставки." };
      }
      return { ok: true, value: `м. ${city}, ${address}`, message: "" };
    }

    return { ok: true, value: "-", message: "" };
  };

  const renderDeliveryAndPaymentOptions = () => {
    settings = readSettings();
    applyAccentColor();
    applySiteBackground();
    const matrix = normalizePaymentDeliveryMatrix(settings.paymentDeliveryMatrix);
    const previousDeliveryValue = String(checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
    const previousPaymentValue = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();
    shippingMethods = buildShippingMethods(settings);
    const allPaymentMethods = buildPaymentMethods(settings);
    renderOptions(shippingOptions, shippingMethods, "deliveryMethod", false);
    if (previousDeliveryValue) {
      const deliveryInput = checkoutForm?.querySelector(`input[name="deliveryMethod"][value="${CSS.escape(previousDeliveryValue)}"]`);
      if (deliveryInput) {
        deliveryInput.checked = true;
      }
    }

    const selectedDeliveryId = getSelectedDeliveryId();
    paymentMethods = filterPaymentMethodsByDelivery(allPaymentMethods, selectedDeliveryId, matrix);
    renderOptions(paymentOptions, paymentMethods, "paymentMethod", true);
    if (previousPaymentValue) {
      const paymentInput = checkoutForm?.querySelector(`input[name="paymentMethod"][value="${CSS.escape(previousPaymentValue)}"]`);
      if (paymentInput) {
        paymentInput.checked = true;
      }
    }

    const hasSelectedPayment = Boolean(checkoutForm?.querySelector('input[name="paymentMethod"]:checked'));
    if (!hasSelectedPayment) {
      const firstPayment = checkoutForm?.querySelector('input[name="paymentMethod"]');
      if (firstPayment) {
        firstPayment.checked = true;
      }
    }

    if (shippingEmpty) {
      shippingEmpty.hidden = shippingMethods.length > 0;
    }
    if (paymentEmpty) {
      if (!selectedDeliveryId) {
        paymentEmpty.textContent = "Спочатку оберіть спосіб доставки.";
      } else {
        paymentEmpty.textContent = "Адміністратор ще не увімкнув жодного способу оплати.";
      }
      paymentEmpty.hidden = paymentMethods.length > 0;
    }

    updateBankTransferInfo();
  };

  const isBankTransferMethod = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized.includes("реквізит");
  };

  const updateBankTransferInfo = () => {
    if (!bankTransferInfo || !bankTransferText) return;

    const selectedPayment = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();
    const requisites = String(settings.paymentBankRequisites || "").trim();
    const shouldShow = isBankTransferMethod(selectedPayment) && Boolean(requisites);

    bankTransferInfo.hidden = !shouldShow;
    bankTransferText.textContent = shouldShow ? requisites : "";
  };

  renderDeliveryAndPaymentOptions();

  const initialDeliveryMethod = checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "";
  setAddressView(initialDeliveryMethod);

  if (shippingOptions) {
    shippingOptions.addEventListener("change", (event) => {
      const option = event.target.closest('input[name="deliveryMethod"]');
      if (!option) return;
      renderDeliveryAndPaymentOptions();
      setAddressView(option.value);
      updateSubmitState();
    });
  }

  if (paymentOptions) {
    paymentOptions.addEventListener("change", () => {
      updateSubmitState();
      updateBankTransferInfo();
      updateCheckoutSummary();
    });
  }

  const getCartTotals = () => {
    const totalItems = cartState.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const subtotal = cartState.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    const promoDiscount = Math.max(0, Number(appliedPromo?.discountAmount) || 0);
    const totalAmount = Math.max(0, subtotal - promoDiscount);
    return { totalItems, subtotal, promoDiscount, totalAmount };
  };

  const setPromoMessage = (message, state = "") => {
    if (!promoMessage) return;
    promoMessage.textContent = message;
    promoMessage.classList.remove("error", "success");
    if (state) {
      promoMessage.classList.add(state);
    }
  };

  const normalizePromoCode = (promoCode) => {
    const discountType = promoCode?.discountType === "uah" ? "uah" : "percent";
    return {
      id: String(promoCode?.id || ""),
      code: String(promoCode?.code || "").trim().toUpperCase(),
      discountType,
      discountValue: Math.max(0, Number(promoCode?.discountValue) || 0),
      minOrderAmount: Math.max(0, Number(promoCode?.minOrderAmount) || 0),
      maxDiscountPerOrder: Math.max(0, Number(promoCode?.maxDiscountPerOrder) || 0)
    };
  };

  const calculatePromoDiscount = (promoCode, subtotal) => {
    const normalized = normalizePromoCode(promoCode);
    if (!normalized.code || normalized.discountValue <= 0) {
      return { ok: false, message: "Промо-код недійсний.", discountAmount: 0, code: "" };
    }

    if (subtotal <= 0) {
      return { ok: false, message: "Кошик порожній.", discountAmount: 0, code: normalized.code };
    }

    if (normalized.minOrderAmount > 0 && subtotal < normalized.minOrderAmount) {
      return {
        ok: false,
        message: `Мінімальна сума для цього коду: ${formatPrice(normalized.minOrderAmount)}.`,
        discountAmount: 0,
        code: normalized.code
      };
    }

    let discountAmount = normalized.discountType === "uah"
      ? normalized.discountValue
      : (subtotal * normalized.discountValue) / 100;

    if (normalized.maxDiscountPerOrder > 0) {
      discountAmount = Math.min(discountAmount, normalized.maxDiscountPerOrder);
    }

    discountAmount = Math.min(Math.max(0, Math.round(discountAmount)), subtotal);

    if (discountAmount <= 0) {
      return { ok: false, message: "Знижка за цим кодом дорівнює 0.", discountAmount: 0, code: normalized.code };
    }

    return {
      ok: true,
      message: `Промо-код ${normalized.code} застосовано.`,
      discountAmount,
      code: normalized.code
    };
  };

  const getPrepaymentAmount = () => {
    const configured = Math.max(0, Math.round(Number(settings.paymentPrepaymentAmount) || 0));
    const { totalAmount } = getCartTotals();
    if (configured <= 0 || totalAmount <= 0) return 0;
    return Math.min(configured, totalAmount);
  };

  const getPayableAmount = () => {
    const { totalAmount } = getCartTotals();
    const selectedPayment = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();
    if (!isPrepaymentMethod(selectedPayment)) {
      return totalAmount;
    }
    return getPrepaymentAmount();
  };

  const syncPromoStateAfterCartChange = () => {
    if (!appliedPromo) return;
    const { subtotal } = getCartTotals();
    const promoCodes = readPromoCodes();
    const promo = promoCodes.find((item) => String(item?.code || "").trim().toUpperCase() === appliedPromo.code);
    if (!promo) {
      appliedPromo = null;
      setPromoMessage("Промо-код більше недоступний.", "error");
      return;
    }

    const recalculated = calculatePromoDiscount(promo, subtotal);
    if (!recalculated.ok) {
      appliedPromo = null;
      setPromoMessage("Промо-код скасовано: умови більше не виконуються.", "error");
      return;
    }

    appliedPromo = {
      code: recalculated.code,
      discountAmount: recalculated.discountAmount
    };
    setPromoMessage(`Промо-код ${recalculated.code} застосовано.`, "success");
  };

  const updateCheckoutSummary = () => {
    const { totalItems, subtotal, promoDiscount, totalAmount } = getCartTotals();
    const payableAmount = getPayableAmount();
    const selectedPayment = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();
    const isPrepayment = isPrepaymentMethod(selectedPayment);
    const postpayAmount = Math.max(0, totalAmount - payableAmount);
    if (summaryItems) summaryItems.textContent = String(totalItems);
    if (summarySubtotal) summarySubtotal.textContent = formatPrice(subtotal);
    if (summaryDiscountRow) summaryDiscountRow.hidden = promoDiscount <= 0;
    if (summaryDiscount) summaryDiscount.textContent = `− ${formatPrice(promoDiscount)}`;
    if (summaryTotal) summaryTotal.textContent = formatPrice(payableAmount);
    if (summaryPostpayRow) {
      const shouldHidePostpay = !isPrepayment || postpayAmount <= 0;
      summaryPostpayRow.hidden = shouldHidePostpay;
      summaryPostpayRow.style.display = shouldHidePostpay ? "none" : "";
    }
    if (summaryPostpay) summaryPostpay.textContent = formatPrice(postpayAmount);
    if (summarySubtotalRow) {
      const shouldHideSubtotal = promoDiscount <= 0 && postpayAmount <= 0 && payableAmount === subtotal;
      summarySubtotalRow.hidden = shouldHideSubtotal;
      summarySubtotalRow.style.display = shouldHideSubtotal ? "none" : "";
    }
  };

  const renderCartSummary = () => {
    if (!cartSummaryItems) return;

    if (!cartState.length) {
      cartSummaryItems.innerHTML = '<p class="cart-summary-empty">Кошик порожній.</p>';
      return;
    }

    cartSummaryItems.innerHTML = cartState.map((item, index) => {
      const name = String(item.name || "Товар").trim();
      const qty = Math.max(1, Number(item.qty) || 1);
      const unitPrice = Math.max(0, Number(item.price) || 0);
      const lineTotal = unitPrice * qty;
      const cartId = String(item.id || `${name}-${index}`).trim();
      const photo = String(item.image || "https://picsum.photos/seed/lavka-order-item/80/80").trim();
      const encodedCartId = encodeURIComponent(cartId);

      return `
        <article class="cart-line">
          <div class="cart-line-main">
            <img class="cart-line-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(name)}">
            <div>
              <p class="cart-line-name">${escapeHtml(name)}</p>
              <p class="cart-line-meta">${formatPrice(unitPrice)} × ${qty}</p>
            </div>
          </div>
          <p class="cart-line-total">${formatPrice(lineTotal)}</p>
          <div class="cart-line-controls">
            <button type="button" class="cart-qty-btn" data-action="decrease" data-cart-id="${encodedCartId}" aria-label="Зменшити кількість">−</button>
            <span class="cart-line-qty">${qty}</span>
            <button type="button" class="cart-qty-btn" data-action="increase" data-cart-id="${encodedCartId}" aria-label="Збільшити кількість">+</button>
            <button type="button" class="cart-remove-btn" data-action="remove" data-cart-id="${encodedCartId}">Видалити</button>
          </div>
        </article>
      `;
    }).join("");
  };

  const baseCheckoutEnabled = () => {
    const { totalItems } = getCartTotals();
    return totalItems > 0 && shippingMethods.length > 0 && paymentMethods.length > 0;
  };

  const updateAvailabilityMessage = () => {
    if (!checkoutMessage) return;

    if (baseCheckoutEnabled()) {
      if (checkoutMessage.classList.contains("error")) {
        checkoutMessage.classList.remove("error");
        checkoutMessage.textContent = "";
      }
      return;
    }

    checkoutMessage.classList.add("error");
    const { totalItems } = getCartTotals();
    if (totalItems === 0) {
      checkoutMessage.textContent = "Кошик порожній. Додайте товари перед оформленням.";
    } else if (!shippingMethods.length) {
      checkoutMessage.textContent = "Немає доступних способів доставки. Увімкніть їх в адмін-панелі.";
    } else if (!paymentMethods.length) {
      checkoutMessage.textContent = "Немає доступних способів оплати. Увімкніть їх в адмін-панелі.";
    }
  };

  const updateSubmitState = () => {
    const selectedDelivery = String(checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
    const selectedPayment = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();
    const ready = baseCheckoutEnabled()
      && Boolean(selectedDelivery)
      && Boolean(selectedPayment);

    if (submitOrderBtn) {
      submitOrderBtn.disabled = !ready;
    }
  };

  updateCheckoutSummary();
  renderCartSummary();

  updateSubmitState();
  updateBankTransferInfo();
  updateAvailabilityMessage();
  connectNovaPoshtaAutocomplete();

  if (applyPromoBtn) {
    applyPromoBtn.addEventListener("click", () => {
      const rawCode = String(promoCodeInput?.value || "").trim().toUpperCase();
      if (!rawCode) {
        appliedPromo = null;
        updateCheckoutSummary();
        setPromoMessage("Введіть промо-код.", "error");
        return;
      }

      const { subtotal } = getCartTotals();
      const promoCodes = readPromoCodes();
      const promo = promoCodes.find((item) => String(item?.code || "").trim().toUpperCase() === rawCode);

      if (!promo) {
        appliedPromo = null;
        updateCheckoutSummary();
        setPromoMessage("Промо-код не знайдено.", "error");
        return;
      }

      const result = calculatePromoDiscount(promo, subtotal);
      if (!result.ok) {
        appliedPromo = null;
        updateCheckoutSummary();
        setPromoMessage(result.message, "error");
        return;
      }

      appliedPromo = {
        code: result.code,
        discountAmount: result.discountAmount
      };

      updateCheckoutSummary();
      setPromoMessage(result.message, "success");
    });
  }

  if (promoCodeInput) {
    promoCodeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyPromoBtn?.click();
      }
    });
  }

  if (cartSummaryItems) {
    cartSummaryItems.addEventListener("click", (event) => {
      const control = event.target.closest("button[data-action][data-cart-id]");
      if (!control) return;

      const action = String(control.dataset.action || "").trim();
      const cartId = decodeURIComponent(String(control.dataset.cartId || "").trim());
      if (!action || !cartId) return;

      const index = cartState.findIndex((item) => String(item.id || "").trim() === cartId);
      if (index === -1) return;

      if (action === "increase") {
        cartState[index].qty = Math.max(1, Number(cartState[index].qty) || 1) + 1;
      }

      if (action === "decrease") {
        cartState[index].qty = Math.max(1, (Number(cartState[index].qty) || 1) - 1);
      }

      if (action === "remove") {
        cartState.splice(index, 1);
      }

      saveCart(cartState);
      syncPromoStateAfterCartChange();
      renderCartSummary();
      updateCheckoutSummary();
      updateSubmitState();
      updateAvailabilityMessage();
    });
  }

  const createOrderId = () => `#${Date.now().toString().slice(-6)}`;

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!baseCheckoutEnabled()) {
        return;
      }

      const nameValue = String(customerName?.value || "").trim();
      const phoneValue = String(customerPhone?.value || "").trim();
      const deliveryMethod = String(checkoutForm.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
      const paymentMethod = String(checkoutForm.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();
      const commentValue = String(orderComment?.value || "").trim();
      const deliveryAddressResult = buildDeliveryAddress(deliveryMethod);

      if (!nameValue || !phoneValue || !deliveryMethod || !paymentMethod) {
        if (checkoutMessage) {
          checkoutMessage.classList.add("error");
          checkoutMessage.textContent = "Заповніть ПІБ, телефон та оберіть доставку/оплату.";
        }
        return;
      }

      if (!deliveryAddressResult.ok) {
        if (checkoutMessage) {
          checkoutMessage.classList.add("error");
          checkoutMessage.textContent = deliveryAddressResult.message;
        }
        return;
      }

      const { totalAmount, promoDiscount } = getCartTotals();
      const payableAmount = getPayableAmount();
      const prepaymentAmount = isPrepaymentMethod(paymentMethod) ? payableAmount : 0;

      const orderItems = cartState.map((item) => ({
        photo: String(item.image || "https://picsum.photos/seed/lavka-order-item/80/80"),
        sku: String(item.id || "-"),
        name: String(item.name || "Товар"),
        price: Math.max(0, Number(item.price) || 0),
        qty: Math.max(1, Number(item.qty) || 1)
      }));

      const nextOrder = {
        id: createOrderId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customerName: nameValue,
        customerPhone: phoneValue,
        deliveryMethod,
        deliveryAddress: deliveryAddressResult.value,
        comment: commentValue || "Коментар відсутній",
        managerComment: "",
        status: "Очікує",
        paymentStatus: "Не оплачено",
        trackingNumber: "",
        total: totalAmount,
        payableNow: payableAmount,
        prepaymentAmount,
        discount: promoDiscount,
        promoCode: appliedPromo?.code || "",
        promoDiscount,
        inventoryApplied: false,
        paymentMethod,
        items: orderItems
      };

      const orders = readOrders();
      saveOrders([nextOrder, ...orders]);
      cartState = [];
      saveCart(cartState);

      if (checkoutMessage) {
        checkoutMessage.classList.remove("error");
        checkoutMessage.textContent = "Замовлення оформлено. Дякуємо!";
      }

      setTimeout(() => {
        window.location.href = "index.html";
      }, 800);
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== SETTINGS_KEY && event.key !== CHECKOUT_SETTINGS_KEY) return;

    const prevDelivery = String(checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
    const prevPayment = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();

    renderDeliveryAndPaymentOptions();

    if (prevDelivery) {
      const deliveryInput = checkoutForm?.querySelector(`input[name="deliveryMethod"][value="${CSS.escape(prevDelivery)}"]`);
      if (deliveryInput) {
        deliveryInput.checked = true;
      }
    }

    if (prevPayment) {
      const paymentInput = checkoutForm?.querySelector(`input[name="paymentMethod"][value="${CSS.escape(prevPayment)}"]`);
      if (paymentInput) {
        paymentInput.checked = true;
      }
    }

    const selectedDelivery = String(checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
    setAddressView(selectedDelivery);
    updateSubmitState();
    updateBankTransferInfo();
    updateAvailabilityMessage();
  });

  const refreshFromSettings = () => {
    const prevDelivery = String(checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
    const prevPayment = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();

    renderDeliveryAndPaymentOptions();

    if (prevDelivery) {
      const deliveryInput = checkoutForm?.querySelector(`input[name="deliveryMethod"][value="${CSS.escape(prevDelivery)}"]`);
      if (deliveryInput) deliveryInput.checked = true;
    }
    if (prevPayment) {
      const paymentInput = checkoutForm?.querySelector(`input[name="paymentMethod"][value="${CSS.escape(prevPayment)}"]`);
      if (paymentInput) paymentInput.checked = true;
    }

    const selectedDelivery = String(checkoutForm?.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
    setAddressView(selectedDelivery);
    updateSubmitState();
    updateBankTransferInfo();
    updateAvailabilityMessage();
  };

  window.addEventListener("focus", refreshFromSettings);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshFromSettings();
    }
  });
});
