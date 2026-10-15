# Lorenzo Ricci - project rules

## E-mail language (no exceptions)

Every e-mail the system sends to a Romanian customer or subscriber MUST be in Romanian. A Romanian customer is anyone whose
`lang` is `ro`, whose `ship_country` is `RO`, whose order reference starts with `LRRO-`, or who came from the `/ro` site.
Bulgarian e-mails go to Bulgarian customers, and the other way round.

When you add, change or touch ANY e-mail (transactional, reminder, campaign, alert to a customer):

1. A customer-facing e-mail needs a Romanian version before it may reach a Romanian recipient. No Romanian version = it is NOT sent
   to Romanians. The fallback is "do not send", NEVER "send the Bulgarian one".
2. Register the e-mail kind and its languages in `lib/mail-policy.ts` (`MAIL_LANGS`) and call `mayEmail(kind, lang)` before sending.
   `npm run check:mail` fails when a file sends e-mail without being registered there.
3. The language comes from the data (`orders.lang`, `newsletter_subscribers.lang`, `cart_sessions.lang`), never from a guess about the
   address or the browser. The column is filled from the site the person came from (`/ro` = `ro`, everything else = `bg`).
4. Campaign templates are chosen per `lang`; a subscriber never gets a template of the other language. Unsubscribe links of Romanian
   subscribers carry `l=ro` (the page is then Romanian).
5. Internal e-mails to the team (new order, alerts) stay Bulgarian; they are not customer e-mails.
6. Romanian copy is formal (dumneavoastra) and uses proper diacritics (ă â î ș ț, with comma, not cedilla).
