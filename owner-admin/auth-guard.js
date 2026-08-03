(function () {
  var AUTH_KEY = "ownerAdminAuth";
  var SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 днів

  function isAuthValid() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      var authenticatedAt = Number(data.authenticatedAt);
      return Number.isFinite(authenticatedAt) && Date.now() - authenticatedAt < SESSION_MS;
    } catch (e) {
      return false;
    }
  }

  if (!isAuthValid()) {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (e) {}
    var redirect = encodeURIComponent(window.location.pathname.replace(/^\//, "") + window.location.search);
    window.location.replace("/login.html?redirect=" + redirect);
    return;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var logoutLink = document.getElementById("ownerLogoutLink");
    if (!logoutLink) return;
    logoutLink.addEventListener("click", function (event) {
      event.preventDefault();
      try {
        localStorage.removeItem(AUTH_KEY);
      } catch (e) {}
      window.location.href = "/login.html";
    });
  });
})();
