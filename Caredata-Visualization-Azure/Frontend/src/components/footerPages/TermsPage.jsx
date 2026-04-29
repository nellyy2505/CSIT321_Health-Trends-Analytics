import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

const sections = [
  {
    title: "Purpose",
    body: "The CareData Portal is designed to assist aged care and health research by supporting data collection and analysis. It is not intended for direct clinical use or patient treatment.",
  },
  {
    title: "User responsibilities",
    body: "Users agree to provide accurate data and not misuse the platform. Any unauthorised access, tampering, or misuse of data may lead to restriction or removal.",
  },
  {
    title: "Intellectual property",
    body: "All code, design, and visualisations belong to Team W08. The data provided by users remains their property but may be used in aggregated, anonymised research results.",
  },
  {
    title: "Liability disclaimer",
    body: "The portal is provided “as is” for research purposes. The University of Wollongong and Team W08 are not responsible for data interpretation or decision-making based on analytics displayed.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className="flex-grow pb-12 px-4 sm:px-6 flex justify-center pt-32">
        <div className="cd-surface max-w-4xl w-full p-10">
          <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
            <span className="dot" /> Legal
          </span>
          <h1
            className="mb-4"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
            }}
          >
            Terms of use
          </h1>
          <p className="mb-8" style={{ color: "var(--ink-700)", fontSize: 14, lineHeight: 1.7 }}>
            By accessing or using the CareData Portal, you agree to these Terms of Use.
            This system is provided by{" "}
            <span style={{ fontWeight: 600, color: "var(--ink-900)" }}>Team W08</span> at the University
            of Wollongong for research and educational purposes.
          </p>

          {sections.map((s) => (
            <section key={s.title} className="mb-6">
              <h2
                className="mb-2"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 22,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                }}
              >
                {s.title}
              </h2>
              <p style={{ color: "var(--ink-700)", fontSize: 14, lineHeight: 1.7 }}>{s.body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
