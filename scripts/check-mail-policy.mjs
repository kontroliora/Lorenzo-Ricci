// npm run check:mail - every file that sends e-mail must say what it sends (see lib/mail-policy.ts and CLAUDE.md).
//   a line  // mail-policy: internal                      -> e-mail to the team only (stays Bulgarian)
//   a line  // mail-policy: kind_a, kind_b                -> customer-facing kinds registered in MAIL_LANGS; the file must call mayEmail(
import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const policy = fs.readFileSync(path.join(ROOT, "lib/mail-policy.ts"), "utf8");
const kinds = new Set([...policy.slice(policy.indexOf("MAIL_LANGS = {"), policy.indexOf("} as const satisfies")).matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]));
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (["node_modules", ".next", ".git", "scripts"].includes(e.name)) continue;
  const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
} })(path.join(ROOT, "app")), (function walk2(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk2(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p); } })(path.join(ROOT, "lib"));
let bad = 0, checked = 0;
for (const f of files) {
  if (f.endsWith("lib/mail-policy.ts")) continue;
  const src = fs.readFileSync(f, "utf8");
  if (!/\bemails\.send\(|\bnew Resend\(/.test(src)) continue;
  checked++; const rel = path.relative(ROOT, f);
  const m = src.match(/^\s*\/\/ mail-policy:\s*(.+)$/m);
  if (!m) { console.error(`FAIL ${rel}: sends e-mail but has no "// mail-policy:" line`); bad++; continue; }
  const decl = m[1].trim();
  if (decl === "internal") continue;
  const ks = decl.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = ks.filter((k) => !kinds.has(k));
  if (unknown.length) { console.error(`FAIL ${rel}: unknown e-mail kind(s) ${unknown.join(", ")} - register them in lib/mail-policy.ts`); bad++; }
  if (!/\bmayEmail\(/.test(src)) { console.error(`FAIL ${rel}: sends customer e-mail (${ks.join(", ")}) but never calls mayEmail()`); bad++; }
}
console.log(bad ? `\n${bad} problem(s) in ${checked} sending file(s)` : `ok: ${checked} sending file(s), all declare their e-mail kinds`);
process.exit(bad ? 1 : 0);
