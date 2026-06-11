import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Нашата История | Lorenzo Ricci",
  description: "Lorenzo Ricci е основана от братя часовникари, водени от стремежа да създават луксозни часовници с характер, прецизност и изискано присъствие.",
};

export default function StoryPage() {
  return (
    <div className="min-h-screen pt-20">

      {/* Hero */}
      <div className="py-24 px-5 sm:px-8 text-center border-b border-border">
        <p className="section-tag mb-4">Lorenzo Ricci</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Нашата История</h1>
        <div className="gold-divider" />
        <p className="font-sans text-sm font-light text-ink-muted max-w-xl mx-auto mt-6 leading-relaxed tracking-wide">
          Луксозни часовници, създадени с прецизност и характер
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20">

        {/* Section 1: Началото */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/story/craft.webp"
              alt="Майсторска изработка Lorenzo Ricci"
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
          <div>
            <p className="section-tag mb-4">Началото</p>
            <h2 className="font-serif text-display-md text-charcoal mb-8">Кои сме ние</h2>
            <div className="gold-divider mb-8 mx-0" />
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide mb-6">
              Lorenzo Ricci е основана от братя часовникари, водени от стремежа да създават часовници с характер и изискано присъствие. От самото начало нашата визия е ясна - да съчетаем класическа елегантност с модерна интерпретация на лукса.
            </p>
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide">
              Всеки модел носи внимателно подбран дизайн, прецизна изработка и усещане за стил, което остава във времето. За нас часовникът не е просто аксесоар - той е израз на увереност.
            </p>
          </div>
        </div>

        {/* Full-width watchmaker quote */}
        <div className="relative w-full aspect-[16/7] overflow-hidden mb-24">
          <Image
            src="/story/watchmaker.webp"
            alt="Часовникар Lorenzo Ricci"
            fill
            quality={85}
            sizes="100vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-charcoal-deep/55 flex items-end p-12">
            <blockquote className="font-serif text-display-sm text-white max-w-2xl leading-relaxed">
              „Изтънчен италиански дизайн и майсторска изработка,<br />в която всеки детайл има значение."
            </blockquote>
          </div>
        </div>

        {/* Section 2: Изработката */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div>
            <p className="section-tag mb-4">Изработката</p>
            <h2 className="font-serif text-display-md text-charcoal mb-8">Страстта към Занаята</h2>
            <div className="gold-divider mb-8 mx-0" />
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide mb-6">
              Нашият фокус е върху създаването на часовници, които съчетават изключително качество с изискан дизайн. За разлика от много марки, които залагат на масово производство, ние наблягаме на майсторската изработка и усещането за лукс.
            </p>
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide">
              Независимо дали търсите подарък за специален човек или искате да се поглезите сами - нашите часовници са създадени, за да се носят с гордост.
            </p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/story/detail.webp"
              alt="Детайл на часовник Lorenzo Ricci"
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>

        {/* Section 3: Визията - full width with overlay */}
        <div className="relative w-full aspect-[21/9] overflow-hidden mb-24">
          <Image
            src="/story/sea.webp"
            alt="Lorenzo Ricci - италианска визия"
            fill
            quality={85}
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal-deep/80 to-charcoal-deep/20 flex items-center">
            <div className="px-12 max-w-xl">
              <p className="section-tag text-white/50 mb-4">Философията</p>
              <h2 className="font-serif text-display-md text-white leading-tight mb-6">
                Нашата Визия
              </h2>
              <p className="font-sans text-sm font-light text-white/65 leading-relaxed tracking-wide">
                Да обединим високи технологични стандарти с елегантен дизайн, вдъхновен от класиката и съвременните тенденции - всеки часовник преминава строг контрол за издръжливост и прецизност.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Преосмисляне на лукса */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/story/watches.webp"
              alt="Lorenzo Ricci колекция"
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-right"
            />
          </div>
          <div>
            <p className="section-tag mb-4">Достъпен Лукс</p>
            <h2 className="font-serif text-display-md text-charcoal mb-8">Преосмисляме Лукса</h2>
            <div className="gold-divider mb-8 mx-0" />
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide mb-6">
              Работим директно с нашите клиенти, което елиминира традиционните търговски надценки. Инвестираме в качествено производство, а не в скъпа реклама или посланици на марката.
            </p>
            <p className="font-sans text-base font-light text-ink-soft leading-[1.9] tracking-wide">
              Резултатът - часовник и бижута с истинска луксозна стойност на достъпна цена. Вие получавате максимума, ние запазваме честността.
            </p>
          </div>
        </div>

        {/* Commitment block */}
        <div className="mb-16 p-10 sm:p-16 bg-navy text-center">
          <p className="font-sans text-[10px] tracking-[0.3em] uppercase mb-4" style={{color: "rgba(255,255,255,0.6)"}}>Нашият Ангажимент</p>
          <h2 className="font-serif text-display-sm mb-6" style={{color: "#ffffff"}}>Непоколебима Увереност</h2>
          <div className="w-12 h-px mx-auto mb-8" style={{backgroundColor: "rgba(255,255,255,0.3)"}} />
          <p className="font-sans text-sm font-light leading-relaxed max-w-2xl mx-auto mb-6" style={{color: "rgba(255,255,255,0.8)"}}>
            Ние заставаме зад качеството на нашите часовници и бижута с пълна увереност. Всеки модел е свидетелство за отдадеността ни към съвършенството - 2 години гаранция на механизмите, доживотна гаранция на бижутата.
          </p>
          <p className="font-sans text-sm font-light leading-relaxed max-w-xl mx-auto" style={{color: "rgba(255,255,255,0.6)"}}>
            Присъединете се към общността, която празнува елегантните, прецизно изработени часовници.
          </p>

          {/* Trust badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 max-w-2xl mx-auto">
            {[
              { label: "2г. Гаранция", sub: "На механизма" },
              { label: "Доживотна", sub: "На бижутата" },
              { label: "4.8 ★", sub: "1000+ ревюта" },
              { label: "30 дни", sub: "Лесна замяна" },
            ].map(({ label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <p className="font-sans text-sm font-medium tracking-wide" style={{color: "#ffffff"}}>{label}</p>
                <p className="font-sans text-[10px] tracking-widest uppercase" style={{color: "rgba(255,255,255,0.45)"}}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="w-12 h-px bg-border mx-auto mb-10" />
          <p className="font-serif text-display-sm text-charcoal mb-8">Намерете своя стил</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/watches" className="btn-primary min-w-[200px]">
              Разгледай Часовници
            </Link>
            <Link href="/jewellery" className="btn-outline min-w-[200px]">
              Разгледай Бижута
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
