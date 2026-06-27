import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика за Връщане",
  description: "30 дни замяна · Лесен процес · Без скрити условия.",
};

export default function ReturnsPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Ваши права</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Политика за Връщане</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
        <PolicySection title="Срок за замяна">
          <p>
            Можете да замените продукт <strong className="text-charcoal font-normal">в рамките на 30 дни</strong> от датата на получаване. Продуктът трябва да е в ненаредено и непотвърдено (неизносено) състояние.
          </p>
        </PolicySection>

        <PolicySection title="Условия">
          <ul className="list-disc list-inside flex flex-col gap-2">
            <li>Продуктът не е бил използван и няма следи от употреба</li>
            <li>Оригиналната опаковка и всички аксесоари трябва да са запазени</li>
            <li>Свържете се с нас в рамките на 30 дни от получаването</li>
          </ul>
        </PolicySection>

        <PolicySection title="При повреден продукт">
          <p>
            Ако продуктът е пристигнал повреден от транспорт, свържете се с нас в рамките на <strong className="text-charcoal font-normal">24 часа</strong> от получаването с номер на поръчка и снимки/видео на{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>
          </p>
        </PolicySection>

        <PolicySection title="Процес на замяна">
          <ol className="list-decimal list-inside flex flex-col gap-3">
            <li>Пишете на info@lorenzo-ricci.com с причина за замяната</li>
            <li>Ще ви изпратим инструкции за връщане</li>
            <li>След получаване и проверка - одобряваме или отказваме замяната</li>
          </ol>
        </PolicySection>

        <PolicySection title="Разходи за доставка при връщане">
          <p>
            Разходите за доставка при връщане са <strong className="text-charcoal font-normal">за сметка на клиента</strong>, освен ако изрично не е посочено друго (напр. при наш производствен дефект).
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
