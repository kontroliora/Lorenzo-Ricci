"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const PIXEL_ID = "661480326560209";

// Inline, runs during HTML parse (before hydration):
// 1. installs the standard fbq stub, so every fbq() call made before the script
//    arrives (init, any track from lib/fbq.ts) is queued, not lost;
// 2. loads fbevents.js only after the page's LCP has painted (LCP entry seen →
//    window load → requestIdleCallback, 3 s cap), or on the first user
//    interaction — whichever comes first — so the ~100 KB script never competes
//    with the LCP image on 4G. A 6 s fallback covers browsers without LCP entries;
// 3. HUMAN GATE: PageView (and ViewContent, via window.lrWhenHuman) is held back until a
//    person shows up. Meta's ad-review scrapers and click farms open the landing page
//    for 1-2 s, never touch it and leave; with PageView firing on load Meta counts them as
//    real visits and optimises toward them. A person scrolls past 80 px, clicks, taps,
//    types, wheels, moves the mouse (> 3 moves) or stays on the focused tab for 6 s.
//    It is a filter, not a wall: a bot that simulates scrolling gets through.
//    autoConfig is off so Meta's automatic events can't fire before the check.
//    AddToCart / InitiateCheckout / Purchase are not gated (they need a real action).
// Production hosts only: on localhost / previews the pixel never loads.
const INLINE = `
(function(){
  if(!/(^|\\.)lorenzo-ricci\\.com$/.test(location.hostname))return;
  var f=window;if(f.fbq)return;
  var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
  fbq('set','autoConfig',false,'${PIXEL_ID}');
  fbq('init','${PIXEL_ID}');
  var done=false;
  function load(){
    if(done)return;done=true;
    var t=document.createElement('script');t.async=true;
    t.src='https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(t);
  }
  var human=false,held=[],moves=0,timer=null;
  var HEV=['scroll','wheel','keydown','click','touchstart','mousemove'],HOPT={passive:true,capture:true};
  function release(){
    if(human)return;human=true;
    HEV.forEach(function(e){removeEventListener(e,check,HOPT)});
    removeEventListener('focus',onFocus);
    if(timer)clearTimeout(timer);
    fbq('track','PageView');
    var h=held;held=[];h.forEach(function(fn){try{fn()}catch(e){}});
    load();
  }
  function check(e){
    if(human)return;
    if(e.type==='scroll'){
      var y=window.pageYOffset||document.documentElement.scrollTop||0,t=e.target;
      if(y>80||(t&&t.scrollTop>80))release();
    }else if(e.type==='mousemove'){if(++moves>3)release()}
    else release();
  }
  function startTimer(){if(timer)clearTimeout(timer);timer=setTimeout(function(){if(!human&&document.hasFocus&&document.hasFocus())release()},6000)}
  function onFocus(){if(!human)startTimer()}
  HEV.forEach(function(e){addEventListener(e,check,HOPT)});
  addEventListener('focus',onFocus);startTimer();
  f.lrWhenHuman=function(fn){human?fn():held.push(fn)};
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
    // Skip first render — the inline gate sends the PageView of the initial load once a person shows up
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    // Fire PageView on every SPA navigation (a navigation is a person acting; queued if the script isn't in yet)
    if (typeof window !== "undefined" && window.fbq) {
      const fire = () => window.fbq("track", "PageView");
      if (window.lrWhenHuman) window.lrWhenHuman(fire);
      else fire();
    }
  }, [pathname]);

  return <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: INLINE }} />;
}
