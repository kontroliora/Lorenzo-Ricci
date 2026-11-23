"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  REVIEW_IMAGE_TYPES, REVIEW_LIMITS, THANKS_TEXT, formatAvg, reviewsLabel, validateReviewInput,
  type PublicReview, type ReviewErrors, type UserReviewProductInfo,
} from "@/lib/user-reviews";

// "Ревюта" under a product of the Bulgarian shop (owner, 17.11.2026): the average, the count and the list of the APPROVED reviews, plus
// the "Напиши ревю" form. With no approved review there is no section, only the button. Every review the form sends waits for the
// owner in the panel (supabase/reviews.sql, /api/product-review). The page gives this component approved reviews only.

interface Props {
  productSlug: string;
  reviews: PublicReview[];
  count: number;
  avg: number;
  productInfo?: Record<string, UserReviewProductInfo>;
}

const FIRST_SHOWN = 50;
const MORE_STEP = 20;
const MAX_REQUEST_BYTES = 4_000_000; // hosting limit for a request body is 4.5 MB: photos are shrunk in the browser first

function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex gap-0.5 text-xs ${className}`} role="img" aria-label={`Оценка ${formatAvg(value)} от 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden className={i <= full ? "text-navy" : "text-ink-faint"}>★</span>)}
    </span>
  );
}

