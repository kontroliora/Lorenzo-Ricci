// "Поръчай до 21.12 – доставка преди Коледа" (owner, 15.11.2026), BG site: shown from 01.12.2026 00:00 until 21.12.2026 23:59
// Sofia time, on the watch pages (listing + product page), in the cart and in the home hero. Gone after that on its own.
// 21.12.2026 is a Monday: ordered by then -> dispatched by Tue 22.12 -> delivered by Wed 23.12 (24.12 is a holiday).
// The pages are static (rebuilt hourly), so the line is decided in the browser (components/ui/ChristmasDeliveryLine.tsx) and
// appears / disappears at the exact minute.

export const CHRISTMAS_DELIVERY = {
  startsAt: "2026-12-01T00:00:00+02:00",
  endsAt: "2026-12-21T23:59:59+02:00",
  text: "Поръчай до 21.12 – доставка преди Коледа",
} as const;

export const christmasDeliveryActive = (now: Date = new Date()): boolean =>
  now.getTime() >= Date.parse(CHRISTMAS_DELIVERY.startsAt) && now.getTime() <= Date.parse(CHRISTMAS_DELIVERY.endsAt);
