import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

const team = [
  { name: "Nelly Nguyen", role: "Technical Leader" },
  { name: "Duong Nguyen", role: "Project Manager" },
  { name: "Minh Binh", role: "Software Engineer" },
  { name: "Wayne", role: "Software Engineer" },
  { name: "Hazza Alhashmi", role: "Software Engineer" },
];

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2
        className="mb-3"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          color: "var(--ink-900)",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <div style={{ color: "var(--ink-700)", fontSize: 14, lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className="flex-grow pb-12 px-4 sm:px-6 flex justify-center pt-32">
        <div className="cd-surface max-w-4xl w-full p-10">
          <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
            <span className="dot" /> About
          </span>
          <h1
            className="mb-2"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
            }}
          >
            About us
          </h1>
          <p className="mb-8" style={{ color: "var(--ink-500)", fontSize: 14 }}>
            UOW Capstone Project, Spring 2025
          </p>

          <Section title="Our purpose">
            <p>
              We&apos;re building a Business-to-Government (B2G) SaaS platform, 
              <span style={{ fontWeight: 600, color: "var(--ink-900)" }}>CareData Portal</span>, to
              help aged care providers manage Quality Indicator data with less friction. Our goals:
              streamline CSV ingestion, validate datasets, map fields to the required domain, and support
              secure reporting workflows for compliance and analytics.
            </p>
          </Section>

          <Section title="The team (W08)">
            <ul className="grid sm:grid-cols-2 gap-3">
              {team.map((m) => (
                <li
                  key={m.name}
                  className="p-4"
                  style={{
                    background: "var(--bg-paper)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 12,
                  }}
                >
                  <p style={{ fontWeight: 600, color: "var(--ink-900)" }}>{m.name}</p>
                  <p style={{ color: "var(--ink-500)", fontSize: 13, marginTop: 2 }}>{m.role}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What we&apos;re building">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Secure CSV upload with schema mapping to mandated domains.</li>
              <li>Automated validation and quality checks to reduce data errors.</li>
              <li>Dashboard for Quality Indicator tracking and basic analytics.</li>
              <li>Export and reporting workflows to support B2G submission.</li>
            </ul>
          </Section>

          <Section title="Our principles">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <span style={{ fontWeight: 500, color: "var(--ink-900)" }}>Privacy &amp; security:</span>{" "}
                least-privilege access, encryption in transit and at rest.
              </li>
              <li>
                <span style={{ fontWeight: 500, color: "var(--ink-900)" }}>Accessibility:</span>{" "}
                clear UI, assistive-tech friendly components, and sensible defaults.
              </li>
              <li>
                <span style={{ fontWeight: 500, color: "var(--ink-900)" }}>Reliability:</span>{" "}
                deterministic data mapping and auditability for peace of mind.
              </li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              Questions or collaboration ideas? Reach us at{" "}
              <span style={{ fontWeight: 600, color: "var(--sage-ink)" }}>caredata@uow.edu.au</span>.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