/** Scales a photo down to 1600 px and re-saves it as JPEG so three photos always fit one request (the server re-checks and re-encodes). */
async function shrinkImage(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function ReviewForm({ productSlug, productOptions, onClose }: { productSlug: string; productOptions?: { slug: string; shortName: string }[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [files, setFiles] = useState<File[]>([]);
  // Pooled mode (all women's-collection pieces share this form): which piece the review is actually about, so "за <модел>"
  // under the published review is correct even when it's not the piece whose page the form was opened from.
  const [forSlug, setForSlug] = useState(productSlug);
  const [errors, setErrors] = useState<ReviewErrors & { images?: string; form?: string }>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const clear = (k: keyof ReviewErrors) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  const previews = useRef(new Map<File, string>());
  const previewOf = (f: File) => { let u = previews.current.get(f); if (!u) { u = URL.createObjectURL(f); previews.current.set(f, u); } return u; };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    let err = "";
    for (const f of Array.from(list)) {
      if (!(REVIEW_IMAGE_TYPES as readonly string[]).includes(f.type)) { err = "Снимките трябва да са JPG, PNG или WEBP."; continue; }
      if (f.size > REVIEW_LIMITS.maxImageBytes) { err = "Всяка снимка може да е до 5MB."; continue; }
      if (next.length >= REVIEW_LIMITS.maxImages) { err = `Можете да добавите до ${REVIEW_LIMITS.maxImages} снимки.`; break; }
      next.push(f);
    }
    setFiles(next);
    setErrors((e) => ({ ...e, images: err || undefined }));
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const checked = validateReviewInput({ name, rating, body, email });
    if (!checked.ok) { setErrors(checked.errors); return; }
    setErrors({});
    setSending(true);
    try {
      const small = await Promise.all(files.map(shrinkImage));
      if (small.reduce((s, f) => s + f.size, 0) > MAX_REQUEST_BYTES) {
        setErrors({ images: "Снимките са твърде големи. Добавете по-малко или по-леки снимки." });
        return;
      }
      const fd = new FormData();
      fd.set("productSlug", productOptions ? forSlug : productSlug);
      fd.set("name", checked.value.name);
      fd.set("rating", String(checked.value.rating));
      fd.set("body", checked.value.body);
      if (checked.value.email) fd.set("email", checked.value.email);
      fd.set("website", website);
      small.forEach((f) => fd.append("images", f));
      const res = await fetch("/api/product-review", { method: "POST", body: fd });
      const data: { ok?: boolean; error?: string; errors?: ReviewErrors } | null = await res.json().catch(() => null);
      if (res.ok && data?.ok) { setDone(true); return; }
      setErrors({ ...(data?.errors ?? {}), form: data?.error ?? "Нещо се обърка. Опитайте отново." });
    } catch {
      setErrors({ form: "Няма връзка. Опитайте отново." });
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="border border-border bg-ivory-warm p-6 sm:p-8 text-center" role="status">
        <p className="font-serif text-xl text-charcoal">{THANKS_TEXT}</p>
        <button type="button" onClick={onClose} className="mt-5 font-sans text-xs text-ink-muted hover:text-charcoal transition-colors underline">Затвори</button>
      </div>
    );
  }

  const label = "font-sans text-[10px] tracking-widest uppercase text-ink-faint block mb-1.5";
  const input = "w-full border-b border-border bg-transparent font-sans text-base text-charcoal py-2 placeholder:text-ink-faint focus:outline-none focus:border-navy transition-colors";
  const err = (m?: string) => (m ? <p className="font-sans text-xs text-red-700 mt-1.5" role="alert">{m}</p> : null);
  const bodyLen = [...body].length;

  return (
    <form onSubmit={submit} noValidate className="border border-border bg-ivory-warm p-6 sm:p-8 flex flex-col gap-5">
      <h3 className="font-serif text-xl text-charcoal">Напиши ревю</h3>

      {productOptions && productOptions.length > 1 && (
        <div>
          <label className={label} htmlFor="rv-product">За кой продукт е ревюто? *</label>
          <select id="rv-product" value={forSlug} onChange={(e) => setForSlug(e.target.value)} className={`${input} appearance-none`}>
            {productOptions.map((p) => <option key={p.slug} value={p.slug}>{p.shortName}</option>)}
          </select>
        </div>
      )}

      <div>
        <p className={label} id="rv-rating-label">Оценка *</p>
        <div className="flex gap-1" role="radiogroup" aria-labelledby="rv-rating-label">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s} type="button" role="radio" aria-checked={rating === s} aria-label={`${s} от 5`}
              onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => { setRating(s); clear("rating"); }}
              className={`text-3xl leading-none px-0.5 py-1 transition-colors ${s <= (hover || rating) ? "text-navy" : "text-ink-faint"}`}
            >★</button>
          ))}
        </div>
        {err(errors.rating)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="rv-name">Име *</label>
          <input id="rv-name" type="text" value={name} maxLength={REVIEW_LIMITS.nameMax} autoComplete="given-name" onChange={(e) => { setName(e.target.value); clear("name"); }} placeholder="Мария И." className={input} />
          {err(errors.name)}
        </div>
        <div>
          <label className={label} htmlFor="rv-email">Имейл (по желание, не се показва)</label>
          <input id="rv-email" type="email" value={email} maxLength={REVIEW_LIMITS.emailMax} autoComplete="email" onChange={(e) => { setEmail(e.target.value); clear("email"); }} className={input} />
          {err(errors.email)}
        </div>
      </div>

      <div>
        <label className={label} htmlFor="rv-body">Ревю *</label>
        <textarea id="rv-body" rows={5} value={body} maxLength={REVIEW_LIMITS.bodyMax + 200} onChange={(e) => { setBody(e.target.value); clear("body"); }}
          placeholder="Споделете как ви стои, как се носи, какво ви хареса…"
          className="w-full border border-border bg-white font-sans text-base text-charcoal p-3 placeholder:text-ink-faint focus:outline-none focus:border-navy transition-colors resize-y" />
        <div className="flex justify-between gap-3">
          <div>{err(errors.body)}</div>
          <p className={`font-sans text-[11px] mt-1.5 ${bodyLen > REVIEW_LIMITS.bodyMax ? "text-red-700" : "text-ink-faint"}`}>{bodyLen} / {REVIEW_LIMITS.bodyMax}</p>
        </div>
      </div>

      <div>
        <p className={label}>Снимки (по желание, до {REVIEW_LIMITS.maxImages}, JPG / PNG / WEBP, до 5MB)</p>
        <div className="flex flex-wrap gap-3 items-center">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative w-20 h-20 bg-white border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewOf(f)} alt="" className="w-full h-full object-cover" />
              <button type="button" aria-label="Премахни снимката" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-charcoal text-white text-xs leading-none">×</button>
            </div>
          ))}
          {files.length < REVIEW_LIMITS.maxImages && (
            <button type="button" onClick={() => fileInput.current?.click()} className="w-20 h-20 border border-dashed border-border-strong text-ink-muted hover:text-navy hover:border-navy transition-colors text-2xl" aria-label="Добави снимка">+</button>
          )}
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </div>
        {err(errors.images)}
      </div>

      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label>Уебсайт<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {errors.form && <p className="font-sans text-sm text-red-700" role="alert">{errors.form}</p>}

      <div className="flex items-center gap-4">
        <button type="submit" disabled={sending} className="btn-primary disabled:opacity-60">{sending ? "Изпращане…" : "Изпрати ревюто"}</button>
        <button type="button" onClick={onClose} className="font-sans text-xs text-ink-muted hover:text-charcoal transition-colors">Отказ</button>
      </div>
      <p className="font-sans text-[11px] text-ink-faint -mt-2">Ревюто се публикува след преглед.</p>
    </form>
  );
}

