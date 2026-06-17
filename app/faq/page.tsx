"use client";
import { useState } from "react";
import Link from "next/link";

const faqs = [
  {
    category: "ЧАСОВНИЦИ",
    items: [
      {
        q: "От какви материали са изработени вашите часовници?",
        a: "Часовниците Lorenzo Ricci са изработени от премиум неръждаема стомана 316L с сапфир кристал стъкло и японски кварцови механизми. Стоманата е хирургичен клас - хипоалергенна и нержавяваща.",
      },
      {
        q: "Подходящи ли са за чувствителна кожа?",
        a: "Да. Премиум неръждаемата стомана 316L и висококачествените силиконови каишки са напълно хипоалергенни и безопасни за всяка кожа.",
      },
      {
        q: "Водоустойчиви ли са часовниците?",
        a: "Всички модели са 5 ATM водоустойчиви - подходящи за дъжд, миене, плаж. Не препоръчваме за гмуркане или продължително потапяне.",
      },
      {
        q: "Ще избледнее ли цветът?",
        a: "Не. Покритието е устойчиво и премиум 316L стоманата не ръждясва или потъмнява при нормална употреба.",
      },
      {
        q: "Как да настроя часовника?",
        a: "Издърпайте коронката до желаната позиция и завъртете за настройка на времето. Пълното ръководство е налично при получаване.",
      },
      {
        q: "Колко издържа механизмът?",
        a: "Японският кварцов механизъм е проектиран за минимум 10 години прецизна работа. Батерията се сменя стандартно на всеки 2-3 години.",
      },
    ],
  },
  {
    category: "БИЖУТА",
    items: [
      {
        q: "Избледнява ли златното покритие?",
        a: "Не. 4-слойното 18K PVD покритие е създадено да издържи дълги години. Технологията е значително по-дълготрайна от стандартното единично покритие.",
      },
      {
        q: "От какви материали са изработени бижутата?",
        a: "316L неръждаема стомана с 4-слойно 18K Gold PVD покритие - технология, използвана от люксозни ювелирни брандове.",
      },
      {
        q: "Мога ли да мокря бижутата?",
        a: "Да. Материалът не ръждясва и не потъмнява. Препоръчваме избягване на солена вода и хлор за максимална дълготрайност.",
      },
      {
        q: "Какви маркировки имат бижутата?",
        a: '"750" за 18K, "IT / ITALY" за италиански дизайн и "LR" за логото на Lorenzo Ricci.',
      },
      {
        q: "Как да поддържам бижутата?",
        a: "Почиствайте с мека кърпа и избягвайте парфюми или силни химикали директно върху повърхността.",
      },
    ],
  },
  {
    category: "ПОРЪЧКА И ДОСТАВКА",
    items: [
      {
        q: "Как да направя поръчка?",
        a: "Добавете продукта в количката, попълнете вашите данни (Две имена, Телефон, Адрес на Еконт/Спиди офис) и потвърдете. Ще се свържем с вас за потвърждение.",
      },
      {
        q: "Как плащам?",
        a: "Плащате при получаване - Наложен платеж. Имате право да прегледате и тествате продукта преди да го заплатите.",
      },
      {
        q: "Колко е доставката?",
        a: "Безплатна доставка за поръчки над €60. За поръчки под €60 - стандартна тарифа на Еконт/Спиди (от 3.95 € до 5.45 € в зависимост от начина на доставка).",
      },
      {
        q: "Кога ще получа поръчката?",
        a: "Обработваме до 14:00 ч. в работен ден - изпращаме същия ден. Доставка до 2 работни дни с Еконт или Спиди.",
      },
      {
        q: "Мога ли да откажа поръчката?",
        a: "Да, пишете на info@lorenzo-ricci.com възможно най-скоро.",
      },
    ],
  },
  {
    category: "ГАРАНЦИЯ И ВРЪЩАНЕ",
    items: [
      {
        q: "Каква е гаранцията на часовниците?",
        a: "2-годишна гаранция на механизма. Покрива фабрични дефекти. Не покрива: корпус, стъкло, каишка, закопчалка, щети от неправилна употреба или удар.",
      },
      {
        q: "Каква е гаранцията на бижутата?",
        a: "Доживотна гаранция на всички бижута от колекцията Lorenzo Ricci - покрива производствени дефекти без ограничение на срока.",
        link: { text: "Вижте подробни гаранционни условия", href: "/warranty/jewelry" },
      },
      {
        q: "Мога ли да върна продукт?",
        a: "Да - в рамките на 30 дни от получаването, при незаредено изделие в оригинална опаковка. Пишете на info@lorenzo-ricci.com за инструкции.",
      },
    ],
  },
  {
    category: "КОЖЕНИ ИЗДЕЛИЯ",
    items: [
      {
        q: "От каква кожа са изработени продуктите ви?",
        a: "Всички портфейли и кардхолдъри Lorenzo Ricci са изработени от 100% естествена крокодилска кожа вид Crocodylus Siamensis (Сиамски крокодил) - една от най-редките и ценни кожи в света. Произходът е сертифициран по международния стандарт CITES с номер 25VN4174/S.",
      },
      {
        q: "Какво е CITES сертификат и защо е важен?",
        a: "CITES (Convention on International Trade in Endangered Species) е международен договор, регулиращ търговията с редки животински видове. Нашият сертификат № 25VN4174/S гарантира, че кожата е добита законно и отговорно от лицензирана ферма - не от дивата природа. Получавате го физически с продукта.",
      },
      {
        q: "Всяко изделие уникално ли е?",
        a: "Да. Всеки портфейл и кардхолдър е ръчно изрязан и зашит от майстор кожар. Крокодилската кожа има естествена текстура и цветови нюанси, поради което никои две изделия не са идентични - всяко е уникален артикул.",
      },
      {
        q: "Как да поддържам крокодилската кожа?",
        a: "Избягвайте продължително излагане на пряка слънчева светлина и влага. Почиствайте с мека, леко навлажнена кърпа. Нанасяйте специализиран крем за екзотична кожа 1-2 пъти годишно. Не използвайте химикали или универсални почистващи препарати.",
      },
    ],
  },
  {
    category: "СОЦИАЛНИ МЕДИИ",
    items: [
      {
        q: "Как да ме публикувате в Instagram?",
        a: 'Отбележете ни в снимка и използвайте хаштага #ricciwatches - ще споделим качествените кадри.',
      },
      {
        q: "Работите ли с инфлуенсъри?",
        a: "Да, пишете на info@lorenzo-ricci.com за партньорства и колаборации.",
      },
    ],
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="min-h-screen pt-20 pb-24">
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Имате въпрос?</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">FAQ</h1>
        <div className="gold-divider" />
        <p className="font-sans text-sm font-light text-ink-muted max-w-md mx-auto mt-6 leading-relaxed">
          Намерете отговор на най-честите въпроси или ни пишете на{" "}
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
              {section.items.map((item, i) => {
                const key = `${section.category}-${i}`;
                const isOpen = open === key;
                return (
                  <div key={i} className="border-b border-border">
                    <button
                      onClick={() => setOpen(isOpen ? null : key)}
                      className="w-full flex items-start justify-between gap-4 py-5 text-left group"
                    >
                      <span className="font-serif text-base sm:text-lg text-charcoal group-hover:text-navy transition-colors leading-snug">
                        {item.q}
                      </span>
                      <span
                        className={`text-navy text-xl flex-shrink-0 mt-0.5 transition-transform duration-300 ${
                          isOpen ? "rotate-45" : ""
                        }`}
                      >
                        +
                      </span>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-400 ${
                        isOpen ? "max-h-[500px] opacity-100 pb-5" : "max-h-0 opacity-0"
                      }`}
                    >
                      <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
                        {item.a}
                      </p>
                      {"link" in item && item.link && (
                        <Link
                          href={item.link.href}
                          className="inline-block mt-3 font-sans text-xs text-navy hover:underline tracking-wide"
                        >
                          {item.link.text} →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        <div className="mt-10 p-8 bg-ivory-warm border border-border text-center">
          <p className="font-serif text-xl text-charcoal mb-3">
            Не намерихте отговор?
          </p>
          <p className="font-sans text-xs text-ink-muted tracking-wide mb-6">
            Пишете ни и ще отговорим до 24 часа.
          </p>
          <a href="mailto:info@lorenzo-ricci.com" className="btn-outline">
            info@lorenzo-ricci.com
          </a>
        </div>
      </div>
    </div>
  );
}
