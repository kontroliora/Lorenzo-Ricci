import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { getProductBySlug } from "@/lib/products";
import { BUNDLES } from "@/lib/bundles";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { getLiveStock } from "@/lib/live-stock";
import { RO_SLUGS, localizeProduct } from "@/lib/ro/catalog";
import { RO_REVIEWS_NOTE, localizeReview } from "@/lib/ro/reviews-ro";
import { getCategoryType, getCategorySlugs, getCategoryReviews, getCategorySummary } from "@/lib/reviews";
import { ronOf, roNeedsPrepayment, fmtRON, RO_FREE_SHIPPING_RON } from "@/lib/ro/config";
import { roProductJsonLd, jsonLdString } from "@/lib/ro/product-jsonld";
import { RoProductGallery } from "@/components/ro/product/RoProductGallery";
import { RoProductInfo } from "@/components/ro/product/RoProductInfo";
import { RoBundleUpsell } from "@/components/ro/product/RoBundleUpsell";
import { RoProductEditorial } from "@/components/ro/product/RoProductEditorial";
import { RoJewelleryDescription } from "@/components/ro/product/RoJewelleryDescription";
import { RoLeatherDescription } from "@/components/ro/product/RoLeatherDescription";
import { RoProductReviews, type RoReviewPool } from "@/components/ro/product/RoProductReviews";
import { roSafeProduct, roMissingText } from "@/components/ro/product/ro-text";
import { roReviewView } from "@/components/ro/product/review-data";

// Romanian storefront (/ro/produse/<slug>): the whole Bulgarian catalogue (watches, jewellery, crocodile leather goods) in lei, with the
// same sale as the Bulgarian site (current price + crossed-out old price + badge, both converted to whole lei).
// Like the Bulgarian product page it stays statically generated (no cookies/headers): price overrides come from
// the tagged Data Cache (revalidated by the admin discount route) and the live stock is a revalidating fetch
// (lib/live-stock.ts), so the markup follows both without a deploy.

const CARDHOLDER_VIDEOS: Record<string, string> = {
  "cardholder-bianco":    "/cardholder-bianco-leather.mp4",
  "cardholder-valentina": "/cardholder-valentina-leather.mp4",
  "cardholder-zaffiro":   "/cardholder-zaffiro-leather.mp4",
  "cardholder-ambra":     "/cardholder-ambra-leather.mp4",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return RO_SLUGS.map((slug) => ({ slug }));
}

type PriceOverrides = Awaited<ReturnType<typeof getPriceOverrides>>;

// The product as the Romanian page shows it: the override-applied EUR price (what the Bulgarian page would show), the Romanian
// text merged in, then every field that still carries Bulgarian wording (overlay missing) dropped - the page never prints it.
// `missingText` tells the page that this happened (it then asks search engines not to index the page yet).
function roView(raw: Product, overrides: PriceOverrides): { product: Product; missingText: boolean } {
  const localized = localizeProduct(applyOverride(raw, overrides));
  return { product: roSafeProduct(localized), missingText: roMissingText(localized) };
}

// Only the catalogue's own slugs exist under /ro (unknown slugs are a 404).
async function loadRoProduct(slug: string) {
  if (!RO_SLUGS.includes(slug)) return null;
  const raw = getProductBySlug(slug);
  if (!raw) return null;
  const overrides = await getPriceOverrides();
  return { ...roView(raw, overrides), overrides };
}

// The set offer needs only the name, the price and the cover photo of its pieces: the long texts stay out of the client payload.
const slim = (p: Product): Product => ({
  ...p,
  description: "",
  shortDescription: "",
  tabDescription: undefined,
  descriptionSections: undefined,
  materialNote: undefined,
  features: [],
  specs: [],
  images: [p.coverImage],
  descriptionImages: undefined,
  descriptionImage: undefined,
});

