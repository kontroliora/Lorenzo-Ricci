import type { Metadata } from "next";
import Link from "next/link";
import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import {
  RO_COURIER_LABEL,
  RO_DELIVERY_DAYS,
  RO_FREE_SHIPPING_RON,
  RO_RETURN_DAYS,
  RO_SHIPPING_FEE_RON,
  fmtRON,
  ronPrice,
} from "@/lib/ro/config";

// Romania pays by card only (owner, 25.10.2026: no cash on delivery / ramburs). Products priced from EUR 1500 up are sold on
// advance payment arranged with the shop, exactly like on the Bulgarian site. LEGAL TEXT: have it reviewed by a Romanian lawyer.
const PREPAY_RON = fmtRON(ronPrice(PREPAYMENT_THRESHOLD_EUR));
const PREPAY_EUR = PREPAYMENT_THRESHOLD_EUR.toLocaleString("ro-RO");

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description: "Termenii și condițiile de vânzare la distanță ale magazinului Lorenzo Ricci: comandă, plata cu cardul sau în avans, livrare, drept de retragere, garanții (inclusiv garanția pe viață pentru bijuterii) și reclamații.",
  alternates: { canonical: "https://lorenzo-ricci.com/ro/politici/termeni" },
  other: { "content-language": "ro" },
};

