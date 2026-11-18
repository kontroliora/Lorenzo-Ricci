import type { Metadata } from "next";
import Link from "next/link";
import { verifyConfirmToken } from "@/lib/order-confirm-token";
import { readConfirmState } from "@/lib/confirm-by-email";
import { ConfirmClient } from "./ConfirmClient";

// The page behind "ПОТВЪРЖДАВАМ ПОРЪЧКАТА" (lib/confirm-request.ts). Opening it (GET) changes nothing - mail scanners open links
// too; the page itself posts to /api/order-confirm (ConfirmClient), which confirms the order once.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Потвърждение на поръчка", robots: { index: false, follow: false } };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-[116px] pb-24 px-5 sm:px-8">
      <div className="max-w-xl mx-auto mt-10 sm:mt-16 bg-ivory-card border border-border px-6 py-10 sm:px-12 sm:py-14 text-center shadow-[0_2px_24px_rgba(15,12,8,0.06)]">
        {children}
      </div>
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <p className="section-tag mb-3">Lorenzo Ricci</p>
      <h1 className="font-serif text-display-sm text-charcoal">{title}</h1>
      <div className="gold-divider" />
      <p className="font-sans text-sm text-ink-soft leading-relaxed">{text}</p>
      <Link href="/" className="btn-primary w-full mt-8">Към магазина</Link>
    </Card>
  );
}

const CONTACT = "Отговорете на имейла, който получихте, или ни пишете на info@lorenzo-ricci.com.";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = verifyConfirmToken(token);
  if (!v.ok && v.reason === "invalid") return <Notice title="Невалиден линк" text={`Линкът за потвърждение не е валиден. ${CONTACT}`} />;
  const orderId = v.ok ? v.claim.orderId : v.orderId!;
  const state = await readConfirmState(orderId);
  if (state.kind === "error") return <Notice title="Временна грешка" text={`Не успяхме да заредим поръчката. Опитайте отново след малко. ${CONTACT}`} />;
  if (state.kind === "already") return <ConfirmClient token="" ref_={state.ref} initial="already" />;
  if (state.kind === "closed") return <Notice title={`Поръчка №${state.ref}`} text={`Тази поръчка вече не е активна. Ако желаете да я възстановите, ${CONTACT.charAt(0).toLowerCase()}${CONTACT.slice(1)}`} />;
  if (!v.ok) return <Notice title="Линкът е изтекъл" text={`Линкът за потвърждение на поръчка №${"ref" in state ? state.ref : ""} е валиден 7 дни и вече е изтекъл. ${CONTACT}`} />;
  return <ConfirmClient token={token} ref_={"ref" in state ? state.ref : ""} initial={v.claim.test ? "test" : "open"} />;
}
