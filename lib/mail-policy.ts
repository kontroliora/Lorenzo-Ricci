// E-mail language policy (see CLAUDE.md: "E-mail language (no exceptions)").
//
// Every customer-facing e-mail kind is registered here with the languages it exists in. Before a customer-facing e-mail is sent,
// the sender calls mayEmail(kind, lang): a recipient whose language has no version of that e-mail is NOT mailed. The fallback is
// "do not send", never "send the Bulgarian one".
// `npm run check:mail` fails when a file sends e-mail without a `// mail-policy:` line and (for customer e-mails) a mayEmail() call.

export type MailLang = "bg" | "ro" | "en";

export const MAIL_LANGS = {
  order_confirmation: ["bg", "ro"],   // BG: app/api/order, RO: app/api/order-ro (lib/ro/emails.ts)
  card_paid: ["bg", "ro"],            // payment received (card checkout)
  shipment_shipped: ["bg", "ro"],     // BG: Econt cron (lib/shipment-emails.ts), RO: panel action (lib/ro/emails.ts)
  shipment_reminder: ["bg"],          // "your parcel waits at an Econt office": Bulgarian only, so Romanians never get it
  abandoned_cart: ["bg", "ro"],       // lib/recovery-email.ts, lib/ro/recovery-email.ts
  newsletter_campaign: ["bg"],        // campaign templates exist per language; a Romanian campaign needs its own template first
  waitlist_intl: ["en"],              // Dubai soft-decline note: English only, never to bg/ro recipients
} as const satisfies Record<string, readonly MailLang[]>;

export type MailKind = keyof typeof MAIL_LANGS;

/** The recipient's language from the data we hold: the lang column first, then the Romanian signals, else Bulgarian. */
export function langOf(x: { lang?: string | null; ship_country?: string | null; order_ref?: string | null } | null | undefined): "bg" | "ro" {
  if (!x) return "bg";
  if (x.lang === "ro" || x.ship_country === "RO" || String(x.order_ref ?? "").startsWith("LRRO-")) return "ro";
  return "bg";
}

/**
 * May this e-mail go out? `lang` is the RECIPIENT's language, `templateLang` the language of the template the sender is about to
 * send (default: the recipient's). Allowed only when the template is in the recipient's language AND that language is registered
 * for this kind. So a Bulgarian-only sender asking about a Romanian recipient gets false: it must not send its Bulgarian text.
 * False = do not send (and say why in the log). Never fall back to another language.
 */
export function mayEmail(kind: MailKind, lang: MailLang, templateLang: MailLang = lang): boolean {
  const langs = MAIL_LANGS[kind] as readonly MailLang[] | undefined;
  const ok = !!langs && langs.includes(templateLang) && templateLang === lang;
  if (!ok) console.warn(`[mail-policy] not sent: "${kind}" for a ${lang.toUpperCase()} recipient (template ${templateLang.toUpperCase()}) - there is no ${lang.toUpperCase()} version`);
  return ok;
}
