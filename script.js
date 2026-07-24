document.addEventListener("DOMContentLoaded", () => {
  const SETTINGS_KEY = "lavkaStoreSettings";
  const CATEGORIES_KEY = "lavkaCategories";
  const CART_KEY = "lavkaCart";
  const VISITOR_ID_KEY = "lavkaVisitorId";
  const VISITOR_EVENTS_KEY = "lavkaVisitEvents";
  const VISITOR_EVENT_RETENTION_DAYS = 180;
  const MAX_DESCRIPTION_LENGTH = 140;
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
  const categoriesNav = document.querySelector(".categories");
  const products = document.querySelectorAll(".product");
  const openCartBtn = document.getElementById("openCartBtn");
  const closeCartBtn = document.getElementById("closeCartBtn");
  const cartOverlay = document.getElementById("cartOverlay");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  const cartCountBadge = document.getElementById("cartCountBadge");
  const clearCartBtn = document.getElementById("clearCartBtn");
  const checkoutCartBtn = document.getElementById("checkoutCartBtn");
  const cartMinimumHint = document.getElementById("cartMinimumHint");
  const photoViewer = document.getElementById("photoViewer");
  const photoViewerImage = document.getElementById("photoViewerImage");
  const photoViewerCaption = document.getElementById("photoViewerCaption");
  const photoViewerClose = document.getElementById("photoViewerClose");
  const photoViewerBackdrop = document.getElementById("photoViewerBackdrop");
  const photoPrevBtn = document.getElementById("photoPrevBtn");
  const photoNextBtn = document.getElementById("photoNextBtn");
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const shouldOpenCartFromHash = hashParams.get("openCart") === "1";
  const galleryItems = [...products].map((product, index) => ({
    index,
    node: product,
    image: product.querySelector(".thumb img")?.src || "",
    name: String(product.querySelector(".p-name")?.textContent || "Товар").trim()
  })).filter((item) => item.image);
  let activePhotoIndex = -1;

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

  let cartState = readCart();

  const resolveCategoryToken = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "";
    if (normalized === "all" || normalized === "все") return "all";
    if (/cups|чашк/.test(normalized)) return "cups";
    if (/plates|таріл/.test(normalized)) return "plates";
    if (/vases|ваз/.test(normalized)) return "vases";
    if (/decor|декор/.test(normalized)) return "decor";
    return normalized
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}-]+/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const readCategories = () => {
    try {
      const raw = localStorage.getItem(CATEGORIES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
          .map((entry) => String(entry?.name || "").trim())
          .filter(Boolean)
        : [];
    } catch {
      return [];
    }
  };

  const buildCategoryButtons = () => {
    if (!categoriesNav) return;

    const categoryNames = readCategories();
    const fallback = ["Чашки", "Тарілки", "Вази", "Декор"];
    const names = categoryNames.length ? categoryNames : fallback;
    const usedTokens = new Set(["all"]);

    const items = names.map((name) => {
      const token = resolveCategoryToken(name);
      if (!token || usedTokens.has(token)) return null;
      usedTokens.add(token);
      return { name, token };
    }).filter(Boolean);

    categoriesNav.innerHTML = [
      '<button class="cat-btn active" data-cat="all">Все</button>',
      ...items.map((item) => `<button class="cat-btn" data-cat="${item.token}">${item.name}</button>`)
    ].join("");
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

  const readSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
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

  const toCurrency = (value) => {
    const settings = readSettings() || {};
    const amount = Math.round((Math.max(0, Number(value) || 0)) * 100) / 100;
    const formatter = new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2
    });
    return `${formatter.format(amount)} ${getCurrencyLabel(normalizeCurrencyCode(settings.currency || "uah"))}`;
  };

  const applyStorefrontCurrencyLabels = () => {
    document.querySelectorAll(".p-price").forEach((priceNode) => {
      const raw = String(priceNode.textContent || "");
      const numeric = Number.parseFloat(raw.replace(/[^\d.,]/g, "").replace(",", "."));
      if (!Number.isFinite(numeric)) return;
      priceNode.textContent = toCurrency(numeric);
    });
  };

  const setCartOpen = (open) => {
    if (!cartDrawer || !cartOverlay) return;
    cartDrawer.classList.toggle("open", open);
    cartOverlay.classList.toggle("open", open);
    cartDrawer.setAttribute("aria-hidden", open ? "false" : "true");
    cartOverlay.setAttribute("aria-hidden", open ? "false" : "true");
  };

  const setPhotoViewerOpen = (open) => {
    if (!photoViewer) return;
    photoViewer.classList.toggle("open", open);
    photoViewer.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("photo-viewer-open", open);
  };

  const renderPhotoViewer = () => {
    if (!photoViewerImage || !photoViewerCaption) return;
    const item = galleryItems[activePhotoIndex];
    if (!item) return;
    photoViewerImage.src = item.image;
    photoViewerImage.alt = item.name;
    photoViewerCaption.textContent = item.name;
  };

  const openPhotoViewerByProduct = (productNode) => {
    const index = galleryItems.findIndex((item) => item.node === productNode);
    if (index === -1) return;
    activePhotoIndex = index;
    renderPhotoViewer();
    setPhotoViewerOpen(true);
  };

  const shiftPhoto = (delta) => {
    if (!galleryItems.length) return;
    activePhotoIndex = (activePhotoIndex + delta + galleryItems.length) % galleryItems.length;
    renderPhotoViewer();
  };

  const animateAddToCart = (productNode) => {
    const thumbImage = productNode?.querySelector(".thumb img");
    if (!thumbImage || !openCartBtn) return;

    const source = thumbImage.getBoundingClientRect();
    const target = openCartBtn.getBoundingClientRect();
    if (!source.width || !source.height || !target.width || !target.height) return;

    const clone = thumbImage.cloneNode(true);
    clone.className = "cart-fly-image";
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
      openCartBtn.classList.remove("bump");
      void openCartBtn.offsetWidth;
      openCartBtn.classList.add("bump");
    }, { once: true });
  };

  const renderCart = () => {
    if (!cartItems || !cartTotal || !cartCountBadge) return;

    if (!cartState.length) {
      cartItems.innerHTML = '<p class="cart-empty">Кошик порожній. Додайте товари з вітрини.</p>';
    } else {
      cartItems.innerHTML = cartState.map((item) => `
        <article class="cart-item" data-cart-id="${item.id}">
          <button type="button" class="cart-item-remove" aria-label="Видалити товар з кошика" title="Видалити">×</button>
          <img src="${item.image}" alt="${item.name}">
          <div class="cart-item-meta">
            <p class="cart-item-name">${item.name}${item.size ? ` (${item.size})` : ""}</p>
            <p class="cart-item-price">${toCurrency(item.price)}</p>
          </div>
          <div class="cart-item-controls">
            <button type="button" class="cart-qty-minus" aria-label="Зменшити кількість">-</button>
            <span class="cart-item-qty">${item.qty}</span>
            <button type="button" class="cart-qty-plus" aria-label="Збільшити кількість">+</button>
          </div>
        </article>
      `).join("");
    }

    const totalItems = cartState.reduce((sum, item) => sum + item.qty, 0);
    const totalAmount = cartState.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const minimumRequirement = getMinimumOrderRequirement();
    const isMinimumActive = minimumRequirement.enabled && minimumRequirement.minimumAmount > 0;
    const minimumLeft = Math.max(0, minimumRequirement.minimumAmount - totalAmount);
    const minimumReached = !isMinimumActive || minimumLeft <= 0;

    cartCountBadge.textContent = String(totalItems);
    cartTotal.textContent = toCurrency(totalAmount);

    if (cartMinimumHint) {
      if (isMinimumActive && totalItems > 0 && !minimumReached) {
        cartMinimumHint.hidden = false;
        cartMinimumHint.textContent = `До мінімальної суми замовлення залишилось ${toCurrency(minimumLeft)}.`;
      } else {
        cartMinimumHint.hidden = true;
        cartMinimumHint.textContent = "";
      }
    }

    if (checkoutCartBtn) {
      const blockedByMinimum = totalItems > 0 && !minimumReached;
      const shouldDisableCheckout = totalItems === 0 || blockedByMinimum;
      checkoutCartBtn.disabled = shouldDisableCheckout;
      checkoutCartBtn.setAttribute("aria-disabled", shouldDisableCheckout ? "true" : "false");
    }
  };

  const addProductToCart = (productNode, quantity = 1) => {
    const productId = String(productNode.dataset.productId || "").trim();
    const productName = String(productNode.querySelector(".p-name")?.textContent || "Товар").trim();
    const rawPrice = String(productNode.querySelector(".p-price")?.textContent || "0");
    const productPrice = Number.parseInt(rawPrice.replace(/[^\d]/g, ""), 10) || 0;
    const productImage = productNode.querySelector(".thumb img")?.src || "";

    const existing = cartState.find((item) => item.id === productId);
    if (existing) {
      existing.qty += quantity;
    } else {
      cartState.push({
        id: productId || `${productName}-${Date.now()}`,
        name: productName,
        price: productPrice,
        image: productImage,
        qty: quantity
      });
    }

    saveCart(cartState);
    renderCart();
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

  const savedSettings = readSettings();
  if (savedSettings) {
    const containsProfanity = (value) => {
      const text = (value || "").toLowerCase();
      return profanityPatterns.some((pattern) => pattern.test(text));
    };

    const profileName = document.querySelector(".name");
    const profileDescription = document.querySelector(".description");
    const profileAvatar = document.querySelector(".avatar");

    if (savedSettings.name && profileName && !containsProfanity(savedSettings.name)) {
      profileName.textContent = savedSettings.name;
    }

    if (savedSettings.description && profileDescription && !containsProfanity(savedSettings.description)) {
      profileDescription.textContent = savedSettings.description.slice(0, MAX_DESCRIPTION_LENGTH);
    }

    if (savedSettings.avatar && profileAvatar) {
      profileAvatar.src = savedSettings.avatar;
    }

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

    const applySiteBackground = () => {
      const backgroundType = savedSettings.siteBackgroundType === "image" ? "image" : "color";
      const backgroundColor = isHexColor(savedSettings.siteBackgroundColor) ? savedSettings.siteBackgroundColor : "#eef1f4";
      const backgroundImage = String(savedSettings.siteBackgroundImage || "").trim();
      const storefrontCard = document.querySelector(".card");
      const hasCustomBackground = Boolean(String(savedSettings.siteBackgroundColor || "").trim()) || (backgroundType === "image" && backgroundImage.length > 0);

      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundRepeat = "repeat";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundSize = "auto";

      if (!storefrontCard) {
        return;
      }

      storefrontCard.classList.toggle("custom-background", hasCustomBackground);
      storefrontCard.style.backgroundColor = backgroundColor;

      if (backgroundType === "image" && backgroundImage) {
        storefrontCard.style.backgroundImage = `linear-gradient(rgba(17, 24, 39, 0.22), rgba(17, 24, 39, 0.22)), url("${backgroundImage}")`;
        storefrontCard.style.backgroundRepeat = "no-repeat";
        storefrontCard.style.backgroundPosition = "center";
        storefrontCard.style.backgroundSize = "cover";
      } else {
        storefrontCard.style.backgroundImage = "none";
        storefrontCard.style.backgroundRepeat = "repeat";
        storefrontCard.style.backgroundPosition = "center";
        storefrontCard.style.backgroundSize = "auto";
      }
    };

    applySiteBackground();

    if (isHexColor(savedSettings.siteColor)) {
      const rgb = hexToRgb(savedSettings.siteColor);
      document.documentElement.style.setProperty("--site-accent", savedSettings.siteColor);
      document.documentElement.style.setProperty("--site-accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
      document.documentElement.style.setProperty("--site-accent-deep", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92)`);
      document.documentElement.style.setProperty("--button-accent", savedSettings.siteColor);
      document.documentElement.style.setProperty("--button-accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
      document.documentElement.style.setProperty("--button-accent-deep", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`);
      document.documentElement.style.setProperty("--button-accent-shadow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`);
    }

    if (isHexColor(savedSettings.cartIconColor)) {
      document.documentElement.style.setProperty("--cart-icon-color", savedSettings.cartIconColor);
    }

    const socialKeys = ["instagram", "facebook", "telegram", "tiktok"];
    socialKeys.forEach((key) => {
      const node = document.querySelector(`[data-social="${key}"]`);
      if (!node) return;
      const enabled = savedSettings[`${key}Enabled`] ?? true;
      node.style.display = enabled ? "inline-flex" : "none";
      const href = savedSettings[key];
      if (href) {
        node.href = href;
        node.target = "_blank";
        node.rel = "noopener noreferrer";
      }
    });
  }

  applyStorefrontCurrencyLabels();

  const applyCategoryFilter = (category) => {
    const selected = resolveCategoryToken(category);
    products.forEach((product) => {
      const cats = String(product.dataset.cat || "")
        .split(" ")
        .map((item) => resolveCategoryToken(item))
        .filter(Boolean);
      const show = selected === "all" || cats.includes(selected);
      product.classList.toggle("hidden", !show);
    });
  };

  const activateCategoryButton = (category) => {
    const catButtons = categoriesNav ? [...categoriesNav.querySelectorAll(".cat-btn")] : [];
    const normalizedCategory = resolveCategoryToken(category);
    const target = catButtons.find((b) => b.dataset.cat === normalizedCategory) || catButtons.find((b) => b.dataset.cat === "all");
    if (!target) return;
    catButtons.forEach((b) => b.classList.remove("active"));
    target.classList.add("active");
    applyCategoryFilter(target.dataset.cat);
  };

  buildCategoryButtons();

  if (categoriesNav) {
    categoriesNav.addEventListener("click", (event) => {
      const btn = event.target.closest(".cat-btn");
      if (!btn) return;
      activateCategoryButton(btn.dataset.cat);
    });
  }

  activateCategoryButton(hashParams.get("cat") || params.get("cat") || "all");

  const scrollBtn = document.querySelector(".scroll-down");
  if (scrollBtn) {
    scrollBtn.addEventListener("click", () => {
      window.scrollBy({ top: 300, behavior: "smooth" });
    });
  }

  document.querySelectorAll(".cart-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productNode = btn.closest(".product");
      if (productNode) {
        addProductToCart(productNode, 1);
        animateAddToCart(productNode);
      }

      if (btn.classList.contains("added")) return;
      btn.classList.add("added");
      const original = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L19 7"/></svg>';
      setTimeout(() => {
        btn.classList.remove("added");
        btn.innerHTML = original;
      }, 1200);
    });
  });

  products.forEach((product) => {
    const openProduct = () => {
      const productId = product.dataset.productId;
      if (!productId) return;
      const firstCategory = product.dataset.cat.split(" ")[0] || "all";
      window.location.href = `product.html#id=${encodeURIComponent(productId)}&cat=${encodeURIComponent(firstCategory)}`;
    };

    product.addEventListener("click", (event) => {
      if (event.target.closest(".cart-btn")) {
        return;
      }

      openProduct();
    });

    product.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProduct();
      }
    });
  });

  if (openCartBtn) {
    openCartBtn.addEventListener("click", () => setCartOpen(true));
  }

  if (closeCartBtn) {
    closeCartBtn.addEventListener("click", () => setCartOpen(false));
  }

  if (cartOverlay) {
    cartOverlay.addEventListener("click", () => setCartOpen(false));
  }

  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      cartState = [];
      saveCart(cartState);
      renderCart();
    });
  }

  if (checkoutCartBtn) {
    checkoutCartBtn.addEventListener("click", () => {
      if (!cartState.length) return;
      const { enabled, minimumAmount } = getMinimumOrderRequirement();
      if (enabled && minimumAmount > 0) {
        const totalAmount = cartState.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
        if (totalAmount < minimumAmount) {
          renderCart();
          return;
        }
      }
      window.location.href = "checkout.html";
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== SETTINGS_KEY && event.key !== CART_KEY) return;
    cartState = readCart();
    renderCart();
  });

  if (photoViewerClose) {
    photoViewerClose.addEventListener("click", () => setPhotoViewerOpen(false));
  }

  if (photoViewerBackdrop) {
    photoViewerBackdrop.addEventListener("click", () => setPhotoViewerOpen(false));
  }

  if (photoPrevBtn) {
    photoPrevBtn.addEventListener("click", () => shiftPhoto(-1));
  }

  if (photoNextBtn) {
    photoNextBtn.addEventListener("click", () => shiftPhoto(1));
  }

  if (cartItems) {
    cartItems.addEventListener("click", (event) => {
      const row = event.target.closest(".cart-item");
      if (!row) return;

      const itemId = row.dataset.cartId;
      const item = cartState.find((entry) => entry.id === itemId);
      if (!item) return;

      if (event.target.closest(".cart-qty-plus")) {
        item.qty += 1;
      }

      if (event.target.closest(".cart-qty-minus")) {
        item.qty -= 1;
      }

      if (event.target.closest(".cart-item-remove")) {
        item.qty = 0;
      }

      cartState = cartState.filter((entry) => entry.qty > 0);
      saveCart(cartState);
      renderCart();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setCartOpen(false);
      setPhotoViewerOpen(false);
    }

    if (photoViewer?.classList.contains("open")) {
      if (event.key === "ArrowLeft") {
        shiftPhoto(-1);
      }
      if (event.key === "ArrowRight") {
        shiftPhoto(1);
      }
    }
  });

  renderCart();

  if (shouldOpenCartFromHash) {
    setCartOpen(true);
  }
});
