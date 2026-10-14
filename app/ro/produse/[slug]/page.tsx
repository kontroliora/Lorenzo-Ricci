import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { getProductBySlug } from "@/lib/products";
import { getReviewsBySlug, reviewSummary } from "@/lib/reviews";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { getLiveStock } from "@/lib/live-stock";
import { RO_SLUGS, localizeProduct } from "@/lib/ro/catalog";
import { ronOf } from "@/lib/ro/config";
import { fmtRON, RO_FREE_SHIPPING_RON } from "@/lib/ro/config";
import { roProductJsonLd, jsonLdString } from "@/lib/ro/product-jsonld";
import { RoProductGallery } from "@/components/ro/product/RoProductGallery";
import { RoProductInfo } from "@/components/ro/product/RoProductInfo";
import { RoProductEditorial } from "@/components/ro/product/RoProductEditorial";
import { RoLeatherDescription } from "@/components/ro/product/RoLeatherDescription";
import { RoProductReviews } from "@/components/ro/product/RoProductReviews";

// Romania market test (/ro/produse/<slug>): watches + crocodile leather goods in lei, cash on delivery.
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

// Only products sold in Romania exist under /ro (never jewellery or the EUR 4000 bag); the price is the
// override-applied EUR price (what the Bulgarian page would show), then the Romanian text is merged in.
async function loadRoProduct(slug: string): Promise<Product | null> {
  if (!RO_SLUGS.includes(slug)) return null;
  const raw = getProductBySlug(slug);
  if (!raw) return null;
  return localizeProduct(applyOverride(raw, await getPriceOverrides()));
}

// Reviews come from the Bulgarian store (lib/reviews.ts). Count/average are computed exactly as the Bulgarian
// ProductReviews does: the hand-kept summary first (it covers the full dataset), else the product's own reviews.
function reviewStats(slug: string) {
  const reviews = getReviewsBySlug(slug);
  const summary = reviewSummary[slug];
  const count = summary?.count ?? reviews.length;
  const avg = summary?.avg ?? (reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0);
  return { count, avg, forJsonLd: reviews.length > 0 && summary ? summary : null };
}

// Cut at a word boundary, for meta descriptions.
const clip = (s: string, max: number) => {
  if (s.length <= max) return s;
  const i = s.lastIndexOf(" ", max);
  return `${s.slice(0, i > 0 ? i : max).trim()}…`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadRoProduct(slug);
  if (!product) return {};
  const url = `https://lorenzo-ricci.com/ro/produse/${product.slug}`;
  const tagline = product.shortDescription.replace(/[.\s]+$/, "");
  return {
    title: product.name,
    description: `${product.name} - ${tagline}. ${fmtRON(ronOf(product))}. ${product.warranty ? `${product.warranty}. ` : ""}Livrare gratuită de la ${fmtRON(RO_FREE_SHIPPING_RON)}. Plată ramburs.`,
    alternates: { canonical: url },
    // openGraph replaces (not merges with) the one in app/ro/layout.tsx, so locale/site name are repeated.
    openGraph: {
      type: "website",
      locale: "ro_RO",
      siteName: "Lorenzo Ricci",
      url,
      title: `${product.name} | Lorenzo Ricci`,
      description: clip(product.description, 160),
      images: [{ url: encodeURI(product.coverImage.src), alt: product.coverImage.alt }],
    },
  };
}

export default async function RoProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await loadRoProduct(slug);
  if (!product) notFound();

  const stats = reviewStats(slug);
  const liveStock = await getLiveStock(slug);
  const jsonLd = roProductJsonLd(product, { liveStock, reviews: stats.forJsonLd });

  // For watches: hide night images and side-profile images from the gallery
  // (night images stay in product.images[] so the moon button on cards still works)
  const galleryImages = product.category === "watches"
    ? product.images.filter(
        (img) => !img.src.includes("night") && !img.src.includes("stranichen")
      )
    : product.images;

  const isWatch = product.category === "watches";

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-sans tracking-widest uppercase text-ink-faint mb-10">
          <Link href="/ro" className="hover:text-navy transition-colors duration-200">Acasă</Link>
          <span className="text-border-strong">/</span>
          <Link
            href={isWatch ? "/ro/ceasuri" : "/ro/piele-de-crocodil"}
            className="hover:text-navy transition-colors duration-200"
          >
            {isWatch ? "Ceasuri" : "Articole din piele de crocodil"}
          </Link>
          <span className="text-border-strong">/</span>
          <span className="text-ink-muted">{product.name}</span>
        </div>

        {/* Product main */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16">
          <RoProductGallery images={galleryImages} productName={product.name} />
          <div>
            <RoProductInfo product={product} reviewCount={stats.count} reviewAvg={stats.avg} />
          </div>
        </div>

        {/* Editorial storytelling section - watches that have editorial photos */}
        {product.descriptionImages && product.descriptionImages.length > 0 && (
          <RoProductEditorial product={product} />
        )}

        {/* Leather description - material & craft */}
        {!isWatch && !product.hideLeatherDescription && (
          <RoLeatherDescription product={product} videoSrc={CARDHOLDER_VIDEOS[product.slug]} />
        )}

        {/* Reviews (summary only) */}
        {stats.count > 0 && (
          <div className="mt-20">
            <RoProductReviews count={stats.count} avg={stats.avg} />
          </div>
        )}
      </div>
    </div>
  );
}
