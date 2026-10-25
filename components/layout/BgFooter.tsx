"use client";
import dynamic from "next/dynamic";

// The Bulgarian footer, loaded as its own client chunk. The root layout renders it inside HideOnAdmin, which returns nothing on /ro
// (and the panel): rendered there as a server component, its Bulgarian text (incl. "−5% при плащане с карта") still travelled in the
// page data of every Romanian page. As a lazy client chunk it is server-rendered on the Bulgarian pages exactly as before and never
// reaches /ro (not in the HTML, not in the page data, not downloaded).
const Footer = dynamic(() => import("./Footer").then((m) => m.Footer));

export function BgFooter() {
  return <Footer />;
}
