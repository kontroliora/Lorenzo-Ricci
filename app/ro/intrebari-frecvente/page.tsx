import type { Metadata } from "next";
import Link from "next/link";
import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import { roToBgPath } from "@/lib/ro/route-map";
import {
  RO_COURIER_LABEL,
  RO_DELIVERY_DAYS,
  RO_FREE_SHIPPING_RON,
  RO_RETURN_DAYS,
  RO_SHIPPING_FEE_RON,
  fmtRON,
  ronPrice,
} from "@/lib/ro/config";

const PATH = "/ro/intrebari-frecvente";

// Romania pays by card only (no cash on delivery). Products priced from EUR 1500 up are sold on advance payment arranged with the
// shop, exactly like on the Bulgarian site.
const PREPAY_RON = fmtRON(ronPrice(PREPAYMENT_THRESHOLD_EUR));
const PREPAY_EUR = PREPAYMENT_THRESHOLD_EUR.toLocaleString("ro-RO");

export const metadata: Metadata = {
  title: "Întrebări frecvente",
  description: "Răspunsuri la cele mai frecvente întrebări despre ceasurile, bijuteriile și articolele din piele de crocodil Lorenzo Ricci: comandă, plată, livrare, garanție și retur.",
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: {
      "ro-RO": `https://lorenzo-ricci.com${PATH}`,
      "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}`,
    },
  },
  other: { "content-language": "ro" },
};

type FaqItem = {
  q: string;
  a: React.ReactNode;
  link?: { text: string; href: string };
};