// The set (lib/bundles.ts) this product belongs to, with the products that can fill its other slot (localized, override-applied).
// Same lookup as the Bulgarian BundleUpsell; stock and the "no discount while on sale" rule are judged in the component.
function bundleFor(product: Product, overrides: PriceOverrides): { discountPct: number; partners: Product[] } | null {
  const bundle = BUNDLES.find((b) => b.slots.some((slot) => slot.includes(product.id)));
  if (!bundle) return null;
  const partnerSlot = bundle.slots.find((slot) => !slot.includes(product.id));
  if (!partnerSlot) return null;
  const partners = partnerSlot
    .filter((slug) => RO_SLUGS.includes(slug))
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => !!p && p.inStock)
    .map((p) => slim(roView(p, overrides).product));
  return partners.length > 0 ? { discountPct: bundle.discountPct, partners } : null;
}

// Cut at a word boundary, for meta descriptions.
const clip = (s: string, max: number) => {
  if (s.length <= max) return s;
  const i = s.lastIndexOf(" ", max);
  return `${s.slice(0, i > 0 ? i : max).trim()}…`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadRoProduct(slug);
  if (!loaded) return {};
  const { product, missingText } = loaded;
  const url = `https://lorenzo-ricci.com/ro/produse/${product.slug}`;
  const tagline = product.shortDescription.replace(/[.\s]+$/, "");
  const warranty = product.warranty.replace(/[.\s]+$/, "");
  // Matches the checkout: card only; prepayment items are arranged directly with the shop.
  const paymentNote = roNeedsPrepayment(product) ? "Comandă cu plată în avans." : "Plată cu cardul, online.";
  const description =
    `${product.name}${tagline ? ` - ${tagline}` : ""}. ${fmtRON(ronOf(product))}. ${warranty ? `${warranty}. ` : ""}` +
    `Livrare gratuită de la ${fmtRON(RO_FREE_SHIPPING_RON)}. ${paymentNote}`;
  return {
    title: product.name,
    description,
    alternates: {
      canonical: url,
      languages: {
        "ro-RO": url,
        "bg-BG": `https://lorenzo-ricci.com/products/${product.slug}`,
      },
    },
    // A product whose Romanian text is still incomplete is not indexed until it is.
    ...(missingText ? { robots: { index: false, follow: true } } : {}),
    // openGraph replaces (not merges with) the one in app/ro/layout.tsx, so locale/site name are repeated.
    openGraph: {
      type: "website",
      locale: "ro_RO",
      siteName: "Lorenzo Ricci",
      url,
      title: `${product.name} | Lorenzo Ricci`,
      description: product.description.trim() ? clip(product.description, 160) : description,
      images: [{ url: encodeURI(product.coverImage.src), alt: product.coverImage.alt }],
    },
  };
}

