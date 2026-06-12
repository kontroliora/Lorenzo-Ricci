"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/admin/inventory");
      router.refresh();
    } else {
      setError("Грешна парола");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p
            className="text-white tracking-widest uppercase"
            style={{ fontFamily: "Georgia, serif", fontSize: "24px" }}
          >
            Lorenzo Ricci
          </p>
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/30 mt-2 font-sans">
            Admin Panel
          </p>
          <div className="w-10 h-px bg-white/15 mx-auto mt-4" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              type="password"
              placeholder="Парола"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/15 px-4 py-3.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/40 transition-colors font-sans"
              autoFocus
              autoComplete="current-password"
            />
            {error && (
              <p className="text-red-400 text-xs mt-2 font-sans">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="bg-white text-[#0a0e1f] font-sans text-xs font-semibold tracking-[0.18em] uppercase py-3.5 hover:bg-white/90 transition-colors disabled:opacity-40"
          >
            {loading ? "Влизане..." : "Вход"}
          </button>
        </form>
      </div>
    </div>
  );
}
