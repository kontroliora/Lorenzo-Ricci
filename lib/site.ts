// The public origin the shop is served from (lorenzo-ricci.com 308-redirects to www). One
// place for the absolute URLs that crawlers read: sitemap.xml, robots.txt, product JSON-LD.
export const SITE_URL = "https://www.lorenzo-ricci.com";

export const absUrl = (path: string): string => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
