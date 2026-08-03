document.addEventListener("DOMContentLoaded", () => {
  const SETTINGS_KEY = "lavkaStoreSettings";
  const CHECKOUT_SETTINGS_KEY = "lavkaCheckoutSettings";
  const CART_KEY = "lavkaCart";
  const ORDERS_KEY = "lavkaOrders";
  const PROMO_CODES_KEY = "lavkaPromoCodes";
  const PRODUCTS_KEY = "lavkaProducts";
  const NOVA_POSHTA_API_URL = "https://api.novaposhta.ua/v2.0/json/";
  const NOVA_POSHTA_API_KEY = "8e24dc6bb36a0ee95f254d203bb3cc92";
  const NOTIFY_ORDER_URL = "https://us-central1-lavka-shop.cloudfunctions.net/notifyOrder";
  const CREATE_ORDER_MONO_INVOICE_URL = "https://us-central1-lavka-shop.cloudfunctions.net/createStoreOrderMonoInvoice";
  const CREATE_ORDER_LIQPAY_INVOICE_URL = "https://us-central1-lavka-shop.cloudfunctions.net/createStoreOrderLiqpayInvoice";
  const GET_STORE_ORDER_LIQPAY_STATUS_URL = "https://us-central1-lavka-shop.cloudfunctions.net/getStoreOrderLiqpayInvoiceStatus";

  const resolveStoreIdForNotify = async () => {
    if (window.__lavkaStoreId) return String(window.__lavkaStoreId);
    if (typeof window.lavkaResolveStoreId === "function") {
      try {
        return String((await window.lavkaResolveStoreId()) || "");
      } catch (error) {
        return "";
      }
    }
    return "";
  };

  const sendOrderTelegramNotification = async (order) => {
    try {
      const storeId = await resolveStoreIdForNotify();
      if (!storeId || storeId === "default-store") return;

      await fetch(NOTIFY_ORDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          storeId,
          order: {
            id: String(order.id || ""),
            customerName: String(order.customerName || ""),
            customerPhone: String(order.customerPhone || ""),
            deliveryMethod: String(order.deliveryMethod || ""),
            paymentMethod: String(order.paymentMethod || ""),
            comment: String(order.comment || ""),
            total: Number(order.total) || 0,
            items: Array.isArray(order.items)
              ? order.items.map((item) => ({
                  name: String(item.name || "Товар"),
                  qty: Math.max(1, Number(item.qty) || 1)
                }))
              : []
          }
        })
      });
    } catch (error) {
      // Сповіщення не має блокувати оформлення замовлення.
    }
  };

  const isMonoPaymentMethod = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized.includes("mono");
  };

  const isMonoPaymentMethodById = (value) => String(value || "").trim().toLowerCase() === "payment-mono";

  const isLiqpayPaymentMethod = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized.includes("liqpay");
  };

  const isLiqpayPaymentMethodById = (value) => String(value || "").trim().toLowerCase() === "payment-liqpay";

  const mapLiqpayCreateErrorMessage = (errorCode) => {
    const code = String(errorCode || "").trim().toLowerCase();
    if (code === "liqpay-config-missing") {
      return "Оплата LiqPay тимчасово недоступна: власник магазину ще не додав API ключі.";
    }
    if (code === "liqpay-disabled") {
      return "Оплата LiqPay вимкнена в налаштуваннях магазину.";
    }
    if (code === "invalid-store-id") {
      return "Не вдалося визначити магазин для оплати.";
    }
    if (code === "invalid-order") {
      return "Невірні дані замовлення. Перевірте кошик та спробуйте знову.";
    }
    return "Не вдалося створити платіж LiqPay. Спробуйте ще раз.";
  };

  const mapMonoCreateErrorMessage = (errorCode) => {
    const code = String(errorCode || "").trim().toLowerCase();
    if (code === "mono-config-missing") {
      return "Оплата mono тимчасово недоступна: власник магазину ще не додав API key.";
    }
    if (code === "mono-disabled") {
      return "Оплата mono вимкнена в налаштуваннях магазину.";
    }
    if (code === "mono-invalid-token") {
      return "Не вдалося створити платіж mono: перевірте API key в адмінці магазину.";
    }
    if (code === "invalid-store-id") {
      return "Не вдалося визначити магазин для оплати.";
    }
    if (code === "invalid-order") {
      return "Невірні дані замовлення. Перевірте кошик та спробуйте знову.";
    }
    if (code === "mono-rate-limit") {
      return "Сервіс mono тимчасово перевантажений. Спробуйте ще раз через хвилину.";
    }
    return "Не вдалося створити платіж mono. Спробуйте ще раз.";
  };

  const createMonoInvoiceForOrder = async (order) => {
    const storeId = await resolveStoreIdForNotify();
    if (!storeId || storeId === "default-store") {
      throw new Error("invalid-store-id");
    }

    const amount = Math.max(0, Math.round(Number(order?.payableNow) || 0));
    if (amount <= 0) {
      throw new Error("invalid-order");
    }

    const payload = {
      storeId,
      orderId: String(order?.id || "").trim(),
      amount,
      currency: normalizeCurrencyCode(settings?.currency || "uah"),
      customerName: String(order?.customerName || "").trim(),
      customerPhone: String(order?.customerPhone || "").trim(),
      paymentMethod: String(order?.paymentMethod || "").trim(),
      returnBaseUrl: window.location.origin,
      items: Array.isArray(order?.items)
        ? order.items.map((item) => ({
            code: String(item?.sku || "-").trim().slice(0, 64),
            name: String(item?.name || "Товар").trim().slice(0, 120),
            qty: Math.max(1, Math.round(Number(item?.qty) || 1)),
            price: Math.max(0, Math.round(Number(item?.price) || 0))
          }))
        : []
    };

    const response = await fetch(CREATE_ORDER_MONO_INVOICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data || !data.ok) {
      throw new Error(String(data && data.error || "create-invoice-failed"));
    }

    return {
      invoiceId: String(data.invoiceId || "").trim(),
      pageUrl: String(data.pageUrl || "").trim(),
      appUrl: String(data.appUrl || "").trim()
    };
  };

  const createLiqpayInvoiceForOrder = async (order) => {
    const storeId = await resolveStoreIdForNotify();
    if (!storeId || storeId === "default-store") {
      throw new Error("invalid-store-id");
    }

    const amount = Math.max(0, Math.round(Number(order?.payableNow) || 0));
    if (amount <= 0) {
      throw new Error("invalid-order");
    }

    const payload = {
      storeId,
      orderId: String(order?.id || "").trim(),
      amount,
      currency: normalizeCurrencyCode(settings?.currency || "uah"),
      customerName: String(order?.customerName || "").trim(),
      customerPhone: String(order?.customerPhone || "").trim(),
      paymentMethod: String(order?.paymentMethod || "").trim(),
      returnBaseUrl: window.location.origin
    };

    const response = await fetch(CREATE_ORDER_LIQPAY_INVOICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data || !data.ok) {
      throw new Error(String(data && data.error || "create-invoice-failed"));
    }

    return {
      invoiceId: String(data.invoiceId || "").trim(),
      pageUrl: String(data.pageUrl || "").trim()
    };
  };

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
  const prepaymentAcquirerInfo = document.getElementById("prepaymentAcquirerInfo");
  const prepaymentAcquirerOptions = document.getElementById("prepaymentAcquirerOptions");
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
  const checkoutOrderStatusBadge = document.getElementById("checkoutOrderStatusBadge");
  const checkoutCard = document.querySelector(".checkout-card");

  const showPaymentReturnStatus = () => {
    if (!checkoutMessage) return;
    const params = new URLSearchParams(window.location.search || "");
    const status = String(params.get("payment") || "").trim().toLowerCase();
    if (!status) return;

    const orderParam = String(params.get("order") || "").trim();
    const orders = orderParam ? (readOrders() || []) : [];
    const idx = orderParam ? orders.findIndex((o) => String(o && o.id || "") === orderParam) : -1;
    const order = idx >= 0 ? orders[idx] : null;
    const isLiqpayOrder = Boolean(
      order && (order.liqpayInvoiceId || isLiqpayPaymentMethodById(order.paymentMethodId) || isLiqpayPaymentMethod(order.paymentMethod))
    );
    const providerLabel = isLiqpayOrder ? "LiqPay" : "mono";

    checkoutMessage.classList.remove("error");
    if (status === "success") {
      checkoutMessage.textContent = `Оплату через ${providerLabel} отримано. Дякуємо за замовлення!`;
    } else if (status === "processing") {
      checkoutMessage.textContent = `Платіж ${providerLabel} обробляється. Зачекайте кілька секунд.`;
    } else if (status === "fail") {
      checkoutMessage.classList.add("error");
      checkoutMessage.textContent = `Оплата ${providerLabel} не завершена. Спробуйте ще раз.`;
    }

    if (!order) return;

    // Try to reconcile order status immediately: find order and check invoice status.
    try {
      const maybeRedirect = (newStatus) => {
        if (newStatus === "success") {
          window.location.href = `thank-you.html?order=${encodeURIComponent(orderParam)}`;
        }
      };

      if (isLiqpayOrder) {
        const applyLiqpayInvoiceData = (data) => {
          if (!data || !data.ok) return;
          const newStatus = String(data.liqpayStatus || data.status || "").trim().toLowerCase();
          const isPaid = newStatus === "success" || newStatus === "sandbox";
          const isFailed = newStatus === "failure" || newStatus === "error";
          const paymentStatus = isPaid ? "Оплачено" : (isFailed ? "Не оплачено" : (order.paymentStatus || "Не оплачено"));
          orders[idx] = {
            ...order,
            paymentStatus,
            liqpayStatus: String(data.liqpayStatus || order.liqpayStatus || ""),
            liqpayInvoiceId: String(data.invoiceId || order.liqpayInvoiceId || ""),
            liqpayPageUrl: String(data.pageUrl || order.liqpayPageUrl || ""),
            updatedAt: new Date().toISOString()
          };
          saveOrders(orders);
          maybeRedirect(isPaid ? "success" : newStatus);
        };

        const liqpayInvoiceId = String(order.liqpayInvoiceId || "").trim();
        const liqpayUrl = liqpayInvoiceId
          ? `${GET_STORE_ORDER_LIQPAY_STATUS_URL}?invoiceId=${encodeURIComponent(liqpayInvoiceId)}`
          : `${GET_STORE_ORDER_LIQPAY_STATUS_URL}?orderId=${encodeURIComponent(orderParam)}`;
        fetch(liqpayUrl, { method: "GET" })
          .then((r) => r.json())
          .then(applyLiqpayInvoiceData)
          .catch((err) => { console.debug('[checkout] fetchLiqpayInvoiceStatus error', err); });
        return;
      }

      const invoiceId = String(order.monoInvoiceId || "").trim();
      const applyInvoiceData = (data) => {
        if (!data || !data.ok) return;
        const newStatus = String(data.status || "").trim().toLowerCase();
        const paymentStatus = (newStatus === "success") ? "Оплачено" : ((newStatus === "failure" || newStatus === "expired") ? "Не оплачено" : order.paymentStatus || "Не оплачено");
        orders[idx] = {
          ...order,
          paymentStatus,
          monoStatus: String(data.monoStatus || order.monoStatus || ""),
          monoInvoiceId: String(data.invoiceId || order.monoInvoiceId || ""),
          monoPageUrl: String(data.pageUrl || order.monoPageUrl || ""),
          updatedAt: new Date().toISOString()
        };
        saveOrders(orders);
        maybeRedirect(newStatus);
      };

      if (invoiceId) {
        const url = `https://us-central1-lavka-shop.cloudfunctions.net/getStoreOrderInvoiceStatus?invoiceId=${encodeURIComponent(invoiceId)}`;
        console.debug('[checkout] fetchInvoiceStatus invoiceId=', invoiceId, url);
        fetch(url, { method: "GET" })
          .then((r) => r.json())
          .then((data) => {
            console.debug('[checkout] fetchInvoiceStatus response for invoiceId=', invoiceId, data);
            applyInvoiceData(data);
          })
          .catch((err) => { console.debug('[checkout] fetchInvoiceStatus error', err); });
      } else {
        const url = `https://us-central1-lavka-shop.cloudfunctions.net/getStoreOrderInvoiceStatus?orderId=${encodeURIComponent(orderParam)}`;
        console.debug('[checkout] fetchInvoiceStatus by orderId=', orderParam, url);
        fetch(url, { method: "GET" })
          .then((r) => r.json())
          .then((data) => {
            console.debug('[checkout] fetchInvoiceStatus response for orderId=', orderParam, data);
            applyInvoiceData(data);
          })
          .catch((err) => { console.debug('[checkout] fetchInvoiceStatus error', err); });
      }
    } catch (e) {
      // ignore
    }
  };

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

  const readBilling = () => {
    try {
      const raw = localStorage.getItem("lavkaBilling");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const hasExpiredSubscription = () => {
    const until = new Date(readBilling()?.validUntil || "");
    if (!Number.isFinite(until.getTime())) return true;
    return until.getTime() <= Date.now();
  };

  const canRemoveWatermark = () => {
    const billing = readBilling();
    const planId = String(billing?.currentPlanId || "").trim().toLowerCase();
    if (planId !== "business" && planId !== "pro") return false;
    const until = new Date(billing?.validUntil || "");
    return Number.isFinite(until.getTime()) && until.getTime() > Date.now();
  };

  const ensureSiteWatermark = () => {
    let watermark = document.querySelector(".site-watermark");
    if (watermark) return watermark;

    const mount = document.querySelector("main.card") || document.querySelector("main") || document.body;
    if (!mount) return null;

    watermark = document.createElement("footer");
    watermark.className = "site-watermark";
    watermark.innerHTML =
      '<a class="site-watermark-link" href="https://www.vitryna-shop.com/landing" title="Створити власний магазин на Вітрина">'
      + '<svg class="site-watermark-logo" viewBox="150 240 290 290" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Вітрина">'
      + '<rect x="150" y="240" width="290" height="290" rx="55" fill="#3B82E0"/>'
      + '<g fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M215 350 L235 300 L355 300 L375 350"/>'
      + '<path d="M215 350 Q225 372 245 372 Q265 372 275 350"/>'
      + '<path d="M275 350 Q285 372 305 372 Q325 372 335 350"/>'
      + '<path d="M335 350 Q345 372 355 372 Q365 372 375 350"/>'
      + '<line x1="235" y1="372" x2="235" y2="450"/>'
      + '<line x1="355" y1="372" x2="355" y2="450"/>'
      + '<path d="M225 400 L365 400 L365 450 L225 450 Z"/>'
      + '<line x1="205" y1="470" x2="385" y2="470"/>'
      + '</g>'
      + '</svg>'
      + '<span class="site-watermark-text">Створено на <strong>Вітрина</strong></span>'
      + '</a>';

    mount.appendChild(watermark);
    return watermark;
  };

  const applyWatermarkVisibility = () => {
    const activeSettings = readSettings() || {};
    const shouldHide = Boolean(activeSettings.hideWatermark) && canRemoveWatermark();
    const watermark = document.querySelector(".site-watermark");
    if (shouldHide) {
      if (watermark && watermark.parentNode) {
        watermark.parentNode.removeChild(watermark);
      }
      return;
    }
    const existing = ensureSiteWatermark();
    if (existing) {
      existing.hidden = false;
      existing.style.display = "";
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

  const readProducts = () => {
    try {
      const raw = localStorage.getItem(PRODUCTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const findMatchingProduct = (products, item) => {
    const rawId = String(item?.id || "").split("::")[0].trim();
    const sku = String(item?.sku || "").trim().toUpperCase();
    return products.find((product) => {
      const productId = String(product?.id || "").trim();
      const productSku = String(product?.sku || "").trim().toUpperCase();
      return (rawId && productId === rawId) || (sku && sku !== "-" && productSku === sku);
    }) || null;
  };

  const getUnavailableCartItems = () => {
    const products = readProducts();
    if (!products.length) return [];
    return cartState.filter((item) => {
      const product = findMatchingProduct(products, item);
      if (!product) return false;
      const size = String(item?.size || "").trim().toUpperCase();
      if (size && product?.sizeStocks && typeof product.sizeStocks === "object") {
        const sizeStock = Number.parseInt(product.sizeStocks[size], 10);
        return !(Number.isFinite(sizeStock) && sizeStock > 0);
      }
      const stock = Number.parseInt(product?.stock, 10);
      return !(Number.isFinite(stock) && stock > 0);
    });
  };

  // Re-checked at render time and again at submit, since stock can change on another tab/device between adding to cart and placing the order.
  const getAvailableStockForCartItem = (item) => {
    const products = readProducts();
    const product = findMatchingProduct(products, item);
    if (!product) return Infinity;
    const size = String(item?.size || "").trim().toUpperCase();
    if (size && product?.sizeStocks && typeof product.sizeStocks === "object") {
      const sizeStock = Number.parseInt(product.sizeStocks[size], 10);
      return Number.isFinite(sizeStock) && sizeStock > 0 ? sizeStock : 0;
    }
    const stock = Number.parseInt(product?.stock, 10);
    return Number.isFinite(stock) && stock > 0 ? stock : 0;
  };

  const getOverstockCartItems = () => cartState.filter((item) => {
    const qty = Math.max(0, Number(item.qty) || 0);
    return qty > getAvailableStockForCartItem(item);
  });

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
  const storeTitleName = String(settings?.name || settings?.storeName || "").trim();
  document.title = storeTitleName
    ? `Оформлення замовлення — ${storeTitleName}`
    : "Оформлення замовлення";
  let cartState = readCart();
  let appliedPromo = null;
  let isOrderingBlockedByPlanExpiry = false;
  let isOrdersDisabledByOwner = false;
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

  // Which single enabled acquiring the store owner has chosen to process the "Передоплата" prepayment.
  const getPrepaymentAcquirers = (activeSettings) => {
    const monoAvailable = Boolean(activeSettings.paymentMonoEnabled);
    const liqpayAvailable = Boolean(activeSettings.paymentLiqpayEnabled);
    const chosen = String(activeSettings.paymentPrepaymentAcquirer || "").trim().toLowerCase();

    if (chosen === "mono" && monoAvailable) {
      return [{ id: "mono", label: "Plata by mono" }];
    }
    if (chosen === "liqpay" && liqpayAvailable) {
      return [{ id: "liqpay", label: "LiqPay" }];
    }

    // Legacy fallback for stores saved before the single-choice acquirer selector existed.
    if (!chosen) {
      if (Boolean(activeSettings.paymentPrepaymentViaMono ?? true) && monoAvailable) {
        return [{ id: "mono", label: "Plata by mono" }];
      }
      if (Boolean(activeSettings.paymentPrepaymentViaLiqpay ?? true) && liqpayAvailable) {
        return [{ id: "liqpay", label: "LiqPay" }];
      }
    }

    return [];
  };

  const buildPaymentMethods = (activeSettings) => [
    {
      id: "payment-mono",
      enabled: Boolean(activeSettings.paymentMonoEnabled),
      value: "Plata by mono",
      title: "Plata by mono",
      subtitle: "Оплата карткою будь-якого банку: Visa, Mastercard, Apple Pay, Google Pay",
      logo: "plata-by-mono.png"
    },
    {
      id: "payment-liqpay",
      enabled: Boolean(activeSettings.paymentLiqpayEnabled),
      value: "LiqPay",
      title: "LiqPay",
      subtitle: "Оплата карткою будь-якого банку: Visa, Mastercard, Apple Pay, Google Pay",
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
        && Math.max(0, Math.round(Number(activeSettings.paymentPrepaymentAmount) || 0)) > 0
        && getPrepaymentAcquirers(activeSettings).length > 0,
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
    return normalized === "payment-prepayment" || normalized.includes("передоплат");
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
    const isPaymentField = fieldName === "paymentMethod";
    container.innerHTML = options
      .map((option, index) => `
        <label class="option-item">
          <input type="radio" name="${fieldName}" value="${isPaymentField ? escapeHtml(String(option.id || "")) : escapeHtml(String(option.value || ""))}" data-option-id="${escapeHtml(String(option.id || ""))}" data-option-title="${escapeHtml(String(option.value || ""))}" ${autoSelectFirst && index === 0 ? "checked" : ""} ${requiredAttr}>
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
    applyWatermarkVisibility();
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
    updatePrepaymentAcquirerInfo();
  };

  const isBankTransferMethod = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "payment-bank-transfer" || normalized.includes("реквізит");
  };

  const updateBankTransferInfo = () => {
    if (!bankTransferInfo || !bankTransferText) return;

    const selectedPayment = String(checkoutForm?.querySelector('input[name="paymentMethod"]:checked')?.value || "").trim();
    const requisites = String(settings.paymentBankRequisites || "").trim();
    const shouldShow = isBankTransferMethod(selectedPayment) && Boolean(requisites);

    bankTransferInfo.hidden = !shouldShow;
    bankTransferText.textContent = shouldShow ? requisites : "";
  };

  const updatePrepaymentAcquirerInfo = () => {
    if (!prepaymentAcquirerInfo || !prepaymentAcquirerOptions) return;

    const selectedPaymentInput = checkoutForm?.querySelector('input[name="paymentMethod"]:checked');
    const isPrepayment = isPrepaymentMethod(selectedPaymentInput?.dataset?.optionId)
      || isPrepaymentMethod(selectedPaymentInput?.value);
    const acquirers = isPrepayment ? getPrepaymentAcquirers(settings) : [];

    if (acquirers.length < 2) {
      prepaymentAcquirerInfo.hidden = true;
      prepaymentAcquirerOptions.innerHTML = "";
      return;
    }

    const previouslyChecked = String(
      prepaymentAcquirerOptions.querySelector('input[name="prepaymentAcquirer"]:checked')?.value || ""
    );

    prepaymentAcquirerOptions.innerHTML = acquirers
      .map((acquirer, index) => `
        <label class="prepayment-acquirer-option">
          <input type="radio" name="prepaymentAcquirer" value="${acquirer.id}" ${
            (previouslyChecked ? previouslyChecked === acquirer.id : index === 0) ? "checked" : ""
          }>
          <span>${escapeHtml(acquirer.label)}</span>
        </label>
      `)
      .join("");

    prepaymentAcquirerInfo.hidden = false;
  };

  const resolvePrepaymentAcquirer = () => {
    const checked = String(
      prepaymentAcquirerOptions?.querySelector('input[name="prepaymentAcquirer"]:checked')?.value || ""
    );
    if (checked) return checked;
    return String(getPrepaymentAcquirers(settings)[0]?.id || "");
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
      updatePrepaymentAcquirerInfo();
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
      const selectedSize = String(item.size || "").trim().toUpperCase();
      const cartId = String(item.id || `${name}-${index}`).trim();
      const photo = String(item.image || "https://picsum.photos/seed/lavka-order-item/80/80").trim();
      const encodedCartId = encodeURIComponent(cartId);
      const atStockLimit = qty >= getAvailableStockForCartItem(item);

      return `
        <article class="cart-line">
          <div class="cart-line-main">
            <img class="cart-line-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(name)}">
            <div>
              <p class="cart-line-name">${escapeHtml(name)}</p>
              <p class="cart-line-meta">${formatPrice(unitPrice)} × ${qty}${selectedSize ? ` · Розмір ${escapeHtml(selectedSize)}` : ""}</p>
            </div>
          </div>
          <p class="cart-line-total">${formatPrice(lineTotal)}</p>
          <div class="cart-line-controls">
            <button type="button" class="cart-qty-btn" data-action="decrease" data-cart-id="${encodedCartId}" aria-label="Зменшити кількість">−</button>
            <span class="cart-line-qty">${qty}</span>
            <button type="button" class="cart-qty-btn" data-action="increase" data-cart-id="${encodedCartId}"${atStockLimit ? ' disabled aria-disabled="true" title="Досягнуто максимальний залишок"' : ""} aria-label="Збільшити кількість">+</button>
            <button type="button" class="cart-remove-btn" data-action="remove" data-cart-id="${encodedCartId}">Видалити</button>
          </div>
        </article>
      `;
    }).join("");
  };

  const baseCheckoutEnabled = () => {
    const { totalItems } = getCartTotals();
    return !isOrderingBlockedByPlanExpiry && !isOrdersDisabledByOwner && totalItems > 0 && shippingMethods.length > 0 && paymentMethods.length > 0;
  };

  const updateAvailabilityMessage = () => {
    if (!checkoutMessage) return;

    if (isOrdersDisabledByOwner) {
      checkoutMessage.classList.add("error");
      checkoutMessage.textContent = "Магазин тимчасово не приймає замовлення. Спробуйте пізніше.";
      return;
    }

    if (isOrderingBlockedByPlanExpiry) {
      checkoutMessage.classList.add("error");
      checkoutMessage.textContent = "Магазин тимчасово не приймає замовлення: строк дії тарифу завершився.";
      return;
    }

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
      checkoutMessage.textContent = "";
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

  const syncOrderLockUi = () => {
    isOrderingBlockedByPlanExpiry = hasExpiredSubscription();
    if (checkoutOrderStatusBadge) {
      checkoutOrderStatusBadge.hidden = !(isOrderingBlockedByPlanExpiry || isOrdersDisabledByOwner);
    }
    applyWatermarkVisibility();
  };

  // Дозволяє власнику вимкнути прийом замовлень для конкретного магазину
  // (додавання в кошик і перехід у чекаут лишаються доступними).
  const watchOwnerOrdersDisabledFlag = async () => {
    try {
      const storeId = await resolveStoreIdForNotify();
      if (!storeId || storeId === "default-store") return;
      if (!window.firebase || !firebase.apps || !firebase.apps.length) return;

      firebase.firestore().collection("stores_registry").doc(storeId).onSnapshot((snap) => {
        const data = snap.exists ? (snap.data() || {}) : {};
        isOrdersDisabledByOwner = data.ordersDisabled === true;
        syncOrderLockUi();
        updateSubmitState();
        updateAvailabilityMessage();
      }, (error) => {
        console.warn("[checkout] failed to watch ordersDisabled flag:", error);
      });
    } catch (error) {
      console.warn("[checkout] watchOwnerOrdersDisabledFlag failed:", error);
    }
  };

  syncOrderLockUi();
  watchOwnerOrdersDisabledFlag();
  updateCheckoutSummary();
  renderCartSummary();
  showPaymentReturnStatus();

  updateSubmitState();
  updateBankTransferInfo();
  updatePrepaymentAcquirerInfo();
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
        const current = Math.max(1, Number(cartState[index].qty) || 1);
        if (current < getAvailableStockForCartItem(cartState[index])) {
          cartState[index].qty = current + 1;
        }
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
    checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      syncOrderLockUi();

      if (isOrderingBlockedByPlanExpiry) {
        if (checkoutMessage) {
          checkoutMessage.classList.add("error");
          checkoutMessage.textContent = "Магазин тимчасово не приймає замовлення: строк дії тарифу завершився.";
        }
        updateSubmitState();
        return;
      }

      if (isOrdersDisabledByOwner) {
        if (checkoutMessage) {
          checkoutMessage.classList.add("error");
          checkoutMessage.textContent = "Магазин тимчасово не приймає замовлення. Спробуйте пізніше.";
        }
        updateSubmitState();
        return;
      }

      if (!baseCheckoutEnabled()) {
        return;
      }

      const unavailableItems = getUnavailableCartItems();
      if (unavailableItems.length) {
        if (checkoutMessage) {
          checkoutMessage.classList.add("error");
          const names = unavailableItems.map((item) => String(item?.name || "товар")).join(", ");
          checkoutMessage.textContent = `Немає в наявності: ${names}. Видаліть ці товари з кошика, щоб оформити замовлення.`;
        }
        return;
      }

      const overstockItems = getOverstockCartItems();
      if (overstockItems.length) {
        if (checkoutMessage) {
          checkoutMessage.classList.add("error");
          const names = overstockItems
            .map((item) => `${String(item?.name || "товар")} (доступно: ${getAvailableStockForCartItem(item)})`)
            .join(", ");
          checkoutMessage.textContent = `Недостатньо залишку: ${names}. Зменшіть кількість у кошику, щоб оформити замовлення.`;
        }
        return;
      }

      const nameValue = String(customerName?.value || "").trim();
      const phoneValue = String(customerPhone?.value || "").trim();
      const deliveryMethod = String(checkoutForm.querySelector('input[name="deliveryMethod"]:checked')?.value || "").trim();
      const selectedPaymentInput = checkoutForm.querySelector('input[name="paymentMethod"]:checked');
      const selectedPaymentValue = String(selectedPaymentInput?.value || "").trim();
      const selectedPaymentOptionId = String(selectedPaymentInput?.dataset?.optionId || "").trim();
      const selectedPaymentTitle = String(selectedPaymentInput?.dataset?.optionTitle || "").trim();
      const selectedPaymentMeta = paymentMethods.find((method) => {
        const methodId = String(method?.id || "").trim();
        const methodValue = String(method?.value || "").trim();
        return methodId === selectedPaymentValue
          || methodId === selectedPaymentOptionId
          || methodValue === selectedPaymentValue
          || methodValue === selectedPaymentTitle;
      }) || null;

      const paymentMethodId = String(
        selectedPaymentMeta?.id
        || selectedPaymentOptionId
        || selectedPaymentValue
        || ""
      ).trim();
      const paymentMethod = String(
        selectedPaymentMeta?.value
        || selectedPaymentTitle
        || selectedPaymentValue
        || ""
      ).trim();
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

      if (submitOrderBtn) {
        submitOrderBtn.disabled = true;
      }

      if (typeof window.lavkaCheckActionRateLimit === "function") {
        const storeIdForLimit = await resolveStoreIdForNotify();
        const rateLimit = await window.lavkaCheckActionRateLimit("create-order", storeIdForLimit);
        if (!rateLimit.ok) {
          if (submitOrderBtn) {
            submitOrderBtn.disabled = false;
          }
          if (checkoutMessage) {
            checkoutMessage.classList.add("error");
            checkoutMessage.textContent = "Забагато спроб оформити замовлення. Спробуйте ще раз через хвилину.";
          }
          return;
        }
      }

      const { totalAmount, promoDiscount } = getCartTotals();
      const payableAmount = getPayableAmount();
      const prepaymentAmount = isPrepaymentMethod(paymentMethod) ? payableAmount : 0;

      const orderItems = cartState.map((item) => ({
        photo: String(item.image || "https://picsum.photos/seed/lavka-order-item/80/80"),
        sku: String(item.sku || item.id || "-"),
        name: String(item.name || "Товар"),
        price: Math.max(0, Number(item.price) || 0),
        qty: Math.max(1, Number(item.qty) || 1),
        size: String(item.size || "").trim().toUpperCase()
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
        status: "Нове",
        paymentStatus: "Не оплачено",
        trackingNumber: "",
        total: totalAmount,
        payableNow: payableAmount,
        prepaymentAmount,
        discount: promoDiscount,
        promoCode: appliedPromo?.code || "",
        promoDiscount,
        inventoryApplied: false,
        paymentMethodId,
        paymentMethod,
        items: orderItems
      };

      // "Передоплата" has no acquirer of its own — it routes to whichever acquirer the owner selected in admin.
      const isPrepaymentSelected = isPrepaymentMethod(paymentMethodId) || isPrepaymentMethod(paymentMethod);
      const prepaymentAcquirerId = isPrepaymentSelected ? resolvePrepaymentAcquirer() : "";

      const selectedMonoPayment = isMonoPaymentMethodById(paymentMethodId)
        || isMonoPaymentMethod(paymentMethod)
        || (isPrepaymentSelected && prepaymentAcquirerId === "mono");
      if (selectedMonoPayment) {
        if (submitOrderBtn) {
          submitOrderBtn.disabled = true;
        }

        if (checkoutMessage) {
          checkoutMessage.classList.remove("error");
          checkoutMessage.textContent = "Створюємо платіж mono...";
        }

        try {
          const invoice = await createMonoInvoiceForOrder(nextOrder);
          if (!invoice.pageUrl) {
            throw new Error("mono-invalid-response");
          }

          nextOrder.paymentStatus = "Очікує оплати";
          nextOrder.monoInvoiceId = invoice.invoiceId;
          nextOrder.monoStatus = "created";
          nextOrder.monoPageUrl = invoice.pageUrl;
          nextOrder.updatedAt = new Date().toISOString();

          const orders = readOrders();
          saveOrders([nextOrder, ...orders]);
          cartState = [];
          saveCart(cartState);

          void sendOrderTelegramNotification(nextOrder);

          if (checkoutMessage) {
            checkoutMessage.classList.remove("error");
            checkoutMessage.textContent = "Перенаправляємо на оплату mono...";
          }

          window.location.href = invoice.pageUrl;
          return;
        } catch (error) {
          if (checkoutMessage) {
            checkoutMessage.classList.add("error");
            checkoutMessage.textContent = mapMonoCreateErrorMessage(error && error.message);
          }
          updateSubmitState();
          return;
        }
      }

      const selectedLiqpayPayment = isLiqpayPaymentMethodById(paymentMethodId)
        || isLiqpayPaymentMethod(paymentMethod)
        || (isPrepaymentSelected && prepaymentAcquirerId === "liqpay");
      if (selectedLiqpayPayment) {
        if (submitOrderBtn) {
          submitOrderBtn.disabled = true;
        }

        if (checkoutMessage) {
          checkoutMessage.classList.remove("error");
          checkoutMessage.textContent = "Створюємо платіж LiqPay...";
        }

        try {
          const invoice = await createLiqpayInvoiceForOrder(nextOrder);
          if (!invoice.pageUrl) {
            throw new Error("liqpay-invalid-response");
          }

          nextOrder.paymentStatus = "Очікує оплати";
          nextOrder.liqpayInvoiceId = invoice.invoiceId;
          nextOrder.liqpayStatus = "created";
          nextOrder.liqpayPageUrl = invoice.pageUrl;
          nextOrder.updatedAt = new Date().toISOString();

          const orders = readOrders();
          saveOrders([nextOrder, ...orders]);
          cartState = [];
          saveCart(cartState);

          void sendOrderTelegramNotification(nextOrder);

          if (checkoutMessage) {
            checkoutMessage.classList.remove("error");
            checkoutMessage.textContent = "Перенаправляємо на оплату LiqPay...";
          }

          window.location.href = invoice.pageUrl;
          return;
        } catch (error) {
          if (checkoutMessage) {
            checkoutMessage.classList.add("error");
            checkoutMessage.textContent = mapLiqpayCreateErrorMessage(error && error.message);
          }
          updateSubmitState();
          return;
        }
      }

      const orders = readOrders();
      saveOrders([nextOrder, ...orders]);
      cartState = [];
      saveCart(cartState);

      void sendOrderTelegramNotification(nextOrder);

      if (checkoutMessage) {
        checkoutMessage.classList.remove("error");
        checkoutMessage.textContent = "Замовлення оформлено. Дякуємо!";
      }

      setTimeout(() => {
        window.location.href = `thank-you.html?order=${encodeURIComponent(nextOrder.id)}`;
      }, 800);
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "lavkaBilling") {
      syncOrderLockUi();
      updateSubmitState();
      updateAvailabilityMessage();
      return;
    }

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
    syncOrderLockUi();
    updateSubmitState();
    updateBankTransferInfo();
    updatePrepaymentAcquirerInfo();
    updateAvailabilityMessage();
  });

  // Debug helper: call from browser console to fetch invoice status and update local orders immediately.
  window.fetchInvoiceAndUpdate = async function ({ invoiceId = "", orderId = "" } = {}) {
    try {
      const orders = readOrders() || [];
      const queryByInvoice = String(invoiceId || "").trim();
      const queryByOrder = String(orderId || "").trim();
      if (!queryByInvoice && !queryByOrder) {
        console.debug('[checkout] fetchInvoiceAndUpdate missing invoiceId/orderId');
        return { ok: false, error: 'missing_invoice_or_order_id' };
      }

      const url = queryByInvoice
        ? `https://us-central1-lavka-shop.cloudfunctions.net/getStoreOrderInvoiceStatus?invoiceId=${encodeURIComponent(queryByInvoice)}`
        : `https://us-central1-lavka-shop.cloudfunctions.net/getStoreOrderInvoiceStatus?orderId=${encodeURIComponent(queryByOrder)}`;

      console.debug('[checkout] fetchInvoiceAndUpdate url=', url);
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json().catch(() => null);
      console.debug('[checkout] fetchInvoiceAndUpdate response=', data);
      if (!data || !data.ok) return { ok: false, error: 'not_found' };

      // find matching order(s) and update
      const targetOrderId = String(data.orderId || queryByOrder || "").trim();
      for (let i = 0; i < orders.length; i += 1) {
        const o = orders[i] || {};
        if (!targetOrderId) continue;
        if (String(o.id || "") !== targetOrderId) continue;
        const newStatus = String(data.status || "").trim().toLowerCase();
        const paymentStatus = (newStatus === "success") ? "Оплачено" : ((newStatus === "failure" || newStatus === "expired") ? "Не оплачено" : o.paymentStatus || "Не оплачено");
        orders[i] = {
          ...o,
          paymentStatus,
          monoStatus: String(data.monoStatus || o.monoStatus || ""),
          monoInvoiceId: String(data.invoiceId || o.monoInvoiceId || ""),
          monoPageUrl: String(data.pageUrl || o.monoPageUrl || ""),
          updatedAt: new Date().toISOString()
        };
      }

      saveOrders(orders);
      return { ok: true, data };
    } catch (err) {
      console.debug('[checkout] fetchInvoiceAndUpdate error', err);
      return { ok: false, error: 'internal' };
    }
  };

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
    syncOrderLockUi();
    updateSubmitState();
    updateBankTransferInfo();
    updatePrepaymentAcquirerInfo();
    updateAvailabilityMessage();
  };

  window.addEventListener("focus", refreshFromSettings);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshFromSettings();
    }
  });

  document.body.classList.remove("lavka-booting");
});
