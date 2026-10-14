import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { roToBgPath } from "@/lib/ro/route-map";

const PATH = "/ro/garantie-bijuterii";

export const metadata: Metadata = {
  title: "Condiții de garanție",
  description:
    "Condițiile de garanție Lorenzo Ricci - garanție comercială pe viață pentru bijuterii și garanție comercială de 5 ani pentru ceasuri. Aflați ce acoperim și cum vă puteți exercita drepturile.",
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: {
      "ro-RO": `https://lorenzo-ricci.com${PATH}`,
      "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}`,
    },
  },
  other: { "content-language": "ro" },
};

// ── Data ──────────────────────────────────────────────────────────────────

const JEWELLERY_COVERED = [
  {
    title: "Defecte de fabricație și de execuție",
    sub: "Pe viață",
    desc: "Orice articol la care se constată un defect de fabricație - indiferent de data cumpărării - se repară sau se înlocuiește gratuit.",
  },
];

const JEWELLERY_NOT_COVERED = [
  {
    title: "Pierderea sau furtul articolului",
    desc: "Garanția nu acoperă cazurile de pierdere, furt sau distrugere a articolului din motive care nu țin de calitatea fabricației.",
  },
  {
    title: "Deteriorări cauzate de utilizarea necorespunzătoare sau de lovituri",
    desc: "Deformările, rupturile sau elementele pierdute în urma utilizării brutale, a loviturilor, a presării sau a depozitării necorespunzătoare nu sunt incluse.",
  },
  {
    title: "Uzura naturală a placării",
    desc: "Zgârieturile fine din folosirea zilnică și estomparea treptată, firească, a suprafețelor sunt un rezultat normal al purtării și nu constituie defect.",
  },
  {
    title: "Reparații efectuate de terți sau modificări",
    desc: "Orice intervenție a unor meșteri ori ateliere neautorizate sau încercările de modificare pe cont propriu anulează automat garanția comercială.",
  },
  {
    title: "Curățare, lustruire și întreținere estetică",
    desc: "Serviciile de curățare și lustruire nu sunt incluse în garanție și se efectuează contra unui cost suplimentar, pe baza unei solicitări prealabile.",
  },
  {
    title: "Desprinderea elementelor și a pietrelor din cauza uzurii",
    desc: "Desprinderea sau căderea elementelor în urma purtării zilnice normale și a uzurii mecanice nu este acoperită de garanție.",
  },
  {
    title: "Uzura închizătorilor din cauza utilizării",
    desc: "Deformările sau funcționarea necorespunzătoare a închizătorilor, rezultate din folosirea zilnică îndelungată, nu intră în acoperirea garanției.",
  },
];

const WATCH_COVERED = [
  {
    title: "Defecte de fabricație ale mecanismului",
    sub: "5 ani",
    desc: "Garanția acoperă defectele de fabricație ale mecanismului pe o perioadă de 5 ani de la data cumpărării. La constatarea unui defect, ceasul se repară sau se înlocuiește gratuit.",
  },
];

