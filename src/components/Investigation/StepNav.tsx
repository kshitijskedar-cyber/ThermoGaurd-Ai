import { useEffect, useState } from "react";

export const STEPS = [
  { id: "sec-assessment", label: "Assessment" }, { id: "sec-classification", label: "Classification" }, { id: "sec-risk", label: "Risk Score" },
  { id: "sec-why", label: "Why Flagged" }, { id: "sec-factors", label: "Factors" }, { id: "sec-persistence", label: "Persistence" },
  { id: "sec-context", label: "Facility Context" }, { id: "sec-report", label: "Report" },
];

/** Guided-flow rail: jumps between sections and highlights the one in view. */
export default function StepNav() {
  const [active, setActive] = useState(STEPS[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => { const v = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    STEPS.forEach((s) => { const n = document.getElementById(s.id); if (n) io.observe(n); });
    return () => io.disconnect();
  }, []);
  const go = (id: string) => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <nav className="step-nav" aria-label="Investigation flow">
      {STEPS.map((s, i) => (
        <button key={s.id} className={active === s.id ? "active" : ""} aria-current={active === s.id ? "step" : undefined} onClick={() => go(s.id)}>
          <span className="step-num">{i + 1}</span>{s.label}
        </button>
      ))}
    </nav>
  );
}
