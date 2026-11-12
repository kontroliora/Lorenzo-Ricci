import { partnerOrLogin } from "../session";
import { PartnerHeader } from "../PartnerHeader";
import { PartnerCarts } from "./PartnerCarts";

export const dynamic = "force-dynamic";

export default async function PartnerCartsPage() {
  await partnerOrLogin();
  return (<><PartnerHeader active="carts" /><PartnerCarts /></>);
}
