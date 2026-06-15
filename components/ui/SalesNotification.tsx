"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const NOTIFICATIONS = [
  {
    city: "София",
    product: "Chrono Black",
    minutes: 2,
    imageSrc: "/Products/watches/Chrono Black/chrono-black-hronograf-preden-izgled.webp",
  },
  {
    city: "Пловдив",
    product: "Golden Eclipse",
    minutes: 5,
    imageSrc: "/Products/watches/Golden Eclipse/golden-eclipse-hronograf-preden-izgled.webp",
  },
  {
    city: "Варна",
    product: "Гривна Diamante Cross",
    minutes: 3,
    imageSrc: "/Products/jewellery/bracelet Diamante Cross/grivna-diamante-cross-18k-pvd-preden-izgled.webp",
  },
  {
    city: "Бургас",
    product: "Колие Grande Imperiale",
    minutes: 7,
    imageSrc: "/Products/jewellery/Necklace Grande Imperiale /kolie-grande-imperiale-18k-pvd-preden-izgled.webp",
  },
  {
    city: "Стара Загора",
    product: "Polar Frost",
    minutes: 4,
    imageSrc: "/Products/watches/Polar Frost/polar-frost-hronograf-preden-izgled.webp",
  },
  {
    city: "Велико Търново",
    product: "Гривна Milano Forte",
    minutes: 11,
    imageSrc: "/Products/jewellery/Bracelet Milano Forte/grivna-milano-forte-18k-pvd-preden-izgled.webp",
  },
  {
    city: "Русе",
    product: "Golden Eclipse",
    minutes: 6,
    imageSrc: "/Products/watches/Golden Eclipse/golden-eclipse-hronograf-preden-izgled.webp",
  },
  {
    city: "Плевен",
    product: "Колие Aurelius Cross",
    minutes: 9,
    imageSrc: "/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-18k-pvd-preden-izgled.webp",
  },
  {
    city: "Благоевград",
    product: "Chrono Black",
    minutes: 3,
    imageSrc: "/Products/watches/Chrono Black/chrono-black-hronograf-preden-izgled.webp",
  },
  {
    city: "Добрич",
    product: "Гривна Signature",
    minutes: 14,
    imageSrc: "/Products/jewellery/Bracelet Signature/grivna-signature-18k-pvd-preden-izgled.webp",
  },
  {
    city: "Шумен",
    product: "Polar Frost",
    minutes: 8,
    imageSrc: "/Products/watches/Polar Frost/polar-frost-hronograf-preden-izgled.webp",
  },
  {
    city: "Монтана",
    product: "Колие Milano Twist",
    minutes: 12,
    imageSrc: "/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-18k-pvd-preden-izgled.webp",
  },
];

interface NotificationState {
  city: string;
  product: string;
  minutes: number;
  imageSrc: string;
  visible: boolean;
  key: number;
}

const SHOW_INTERVAL_MS  = 15_000;
const DISPLAY_DURATION_MS = 6_000;

export function SalesNotification() {
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [index, setIndex] = useState(0);

  const show = useCallback(() => {
    const n = NOTIFICATIONS[index % NOTIFICATIONS.length];
    setIndex((i) => i + 1);
    setNotification({ ...n, visible: true, key: Date.now() });

    setTimeout(() => {
      setNotification((prev) => (prev ? { ...prev, visible: false } : null));
      setTimeout(() => setNotification(null), 600);
    }, DISPLAY_DURATION_MS);
  }, [index]);

  useEffect(() => {
    const firstTimer = setTimeout(show, 6_000);
    return () => clearTimeout(firstTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notification) return;
    const interval = setInterval(show, SHOW_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification]);

  if (!notification) return null;

  return (
    // HARD CONSTRAINT: hidden on mobile, only on lg+ screens
    <div className="hidden lg:block fixed bottom-6 left-6 z-[60]">
      <div
        key={notification.key}
        className={`bg-charcoal-deep border border-navy/20 shadow-xl flex items-center gap-3 pl-3 pr-4 py-3 max-w-[320px] ${
          notification.visible
            ? "animate-notification-in"
            : "animate-notification-out"
        }`}
      >
        {/* Product thumbnail */}
        <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border border-white/8 bg-white/5">
          <Image
            src={notification.imageSrc}
            alt={notification.product}
            fill
            quality={70}
            sizes="48px"
            className="object-contain object-center p-1"
            unoptimized
          />
          {/* Live pulse dot - bottom-right corner of image */}
          <div className="absolute bottom-0.5 right-0.5">
            <div className="relative w-2 h-2">
              <div className="w-2 h-2 bg-navy rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-navy rounded-full animate-ping opacity-75" />
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[11px] font-light text-white/90 leading-snug">
            <span className="font-medium text-white">{notification.city}</span>
            {" "}- някой купи{" "}
            <span className="text-navy-pale font-normal">{notification.product}</span>
          </p>
          <p className="font-sans text-[10px] text-white/40 mt-0.5 tracking-wide">
            преди {notification.minutes}{" "}
            {notification.minutes === 1 ? "минута" : "минути"}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={() => setNotification(null)}
          aria-label="Затвори"
          className="text-white/30 hover:text-white transition-colors text-lg leading-none flex-shrink-0 ml-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
