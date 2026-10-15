"use client";
// Econt office / automat picker for the Bulgarian checkout: first the city, then an office or automat from Econt's official list
// (served by /api/econt/offices, refreshed once a day), with a search by name or address. If the list cannot be loaded the
// checkout shows its manual field instead (see useEcontOffices -> "failed"). Dark theme of the checkout, readable at 320 px.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { coInput } from "./ui";
import { OFFICE_TYPE_LABEL, type OfficeList, type SlimCity, type SlimOffice } from "@/lib/econt-label";

// ── Loading (one request per page view; the answer is cached by the browser / CDN for a day) ──────────────────────────────────
let inflight: Promise<OfficeList> | null = null;
function loadOffices(): Promise<OfficeList> {
  if (!inflight) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9000);
    inflight = fetch("/api/econt/offices", { signal: ctl.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<OfficeList>; })
      .then((d) => { if (!d.offices?.length) throw new Error("empty list"); return d; })
      .catch((e) => { inflight = null; throw e; })
      .finally(() => clearTimeout(timer));
  }
  return inflight;
}

export type OfficesState = { status: "idle" | "loading" | "ready" | "failed"; data: OfficeList | null };
/** Loads the list while `enabled`. "failed" = Econt (or our copy of its list) did not answer: the form falls back to manual entry. */
export function useEcontOffices(enabled: boolean): OfficesState {
  const [state, setState] = useState<OfficesState>({ status: "idle", data: null });
  useEffect(() => {
    if (!enabled || state.status === "ready") return;
    let live = true;
    setState((s) => (s.status === "failed" ? s : { ...s, status: "loading" }));
    loadOffices().then((d) => live && setState({ status: "ready", data: d })).catch(() => live && setState({ status: "failed", data: null }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return state;
}

// ── Search helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[„“”"'()]/g, "").replace(/^(гр\.?|с\.?|град|село)\s+/, "").replace(/\s+/g, " ").trim();
const findCity = (cities: SlimCity[], text: string): SlimCity | null => {
  const q = norm(text); if (!q) return null;
  return cities.find((c) => norm(c.n) === q || norm(c.e) === q) ?? null;
};

type Kind = "all" | "o" | "a";
const KINDS: { key: Kind; label: string }[] = [{ key: "all", label: "Всички" }, { key: "o", label: "Офиси" }, { key: "a", label: "Еконтомати" }];

function TypeBadge({ t }: { t: SlimOffice["t"] }) {
  const automat = t === "a";
  return (
    <span className={`inline-block rounded-[4px] px-1.5 py-[1px] font-sans text-[11px] font-medium ${automat ? "bg-[#2A2308] text-[#E5C76B]" : "bg-[#2A2A2A] text-[#D6D6D6]"}`}>
      {OFFICE_TYPE_LABEL[t]}
    </span>
  );
}

export function EcontOfficePicker({
  data, cityHint, selected, onCity, onSelect, error, errorId,
}: {
  data: OfficeList;
  cityHint: string;                         // what the customer already typed in the form's «Град» field
  selected: SlimOffice | null;
  onCity: (city: SlimCity) => void;         // the customer chose a city: the form's «Град» follows
  onSelect: (office: SlimOffice | null) => void;
  error?: string;
  errorId?: string;
}) {
  const uid = useId();
  const cityId = `${uid}-city`, searchId = `${uid}-search`, listId = `${uid}-cities`;
  const selectedCity = useMemo(() => (selected ? data.cities.find((c) => c.i === selected.i) ?? null : null), [selected, data.cities]);
  const [city, setCity] = useState<SlimCity | null>(() => selectedCity ?? findCity(data.cities, cityHint));
  const [cityText, setCityText] = useState(() => (selectedCity ?? findCity(data.cities, cityHint))?.n ?? cityHint);
  const [cityOpen, setCityOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const touched = useRef(false);

  // The customer typed their city in the form first: follow it until they use the picker's own city box.
  useEffect(() => {
    if (touched.current || selected) return;
    const c = findCity(data.cities, cityHint);
    setCity(c); setCityText(c?.n ?? cityHint);
  }, [cityHint, data.cities, selected]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const o of data.offices) m.set(o.i, (m.get(o.i) ?? 0) + 1);
    return m;
  }, [data.offices]);

  const suggestions = useMemo(() => {
    const nq = norm(cityText);
    if (!nq) return [...data.cities].sort((a, b) => (counts.get(b.i) ?? 0) - (counts.get(a.i) ?? 0)).slice(0, 8);
    const starts = data.cities.filter((c) => norm(c.n).startsWith(nq) || norm(c.e).startsWith(nq));
    const rest = data.cities.filter((c) => !starts.includes(c) && (norm(c.n).includes(nq) || norm(c.e).includes(nq)));
    return [...starts, ...rest].slice(0, 8);
  }, [cityText, data.cities, counts]);

  const pickCity = (c: SlimCity) => {
    touched.current = true;
    setCity(c); setCityText(c.n); setCityOpen(false); setQ(""); setKind("all");
    if (selected && selected.i !== c.i) onSelect(null);
    onCity(c);
  };

  const offices = useMemo(() => {
    if (!city) return [];
    const nq = norm(q);
    return data.offices.filter((o) => o.i === city.i && (kind === "all" || (kind === "o" ? o.t !== "a" : o.t === "a")) &&
      (!nq || norm(`${o.n} ${o.e} ${o.a}`).includes(nq)));
  }, [city, data.offices, q, kind]);
  const inCity = city ? counts.get(city.i) ?? 0 : 0;

  // ── A choice was made: show it as a card (with a way back) ──
  if (selected) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3 rounded-[8px] border border-[#C9A84C] bg-[#1B180D] p-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-[2px] flex-shrink-0">
            <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2"><TypeBadge t={selected.t} /><span className="font-sans text-[13px] text-[#C9C9C9]">код {selected.c}</span></div>
            <span className="break-words font-serif text-base leading-snug text-white">{selected.n}</span>
            <span className="break-words font-sans text-[13px] leading-snug text-[#B0B0B0]">{selected.a}</span>
          </div>
          <button type="button" onClick={() => onSelect(null)} className="flex-shrink-0 font-sans text-[13px] font-medium text-[#D4AF37] underline underline-offset-2 hover:text-white">Промени</button>
        </div>
      </div>
    );
  }

  const onCityKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCityOpen(true); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && cityOpen && suggestions[active]) { e.preventDefault(); pickCity(suggestions[active]); }
    else if (e.key === "Escape") setCityOpen(false);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="econt-picker">
      {/* the message comes FIRST: a customer who pressed the order button is taken here and must see it without scrolling */}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 font-sans text-[13px] font-normal text-[#F87171]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[3px] flex-shrink-0">
            <circle cx="8" cy="8" r="7" stroke="#F87171" strokeWidth="1.5" /><path d="M8 4.5v4" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="11" r="0.9" fill="#F87171" />
          </svg>
          <span>{error}</span>
        </p>
      )}
      {/* 1. city */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={cityId} className="font-sans text-[13px] font-medium text-[#E6E6E6]">Град на офиса или автомата</label>
        <div className="relative">
          <input
            id={cityId} type="text" role="combobox" aria-expanded={cityOpen} aria-controls={listId} aria-autocomplete="list"
            autoComplete="off" placeholder="Започнете да пишете града..."
            value={cityText}
            onChange={(e) => { touched.current = true; setCityText(e.target.value); setCityOpen(true); setActive(0); if (city && norm(e.target.value) !== norm(city.n)) setCity(null); }}
            onFocus={() => setCityOpen(true)}
            onBlur={() => setTimeout(() => setCityOpen(false), 150)}
            onKeyDown={onCityKey}
            className={coInput(!!error && !city)} aria-invalid={error && !city ? true : undefined} aria-describedby={error ? errorId : undefined}
          />
          {cityOpen && suggestions.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Градове" className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-[8px] border border-[#606060] bg-[#101010] shadow-lg">
              {suggestions.map((c, i) => (
                <li key={c.i} role="option" aria-selected={i === active}>
                  <button
                    type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickCity(c)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left font-sans text-[15px] text-white ${i === active ? "bg-[#1F1F1F]" : "hover:bg-[#1A1A1A]"}`}
                  >
                    <span className="min-w-0 break-words">{c.n}</span>
                    <span className="flex-shrink-0 text-[13px] text-[#A0A0A0]">{counts.get(c.i) ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 2. office or automat of that city, with search */}
      <div className="flex flex-col gap-2.5">
        <label htmlFor={searchId} className="font-sans text-[13px] font-medium text-[#E6E6E6]">Офис или автомат на Еконт</label>
        {!city ? (
          <p className={`rounded-[8px] border bg-[#141414] px-3.5 py-3 font-sans text-[13px] text-[#A0A0A0] ${error ? "border-[#F87171]" : "border-[#2F2F2F]"}`}>Изберете град, за да видите офисите и автоматите.</p>
        ) : (
          <>
            <input id={searchId} type="search" autoComplete="off" placeholder="Търсене по име или адрес" value={q} onChange={(e) => setQ(e.target.value)} className={coInput(false)} />
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Вид">
              {KINDS.map((k) => (
                <button
                  key={k.key} type="button" onClick={() => setKind(k.key)} aria-pressed={kind === k.key}
                  className={`rounded-full border px-3 py-1 font-sans text-[13px] ${kind === k.key ? "border-[#C9A84C] bg-[#1B180D] text-[#E5C76B]" : "border-[#606060] text-[#C9C9C9] hover:border-[#8A8A8A]"}`}
                >
                  {k.label}
                </button>
              ))}
              <span className="ml-auto font-sans text-[13px] text-[#A0A0A0]">{offices.length} от {inCity}</span>
            </div>
            {offices.length === 0 ? (
              <p className="rounded-[8px] border border-[#2F2F2F] bg-[#141414] px-3.5 py-3 font-sans text-[13px] text-[#A0A0A0]">Няма офис или автомат по това търсене.</p>
            ) : (
              <ul aria-label="Офиси и автомати" className={`max-h-[320px] divide-y divide-[#2F2F2F] overflow-y-auto rounded-[8px] border bg-[#101010] ${error ? "border-[#F87171]" : "border-[#606060]"}`}>
                {offices.map((o) => (
                  <li key={o.c}>
                    <button type="button" onClick={() => onSelect(o)} className="flex w-full flex-col items-start gap-1 px-3.5 py-3 text-left hover:bg-[#1A1A1A] focus-visible:bg-[#1F1F1F] focus-visible:outline-none">
                      <span className="flex flex-wrap items-center gap-2"><TypeBadge t={o.t} /><span className="font-sans text-[13px] text-[#A0A0A0]">код {o.c}</span></span>
                      <span className="break-words font-sans text-[15px] leading-snug text-white">{o.n}</span>
                      <span className="break-words font-sans text-[13px] leading-snug text-[#B0B0B0]">{o.a}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

    </div>
  );
}
