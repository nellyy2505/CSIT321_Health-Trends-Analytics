import { useState } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

const Q = ["Q1 23", "Q2 23", "Q3 23", "Q4 23", "Q1 24", "Q2 24", "Q3 24", "Q4 24"];
const COLORS = { red: "#d85a30", amber: "#c27700", green: "#ff7b00", blue: "#378add", purple: "#534AB7" };

const SIDEBAR_ITEMS = [
  { id: "pi", label: "Pressure injuries", dot: "#d85a30", count: "11" },
  { id: "falls", label: "Falls & major injury", dot: "#ba7517", count: "7" },
  { id: "uwl", label: "Unplanned weight loss", dot: "#1d9e75", count: "4" },
  { id: "meds", label: "Medications", dot: "#ba7517", count: "19" },
  { id: "adl", label: "Activities of daily living", dot: "#1d9e75", count: "16" },
  { id: "ic", label: "Incontinence care", dot: "#1d9e75", count: "6" },
  { id: "rp", label: "Restrictive practices", dot: "#d85a30", count: "8" },
  { id: "hosp", label: "Hospitalisation", dot: "#ba7517", count: "10" },
  { id: "ah", label: "Allied health", dot: "#1d9e75", count: "15" },
  { id: "cx", label: "Consumer experience", dot: "#1d9e75", count: "87" },
  { id: "qol", label: "Quality of life", dot: "#ba7517", count: "87" },
  { id: "wf", label: "Workforce", dot: "#1d9e75", count: "—" },
  { id: "en", label: "Enrolled nursing", dot: "#ba7517", count: "—" },
  { id: "ls", label: "Lifestyle officer", dot: "#1d9e75", count: "—" },
];