const faqs: { category: string; items: FaqItem[] }[] = [
  {
    category: "CEASURI",
    items: [
      {
        q: "Din ce materiale sunt realizate ceasurile voastre?",
        a: "Ceasurile Lorenzo Ricci au sticlă din cristal de safir și mecanism japonez de cuarț. La modelele Chrono Black, Golden Eclipse și Polar Frost, carcasa este din oțel inoxidabil premium 316L - oțel de calitate chirurgicală, hipoalergenic și rezistent la coroziune. Specificațiile exacte ale fiecărui model sunt afișate pe pagina produsului.",
      },
      {
        q: "Sunt potrivite pentru pielea sensibilă?",
        a: "Da. Oțelul inoxidabil premium 316L și curelele de calitate superioară sunt hipoalergenice și potrivite pentru pielea sensibilă.",
      },
      {
        q: "Sunt rezistente la apă?",
        a: "Toate modelele au rezistență la apă de 5 ATM (50 m) - potrivite pentru ploaie, spălat și plajă. Nu recomandăm scufundarea sau imersia prelungită în apă.",
      },
      {
        q: "Se va estompa culoarea?",
        a: "Nu. Acoperirea este rezistentă, iar oțelul premium 316L nu ruginește și nu se întunecă la utilizare normală.",
      },
      {
        q: "Cum reglez ceasul?",
        a: "Trageți coroana în poziția dorită și rotiți-o pentru a regla ora. Ghidul complet de utilizare este disponibil la primirea ceasului.",
        link: { text: "Ghidul de utilizare a ceasului", href: "/ro/ghid-ceas" },
      },
      {
        q: "Cât rezistă mecanismul?",
        a: "Mecanismul japonez de cuarț este proiectat pentru cel puțin 10 ani de funcționare precisă. Bateria se schimbă, de regulă, la fiecare 2-3 ani.",
      },
    ],
  },
  {
    category: "BIJUTERII",
    items: [
      {
        q: "Se estompează placarea aurie?",
        a: "Placarea PVD în 4 straturi, aur 18K, este concepută să reziste mulți ani. Tehnologia este semnificativ mai durabilă decât placarea standard, într-un singur strat. Ca orice acoperire, la purtarea zilnică poate prezenta în timp o uzură naturală, care nu constituie defect de fabricație.",
        link: { text: "Vedeți condițiile de garanție", href: "/ro/garantie-bijuterii" },
      },
      {
        q: "Din ce materiale sunt realizate bijuteriile?",
        a: "Din oțel inoxidabil 316L, cu placare PVD Gold 18K în 4 straturi - o tehnologie folosită de mărci de bijuterii de lux.",
      },
      {
        q: "Pot uda bijuteriile?",
        a: "Da. Materialul nu ruginește și nu se întunecă. Recomandăm evitarea apei sărate și a clorului, pentru o durabilitate maximă.",
      },
      {
        q: "Ce marcaje au bijuteriile?",
        a: "„750” pentru placarea de 18K, „IT / ITALY” pentru designul italian și „LR” pentru sigla Lorenzo Ricci.",
      },
      {
        q: "Cum întrețin bijuteriile?",
        a: "Curățați-le cu o cârpă moale și evitați parfumurile sau substanțele chimice puternice aplicate direct pe suprafață.",
      },
    ],
  },
  {
    category: "COMANDĂ ȘI LIVRARE",
    items: [
      {
        q: "Cum plasez o comandă?",
        a: "Adăugați produsul în coș, completați datele dumneavoastră (nume, telefon, adresa de livrare) și plătiți cu cardul, online, pe pagina securizată Stripe. Imediat după plată primiți confirmarea comenzii pe e-mail.",
      },
      {
        q: "Cum plătesc?",
        a: (
          <>
            Pentru produsele cu un preț sub {PREPAY_RON}, plata se face cu cardul, online, prin Stripe, în lei, la plasarea comenzii;
            prețul livrării este cel afișat în coș. Nu aveți nimic de plătit curierului la livrare.
            {" "}Produsele cu un preț de la {PREPAY_RON} în sus (echivalentul a {PREPAY_EUR} EUR) se comandă cu plata în avans, stabilită direct cu noi. Scrieți-ne la info@lorenzo-ricci.com și vom stabili împreună modalitatea de plată.
          </>
        ),
      },
      {
        q: "Cât costă livrarea?",
        a: `Livrarea este gratuită pentru comenzile de peste ${fmtRON(RO_FREE_SHIPPING_RON)}. Pentru comenzile de până la ${fmtRON(RO_FREE_SHIPPING_RON)}, taxa de livrare este de ${fmtRON(RO_SHIPPING_FEE_RON)}.`,
        link: { text: "Politica de livrare", href: "/ro/politici/livrare" },
      },
      {
        q: "Când voi primi comanda?",
        a: `Comenzile sunt expediate din Bulgaria prin ${RO_COURIER_LABEL}. Livrarea durează de obicei ${RO_DELIVERY_DAYS} zile lucrătoare de la expediere.`,
      },
      {
        q: "Pot anula comanda?",
        a: "Da, scrieți-ne la info@lorenzo-ricci.com cât mai curând posibil.",
      },
    ],
  },
  {
    category: "GARANȚIE ȘI RETUR",
    items: [
      {
        q: "Ce garanție au ceasurile?",
        a: "Lorenzo Ricci oferă o garanție comercială de 5 ani pentru mecanism, în plus față de drepturile dumneavoastră legale de consumator (inclusiv garanția legală de conformitate de 2 ani). Aceasta acoperă defectele de fabricație. Nu acoperă: carcasa, sticla, cureaua, catarama, daunele cauzate de utilizarea necorespunzătoare sau de lovituri.",
        link: { text: "Vedeți condițiile detaliate de garanție", href: "/ro/politici/termeni#garantie" },
      },
      {
        q: "Ce garanție au bijuteriile?",
        a: "Garanție comercială pe viață pentru toate bijuteriile din colecția Lorenzo Ricci - acoperă defectele de fabricație, fără limită de timp. Ea se acordă în plus față de drepturile dumneavoastră legale de consumator (inclusiv garanția legală de conformitate de 2 ani).",
        link: { text: "Vedeți condițiile detaliate de garanție", href: "/ro/garantie-bijuterii" },
      },
      {
        q: "Pot returna un produs?",
        a: `Da. Aveți dreptul legal de retragere din contract în termen de ${RO_RETURN_DAYS} zile de la primire, pentru toate produsele. În plus, pentru produsele achiziționate la preț întreg oferim voluntar un schimb de 30 de zile, dacă produsul este nefolosit și în ambalajul original. Scrieți-ne la info@lorenzo-ricci.com pentru instrucțiuni.`,
        link: { text: "Politica de retur și schimb", href: "/ro/politici/retur" },
      },
      {
        q: "Ce fac dacă produsul este defect?",
        a: "Dacă un produs este defect sau nu corespunde descrierii, beneficiați de garanția legală de conformitate de 2 ani, indiferent dacă a fost achiziționat la preț întreg sau redus. Scrieți-ne la info@lorenzo-ricci.com.",
      },
    ],
  },
  {
    category: "ARTICOLE DIN PIELE DE CROCODIL",
    items: [
      {
        q: "Din ce fel de piele sunt realizate produsele voastre?",
        a: "Portofelele, port-cardurile și clutch-urile Lorenzo Ricci sunt realizate din piele 100% naturală de crocodil din specia Crocodylus siamensis (crocodil siamez). Specia fiecărui produs este indicată pe pagina sa. Produsele care au certificat CITES (nr. 25VN4174/S) îl menționează pe pagina produsului.",
      },
      {
        q: "Ce este certificatul CITES și de ce este important?",
        a: "CITES (Convenția privind comerțul internațional cu specii pe cale de dispariție ale faunei și florei sălbatice) este un tratat internațional care reglementează comerțul cu specii rare de animale. Certificatul indicat pe pagina produselor care îl au (nr. 25VN4174/S) atestă că pielea a fost obținută legal, de la o fermă autorizată, nu din natură. Îl primiți fizic, împreună cu produsul.",
      },
      {
        q: "Este fiecare articol unic?",
        a: "Da. Pielea de crocodil are textură și nuanțe naturale, motiv pentru care nu există două articole identice - fiecare este unic. Modelul și textura pot diferi ușor față de fotografiile din magazin; aceasta este o caracteristică firească a pielii autentice.",
      },
      {
        q: "Cum întrețin pielea de crocodil?",
        a: "Evitați expunerea prelungită la lumina directă a soarelui și la umezeală. Curățați cu o cârpă moale, ușor umezită. Aplicați o cremă specială pentru piele exotică o dată sau de două ori pe an. Nu folosiți substanțe chimice sau produse de curățare universale.",
      },
    ],
  },
  {
    category: "REȚELE SOCIALE",
    items: [
      {
        q: "Cum pot fi prezentat pe Instagram?",
        a: "Etichetați-ne într-o fotografie și folosiți hashtag-ul #ricciwatches - vom distribui cele mai reușite imagini.",
      },
      {
        q: "Colaborați cu influenceri?",
        a: "Da, scrieți-ne la info@lorenzo-ricci.com pentru parteneriate și colaborări.",
      },
    ],
  },
];

