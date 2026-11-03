import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { email, lang } = await req.json() as { email?: string; lang?: string };
    const clean = (email ?? "").trim().toLowerCase();
    // The language of the site the person subscribed on (/ro sends "ro"): stored so every e-mail goes in their language.
    const siteLang = lang === "ro" ? "ro" : "bg";

    if (!clean || !clean.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // One row per email, atomically, via a SECURITY DEFINER function (the anon key has NO direct access to the table).
    // The function still stores a code (the column is NOT NULL), but lib/promo.ts refuses every code issued after
    // PROMO_ISSUED_UNTIL, and the code is never shown or e-mailed.
    const { data, error } = await supabase
      .rpc("newsletter_get_or_create", { p_email: clean })
      .single();
    const row = data as
      | { out_promo_code: string; out_code_used: boolean; out_subscribed_at: string; out_is_new: boolean }
      | null;
    if (error || !row) throw error ?? new Error("newsletter_get_or_create returned no row");

    if (row.out_is_new) console.log("[Newsletter] New subscriber");

    // New subscribers start as 'bg' (column default); a signup on /ro marks them 'ro' (also an existing one: the latest choice wins).
    // Needs supabase/lang_columns.sql; until it has run the update fails harmlessly and the subscriber stays as before.
    if (siteLang === "ro") {
      const { error: langErr } = await supabaseAdmin().from("newsletter_subscribers").update({ lang: "ro" }).eq("email", clean);
      if (langErr) console.warn("[Newsletter] could not store lang (run supabase/lang_columns.sql):", langErr.message);
    }

    // No code goes back to the browser: the signup is a plain newsletter subscription (the -10% offer ended 03.11.2026, lib/promo.ts).
    return NextResponse.json({ success: true, alreadySubscribed: !row.out_is_new });
  } catch (err) {
    console.error("[Newsletter] Error:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
