const PRODUCTS = {
  terra: {
    name: 'Чашка "Терра"',
    sku: "LK-CUP-001",
    price: 420,
    category: "cups",
    description: "Тепла фактура натуральної глини, комфортна ручка і матова глазур. Ідеальна для ранкової кави або чаю.",
    images: [
      "https://picsum.photos/seed/terra-cup/900/900",
      "https://picsum.photos/seed/terra-cup-detail-1/700/700",
      "https://picsum.photos/seed/terra-cup-detail-2/700/700",
      "https://picsum.photos/seed/terra-cup-detail-3/700/700"
    ]
  },
  hvylia: {
    name: 'Тарілка "Хвиля"',
    sku: "LK-PLT-002",
    price: 560,
    category: "plates",
    description: "Плавний органічний край і легкий рельєф, який красиво підкреслює подачу страв.",
    images: [
      "https://picsum.photos/seed/hvylia-plate/900/900",
      "https://picsum.photos/seed/hvylia-plate-detail-1/700/700",
      "https://picsum.photos/seed/hvylia-plate-detail-2/700/700",
      "https://picsum.photos/seed/hvylia-plate-detail-3/700/700"
    ]
  },
  hai: {
    name: 'Ваза "Гай"',
    sku: "LK-VAS-003",
    price: 890,
    category: "vases",
    description: "Компактна декоративна ваза з м'яким силуетом. Добре пасує для сухоцвітів і мінімалістичного інтер'єру.",
    images: [
      "https://picsum.photos/seed/gai-vase/900/900",
      "https://picsum.photos/seed/gai-vase-detail-1/700/700",
      "https://picsum.photos/seed/gai-vase-detail-2/700/700",
      "https://picsum.photos/seed/gai-vase-detail-3/700/700"
    ]
  },
  duet: {
    name: 'Набір "Дует"',
    sku: "LK-SET-004",
    price: 1250,
    category: "cups",
    description: "Пара чашок для затишних вечорів. У комплекті дві різні за відтінком, але гармонійні форми.",
    images: [
      "https://picsum.photos/seed/duet-set/900/900",
      "https://picsum.photos/seed/duet-set-detail-1/700/700",
      "https://picsum.photos/seed/duet-set-detail-2/700/700",
      "https://picsum.photos/seed/duet-set-detail-3/700/700"
    ]
  },
  sonce: {
    name: 'Декоративна тарілка "Сонце"',
    sku: "LK-DEC-005",
    price: 640,
    category: "decor",
    description: "Акцентна декоративна тарілка для стіни або полички. Додає тепло і характер простору.",
    images: [
      "https://picsum.photos/seed/sonce-plate/900/900",
      "https://picsum.photos/seed/sonce-plate-detail-1/700/700",
      "https://picsum.photos/seed/sonce-plate-detail-2/700/700",
      "https://picsum.photos/seed/sonce-plate-detail-3/700/700"
    ]
  },
  kraplia: {
    name: 'Ваза "Крапля"',
    sku: "LK-VAS-006",
    price: 760,
    category: "vases",
    description: "Витягнута форма і делікатний блиск глазурі створюють відчуття легкості та руху.",
    images: [
      "https://picsum.photos/seed/krapla-vase/900/900",
      "https://picsum.photos/seed/krapla-vase-detail-1/700/700",
      "https://picsum.photos/seed/krapla-vase-detail-2/700/700",
      "https://picsum.photos/seed/krapla-vase-detail-3/700/700"
    ]
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const SETTINGS_KEY = "lavkaStoreSettings";
  const PRODUCTS_KEY = "lavkaProducts";
  const CART_KEY = "lavkaCart";
  const VISITOR_ID_KEY = "lavkaVisitorId";
  const VISITOR_EVENTS_KEY = "lavkaVisitEvents";
  const VISITOR_EVENT_RETENTION_DAYS = 180;
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const productId = hashParams.get("id") || params.get("id") || "terra";
  const fromCategory = hashParams.get("cat") || params.get("cat") || "all";
  const readProducts = () => {
    try {
      const raw = localStorage.getItem(PRODUCTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const findProductFromAdmin = (id, fallbackProduct) => {
    const products = readProducts();
    const byId = products.find((item) => String(item?.id || "").trim() === String(id || "").trim());
    if (byId) return byId;

    const fallbackSku = String(fallbackProduct?.sku || "").trim().toUpperCase();
    if (!fallbackSku) return null;
    return products.find((item) => String(item?.sku || "").trim().toUpperCase() === fallbackSku) || null;
  };

  const fallbackProduct = PRODUCTS[productId] || PRODUCTS.terra;
  const adminProduct = findProductFromAdmin(productId, fallbackProduct);
  const product = {
    ...fallbackProduct,
    name: String(adminProduct?.name || fallbackProduct.name || "Товар").trim(),
    sku: String(adminProduct?.sku || fallbackProduct.sku || "").trim(),
    price: Number.isFinite(Number(adminProduct?.price)) ? Number(adminProduct.price) : fallbackProduct.price,
    description: String(adminProduct?.description || fallbackProduct.description || "").trim(),
    sizes: Array.isArray(adminProduct?.sizes)
      ? adminProduct.sizes.map((size) => String(size || "").trim().toUpperCase()).filter(Boolean)
      : [],
    isClothing: Boolean(adminProduct?.isClothing),
    images: Array.isArray(fallbackProduct.images) ? fallbackProduct.images : []
  };

  const readSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
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

  const readVisitEvents = () => {
    try {
      const raw = localStorage.getItem(VISITOR_EVENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const generateVisitorId = () => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const getOrCreateVisitorId = () => {
    const existing = String(localStorage.getItem(VISITOR_ID_KEY) || "").trim();
    if (existing) return existing;
    const nextId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, nextId);
    return nextId;
  };

  const trackVisit = () => {
    const now = Date.now();
    const retentionStart = now - (VISITOR_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const visitorId = getOrCreateVisitorId();

    const nextEvents = readVisitEvents()
      .filter((event) => Number.isFinite(Number(event?.timestamp)) && Number(event.timestamp) >= retentionStart)
      .map((event) => ({
        timestamp: Number(event.timestamp),
        visitorId: String(event.visitorId || "").trim()
      }))
      .filter((event) => event.visitorId.length > 0);

    nextEvents.push({
      timestamp: now,
      visitorId
    });

    localStorage.setItem(VISITOR_EVENTS_KEY, JSON.stringify(nextEvents));
  };

  trackVisit();

  const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(value || "");
  const hexToRgb = (hex) => {
    const normalized = hex.replace("#", "");
    const intValue = Number.parseInt(normalized, 16);
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255
    };
  };

  const savedSettings = readSettings();
  const activeCurrency = normalizeCurrencyCode(savedSettings?.currency || "uah");
  if (savedSettings) {
    const backgroundType = savedSettings.siteBackgroundType === "image" ? "image" : "color";
    const backgroundColor = isHexColor(savedSettings.siteBackgroundColor) ? savedSettings.siteBackgroundColor : "#eef1f4";
    const backgroundImage = String(savedSettings.siteBackgroundImage || "").trim();
    const productPage = document.querySelector(".product-page");
    const hasCustomBackground = Boolean(String(savedSettings.siteBackgroundColor || "").trim()) || (backgroundType === "image" && backgroundImage.length > 0);

    document.body.style.backgroundColor = "";
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundRepeat = "repeat";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundSize = "auto";

    if (productPage) {
      productPage.classList.toggle("custom-background", hasCustomBackground);
      productPage.style.backgroundColor = backgroundColor;
      if (backgroundType === "image" && backgroundImage) {
        productPage.style.backgroundImage = `linear-gradient(rgba(17, 24, 39, 0.22), rgba(17, 24, 39, 0.22)), url("${backgroundImage}")`;
        productPage.style.backgroundRepeat = "no-repeat";
        productPage.style.backgroundPosition = "center";
        productPage.style.backgroundSize = "cover";
      } else {
        productPage.style.backgroundImage = "none";
        productPage.style.backgroundRepeat = "repeat";
        productPage.style.backgroundPosition = "center";
        productPage.style.backgroundSize = "auto";
      }
    }

    document.body.style.backgroundImage = "none";

    if (isHexColor(savedSettings.siteColor)) {
      const rgb = hexToRgb(savedSettings.siteColor);
      document.documentElement.style.setProperty("--site-accent", savedSettings.siteColor);
      document.documentElement.style.setProperty("--site-accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
      document.documentElement.style.setProperty("--site-accent-deep", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92)`);
    }
  }

  const mainImage = document.getElementById("mainImage");
  const photoFullscreen = document.getElementById("photoFullscreen");
  const photoFullscreenBackdrop = document.getElementById("photoFullscreenBackdrop");
  const photoFullscreenClose = document.getElementById("photoFullscreenClose");
  const photoFullscreenImage = document.getElementById("photoFullscreenImage");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const productName = document.getElementById("productName");
  const productSku = document.getElementById("productSku");
  const productPrice = document.getElementById("productPrice");
  const productDescription = document.getElementById("productDescription");
  const productSizesBlock = document.getElementById("productSizesBlock");
  const productSizesList = document.getElementById("productSizesList");
  const productSizesHint = document.getElementById("productSizesHint");
  const backToCategory = document.getElementById("backToCategory");
  const openCartLinkBtn = document.getElementById("openCartLinkBtn");
  const copyProductLinkBtn = document.getElementById("copyProductLinkBtn");
  const productCartCountBadge = document.getElementById("productCartCountBadge");
  const productCartOverlay = document.getElementById("productCartOverlay");
  const productCartDrawer = document.getElementById("productCartDrawer");
  const closeProductCartBtn = document.getElementById("closeProductCartBtn");
  const productCartItems = document.getElementById("productCartItems");
  const productCartTotal = document.getElementById("productCartTotal");
  const productCartMinimumHint = document.getElementById("productCartMinimumHint");
  const productCheckoutCartBtn = document.getElementById("productCheckoutCartBtn");
  const productClearCartBtn = document.getElementById("productClearCartBtn");

  let selectedSize = "";

  const hasSizesEnabled = Boolean(product.isClothing && Array.isArray(product.sizes) && product.sizes.length);

  const readCartState = () => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveCartState = (items) => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  };

  const getCartItemsCount = () => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return 0;
      return parsed.reduce((sum, item) => sum + Math.max(0, Number(item?.qty) || 0), 0);
    } catch {
      return 0;
    }
  };

  const renderProductCartBadge = () => {
    if (!productCartCountBadge) return;
    productCartCountBadge.textContent = String(getCartItemsCount());
  };

  const toCurrency = (value) => {
    const amount = Math.round((Math.max(0, Number(value) || 0)) * 100) / 100;
    const formatter = new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2
    });
    return `${formatter.format(amount)} ${getCurrencyLabel(activeCurrency)}`;
  };

  const getMinimumOrderRequirement = () => {
    const settings = readSettings() || {};
    const enabled = Boolean(settings.minimumOrderEnabled);
    const rawAmount = Number(settings.minimumOrderAmount);
    const minimumAmount = Number.isFinite(rawAmount) && rawAmount > 0
      ? Math.round(rawAmount * 100) / 100
      : 0;
    return {
      enabled,
      minimumAmount
    };
  };

  const setProductCartOpen = (open) => {
    if (!productCartDrawer || !productCartOverlay) return;
    productCartDrawer.classList.toggle("open", open);
    productCartOverlay.classList.toggle("open", open);
    productCartDrawer.setAttribute("aria-hidden", open ? "false" : "true");
    productCartOverlay.setAttribute("aria-hidden", open ? "false" : "true");
  };

  const animateAddToCart = () => {
    if (!mainImage || !openCartLinkBtn) return;

    const source = mainImage.getBoundingClientRect();
    const target = openCartLinkBtn.getBoundingClientRect();
    if (!source.width || !source.height || !target.width || !target.height) return;

    const clone = mainImage.cloneNode(true);
    clone.className = "product-cart-fly-image";
    clone.style.left = `${source.left}px`;
    clone.style.top = `${source.top}px`;
    clone.style.width = `${source.width}px`;
    clone.style.height = `${source.height}px`;

    const dx = (target.left + target.width / 2) - (source.left + source.width / 2);
    const dy = (target.top + target.height / 2) - (source.top + source.height / 2);
    clone.style.setProperty("--fly-x", `${dx}px`);
    clone.style.setProperty("--fly-y", `${dy}px`);

    document.body.appendChild(clone);
    clone.addEventListener("animationend", () => {
      clone.remove();
      openCartLinkBtn.classList.remove("bump");
      void openCartLinkBtn.offsetWidth;
      openCartLinkBtn.classList.add("bump");
    }, { once: true });
  };

  let photoZoomLevel = 1;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.25;

  const applyPhotoZoom = () => {
    if (!photoFullscreenImage) return;
    photoFullscreenImage.style.transform = `scale(${photoZoomLevel})`;
  };

  const setPhotoFullscreenOpen = (open) => {
    if (!photoFullscreen || !photoFullscreenImage || !mainImage) return;
    photoFullscreen.classList.toggle("open", open);
    photoFullscreen.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      photoZoomLevel = 1;
      photoFullscreenImage.src = mainImage.src;
      photoFullscreenImage.alt = mainImage.alt || "Фото товару";
      applyPhotoZoom();
    }
  };

  const changePhotoZoom = (delta) => {
    photoZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, photoZoomLevel + delta));
    applyPhotoZoom();
  };

  const renderProductCart = () => {
    if (!productCartItems || !productCartTotal) return;

    const cartState = readCartState();
    if (!cartState.length) {
      productCartItems.innerHTML = '<p class="product-cart-empty">Кошик порожній. Додайте товари з вітрини.</p>';
    } else {
      productCartItems.innerHTML = cartState.map((item) => `
        <article class="product-cart-item" data-cart-id="${item.id}">
          <button type="button" class="product-cart-item-remove" aria-label="Видалити товар з кошика" title="Видалити">×</button>
          <img src="${item.image}" alt="${item.name}">
          <div class="product-cart-item-meta">
            <p class="product-cart-item-name">${item.name}${item.size ? ` (${item.size})` : ""}</p>
            <p class="product-cart-item-price">${toCurrency(item.price)}</p>
          </div>
          <div class="product-cart-item-controls">
            <button type="button" class="product-cart-qty-minus" aria-label="Зменшити кількість">-</button>
            <span class="product-cart-item-qty">${item.qty}</span>
            <button type="button" class="product-cart-qty-plus" aria-label="Збільшити кількість">+</button>
          </div>
        </article>
      `).join("");
    }

    const totalItems = cartState.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalAmount = cartState.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    const minimumRequirement = getMinimumOrderRequirement();
    const isMinimumActive = minimumRequirement.enabled && minimumRequirement.minimumAmount > 0;
    const minimumLeft = Math.max(0, minimumRequirement.minimumAmount - totalAmount);
    const minimumReached = !isMinimumActive || minimumLeft <= 0;

    productCartTotal.textContent = toCurrency(totalAmount);

    if (productCartMinimumHint) {
      if (isMinimumActive && totalItems > 0 && !minimumReached) {
        productCartMinimumHint.hidden = false;
        productCartMinimumHint.textContent = `До мінімальної суми замовлення залишилось ${toCurrency(minimumLeft)}.`;
      } else {
        productCartMinimumHint.hidden = true;
        productCartMinimumHint.textContent = "";
      }
    }

    if (productCheckoutCartBtn) {
      const blockedByMinimum = totalItems > 0 && !minimumReached;
      const shouldDisableCheckout = totalItems === 0 || blockedByMinimum;
      productCheckoutCartBtn.disabled = shouldDisableCheckout;
      productCheckoutCartBtn.setAttribute("aria-disabled", shouldDisableCheckout ? "true" : "false");
    }

    renderProductCartBadge();
  };

  const renderSizeOptions = () => {
    if (!productSizesBlock || !productSizesList) return;
    if (!hasSizesEnabled) {
      productSizesBlock.hidden = true;
      productSizesList.innerHTML = "";
      return;
    }

    productSizesBlock.hidden = false;
    productSizesList.innerHTML = product.sizes
      .map((size) => `<button type=\"button\" class=\"size-option-btn\" data-size=\"${size}\">${size}</button>`)
      .join("");
  };

  productName.textContent = product.name;
  productSku.textContent = product.sku;
  productPrice.textContent = `${product.price} ${getCurrencyLabel(activeCurrency)}`;
  productDescription.textContent = product.description;
  mainImage.src = product.images[0];
  mainImage.alt = product.name;
  document.title = `${product.name} — Lavka Keramiky`;

  if (mainImage) {
    mainImage.addEventListener("click", () => setPhotoFullscreenOpen(true));
  }

  if (photoFullscreenBackdrop) {
    photoFullscreenBackdrop.addEventListener("click", () => setPhotoFullscreenOpen(false));
  }

  if (photoFullscreenClose) {
    photoFullscreenClose.addEventListener("click", () => setPhotoFullscreenOpen(false));
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => changePhotoZoom(ZOOM_STEP));
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => changePhotoZoom(-ZOOM_STEP));
  }

  if (photoFullscreenImage) {
    photoFullscreenImage.addEventListener("wheel", (event) => {
      event.preventDefault();
      changePhotoZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    }, { passive: false });
  }

  backToCategory.href = `index.html#cat=${encodeURIComponent(fromCategory)}`;

  if (openCartLinkBtn) {
    openCartLinkBtn.addEventListener("click", () => {
      renderProductCart();
      setProductCartOpen(true);
    });
  }

  const copyTextToClipboard = async (value) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  };

  if (copyProductLinkBtn) {
    const defaultCopyIcon = copyProductLinkBtn.innerHTML;
    const successCopyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M20 7 10 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    let copyResetTimer = null;

    copyProductLinkBtn.addEventListener("click", async () => {
      const url = window.location.href;
      try {
        await copyTextToClipboard(url);
        if (copyResetTimer) {
          clearTimeout(copyResetTimer);
          copyResetTimer = null;
        }

        copyProductLinkBtn.innerHTML = successCopyIcon;
        copyProductLinkBtn.classList.add("copied");
        copyProductLinkBtn.setAttribute("title", "Посилання скопійовано");
        copyResetTimer = setTimeout(() => {
          copyProductLinkBtn.innerHTML = defaultCopyIcon;
          copyProductLinkBtn.classList.remove("copied");
          copyProductLinkBtn.setAttribute("title", "Скопіювати посилання на товар");
          copyResetTimer = null;
        }, 1100);
      } catch {
        copyProductLinkBtn.setAttribute("title", "Не вдалося скопіювати");
      }
    });
  }

  if (closeProductCartBtn) {
    closeProductCartBtn.addEventListener("click", () => setProductCartOpen(false));
  }

  if (productCartOverlay) {
    productCartOverlay.addEventListener("click", () => setProductCartOpen(false));
  }

  if (productClearCartBtn) {
    productClearCartBtn.addEventListener("click", () => {
      saveCartState([]);
      renderProductCart();
    });
  }

  if (productCheckoutCartBtn) {
    productCheckoutCartBtn.addEventListener("click", () => {
      const cartState = readCartState();
      if (!cartState.length) return;

      const { enabled, minimumAmount } = getMinimumOrderRequirement();
      if (enabled && minimumAmount > 0) {
        const totalAmount = cartState.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
        if (totalAmount < minimumAmount) {
          renderProductCart();
          return;
        }
      }

      window.location.href = "checkout.html";
    });
  }

  if (productCartItems) {
    productCartItems.addEventListener("click", (event) => {
      const row = event.target.closest(".product-cart-item");
      if (!row) return;

      const itemId = String(row.dataset.cartId || "").trim();
      const cartState = readCartState();
      const item = cartState.find((entry) => String(entry.id || "").trim() === itemId);
      if (!item) return;

      if (event.target.closest(".product-cart-qty-plus")) {
        item.qty = (Number(item.qty) || 0) + 1;
      }

      if (event.target.closest(".product-cart-qty-minus")) {
        item.qty = (Number(item.qty) || 0) - 1;
      }

      if (event.target.closest(".product-cart-item-remove")) {
        item.qty = 0;
      }

      const nextState = cartState.filter((entry) => (Number(entry.qty) || 0) > 0);
      saveCartState(nextState);
      renderProductCart();
    });
  }

  renderProductCart();
  renderProductCartBadge();

  window.addEventListener("storage", (event) => {
    if (event.key !== CART_KEY) return;
    renderProductCart();
    renderProductCartBadge();
  });

  renderSizeOptions();

  if (productSizesList) {
    productSizesList.addEventListener("click", (event) => {
      const button = event.target.closest(".size-option-btn");
      if (!button) return;
      selectedSize = String(button.dataset.size || "").trim().toUpperCase();
      productSizesList.querySelectorAll(".size-option-btn").forEach((node) => {
        node.classList.toggle("active", node === button);
      });
      if (productSizesHint) {
        productSizesHint.hidden = true;
      }
    });
  }

  const qtyInput = document.getElementById("qtyInput");
  const minusQty = document.getElementById("minusQty");
  const plusQty = document.getElementById("plusQty");
  const addToCart = document.getElementById("addToCart");

  const normalizeQty = () => {
    const parsed = Number.parseInt(qtyInput.value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      qtyInput.value = "1";
      return 1;
    }
    qtyInput.value = String(parsed);
    return parsed;
  };

  minusQty.addEventListener("click", () => {
    const current = normalizeQty();
    qtyInput.value = String(Math.max(1, current - 1));
  });

  plusQty.addEventListener("click", () => {
    const current = normalizeQty();
    qtyInput.value = String(current + 1);
  });

  qtyInput.addEventListener("change", normalizeQty);

  addToCart.addEventListener("click", () => {
    if (hasSizesEnabled && !selectedSize) {
      if (productSizesHint) {
        productSizesHint.hidden = false;
      }
      return;
    }

    const quantity = normalizeQty();

    const cartState = readCartState();

    const cartItemKey = hasSizesEnabled
      ? `${productId}::${selectedSize}`
      : String(productId || product.sku || product.name);
    const existing = cartState.find((item) => String(item.id || "").trim() === cartItemKey);

    if (existing) {
      existing.qty = Math.max(1, Number(existing.qty) || 1) + quantity;
      if (hasSizesEnabled) {
        existing.size = selectedSize;
      }
    } else {
      cartState.push({
        id: cartItemKey,
        sku: product.sku,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.images[0] || "",
        qty: quantity,
        ...(hasSizesEnabled ? { size: selectedSize } : {})
      });
    }

    saveCartState(cartState);
    animateAddToCart();
    renderProductCart();
    renderProductCartBadge();

    addToCart.classList.add("added");
    addToCart.textContent = hasSizesEnabled
      ? `Додано: ${quantity} (${selectedSize})`
      : `Додано: ${quantity}`;
    setTimeout(() => {
      addToCart.classList.remove("added");
      addToCart.textContent = "Додати в кошик";
    }, 1200);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setProductCartOpen(false);
      setPhotoFullscreenOpen(false);
    }

    if (photoFullscreen?.classList.contains("open")) {
      if (event.key === "+" || event.key === "=") {
        changePhotoZoom(ZOOM_STEP);
      }
      if (event.key === "-") {
        changePhotoZoom(-ZOOM_STEP);
      }
    }
  });
});
