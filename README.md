# vitrina

## Оплата тарифів через Monobank Acquiring

Реалізовано серверну інтеграцію для оплати тарифів через Monobank API.

### Що вже працює

- Кнопка Оплатити в розділі Тарифний план викликає бекенд `createTariffInvoice`.
- Бекенд створює рахунок через `POST /api/merchant/invoice/create`.
- Користувач редіректиться на `pageUrl` Monobank.
- Webhook `monoTariffWebhook` приймає події від Monobank і оновлює статус інвойсу.
- При `success` тариф автоматично активується у `stores/{storeId}/data/lavkaBilling`.
- Запланована функція `expireMonoTariffInvoices` позначає прострочені рахунки як `expired`.

### Функції

- `createTariffInvoice` (HTTPS): створює інвойс оплати тарифу.
- `monoTariffWebhook` (HTTPS): обробляє вебхуки Monobank.
- `getTariffInvoiceStatus` (HTTPS): повертає статус інвойсу за `invoiceId`.
- `expireMonoTariffInvoices` (Scheduler): закриває прострочені `created` рахунки.

### Обов'язкове налаштування секрета

Токен Monobank не зберігається у фронтенді та в коді. Потрібно додати секрет:

```bash
firebase functions:secrets:set MONO_X_TOKEN
```

Після цього задеплоїти функції:

```bash
firebase deploy --only functions
```

### Важливі нотатки безпеки

- Сума тарифу береться тільки з бекенду (жорстко визначені тарифи), а не з фронтенду.
- Для ідемпотентності формується унікальний `reference` на кожен інвойс.
- Для обробки не по порядку використовується `modifiedDate`: старіші події ігноруються.
- Для додаткової верифікації вебхука робиться запит статусу інвойсу до Monobank API.

### Тарифи (поточне мапування)

- `start` → 10900 коп. (109 грн, 1 міс.)
- `business` → 20900 коп. (209 грн, 1 міс.)
- `pro` → 44900 коп. (449 грн, 1 міс.)

## Telegram-сповіщення про замовлення (Firebase Functions)

Один Telegram-бот `@lavkaorders_bot` обслуговує всі магазини. Прив'язка магазину
до чату відбувається через deep linking, а бекенд працює на Firebase Functions.

### Як це працює

1. Адмін у розділі **Сповіщення** натискає «Підключити Telegram».
2. Відкривається бот за посиланням `https://t.me/lavkaorders_bot?start=store_<STORE_ID>`.
3. Користувач натискає `/start`. Функція `telegramWebhook` читає `chat_id` та `storeId`
   з payload і зберігає їх у Firestore (`store_telegram/{storeId}`), після чого бот
   надсилає вітальне повідомлення.
4. Під час оформлення замовлення вітрина викликає функцію `notifyOrder`, яка надсилає
   сповіщення в збережений `chat_id` магазину.
5. Якщо користувач заблокував бота (403), сповіщення автоматично вимикаються.

### Функції

- `telegramWebhook` (HTTPS) — обробляє `/start store_<id>`, зберігає `chat_id`.
- `telegramStatus` (callable) — статус підключення для адмін-панелі.
- `telegramSetEnabled` (callable) — увімкнути/вимкнути сповіщення.
- `telegramDisconnect` (callable) — відв'язати Telegram.
- `notifyOrder` (HTTPS) — надіслати сповіщення про нове замовлення (виклик з вітрини).

### Налаштування (один раз)

1. Задати секрет із токеном бота (у код НЕ потрапляє):

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

2. Задеплоїти функції та хостинг:

```bash
firebase deploy --only functions,hosting
```

3. Прив'язати webhook бота до функції `telegramWebhook`:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://us-central1-lavka-shop.cloudfunctions.net/telegramWebhook
```

### Важливо

- Токен бота зберігається лише як секрет Firebase, у фронтенді його немає.
- Поля `chat id` і `token` не вводяться в адмін-панелі — усе відбувається автоматично.
- Від адміністратора потрібно лише натиснути «Підключити Telegram» і виконати `/start`.
