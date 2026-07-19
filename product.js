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
  const VISITOR_ID_KEY = "lavkaVisitorId";
  const VISITOR_EVENTS_KEY = "lavkaVisitEvents";
  const VISITOR_EVENT_RETENTION_DAYS = 180;
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const productId = hashParams.get("id") || params.get("id") || "terra";
  const fromCategory = hashParams.get("cat") || params.get("cat") || "all";
  const product = PRODUCTS[productId] || PRODUCTS.terra;

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
  const productName = document.getElementById("productName");
  const productSku = document.getElementById("productSku");
  const productPrice = document.getElementById("productPrice");
  const productDescription = document.getElementById("productDescription");
  const detailGallery = document.getElementById("detailGallery");
  const backToCategory = document.getElementById("backToCategory");

  productName.textContent = product.name;
  productSku.textContent = product.sku;
  productPrice.textContent = `${product.price} грн`;
  productDescription.textContent = product.description;
  mainImage.src = product.images[0];
  mainImage.alt = product.name;
  document.title = `${product.name} — Lavka Keramiky`;

  backToCategory.href = `index.html#cat=${encodeURIComponent(fromCategory)}`;

  product.images.slice(1).forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${product.name} деталь ${index + 1}`;
    img.loading = "lazy";
    detailGallery.appendChild(img);
  });

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
    const quantity = normalizeQty();
    addToCart.classList.add("added");
    addToCart.textContent = `Додано: ${quantity}`;
    setTimeout(() => {
      addToCart.classList.remove("added");
      addToCart.textContent = "Додати в кошик";
    }, 1200);
  });
});
