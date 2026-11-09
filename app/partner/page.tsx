import { partnerOrLogin } from "./session";
import { PartnerHeader } from "./PartnerHeader";
import { PartnerOrders } from "./PartnerOrders";

export const dynamic = "force-dynamic";

export default async function PartnerPage() {
  await partnerOrLogin();
  return (<><PartnerHeader active="orders" /><PartnerOrders /></>);
}
