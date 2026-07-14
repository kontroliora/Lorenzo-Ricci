import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика за Връщане и Замяна",
  description: "14 дни законно право на отказ за всички продукти · Удължена 30-дневна замяна за продукти на редовна цена.",
};

export default function ReturnsPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Ваши права</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Политика за Връщане и Замяна</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
        <PolicySection title="Законно право на отказ — 14 дни">
          <p>
            Съгласно европейското законодателство (Директива 2011/83/ЕС) имате право да се откажете от поръчката си{" "}
            <strong className="text-charcoal font-normal">в рамките на 14 дни</strong> от получаването, без да посочвате причина.
          </p>
          <p className="mt-3">
            Това право важи за <strong className="text-charcoal font-normal">всички продукти</strong> — включително закупените на намаление или промоция. Достатъчно е да ни уведомите на{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>. Възстановяваме заплатената сума, включително стандартната доставка, до 14 дни след като получим върнатия продукт.
          </p>
        </PolicySection>

        <PolicySection title="Удължена замяна — 30 дни (за продукти на редовна цена)">
          <p>
            Освен законното ви право, предлагаме доброволна{" "}
            <strong className="text-charcoal font-normal">удължена 30-дневна политика за замяна</strong> на продукти, закупени на редовна цена — за да имате повече време за спокоен избор.
          </p>
          <p className="mt-3">
            За продукти на намаление или промоция се прилага стандартното{" "}
            <strong className="text-charcoal font-normal">14-дневно законно право на отказ</strong> (описано по-горе).
          </p>
        </PolicySection>

        <PolicySection title="Дефектни продукти">
          <p>
            Ако продукт е дефектен или не отговаря на описанието, имате право на замяна или възстановяване съгласно законовата гаранция за съответствие — <strong className="text-charcoal font-normal">независимо дали е закупен на редовна или намалена цена</strong> и независимо от горните срокове.
          </p>
        </PolicySection>

        <PolicySection title="Условия">
          <p className="mb-3">Условията важат за всички връщания и замени:</p>
          <ul className="list-disc list-inside flex flex-col gap-2">
            <li>Продуктът трябва да е неносен и неизползван</li>
            <li>С оригиналните етикети и опаковка</li>
            <li>При бижута и часовници — без следи от носене</li>
          </ul>
        </PolicySection>

        <PolicySection title="Повреден при транспорт">
          <p>
            Ако продуктът е пристигнал повреден, свържете се с нас в рамките на{" "}
            <strong className="text-charcoal font-normal">24 часа</strong> от получаването с номер на поръчка и снимки/видео на{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">info@lorenzo-ricci.com</a>.
          </p>
        </PolicySection>

        <PolicySection title="Процес на връщане / замяна">
          <ol className="list-decimal list-inside flex flex-col gap-3">
            <li>Пишете на info@lorenzo-ricci.com с номера на поръчката</li>
            <li>Ще ви изпратим инструкции за връщане</li>
            <li>След получаване и проверка — възстановяваме сумата или изпращаме замяна</li>
          </ol>
        </PolicySection>

        <PolicySection title="Разходи за доставка при връщане">
          <p>
            Разходите за връщане при отказ или замяна са{" "}
            <strong className="text-charcoal font-normal">за сметка на клиента</strong>. При дефектен продукт или наша грешка разходите поемаме ние.
          </p>
        </PolicySection>

        <PolicySection title="Контакт">
          <p>
            Email:{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
            <br />
            Понеделник–Петък, 10:00–18:00 ч.
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
