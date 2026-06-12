"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

const FALLBACK_PHOTOS = [
  { url: "/beautiful/chrono-glow.webp",           alt: "Lorenzo Ricci Chrono Black луксозен хронограф - светещ циферблат нощен режим" },
  { url: "/beautiful/eclipse-box.webp",            alt: "Lorenzo Ricci Golden Eclipse позлатен хронограф с луксозна подаръчна кутия" },
  { url: "/instagram/ig-DWQ1ks8D-Fe.webp",         alt: "Lorenzo Ricci часовник на китката - @ricciwatches Instagram" },
  { url: "/instagram/ig-DWVPBOKDcOH.webp",         alt: "Lorenzo Ricci луксозен хронограф lifestyle - @ricciwatches Instagram" },
  { url: "/instagram/ig-DWJAazqjcH3.webp",         alt: "Lorenzo Ricci бижута и часовник - @ricciwatches Instagram" },
  { url: "/instagram/ig-DWRYBTClHir.webp",         alt: "Lorenzo Ricci колекция часовници - @ricciwatches Instagram" },
];

interface IgPost {
  id: string;
  url: string;
  alt: string;
  permalink: string;
}

export function InstagramSection() {
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/instagram")
      .then((r) => r.json())
      .then((data) => {
        if (data.posts && data.posts.length > 0) {
          setPosts(data.posts.slice(0, 6));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const items = posts.length > 0
    ? posts.map((p, i) => ({ ...p, alt: `Lorenzo Ricci луксозен часовник - @ricciwatches Instagram ${i + 1}` }))
    : FALLBACK_PHOTOS.map((item, i) => ({
        id: String(i),
        url: item.url,
        alt: item.alt,
        permalink: "https://www.instagram.com/ricciwatches/",
      }));

  return (
    <section className="bg-charcoal-deep py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-10">
          <p className="font-sans text-[10px] tracking-[0.35em] uppercase text-white/50 mb-3">Следвай ни</p>
          <a
            href="https://www.instagram.com/ricciwatches/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-serif text-display-sm text-white hover:text-white/80 transition-colors"
          >
            @ricciwatches
          </a>
          <p className="font-sans text-[10px] font-light text-white/30 tracking-widest uppercase mt-1">
            Instagram
          </p>
        </div>

        {/* 2 rows × 3 columns = 6 posts */}
        <div className="grid grid-cols-3 gap-0.5">
          {items.map((post, i) => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden bg-charcoal block"
            >
              <Image
                src={post.url}
                alt={post.alt}
                fill
                quality={75}
                sizes="(max-width: 640px) 33vw, 17vw"
                className={`object-cover object-center transition-all duration-700 group-hover:scale-110 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setLoaded(true)}
              />
              <div className="absolute inset-0 bg-navy/0 group-hover:bg-navy/40 transition-colors duration-300 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>
            </a>
          ))}
        </div>

        <div className="text-center mt-8">
          <a
            href="https://www.instagram.com/ricciwatches/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-sans text-[10px] tracking-[0.28em] uppercase text-white/50 hover:text-white transition-colors duration-300 border-b border-white/20 hover:border-white pb-0.5"
          >
            Виж всички публикации
          </a>
        </div>
      </div>
    </section>
  );
}
