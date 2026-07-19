document.addEventListener("DOMContentLoaded", () => {
  const SETTINGS_KEY = "lavkaStoreSettings";
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
  const catButtons = document.querySelectorAll(".cat-btn");
  const products = document.querySelectorAll(".product");
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  const readSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
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

  const applyCategoryFilter = (category) => {
    products.forEach((product) => {
      const cats = product.dataset.cat.split(" ");
      const show = category === "all" || cats.includes(category);
      product.classList.toggle("hidden", !show);
    });
  };

  const activateCategoryButton = (category) => {
    const target = [...catButtons].find((b) => b.dataset.cat === category) || [...catButtons].find((b) => b.dataset.cat === "all");
    if (!target) return;
    catButtons.forEach((b) => b.classList.remove("active"));
    target.classList.add("active");
    applyCategoryFilter(target.dataset.cat);
  };

  catButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activateCategoryButton(btn.dataset.cat);
    });
  });

  activateCategoryButton(hashParams.get("cat") || params.get("cat") || "all");

  const scrollBtn = document.querySelector(".scroll-down");
  if (scrollBtn) {
    scrollBtn.addEventListener("click", () => {
      window.scrollBy({ top: 300, behavior: "smooth" });
    });
  }

  document.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
    });
  });

  document.querySelectorAll(".cart-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
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
      if (event.target.closest(".fav-btn") || event.target.closest(".cart-btn")) {
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
});
