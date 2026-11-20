import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { productOgImage } from "@/lib/og";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirectIfProductOff } from "@/lib/storefront-guard";
import Link from "next/link";
import { products, getProductBySlug, getRelatedProducts } from "@/lib/products";
import {
  getReviewsBySlug,
  reviewSummary,
  getCategoryType,
  getCategorySlugs,
  getCategoryReviews,
  getCategorySummary,
} from "@/lib/reviews";
import type { ReviewPool } from "@/components/product/ProductReviews";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductEditorial } from "@/components/product/ProductEditorial";
import { BundleUpsell } from "@/components/product/BundleUpsell";
import { JewelleryDescription } from "@/components/product/JewelleryDescription";
import { LeatherDescription } from "@/components/product/LeatherDescription";
import { eurText, requiresPrepayment } from "@/lib/price";
import { getPriceOverrides, applyOverride, applyOverrides } from "@/lib/price-overrides";
import { getLiveStock } from "@/lib/live-stock";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { productJsonLd, jsonLdString } from "@/lib/product-jsonld";
import { RO_SLUGS } from "@/lib/ro/catalog";
import { collectionRelated, isCollectionSlug, NEW_COLLECTION_SLUGS } from "@/lib/new-collection";
import { ActiveProductProvider, ActiveProductName, ShowForPair } from "@/components/product/CollectionProductView";
import { CollectionViewBg } from "@/components/product/CollectionViewBg";
import { CollectionReviews } from "@/components/product/CollectionReviews";
import { RO_STORE_ENABLED } from "@/lib/ro-store";
import { absUrl } from "@/lib/site";
import { userReviewsOn } from "@/lib/storefront";
import { getApprovedReviews, getApprovedReviewCounts, getWomensJewelleryReviews } from "@/lib/user-reviews-server";
import { displayRating } from "@/lib/user-reviews";
import { UserReviews } from "@/components/product/UserReviews";

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
  const paymentNote = requiresPrepayment(product) ? "Поръчка с предплащане." : CARD_PAYMENTS_ENABLED ? "Плащане с карта (−5%) или наложен платеж." : "Наложен платеж.";
  // Watches get their own keywords (the site-wide list in app/layout.tsx names jewellery, 18K PVD and other models):
  // the model and what its own specs say.
  const movement = product.specs.find((s) => s.label === "Механизъм")?.value ?? "";
  const keywords = product.category === "watches"
    ? ["Lorenzo Ricci", product.name, "луксозен часовник", ...(/хронограф/i.test(movement) ? ["хронограф"] : []), "японски кварцов механизъм", "сапфирено стъкло", "5 ATM"]
    : undefined;
  // Leather goods are named 'Lorenzo Ricci "Onice"': the tab title would repeat the brand (template "%s | Lorenzo Ricci").
  // Owner, 09.11.2026: "Картодържател Onice | Lorenzo Ricci".
  const LEATHER_TYPE: Partial<Record<string, string>> = { cardholders: "Картодържател", wallets: "Портфейл", bags: "Чанта" };
  const model = product.name.match(/^Lorenzo Ricci\s+"([^"]+)"\s*$/)?.[1];
  const pageTitle = model && LEATHER_TYPE[product.category] ? `${LEATHER_TYPE[product.category]} ${model}` : product.name.replace(/\s+/g, " ").trim();
  return {
    title: pageTitle,
    ...(keywords && { keywords }),
    // Always the page's OWN absolute address (no query string): a women's-collection page switches pieces in place and rewrites the
    // address bar (components/product/CollectionProductView.tsx), but the document stays the one rendered for this slug, so it names itself.
    // hreflang only while the Romanian store is on (lib/ro-store.ts: off = every /ro page redirects, and a hreflang to a redirect is
    // ignored); the Romanian page lists this page back (app/ro/produse/[slug]/page.tsx), so the pair is reciprocal.
    alternates: {
      canonical: absUrl(`/products/${product.slug}`), // SITE_URL (www): the apex 308-redirects there
      ...(RO_STORE_ENABLED && RO_SLUGS.includes(product.slug) ? { languages: { "bg-BG": absUrl(`/products/${product.slug}`), "ro-RO": absUrl(`/ro/produse/${product.slug}`) } } : {}),
    },
    description: `${product.name} - ${product.shortDescription}. ${eurText(product.price, product.currency)}. ${product.warranty ? `${product.warranty}. ` : ""}Безплатна доставка над €60. ${paymentNote}`,
    // openGraph replaces (not merges with) the one in app/layout.tsx, so type/locale/site name are repeated.
    openGraph: {
      type: "website",
      locale: "bg_BG",
      siteName: "Lorenzo Ricci",
      url: `https://lorenzo-ricci.com/products/${product.slug}`,
      title: `${pageTitle} | Lorenzo Ricci`,
      description: product.description.slice(0, 160),
      images: [productOgImage(product)],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const rawProduct = getProductBySlug(slug);
  if (!rawProduct) { redirectIfProductOff(slug); notFound(); } // a product of a hidden collection (lib/storefront.ts) -> the women's collection, an unknown slug -> 404
  const overrides = await getPriceOverrides();
  const product = applyOverride(rawProduct, overrides);

  // Moderated customer reviews (lib/storefront.ts USER_REVIEWS, currently the women's bracelets + necklaces): only APPROVED ones.
  // Such a product ignores the older Shopify reviews of lib/reviews.ts.
  const userReviews = userReviewsOn(product);
  const [approved, womensPool] = await Promise.all([
    userReviews ? getApprovedReviews(slug) : Promise.resolve(null),
    isCollectionSlug(slug) ? getWomensJewelleryReviews() : Promise.resolve(null),
  ]);
  const reviews = userReviews ? [] : getReviewsBySlug(slug);
  const liveStock = await getLiveStock(slug);
  const summary = reviewSummary[slug];
  // JSON-LD aggregateRating uses ONLY this product's own reviews (never pooled); for a moderated product, only approved ones, and
  // only when there is at least one.
  const jsonLd = productJsonLd(product, {
    liveStock,
    reviews: approved
      ? approved.count > 0
        ? { count: approved.count, avg: approved.avg, items: approved.reviews.map((r) => ({ name: r.name, rating: r.rating, body: r.body, date: r.createdAt })) }
        : null
      : reviews.length > 0 && summary ? summary : null,
  });

  // Category pool: all cardholder or wallet reviews shown together, own product first.
  const categoryType = getCategoryType(slug);
  const categoryReviews = getCategoryReviews(slug);
  const catSummary = getCategorySummary(slug);
  let reviewPool: ReviewPool | undefined;
  if (categoryType && categoryReviews && catSummary) {
    const categorySlugs = getCategorySlugs(slug)!;
    const productInfoMap: ReviewPool["productInfo"] = {};
    for (const s of categorySlugs) {
      const p = products.find((pr) => pr.slug === s);
      if (p) {
        const shortName = p.name.match(/"([^"]+)"/)?.[1] ?? p.name;
        productInfoMap[s] = {
          shortName,
          href: `/products/${s}`,
          coverSrc: p.coverImage.src,
        };
      }
    }
    reviewPool = {
      reviews: categoryReviews,
      heading: categoryType === "cardholders"
        ? "Ревюта за кардхолдъри Lorenzo Ricci"
        : categoryType === "clutches"
        ? "Ревюта за клъчове Lorenzo Ricci"
        : "Ревюта за портфейли Lorenzo Ricci",
      count: catSummary.count,
      avg: catSummary.avg,
      countLabel: categoryType === "cardholders"
        ? "ревюта за кардхолдъри"
        : categoryType === "clutches"
        ? "ревюта за клъчове"
        : "ревюта за портфейли",
      productPrefix: categoryType === "cardholders" ? "за кардхолдър" : categoryType === "clutches" ? "за клъч" : "за портфейл",
      productInfo: productInfoMap,
    };
  }
  // "Подобни продукти" never offers something that cannot be bought (stock-driven, lib/sold-out.ts)
  const soldOut = new Set(await getSoldOutSlugs());
  // A women's-collection piece: "Комбинирайте с 1+1" with the other collection pieces only (lib/new-collection.ts collectionRelated).
  const inCollection = isCollectionSlug(product.slug);
  const related = inCollection
    ? applyOverrides(collectionRelated(product.slug, products, soldOut), overrides)
    : applyOverrides(getRelatedProducts(product, 4, soldOut), overrides);

  // For watches: hide night images and side-profile images from the gallery
  // (night images stay in product.images[] so the moon button on cards still works)
  const galleryImages = product.category === "watches"
    ? product.images.filter(
        (img) => !img.src.includes("night") && !img.src.includes("stranichen")
      )
    : product.images;

  // Women's collection: step 1 of the 1+1 boxes switches the piece in place - the server sends only what it alone knows about the pieces
  // (price overrides, sold out, review counts); the catalogue is already in the browser.
  const collectionPieces = inCollection ? products.filter((p) => NEW_COLLECTION_SLUGS.has(p.slug)) : [];
  const collectionApprovedCounts = await getApprovedReviewCounts(collectionPieces.filter(userReviewsOn).map((p) => p.slug));
  const collectionOverrides: Record<string, { price: number; originalPrice: number }> = {};
  const collectionReviewCounts: Record<string, number> = {};
  const collectionReviewAvgs: Record<string, number> = {};
  for (const p of collectionPieces) {
    const ov = overrides.get(p.slug);
    if (ov) collectionOverrides[p.slug] = ov;
    if (userReviewsOn(p)) {
      const a = collectionApprovedCounts[p.slug];
      collectionReviewCounts[p.slug] = a?.count ?? 0;
      // Cosmetic only (owner, 20.11.2026): the title badge shows a stable per-piece value in 4.6-4.9 instead of the real average,
      // which is 4.77-4.81 for every piece and always rounds to the same "4.8". The pooled reviews section below, the review list
      // and JSON-LD all still use the real a.avg - see lib/user-reviews.ts displayRating.
      if (a?.avg) collectionReviewAvgs[p.slug] = displayRating(p.slug);
    } else {
      collectionReviewCounts[p.slug] = reviewSummary[p.slug]?.count ?? getReviewsBySlug(p.slug).length;
    }
  }
  // Product info map for the pooled reviews: covers bracelet + necklace product names and cover images.
  const womensProductInfo: Record<string, { shortName: string; href: string; coverSrc: string }> = {};
  for (const p of collectionPieces) womensProductInfo[p.slug] = { shortName: p.name, href: `/products/${p.slug}`, coverSrc: p.coverImage.src };
  const womensPoolForReviews = womensPool && womensPool.count > 0 ? { ...womensPool, productInfo: womensProductInfo } : undefined;
  const collectionSoldOut = collectionPieces.filter((p) => soldOut.has(p.slug)).map((p) => p.slug);
  const collectionNames: Record<string, string> = Object.fromEntries(collectionPieces.map((p) => [p.slug, p.name]));
  const Shell = ({ children }: { children: React.ReactNode }) =>
    inCollection ? <ActiveProductProvider key={slug} initialSlug={slug}>{children}</ActiveProductProvider> : <>{children}</>;

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <Shell>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-sans tracking-widest uppercase text-ink-faint mb-10">
          <Link href="/" className="[@media(pointer:coarse)]:py-4 [@media(pointer:coarse)]:-my-4 [@media(pointer:coarse)]:min-w-[44px] hover:text-navy transition-colors duration-200">Начало</Link>
          <span className="text-border-strong">/</span>
          <Link
            href={
              product.category === "watches" ? "/watches" :
              product.category === "wallets" || product.category === "cardholders" || product.category === "bags" ? "/leather-goods" :
              "/jewellery"
            }
            className="[@media(pointer:coarse)]:py-4 [@media(pointer:coarse)]:-my-4 [@media(pointer:coarse)]:min-w-[44px] hover:text-navy transition-colors duration-200"
          >
            {product.category === "watches" ? "Часовници" :
             product.category === "wallets" ? "Портфейли" :
             product.category === "cardholders" ? "Кардхолдъри" :
             product.category === "bags" ? "Чанти" :
             "Бижута"}
          </Link>
          <span className="text-border-strong">/</span>
          <span className="text-ink-muted">{inCollection ? <ActiveProductName pageSlug={slug} names={collectionNames} /> : product.name}</span>
        </div>

        {/* Product main */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16">
          {inCollection ? (
            // Women's collection: gallery + info switch pieces in place with step 1 (no "Завърши визията" block: the 1+1 picker already
            // offers the matching piece; sets stay in /bundles)
            <CollectionViewBg pageSlug={slug} priceOverrides={collectionOverrides} soldOut={collectionSoldOut} reviewCounts={collectionReviewCounts} reviewAvgs={collectionReviewAvgs} />
          ) : (
            <>
              <ProductGallery images={galleryImages} productName={product.name} />
              <div>
                <ProductInfo product={product} reviewCount={approved?.count ?? reviewSummary[slug]?.count ?? reviews.length} reviewAvg={approved?.avg} />
                <BundleUpsell product={product} />
              </div>
            </>
          )}
        </div>

        {/* Editorial storytelling section - watches only */}
        {product.descriptionImages && product.descriptionImages.length > 0 && (
          <ProductEditorial product={product} />
        )}

        {/* Jewellery description - two product images + quality comparison (18K PVD gold: not on a silver piece) */}
        {product.category === "jewellery" && (inCollection
          // a collection page: the 18K PVD gold section shows while at least one of the two 1+1 pieces is gold (owner, 18.11.2026)
          ? <ShowForPair pageSlug={slug} slugs={collectionPieces.filter((p) => p.metal !== "silver").map((p) => p.slug)}><JewelleryDescription stamp={false} comparison={false} /></ShowForPair>
          : product.metal !== "silver" && <JewelleryDescription stamp={!isCollectionSlug(product.slug)} comparison={!isCollectionSlug(product.slug)} />)}

        {/* Leather description - material & craft Q&A */}
        {(product.category === "wallets" || product.category === "cardholders" || product.category === "bags") && !product.hideLeatherDescription && (
          <LeatherDescription videoSrc={CARDHOLDER_VIDEOS[product.slug]} crocodileSpecies={product.crocodileSpecies} isBag={product.category === "bags"} image={product.descriptionImage} />
        )}

        {/* Reviews: hidden while the product has none (no "Все още няма ревюта" block); it shows again by itself with the first
            review. Cardholders / wallets show their category pool, so they always have some. Same rule as the Romanian page. */}
        {/* Women's collection: the section follows the piece step 1 shows (the page's own from the server, another one read from
            GET /api/product-review), and its form sends the review to that piece */}
        {inCollection && <CollectionReviews pageSlug={slug} initial={approved ? { reviews: approved.reviews, count: approved.count, avg: approved.avg } : null} pool={womensPoolForReviews} />}
        {!inCollection && approved && (
          <div className="mt-20">
            <UserReviews productSlug={slug} reviews={approved.reviews} count={approved.count} avg={approved.avg} />
          </div>
        )}
        {!inCollection && !approved && (reviews.length > 0 || (reviewPool && reviewPool.reviews.length > 0)) && (
          <div className="mt-20">
            <ProductReviews reviews={reviews} productSlug={slug} pool={reviewPool} />
          </div>
        )}

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-20">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="section-tag mb-2">{inCollection ? "Дамска колекция" : "Може да харесате и"}</p>
                <h2 className="font-serif text-display-sm text-charcoal">{inCollection ? "Комбинирайте с 1+1" : "Подобни продукти"}</h2>
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
      </Shell>
    </div>
  );
}