const WATCH_NOT_COVERED = [
  {
    title: "Deteriorări ale sticlei, curelei sau brățării, coroanei și carcasei",
    desc: "Deteriorările sticlei de safir, ale curelei sau brățării, ale coroanei ori ale carcasei, cauzate de utilizarea necorespunzătoare, lovituri sau cădere, nu sunt acoperite de garanție.",
  },
  {
    title: "Daune cauzate de pătrunderea apei peste parametrii admiși",
    desc: "Garanția nu acoperă daunele cauzate de pătrunderea apei, dacă ceasul a fost folosit în afara parametrilor de rezistență la apă indicați pentru model (5 ATM).",
  },
  {
    title: "Bateria, după primele 6 luni",
    desc: "Bateria este considerată consumabil și nu este acoperită de garanție după expirarea primelor 6 luni de la data cumpărării.",
  },
  {
    title: "Uzura estetică a carcasei și a curelei",
    desc: "Zgârieturile carcasei, modificările acoperirii și uzura curelei rezultate din folosirea zilnică sunt un rezultat normal al purtării și nu constituie defect de fabricație.",
  },
  {
    title: "Reparații sau service efectuate de terți neautorizați",
    desc: "Orice intervenție a unui service neautorizat sau încercare de reparare pe cont propriu anulează automat garanția comercială.",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="w-4 h-px bg-navy/30" />
      <p className="font-sans text-[10px] font-medium tracking-[0.3em] uppercase text-navy">
        {children}
      </p>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

interface CoveredItem { title: string; sub: string; desc: string }
interface NotCoveredItem { title: string; desc: string }

function WarrantyTable({
  covered,
  notCovered,
}: {
  covered: CoveredItem[];
  notCovered: NotCoveredItem[];
}) {
  return (
    <div className="border border-border overflow-hidden">
      {/* Covered */}
      <div className="bg-white">
        <div className="px-6 py-4 border-b border-border bg-ivory-warm flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" strokeWidth={1.5} />
          <h3 className="font-sans text-[11px] font-medium tracking-[0.2em] uppercase text-charcoal">
            Ce include garanția
          </h3>
        </div>
        {covered.map((item, i) => (
          <div
            key={item.title}
            className={`px-6 py-5 flex gap-4 ${i < covered.length - 1 ? "border-b border-border" : ""}`}
          >
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <p className="font-sans text-sm font-medium text-charcoal">{item.title}</p>
                <span className="font-sans text-[10px] tracking-widest uppercase text-navy/70">{item.sub}</span>
              </div>
              <p className="font-sans text-xs font-light text-ink-muted leading-relaxed mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Not covered */}
      <div className="bg-white border-t-2 border-border">
        <div className="px-6 py-4 border-b border-border bg-ivory-warm flex items-center gap-3">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" strokeWidth={1.5} />
          <h3 className="font-sans text-[11px] font-medium tracking-[0.2em] uppercase text-charcoal">
            Ce nu include garanția
          </h3>
        </div>
        {notCovered.map((item, i) => (
          <div
            key={item.title}
            className={`px-6 py-5 flex gap-4 ${i < notCovered.length - 1 ? "border-b border-border" : ""}`}
          >
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-sans text-sm font-medium text-charcoal">{item.title}</p>
              <p className="font-sans text-xs font-light text-ink-muted leading-relaxed mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function GarantieBijuteriiPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">

      {/* Hero */}
      <div className="py-20 sm:py-28 px-5 sm:px-8 text-center bg-charcoal-deep border-b border-white/5 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px)",
          }}
        />
        <div className="relative z-10">
          <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/40 mb-5">
            Lorenzo Ricci · Informații juridice
          </p>
          <h1 className="font-serif text-display-lg text-white mb-5">
            Condiții de garanție
          </h1>
          <div className="w-10 h-px bg-white/20 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/50 max-w-lg mx-auto leading-relaxed tracking-widest uppercase">
            Bijuterii · Ceasuri
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8">

        {/* ── Section 1: Condiții generale ───────────────────────────── */}
        <div className="mt-16 mb-14">
          <SectionLabel>01 · Condiții generale</SectionLabel>
          <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide flex flex-col gap-4">
            <p>
              Prezentele condiții de garanție se aplică ceasurilor și bijuteriilor{" "}
              <strong className="text-charcoal font-normal">Lorenzo Ricci</strong> și reglementează
              drepturile și obligațiile ambelor părți în cazul defectelor de fabricație. Garanția
              este personală, valabilă numai pentru cumpărătorul inițial, și nu poate fi transmisă.
            </p>
            <p>
              Garanția intră în vigoare de la{" "}
              <strong className="text-charcoal font-normal">data cumpărării</strong> și acoperă
              exclusiv{" "}
              <strong className="text-charcoal font-normal">defectele de fabricație</strong> -
              adică defectele de material sau de execuție constatate la utilizarea normală,
              conform destinației produsului. Ea nu acoperă deteriorările cauzate de utilizarea
              necorespunzătoare, de accidente sau de uzura normală.
            </p>
            <p>
              Garanția pentru ceasuri este o{" "}
              <strong className="text-charcoal font-normal">garanție comercială</strong>, oferită
              voluntar de Lorenzo Ricci pentru o perioadă de{" "}
              <strong className="text-charcoal font-normal">5 ani</strong>, iar pentru bijuterii -
              pe viață. Ea se acordă în plus față de drepturile dumneavoastră legale de consumator
              și nu le limitează și nu le afectează în niciun fel.
            </p>
            <p>
              Independent de aceste garanții comerciale, toate produsele beneficiază de{" "}
              <strong className="text-charcoal font-normal">garanția legală de conformitate de 2 ani</strong>,
              conform legislației europene și Legii nr. 449/2003 privind vânzarea produselor și
              garanțiile asociate acestora. Garanția legală nu poate fi exclusă sau limitată prin
              prezentele condiții, iar excluderile de mai jos privesc numai garanțiile comerciale.
              Detalii:{" "}
              <Link href="/ro/politici/termeni#garantie" className="text-navy hover:underline">Termeni și condiții</Link>.
            </p>
          </div>
        </div>

        {/* ── Section 2: Garanția pentru bijuterii ────────────────────── */}
        <div className="mb-16">
          <SectionLabel>02 · Garanția pentru bijuterii</SectionLabel>
          <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-8 flex flex-col gap-3">
            <p>
              Fiecare bijuterie Lorenzo Ricci este realizată din{" "}
              <strong className="text-charcoal font-normal">oțel chirurgical 316L</strong> cu{" "}
              <strong className="text-charcoal font-normal">placare PVD în 4 straturi, aur 18K</strong>,
              hipoalergenică și rezistentă la apă, transpirație și parfum. Stăm în spatele fiecărui
              articol cu o garanție pe viață împotriva defectelor de fabricație - fără limită de timp.
            </p>
          </div>
          <WarrantyTable covered={JEWELLERY_COVERED} notCovered={JEWELLERY_NOT_COVERED} />
        </div>

        {/* ── Editorial divider image ───────────────────────────── */}
        <div className="relative w-full aspect-[16/7] overflow-hidden mb-16">
          <Image
            src="/beautiful/chrono-rain.webp"
            alt="Ceasuri Lorenzo Ricci - precizie și rezistență"
            fill
            quality={85}
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover object-center"
            unoptimized
          />
          <div className="absolute inset-0 bg-charcoal-deep/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p className="font-sans text-[9px] font-medium tracking-[0.35em] uppercase text-white/60 mb-3">
              Lorenzo Ricci · Ceasuri
            </p>
            <p className="font-serif text-2xl sm:text-3xl text-white leading-tight">
              Precizie inginerească.<br />Garanție documentată.
            </p>
          </div>
        </div>

        {/* ── Section 3: Garanția pentru ceasuri ─────────────────── */}
        <div className="mb-16">
          <SectionLabel>03 · Garanția pentru ceasuri</SectionLabel>
          <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-8 flex flex-col gap-3">
            <p>
              Fiecare ceas Lorenzo Ricci este construit cu{" "}
              <strong className="text-charcoal font-normal">carcasă din oțel inoxidabil 316L</strong>,{" "}
              <strong className="text-charcoal font-normal">sticlă din cristal de safir</strong> și
              un mecanism precis de cronograf. Garanția acoperă defectele de fabricație ale
              mecanismului pe o perioadă de{" "}
              <strong className="text-charcoal font-normal">5 ani</strong> de la data
              cumpărării.
            </p>
          </div>
          <WarrantyTable covered={WATCH_COVERED} notCovered={WATCH_NOT_COVERED} />
        </div>

        {/* ── Cum exercitați garanția ──────────────────────── */}
        <div className="border border-border p-8 mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-4 h-px bg-navy/30" />
            <h2 className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy">
              Cum exercitați garanția
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                n: "01",
                title: "Contactați-ne",
                desc: "Trimiteți un e-mail la info@lorenzo-ricci.com cu descrierea problemei și o fotografie a articolului.",
              },
              {
                n: "02",
                title: "Trimiteți articolul",
                desc: "Vă comunicăm adresa de expediere. Costurile de transport pentru trimiterea articolului în garanție sunt suportate de noi.",
              },
              {
                n: "03",
                title: "Primiți articolul înapoi",
                desc: "Articolul este verificat, reparat sau înlocuit și vă este returnat.",
              },
            ].map(({ n, title, desc }) => (
              <div key={n}>
                <p className="font-sans text-[10px] font-light text-navy/40 tracking-[0.2em] mb-2">{n}</p>
                <p className="font-sans text-sm font-medium text-charcoal mb-1.5">{title}</p>
                <p className="font-sans text-xs font-light text-ink-muted leading-relaxed tracking-wide">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="text-center">
          <p className="font-sans text-xs font-light text-ink-faint tracking-wide">
            Aveți întrebări despre garanție? Scrieți-ne la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
