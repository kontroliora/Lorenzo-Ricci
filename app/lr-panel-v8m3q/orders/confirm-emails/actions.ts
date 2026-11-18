"use server";

import { revalidatePath } from "next/cache";
import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";
import { mayMail, sendConfirmRequest, sendConfirmRequestTest, type ConfirmRow } from "@/lib/confirm-request";

const PATH = "/lr-panel-v8m3q/orders/confirm-emails";

/** Owner only: the test e-mail (real data of one order) to the owner's own login address. Marks nothing, its link confirms nothing. */
export async function sendTestConfirmEmail(orderId: number): Promise<string> {
  const me = await getAdminSession();
  if (me?.role !== "owner" || !me.email) return "Само собственикът може да праща тест.";
  const r = await sendConfirmRequestTest(await adminDb(), orderId, me.email);
  return r.ok ? `Тестовият имейл е изпратен до ${me.email}.` : `Не е изпратен: ${r.reason}`;
}

/** Owner only: sends the e-mail to every order that still qualifies (once each; already-mailed ones are skipped by the claim). */
export async function sendAllConfirmEmails(expectedCount: number): Promise<string> {
  const me = await getAdminSession();
  if (me?.role !== "owner") return "Само собственикът може да праща.";
  const sb = await adminDb();
  const { data, error } = await sb.from("orders").select("*").eq("status", "new").eq("call_state", "no_answer").in("call_attempts", [1, 2]);
  if (error) return `Грешка: ${error.message}`;
  const targets = ((data ?? []) as ConfirmRow[]).filter(mayMail);
  if (targets.length !== expectedCount) return `Списъкът се промени (${expectedCount} → ${targets.length}). Презареди страницата и провери отново.`;
  let sent = 0;
  const failed: string[] = [];
  for (const o of targets) {
    const r = await sendConfirmRequest(sb, o.id);
    if (r.ok) sent++; else failed.push(`${o.order_ref ?? o.id}: ${r.reason}`);
  }
  revalidatePath(PATH);
  revalidatePath("/lr-panel-v8m3q/orders");
  return `Изпратени: ${sent} от ${targets.length}.${failed.length ? ` Неизпратени: ${failed.join("; ")}` : ""}`;
}

// ── End-to-end test (owner, 18.11.2026): a TEST order with the owner's own e-mail, so "Не вдига" on its card sends the real e-mail
// to him. No product slug -> no stock reserved, not a women's-collection order -> the partner never sees it. Marked by TEST_NOTE;
// deleteTestOrders() removes ONLY such orders (the audit rows go with them: ON DELETE CASCADE).
const TEST_NOTE = "ТЕСТ имейл потвърждение – изтрий";

export async function createTestOrder(): Promise<string> {
  const me = await getAdminSession();
  if (me?.role !== "owner" || !me.email) return "Само собственикът.";
  const sb = await adminDb();
  const ref = `LR-T${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const { error } = await sb.from("orders").insert({
    order_ref: ref, name: "ТЕСТ Тестов", phone: "0888000000", email: me.email, city: "София", address: "Офис Еконт (тест)",
    shipping_method: "Доставка чрез Еконт до офис", courier: "office",
    items: [{ name: "ТЕСТОВ АРТИКУЛ (не изпращай)", sku: "TEST", price: 1, currency: "€", quantity: 1, qty: 1 }],
    subtotal: 1, shipping_cost: 0, total: 1, notes: TEST_NOTE, status: "new", call_state: "pending", is_manual: true,
  });
  if (error) return `Грешка: ${error.message}`;
  revalidatePath(PATH);
  revalidatePath("/lr-panel-v8m3q/orders");
  return `Създадена тестова поръчка ${ref}.`;
}

export async function deleteTestOrders(): Promise<string> {
  const me = await getAdminSession();
  if (me?.role !== "owner" || !me.email) return "Само собственикът.";
  const sb = await adminDb();
  const { data, error } = await sb.from("orders").delete().eq("notes", TEST_NOTE).eq("is_manual", true).eq("email", me.email).eq("total", 1).select("order_ref");
  if (error) return `Грешка: ${error.message}`;
  revalidatePath(PATH);
  revalidatePath("/lr-panel-v8m3q/orders");
  return `Изтрити: ${(data ?? []).map((r) => r.order_ref).join(", ") || "няма"}.`;
}
