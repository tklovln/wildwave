"use client";

import { useEffect, useRef, useState } from "react";

// 進場觀測：元素進入 viewport 時回傳 inView=true（poetic.com 的滾動淡入手法）。
export function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [options.threshold, options.rootMargin]);

  return [ref, inView];
}

// 進場包裝：進入畫面才觸發淡入 + 上移，支援 stagger 延遲。
export function Reveal({ children, delay = 0, as = "div", className = "", ...rest }) {
  const [ref, inView] = useInView();
  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "is-in" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 數字補間：值變動時以 rAF 平滑過渡（stats count-up + 即時參數的柔性跳動）。
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 700,
  startOnView = false,
  format,
  className,
}) {
  const [display, setDisplay] = useState(startOnView ? 0 : Number(value) || 0);
  const fromRef = useRef(startOnView ? 0 : Number(value) || 0);
  const rafRef = useRef(0);
  const [ref, inView] = useInView({ threshold: 0.3 });
  const armed = !startOnView || inView;

  useEffect(() => {
    const target = Number(value);
    if (!Number.isFinite(target)) return;
    if (!armed) return;
    if (prefersReduced()) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const cur = from + (target - from) * eased;
      setDisplay(cur);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, armed]);

  const out = format ? format(display) : display.toFixed(decimals);
  return (
    <span ref={ref} className={className}>
      {out}
    </span>
  );
}
