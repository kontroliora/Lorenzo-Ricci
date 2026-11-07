"use client";
import { useSyncExternalStore } from "react";

// True on devices with a mouse (real hover). Product cards mount their hover photo only there: phones cannot hover, so the
// photo was downloaded on every phone (about 7 MB on /jewellery) and never shown. Server render and phones: false.
const QUERY = "(hover: hover) and (pointer: fine)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
export const useCanHover = (): boolean => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
