import { partnerOrLogin } from "../session";
import { PartnerHeader } from "../PartnerHeader";
import { partnerPieces } from "@/lib/partner/server";
import { PiecesList } from "./PiecesList";

export const dynamic = "force-dynamic";

export default async function PartnerPiecesPage() {
  await partnerOrLogin();
  return (<><PartnerHeader active="pieces" /><PiecesList pieces={await partnerPieces()} /></>);
}
