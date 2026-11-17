import { HeroCollectionSlide } from "@/components/home/HeroCollectionSlide";

// Romanian counterpart of components/home/Hero.tsx (owner, 17.11.2026): ONE static slide, "Colecția pentru femei" - the necklace and the
// bracelet on a model, the title, the 1+1 line and the button. No slider: no other slides, no dots, no automatic switching, no swipe.
// The former first slide (the brand cover with the looping video and the buttons to the watches) is not drawn any more; its files
// (public/covers/*, public/hero-video-*.mp4) are untouched and the old component is in git history (before 17.11.2026).
export function RoHero() {
  return (
    <section data-testid="hero" className="relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden bg-charcoal-deep">
      <HeroCollectionSlide
        active
        mounted
        priority
        tag="Lorenzo Ricci · 2026"
        title="Colecția pentru femei"
        badge="1+1 GRATUIT"
        line="A doua bijuterie este cadou"
        cta="Descoperiți colecția"
        href="/ro/bijuterii#colectia-pentru-femei"
        alts={{ necklace: "Colier Lumen – Argintiu purtat, colecția pentru femei Lorenzo Ricci", bracelet: "Brățară Lumen – Argintiu purtată, colecția pentru femei Lorenzo Ricci" }}
      />
    </section>
  );
}
