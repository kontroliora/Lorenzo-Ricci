import { kv } from "@vercel/kv";
import Link from "next/link";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

type Lead = { name: string; phone: string; email: string; date: string };

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("bg-BG", {
      timeZone: "Europe/Sofia",
      day:    "2-digit",
      month:  "2-digit",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function AdminCustomersPage() {
  let contacts: Lead[] = [];
  try {
    contacts = (await kv.lrange<Lead>("marketing_leads", 0, -1)) ?? [];
  } catch {
    contacts = [];
  }

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p
              className="text-white tracking-widest uppercase"
              style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}
            >
              Lorenzo Ricci
            </p>
            <p className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">
              Admin · Маркетинг Контакти
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="font-sans text-xs text-white/35 hover:text-white tracking-widest uppercase transition-colors"
            >
              Изход ↗
            </button>
          </form>
        </div>
      </header>

      {/* Nav tabs */}
      <div className="border-b border-white/6">
        <div className="max-w-5xl mx-auto px-6 flex gap-6">
          <Link
            href="/admin/inventory"
            className="font-sans text-[11px] tracking-widest uppercase py-3 text-white/35 hover:text-white transition-colors"
          >
            Инвентар
          </Link>
          <span className="font-sans text-[11px] tracking-widest uppercase py-3 text-white border-b-2 border-white -mb-px">
            Клиенти
          </span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="border-b border-white/6 bg-white/2">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
          <div>
            <p className="font-sans text-[10px] text-white/30 tracking-wide uppercase">Общо контакти</p>
            <p className="font-sans text-lg text-white mt-0.5">{contacts.length}</p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div>
            <p className="font-sans text-[10px] text-white/30 tracking-wide uppercase">Дали съгласие</p>
            <p className="font-sans text-lg text-emerald-400 mt-0.5">{contacts.length}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {contacts.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-sans text-white/20 tracking-wide text-sm">
              Все още няма записани контакти. Появяват се при първа поръчка с отметка за маркетинг.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/35 text-left pb-3 pr-6 font-normal">
                    #
                  </th>
                  <th className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/35 text-left pb-3 pr-6 font-normal">
                    Имена
                  </th>
                  <th className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/35 text-left pb-3 pr-6 font-normal">
                    Телефон
                  </th>
                  <th className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/35 text-left pb-3 pr-6 font-normal">
                    Имейл
                  </th>
                  <th className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/35 text-left pb-3 font-normal">
                    Дата
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="py-3 pr-6 font-sans text-xs text-white/25">
                      {contacts.length - i}
                    </td>
                    <td
                      className="py-3 pr-6 text-sm text-white"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {c.name || "—"}
                    </td>
                    <td className="py-3 pr-6 font-sans text-sm">
                      <a
                        href={`tel:${c.phone}`}
                        className="text-white hover:text-white/60 transition-colors"
                      >
                        {c.phone || "—"}
                      </a>
                    </td>
                    <td className="py-3 pr-6 font-sans text-sm text-white/60">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="hover:text-white transition-colors"
                        >
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 font-sans text-xs text-white/30 whitespace-nowrap">
                      {c.date ? formatDate(c.date) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
