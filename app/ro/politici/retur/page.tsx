import type { Metadata } from "next";
import Link from "next/link";
import { RO_RETURN_DAYS } from "@/lib/ro/config";
import { roToBgPath } from "@/lib/ro/route-map";

const PATH = "/ro/politici/retur";

export const metadata: Metadata = {
  title: "Politica de retur și schimb",
  description: `Drept legal de retragere de ${RO_RETURN_DAYS} zile pentru toate produsele · Schimb extins de 30 de zile pentru produsele la preț întreg.`,
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: {
      "ro-RO": `https://lorenzo-ricci.com${PATH}`,
      "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}`,
    },
  },
  other: { "content-language": "ro" },
};

export default function ReturPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Drepturile dumneavoastră</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Politica de retur și schimb</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
        <PolicySection title={`Dreptul legal de retragere - ${RO_RETURN_DAYS} zile`}>
          <p>
            Conform legislației europene (Directiva 2011/83/UE) și O.U.G. nr. 34/2014 privind drepturile consumatorilor în cadrul contractelor încheiate cu profesioniștii, aveți dreptul să vă retrageți din contractul la distanță{" "}
            <strong className="text-charcoal font-normal">în termen de {RO_RETURN_DAYS} zile</strong> de la primirea produsului, fără a fi nevoie să invocați un motiv.
          </p>
          <p className="mt-3">
            Acest drept se aplică <strong className="text-charcoal font-normal">tuturor produselor</strong> - inclusiv celor achiziționate la reducere sau promoție. Este suficient să ne informați printr-o declarație clară, la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>. Vă rambursăm suma plătită, inclusiv costul livrării standard, fără întârzieri nejustificate și cel târziu în {RO_RETURN_DAYS} zile de la data la care ne comunicați decizia de retragere. Putem amâna rambursarea până la primirea produsului returnat sau până când dovediți că l-ați expediat înapoi.
          </p>
        </PolicySection>

        <PolicySection title="Schimb extins - 30 de zile (pentru produsele la preț întreg)">
          <p>
            Pe lângă dreptul dumneavoastră legal, oferim voluntar o{" "}
            <strong className="text-charcoal font-normal">politică extinsă de schimb de 30 de zile</strong> pentru produsele achiziționate la preț întreg - pentru ca dumneavoastră să aveți mai mult timp să alegeți în liniște.
          </p>
          <p className="mt-3">
            Pentru produsele la reducere sau promoție se aplică{" "}
            <strong className="text-charcoal font-normal">dreptul legal de retragere de {RO_RETURN_DAYS} zile</strong> (descris mai sus).
          </p>
        </PolicySection>

        <PolicySection title="Produse defecte">
          <p>
            Dacă un produs este defect sau nu corespunde descrierii, beneficiați de garanția legală de conformitate, în condițiile legii (repararea sau înlocuirea produsului ori, atunci când legea o permite, reducerea prețului sau încetarea contractului) - <strong className="text-charcoal font-normal">indiferent dacă a fost achiziționat la preț întreg sau redus</strong> și indiferent de termenele de mai sus.
          </p>
          <p className="mt-3">
            Separat de drepturile dumneavoastră legale, Lorenzo Ricci oferă și o <strong className="text-charcoal font-normal">garanție comercială</strong>: 5 ani pentru ceasuri și pe viață pentru bijuterii. Condițiile sunt descrise în{" "}
            <Link href="/ro/garantie-bijuterii" className="text-navy hover:underline">Condiții de garanție</Link>{" "}
            și în{" "}
            <Link href="/ro/politici/termeni#garantie" className="text-navy hover:underline">Termeni și condiții</Link>.
          </p>
        </PolicySection>

        <PolicySection title="Condiții">
          <p className="mb-3">Condițiile se aplică tuturor returnărilor și schimburilor:</p>
          <ul className="list-disc list-inside flex flex-col gap-2">
            <li>Produsul trebuie să fie nepurtat și nefolosit</li>
            <li>Cu etichetele și ambalajul original</li>
            <li>La bijuterii și ceasuri - fără urme de purtare</li>
          </ul>
          <p className="mt-3">
            În cazul retragerii legale din contract aveți dreptul să examinați produsul; dacă însă acesta a fost folosit peste ceea ce este necesar pentru verificare sau este returnat incomplet, valoarea rambursării poate fi diminuată corespunzător.
          </p>
        </PolicySection>

        <PolicySection title="Deteriorat în timpul transportului">
          <p>
            Dacă produsul a ajuns deteriorat, contactați-ne în termen de{" "}
            <strong className="text-charcoal font-normal">24 de ore</strong> de la primire, cu numărul comenzii și fotografii sau video, la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>.
          </p>
        </PolicySection>

        <PolicySection title="Procesul de retur / schimb">
          <ol className="list-decimal list-inside flex flex-col gap-3">
            <li>Scrieți-ne la info@lorenzo-ricci.com, cu numărul comenzii</li>
            <li>Vă vom trimite instrucțiunile de returnare</li>
            <li>După primirea și verificarea produsului - rambursăm suma sau expediem înlocuirea</li>
          </ol>
        </PolicySection>

        <PolicySection title="Costurile de transport la retur">
          <p>
            Costurile de returnare în cazul retragerii sau al schimbului sunt{" "}
            <strong className="text-charcoal font-normal">suportate de client</strong>. În cazul unui produs defect sau al unei greșeli din partea noastră, costurile sunt suportate de noi.
          </p>
        </PolicySection>

        <PolicySection title="Reclamații">
          <p>
            Dacă nu am reușit să rezolvăm împreună o problemă, vă puteți adresa Autorității Naționale pentru Protecția Consumatorilor (ANPC) -{" "}
            <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">anpc.ro</a>
            , inclusiv pentru soluționarea alternativă a litigiilor (SAL).
          </p>
        </PolicySection>

        <PolicySection title="Contact">
          <p>
            E-mail:{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
            <br />
            Luni-Vineri, 10:00-18:00
          </p>
        </PolicySection>
      </div>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-xl text-charcoal mb-4">{title}</h2>
      <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
        {children}
      </div>
      <div className="mt-8 h-px bg-border" />
    </section>
  );
}