const SECTIONS = [
  {
    id: "pi",
    title: "Pressure injuries",
    subtitle: "PI_01 · S1–S4 · Unstageable · DTI — Q3 2024",
    badge: "red",
    badgeLabel: "Above threshold",
    stats: [
      { label: "Prevalence rate", value: "12.4%", status: "red", change: "↑ +1.2% vs Q2" },
      { label: "Residents affected", value: "11", status: "red", change: "↑ +1 vs Q2" },
      { label: "Stage 3 or above", value: "3", status: "amber", change: "→ unchanged" },
      { label: "DTI this quarter", value: "2", status: "amber", change: "↑ +1 vs Q2" },
    ],
    charts: [
      { type: "line", title: "Prevalence trend", sub: "% residents with any pressure injury", data: Q.map((q, i) => ({ name: q, value: [7.2, 8.1, 8.9, 9.3, 10.1, 10.8, 11.2, 12.4][i] })) },
      { type: "pie", title: "Staging distribution", sub: "Breakdown by stage — Q3 2024", data: [{ name: "S1", value: 3 }, { name: "S2", value: 3 }, { name: "S3", value: 2 }, { name: "S4", value: 1 }, { name: "DTI", value: 2 }], colors: ["#faeeda", "#f0997b", COLORS.red, "#993c1d", COLORS.purple] },
    ],
  },
  {
    id: "falls",
    title: "Falls & major injury",
    subtitle: "FALL_01 · FALL_MAJ — Q3 2024",
    badge: "amber",
    badgeLabel: "Monitor",
    stats: [
      { label: "Any fall rate", value: "8.1%", status: "amber", change: "→ stable" },
      { label: "Residents who fell", value: "7", status: "amber", change: "→ unchanged" },
      { label: "Major injury", value: "2", status: "red", change: "↑ +1 vs Q2" },
      { label: "Major injury rate", value: "2.3%", status: "red", change: "↑ +1.1%" },
    ],
    charts: [
      { type: "line", title: "Falls trend", sub: "Any fall vs major injury rate", data: Q.map((q, i) => ({ name: q, any: [7.1, 7.4, 7.8, 8.0, 7.9, 8.1, 8.1, 8.0][i], major: [0.8, 1.0, 1.1, 1.2, 1.1, 1.2, 2.3, 2.1][i] })) },
      { type: "bar", title: "Minor vs major injury", sub: "Count by quarter", data: Q.map((q, i) => ({ name: q, minor: [5, 5, 6, 6, 6, 6, 5, 5][i], major: [1, 1, 1, 1, 1, 1, 2, 2][i] })) },
    ],
  },
  {
    id: "uwl",
    title: "Unplanned weight loss",
    subtitle: "UWL_SIG · UWL_CON — Q3 2024",
    badge: "green",
    badgeLabel: "On track",
    stats: [
      { label: "Significant loss rate", value: "4.2%", status: "green", change: "↓ improving" },
      { label: "Residents affected", value: "4", status: "green", change: "↓ -1 vs Q2" },
      { label: "Consecutive loss", value: "2", status: "amber", change: "→ stable" },
      { label: "Consecutive rate", value: "2.3%", status: "amber", change: "→ stable" },
    ],
    charts: [
      { type: "line", title: "Weight loss trend", sub: "Significant vs consecutive loss rate", data: Q.map((q, i) => ({ name: q, sig: [6.2, 5.8, 5.5, 5.1, 4.8, 4.6, 4.4, 4.2][i], con: [3.1, 2.9, 2.8, 2.7, 2.5, 2.4, 2.3, 2.3][i] })) },
      { type: "bar", title: "Resident count by type", sub: "Significant vs consecutive — by quarter", data: Q.map((q, i) => ({ name: q, significant: [5, 5, 5, 4, 4, 4, 4, 4][i], consecutive: [3, 2, 2, 2, 2, 2, 2, 2][i] })) },
    ],
  },
  {
    id: "meds",
    title: "Medications",
    subtitle: "MED_POLY · MED_AP · MED_AP_WITH_DX · MED_AP_WITHOUT_DX — Q3 2024",
    badge: "amber",
    badgeLabel: "Monitor",
    stats: [
      { label: "Polypharmacy rate", value: "22.0%", status: "amber", change: "↑ +1.0% vs Q2" },
      { label: "On 9+ medications", value: "19", status: "amber", change: "↑ +1 vs Q2" },
      { label: "Antipsychotic use", value: "28.0%", status: "amber", change: "→ stable" },
      { label: "AP without diagnosis", value: "12.0%", status: "red", change: "↑ auditor focus" },
    ],
    charts: [
      { type: "line", title: "Polypharmacy trend", sub: "% residents on 9 or more medications", data: Q.map((q, i) => ({ name: q, value: [18, 19, 19, 20, 20, 21, 21, 22][i] })) },
      { type: "pie", title: "Antipsychotic 3-way split", sub: '"Without diagnosis" = auditor focus', data: [{ name: "No antipsychotic", value: 72 }, { name: "With diagnosis", value: 16 }, { name: "Without diagnosis", value: 12 }], colors: [COLORS.green + "cc", COLORS.amber + "cc", COLORS.red] },
    ],
  },
  {
    id: "adl",
    title: "Activities of daily living",
    subtitle: "ADL_01 · Barthel 10 domains — Q3 2024",
    badge: "green",
    badgeLabel: "On track",
    stats: [
      { label: "Decline rate", value: "18.3%", status: "green", change: "↓ improving" },
      { label: "Residents declined", value: "16", status: "green", change: "↓ -2 vs Q2" },
      { label: "Avg Barthel score", value: "54", status: "green", change: "↑ +2 vs Q2" },
      { label: "Below 50 (high need)", value: "22", status: "amber", change: "→ stable" },
    ],
    charts: [
      { type: "line", title: "ADL decline trend", sub: "% residents with functional decline per quarter", data: Q.map((q, i) => ({ name: q, value: [24, 23, 22, 21, 20, 19, 19, 18.3][i] })) },
      { type: "radar", title: "Barthel domain profile", sub: "Average score across 10 domains — Q3 2024", data: ["Bowels", "Bladder", "Grooming", "Toilet", "Feeding", "Transfer", "Mobility", "Dressing", "Stairs", "Bathing"].map((name, i) => ({ subject: name.length > 8 ? name.slice(0, 7) + "…" : name, A: [6.8, 6.4, 7.1, 6.2, 7.4, 5.9, 5.7, 6.3, 4.8, 5.5][i], fullMark: 10 })) },
    ],
  },
  {
    id: "ic",
    title: "Incontinence care",
    subtitle: "IC_IAD · Categories 1A · 1B · 2A · 2B — Q3 2024",
    badge: "green",
    badgeLabel: "On track",
    stats: [
      { label: "IAD prevalence", value: "6.7%", status: "green", change: "→ stable" },
      { label: "Residents with IAD", value: "6", status: "green", change: "→ unchanged" },
      { label: "Category 2 (severe)", value: "2", status: "amber", change: "→ unchanged" },
      { label: "Severe IAD rate", value: "2.3%", status: "amber", change: "→ stable" },
    ],
    charts: [
      { type: "line", title: "IAD prevalence trend", sub: "% residents with incontinence-associated dermatitis", data: Q.map((q, i) => ({ name: q, value: [7.2, 7.0, 6.9, 6.8, 6.8, 6.7, 6.7, 6.7][i] })) },
      { type: "pie", title: "IAD category breakdown", sub: "1A · 1B · 2A · 2B — Q3 2024", data: [{ name: "1A (mild)", value: 2 }, { name: "1B (moderate)", value: 2 }, { name: "2A (severe)", value: 1 }, { name: "2B (very severe)", value: 1 }], colors: [COLORS.green + "99", COLORS.green, COLORS.amber, COLORS.red] },
    ],
  },
  {
    id: "rp",
    title: "Restrictive practices",
    subtitle: "RP_01 · Mechanical · Physical · Environmental · Seclusion — Q3 2024",
    badge: "red",
    badgeLabel: "Above threshold",
    stats: [
      { label: "Any restraint rate", value: "9.5%", status: "red", change: "↑ +1.5% vs Q2" },
      { label: "Residents restrained", value: "8", status: "red", change: "↑ +1 vs Q2" },
      { label: "Mechanical", value: "4", status: "amber", change: "→ unchanged" },
      { label: "Seclusion", value: "1", status: "red", change: "↑ new this quarter" },
    ],
    charts: [
      { type: "line", title: "Restraint prevalence trend", sub: "% residents with any restrictive practice", data: Q.map((q, i) => ({ name: q, value: [4, 5, 5, 6, 7, 8, 8, 9.5][i] })) },
      { type: "bar", title: "Restraint type breakdown", sub: "By type — Q3 2024", data: [{ name: "Mechanical", value: 4 }, { name: "Physical", value: 2 }, { name: "Environmental", value: 1 }, { name: "Seclusion", value: 1 }] },
    ],
  },
  {
    id: "hosp",
    title: "Hospitalisation",
    subtitle: "HOSP_ED · HOSP_ALL — Q3 2024",
    badge: "amber",
    badgeLabel: "Monitor",
    stats: [
      { label: "Any hospitalisation", value: "11.2%", status: "amber", change: "→ stable" },
      { label: "Residents hospitalised", value: "10", status: "amber", change: "→ unchanged" },
      { label: "ED presentations", value: "5", status: "amber", change: "→ unchanged" },
      { label: "ED rate", value: "5.7%", status: "amber", change: "→ stable" },
    ],
    charts: [
      { type: "line", title: "Hospitalisation trend", sub: "ED vs all hospitalisations rate", data: Q.map((q, i) => ({ name: q, any: [10.1, 10.5, 10.8, 11.0, 11.1, 11.2, 11.2, 11.0][i], ed: [5.0, 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 5.5][i] })) },
      { type: "bar", title: "ED vs admission split", sub: "Count by quarter", data: Q.map((q, i) => ({ name: q, admission: [5, 5, 5, 6, 6, 6, 5, 5][i], ed: [4, 5, 5, 5, 5, 5, 5, 5][i] })) },
    ],
  },
  {
    id: "ah",
    title: "Allied health",
    subtitle: "AH_REC_RECOMMENDED · RCVD_PHYSIO · RCVD_OT · RCVD_SPEECH · RCVD_OTHER — Q3 2024",
    badge: "green",
    badgeLabel: "On track",
    stats: [
      { label: "Services recommended", value: "48", status: "green", change: "→ stable" },
      { label: "Services received", value: "33", status: "green", change: "↑ +2 vs Q2" },
      { label: "Gap (unmet)", value: "15", status: "amber", change: "↓ -2 vs Q2" },
      { label: "Unmet rate", value: "31.3%", status: "amber", change: "↓ improving" },
    ],
    charts: [
      { type: "bar", title: "Recommended vs received", sub: "Gap by discipline — Q3 2024", data: [{ name: "Physio", Recommended: 22, Received: 17 }, { name: "OT", Recommended: 14, Received: 10 }, { name: "Speech", Recommended: 8, Received: 4 }, { name: "Other", Recommended: 4, Received: 2 }] },
      { type: "line", title: "Unmet need trend", sub: "Gap count over 8 quarters", data: Q.map((q, i) => ({ name: q, value: [22, 20, 19, 18, 17, 16, 16, 15][i] })) },
    ],
  },
  {
    id: "cx",
    title: "Consumer experience",
    subtitle: "CONSUMER_SCORE — Q3 2024",
    badge: "green",
    badgeLabel: "On track",
    stats: [
      { label: "Avg satisfaction score", value: "78%", status: "green", change: "↑ +2% vs Q2" },
      { label: "Responses collected", value: "87", status: "green", change: "→ all residents" },
      { label: "Score above 80%", value: "41", status: "green", change: "↑ +3 vs Q2" },
      { label: "Score below 50%", value: "8", status: "amber", change: "→ unchanged" },
    ],
    charts: [
      { type: "line", title: "Satisfaction score trend", sub: "Average consumer experience score per quarter", data: Q.map((q, i) => ({ name: q, value: [70, 72, 73, 74, 75, 76, 77, 78][i] })) },
      { type: "bar", title: "Score distribution", sub: "Resident scores grouped by range — Q3 2024", data: [{ name: "20–39%", value: 3 }, { name: "40–59%", value: 5 }, { name: "60–79%", value: 38 }, { name: "80–100%", value: 41 }] },
    ],
  },
  {
    id: "qol",
    title: "Quality of life",
    subtitle: "QOL_SCORE — Q3 2024",
    badge: "amber",
    badgeLabel: "Monitor",
    stats: [
      { label: "Avg QoL score", value: "64%", status: "amber", change: "→ stable" },
      { label: "Responses collected", value: "87", status: "green", change: "→ all residents" },
      { label: "Score above 70%", value: "29", status: "amber", change: "→ unchanged" },
      { label: "Score below 40%", value: "11", status: "red", change: "↑ +2 vs Q2" },
    ],
    charts: [
      { type: "line", title: "Quality of life trend", sub: "Average QoL score per quarter", data: Q.map((q, i) => ({ name: q, value: [65, 64, 65, 63, 64, 64, 63, 64][i] })) },
      { type: "bar", title: "Score distribution", sub: "Resident QoL scores by range — Q3 2024", data: [{ name: "<40%", value: 11 }, { name: "40–59%", value: 22 }, { name: "60–79%", value: 43 }, { name: "80%+", value: 11 }] },
    ],
  },
  {
    id: "wf",
    title: "Workforce",
    subtitle: "WORKFORCE_ADEQUATE — Q3 2024",
    badge: "green",
    badgeLabel: "On track",
    stats: [
      { label: "Adequacy rate", value: "92%", status: "green", change: "→ stable" },
      { label: "Adequate shifts", value: "92", status: "green", change: "→ stable" },
      { label: "Inadequate shifts", value: "8", status: "amber", change: "→ unchanged" },
      { label: "Trend direction", value: "Stable", status: "green", change: "→ 4 quarters" },
    ],
    charts: [
      { type: "line", title: "Workforce adequacy trend", sub: "% shifts with adequate staffing per quarter", data: Q.map((q, i) => ({ name: q, value: [90, 91, 91, 92, 91, 92, 92, 92][i] })) },
    ],
  },
  {
    id: "en",
    title: "Enrolled nursing",
    subtitle: "EN_DIRECT_CARE_PCT — Q3 2024",
    badge: "amber",
    badgeLabel: "Monitor",
    stats: [
      { label: "Direct care time", value: "88%", status: "amber", change: "↓ -2% vs Q2" },
      { label: "Trend direction", value: "Declining", status: "amber", change: "↓ 3 quarters" },
      { label: "Q1 2023 baseline", value: "94%", status: "green", change: "→ reference" },
      { label: "Change since baseline", value: "-6%", status: "red", change: "↑ needs review" },
    ],
    charts: [
      { type: "line", title: "Enrolled nursing direct care trend", sub: "% time spent on direct care activities — 8 quarters", data: Q.map((q, i) => ({ name: q, value: [94, 93, 92, 91, 91, 90, 89, 88][i] })) },
    ],
  },
  {
    id: "ls",
    title: "Lifestyle officer",
    subtitle: "LIFESTYLE_SESSIONS — Q3 2024",
    badge: "green",
    badgeLabel: "On track",
    stats: [
      { label: "Avg sessions / resident", value: "2.4", status: "green", change: "→ stable" },
      { label: "Total sessions", value: "209", status: "green", change: "↑ +12 vs Q2" },
      { label: "Zero sessions", value: "9", status: "amber", change: "→ unchanged" },
      { label: "5+ sessions", value: "31", status: "green", change: "↑ +4 vs Q2" },
    ],
    charts: [
      { type: "line", title: "Sessions per resident trend", sub: "Average lifestyle sessions per resident per quarter", data: Q.map((q, i) => ({ name: q, value: [1.8, 1.9, 2.0, 2.1, 2.1, 2.2, 2.3, 2.4][i] })) },
      { type: "bar", title: "Session frequency distribution", sub: "Resident count by sessions received — Q3 2024", data: [{ name: "0 sessions", value: 9 }, { name: "1–2", value: 28 }, { name: "3–4", value: 19 }, { name: "5+", value: 31 }] },
    ],
  },
];