export function UserReviews({ productSlug, reviews, count, avg, productInfo }: Props) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(FIRST_SHOWN);
  const [zoom, setZoom] = useState<string | null>(null);
  const shown = reviews.slice(0, visibleCount);
  const writeBtn = !open && (
    <button type="button" onClick={() => setOpen(true)} className="btn-outline text-xs">Напиши ревю</button>
  );
  // Pooled mode only (productInfo is set): let the customer say which of the pieces the review is actually about.
  const productOptions = productInfo && Object.entries(productInfo).map(([slug, info]) => ({ slug, shortName: info.shortName }));

  // No approved review: no section, only the button (and the form when it is opened).
  if (count === 0) {
    return (
      <section id="reviews" className="flex flex-col items-center gap-6">
        {writeBtn}
        {open && <div className="w-full max-w-2xl"><ReviewForm productSlug={productSlug} productOptions={productOptions} onClose={() => setOpen(false)} /></div>}
      </section>
    );
  }

  return (
    <section id="reviews" className="py-16 border-t border-border">
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <h2 className="font-serif text-2xl text-charcoal mb-1">Ревюта</h2>
          <div className="flex items-center gap-3">
            <Stars value={avg} />
            <span className="font-sans text-xs text-ink-muted">{formatAvg(avg)} · {count} {reviewsLabel(count)}</span>
          </div>
        </div>
        {writeBtn}
      </div>

      {open && <div className="mb-12"><ReviewForm productSlug={productSlug} productOptions={productOptions} onClose={() => setOpen(false)} /></div>}

      <div className="columns-1 sm:columns-2 gap-5">
        {shown.map((r) => (
          <article key={r.id} className="review-card break-inside-avoid mb-5 inline-block w-full flex flex-col gap-3 p-5">
            <Stars value={r.rating} />
            {r.body && <p className="font-sans text-sm font-light text-ink-soft leading-relaxed whitespace-pre-line break-words">{r.body}</p>}
            {r.images.length > 0 && (
              <div className="flex gap-2">
                {r.images.map((src, i) => (
                  <button key={src} type="button" onClick={() => setZoom(src)} aria-label={`Увеличи снимка ${i + 1}`} className="relative w-20 h-20 sm:w-24 sm:h-24 bg-ivory-warm overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Снимка ${i + 1} от ${r.name}`} loading="lazy" decoding="async" width={96} height={96} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-xs font-medium text-charcoal">{r.name}</p>
                {r.isPartnership && <span className="font-sans text-[10px] tracking-wide text-navy border border-navy/40 px-1.5 py-0.5">Партньорство</span>}
              </div>
              <div className={`flex items-center gap-3 mt-1 ${productInfo && r.productSlug && productInfo[r.productSlug] ? "justify-between" : "justify-end"}`}>
                {productInfo && r.productSlug && productInfo[r.productSlug] && (() => {
                  const info = productInfo[r.productSlug!]!;
                  return (
                    <Link href={info.href} className="flex items-center gap-1.5 group min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={info.coverSrc} alt={info.shortName} width={16} height={16} className="w-4 h-4 object-cover rounded-sm flex-shrink-0" />
                      <span className="font-sans text-[10px] text-ink-muted group-hover:text-navy transition-colors truncate">за {info.shortName}</span>
                    </Link>
                  );
                })()}
              </div>
            </div>
          </article>
        ))}
      </div>

      {visibleCount < reviews.length && (
        <div className="text-center mt-2">
          <button type="button" onClick={() => setVisibleCount((c) => c + MORE_STEP)} className="btn-outline text-xs">Покажи още</button>
        </div>
      )}

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Снимка от ревю" onClick={() => setZoom(null)} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-w-full max-h-full object-contain" />
          <button type="button" aria-label="Затвори" onClick={() => setZoom(null)} className="absolute top-4 right-4 w-11 h-11 text-white text-3xl leading-none">×</button>
        </div>
      )}
    </section>
  );
}
