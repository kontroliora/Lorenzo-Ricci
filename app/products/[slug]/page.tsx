import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { products, getProductBySlug, getRelatedProducts } from "@/lib/products";
import { getReviewsBySlug, reviewSummary } from "@/lib/reviews";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductEditorial } from "@/components/product/ProductEditorial";
import { BundleUpsell } from "@/components/product/BundleUpsell";
import { JewelleryDescription } from "@/components/product/JewelleryDescription";
import { LeatherDescription } from "@/components/product/LeatherDescription";
import { requiresPrepayment } from "@/lib/price";
import { getPriceOverrides, applyOverride, applyOverrides } from "@/lib/price-overrides";
import { getLiveStock } from "@/lib/live-stock";
import { productJsonLd, jsonLdString } from "@/lib/product-jsonld";

// Durable price overrides (supabase/product_price_overrides.sql, read via
// lib/price-overrides.ts) — every product page stays statically generated
// (generateStaticParams below); the admin discount route calls
// revalidatePath(`/products/${slug}`) on every write so a change shows up
// within seconds without a fresh deploy.

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
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  // Matches the checkout: prepayment items are arranged directly with us (no specific method promised).
  const paymentNote = requiresPrepayment(product) ? "Поръчка с предплащане." : "Наложен платеж.";
  return {
    title: product.name,
    description: `${product.name} - ${product.shortDescription}. ${product.currency}${product.price}. ${product.warranty ? `${product.warranty}. ` : ""}Безплатна доставка над €60. ${paymentNote}`,
    openGraph: {
      title: `${product.name} | Lorenzo Ricci`,
      description: product.description.slice(0, 160),
      images: [{ url: product.coverImage.src, alt: product.coverImage.alt }],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const rawProduct = getProductBySlug(slug);
  if (!rawProduct) notFound();
  const overrides = await getPriceOverrides();
  const product = applyOverride(rawProduct, overrides);

  const reviews = getReviewsBySlug(slug);
  const liveStock = await getLiveStock(slug);
  const summary = reviewSummary[slug];
  const jsonLd = productJsonLd(product, {
    liveStock,
    reviews: reviews.length > 0 && summary ? summary : null,
  });
  const related = applyOverrides(getRelatedProducts(product, 4), overrides);

  // For watches: hide night images and side-profile images from the gallery
  // (night images stay in product.images[] so the moon button on cards still works)
  const galleryImages = product.category === "watches"
    ? product.images.filter(
        (img) => !img.src.includes("night") && !img.src.includes("stranichen")
      )
    : product.images;

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-sans tracking-widest uppercase text-ink-faint mb-10">
          <Link href="/" className="hover:text-navy transition-colors duration-200">Начало</Link>
          <span className="text-border-strong">/</span>
          <Link
            href={
              product.category === "watches" ? "/watches" :
              product.category === "wallets" || product.category === "cardholders" || product.category === "bags" ? "/leather-goods" :
              "/jewellery"
            }
            className="hover:text-navy transition-colors duration-200"
          >
            {product.category === "watches" ? "Часовници" :
             product.category === "wallets" ? "Портфейли" :
             product.category === "cardholders" ? "Кардхолдъри" :
             product.category === "bags" ? "Чанти" :
             "Бижута"}
          </Link>
          <span className="text-border-strong">/</span>
          <span className="text-ink-muted">{product.name}</span>
        </div>

        {/* Product main */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16">
          <ProductGallery images={galleryImages} productName={product.name} />
          <div>
            <ProductInfo product={product} reviewCount={reviewSummary[slug]?.count ?? reviews.length} />
            <BundleUpsell product={product} />
          </div>
        </div>

        {/* Editorial storytelling section - watches only */}
        {product.descriptionImages && product.descriptionImages.length > 0 && (
          <ProductEditorial product={product} />
        )}

        {/* Jewellery description - two product images + quality comparison */}
        {product.category === "jewellery" && <JewelleryDescription />}

        {/* Leather description - material & craft Q&A */}
        {(product.category === "wallets" || product.category === "cardholders" || product.category === "bags") && !product.hideLeatherDescription && (
          <LeatherDescription videoSrc={CARDHOLDER_VIDEOS[product.slug]} crocodileSpecies={product.crocodileSpecies} isBag={product.category === "bags"} image={product.descriptionImage} />
        )}

        {/* Reviews */}
        <div className="mt-20">
          <ProductReviews reviews={reviews} productSlug={slug} />
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-20">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="section-tag mb-2">Може да харесате и</p>
                <h2 className="font-serif text-display-sm text-charcoal">Подобни продукти</h2>
              </div>
              <div className="h-px flex-1 bg-border ml-8" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