export default function IntrebariFrecventePage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Aveți o întrebare?</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Întrebări frecvente</h1>
        <div className="gold-divider" />
        <p className="font-sans text-sm font-light text-ink-muted max-w-md mx-auto mt-6 leading-relaxed">
          Găsiți răspunsul la cele mai frecvente întrebări sau scrieți-ne la{" "}
          <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
            info@lorenzo-ricci.com
          </a>
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
        {faqs.map((section) => (
          <div key={section.category} className="mb-12">
            <p className="section-tag mb-6">{section.category}</p>
            <div className="flex flex-col border-t border-border">
              {section.items.map((item, i) => (
                <details key={i} className="group border-b border-border">
                  <summary className="w-full flex items-start justify-between gap-4 py-5 text-left cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="font-serif text-base sm:text-lg text-charcoal group-hover:text-navy transition-colors leading-snug">
                      {item.q}
                    </span>
                    <span className="text-navy text-xl flex-shrink-0 mt-0.5 transition-transform duration-300 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="pb-5">
                    <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
                      {item.a}
                    </p>
                    {item.link && (
                      <Link
                        href={item.link.href}
                        className="inline-block mt-3 font-sans text-xs text-navy hover:underline tracking-wide"
                      >
                        {item.link.text} →
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        <div className="mt-10 p-8 bg-ivory-warm border border-border text-center">
          <p className="font-serif text-xl text-charcoal mb-3">
            Nu ați găsit răspunsul?
          </p>
          <p className="font-sans text-xs text-ink-muted tracking-wide mb-6">
            Scrieți-ne și vă vom răspunde în 24 de ore.
          </p>
          <a href="mailto:info@lorenzo-ricci.com" className="btn-outline">
            info@lorenzo-ricci.com
          </a>
        </div>
      </div>
    </div>
  );
}
