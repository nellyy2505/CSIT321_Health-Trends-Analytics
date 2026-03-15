import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

const INDICATORS_EMPTY = [
  "Pressure injuries", "Falls & major injury", "Unplanned weight loss", "Medications",
  "Activities of daily living", "Incontinence care", "Restrictive practices", "Hospitalisation",
  "Allied health", "Consumer experience", "Quality of life", "Workforce",
  "Enrolled nursing", "Lifestyle officer",
];

const INDICATORS_DATA = [
  { name: "Pressure injuries", rate: "12.4%", label: "prevalence rate", status: "red", trend: "up", spark: [4, 5, 6, 7, 8, 9, 11, 12] },
  { name: "Falls & major injury", rate: "8.1%", label: "prevalence rate", status: "amber", trend: "stable", spark: [7, 8, 9, 8, 8, 7, 8, 8] },
  { name: "Unplanned weight loss", rate: "4.2%", label: "prevalence rate", status: "green", trend: "down", spark: [9, 8, 7, 7, 6, 5, 5, 4] },
  { name: "Medications", rate: "22.0%", label: "polypharmacy rate", status: "amber", trend: "up", spark: [18, 19, 19, 20, 20, 21, 21, 22] },
  { name: "Activities of daily living", rate: "18.3%", label: "decline rate", status: "green", trend: "down", spark: [24, 23, 22, 21, 20, 19, 19, 18] },
  { name: "Incontinence care", rate: "6.7%", label: "IAD rate", status: "green", trend: "stable", spark: [7, 6, 7, 6, 7, 6, 7, 7] },
  { name: "Restrictive practices", rate: "9.5%", label: "prevalence rate", status: "red", trend: "up", spark: [4, 5, 6, 6, 7, 8, 9, 10] },
  { name: "Hospitalisation", rate: "11.2%", label: "ED + admission", status: "amber", trend: "stable", spark: [10, 11, 10, 11, 10, 11, 11, 11] },
  { name: "Allied health", rate: "15", label: "residents with gap", status: "green", trend: "down", spark: [22, 20, 19, 18, 17, 16, 16, 15] },
  { name: "Consumer experience", rate: "78%", label: "satisfaction score", status: "green", trend: "up", spark: [70, 72, 73, 74, 75, 76, 77, 78] },
  { name: "Quality of life", rate: "64%", label: "avg QoL score", status: "amber", trend: "stable", spark: [65, 64, 65, 63, 64, 64, 63, 64] },
  { name: "Workforce", rate: "92%", label: "staffing adequacy", status: "green", trend: "stable", spark: [90, 91, 91, 92, 91, 92, 92, 92] },
  { name: "Enrolled nursing", rate: "88%", label: "direct care time", status: "amber", trend: "down", spark: [94, 93, 92, 91, 91, 90, 89, 88] },
  { name: "Lifestyle officer", rate: "N/A", label: "no data yet", status: "nodata", trend: null, spark: [] },
];

const QUARTERS = ["Q1 2023", "Q2 2023", "Q3 2023", "Q4 2023", "Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"];
const TREND_LABEL = { up: "↑ Worsening", down: "↓ Improving", stable: "→ Stable" };
const STATUS_LABEL = { red: "Above threshold", amber: "Monitor", green: "On track", nodata: "No data" };

function SparklineSVG({ data, status }) {
  if (!data || data.length === 0) return null;
  const w = 100;
  const h = 28;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const colors = { green: "#ff7b00", amber: "#c27700", red: "#d85a30", nodata: "#999" };
  const c = colors[status] || "#999";
  const last = pts.split(" ").pop();
  const [cx, cy] = last ? last.split(",") : ["0", "0"];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7">
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={cx} cy={cy} r="2.5" fill={c} />
    </svg>
  );
}

