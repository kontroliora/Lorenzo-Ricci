"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReview, editReviewText, moderateReview, setPartnership } from "./actions";

export interface AdminReview {
  id: string;
  productSlug: string;
  productName: string;
  name: string;
  rating: number;
  body: string;
  images: string[];
  email: string | null;
  status: "pending" | "approved" | "rejected";
  isPartnership: boolean;
  createdAt: string;
  moderatedAt: string | null;
  moderatedBy: string | null;
  moderatedRole: string | null;
}

const STATUS_NOTE = { approved: "Одобрено", rejected: "Отхвърлено", pending: "" } as const;

function Card({ r }: { r: AdminReview }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.body);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; warning?: string }>, after?: () => void) =>
    start(async () => {
      setMsg("");
      const res = await fn();
      if (!res.ok) { setMsg(res.error ?? "Грешка"); return; }
      if (res.warning) setMsg(res.warning);
      after?.();
      router.refresh();
    });

  const btn = "px-4 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase border disabled:opacity-40";
  return (
    <article className="border border-white/10 p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <Link href={`/products/${r.productSlug}`} target="_blank" className="font-semibold underline decoration-white/30 hover:decoration-white">{r.productName}</Link>
          <span className="text-white/40"> · {r.createdAt}</span>
        </p>
        <p className="text-lg tracking-wider text-amber-300" aria-label={`${r.rating} от 5`}>{"★".repeat(r.rating)}<span className="text-white/20">{"★".repeat(5 - r.rating)}</span></p>
      </div>

      <p className="text-sm"><span className="font-semibold">{r.name}</span>{r.email ? <span className="text-white/50"> · {r.email}</span> : <span className="text-white/30"> · без имейл</span>}</p>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full bg-white/5 border border-white/20 p-3 text-sm" />
          <div className="flex gap-2">
            <button disabled={busy} className={`${btn} bg-white text-[#0a0e1f] border-white`} onClick={() => run(() => editReviewText(r.id, text), () => setEditing(false))}>Запази текста</button>
            <button disabled={busy} className={`${btn} border-white/20 text-white/70`} onClick={() => { setEditing(false); setText(r.body); setMsg(""); }}>Отказ</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/85 whitespace-pre-line break-words">{r.body}</p>
      )}

      {r.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.images.map((src, i) => (
            <a key={src} href={src} target="_blank" rel="noreferrer" className="block w-24 h-24 bg-white/5 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Снимка ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {r.status !== "pending" && r.moderatedAt && (
        <p className="text-xs text-white/45">{STATUS_NOTE[r.status]} от {r.moderatedBy ?? "?"}{r.moderatedRole ? ` (${r.moderatedRole})` : ""} · {r.moderatedAt}</p>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
        <input type="checkbox" checked={r.isPartnership} disabled={busy} onChange={(e) => run(() => setPartnership(r.id, e.target.checked))} className="w-4 h-4" />
        Партньорско ревю <span className="text-white/40 text-xs">(на сайта: етикет „Партньорство“)</span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        {r.status !== "approved" && <button disabled={busy} className={`${btn} bg-green-600 border-green-600 text-white`} onClick={() => run(() => moderateReview(r.id, "approved"))}>Одобри</button>}
        {r.status !== "rejected" && <button disabled={busy} className={`${btn} border-red-400/60 text-red-300`} onClick={() => run(() => moderateReview(r.id, "rejected"))}>Отхвърли</button>}
        {!editing && <button disabled={busy} className={`${btn} border-white/25 text-white/80`} onClick={() => setEditing(true)}>Редактирай текста</button>}
        <button disabled={busy} className={`${btn} border-white/15 text-white/50 sm:ml-auto`}
          onClick={() => { if (window.confirm(`Да изтрия ревюто на „${r.name}“ завинаги (със снимките)? Това не може да се върне.`)) run(() => deleteReview(r.id)); }}>Изтрий</button>
      </div>
      {msg && <p className="text-xs text-amber-300" role="alert">{msg}</p>}
    </article>
  );
}

export function ReviewsBoard({ reviews, tab }: { reviews: AdminReview[]; tab: AdminReview["status"] }) {
  if (!reviews.length) {
    return <p className="text-sm text-white/40 border border-white/10 p-5">{tab === "pending" ? "Няма чакащи ревюта." : tab === "approved" ? "Няма одобрени ревюта." : "Няма отхвърлени ревюта."}</p>;
  }
  return <div className="flex flex-col gap-4">{reviews.map((r) => <Card key={r.id} r={r} />)}</div>;
}
