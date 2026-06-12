import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password: string };
  const adminPwd = process.env.ADMIN_PASSWORD;

  if (!adminPwd || password !== adminPwd) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = createHash("sha256").update(adminPwd).digest("hex");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("lr-admin-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
