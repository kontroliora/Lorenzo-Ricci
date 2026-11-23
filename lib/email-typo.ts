// "Имахте предвид …@abv.bg?" under the checkout's e-mail field (owner, 23.11.2026). 8 of the 39 bounces of 20-23.11 were a mistyped
// domain (mail.bbg, bg.bv, anv.bg, gmail.comm, gmail.con, hmail.com). A hint only: the customer decides, nothing is changed or blocked.
// Pure, used in the browser.

const KNOWN = ["abv.bg", "gmail.com", "mail.bg", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "dir.bg", "live.com", "yandex.ru", "mail.ru", "proton.me", "gbg.bg"];

// Swaps the distance below cannot see (letters moved around).
const EXPLICIT: Record<string, string> = {
  "bg.bv": "abv.bg", "bv.bg": "abv.bg", "avb.bg": "abv.bg", "abg.bg": "abv.bg", "abv.gb": "abv.bg", "abv.com": "abv.bg", "abv.bgg": "abv.bg",
  "mail.gb": "mail.bg", "gmail.bg": "gmail.com", "gmai.bg": "gmail.com", "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmali.com": "gmail.com",
};

function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** The corrected address when the domain looks mistyped, else null. */
export function suggestEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).replace(/[.\s>]+$/, "");
  if (!domain || KNOWN.includes(domain)) return null;
  const fix = EXPLICIT[domain] ?? (() => {
    let best: string | null = null, bestD = 3;
    for (const k of KNOWN) {
      const d = distance(domain, k);
      if (d < bestD) { best = k; bestD = d; }
    }
    // one typo for short domains, up to two for longer ones (gmail.cmo -> gmail.com), never a different real-looking domain
    return best && bestD <= (domain.length >= 8 ? 2 : 1) ? best : null;
  })();
  return fix && fix !== domain ? `${local}@${fix}` : null;
}
