import { useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  ArrowUpTrayIcon,
  ChartBarSquareIcon,
  ChartPieIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import Hero from "../components/landingPage/Hero";
import LandingIndicators from "../components/landingPage/LandingIndicators";

// Each card maps directly to a tab in the navbar so visitors can preview
// what the product actually does rather than reading abstract value props.
const TAB_FEATURES = [
  {
    icon: <ChartBarSquareIcon className="w-5 h-5" />,
    title: "Dashboard",
    body:
      "All 14 QI categories on one screen, with traffic light status, quarter over quarter trends, and a multi indicator risk heatmap.",
  },
  {
    icon: <ArrowUpTrayIcon className="w-5 h-5" />,
    title: "Data Entry",
    body:
      "Upload a quarterly QI CSV. We validate it against indicator definitions, flag values outside the expected set, and stage it for review.",
  },
  {
    icon: <MicrophoneIcon className="w-5 h-5" />,
    title: "Voice Screening",
    body:
      "Residents record short voice samples on a tablet. The dashboard surfaces early signals for cognitive change, stroke risk, and depression.",
  },
  {
    icon: <DocumentTextIcon className="w-5 h-5" />,
    title: "Reports",
    body:
      "Quarterly QI reports formatted for Department of Health submissions, board papers, and Quality and Safety Commission audits.",
  },
  {
    icon: <ScaleIcon className="w-5 h-5" />,
    title: "Benchmarking",
    body:
      "Facility rates against AIHW national medians, with percentile ranking and peer group comparison by size and remoteness.",
  },
  {
    icon: <ChartPieIcon className="w-5 h-5" />,
    title: "My Data",
    body:
      "A single resident view: key info, clinical measurements, trend, and the indicators they currently trigger.",
  },
];

function TabFeatures() {
  return (
    <section
      style={{
        borderTop: "1px solid var(--line-soft)",
        background: "var(--bg-paper)",
      }}
      className="px-8 py-14"
    >
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14 mb-12">
          <div>
            <div
              className="text-xs uppercase mb-3"
              style={{ color: "var(--ink-500)", letterSpacing: "0.08em" }}
            >
              What's inside
            </div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(28px, 4vw, 42px)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "var(--ink-900)",
              }}
            >
              Six tabs. One quality reporting workflow.
            </h2>
          </div>
          <p
            className="md:self-end"
            style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink-700)" }}
          >
            CareData is built around the way Directors of Nursing and quality managers
            actually work, from the moment a CSV lands to the moment a report goes to
            the Department of Health.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TAB_FEATURES.map((f, i) => (
            <div key={i} className="cd-surface p-6">
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4"
                style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)" }}
              >
                {f.icon}
              </div>
              <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--ink-900)" }}>
                {f.title}
              </h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-500)" }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    {
      n: "01",
      t: "Upload or scan",
      d: "Drop a facility CSV, or photograph a lab report. Fields are extracted and staged for review in Data Entry.",
    },
    {
      n: "02",
      t: "Review in My Data",
      d: "A single source of truth: key info, patient context, clinical measurements, trend, and risk.",
    },
    {
      n: "03",
      t: "Open the dashboard",
      d: "Trend, severity, and gap charts with AI assisted commentary. Export as FHIR, CSV, or a quarterly report.",
    },
  ];
  return (
    <section className="max-w-[1280px] mx-auto px-8 py-16">
      <div className="text-center mb-10">
        <div
          className="text-xs uppercase mb-2.5"
          style={{ color: "var(--ink-500)", letterSpacing: "0.08em" }}
        >
          Workflow
        </div>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(26px, 3.5vw, 36px)",
            letterSpacing: "-0.02em",
            color: "var(--ink-900)",
          }}
        >
          Three careful steps, from record to report.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((s, i) => (
          <div key={i} className="cd-surface p-7">
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 36,
                color: "var(--sage-ink)",
                lineHeight: 1,
                marginBottom: 20,
              }}
            >
              {s.n}
            </div>
            <h3 className="text-[17px] font-semibold mb-2" style={{ color: "var(--ink-900)" }}>
              {s.t}
            </h3>
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-500)" }}>
              {s.d}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CallToAction() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem("token");
  return (
    <section className="max-w-[1280px] mx-auto px-8 py-10 pb-20">
      <div
        className="rounded-[22px] p-10 md:p-14 grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-8 items-center"
        style={{ background: "var(--ink-900)", color: "var(--bg-paper)" }}
      >
        <div>
          <h2
            className="mb-4"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--bg-paper)",
            }}
          >
            Ready when your team is.
          </h2>
          <p
            className="max-w-[480px]"
            style={{ fontSize: 15, lineHeight: 1.6, color: "oklch(0.85 0.01 90)" }}
          >
            Start with a single upload. No credit card, no installation, the first
            facility report is on us.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <button
            type="button"
            onClick={() => navigate(isLoggedIn ? "/dashboard" : "/register")}
            className="cd-btn"
            style={{ background: "var(--bg-paper)", color: "var(--ink-900)" }}
          >
            {isLoggedIn ? "Go to dashboard" : "Create account"}
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/about")}
            className="cd-btn"
            style={{
              background: "transparent",
              color: "var(--bg-paper)",
              border: "1px solid oklch(0.5 0.01 90)",
            }}
          >
            Book a walkthrough
          </button>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <Hero />
      <TabFeatures />
      <LandingIndicators />
      <Workflow />
      <CallToAction />
      <Footer />
    </div>
  );
}
