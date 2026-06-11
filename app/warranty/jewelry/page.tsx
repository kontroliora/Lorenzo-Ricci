import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle, XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Гаранционни Условия | Lorenzo Ricci",
  description:
    "Гаранционни условия на Lorenzo Ricci - доживотна гаранция за бижута и 2-годишна гаранция за часовници. Разберете какво покриваме и как да упражните правата си.",
};

// ── Data ──────────────────────────────────────────────────────────────────

const JEWELLERY_COVERED = [
  {
    title: "Производствени дефекти и дефекти в изработката",
    sub: "Доживотно",
    desc: "Всяко изделие, при което се установи производствен дефект - независимо от датата на покупка - подлежи на безплатен ремонт или замяна.",
  },
];

const JEWELLERY_NOT_COVERED = [
  {
    title: "Изгубване или кражба на изделието",
    desc: "Гаранцията не покрива случаи на загубване, кражба или унищожаване на изделието поради обстоятелства, независещи от производствено качество.",
  },
  {
    title: "Повреди от неправилна употреба или удар",
    desc: "Деформации, счупвания или изгубени елементи в резултат на груба употреба, удар, пресоване или неправилно съхранение не са включени.",
  },
  {
    title: "Естествено износване на покритието",
    desc: "Фини надрасквания от ежедневна употреба и постепенното естествено изветряване на повърхностите са нормален резултат от носенето и не представляват дефект.",
  },
  {
    title: "Ремонт от трети страни или модификации",
    desc: "Всяка намеса от страна на нелицензирани майстори, ателиета или опити за самостоятелна модификация автоматично анулира гаранцията.",
  },
  {
    title: "Почистване, полиране и естетическо обслужване",
    desc: "Услугите по почистване и полиране не са включени в гаранционното покритие и се извършват срещу допълнително заплащане по предварителна заявка.",
  },
  {
    title: "Разхлабване на елементи и камъни от износване",
    desc: "Разхлабване или изпадане на елементи вследствие на нормално ежедневно носене и механично износване не се покрива от гаранцията.",
  },
  {
    title: "Износване на закопчалките от употреба",
    desc: "Деформации или неправилно функциониране на закопчалките в резултат на продължителна ежедневна употреба не попадат в гаранционното покритие.",
  },
];

const WATCH_COVERED = [
  {
    title: "Производствени дефекти на механизма",
    sub: "2 години",
    desc: "Гаранцията покрива производствени дефекти на механизма за период от 2 години от датата на покупката. При установен дефект часовникът подлежи на безплатен ремонт или замяна.",
  },
];

