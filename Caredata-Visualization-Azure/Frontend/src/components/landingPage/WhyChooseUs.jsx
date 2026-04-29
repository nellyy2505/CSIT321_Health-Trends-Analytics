import { motion } from "framer-motion";

export default function WhyChooseUs() {
  const reasons = [
    {
      title: "Clinical Governance Ready",
      desc: "Built for Directors of Nursing and quality managers. Track all 14 QI categories with traffic-light alerts, trend analysis, and audit-ready reports aligned to AIHW Manual 4.0."
    },
    {
      title: "AI-Powered Screening",
      desc: "Voice biomarker analysis detects early signs of cognitive decline, stroke risk, and depression from 30-second recordings, no specialist equipment required."
    },
    {
      title: "National Benchmarking",
      desc: "Compare your facility’s indicator rates against AIHW published national medians with percentile rankings and peer group analysis to identify areas for improvement."
    }
  ];

  // Animation presets
  const container = {
    hidden: { opacity: 0, y: 40 },
    visible: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay, ease: "easeOut" },
    }),
  };

  return (
    <section className="relative bg-white py-20 overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        {/* Section heading */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={container}
          className="text-left mb-12"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Why Care Data
          </p>
          <h2 className="text-4xl font-bold text-gray-900 leading-tight">
            Built for aged care quality teams
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-10">
          {reasons.map((reason, idx) => (
            <motion.div
              key={idx}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 text-left border border-gray-100"
              variants={container}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              custom={idx * 0.2} // small stagger delay
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {reason.title}
              </h3>
              <p
                className="text-gray-600 leading-relaxed text-justify"
                style={{ hyphens: "auto" }}
              >
                {reason.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
