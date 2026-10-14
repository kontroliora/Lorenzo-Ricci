import Link from "next/link";
import Image from "next/image";
import { fmtRON, RO_DELIVERY_DAYS, RO_FREE_SHIPPING_RON, RO_INSPECT_BEFORE_PAY, RO_RETURN_DAYS } from "@/lib/ro/config";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";

// Romanian counterpart of components/layout/Footer.tsx (server component). Company name, e-mail, opening hours and
// the postal address are the ones the Bulgarian site already publishes (footer + privacy policy). No newsletter form
// and no social links. The trust badges take every figure from lib/ro/config.ts. The BG · RO switch sits in the brand column
// (the footer is one of the places it may live: never beside the cart icon in the header).
const TRUST = [
  { title: "5 ani garanție comercială", sub: "la ceasuri · pe viață la bijuterii" },
  { title: `${RO_DELIVERY_DAYS} zile lucrătoare`, sub: "Livrare în România" },
  { title: "Livrare gratuită", sub: `Pentru comenzi de peste ${fmtRON(RO_FREE_SHIPPING_RON)}` },
  RO_INSPECT_BEFORE_PAY
    ? { title: "Verificare înainte de plată", sub: "Plata la livrare (ramburs)" }
    : { title: `Retur în ${RO_RETURN_DAYS} zile`, sub: "Plata la livrare (ramburs)" },
];

export function RoFooter() {
  return (
    <footer className="bg-white border-t border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16">
        {/* Top grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-16">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Image src="/logo.webp" alt="Lorenzo Ricci" width={150} height={38} className="h-9 w-auto mb-5 logo-invert" />
            <p className="font-sans text-xs font-light text-ink-faint leading-relaxed tracking-wide mb-6">
              Create să impresioneze. Precizie în fiecare detaliu.
            </p>
            <p className="font-sans text-[10px] font-medium text-charcoal tracking-[0.18em] uppercase">
              Plata la livrare (ramburs)
            </p>
            <LanguageSwitch current="ro" size="lg" className="mt-5 text-charcoal" />
          </div>

          {/* Collections */}
          <div>
            <FooterHeading>Colecții</FooterHeading>
            <div className="flex flex-col gap-3">
              <FooterLink href="/ro/ceasuri">Ceasuri</FooterLink>
              <FooterLink href="/ro/bijuterii">Bijuterii</FooterLink>
              <FooterLink href="/ro/bijuterii#bracelets">Brățări</FooterLink>
              <FooterLink href="/ro/bijuterii#necklaces">Coliere</FooterLink>
              <FooterLink href="/ro/piele-de-crocodil">Articole din piele de crocodil</FooterLink>
              <FooterLink href="/ro/seturi">Seturi</FooterLink>
            </div>
          </div>

          {/* Customer care */}
          <div>
            <FooterHeading>Servicii clienți</FooterHeading>
            <div className="flex flex-col gap-3">
              <FooterLink href="/ro/intrebari-frecvente">Întrebări frecvente</FooterLink>
              <FooterLink href="/ro/politici/livrare">Livrare</FooterLink>
              <FooterLink href="/ro/politici/retur">Retur</FooterLink>
              <FooterLink href="/ro/garantie-bijuterii">Garanție bijuterii</FooterLink>
              <FooterLink href="/ro/ghid-ceas">Ghid ceas</FooterLink>
              <FooterLink href="/ro/politici/confidentialitate">Politica de confidențialitate</FooterLink>
              <FooterLink href="/ro/politici/termeni">Termeni și condiții</FooterLink>
            </div>
          </div>

          {/* Brand & contact */}
          <div>
            <FooterHeading>Lorenzo Ricci</FooterHeading>
            <div className="flex flex-col gap-3">
              <FooterLink href="/ro/despre-noi">Despre noi</FooterLink>
              <a href="mailto:info@lorenzo-ricci.com" className="font-sans text-xs font-light text-ink-muted hover:text-navy transition-colors duration-300 tracking-wide w-fit">
                info@lorenzo-ricci.com
              </a>
              <p className="font-sans text-xs font-light text-ink-faint tracking-wide leading-relaxed">Luni - Vineri, 10:00 - 18:00</p>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 py-10 border-y border-border mb-8">
          {TRUST.map(({ title, sub }) => (
            <div key={title} className="flex flex-col gap-1.5">
              <div className="w-4 h-px bg-navy/30 mb-1" />
              <p className="font-sans text-[11px] font-medium text-charcoal tracking-[0.12em] uppercase">{title}</p>
              <p className="font-sans text-[10px] font-light text-ink-faint tracking-wide">{sub}</p>
            </div>
          ))}
        </div>

        {/* Consumer protection (standard in Romanian shops) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 mb-8">
          <a
            href="https://anpc.ro"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[10px] font-light text-ink-muted hover:text-navy transition-colors duration-300 tracking-wide w-fit"
          >
            ANPC - Autoritatea Națională pentru Protecția Consumatorilor
          </a>
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-10">
          <div className="text-center sm:text-left">
            <p className="font-sans text-[10px] font-light text-ink-faint tracking-widest uppercase">
              © 2026 Lorenzo Ricci EOOD. Toate drepturile rezervate.
            </p>
            <p className="font-sans text-[10px] font-light text-ink-faint tracking-wide mt-1.5">
              Lorenzo Ricci EOOD · str. „Petar Slabakov” 33, Varna, 9010, Bulgaria
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 text-[9px] text-navy/60">★★★★★</div>
            <p className="font-sans text-[10px] font-light text-ink-faint tracking-widest uppercase">
              4,8 · 1000+ recenzii clienți (Bulgaria)
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy mb-5">
      {children}
    </h4>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-sans text-xs font-light text-ink-muted hover:text-navy transition-colors duration-300 tracking-wide w-fit">
      {children}
    </Link>
  );
}
