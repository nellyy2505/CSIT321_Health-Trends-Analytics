import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/20/solid";

function SnapshotPreview() {
  const kpis = [
    { label: "Pressure injuries", v: "2.1%", d: "-0.4" },
    { label: "Falls w/ harm", v: "1.4%", d: "-0.2" },
    { label: "Polypharmacy", v: "38%", d: "+1.1" },
  ];
  return (
    <div className="relative">
      <div
        className="cd-surface p-5"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <div
              className="text-[11px] uppercase tracking-wider mb-1"
              style={{ color: "var(--ink-500)", letterSpacing: "0.05em" }}
            >
              Facility snapshot
            </div>
            <div className="text-[15px] font-semibold" style={{ color: "var(--ink-900)" }}>
              Bayside Aged Care, Q2
            </div>
          </div>
          <div className="cd-chip">
            <span className="dot" /> Submitted
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {kpis.map((k, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div className="text-[10px]" style={{ color: "var(--ink-500)" }}>{k.label}</div>
              <div
                className="mt-0.5"
                style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-900)" }}
              >
                {k.v}
              </div>
              <div
                className="text-[10px]"
                style={{ color: k.d.startsWith("-") ? "var(--sage-ink)" : "var(--clay-ink)" }}
              >
                {k.d} vs prev
              </div>
            </div>
          ))}
        </div>
        <div
          className="relative"
          style={{
            height: 140,
            background: "var(--bg-paper)",
            borderRadius: 10,
            border: "1px solid var(--line-soft)",
            padding: 14,
          }}
        >
          <svg viewBox="0 0 300 110" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="heroArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.06 150 / 0.25)" />
                <stop offset="100%" stopColor="oklch(0.72 0.06 150 / 0)" />
              </linearGradient>
            </defs>
            {[20, 40, 60, 80].map((y) => (
              <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="var(--line-soft)" strokeDasharray="2 3" />
            ))}
            <path
              d="M0,80 C30,70 50,55 80,60 S140,35 170,40 220,20 260,25 295,18 300,18"
              fill="none"
              stroke="oklch(0.55 0.08 150)"
              strokeWidth="1.8"
            />
            <path
              d="M0,80 C30,70 50,55 80,60 S140,35 170,40 220,20 260,25 295,18 300,18 L300,110 L0,110 Z"
              fill="url(#heroArea)"
            />
          </svg>
        </div>
      </div>
      {/* Floating AI-assisted tag */}
      <div
        className="absolute -top-3 -right-3 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium"
        style={{ background: "var(--ink-900)", color: "var(--bg-paper)" }}
      >
        <SparklesIcon className="w-3.5 h-3.5" /> AI-assisted
      </div>
    </div>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("token"));

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
    const interval = setInterval(() => setIsLoggedIn(!!localStorage.getItem("token")), 300);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--bg-cream)", paddingTop: 64 }}
    >
      <div className="max-w-[1280px] mx-auto px-8 pt-16 md:pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="cd-chip mb-5">
              <span className="dot" /> Australian Digital Health, FHIR aligned
            </div>
            <h1
              className="mb-6"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(40px, 6vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                fontWeight: 400,
                color: "var(--ink-900)",
              }}
            >
              Quiet clarity for{" "}
              <em style={{ fontStyle: "italic", color: "var(--sage-ink)" }}>
                aged‑care
              </em>{" "}
              quality data.
            </h1>
            <p
              className="mb-8 max-w-[520px]"
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                color: "var(--ink-700)",
              }}
            >
              CareData Portal turns messy facility records into government-standard
              indicators, upload once, see insights, file with confidence.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <button
                type="button"
                onClick={() => navigate(isLoggedIn ? "/dashboard" : "/login")}
                className="cd-btn cd-btn-primary"
              >
                {isLoggedIn ? "Open your dashboard" : "Start a facility upload"}
                <ArrowRightIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate(isLoggedIn ? "/reports" : "/login")}
                className="cd-btn cd-btn-ghost"
              >
                View the sample report
              </button>
            </div>
            <div
              className="flex flex-wrap gap-6 items-center"
              style={{
                color: "var(--ink-500)",
                fontSize: 12,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <span>14 QI domains</span>
              <span style={{ color: "var(--line-strong)" }}>·</span>
              <span>FHIR R4</span>
              <span style={{ color: "var(--line-strong)" }}>·</span>
              <span>Privacy Act 1988</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
          >
            <SnapshotPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
