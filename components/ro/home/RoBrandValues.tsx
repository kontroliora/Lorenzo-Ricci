import { RO_DELIVERY_DAYS, RO_INSPECT_BEFORE_PAY, RO_RETURN_DAYS } from "@/lib/ro/config";

// Romanian counterpart of components/home/BrandValues.tsx (the brand quote), with the market's trust strip under it.
// Every figure comes from lib/ro/config.ts; the "check the parcel before paying" promise appears only when the
// courier has confirmed it (RO_INSPECT_BEFORE_PAY).
const VALUES = [
  {
    title: "Plata la livrare",
    desc: RO_INSPECT_BEFORE_PAY
      ? "Plătiți curierului la primirea coletului, după ce îl verificați (ramburs)."
      : "Plătiți curierului la primirea coletului (ramburs).",
  },
  {
    title: `Livrare în ${RO_DELIVERY_DAYS} zile lucrătoare`,
    desc: "După expediere, coletul ajunge la tine prin curier rapid.",
  },
  {
    title: "5 ani garanție comercială",
    desc: "La toate ceasurile, pentru fiecare mecanism.",
  },
  {
    title: `Retur în ${RO_RETURN_DAYS} zile`,
    desc: "Dreptul legal de retragere, conform legislației în vigoare.",
  },
];

export function RoBrandValues() {
  return (
    <section className="py-20 sm:py-28 border-y border-border bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <blockquote className="font-serif text-display-sm text-charcoal leading-relaxed">
            „Design italian rafinat și măiestrie în care
            <br />
            fiecare detaliu contează.”
          </blockquote>
          <div className="gold-divider mt-8" />
          <p className="font-sans text-xs text-ink-faint tracking-[0.25em] uppercase mt-4">
            Lorenzo Ricci · Creat cu caracter
          </p>
        </div>

        {/* Trust strip */}
        <div className="mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 border-t border-border pt-12 sm:pt-14">
          {VALUES.map(({ title, desc }) => (
            <div key={title} className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
              <div className="w-4 h-px bg-navy/40 mb-1" />
              <h3 className="font-sans text-[11px] font-medium tracking-[0.16em] uppercase text-charcoal">{title}</h3>
              <p className="font-sans text-xs font-light text-ink-muted leading-relaxed tracking-wide max-w-xs">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
