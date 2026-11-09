// Renders every customer e-mail template with sample data and (optionally) sends each one to a test address.
//   node scripts/email-test.mjs                         -> writes .email-test/*.html (+ all.html to view them side by side)
//   node scripts/email-test.mjs --send you@example.com  -> also sends them via Resend (RESEND_API_KEY from .env.local)
// Subjects are prefixed "[ТЕСТ <template>]". Nothing touches orders or customers.
import { createRequire } from "node:module";
import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd(); const OUT = path.join(ROOT, ".email-test"); fs.mkdirSync(OUT, { recursive: true });
const req = createRequire(path.join(ROOT, "package.json"));
const jiti = req("jiti")(path.join(ROOT, "x.js"), { alias: { "@": ROOT }, interopDefault: true });
const L = async (p) => jiti(path.join(ROOT, p));
const on = await L("lib/order-notify.ts"), sh = await L("lib/shipment-emails.ts"), rec = await L("lib/recovery-email.ts");
const ro = await L("lib/ro/emails.ts"), rorec = await L("lib/ro/recovery-email.ts"), pe = await L("lib/partner/email.ts");
const wl = await L("lib/waitlist-email.ts"), nc = await L("lib/new-collection.ts");
const slug = [...nc.NEW_COLLECTION_SLUGS][0];
const bgOrder = { customer: { name: "Иван Петров", email: "x", phone: "0888123456", officeAddress: "Еконт офис София - Младост 1, бул. Ал. Малинов 23", shippingMethod: "Еконт - до офис" },
  shipping: { method: "Еконт - до офис" }, items: [{ name: "Yachting Black", quantity: 1, price: 89, currency: "€" }, { name: "Кожена кутия (подарък)", quantity: 1, price: 0, gift: true }], total: 89 };
const sd = { firstName: "Иван", ref: "LR-104233", items: [{ name: "Yachting Black", qty: 1, price: 89, currency: "€" }], total: "89.00", currency: "€", tracking: "1051234567890", trackUrl: sh.trackPageUrl("1051234567890"), officeName: "Еконт София - Младост 1" };
const roData = { orderRef: "LRRO-20412", customer: { name: "Andrei Popescu", phone: "0722", email: "x", county: "Cluj", city: "Cluj-Napoca", address: "Str. Memorandumului 12", postCode: "400114" },
  items: [{ name: "Yachting Black", sku: "LR-YB", quantity: 1, price: 449 }], subtotal: 449, shippingCost: 0, total: 449 };
