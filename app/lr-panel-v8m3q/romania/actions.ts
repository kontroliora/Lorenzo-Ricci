"use server";

// mail-policy: shipment_shipped

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildRoShippedEmail, roShippedSubject } from "@/lib/ro/emails";
import { mayEmail } from "@/lib/mail-policy";

const PATH = "/lr-panel-v8m3q/romania";

// Ship a Romanian order: AWB of the Romanian courier (not an Econt waybill) + the customer's "colet expediat" e-mail.
// Confirm / cancel / complete / return / restock reuse the generic actions in ../orders/actions.ts (stock is put back by
// the same restock_wallet_stock); only shipping differs: the Bulgarian ship e-mails are driven by Econt tracking.
export async function shipRoOrder(id: number, awb: string, trackUrl: string): Promise<string | null> {
  const tracking = (awb ?? "").trim();
  if (!tracking) return "Въведи AWB номер на куриера първо";
  const url = (trackUrl ?? "").trim();
  if (url && !/^https:\/\//i.test(url)) return "Линкът за проследяване трябва да започва с https://";

  const supabase = await createClient();
  const { data: order, error: readErr } = await supabase
    .from("orders")
    .select("id, order_ref, name, email, items, total, ship_country, ship_email_sent_at")
    .eq("id", id)
    .single();
  if (readErr || !order) return readErr?.message ?? "Поръчката не е намерена";
  if (order.ship_country !== "RO") return "Това не е румънска поръчка - използвай раздел Поръчки.";

  const now = new Date().toISOString();
  const { error } = await supabase.from("orders").update({ tracking_number: tracking, status: "shipped", shipped_at: now }).eq("id", id);
  if (error) return error.message;

  // E-mail 1 (once). A mail problem never undoes the shipment; it is reported back so staff can tell the customer.
  let warning: string | null = null;
  if (order.email && !order.ship_email_sent_at && mayEmail("shipment_shipped", "ro", "ro")) { // the Romanian shipped e-mail, to a Romanian order
    try {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY липсва");
      const items = Array.isArray(order.items) ? (order.items as { name?: string; quantity?: number; price?: number; gift?: boolean }[]).filter((i) => !i.gift) : [];
      const { error: mailErr } = await new Resend(key).emails.send({
        from: "Lorenzo Ricci <info@lorenzo-ricci.com>",
        to: [order.email],
        subject: roShippedSubject(order.order_ref ?? String(order.id)),
        html: buildRoShippedEmail({
          orderRef: order.order_ref ?? String(order.id),
          firstName: String(order.name ?? "").trim().split(" ")[0],
          items,
          total: Number(order.total ?? 0),
          awb: tracking,
          trackUrl: url || undefined,
        }),
      });
      if (mailErr) throw new Error(mailErr.message);
      await supabase.from("orders").update({ ship_email_sent_at: now }).eq("id", id);
    } catch (e) {
      warning = `Статусът е „Изпратена", но имейлът към клиента не излезе (${e instanceof Error ? e.message : String(e)}).`;
    }
  }
  revalidatePath(PATH);
  return warning;
}