export default async function RoProductPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await loadRoProduct(slug);
  if (!loaded) notFound();
  const { product, overrides } = loaded;

  const ownReviews = roReviewView(slug);
  const liveStock = await getLiveStock(slug);
  // JSON-LD aggregateRating uses ONLY this product's own reviews (never pooled).
  const jsonLd = roProductJsonLd(product, { liveStock, reviews: ownReviews.ldSummary });
  const bundle = bundleFor(product, overrides);

  // Category pool: all cardholder or wallet reviews in Romanian, own product first.
  const categoryType = getCategoryType(slug);
  const categoryReviews = getCategoryReviews(slug);
  const catSummary = getCategorySummary(slug);
  let roPool: RoReviewPool | undefined;
  if (categoryType && categoryReviews && catSummary) {
    const categorySlugs = getCategorySlugs(slug)!;
    const productInfoMap: RoReviewPool["productInfo"] = {};
    for (const s of categorySlugs) {
      const raw = getProductBySlug(s);
      if (raw) {
        const shortName = raw.name.match(/"([^"]+)"/)?.[1] ?? raw.name;
        productInfoMap[s] = {
          shortName,
          href: `/ro/produse/${s}`,
          coverSrc: raw.coverImage.src,
        };
      }
    }
    roPool = {
      heading: categoryType === "cardholders"
        ? "Recenzii pentru portcarduri Lorenzo Ricci"
        : "Recenzii pentru portofele Lorenzo Ricci",
      countLabel: categoryType === "cardholders"
        ? "pentru portcarduri"
        : "pentru portofele",
      productPrefix: categoryType === "cardholders" ? "pentru portcard" : "pentru portofel",
      productInfo: productInfoMap,
      productSlug: slug,
    };
  }

  // When category pooling is active, build localized reviews from all category slugs.
  const displayReviews = (() => {
    if (!categoryType || !categoryReviews) return ownReviews;
    const allLocalized = categoryReviews.map(localizeReview).filter((r): r is NonNullable<typeof r> => r !== null);
    const ownRaw = categoryReviews.filter((r) => r.productSlug === slug);
    const ownLocalized = ownRaw.map(localizeReview).filter((r): r is NonNullable<typeof r> => r !== null);
    return {
      ...ownReviews,
      reviews: allLocalized,
      count: catSummary!.count,
      avg: catSummary!.avg,
      allTranslated: ownRaw.length > 0 && ownLocalized.length === ownRaw.length,
    };
  })();

  // For watches: hide night images and side-profile images from the gallery
  // (night images stay in product.images[] so the moon button on cards still works)
  const galleryImages = product.category === "watches"
    ? product.images.filter(
        (img) => !img.src.includes("night") && !img.src.includes("stranichen")
      )
    : product.images;

  const isWatch = product.category === "watches";
  const isJewellery = product.category === "jewellery";
  const crumb = isWatch
    ? { href: "/ro/ceasuri", label: "Ceasuri" }
    : isJewellery
    ? { href: "/ro/bijuterii", label: "Bijuterii" }
    : { href: "/ro/piele-de-crocodil", label: "Articole din piele de crocodil" };

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-sans tracking-widest uppercase text-ink-faint mb-10">
          <Link href="/ro" className="hover:text-navy transition-colors duration-200">Acasă</Link>
          <span className="text-border-strong">/</span>
          <Link href={crumb.href} className="hover:text-navy transition-colors duration-200">
            {crumb.label}
          </Link>
          <span className="text-border-strong">/</span>
          <span className="text-ink-muted">{product.name}</span>
        </div>

        {/* Product main */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16">
          <RoProductGallery images={galleryImages} productName={product.name} />
          <div>
            <RoProductInfo
              product={product}
              reviewCount={ownReviews.count}
              reviewAvg={ownReviews.avg}
              reviewsTranslated={ownReviews.allTranslated}
            />
            {bundle && <RoBundleUpsell product={slim(product)} partners={bundle.partners} discountPct={bundle.discountPct} />}
          </div>
        </div>

        {/* Editorial storytelling section - watches that have editorial photos */}
        {product.descriptionImages && product.descriptionImages.length > 0 && (
          <RoProductEditorial product={product} />
        )}

        {/* Jewellery description - two product images + quality comparison */}
        {isJewellery && <RoJewelleryDescription />}

        {/* Leather description - material & craft */}
        {!isWatch && !isJewellery && !product.hideLeatherDescription && (
          <RoLeatherDescription product={product} videoSrc={CARDHOLDER_VIDEOS[product.slug]} />
        )}

        {/* Reviews: category-pooled for cardholders/wallets; own-only for everything else */}
        {displayReviews.count > 0 && (
          <div className="mt-20">
            <RoProductReviews
              reviews={displayReviews.reviews}
              count={displayReviews.count}
              avg={displayReviews.avg}
              translated={displayReviews.allTranslated}
              note={RO_REVIEWS_NOTE}
              pool={roPool}
            />
          </div>
        )}
      </div>
    </div>
  );
}
