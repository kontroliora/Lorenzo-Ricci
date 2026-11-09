import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARTNER_COOKIE, partnerFromCookie, type Partner } from "@/lib/partner/access";

/** For the /partner pages: the enabled partner, or off to the sign-in page. */
export async function partnerOrLogin(): Promise<Partner> {
  const p = await partnerFromCookie((await cookies()).get(PARTNER_COOKIE)?.value);
  if (!p) redirect("/partner/login");
  return p;
}