export default function TermeniPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Informații juridice</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Termeni și condiții</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
        <PolicySection title="Informații despre vânzător">
          <p>
            Magazinul online lorenzo-ricci.com/ro este operat de <strong className="text-charcoal font-normal">Lorenzo Ricci EOOD</strong> (denumită în continuare „Lorenzo Ricci” sau „noi”).
            <br /><br />
            Adresa: ul. Petar Slabakov 33, Varna 9010, Bulgaria
            <br />
            E-mail:{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
            <br />
            Program: Luni-Vineri, 10:00-18:00
          </p>
          <p className="mt-3">
            Acești termeni se aplică contractelor la distanță încheiate prin intermediul acestui magazin, între Lorenzo Ricci și consumatori. Ei se citesc împreună cu{" "}
            <Link href="/ro/politici/livrare" className="text-navy hover:underline">Politica de livrare</Link>,{" "}
            <Link href="/ro/politici/retur" className="text-navy hover:underline">Politica de retur și schimb</Link> și{" "}
            <Link href="/ro/politici/confidentialitate" className="text-navy hover:underline">Politica de confidențialitate</Link>.
          </p>
        </PolicySection>

        <PolicySection title="Produsele noastre">
          <p>
            Magazinul oferă <strong className="text-charcoal font-normal">ceasuri</strong>, <strong className="text-charcoal font-normal">bijuterii</strong> (brățări și coliere), <strong className="text-charcoal font-normal">articole din piele de crocodil</strong> (portofele, port-carduri și clutch-uri / genți) și <strong className="text-charcoal font-normal">seturi</strong> formate din produse ale colecției. Caracteristicile fiecărui produs - materiale, dimensiuni, rezistență la apă și altele - sunt prezentate pe pagina produsului.
          </p>
          <p className="mt-3">
            Bijuteriile Lorenzo Ricci sunt realizate din oțel inoxidabil 316L, cu placare PVD în 4 straturi, aur 18K.
          </p>
          <p className="mt-3">
            Pielea de crocodil este un material natural: fiecare articol este unic, iar modelul și textura pot diferi ușor față de fotografiile din magazin. Aceasta este o caracteristică firească a pielii autentice și conferă fiecărui articol un caracter inconfundabil.
          </p>
        </PolicySection>

        <PolicySection title="Prețuri">
          <p>
            Prețurile sunt afișate în lei (RON). Livrarea este{" "}
            <strong className="text-charcoal font-normal">gratuită pentru comenzile de peste {fmtRON(RO_FREE_SHIPPING_RON)}</strong>; pentru comenzile de până la {fmtRON(RO_FREE_SHIPPING_RON)}, taxa de livrare este de{" "}
            <strong className="text-charcoal font-normal">{fmtRON(RO_SHIPPING_FEE_RON)}</strong>.
          </p>
          <p className="mt-3">
            Unele produse sunt oferite la reducere sau promoție. Regulile privind returnarea și schimbul produselor la reducere sunt descrise în secțiunea „Dreptul de retragere” de mai jos.
          </p>
        </PolicySection>

        <PolicySection title="Plasarea comenzii și încheierea contractului">
          <p>
            Pentru a comanda, adăugați produsul în coș, completați datele solicitate (nume, număr de telefon, adresa de livrare) și plătiți cu cardul, online, pe pagina securizată Stripe. Comanda se înregistrează numai după confirmarea plății; imediat după aceea vă trimitem confirmarea comenzii pe e-mail. Contractul la distanță se consideră încheiat în momentul în care vă confirmăm comanda.
          </p>
          <p className="mt-3">
            Pentru produsele care se comandă cu plata în avans (vezi secțiunea „Plata”), comanda se stabilește direct cu noi. Comenzile se onorează în limita stocului disponibil. Dacă doriți să anulați o comandă, scrieți-ne cât mai curând la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>.
          </p>
        </PolicySection>

        <PolicySection title="Plata">
          <p>
            Pentru produsele cu un preț sub <strong className="text-charcoal font-normal">{PREPAY_RON}</strong>, plata se face{" "}
            <strong className="text-charcoal font-normal">cu cardul</strong>, online, prin Stripe, în lei, la plasarea comenzii; suma plătită include costul livrării, iar la livrare nu se mai plătește nimic. Datele cardului sunt procesate de Stripe; nu le stocăm.
          </p>
          <p className="mt-3">
            Produsele cu un preț de la <strong className="text-charcoal font-normal">{PREPAY_RON}</strong> în sus (echivalentul a {PREPAY_EUR} EUR) se comandă cu{" "}
            <strong className="text-charcoal font-normal">plata în avans</strong>, stabilită direct cu noi. Pentru a comanda un astfel de produs, scrieți-ne la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>
            {" "}și vom stabili împreună cu dumneavoastră modalitatea de plată.
          </p>
        </PolicySection>

        <PolicySection title="Livrarea">
          <p>
            Livrăm în România, prin {RO_COURIER_LABEL}, la adresa de livrare indicată în comandă. Coletele sunt expediate din Bulgaria, iar livrarea durează de obicei{" "}
            <strong className="text-charcoal font-normal">{RO_DELIVERY_DAYS} zile lucrătoare</strong> de la expediere.
          </p>
          <p className="mt-3">
            Detalii complete:{" "}
            <Link href="/ro/politici/livrare" className="text-navy hover:underline">Politica de livrare</Link>.
          </p>
        </PolicySection>

        <PolicySection title={`Dreptul de retragere - ${RO_RETURN_DAYS} zile`}>
          <p>
            Ca persoană consumatoare, aveți dreptul să vă retrageți din contractul la distanță în termen de{" "}
            <strong className="text-charcoal font-normal">{RO_RETURN_DAYS} zile</strong> de la primirea produsului, fără a invoca vreun motiv, conform O.U.G. nr. 34/2014 privind drepturile consumatorilor în cadrul contractelor încheiate cu profesioniștii. Dreptul se aplică tuturor produselor, inclusiv celor achiziționate la reducere sau promoție.
          </p>
          <p className="mt-3">
            În plus, pentru produsele achiziționate la <strong className="text-charcoal font-normal">preț întreg</strong> oferim voluntar un schimb extins de 30 de zile. Produsele la reducere sau promoție <strong className="text-charcoal font-normal">nu beneficiază de schimbul de 30 de zile</strong> - pentru ele rămâne dreptul legal de retragere de {RO_RETURN_DAYS} zile, descris mai sus.
          </p>
          <p className="mt-3">
            Produsul returnat trebuie să fie în starea în care a fost primit: nepurtat și nefolosit, cu ambalajul original, cu toate accesoriile și cu certificatul de autenticitate; la bijuterii și la ceasuri, fără urme de purtare. Condițiile de exercitare și de rambursare sunt descrise în{" "}
            <Link href="/ro/politici/retur" className="text-navy hover:underline">Politica de retur și schimb</Link>.
          </p>
        </PolicySection>

        <PolicySection id="garantie" title="Garanții">
          <p className="font-serif text-base text-charcoal mb-2">Garanția legală de conformitate</p>
          <p>
            Toate produsele beneficiază de <strong className="text-charcoal font-normal">garanția legală de conformitate de 2 ani</strong>, conform legislației europene și Legii nr. 449/2003 privind vânzarea produselor și garanțiile asociate acestora. Această garanție nu poate fi exclusă sau limitată prin acești termeni și se aplică independent de orice garanție comercială. În cazul unui produs neconform aveți dreptul, în condițiile legii, la repararea sau înlocuirea produsului ori, atunci când legea o permite, la reducerea prețului sau la încetarea contractului.
          </p>

          <p className="font-serif text-base text-charcoal mt-6 mb-2">Garanția comercială pentru ceasuri - 5 ani</p>
          <p>
            Pentru ceasuri, Lorenzo Ricci oferă voluntar o <strong className="text-charcoal font-normal">garanție comercială de 5 ani</strong> de la data cumpărării, care acoperă defectele de fabricație ale mecanismului. În cazul unui defect constatat, ceasul se repară sau se înlocuiește gratuit. Garanția comercială se acordă <strong className="text-charcoal font-normal">în plus față de drepturile dumneavoastră legale</strong> de consumator și nu le limitează și nu le afectează în niciun fel. Ea este personală, valabilă doar pentru cumpărătorul inițial, și nu se poate transmite.
          </p>
          <p className="mt-3">
            Garanția comercială acoperă exclusiv defectele de fabricație, adică defectele de material sau de execuție constatate la utilizarea normală, conform destinației produsului. Nu acoperă:
          </p>
          <ul className="list-disc list-inside flex flex-col gap-2 mt-3">
            <li>deteriorarea sticlei de safir, a curelei sau brățării, a coroanei ori a carcasei din cauza utilizării necorespunzătoare, a loviturilor sau a căderii;</li>
            <li>daunele cauzate de pătrunderea apei, dacă ceasul a fost folosit în afara parametrilor de rezistență la apă ai modelului (5 ATM);</li>
            <li>bateria, după primele 6 luni de la data achiziției (aceasta este un consumabil);</li>
            <li>uzura estetică a carcasei și a curelei (zgârieturi, modificări ale acoperirii) rezultată din purtarea zilnică;</li>
            <li>repararea sau service-ul efectuat de terți neautorizați - orice intervenție a unui service neautorizat ori o încercare de reparare pe cont propriu anulează garanția comercială.</li>
          </ul>

          <p className="font-serif text-base text-charcoal mt-6 mb-2">Garanția comercială pentru bijuterii - pe viață</p>
          <p>
            Pentru bijuterii, Lorenzo Ricci oferă voluntar o <strong className="text-charcoal font-normal">garanție comercială pe viață</strong> împotriva defectelor de fabricație, fără limită de timp. În cazul unui defect de fabricație constatat - indiferent de data cumpărării - bijuteria se repară sau se înlocuiește gratuit. Ca și garanția pentru ceasuri, ea se acordă <strong className="text-charcoal font-normal">în plus față de drepturile dumneavoastră legale</strong> de consumator și nu le limitează și nu le afectează în niciun fel. Ea este personală, valabilă doar pentru cumpărătorul inițial, și nu se poate transmite.
          </p>
          <p className="mt-3">
            Garanția comercială pentru bijuterii nu acoperă:
          </p>
          <ul className="list-disc list-inside flex flex-col gap-2 mt-3">
            <li>pierderea sau furtul articolului ori distrugerea lui din motive care nu țin de calitatea fabricației;</li>
            <li>deteriorările cauzate de utilizarea necorespunzătoare sau de lovituri (deformări, rupturi sau elemente pierdute în urma utilizării brutale, a presării sau a depozitării necorespunzătoare);</li>
            <li>uzura naturală a placării - zgârieturile fine din folosirea zilnică și estomparea treptată, firească, a suprafețelor;</li>
            <li>reparațiile efectuate de terți sau modificările - orice intervenție a unor meșteri ori ateliere neautorizate sau o încercare de modificare pe cont propriu anulează garanția comercială;</li>
            <li>curățarea, lustruirea și întreținerea estetică, care se efectuează contra unui cost suplimentar, pe baza unei solicitări prealabile;</li>
            <li>desprinderea elementelor și a pietrelor din cauza purtării zilnice normale și a uzurii mecanice;</li>
            <li>uzura închizătorilor din cauza utilizării îndelungate.</li>
          </ul>
          <p className="mt-3">
            Excluderile de mai sus privesc numai garanțiile comerciale și nu afectează garanția legală de conformitate. Condițiile detaliate pentru bijuterii și ceasuri:{" "}
            <Link href="/ro/garantie-bijuterii" className="text-navy hover:underline">Condiții de garanție</Link>.
          </p>

          <p className="font-serif text-base text-charcoal mt-6 mb-2">Cum exercitați garanția</p>
          <ol className="list-decimal list-inside flex flex-col gap-3">
            <li>Scrieți-ne la info@lorenzo-ricci.com, cu o descriere a problemei și o fotografie a produsului</li>
            <li>Vă comunicăm adresa de expediere; costurile de transport pentru trimiterea produsului în garanție sunt suportate de noi</li>
            <li>Produsul este verificat, reparat sau înlocuit și vă este returnat</li>
          </ol>
        </PolicySection>

        <PolicySection title="Reclamații și soluționarea litigiilor">
          <p>
            Orice reclamație ne poate fi adresată la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>
            ; ne dorim să rezolvăm împreună orice problemă. Ca persoană consumatoare, vă puteți adresa și Autorității Naționale pentru Protecția Consumatorilor (ANPC) -{" "}
            <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">anpc.ro</a>
            {" "}- inclusiv pentru soluționarea alternativă a litigiilor (SAL).
          </p>
        </PolicySection>

        <PolicySection title="Date cu caracter personal">
          <p>
            Modul în care prelucrăm datele dumneavoastră cu caracter personal este descris în{" "}
            <Link href="/ro/politici/confidentialitate" className="text-navy hover:underline">Politica de confidențialitate</Link>.
          </p>
        </PolicySection>

        <PolicySection title="Drepturile dumneavoastră legale">
          <p>
            Nicio prevedere din acești termeni nu limitează drepturile pe care vi le recunoaște legea ca persoană consumatoare. Orice modificare a termenilor se aplică numai comenzilor plasate după publicarea ei.
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

function PolicySection({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-32">
      <h2 className="font-serif text-xl text-charcoal mb-4">{title}</h2>
      <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
        {children}
      </div>
      <div className="mt-8 h-px bg-border" />
    </section>
  );
}
