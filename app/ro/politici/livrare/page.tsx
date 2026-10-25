import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import type { Metadata } from "next";
import Link from "next/link";
import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import { roToBgPath } from "@/lib/ro/route-map";
import {
  RO_COD_FEE_RON,
  RO_COURIER_LABEL,
  RO_DELIVERY_DAYS,
  RO_FREE_SHIPPING_RON,
  RO_INSPECT_BEFORE_PAY,
  RO_RETURN_DAYS,
  RO_SHIPPING_FEE_RON,
  fmtRON,
  ronPrice,
} from "@/lib/ro/config";

const PATH = "/ro/politici/livrare";

// Products priced from EUR 1500 up are sold on advance payment (no cash on delivery), exactly like on the Bulgarian site.
const PREPAY_RON = fmtRON(ronPrice(PREPAYMENT_THRESHOLD_EUR));
const PREPAY_EUR = PREPAYMENT_THRESHOLD_EUR.toLocaleString("ro-RO");

export const metadata: Metadata = {
  title: "Politica de livrare",
  description: `Livrare gratuită pentru comenzile de peste ${fmtRON(RO_FREE_SHIPPING_RON)} · Plata ramburs, la livrare (în avans pentru produsele de valoare mare) · ${RO_DELIVERY_DAYS} zile lucrătoare de la expediere.`,
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: {
      "ro-RO": `https://lorenzo-ricci.com${PATH}`,
      "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}`,
    },
  },
  other: { "content-language": "ro" },
};

export default function LivrarePage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Livrare</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Politica de livrare</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
        <PolicySection title="Zona de livrare">
          <p>
            Livrăm în România, prin {RO_COURIER_LABEL}, la adresa de livrare indicată în comandă. Coletele sunt expediate din Bulgaria.
          </p>
        </PolicySection>

        <PolicySection title="Termen de livrare">
          <p>
            Comenzile se procesează și se expediază din Bulgaria (în limita stocului disponibil).
            <br /><br />
            Livrarea durează de obicei <strong className="text-charcoal font-normal">{RO_DELIVERY_DAYS} zile lucrătoare</strong> de la expediere.
          </p>
        </PolicySection>

        <PolicySection title="Costul livrării">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between py-3 border-b border-border">
              <span>Comenzi de peste {fmtRON(RO_FREE_SHIPPING_RON)}</span>
              <span className="text-navy font-medium">GRATUIT</span>
            </div>
            <div className="flex justify-between py-3">
              <span>Comenzi de până la {fmtRON(RO_FREE_SHIPPING_RON)}</span>
              <span>{fmtRON(RO_SHIPPING_FEE_RON)}</span>
            </div>
          </div>
        </PolicySection>

        <PolicySection title="Plata">
          <p>
            Pentru produsele cu un preț sub <strong className="text-charcoal font-normal">{PREPAY_RON}</strong>, plata se face <strong className="text-charcoal font-normal">ramburs</strong>: achitați comanda curierului, la livrare.
            {CARD_PAYMENTS_ENABLED && <>{" "}Puteți plăti și cu cardul, online, prin Stripe, în lei; livrarea se plătește după aceleași reguli ca la ramburs.</>}
            {RO_COD_FEE_RON > 0 && (
              <>
                {" "}Pentru plata ramburs se percepe o taxă de <strong className="text-charcoal font-normal">{fmtRON(RO_COD_FEE_RON)}</strong>.
              </>
            )}
            {RO_INSPECT_BEFORE_PAY && (
              <>
                <br /><br />
                Aveți dreptul să <strong className="text-charcoal font-normal">verificați coletul înainte de plată</strong> și să îl refuzați dacă produsul nu corespunde așteptărilor dumneavoastră.
              </>
            )}
          </p>
          <p className="mt-3">
            Produsele cu un preț de la <strong className="text-charcoal font-normal">{PREPAY_RON}</strong> în sus (echivalentul a {PREPAY_EUR} EUR) se comandă cu <strong className="text-charcoal font-normal">plata în avans</strong>, stabilită direct cu noi; pentru aceste produse plata ramburs nu este disponibilă. Pentru a comanda un astfel de produs, scrieți-ne la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>.
          </p>
        </PolicySection>

        <PolicySection title="Retur și schimb">
          <p>
            Aveți dreptul legal de retragere din contract în termen de <strong className="text-charcoal font-normal">{RO_RETURN_DAYS} zile</strong> de la primirea produsului - pentru <strong className="text-charcoal font-normal">toate produsele</strong>, inclusiv cele achiziționate la reducere sau promoție.
            <br /><br />
            Schimbul voluntar extins de <strong className="text-charcoal font-normal">30 de zile</strong> se aplică numai produselor achiziționate la <strong className="text-charcoal font-normal">preț întreg</strong>. Produsele la reducere sau promoție <strong className="text-charcoal font-normal">nu beneficiază de schimbul de 30 de zile</strong> - pentru ele rămâne dreptul legal de retragere de {RO_RETURN_DAYS} zile, descris mai sus.
            <br /><br />
            Produsul returnat trebuie să fie în <strong className="text-charcoal font-normal">starea în care a fost primit</strong> - nefolosit, cu ambalajul original complet, cu toate accesoriile și cu <strong className="text-charcoal font-normal">certificatul de autenticitate</strong>. În cazul retragerii legale din contract aveți dreptul să examinați produsul, însă dacă acesta a fost folosit peste ceea ce este necesar pentru verificare sau este returnat incomplet, valoarea rambursării poate fi diminuată corespunzător.
            <br /><br />
            Condiții complete:{" "}
            <Link href="/ro/politici/retur" className="text-navy hover:underline">Politica de retur și schimb</Link>.
          </p>
        </PolicySection>

        <PolicySection title="Colet deteriorat">
          <p>
            În cazul unor deteriorări vizibile ale ambalajului sau ale produsului la primire, solicitați curierului un proces-verbal de constatare și anunțați-ne în termen de <strong className="text-charcoal font-normal">24 de ore</strong> la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
            , atașând fotografii sau video.
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
