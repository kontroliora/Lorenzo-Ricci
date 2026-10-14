import type { Metadata } from "next";
import Link from "next/link";
import { roToBgPath } from "@/lib/ro/route-map";

const PATH = "/ro/ghid-ceas";

export const metadata: Metadata = {
  title: "Ghid de utilizare a ceasului",
  description:
    "Ghid complet de utilizare a cronografului Lorenzo Ricci cu mecanism de cuarț - reglarea orei, funcția de cronograf, îngrijire și întreținere.",
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: {
      "ro-RO": `https://lorenzo-ricci.com${PATH}`,
      "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}`,
    },
  },
  other: { "content-language": "ro" },
};

export default function GhidCeasPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      {/* Hero */}
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Lorenzo Ricci</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Ghid de utilizare a ceasului</h1>
        <div className="gold-divider" />
        <p className="font-sans text-xs font-light text-ink-muted max-w-md mx-auto mt-6 leading-relaxed tracking-wide">
          Cronograf cu mecanism japonez de cuarț · Noble Vanguard Collection
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-5 sm:px-8 mt-14 flex flex-col gap-12">

        {/* Intro */}
        <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
          Vă felicităm pentru achiziția cronografului Lorenzo Ricci. Acest ghid cuprinde funcțiile,
          reglajele și îngrijirea ceasului dumneavoastră, pentru a-i asigura o viață lungă și o
          funcționare precisă.
        </p>

        <Section number="1" title="Caracteristicile ceasului">
          <ul className="flex flex-col gap-3">
            <Item label="Mecanism japonez de cuarț">
              Alimentat cu baterie pentru măsurarea precisă a timpului. Precizie de ±15 secunde pe lună.
              Durata de viață a bateriei: 2 până la 3 ani.
            </Item>
            <Item label="Funcție de cronograf">
              Cronometru pentru măsurarea intervalelor de timp prin butoanele laterale.
            </Item>
            <Item label="Rezistență la apă 5 ATM">
              Potrivit pentru ploaie, stropi și plajă. Nu este destinat scufundărilor sau imersiei prelungite în apă.
              Butoanele nu trebuie apăsate sub apă.
            </Item>
            <Item label="Sticlă din cristal de safir">
              Oferă o claritate excepțională și rezistență la zgârieturi.
            </Item>
            <Item label="Oțel inoxidabil 316L">
              Calitate chirurgicală - hipoalergenic, rezistent la coroziune.
            </Item>
          </ul>
        </Section>

        <Section number="2" title="Reglarea orei">
          <ol className="flex flex-col gap-4 list-none">
            <Step n={1}>
              Trageți coroana (butonul lateral) în <strong className="text-charcoal font-normal">a doua poziție</strong> - veți simți un ușor declic.
            </Step>
            <Step n={2}>
              Rotiți coroana pentru a regla acul orelor și acul minutelor.
            </Step>
            <Step n={3}>
              Apăsați coroana înapoi, în <strong className="text-charcoal font-normal">poziția inițială</strong>, pentru a porni ceasul.
            </Step>
          </ol>
          <Note>
            Asigurați-vă că coroana este complet apăsată înainte de contactul cu apa.
          </Note>
        </Section>

        <Section number="3" title="Utilizarea cronografului">
          <ul className="flex flex-col gap-3">
            <Item label="Start / Stop">
              Apăsați butonul de sus (situat la ora 2) pentru pornirea și oprirea cronografului.
            </Item>
            <Item label="Resetare">
              Apăsați butonul de jos (situat la ora 4) pentru a readuce cronometrul la zero.
              Resetarea este posibilă numai când cronograful este oprit.
            </Item>
            <Item label="Citirea timpului">
              Cadranele mici (subcadranele) indică timpul scurs în minute și ore.
              Acul central al secundelor măsoară secundele.
            </Item>
          </ul>
          <Note>
            Nu apăsați butoanele sub apă - acest lucru poate afecta rezistența la apă.
          </Note>
        </Section>

        <Section number="4" title="Îngrijire și întreținere">
          <ul className="flex flex-col gap-3">
            <Item label="Schimbarea bateriei">
              Bateria japoneză de cuarț se schimbă la fiecare <strong className="text-charcoal font-normal">2 până la 3 ani</strong>, într-un service de ceasornicărie.
              Dacă ceasul merge mai slab sau s-a oprit - verificați bateria.
            </Item>
            <Item label="Curățare">
              Ștergeți carcasa și sticla cu o cârpă moale și uscată. Evitați detergenții agresivi și solvenții.
            </Item>
            <Item label="Depozitare">
              Păstrați ceasul departe de câmpuri magnetice puternice, de temperaturi ridicate și de lumina directă a soarelui.
            </Item>
            <Item label="Curea">
              Cureaua din silicon poate fi curățată cu o cârpă umedă. În cazul unei uzuri vizibile, o puteți înlocui.
            </Item>
          </ul>
        </Section>

        <Section number="5" title="Depanare">
          <ul className="flex flex-col gap-3">
            <Item label="Ceasul nu funcționează">
              Verificați dacă bateria este descărcată. Dacă problema persistă după schimbarea bateriei,
              contactați service-ul nostru.
            </Item>
            <Item label="Cronograful nu se resetează">
              Asigurați-vă că cronograful este oprit înainte de resetare. Dacă acele nu revin la zero,
              apelați la un service de ceasornicărie.
            </Item>
            <Item label="Ceasul rămâne în urmă sau se grăbește">
              Abaterile mici (±15 sec/lună) sunt normale pentru un mecanism de cuarț.
              O abatere mai mare impune verificarea bateriei sau a mecanismului.
            </Item>
            <Item label="Aburire sub sticlă">
              Condensul temporar poate apărea la schimbări bruște de temperatură.
              Dacă aburirea nu dispare, duceți ceasul la verificarea rezistenței la apă.
            </Item>
          </ul>
        </Section>

        <Section number="6" title="Garanția">
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
            Fiecare ceas Lorenzo Ricci beneficiază de <strong className="text-charcoal font-normal">5 ani garanție comercială pentru mecanism</strong>
            {" "}de la data cumpărării. Garanția acoperă defectele de fabricație și defectele mecanismului.
          </p>
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
            Garanția <strong className="text-charcoal font-normal">nu acoperă</strong> deteriorările cauzate de utilizarea necorespunzătoare,
            lovituri, reparații neautorizate, uzura normală sau pierdere.
          </p>
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
            Garanția comercială se acordă în plus față de drepturile dumneavoastră legale de consumator, inclusiv garanția legală de conformitate de 2 ani, pe care nu le afectează.
            Condiții detaliate:{" "}
            <Link href="/ro/garantie-bijuterii" className="text-navy hover:underline">Condiții de garanție</Link>.
          </p>
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
            Pentru service în garanție, contactați-ne la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>.
          </p>
        </Section>

      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <span className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy/50">{number}</span>
        <h2 className="font-serif text-xl text-charcoal">{title}</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-navy/30 mt-2 flex-shrink-0" />
      <span>
        <strong className="text-charcoal font-normal">{label} - </strong>
        {children}
      </span>
    </li>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
      <span className="flex-shrink-0 w-6 h-6 rounded-full border border-navy/20 text-navy/50 text-[11px] font-medium flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 border-l-2 border-navy/20 pl-4 py-1">
      <p className="font-sans text-xs font-light text-ink-faint leading-relaxed tracking-wide italic">
        {children}
      </p>
    </div>
  );
}
