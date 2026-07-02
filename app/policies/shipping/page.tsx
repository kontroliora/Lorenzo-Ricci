import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика за Доставка",
  description: "Безплатна доставка над €60 · Еконт · До 2 работни дни.",
};

export default function ShippingPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Доставка</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Политика за Доставка</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
        <PolicySection title="Зона на доставка">
          <p>Доставяме в цяла България - до офис/автомат на Еконт, или до адрес.</p>
        </PolicySection>

        <PolicySection title="Срок на доставка">
          <p>
            Поръчките, получени до <strong className="text-charcoal font-normal">14:00 ч.</strong> в работен ден, се обработват и изпращат <strong className="text-charcoal font-normal">същия ден</strong> (при наличност).
            <br /><br />
            Доставката обичайно отнема <strong className="text-charcoal font-normal">1-2 работни дни</strong> след изпращане.
          </p>
        </PolicySection>

        <PolicySection title="Цена на доставката">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between py-3 border-b border-border">
              <span>Поръчки над €60</span>
              <span className="text-navy font-medium">БЕЗПЛАТНО</span>
            </div>
            <div className="flex justify-between py-3">
              <span>Поръчки под €60</span>
              <span>Стандартна тарифа на Еконт</span>
            </div>
          </div>
        </PolicySection>

        <PolicySection title="Преглед и тест преди плащане">
          <p>
            Всички пратки включват опцията за <strong className="text-charcoal font-normal">преглед и тест преди плащане</strong>. Имате право да прегледате продукта при получаване и да го откажете, ако не отговаря на очакванията ви.
          </p>
        </PolicySection>

        <PolicySection title="При повредена пратка">
          <p>
            При видими повреди по опаковката или продукта при получаване, поискайте протокол от куриера и ни уведомете в рамките на <strong className="text-charcoal font-normal">24 часа</strong> на{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>{" "}
            с снимки/видео.
          </p>
        </PolicySection>

        <PolicySection title="Контакт">
          <p>
            Email:{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
            <br />
Понеделник-Петък, 10:00-18:00 ч.
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