const roLines = roData.items;
const T = [
  ["bg-order-confirmation", "Вашата поръчка е получена - Lorenzo Ricci", on.buildCustomerEmail(bgOrder)],
  ["bg-card-paid", "Плащането е получено - Lorenzo Ricci", on.buildCustomerEmail(bgOrder, { paidByCard: true })],
  ["bg-shipped", sh.shipmentSubjects.shipped(sd.ref), sh.buildShippedEmail(sd)],
  ["bg-reminder-office", sh.shipmentSubjects.reminder(sd.ref), sh.buildReminderOfficeEmail(sd)],
  ["bg-reminder-door", sh.shipmentSubjects.reminder(sd.ref) + " (door)", sh.buildReminderDoorEmail(sd)],
  ["bg-cart-recovery", "Вашата количка Ви очаква - Lorenzo Ricci", rec.buildRecoveryEmail({ session_id: "test", email: "x", name: "Иван Петров", phone: null, items: [{ name: "Yachting Black", sku: "LR-YB", price: 89, currency: "€", quantity: 1 }], subtotal: 89, updated_at: new Date().toISOString() })],
  ["ro-card-paid", ro.roPaidSubject, ro.buildRoCustomerEmail(roData)],
  ["ro-confirmed", ro.roConfirmedSubject?.("LRRO-20412") ?? "Comanda a fost confirmată", ro.buildRoConfirmedEmail({ orderRef: "LRRO-20412", firstName: "Andrei", items: roLines, total: 449, payment: "card" })],
  ["ro-shipped", ro.roShippedSubject("LRRO-20412"), ro.buildRoShippedEmail({ orderRef: "LRRO-20412", firstName: "Andrei", items: roLines, total: 449, payment: "card", awb: "60012345678", trackUrl: "https://lorenzo-ricci.com/ro" })],
  ["ro-delivered", ro.roDeliveredSubject?.("LRRO-20412") ?? "Comanda a fost livrată", ro.buildRoDeliveredEmail({ orderRef: "LRRO-20412", firstName: "Andrei" })],
  ["ro-cancelled", ro.roCancelledSubject?.("LRRO-20412") ?? "Comanda a fost anulată", ro.buildRoCancelledEmail({ orderRef: "LRRO-20412", firstName: "Andrei" })],
  ["ro-returned", ro.roReturnedSubject?.("LRRO-20412") ?? "Coletul s-a întors la noi", ro.buildRoReturnedEmail({ orderRef: "LRRO-20412", firstName: "Andrei", payment: "card", total: 449 })],
  ["ro-cart-recovery", rorec.roRecoverySubject, rorec.buildRoRecoveryEmail({ session_id: "test", email: "x", name: "Andrei Popescu", items: [{ name: "Yachting Black", sku: "LR-YB", price: 449, quantity: 1 }], subtotal: 449 })],
  ["partner", "Партньор: поръчка LR-104233", pe.buildPartnerOrderEmail({ ref: "LR-104233", createdAt: new Date().toISOString(), market: "bg", currency: "€", name: "Мария Иванова", phone: "0888123456", delivery: { courier: "Еконт", office: true, place: "Еконт София - Младост 1" }, items: [{ model: "Колие Verdis", color: "Златен", stone: "Зелена вложка", sku: "KO-VERDIS-G", qty: 1, price: 109, collection: true, gift: false }, { model: "Гривна Lumen", color: "Сребърен", stone: "Перлена вложка", sku: "GR-LUMEN-S", qty: 1, price: 109, collection: true, gift: false }, { model: "Chrono Black", color: "", stone: "", sku: "LR-CHRONO-BLK", qty: 1, price: 119, collection: false, gift: false }], goods: 337, discount: 109, shipping: 0, total: 228, payment: { kind: "cod", label: "НАЛОЖЕН ПЛАТЕЖ — €228.00", collect: 228 }, storeCancelled: false, state: { status: "new", label: "Нова", note: "", updatedAt: null } })],
  ["en-waitlist", "A note on your Lorenzo Ricci order", wl.buildWaitlistEmail({ firstName: "John", itemNames: ["Yachting Black"], promoCode: "WELCOME5", discountPct: 5 })],
];
const idx = [];
for (const [k, subj, html] of T) { fs.writeFileSync(path.join(OUT, k + ".html"), html); idx.push({ k, subj }); }
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(idx, null, 1));
fs.writeFileSync(path.join(OUT, "all.html"), `<!doctype html><meta charset=utf-8><body style="margin:0;background:#888;font-family:sans-serif">` + idx.map(({ k, subj }) => `<h3 style="color:#fff;margin:16px">${k} — ${subj}</h3><iframe src="${k}.html" style="width:640px;height:520px;border:0;margin:0 16px;background:#fff"></iframe>`).join(""));
console.log(idx.map((x) => x.k).join("\n"));

const si = process.argv.indexOf("--send");
if (si > 0) {
  const TO = process.argv[si + 1];
  if (!TO || !TO.includes("@")) throw new Error("--send needs an address");
  const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
  const key = process.env.RESEND_API_KEY || env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is empty in .env.local (Vercel keeps it as a sensitive value): add it there or export it in the shell");
  const { Resend } = req("resend");
  const resend = new Resend(key);
  for (const [k, subj, html] of T) {
    const { data, error } = await resend.emails.send({ from: "Lorenzo Ricci <info@lorenzo-ricci.com>", to: [TO], subject: `[ТЕСТ ${k}] ${subj}`, html });
    console.log(k, error ? "ERROR " + JSON.stringify(error) : "sent " + data?.id);
    await new Promise((r) => setTimeout(r, 700));
  }
}
