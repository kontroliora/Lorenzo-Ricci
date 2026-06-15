import Link from "next/link";
import Image from "next/image";
import { NewsletterStrip } from "./NewsletterStrip";

export function Footer() {
  return (
    <footer className="bg-white border-t border-border">
      <NewsletterStrip />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16">
        {/* Top grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-16">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Image src="/logo.webp" alt="Lorenzo Ricci" width={150} height={38} className="h-9 w-auto mb-5 logo-invert" />
            <p className="font-sans text-xs font-light text-ink-faint leading-relaxed tracking-wide mb-6">
              Създадени да впечатляват. Прецизност във всеки детайл.
            </p>
            <div className="flex gap-4">
              <SocialLink href="https://www.instagram.com/ricciwatches/" label="Instagram">
                <InstagramIcon />
              </SocialLink>
              <SocialLink href="https://www.facebook.com/lorenzoriccibg" label="Facebook">
                <FacebookIcon />
              </SocialLink>
            </div>
          </div>

          {/* Collections */}
          <div>
            <FooterHeading>Колекции</FooterHeading>
            <div className="flex flex-col gap-3">
              <FooterLink href="/watches">Часовници</FooterLink>
              <FooterLink href="/jewellery">Бижута</FooterLink>
              <FooterLink href="/jewellery#bracelets">Гривни</FooterLink>
              <FooterLink href="/jewellery#necklaces">Колиета</FooterLink>
              <FooterLink href="/leather-goods">Кожени Изделия</FooterLink>
            </div>
          </div>

          {/* Customer Care */}
          <div>
            <FooterHeading>Обслужване на клиенти</FooterHeading>
            <div className="flex flex-col gap-3">
              <FooterLink href="/faq">Често задавани въпроси</FooterLink>
              <FooterLink href="/policies/shipping">Доставка и връщане</FooterLink>
              <FooterLink href="/warranty/jewelry">Гаранция и поддръжка</FooterLink>
            </div>
          </div>

          {/* Brand & Legal */}
          <div>
            <FooterHeading>Lorenzo Ricci</FooterHeading>
            <div className="flex flex-col gap-3">
              <FooterLink href="/story">История</FooterLink>
              <FooterLink href="/policies/privacy">Политика за поверителност</FooterLink>
            </div>
          </div>

          {/* Contact */}
          <div>
            <FooterHeading>Контакт</FooterHeading>
            <div className="flex flex-col gap-3">
              <a href="mailto:info@lorenzo-ricci.com" className="font-sans text-xs font-light text-ink-muted hover:text-navy transition-colors duration-300 tracking-wide">
                info@lorenzo-ricci.com
              </a>
              <p className="font-sans text-xs font-light text-ink-faint tracking-wide leading-relaxed">Пон-Пет, 10:00-18:00</p>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 py-10 border-y border-border mb-8">
          {[
            { title: "2г Гаранция", sub: "на часовниците" },
            { title: "Доживотна гаранция", sub: "на бижутата" },
            { title: "До 2 работни дни", sub: "Еконт или Спиди" },
            { title: "Преглед преди плащане", sub: "Наложен платеж" },
          ].map(({ title, sub }) => (
            <div key={title} className="flex flex-col gap-1.5">
              <div className="w-4 h-px bg-navy/30 mb-1" />
              <p className="font-sans text-[11px] font-medium text-charcoal tracking-[0.12em] uppercase">{title}</p>
              <p className="font-sans text-[10px] font-light text-ink-faint tracking-wide">{sub}</p>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-sans text-[10px] font-light text-ink-faint tracking-widest uppercase">
            © 2026 Lorenzo Ricci. Всички права запазени.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 text-[9px] text-navy/60">★★★★★</div>
            <p className="font-sans text-[10px] font-light text-ink-faint tracking-widest uppercase">
              4.8 · 1000+ Ревюта
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy mb-5">
      {children}
    </h4>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-sans text-xs font-light text-ink-muted hover:text-navy transition-colors duration-300 tracking-wide w-fit">
      {children}
    </Link>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-ink-faint hover:text-navy transition-colors duration-300">
      {children}
    </a>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}
