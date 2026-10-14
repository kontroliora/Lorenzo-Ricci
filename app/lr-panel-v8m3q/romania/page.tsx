import { redirect } from "next/navigation";

// The separate "Румъния" tab is gone: Romanian orders are in "Поръчки" with a 🇷🇴 RO badge and the Всички / България / Румъния filter.
// Old bookmarks land on the Romanian view of that list.
export default function RomaniaRedirect() {
  redirect("/lr-panel-v8m3q/orders?m=ro");
}
