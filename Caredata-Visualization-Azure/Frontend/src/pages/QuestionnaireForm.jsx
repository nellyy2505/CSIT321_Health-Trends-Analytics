import { useState, useRef, useEffect } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import Sidebar from "../components/questionnaire/Sidebar";
import ProgressBar from "../components/questionnaire/ProgressBar";
import DomainCard from "../components/questionnaire/DomainCard";
import { DOMAIN_DETAILS } from "../components/common/domains";

export default function QuestionnaireForm() {
  const [openDomain, setOpenDomain] = useState(1);
  const domainRefs = useRef({});

  useEffect(() => {
    const section = domainRefs.current[openDomain];
    if (section && openDomain >= 4) {
      const yOffset = -100;
      const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [openDomain]);

  const handleToggle = (id) => {
    setOpenDomain(openDomain === id ? null : id);
  };

  return (
    <div className="min-h-screen pt-24" style={{ background: "var(--bg-cream)" }}>
      <Navbar />

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto mt-4 gap-6 px-4 sm:px-6 pb-10">
        <div className="flex-shrink-0">
          <Sidebar activeDomain={openDomain} onSelectDomain={setOpenDomain} />
        </div>

        <main className="flex-1 cd-surface p-6 sm:p-8">
          <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
            <span className="dot" /> Quality indicators
          </span>
          <h1
            className="mb-2"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
            }}
          >
            Quality Indicator questionnaire
          </h1>
          <p className="mb-4" style={{ color: "var(--ink-500)", fontSize: 14 }}>
            Complete assessment across all 14 Quality Indicator domains to monitor care standards and outcomes.
          </p>

          <div
            className="p-4 mb-6"
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: 12,
              color: "var(--ink-700)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Please complete all required fields marked with an asterisk (*). Optional fields do not affect completion.
          </div>

          <ProgressBar completed={0} total={DOMAIN_DETAILS.length} />

          <div className="mt-8 space-y-6">
            {DOMAIN_DETAILS.map((domain) => (
              <div key={domain.id} ref={(el) => (domainRefs.current[domain.id] = el)}>
                <DomainCard
                  id={domain.id}
                  title={domain.title}
                  description={domain.description}
                  open={openDomain === domain.id}
                  onToggle={() => handleToggle(domain.id)}
                  fields={domain.fields}
                />
              </div>
            ))}
          </div>

          <div
            className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10 pt-6"
            style={{ borderTop: "1px solid var(--line-soft)" }}
          >
            <button className="cd-btn cd-btn-ghost flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Save draft
            </button>

            <button className="cd-btn cd-btn-primary flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 8-16 8V4z" />
              </svg>
              Review &amp; submit
            </button>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
