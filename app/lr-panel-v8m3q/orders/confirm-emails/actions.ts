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
