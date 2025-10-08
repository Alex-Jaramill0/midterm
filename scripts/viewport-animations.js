//
//
//
//
// Not going to lie, I used ai to create this file since I don't know js.
// I would've just used css animations, but some of the properties weren't working
// so I had to resort to this workaround. Sorry, I'll come back to learn js later.
//
//
//
//
// viewport-animations.js
// Scroll-linked animation controller that approximates Animate.css animations
// using inline transforms. Triggers when an item's center enters the viewport
// (start when center at bottom of viewport) and finishes when the item's center
// reaches 50% of the viewport height. Animations repeat on re-entry. This file
// does not change HTML or CSS.

(function () {
  "use strict";

  // Respect prefers-reduced-motion
  const prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Mapping from Animate.css class suffix -> animation generator
  const animMap = {
    // (progress from 0 -> 1) -> return { transform, opacity, transformOrigin? }
    fadeInUpBig: (el, p) => {
      const y = (1 - p) * 200; // px
      return { transform: `translateY(${y}px)`, opacity: String(p) };
    },
    fadeInRightBig: (el, p) => {
      const x = (1 - p) * 200;
      return { transform: `translateX(${x}px)`, opacity: String(p) };
    },
    fadeInLeftBig: (el, p) => {
      const x = (p - 1) * 200;
      return { transform: `translateX(${x}px)`, opacity: String(p) };
    },
    rotateIn: (el, p) => {
      const r = (1 - p) * -200; // degrees
      const s = 0.8 + 0.2 * p;
      return { transform: `rotate(${r}deg) scale(${s})`, opacity: String(p) };
    },
    hinge: (el, p) => {
      // approximate hinge: rotate and fall down with translate
      const src = (el.getAttribute && el.getAttribute("src")) || "";
      const alt = (el.getAttribute && el.getAttribute("alt")) || "";
      const isSza =
        String(src).toLowerCase().includes("sza") ||
        String(alt).toLowerCase().includes("sza");
      const strength = isSza ? 0.35 : 1.0; // SZA gets a much softer hinge

      const baseR = p < 0.6 ? (p / 0.6) * 80 : 80 + ((p - 0.6) / 0.4) * 20; // 0->100deg
      const r = baseR * strength;
      const ty = p * 200 * strength;
      const origin = isSza ? "top center" : "top left";
      return {
        transform: `rotate(${r}deg) translateY(${ty}px)`,
        opacity: String(1 - Math.min(0.6, 1 - p)),
        transformOrigin: origin,
      };
    },
    zoomIn: (el, p) => {
      const s = 0.3 + 0.7 * p;
      return { transform: `scale(${s})`, opacity: String(p) };
    },
    flipInY: (el, p) => {
      const ry = (1 - p) * -90; // degrees
      const src = (el.getAttribute && el.getAttribute("src")) || "";
      const alt = (el.getAttribute && el.getAttribute("alt")) || "";
      const isLegal =
        String(src).toLowerCase().includes("legal") ||
        String(alt).toLowerCase().includes("legal");
      const opacity = isLegal ? "1" : String(p);
      return {
        transform: `rotateY(${ry}deg)`,
        opacity,
        transformStyle: "preserve-3d",
      };
    },
  };

  function findAnimationClass(el) {
    for (const cls of Array.from(el.classList || [])) {
      if (!cls.startsWith("animate__")) continue;
      if (cls === "animate__animated") continue;
      // cls is like 'animate__fadeInUpBig'
      const name = cls.replace("animate__", "");
      if (animMap[name]) return name;
    }
    return null;
  }

  function clamp(v, a = 0, b = 1) {
    return Math.max(a, Math.min(b, v));
  }

  // ease-out cubic for smoother feel
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function init() {
    // remove any pause guard added in HTML head (safe to do)
    try {
      document.documentElement.classList.remove("animate-paused");
    } catch (e) {}

    if (prefersReduced) {
      // Simply ensure elements are visible and leave them alone
      const all = document.querySelectorAll('[class*="animate__"]');
      all.forEach((el) => {
        el.style.visibility = "visible";
      });
      return;
    }

    // Collect elements: prefer elements that have animate__ classes, but if the
    // HTML was modified (classes removed) fall back to images inside the scroller
    let candidates = Array.from(
      document.querySelectorAll('[class*="animate__"]')
    );
    if (candidates.length === 0) {
      // fallback: pick images inside the scroller stage (matches your markup)
      candidates = Array.from(
        document.querySelectorAll(".scroller .item img, .scroller .item > *")
      );
    }

    // infer animation from class or from filename/alt if classes are absent
    function inferAnimFromSrc(el) {
      const src = (el.getAttribute && el.getAttribute("src")) || "";
      const alt = (el.getAttribute && el.getAttribute("alt")) || "";
      const key = (src + " " + alt).toLowerCase();

      const map = {
        graf1: "fadeInUpBig",
        lorde: "fadeInRightBig",
        the_marias: "fadeInLeftBig",
        graf2: "rotateIn",
        bloodorange: "fadeInLeftBig",
        graf3: "rotateIn",
        sza: "hinge",
        "bg.png": "zoomIn",
        room: "zoomIn",
        shelves: "zoomIn",
        "me.png": "flipInY",
        "vinyl-crate": "flipInY",
        legal: "flipInY",
      };

      for (const k in map) {
        if (key.includes(k)) return map[k];
      }
      return "zoomIn";
    }

    let items = candidates
      .map((el) => {
        const animClass = findAnimationClass(el);
        const anim = animClass || inferAnimFromSrc(el);
        return anim ? { el, anim } : null;
      })
      .filter(Boolean);

    // Remove first and second .item elements (index 0 and 1) so they have no animation
    const beforeCount = items.length;
    items = items.filter(({ el }) => {
      const itemParent = el.closest(".item");
      if (!itemParent) return true; // keep if structure unexpected
      const container = itemParent.parentElement; // typically .scroller
      if (!container) return true;
      const idx = Array.from(container.children).indexOf(itemParent);
      return idx > 1; // keep only items with index >= 2 (third item and later)
    });
    const skipped = beforeCount - items.length;
    if (skipped > 0)
      console.info(
        "[viewport-animations] skipped first two items from animation"
      );

    if (items.length === 0) return;
    console.info("[viewport-animations] found", items.length, "items");

    // Prepare elements: hide initially and set will-change
    items.forEach(({ el }) => {
      el.style.visibility = "hidden";
      el.style.willChange = "transform, opacity";
      // store the element's computed base transform so we can compose animation transforms
      try {
        const cs = window.getComputedStyle(el).transform;
        el.__baseTransform = cs && cs !== "none" ? cs : "";
      } catch (e) {
        el.__baseTransform = "";
      }
      // ensure transform origin reasonable for flips/hinge
      if (!el.style.transformOrigin) el.style.transformOrigin = "center center";
    });

    const viewport = () =>
      window.innerHeight || document.documentElement.clientHeight;

    function update() {
      const vh = viewport();

      items.forEach(({ el, anim }) => {
        const rect = el.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2; // relative to viewport top

        // progress goes 0 when center at bottom of viewport, 1 when center at 50% of viewport
        const pRaw = (vh - centerY) / (vh / 2);
        const p = clamp(pRaw, 0, 1);
        const eased = easeOutCubic(p);

        if (p <= 0) {
          // not yet entered
          el.style.visibility = "hidden";
          // clear transforms so layout remains predictable
          el.style.transform = "";
          el.style.opacity = "";
          return;
        }

        // visible and animate according to eased progress
        el.style.visibility = "visible";
        const fn = animMap[anim];
        if (fn) {
          const res = fn(el, eased) || {};
          // apply transform composition: baseTransform + animation transform
          const animT = res.transform || "";
          const baseT = el.__baseTransform || "";
          el.style.transform = (baseT ? baseT + " " : "") + animT;
          if (res.opacity !== undefined) el.style.opacity = res.opacity;
          if (res.transformOrigin)
            el.style.transformOrigin = res.transformOrigin;
          if (res.transformStyle) el.style.transformStyle = res.transformStyle;
        }
      });
    }

    // rAF loop with scroll/resize listeners
    let ticking = false;
    function schedule() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          update();
          ticking = false;
        });
      }
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // initial run
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
