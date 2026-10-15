import { unstable_cache } from "next/cache";
import type { OfficeList, SlimCity, SlimOffice } from "./econt-label";
export { OFFICE_TYPE_LABEL, officeLabel } from "./econt-label";
export type { OfficeList, SlimCity, SlimOffice } from "./econt-label";

// Econt's official list of offices and automats (Econt API, Nomenclatures getOffices). It is public, needs no login, and is about
// 1.8 MB for Bulgaria, so it is cut down to what the checkout needs (code, name, address, city, type) and cached for a day.
// Used by GET /api/econt/offices (the checkout picker) and by POST /api/order (to check a chosen office code).

const ECONT_OFFICES_URL = "https://ee.econt.com/services/Nomenclatures/NomenclaturesService.getOffices.json";
const DAY = 24 * 60 * 60;

type RawOffice = {
  code?: string; name?: string; nameEn?: string; isAPS?: boolean; isMPS?: boolean;
  address?: { fullAddress?: string; city?: { id?: number; name?: string; nameEn?: string } };
};

/** Pure: Econt's raw answer -> the slim list the checkout uses. Exported for the tests. */
export function slimOffices(raw: { offices?: RawOffice[] }, now = new Date()): OfficeList {
  const offices: SlimOffice[] = [];
  const cities = new Map<number, SlimCity>();
  for (const o of raw.offices ?? []) {
    const city = o.address?.city;
    if (!o.code || !o.name || !city?.id || !city.name) continue;
    cities.set(city.id, { i: city.id, n: city.name, e: city.nameEn ?? "" });
    offices.push({
      c: String(o.code),
      n: o.name.trim(),
      e: (o.nameEn ?? "").trim(),
      a: (o.address?.fullAddress ?? "").replace(/\s+/g, " ").trim(),
      i: city.id,
      t: o.isAPS ? "a" : o.isMPS ? "m" : "o",
    });
  }
  const bg = (a: string, b: string) => a.localeCompare(b, "bg");
  return {
    updated: now.toISOString(),
    cities: [...cities.values()].sort((a, b) => bg(a.n, b.n)),
    offices: offices.sort((a, b) => a.i - b.i || bg(a.n, b.n)),
  };
}

async function fetchOffices(): Promise<OfficeList> {
  const r = await fetch(ECONT_OFFICES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countryCode: "BGR" }),
    cache: "no-store",                       // the raw answer is ~1.8 MB: only the slim list below is cached
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Econt getOffices HTTP ${r.status}`);
  const list = slimOffices(await r.json());
  if (list.offices.length < 20) throw new Error(`Econt getOffices returned only ${list.offices.length} offices`); // a broken answer is never cached
  return list;
}

// Refreshed once a day; an expired entry is served while the next one is fetched, and a failed refresh is never stored.
const cachedOffices = unstable_cache(fetchOffices, ["econt-offices-bg-v1"], { revalidate: DAY });
let lastGood: OfficeList | null = null; // second safety net (this server instance): the last list that worked

/** The office list, or null when Econt does not answer and nothing was ever loaded. */
export async function getOfficeList(): Promise<OfficeList | null> {
  try {
    lastGood = await cachedOffices();
    return lastGood;
  } catch (e) {
    console.error("[econt-offices] unavailable:", e instanceof Error ? e.message : e);
    return lastGood;
  }
}
