import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ръководство за часовник | Lorenzo Ricci",
  description:
    "Пълно ръководство за употреба на хронограф с кварцов механизъм Lorenzo Ricci - настройка на времето, хронограф функция, грижа и поддръжка.",
};

export default function WatchManualPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      {/* Hero */}
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Lorenzo Ricci</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Ръководство за часовник</h1>
        <div className="gold-divider" />
        <p className="font-sans text-xs font-light text-ink-muted max-w-md mx-auto mt-6 leading-relaxed tracking-wide">
          Хронограф с японски кварцов механизъм · Noble Vanguard Collection
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-5 sm:px-8 mt-14 flex flex-col gap-12">

        {/* Intro */}
        <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
          Поздравяваме ви за покупката на хронограф Lorenzo Ricci. Това ръководство обхваща функциите,
          настройките и грижата за вашия часовник, за да осигури дълъг живот и прецизна работа.
        </p>

        <Section number="1" title="Характеристики на часовника">
          <ul className="flex flex-col gap-3">
            <Item label="Японски кварцов механизъм">
              Захранван с батерия за прецизно отчитане на времето. Точност ±15 секунди месечно.
              Живот на батерията 2–3 години.
            </Item>
            <Item label="Хронограф функция">
              Секундомер за измерване на времеви интервали чрез страничните бутони.
            </Item>
            <Item label="Водоустойчивост 5 ATM">
              Подходящ за дъжд, пръски и плаж. Не е предназначен за гмуркане или продължително потапяне.
              Бутоните не трябва да се натискат под вода.
            </Item>
            <Item label="Сапфирено кристално стъкло">
              Осигурява изключителна яснота и устойчивост на надраскване.
            </Item>
            <Item label="316L неръждаема стомана">
              Хирургичен клас - хипоалергенна, устойчива на корозия.
            </Item>
          </ul>
        </Section>

        <Section number="2" title="Настройка на времето">
          <ol className="flex flex-col gap-4 list-none">
            <Step n={1}>
              Издърпайте короната (страничното копче) до <strong className="text-charcoal font-normal">втора позиция</strong> - ще усетите леко щракване.
            </Step>
            <Step n={2}>
              Завъртете короната, за да настроите часовата и минутната стрелка.
            </Step>
            <Step n={3}>
              Натиснете короната обратно до <strong className="text-charcoal font-normal">изходна позиция</strong>, за да стартирате часовника.
            </Step>
          </ol>
          <Note>
            Уверете се, че короната е напълно натисната преди контакт с вода.
          </Note>
        </Section>

        <Section number="3" title="Използване на хронографа">
          <ul className="flex flex-col gap-3">
            <Item label="Старт / Стоп">
              Натиснете горния бутон (при 2 часа) за стартиране и спиране на хронографа.
            </Item>
            <Item label="Нулиране">
              Натиснете долния бутон (при 4 часа), за да върнете секундомера на нула.
              Нулирането е възможно само когато хронографът е спрян.
            </Item>
            <Item label="Отчитане на времето">
              Малките циферблати (суб-дискове) показват изминалото време в минути и часове.
              Централната секундна стрелка измерва секундите.
            </Item>
          </ul>
          <Note>
            Не натискайте бутоните под вода - това може да наруши водоустойчивостта.
          </Note>
        </Section>

        <Section number="4" title="Грижа и поддръжка">
          <ul className="flex flex-col gap-3">
            <Item label="Смяна на батерия">
              Японската кварцова батерия се сменя на всеки <strong className="text-charcoal font-normal">2–3 години</strong> в часовникарски сервиз.
              При отслабен ход или спрял часовник - проверете батерията.
            </Item>
            <Item label="Почистване">
              Избършете корпуса и стъклото с мека, суха кърпа. Избягвайте агресивни препарати и разтворители.
            </Item>
            <Item label="Съхранение">
              Съхранявайте часовника далеч от силни магнитни полета, висока температура и директна слънчева светлина.
            </Item>
            <Item label="Каишка">
              Силиконовата каишка може да се почиства с влажна кърпа. При видимо износване можете да я смените.
            </Item>
          </ul>
        </Section>

        <Section number="5" title="Отстраняване на проблеми">
          <ul className="flex flex-col gap-3">
            <Item label="Часовникът не работи">
              Проверете дали батерията е изтощена. Ако проблемът продължава след смяна на батерията,
              свържете се с нашия сервиз.
            </Item>
            <Item label="Хронографът не се нулира">
              Уверете се, че хронографът е спрян преди нулиране. Ако стрелките не се върнат на нула,
              потърсете часовникарски сервиз.
            </Item>
            <Item label="Часовникът изостава или бърза">
              Незначителни отклонения (±15 сек/месец) са в нормата за кварцов механизъм.
              По-голямо отклонение изисква проверка на батерията или механизма.
            </Item>
            <Item label="Мъгла под стъклото">
              Временна кондензация може да се появи при рязка смяна на температурата.
              Ако мъглата не изчезне, занесете часовника за проверка на водоустойчивостта.
            </Item>
          </ul>
        </Section>

        <Section number="6" title="Гаранция">
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
            Всеки часовник Lorenzo Ricci се предлага с <strong className="text-charcoal font-normal">2 години гаранция на механизма</strong>
            {" "}от датата на покупката. Гаранцията покрива производствени дефекти и дефекти на механизма.
          </p>
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
            Гаранцията <strong className="text-charcoal font-normal">не покрива</strong> повреди от неправилна употреба,
            удари, неоторизиран ремонт, нормално износване или загуба.
          </p>
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
            За гаранционно обслужване се свържете с нас на{" "}
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
