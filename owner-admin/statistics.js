(function () {
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDzJ3zOCHvuAnZQA-90va3xZxoBSVqnwLs",
    authDomain: "lavka-shop.firebaseapp.com",
    projectId: "lavka-shop",
    storageBucket: "lavka-shop.firebasestorage.app",
    messagingSenderId: "437450554587",
    appId: "1:437450554587:web:2448c9e6fa0cd9c0d520fe"
  };

  var DAY_MS = 24 * 60 * 60 * 1000;
  var LOOKBACK_MS = 8 * DAY_MS;
  var RECOMPUTE_INTERVAL_MS = 5000;
  var DAY_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  var statusEl = document.getElementById("statsStatus");
  var todayEl = document.getElementById("statsToday");
  var yesterdayEl = document.getElementById("statsYesterday");
  var weekEl = document.getElementById("statsWeek");
  var liveEl = document.getElementById("statsLive");
  var chartEl = document.getElementById("statsChart");

  var visitsCache = [];

  function initDb() {
    if (!window.firebase) {
      throw new Error("firebase-unavailable");
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    return firebase.firestore();
  }

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.remove("error", "success");
    if (kind) statusEl.classList.add(kind);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function startOfDay(ms) {
    var d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function formatDayLabel(ms) {
    var d = new Date(ms);
    return DAY_LABELS[d.getDay()] + " " + pad2(d.getDate()) + "." + pad2(d.getMonth() + 1);
  }

  function renderChart(dayBuckets) {
    if (!chartEl) return;
    var max = dayBuckets.reduce(function (acc, day) { return Math.max(acc, day.count); }, 0);

    if (!max) {
      chartEl.innerHTML = '<p class="stats-chart-empty">Ще немає відвідувань за цей період.</p>';
      return;
    }

    var bars = dayBuckets.map(function (day) {
      var heightPct = Math.max(4, Math.round((day.count / max) * 100));
      return '<div class="stats-bar-col">'
        + '<div class="stats-bar-value">' + day.count + '</div>'
        + '<div class="stats-bar-track"><div class="stats-bar" style="height:' + heightPct + '%"></div></div>'
        + '<div class="stats-bar-label">' + day.label + '</div>'
        + '</div>';
    }).join("");

    chartEl.innerHTML = '<div class="stats-chart-bars">' + bars + '</div>';
  }

  function renderStats() {
    var now = Date.now();
    var todayStart = startOfDay(now);
    var yesterdayStart = todayStart - DAY_MS;
    var weekStart = todayStart - 6 * DAY_MS;
    var fiveMinAgo = now - 5 * 60 * 1000;

    var dayBuckets = [];
    for (var i = 6; i >= 0; i -= 1) {
      var dayStart = todayStart - i * DAY_MS;
      dayBuckets.push({ start: dayStart, end: dayStart + DAY_MS, count: 0, label: formatDayLabel(dayStart) });
    }

    var todayCount = 0;
    var yesterdayCount = 0;
    var liveCount = 0;

    visitsCache.forEach(function (visit) {
      var atMs = visit.atMs;
      if (!Number.isFinite(atMs) || atMs < weekStart) return;

      if (atMs >= todayStart) {
        todayCount += 1;
      } else if (atMs >= yesterdayStart) {
        yesterdayCount += 1;
      }

      if (atMs >= fiveMinAgo) {
        liveCount += 1;
      }

      for (var j = 0; j < dayBuckets.length; j += 1) {
        var bucket = dayBuckets[j];
        if (atMs >= bucket.start && atMs < bucket.end) {
          bucket.count += 1;
          break;
        }
      }
    });

    var weekCount = dayBuckets.reduce(function (sum, bucket) { return sum + bucket.count; }, 0);

    if (todayEl) todayEl.textContent = String(todayCount);
    if (yesterdayEl) yesterdayEl.textContent = String(yesterdayCount);
    if (weekEl) weekEl.textContent = String(weekCount);
    if (liveEl) liveEl.textContent = String(liveCount);

    renderChart(dayBuckets);
  }

  function startListening(db) {
    var since = Date.now() - LOOKBACK_MS;

    db.collection("landing_visits")
      .where("atMs", ">=", since)
      .onSnapshot(function (snap) {
        visitsCache = snap.docs.map(function (docSnap) {
          var data = docSnap.data() || {};
          return { atMs: Number(data.atMs) || 0 };
        });
        renderStats();
        setStatus("", "");
      }, function (error) {
        console.error("[owner-admin/statistics] snapshot error:", error);
        setStatus("Не вдалося завантажити дані відвідувань.", "error");
      });
  }

  function bootstrap() {
    setStatus("Завантажуємо дані...", "");
    try {
      var db = initDb();
      startListening(db);
      renderStats();
      setInterval(renderStats, RECOMPUTE_INTERVAL_MS);
    } catch (error) {
      console.error("[owner-admin/statistics] init failed:", error);
      setStatus("Не вдалося підключитися до бази даних.", "error");
    }
  }

  bootstrap();
})();