function ChartCard({ chart, orange = "#f97316" }) {
  const { type, title, sub, data, colors } = chart;
  const chartHeight = 220;

  const renderChart = () => {
    if (type === "line") {
      const first = data[0];
      const keys = first ? Object.keys(first).filter((k) => k !== "name" && typeof first[k] === "number") : [];
      const lineColors = [orange, COLORS.red, COLORS.amber, COLORS.blue];
      return (
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip />
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={lineColors[i % lineColors.length]} strokeWidth={2} dot={{ r: 3 }} name={k} />
          ))}
        </LineChart>
      );
    }
    if (type === "bar") {
      const first = data[0];
      const keys = first ? Object.keys(first).filter((k) => k !== "name" && typeof first[k] === "number") : [];
      const barColors = [orange, COLORS.red, COLORS.amber, COLORS.green];
      return (
        <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip />
          {keys.length > 1 && <Legend />}
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={barColors[i % barColors.length]} name={k} radius={4} />
          ))}
        </BarChart>
      );
    }
    if (type === "radar") {
      return (
        <RadarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
          <Radar name="Score" dataKey="A" stroke={orange} fill={orange} fillOpacity={0.4} strokeWidth={2} />
          <Tooltip />
        </RadarChart>
      );
    }
    if (type === "pie") {
      const pieColors = colors || [orange, COLORS.amber, COLORS.red, COLORS.green, COLORS.purple];
      return (
        <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => (
              <Cell key={i} fill={pieColors[i % pieColors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">{sub}</p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

export default function ReportsPage() {
  const [activeId, setActiveId] = useState("pi");
  const [quarter, setQuarter] = useState("Q3 2024");

  const section = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];
  const badgeClass = section.badge === "red" ? "bg-red-100 text-red-800" : section.badge === "amber" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar — same theme as Settings (MyDataSidebar) */}
        <aside className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 overflow-y-auto w-56 md:w-60 lg:w-64 max-h-[85vh] shrink-0">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All 14 indicators</h2>
          <ul className="space-y-0.5">
            {SIDEBAR_ITEMS.map((item) => (
              <li
                key={item.id}
                onClick={() => setActiveId(item.id)}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition ${
                  activeId === item.id ? "bg-primary text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: activeId === item.id ? "currentColor" : item.dot }} />
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
                <span className={`text-xs shrink-0 ${activeId === item.id ? "text-white/90" : "text-gray-400"}`}>{item.count}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content — same card style as Settings */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                <strong>{section.title}</strong>
              </h1>
              <p className="text-sm text-gray-500 mt-1">{section.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5"
              >
                <option>Q3 2024</option>
                <option>Q2 2024</option>
                <option>Q1 2024</option>
                <option>Q4 2023</option>
              </select>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badgeClass}`}>{section.badgeLabel}</span>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {section.stats.map((stat) => (
              <div key={stat.label} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{stat.label}</div>
                <div className={`text-xl font-semibold ${
                  stat.status === "red" ? "text-red-600" : stat.status === "amber" ? "text-amber-700" : "text-gray-900"
                }`}>
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 mt-1">{stat.change}</div>
              </div>
            ))}
          </div>

          {/* Charts — 2-col or 1-col like dashboard-csv/visualize */}
          <div className="space-y-6">
            <div className={`grid gap-4 ${section.charts.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {section.charts.map((ch, i) => (
                <ChartCard key={i} chart={ch} orange="#f97316" />
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
