"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import styles from "./site-motion.module.css";

gsap.registerPlugin(ScrollTrigger);

export function SiteMotion() {
  const pathname = usePathname();
  const progress = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const main = document.querySelector<HTMLElement>("main");
        if (main) {
          gsap.fromTo(main, { autoAlpha: 0.72, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.52, ease: "power2.out" });
        }

        if (progress.current) {
          gsap.fromTo(progress.current, { scaleX: 0 }, {
            scaleX: 1,
            ease: "none",
            scrollTrigger: { start: 0, end: "max", scrub: 0.18 },
          });
        }

        const reveals = gsap.utils.toArray<HTMLElement>("[data-motion-reveal]");
        reveals.forEach((element) => {
          const chart = element.dataset.motionReveal === "chart";
          gsap.fromTo(element, {
            autoAlpha: 0,
            y: chart ? 68 : 38,
            scale: chart ? 0.94 : 0.985,
            transformOrigin: "50% 50%",
            force3D: true,
          }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: chart ? 0.9 : 0.68,
            ease: "power3.out",
            force3D: true,
            scrollTrigger: {
              trigger: element,
              start: "top 88%",
              once: true,
            },
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-motion-parallax]").forEach((element) => {
          gsap.fromTo(element, { yPercent: -4 }, {
            yPercent: 12,
            ease: "none",
            scrollTrigger: {
              trigger: element.parentElement ?? element,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.45,
            },
          });
        });
      });
    });

    const refresh = window.requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      window.cancelAnimationFrame(refresh);
      context.revert();
      media.revert();
    };
  }, [pathname]);

  useEffect(() => {
    if (!cursor.current || window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
    const cursorElement = cursor.current;
    const moveX = gsap.quickTo(cursorElement, "x", { duration: 0.18, ease: "power3.out" });
    const moveY = gsap.quickTo(cursorElement, "y", { duration: 0.18, ease: "power3.out" });

    function handlePointerMove(event: PointerEvent) {
      moveX(event.clientX);
      moveY(event.clientY);
      cursorElement.dataset.active = event.target instanceof Element && Boolean(event.target.closest("a, button, summary, [role='tab']")) ? "true" : "false";

      const magnetic = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-magnetic]") : null;
      if (!magnetic) return;
      const bounds = magnetic.getBoundingClientRect();
      gsap.to(magnetic, {
        x: (event.clientX - (bounds.left + bounds.width / 2)) * 0.13,
        y: (event.clientY - (bounds.top + bounds.height / 2)) * 0.13,
        duration: 0.25,
        ease: "power2.out",
      });
    }

    function handlePointerOut(event: PointerEvent) {
      const magnetic = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-magnetic]") : null;
      if (!magnetic || event.relatedTarget instanceof Node && magnetic.contains(event.relatedTarget)) return;
      gsap.to(magnetic, { x: 0, y: 0, duration: 0.45, ease: "elastic.out(1, 0.45)" });
    }

    function handlePointerLeave() {
      cursorElement.dataset.visible = "false";
    }

    function handlePointerEnter() {
      cursorElement.dataset.visible = "true";
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerout", handlePointerOut, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    document.documentElement.addEventListener("pointerenter", handlePointerEnter);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", handlePointerOut);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
      document.documentElement.removeEventListener("pointerenter", handlePointerEnter);
    };
  }, []);

  return (
    <>
      <div ref={progress} className={styles.progress} data-site-progress aria-hidden="true" />
      <div ref={cursor} className={styles.cursor} data-site-cursor data-visible="false" aria-hidden="true" />
    </>
  );
}
