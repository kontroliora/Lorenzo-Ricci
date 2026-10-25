import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import { RO_RETURN_DAYS, fmtRON, ronPrice } from "@/lib/ro/config";
import { roToBgPath } from "@/lib/ro/route-map";

const PATH = "/ro/despre-noi";

// Cash on delivery only below this price (products from EUR 1500 up are sold on advance payment), same as on the Bulgarian site.
const PREPAY_RON = fmtRON(ronPrice(PREPAYMENT_THRESHOLD_EUR));

export const metadata: Metadata = {
  title: "Povestea noastră",
  description: "Lorenzo Ricci a fost înființată de frați ceasornicari, conduși de dorința de a crea ceasuri de lux cu caracter, precizie și prezență rafinată.",
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: {
      "ro-RO": `https://lorenzo-ricci.com${PATH}`,
      "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}`,
    },
  },
  other: { "content-language": "ro" },
};

export default function DespreNoiPage() {
  return (
    <div className="min-h-screen pt-[116px]">

      {/* Hero */}
      <div className="py-24 px-5 sm:px-8 text-center border-b border-border">
        <p className="section-tag mb-4">Lorenzo Ricci</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Povestea noastră</h1>
        <div className="gold-divider" />
        <p className="font-sans text-sm font-light text-ink-muted max-w-xl mx-auto mt-6 leading-relaxed tracking-wide">
          Ceasuri de lux, create cu precizie și caracter
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20">

        {/* Section 1: Începutul */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/story/craft.webp"
              alt="Măiestrie Lorenzo Ricci"
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
          <div>
            <p className="section-tag mb-4">Începutul</p>
            <h2 className="font-serif text-display-md text-charcoal mb-8">Cine suntem</h2>
            <div className="gold-divider mb-8 mx-0" />
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide mb-6">
              Lorenzo Ricci a fost înființată de frați ceasornicari, conduși de dorința de a crea ceasuri cu caracter și prezență rafinată. Încă de la început, viziunea noastră a fost clară - să îmbinăm eleganța clasică cu o interpretare modernă a luxului.
            </p>
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide">
              Fiecare model poartă un design atent ales, o execuție precisă și un sentiment de stil care rămâne în timp. Pentru noi, un ceas nu este doar un accesoriu - este o expresie a încrederii în sine.
            </p>
          </div>
        </div>

        {/* Full-width watchmaker quote */}
        <div className="relative w-full aspect-[16/7] overflow-hidden mb-24">
          <Image
            src="/story/watchmaker.webp"
            alt="Ceasornicar Lorenzo Ricci - execuție manuală precisă a unui cronograf de lux, meșteșug italian"
            fill
            quality={85}
            sizes="100vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-charcoal-deep/55 flex items-end p-12">
            <blockquote className="font-serif text-display-sm text-white max-w-2xl leading-relaxed">
              „Design italian rafinat și măiestrie,<br />în care fiecare detaliu contează.”
            </blockquote>
          </div>
        </div>

        {/* Section 2: Execuția */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div>
            <p className="section-tag mb-4">Execuția</p>
            <h2 className="font-serif text-display-md text-charcoal mb-8">Pasiunea pentru meșteșug</h2>
            <div className="gold-divider mb-8 mx-0" />
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide mb-6">
              Ne concentrăm pe crearea unor ceasuri care îmbină calitatea excepțională cu un design rafinat. Spre deosebire de multe mărci care mizează pe producția în masă, noi punem accent pe măiestria execuției și pe sentimentul de lux.
            </p>
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide">
              Fie că alegeți un cadou pentru o persoană specială, fie că vă faceți o plăcere, ceasurile noastre sunt create pentru a fi purtate cu mândrie.
            </p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/story/detail.webp"
              alt="Detaliu al unui ceas Lorenzo Ricci"
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>

        {/* Section 3: Viziunea - full width with overlay */}
        <div className="relative w-full aspect-[21/9] overflow-hidden mb-24">
          <Image
            src="/story/sea.webp"
            alt="Lorenzo Ricci - viziune italiană și estetică marină, ceasuri de lux cu caracter"
            fill
            quality={85}
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal-deep/80 to-charcoal-deep/20 flex items-center">
            <div className="px-12 max-w-xl">
              <p className="section-tag text-white/50 mb-4">Filosofia</p>
              <h2 className="font-serif text-display-md text-white leading-tight mb-6">
                Viziunea noastră
              </h2>
              <p className="font-sans text-sm font-light text-white/65 leading-relaxed tracking-wide">
                Să îmbinăm standarde tehnologice înalte cu un design elegant, inspirat de clasic și de tendințele actuale - fiecare ceas trece printr-un control riguros de rezistență și precizie.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Redefinim luxul */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/story/watches.webp"
              alt="Colecția de ceasuri de lux Lorenzo Ricci - Chrono Black, Golden Eclipse, Polar Frost, cristal de safir"
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-right"
            />
          </div>
          <div>
            <p className="section-tag mb-4">Lux accesibil</p>
            <h2 className="font-serif text-display-md text-charcoal mb-8">Redefinim luxul</h2>
            <div className="gold-divider mb-8 mx-0" />
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide mb-6">
              Lucrăm direct cu clienții noștri, ceea ce elimină adaosurile comerciale tradiționale. Investim în producție de calitate, nu în publicitate costisitoare sau ambasadori de brand.
            </p>
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide">
              Rezultatul - ceasuri, bijuterii și articole din piele de crocodil cu o valoare reală de lux, la un preț accesibil. Dumneavoastră primiți maximum, noi ne păstrăm onestitatea.
            </p>
          </div>
        </div>

        {/* Commitment block */}
        <div className="mb-16 p-10 sm:p-16 bg-navy text-center">
          <p className="font-sans text-[10px] tracking-[0.3em] uppercase mb-4" style={{color: "rgba(255,255,255,0.6)"}}>Angajamentul nostru</p>
          <h2 className="font-serif text-display-sm mb-6" style={{color: "#ffffff"}}>Încredere deplină</h2>
          <div className="w-12 h-px mx-auto mb-8" style={{backgroundColor: "rgba(255,255,255,0.3)"}} />
          <p className="font-sans text-sm font-light leading-relaxed max-w-2xl mx-auto mb-6" style={{color: "rgba(255,255,255,0.8)"}}>
            Stăm în spatele calității ceasurilor și bijuteriilor noastre cu deplină încredere. Fiecare model este o dovadă a dedicării noastre pentru perfecțiune - 5 ani garanție comercială pentru mecanismele ceasurilor, garanție comercială pe viață pentru bijuterii.
          </p>
          <p className="font-sans text-sm font-light leading-relaxed max-w-xl mx-auto" style={{color: "rgba(255,255,255,0.6)"}}>
            Alăturați-vă comunității care apreciază ceasurile elegante și bijuteriile create cu precizie.
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-12 max-w-2xl mx-auto">
            {[
              { label: "5 ani garanție", sub: "Comercială, pentru mecanismul ceasurilor" },
              { label: "Pe viață", sub: "Garanție comercială, bijuterii" },
              { label: `${RO_RETURN_DAYS} zile`, sub: "Drept legal de retragere" },
              { label: "30 de zile", sub: "Schimb pentru produse la preț întreg" },
              CARD_PAYMENTS_ENABLED ? { label: "Card sau ramburs", sub: `Card online sau ramburs, sub ${PREPAY_RON}` } : { label: "Ramburs", sub: `Plata la livrare, sub ${PREPAY_RON}` },
            ].map(({ label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1 w-[calc(50%-0.75rem)] sm:w-[calc(33.333%-1rem)]">
                <p className="font-sans text-sm font-medium tracking-wide" style={{color: "#ffffff"}}>{label}</p>
                <p className="font-sans text-[10px] tracking-widest uppercase" style={{color: "rgba(255,255,255,0.45)"}}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="w-12 h-px bg-border mx-auto mb-10" />
          <p className="font-serif text-display-sm text-charcoal mb-8">Găsiți-vă stilul</p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 justify-center">
            <Link href="/ro/ceasuri" className="btn-primary min-w-[200px]">
              Descoperiți ceasurile
            </Link>
            <Link href="/ro/bijuterii" className="btn-outline min-w-[200px]">
              Descoperiți bijuteriile
            </Link>
            <Link href="/ro/piele-de-crocodil" className="btn-outline min-w-[200px]">
              Descoperiți pielea de crocodil
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
