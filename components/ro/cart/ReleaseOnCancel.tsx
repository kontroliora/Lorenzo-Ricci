"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { releasePendingOrder } from "@/lib/release-pending-order";

// Renders nothing: when the customer lands here without having paid, the reserved stock is released at once.
export function ReleaseOnCancel() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const ct = params.get("ct");
  useEffect(() => { releasePendingOrder(ref, ct); }, [ref, ct]);
  return null;
}