const WATCH_NOT_COVERED = [
  {
    title: "Повреди по стъклото, верижката, короната и корпуса",
    desc: "Повреди по сапфиреното стъкло, верижката, короната или корпуса вследствие на неправилна употреба, удар или падане не се покриват от гаранцията.",
  },
  {
    title: "Щети от проникване на вода извън параметрите",
    desc: "Гаранцията не покрива щети, причинени от проникване на вода, ако часовникът е бил използван извън посочените за модела параметри на водоустойчивост (5 ATM).",
  },
  {
    title: "Батерия след първите 6 месеца",
    desc: "Батерията се счита за консуматив и не се покрива от гаранцията след изтичане на първите 6 месеца от датата на покупка.",
  },
  {
    title: "Естетическо износване на корпуса и каишката",
    desc: "Надрасквания на корпуса, промени в покритието и износване на каишката вследствие на ежедневна употреба са нормален резултат от носенето и не представляват производствен дефект.",
  },
  {
    title: "Ремонт или сервиз от неоторизирани трети страни",
    desc: "Всяка намеса от страна на нелицензиран сервиз или опит за самостоятелна поправка автоматично анулира гаранцията.",
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
            Какво включва гаранцията
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
            Какво не включва гаранцията
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

export default function WarrantyPage() {
  return (
    <div className="min-h-screen pt-20 pb-24">

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
            Lorenzo Ricci · Правна информация
          </p>
          <h1 className="font-serif text-display-lg text-white mb-5">
            Гаранционни Условия
          </h1>
          <div className="w-10 h-px bg-white/20 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/50 max-w-lg mx-auto leading-relaxed tracking-widest uppercase">
            Бижута · Часовници · Кожени изделия
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8">

        {/* ── Section 1: Общи условия ───────────────────────────── */}
        <div className="mt-16 mb-14">
          <SectionLabel>01 · Общи условия</SectionLabel>
          <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide flex flex-col gap-4">
            <p>
              Настоящите гаранционни условия се прилагат за всички продукти на{" "}
              <strong className="text-charcoal font-normal">Lorenzo Ricci</strong> и уреждат
              правата и задълженията на двете страни при производствени дефекти. Гаранцията е
              лична, валидна само за оригиналния купувач, и не е прехвърляема.
            </p>
            <p>
              Гаранцията влиза в сила от{" "}
              <strong className="text-charcoal font-normal">датата на покупката</strong> и
              обхваща единствено{" "}
              <strong className="text-charcoal font-normal">производствени дефекти</strong> -
              тоест дефекти в материала или изработката, установени при нормална употреба
              съгласно предназначението на продукта. Тя не обхваща повреди вследствие на
              неправилна употреба, инциденти или нормално износване.
            </p>
          </div>
        </div>

        {/* ── Section 2: Гаранция за бижута ────────────────────── */}
        <div className="mb-16">
          <SectionLabel>02 · Гаранция за бижута</SectionLabel>
          <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-8 flex flex-col gap-3">
            <p>
              Всяко бижу Lorenzo Ricci е изработено от{" "}
              <strong className="text-charcoal font-normal">316L хирургична стомана</strong> с{" "}
              <strong className="text-charcoal font-normal">4-слойно 18K PVD покритие</strong>,
              хипоалергенно и устойчиво на вода, пот и парфюм. Зад всяко изделие стоим с
              доживотна гаранция срещу производствени дефекти - без срок, без изключения.
            </p>
          </div>
          <WarrantyTable covered={JEWELLERY_COVERED} notCovered={JEWELLERY_NOT_COVERED} />
        </div>

        {/* ── Editorial divider image ───────────────────────────── */}
        {/* Replace src with your image path once uploaded */}
        <div className="relative w-full aspect-[16/7] overflow-hidden mb-16">
          <Image
            src="/beautiful/chrono-rain.webp"
            alt="Lorenzo Ricci часовници - прецизност и издръжливост"
            fill
            quality={85}
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover object-center"
            unoptimized
          />
          <div className="absolute inset-0 bg-charcoal-deep/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p className="font-sans text-[9px] font-medium tracking-[0.35em] uppercase text-white/60 mb-3">
              Lorenzo Ricci · Часовници
            </p>
            <p className="font-serif text-2xl sm:text-3xl text-white leading-tight">
              Инженерна прецизност.<br />Документирана гаранция.
            </p>
          </div>
        </div>

        {/* ── Section 3: Гаранция за часовници ─────────────────── */}
        <div className="mb-16">
          <SectionLabel>03 · Гаранция за часовници</SectionLabel>
          <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-8 flex flex-col gap-3">
            <p>
              Всеки часовник Lorenzo Ricci е конструиран с{" "}
              <strong className="text-charcoal font-normal">корпус от 316L неръждаема стомана</strong>,{" "}
              <strong className="text-charcoal font-normal">сапфирено кристално стъкло</strong> и
              прецизен хронограф механизъм. Гаранцията покрива производствени дефекти в
              механизма за срок от{" "}
              <strong className="text-charcoal font-normal">2 години</strong> от датата на
              покупката.
            </p>
          </div>
          <WarrantyTable covered={WATCH_COVERED} notCovered={WATCH_NOT_COVERED} />
        </div>

        {/* ── Как да упражните гаранцията ──────────────────────── */}
        <div className="border border-border p-8 mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-4 h-px bg-navy/30" />
            <h2 className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy">
              Как да упражните гаранцията
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                n: "01",
                title: "Свържете се с нас",
                desc: "Изпратете имейл на info@lorenzo-ricci.com с описание на проблема и снимка на изделието.",
              },
              {
                n: "02",
                title: "Изпратете изделието",
                desc: "Ние ще ви предоставим адрес за изпращане. Разходите за обратна доставка са за наша сметка.",
              },
              {
                n: "03",
                title: "Получете обратно",
                desc: "Изделието ще бъде прегледано, ремонтирано или заменено и върнато при Вас.",
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
            Въпроси относно гаранцията? Свържете се с нас на{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