export default function QIDashboardPage() {
  const [hasData, setHasData] = useState(false);
  const [quarterIndex, setQuarterIndex] = useState(6);
  const [showSample, setShowSample] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    import("../services/api")
      .then(({ getUploadHistory }) => getUploadHistory())
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setHasData(true);
      })
      .catch(() => {});
  }, []);

  const useDataState = hasData || showSample;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow px-4 sm:px-6 mt-24 pb-12 pt-8 max-w-7xl mx-auto w-full">
        {/* Page header — same style as Upload CSV */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-semibold text-gray-900">
              <span className="font-bold">Sunrise</span> Aged Care — Dashboard
            </h1>
          </div>
          <span className="text-sm text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
            {useDataState ? "ACFI registered · 87 residents" : "No data loaded"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition"
              onClick={() => setQuarterIndex((i) => Math.max(0, i - 1))}
              aria-label="Previous quarter"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg min-w-[88px] text-center">
              {QUARTERS[quarterIndex]}
            </span>
            <button
              type="button"
              className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition"
              onClick={() => setQuarterIndex((i) => Math.min(QUARTERS.length - 1, i + 1))}
              aria-label="Next quarter"
            >
              ›
            </button>
          </div>
        </div>

        {/* Risk strip */}
        {useDataState && (
          <div className="mb-6 bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-800 flex-1">8 residents flagged across 2 or more categories this quarter</span>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">Resident 004</span>
              <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">Resident 011</span>
              <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">Resident 023</span>
              <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">+5 more</span>
            </div>
            <Link to="/reports" className="text-sm font-medium text-red-700 underline underline-offset-1 hover:text-red-800">
              View all →
            </Link>
          </div>
        )}

        {/* Summary row — same card style as Upload CSV */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total residents", value: useDataState ? <>87 <span className="text-sm text-gray-500 font-normal ml-1">this quarter</span></> : "—", empty: !useDataState },
            { label: "Categories at risk", value: useDataState ? <><span className="text-red-600">3</span> <span className="text-sm text-gray-500 font-normal ml-1">of 14 red</span></> : "—", empty: !useDataState },
            { label: "Last submission", value: useDataState ? <>14 Oct 2024 <span className="text-sm text-gray-500 font-normal ml-1">Q3</span></> : "—", empty: !useDataState },
          ].map(({ label, value, empty }) => (
            <div key={label} className="bg-white rounded-2xl shadow border border-gray-200 p-5">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-2xl font-semibold ${empty ? "text-gray-400" : "text-gray-900"}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Upload banner — same as Upload CSV dashed area + button style */}
        {!useDataState && (
          <div className="mb-8 bg-white rounded-2xl border-2 border-dashed border-gray-300 p-8 flex flex-wrap items-center gap-6 hover:border-orange-400 transition">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 mb-1">No QI data loaded yet</h3>
              <p className="text-sm text-gray-600">
                Upload your quarterly CSV export from the Government Provider Management System (GPMS) to populate all 14 indicators. Your data is processed locally and never shared.
              </p>
            </div>
            <Link
              to="/upload-csv"
              className="shrink-0 w-full sm:w-auto bg-primary text-white py-2.5 px-5 rounded-md font-medium hover:bg-orange-600 transition text-center"
            >
              Go to Data entry →
            </Link>
          </div>
        )}

        {!useDataState && (
          <p className="mb-6">
            <button type="button" onClick={() => setShowSample(true)} className="text-sm text-primary font-medium hover:underline">
              Preview with sample data
            </button>
          </p>
        )}

        {/* Section label — same text style as Upload CSV guidelines */}
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          {useDataState ? `Quality indicators — ${QUARTERS[quarterIndex]}` : "Quality indicators — awaiting data"}
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {useDataState
            ? INDICATORS_DATA.map((ind, i) => (
                <div
                  key={ind.name}
                  className={`bg-white rounded-2xl shadow border border-gray-200 p-4 relative overflow-hidden animate-[fadeIn_0.3s_ease_both]`}
                  style={{ animationDelay: `${0.03 * (i + 1)}s` }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${
                    ind.status === "green" ? "bg-primary" : ind.status === "amber" ? "bg-amber-600" : ind.status === "red" ? "bg-red-500" : "bg-gray-300"
                  }`} />
                  <div className="text-sm font-semibold text-gray-800 mb-2 min-h-[2rem]">{ind.name}</div>
                  <div className="text-xl font-semibold text-gray-900 mb-0.5">{ind.rate}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{ind.label}</div>
                  <div className="h-7 mb-2">
                    <SparklineSVG data={ind.spark} status={ind.status} />
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    {ind.trend ? (
                      <span className={`text-xs font-medium ${
                        ind.trend === "up" ? "text-red-600" : ind.trend === "down" ? "text-green-600" : "text-amber-600"
                      }`}>
                        {TREND_LABEL[ind.trend]}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">— No data</span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${
                      ind.status === "green" ? "bg-orange-50 text-orange-800" :
                      ind.status === "amber" ? "bg-amber-50 text-amber-800" :
                      ind.status === "red" ? "bg-red-50 text-red-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {STATUS_LABEL[ind.status]}
                    </span>
                  </div>
                </div>
              ))
            : INDICATORS_EMPTY.map((name, i) => (
                <div
                  key={name}
                  className="bg-white rounded-2xl shadow border border-gray-200 p-4 relative overflow-hidden animate-[fadeIn_0.3s_ease_both]"
                  style={{ animationDelay: `${0.02 * (i + 1)}s` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gray-200" />
                  <div className="text-sm font-semibold text-gray-500 mb-2 min-h-[2rem]">{name}</div>
                  <div className="text-xl font-semibold text-gray-300 mb-0.5">—</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">no data</div>
                  <div className="h-7 mb-2 bg-gray-100 rounded overflow-hidden relative qi-shimmer" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">— awaiting upload</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase bg-gray-100 text-gray-400">No data</span>
                  </div>
                </div>
              ))}
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .qi-shimmer::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent); animation: qi-shimmer 1.6s infinite; }
        @keyframes qi-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}
