// One-off script: find store_order_invoices whose Monobank status is "success"
// but whose linked order never received the "Оплачено" payment status
// (webhook was crashing with ReferenceError: toMonoModifiedDate is not defined).
// Run: node reconcile-stuck-invoices.js
const admin = require("firebase-admin");

admin.initializeApp({ projectId: "lavka-shop" });
const db = admin.firestore();

const STORE_ORDER_INVOICES_COLLECTION = "store_order_invoices";
const STORE_ORDERS_KEY = "lavkaOrders";

const updateStoreOrderPaymentStatus = async ({ storeId, orderId, paymentStatus, monoInvoiceId, monoStatus, pageUrl }) => {
  const orderDocRef = db.collection("stores").doc(storeId).collection("data").doc(STORE_ORDERS_KEY);
  const snap = await orderDocRef.get();
  if (!snap.exists) return false;

  const payload = snap.data() || {};
  const list = Array.isArray(payload.value) ? payload.value.slice() : [];
  const index = list.findIndex((item) => String(item && item.id || "").trim() === orderId);
  if (index < 0) return false;

  const current = list[index] && typeof list[index] === "object" ? list[index] : {};
  if (current.paymentStatus === paymentStatus) {
    return "already-ok";
  }

  list[index] = {
    ...current,
    paymentStatus: String(paymentStatus || current.paymentStatus || "Не оплачено"),
    monoInvoiceId: String(monoInvoiceId || current.monoInvoiceId || ""),
    monoStatus: String(monoStatus || current.monoStatus || ""),
    monoPageUrl: String(pageUrl || current.monoPageUrl || ""),
    updatedAt: new Date().toISOString()
  };

  await orderDocRef.set({ key: STORE_ORDERS_KEY, value: list, updatedAt: new Date().toISOString() }, { merge: true });
  return true;
};

(async () => {
  const snap = await db.collection(STORE_ORDER_INVOICES_COLLECTION).get();
  console.log(`Found ${snap.size} invoice(s).`);

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const status = String(data.status || data.monoStatus || "").trim().toLowerCase();
    console.log(`invoice=${doc.id} storeId=${data.storeId} orderId=${data.orderId} status=${status}`);

    if (status === "success") {
      const result = await updateStoreOrderPaymentStatus({
        storeId: data.storeId,
        orderId: data.orderId,
        paymentStatus: "Оплачено",
        monoInvoiceId: doc.id,
        monoStatus: status,
        pageUrl: data.pageUrl || ""
      });
      console.log(`  -> reconciled: ${result}`);
    } else if (status === "failure" || status === "expired") {
      const result = await updateStoreOrderPaymentStatus({
        storeId: data.storeId,
        orderId: data.orderId,
        paymentStatus: "Не оплачено",
        monoInvoiceId: doc.id,
        monoStatus: status,
        pageUrl: data.pageUrl || ""
      });
      console.log(`  -> reconciled: ${result}`);
    }
  }

  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
