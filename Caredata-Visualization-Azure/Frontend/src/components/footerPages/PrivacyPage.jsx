import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

const sections = [
  {
    title: "Information we collect",
    body: "We collect information such as user registration details, uploaded datasets, and responses to quality indicator questionnaires to support analysis and reporting.",
  },
  {
    title: "How we use data",
    body: "Collected data is used solely for internal research and analytics to identify trends, improve healthcare quality, and ensure compliance with Australian Department of Health standards.",
  },
  {
    title: "Security",
    body: "All information is securely stored with restricted access. Encryption and secure protocols are used to maintain confidentiality and integrity of your data.",
  },
];

export default function PrivacyPage() {
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
            Privacy policy
          </h1>
          <p className="mb-8" style={{ color: "var(--ink-700)", fontSize: 14, lineHeight: 1.7 }}>
            CareData Portal is committed to protecting your privacy in accordance with the
            <span style={{ fontWeight: 500, color: "var(--ink-900)" }}> Australian Privacy Principles </span>
            and the <span style={{ fontWeight: 500, color: "var(--ink-900)" }}>Privacy Act 1988 (Cth)</span>.
            This system is developed by{" "}
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

          <section className="mb-2">
            <h2
              className="mb-2"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              Contact
            </h2>
            <p style={{ color: "var(--ink-700)", fontSize: 14, lineHeight: 1.7 }}>
              For any privacy concerns, contact us at{" "}
              <span style={{ fontWeight: 600, color: "var(--sage-ink)" }}>caredata@uow.edu.au</span>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
