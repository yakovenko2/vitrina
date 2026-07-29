/**
 * Cloudflare Worker — проксі для кастомних доменів клієнтів "Вітрина".
 *
 * Навіщо: Firebase Hosting маршрутизує сайти за заголовком Host і не впізнає
 * клієнтські домени (віддає 301 на www замість сайту). Цей Worker перехоплює
 * трафік усіх custom hostnames і звертається до Firebase з "правильним" Host,
 * тож Firebase віддає сайт-вітрину (200). У браузері адреса лишається
 * клієнтським доменом, і клієнтський JS сам визначає магазин за window.location.
 *
 * Розгортання (безкоштовний план Workers, до 100k запитів/день):
 *  1. Cloudflare Dashboard → Workers & Pages → Create → Worker → вставити цей код → Deploy.
 *  2. У Worker: Settings → Domains & Routes → Add → Route:
 *       Zone:  vitryna-shop.com
 *       Route: */*
 *     Маршрут "*/*" автоматично ловить усі клієнтські домени (SaaS custom hostnames).
 *  3. (Опційно) Додати друге правило-виняток для власних субдоменів сервісу з Worker = None.
 */

const ORIGIN_HOST = "lavka-shop.web.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Власний хост сервісу не проксіюємо.
    if (url.hostname === ORIGIN_HOST) {
      return fetch(request);
    }

    const originUrl = new URL(url.toString());
    originUrl.protocol = "https:";
    originUrl.hostname = ORIGIN_HOST;
    originUrl.port = "";

    const originRequest = new Request(originUrl.toString(), request);
    originRequest.headers.set("Host", ORIGIN_HOST);
    // Реальний домен відвідувача — про запас, якщо знадобиться серверна логіка.
    originRequest.headers.set("X-Forwarded-Host", url.hostname);

    return fetch(originRequest, { redirect: "manual" });
  }
};
