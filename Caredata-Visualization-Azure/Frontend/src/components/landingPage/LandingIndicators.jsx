import { motion } from "framer-motion";

const INDICATORS = [
  { num: "QI 01", name: "Pressure injuries" },
  { num: "QI 02", name: "Restrictive practices" },
  { num: "QI 03", name: "Unplanned weight loss" },
  { num: "QI 04", name: "Falls and major injury" },
  { num: "QI 05", name: "Medications" },
  { num: "QI 06", name: "Activities of daily living" },
  { num: "QI 07", name: "Incontinence care" },
  { num: "QI 08", name: "Hospitalisation" },
  { num: "QI 09", name: "Workforce" },
  { num: "QI 10", name: "Consumer experience" },
  { num: "QI 11", name: "Quality of life" },
  { num: "QI 12", name: "Enrolled nursing" },
  { num: "QI 13", name: "Allied health" },
  { num: "QI 14", name: "Lifestyle officer" },
];

export default function LandingIndicators() {
  return (
    <section
      className="px-8 py-16"
      style={{
        background: "var(--bg-paper)",
        borderTop: "1px solid var(--line-soft)",
      }}
    >
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-10">
          <div
            className="text-xs uppercase mb-2.5"
            style={{ color: "var(--ink-500)", letterSpacing: "0.08em" }}
          >
            QI Program coverage
          </div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(26px, 3.5vw, 38px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "var(--ink-900)",
            }}
          >
            All 14 quality indicators, in one place.
          </h2>
          <p
            className="mt-3 max-w-[640px]"
            style={{ color: "var(--ink-500)", fontSize: 14, lineHeight: 1.6 }}
          >
            Aligned to the National Mandatory QI Program Manual 4.0, AIHW.
            Every category gets its own trend chart, severity breakdown, and benchmarking view.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {INDICATORS.map((ind, i) => (
            <motion.div
              key={ind.num}
              className="cd-surface p-4"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.35, delay: i * 0.03 }}
            >
              <div
                className="text-[10.5px] mb-1"
                style={{
                  color: "var(--ink-500)",
                  letterSpacing: "0.05em",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {ind.num}
              </div>
              <div
                className="text-[13px] font-medium leading-tight"
                style={{ color: "var(--ink-900)" }}
              >
                {ind.name}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
