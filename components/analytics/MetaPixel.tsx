"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const PIXEL_ID = "661480326560209";

// Inline, runs during HTML parse (before hydration):
// 1. installs the standard fbq stub, so every fbq() call made before the script
//    arrives (init, PageView, and any track from lib/fbq.ts) is queued, not lost;
// 2. loads fbevents.js only after the page's LCP has painted (LCP entry seen →
//    window load → requestIdleCallback, 3 s cap), or on the first user
//    interaction — whichever comes first — so the ~100 KB script never competes
//    with the LCP image on 4G. A 6 s fallback covers browsers without LCP entries.
// Production hosts only: on localhost / previews the pixel never loads.
const INLINE = `
(function(){
  if(!/(^|\\.)lorenzo-ricci\\.com$/.test(location.hostname))return;
  var f=window;if(f.fbq)return;
  var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
  fbq('init','${PIXEL_ID}');
  fbq('track','PageView');
  var done=false;
  function load(){
    if(done)return;done=true;
    var t=document.createElement('script');t.async=true;
    t.src='https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(t);
  }
  var evs=['pointerdown','touchstart','keydown','scroll'];
  function onInteract(){load();evs.forEach(function(e){removeEventListener(e,onInteract)})}
  evs.forEach(function(e){addEventListener(e,onInteract,{passive:true})});
  function idle(){var ric=window.requestIdleCallback;ric?ric(load,{timeout:3000}):setTimeout(load,3000)}
  function afterLoad(){document.readyState==='complete'?idle():addEventListener('load',idle)}
  try{
    var po=new PerformanceObserver(function(){po.disconnect();afterLoad()});
    po.observe({type:'largest-contentful-paint',buffered:true});
  }catch(e){afterLoad()}
  setTimeout(load,6000);
})();`;

export function MetaPixel() {
  const pathname = usePathname();
  const initialLoad = useRef(true);

  useEffect(() => {
    // Skip first render — the inline stub already queued PageView for the initial load
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    // Fire PageView on every SPA navigation (queued if the script isn't in yet)
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "PageView");
    }
  }, [pathname]);

  return <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: INLINE }} />;
}
