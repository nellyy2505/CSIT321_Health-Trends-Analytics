import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { getQIAggregates } from "../services/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

// ─── Constants (structural only — no demo data) ──────────────────────────────

const ORANGE = "#f97316";
const COLORS = { red: "#d85a30", amber: "#c27700", green: "#ff7b00", blue: "#378add", purple: "#534AB7" };

const INDICATORS_EMPTY = [
  "Pressure injuries", "Falls & major injury", "Unplanned weight loss", "Medications",
  "Activities of daily living", "Incontinence care", "Restrictive practices", "Hospitalisation",
  "Allied health", "Consumer experience", "Quality of life", "Workforce",
  "Enrolled nursing", "Lifestyle officer",
];

const TREND_LABEL = { up: "↑ Worsening", down: "↓ Improving", stable: "→ Stable" };
const STATUS_LABEL = { red: "Above threshold", amber: "Monitor", green: "On track", nodata: "No data", grey: "No data" };
const REPORTS_SECTION_IDS = ["pi","falls","uwl","meds","adl","ic","rp","hosp","ah","cx","qol","wf","en","ls"];
const DASHBOARD_TO_REPORTS_SECTION = {
  pi:"pi",falls:"falls",uwl:"uwl",meds:"meds",adl:"adl",
  incontinence:"ic",rp:"rp",hosp:"hosp",allied_health:"ah",
  consumer_exp:"cx",qol:"qol",workforce:"wf",enrolled_nursing:"en",lifestyle:"ls",
};

const HEATMAP_COLS = ["PI","RP","UWL","Falls","Meds","ADL","IC","Hosp","WF","CX","QoL","EN","AH","LS"];
const STATUS_DIST_COLORS = ["#ff7b00","#c27700","#d85a30","#d1d5db"];
const TREND_DIR_COLORS = ["#16a34a","#f97316","#d85a30"];

const ID_TO_SHORT = {pi:"PI",rp:"RP",falls:"Falls",meds:"Meds",adl:"ADL",uwl:"UWL",incontinence:"IC",hosp:"Hosp",allied_health:"AH Gap",consumer_exp:"CX",qol:"QoL",workforce:"WF",enrolled_nursing:"EN",lifestyle:"LS"};
const LOB_IDS = new Set(["pi","rp","falls","meds","adl","uwl","incontinence","hosp","allied_health"]);

// AIHW national median benchmarks (published figures — not demo data)
const NATIONAL_BENCHMARKS = {
  pi: 10.2, rp: 7.8, falls: 8.3, meds: 19.8,
  uwl: 5.1, incontinence: 6.9, hosp: 11.0, adl: 20.1,
};

// ─── Builder functions (derive display data from API aggregates) ──────────────

function buildTrendSeriesFromAggregates(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return null;
  const aggs = qiAggregates.aggregates;
  const firstIndicators = aggs[0]?.indicators || [];
  if (!firstIndicators.length) return null;
  return firstIndicators.map(ind => ({
    id: DASHBOARD_TO_REPORTS_SECTION[ind.id] || ind.id,
    name: ind.name,
    unit: String(ind.valueDisplay || "").endsWith("%") ? "%" : "",
    lob: LOB_IDS.has(ind.id),
    data: aggs.map(a => {
      const matching = (a.indicators || []).find(i => i.id === ind.id);
      return { date: a.quarterLabel || a.assessmentDate, value: matching?.currentRate ?? null };
    }).filter(d => d.value !== null),
  }));
}

function buildOverviewFromAggregates(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return null;
  const latest = qiAggregates.aggregates[qiAggregates.aggregates.length - 1];
  return (latest.indicators || []).map(ind => ({
    name: ID_TO_SHORT[ind.id] || ind.id,
    rate: ind.currentRate ?? 0,
    status: ind.status || "grey",
  }));
}

function buildStatusDistFromAggregates(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return null;
  const latest = qiAggregates.aggregates[qiAggregates.aggregates.length - 1];
  const counts = { green: 0, amber: 0, red: 0, grey: 0 };
  (latest.indicators || []).forEach(ind => { counts[ind.status || "grey"] = (counts[ind.status || "grey"] || 0) + 1; });
  return [
    { name: "On track", value: counts.green },
    { name: "Monitor", value: counts.amber },
    { name: "Above threshold", value: counts.red },
    { name: "No data", value: counts.grey },
  ].filter(d => d.value > 0);
}

function buildChartSidebarFromAggregates(qiAggregates) {
  const dotColors = { red: "#d85a30", amber: "#ba7517", green: "#1d9e75", grey: "#9ca3af" };
  if (!qiAggregates?.aggregates?.length) {
    return REPORTS_SECTION_IDS.map((id, i) => ({ id, label: INDICATORS_EMPTY[i], dot: dotColors.grey, count: "—" }));
  }
  const latest = qiAggregates.aggregates[qiAggregates.aggregates.length - 1];
  const totalResidents = latest.totalResidents || 0;
  return (latest.indicators || []).map(ind => {
    const sectionId = DASHBOARD_TO_REPORTS_SECTION[ind.id] || ind.id;
    const count = totalResidents > 0 ? Math.round((ind.currentRate ?? 0) * totalResidents / 100) : 0;
    return { id: sectionId, label: ind.name, dot: dotColors[ind.status] || dotColors.grey, count: String(count) };
  });
}

function buildSectionsFromAggregates(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return [];
  const aggs = qiAggregates.aggregates;
  const latest = aggs[aggs.length - 1];
  const quarterLabels = qiAggregates.quarterLabels || aggs.map(a => a.quarterLabel || a.assessmentDate);
  const totalResidents = latest.totalResidents || 0;

  return (latest.indicators || []).map(ind => {
    const rate = ind.currentRate ?? 0;
    const count = totalResidents > 0 ? Math.round(rate * totalResidents / 100) : 0;
    const sectionId = DASHBOARD_TO_REPORTS_SECTION[ind.id] || ind.id;

    const trendData = aggs.map((a, i) => {
      const matching = (a.indicators || []).find(x => x.id === ind.id);
      return { name: quarterLabels[i] || `Q${i + 1}`, value: matching?.currentRate ?? null };
    }).filter(d => d.value !== null);

    const barData = aggs.map((a, i) => {
      const matching = (a.indicators || []).find(x => x.id === ind.id);
      return { name: quarterLabels[i] || `Q${i + 1}`, value: matching?.currentRate ?? 0 };
    });

    const prev = aggs.length >= 2 ? (aggs[aggs.length - 2].indicators || []).find(x => x.id === ind.id) : null;
    const prevRate = prev?.currentRate;
    const delta = prevRate != null ? rate - prevRate : null;
    const deltaStr = delta != null
      ? `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${delta !== 0 ? Math.abs(delta).toFixed(1) + "% vs prior" : "unchanged"}`
      : "—";

    return {
      id: sectionId,
      title: ind.name,
      subtitle: `${sectionId.toUpperCase()} — ${quarterLabels[quarterLabels.length - 1] || "Latest"}`,
      badge: ind.status || "grey",
      badgeLabel: STATUS_LABEL[ind.status] || "No data",
      stats: [
        { label: "Current rate", value: ind.valueDisplay || `${rate.toFixed(1)}%`, status: ind.status || "grey", change: deltaStr },
        { label: "Residents affected", value: String(count), status: count > 0 ? (ind.status || "grey") : "green", change: `of ${totalResidents} total` },
        { label: "Trend", value: ind.trendArrow === "up" ? "Worsening" : ind.trendArrow === "down" ? "Improving" : "Stable", status: ind.trendArrow === "up" ? "red" : ind.trendArrow === "down" ? "green" : "amber", change: `Over ${quarterLabels.length} quarters` },
        { label: "Assessment dates", value: String(quarterLabels.length), status: "green", change: `${totalResidents} residents per date` },
      ],
      charts: [
        { type: "line", title: `${ind.name} — Prevalence trend`, sub: `Rate across ${quarterLabels.length} assessment dates`, data: trendData },
        { type: "bar", title: `${ind.name} — Quarterly rates`, sub: "Rate per assessment period", data: barData },
      ],
    };
  });
}

function buildTrendDirectionCounts(trendSeries) {
  if (!trendSeries?.length) return [];
  let improving = 0, stable = 0, worsening = 0;
  trendSeries.forEach(ts => {
    if (ts.data.length < 2) { stable++; return; }
    const first = ts.data[0].value;
    const last = ts.data[ts.data.length - 1].value;
    const delta = last - first;
    const isImproving = ts.lob ? delta < 0 : delta > 0;
    if (Math.abs(delta) < 0.5) stable++;
    else if (isImproving) improving++;
    else worsening++;
  });
  return [
    { name: "Improving", value: improving },
    { name: "Stable", value: stable },
    { name: "Worsening", value: worsening },
  ];
}

function buildOverviewRadar(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return [];
  const latest = qiAggregates.aggregates[qiAggregates.aggregates.length - 1];
  return (latest.indicators || [])
    .filter(ind => ind.id in NATIONAL_BENCHMARKS)
    .map(ind => ({
      subject: ID_TO_SHORT[ind.id] || ind.id,
      value: ind.currentRate ?? 0,
      benchmark: NATIONAL_BENCHMARKS[ind.id] ?? 0,
      fullMark: 25,
    }));
}

// ─── Helper components ────────────────────────────────────────────────────────

function SparklineSVG({ data, status }) {
  if (!data || data.length === 0) return null;
  const w = 100, h = 28, pad = 2;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
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

function ChartCard({ chart }) {
  const { type, title, sub, data, colors } = chart;
  const renderChart = () => {
    if (type === "line") {
      const keys = data[0] ? Object.keys(data[0]).filter(k => k !== "name" && typeof data[0][k] === "number") : [];
      const lc = [ORANGE, COLORS.red, COLORS.amber, COLORS.blue];
      return (
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip />
          {keys.length > 1 && <Legend />}
          {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={lc[i % lc.length]} strokeWidth={2} dot={{ r: 3 }} name={k} />)}
        </LineChart>
      );
    }
    if (type === "bar") {
      const keys = data[0] ? Object.keys(data[0]).filter(k => k !== "name" && typeof data[0][k] === "number") : [];
      const bc = [ORANGE, COLORS.red, COLORS.amber, COLORS.green];
      return (
        <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip />
          {keys.length > 1 && <Legend />}
          {keys.map((k, i) => <Bar key={k} dataKey={k} fill={bc[i % bc.length]} name={k} radius={4} />)}
        </BarChart>
      );
    }
    if (type === "radar") {
      const keys = data[0] ? Object.keys(data[0]).filter(k => k !== "subject" && k !== "fullMark") : [];
      const rc = [ORANGE, "#9ca3af"];
      const rd = ["", "5 3"];
      return (
        <RadarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
          {keys.map((k, i) => (
            <Radar key={k} name={k} dataKey={k}
              stroke={rc[i % rc.length]} fill={i === 0 ? rc[0] : "none"} fillOpacity={i === 0 ? 0.4 : 0}
              strokeWidth={2} strokeDasharray={rd[i % rd.length]} />
          ))}
          <Legend />
          <Tooltip />
        </RadarChart>
      );
    }
    if (type === "pie") {
      const pc = colors || [ORANGE, COLORS.amber, COLORS.red, COLORS.green, COLORS.purple];
      return (
        <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={pc[i % pc.length]} />)}
          </Pie>
          <Tooltip /><Legend />
        </PieChart>
      );
    }
    return null;
  };
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">{sub}</p>
      <ResponsiveContainer width="100%" height={220}>{renderChart()}</ResponsiveContainer>
    </div>
  );
}

// ─── Left sidebar nav ─────────────────────────────────────────────────────────

const LEFT_NAV_BASE = [
  {
    id: "overview", label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: "visualization", label: "Visualization", hasChildren: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: "trends", label: "Trend Analysis",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "risk", label: "Risk Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function QIDashboardPage() {
  const [activePage, setActivePage] = useState("overview");
  const [activeChartId, setActiveChartId] = useState("pi");
  const [visExpanded, setVisExpanded] = useState(false);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [qiAggregates, setQiAggregates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getQIAggregates()
      .then(data => {
        if (cancelled) return;
        setQiAggregates(data);
        const aggs = data?.aggregates || [];
        if (aggs.length > 0) setQuarterIndex(aggs.length - 1);
      })
      .catch(err => console.warn("getQIAggregates failed:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const aggs = qiAggregates?.aggregates || [];
  const hasData = aggs.length > 0;
  const latest = hasData ? aggs[aggs.length - 1] : null;
  const dashboardData = latest ? {
    header: {
      facilityName: latest.facilityName || "",
      quarterLabels: qiAggregates.quarterLabels || [],
      residentCountForLatestQuarter: latest.totalResidents || 0,
    },
    summaryStrip: latest.summaryStrip || {},
    indicators: latest.indicators || [],
    residentsAtRisk: latest.residentsAtRisk || {},
  } : null;

  const quarters = qiAggregates?.quarterLabels || [];
  const hasQuarters = quarters.length > 0;
  const safeQI = hasQuarters ? Math.min(quarterIndex, quarters.length - 1) : 0;
  const currentQuarterLabel = hasQuarters ? quarters[safeQI] : "—";

  const effectiveTrendSeries = buildTrendSeriesFromAggregates(qiAggregates) || [];
  const chartSidebar = buildChartSidebarFromAggregates(qiAggregates);
  const sections = buildSectionsFromAggregates(qiAggregates);
  const trendDirectionCounts = buildTrendDirectionCounts(effectiveTrendSeries);
  const overviewRadar = buildOverviewRadar(qiAggregates);

  // ─── Navigation helpers ────────────────────────────────────────────────────
  const goToChartSection = (sectionId) => {
    setActivePage("visualization");
    setActiveChartId(sectionId);
    setVisExpanded(true);
  };

  const handleNavClick = (navId) => {
    if (navId === "visualization") {
      setVisExpanded(v => !v);
      if (!visExpanded) setActivePage("visualization");
    } else {
      setActivePage(navId);
      setVisExpanded(false);
    }
  };

  const handleChartSubClick = (sectionId) => {
    setActivePage("visualization");
    setActiveChartId(sectionId);
  };

  const isVisActive = activePage === "visualization";

  // ─── Sidebar ──────────────────────────────────────────────────────────────

  const sidebar = (
    <aside className="shrink-0 w-56 bg-white border border-gray-200 rounded-xl shadow-sm p-3 self-start sticky top-28">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Dashboard</p>
      <ul className="space-y-0.5">
        {LEFT_NAV_BASE.map(nav => {
          const isActive = activePage === nav.id || (nav.id === "visualization" && isVisActive);
          const children = nav.hasChildren ? chartSidebar : null;
          return (
            <li key={nav.id}>
              <button type="button" onClick={() => handleNavClick(nav.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition text-left ${isActive && !children ? "bg-primary text-white shadow-sm" : isActive && children ? "bg-orange-50 text-orange-700" : "text-gray-700 hover:bg-gray-100"}`}>
                <span className={isActive && !children ? "text-white" : "text-gray-500"}>{nav.icon}</span>
                <span className="flex-1">{nav.label}</span>
                {children && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 transition-transform ${visExpanded ? "rotate-90" : ""}`}><polyline points="9 18 15 12 9 6" /></svg>
                )}
              </button>
              {children && visExpanded && (
                <ul className="mt-0.5 ml-3 pl-3 border-l border-gray-200 space-y-0.5">
                  {children.map(sub => (
                    <li key={sub.id}>
                      <button type="button" onClick={() => handleChartSubClick(sub.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition text-left ${activePage === "visualization" && activeChartId === sub.id ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: activePage === "visualization" && activeChartId === sub.id ? "currentColor" : sub.dot }} />
                        <span className="flex-1 truncate">{sub.label}</span>
                        <span className={`shrink-0 ${activePage === "visualization" && activeChartId === sub.id ? "text-white/80" : "text-gray-400"}`}>{sub.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );

  // ─── Overview tab ─────────────────────────────────────────────────────────

  const overviewTab = (
    <div className="flex-1 min-w-0">
      {/* Risk strip */}
      {hasData && dashboardData?.residentsAtRisk?.count > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-800 flex-1">
            {dashboardData.residentsAtRisk.count} resident(s) flagged across 2 or more categories this quarter
          </span>
          <div className="flex gap-2 flex-wrap">
            {(dashboardData.residentsAtRisk.residentIds || []).slice(0, 8).map(id => (
              <span key={id} className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">{id}</span>
            ))}
          </div>
          <button type="button" onClick={() => { setActivePage("risk"); setVisExpanded(false); }} className="text-sm font-medium text-red-700 underline underline-offset-1 hover:text-red-800">
            View risk overview →
          </button>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total residents", value: hasData ? <>{dashboardData.summaryStrip?.totalResidents ?? "—"}<span className="text-sm text-gray-500 font-normal ml-1">this quarter</span></> : "—", empty: !hasData },
          { label: "Categories at risk", value: hasData ? <><span className="text-red-600">{dashboardData.summaryStrip?.categoriesAtRiskCount ?? 0}</span><span className="text-sm text-gray-500 font-normal ml-1">of {dashboardData.summaryStrip?.categoriesAtRiskOf ?? 14} red</span></> : "—", empty: !hasData },
          { label: "Last submission", value: hasData ? <>{dashboardData.summaryStrip?.lastSubmissionDate ?? "—"}<span className="text-sm text-gray-500 font-normal ml-1">{currentQuarterLabel !== "—" ? currentQuarterLabel : ""}</span></> : "—", empty: !hasData },
        ].map(({ label, value, empty }) => (
          <div key={label} className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-2xl font-semibold ${empty ? "text-gray-400" : "text-gray-900"}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Overview visualizations */}
      {hasData && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Facility Performance Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* All category rates bar chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">All Category Rates</h3>
              <p className="text-xs text-gray-500 mb-3">Latest prevalence/score across all 14 QI categories</p>
              <ResponsiveContainer width="100%" height={260}>
                {(() => { const rates = buildOverviewFromAggregates(qiAggregates) || []; return (
                  <BarChart data={rates} margin={{ top: 5, right: 5, left: 5, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <Tooltip />
                    <Bar dataKey="rate" name="Rate" radius={4}>
                      {rates.map((entry, i) => (
                        <Cell key={i} fill={entry.status === "red" ? "#d85a30" : entry.status === "amber" ? "#c27700" : "#f97316"} />
                      ))}
                    </Bar>
                  </BarChart>
                ); })()}
              </ResponsiveContainer>
            </div>
            {/* Radar — facility vs national */}
            {overviewRadar.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Key Indicators — Facility vs National</h3>
                <p className="text-xs text-gray-500 mb-3">Prevalence rates compared to AIHW national medians</p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={overviewRadar} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 25]} tick={{ fontSize: 9 }} />
                    <Radar name="Facility" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.35} strokeWidth={2} />
                    <Radar name="National" dataKey="benchmark" stroke="#9ca3af" fill="none" fillOpacity={0} strokeWidth={2} strokeDasharray="5 3" />
                    <Legend /><Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status distribution donut */}
            {(() => { const sd = buildStatusDistFromAggregates(qiAggregates); return sd && sd.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Indicator Status Distribution</h3>
                <p className="text-xs text-gray-500 mb-3">How many categories are on track, monitoring, or above threshold</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={sd} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {sd.map((_, i) => <Cell key={i} fill={STATUS_DIST_COLORS[i]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null; })()}
            {/* Trend direction summary */}
            {trendDirectionCounts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Trend Direction Summary</h3>
                <p className="text-xs text-gray-500 mb-3">Number of indicators improving, stable, or worsening over {quarters.length} quarters</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendDirectionCounts} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Indicators" radius={6}>
                      {trendDirectionCounts.map((_, i) => <Cell key={i} fill={TREND_DIR_COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload banner (no data state) */}
      {!hasData && !loading && (
        <div className="mb-6 bg-white rounded-2xl border-2 border-dashed border-gray-300 p-8 flex flex-wrap items-center gap-6 hover:border-orange-400 transition">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 mb-1">No QI data loaded yet</h3>
            <p className="text-sm text-gray-600">Upload your quarterly CSV export to populate all 14 indicators.</p>
          </div>
          <Link to="/upload-csv" className="shrink-0 w-full sm:w-auto bg-primary text-white py-2.5 px-5 rounded-md font-medium hover:bg-orange-600 transition text-center">
            Go to Data entry →
          </Link>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mb-6 text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Loading QI data...</p>
        </div>
      )}

      {/* Quarter selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {hasData ? "Quality indicators" : "Quality indicators — awaiting data"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
            {hasData ? `ACFI registered · ${dashboardData?.header?.residentCountForLatestQuarter ?? ""} residents` : loading ? "Loading…" : "No data loaded"}
          </span>
          {hasQuarters && (
            <div className="flex items-center gap-2">
              <button type="button" className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition disabled:opacity-50" onClick={() => setQuarterIndex(i => Math.max(0, i - 1))} disabled={safeQI <= 0}>‹</button>
              <span className="text-sm font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg min-w-[88px] text-center">{currentQuarterLabel}</span>
              <button type="button" className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition disabled:opacity-50" onClick={() => setQuarterIndex(i => Math.min(quarters.length - 1, i + 1))} disabled={safeQI >= quarters.length - 1}>›</button>
            </div>
          )}
        </div>
      </div>

      {/* Indicator cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasData
          ? (dashboardData?.indicators ?? []).map((ind, i) => {
              const ratePerQ = ind.ratePerQuarter ?? [];
              const rateForQ = ratePerQ.length > 0 ? (ratePerQ[safeQI] ?? ratePerQ[ratePerQ.length - 1]) : null;
              const valDisp = ind.valueDisplay ?? "—";
              const isPct = String(valDisp).endsWith("%");
              let displayRate = rateForQ != null && typeof rateForQ === "number" ? `${Number(rateForQ).toFixed(2)}${isPct ? "%" : ""}` : (valDisp ?? "—");
              const isNoData = rateForQ == null || valDisp === "N/A";
              if (isNoData) displayRate = "N/A";
              let status = ind.status || "grey";
              if (displayRate === "N/A") status = "nodata";
              const trend = displayRate === "N/A" ? null : (ind.trendArrow ?? null);
              const spark = displayRate === "N/A" ? [] : ratePerQ.filter(v => v != null).map(Number);
              const showAsND = displayRate === "N/A";
              const secId = ind.id ? (DASHBOARD_TO_REPORTS_SECTION[ind.id] ?? REPORTS_SECTION_IDS[i]) : REPORTS_SECTION_IDS[i];
              return (
                <button key={ind.id ?? i} type="button" onClick={() => goToChartSection(secId)}
                  className="block text-left bg-white rounded-2xl shadow border border-gray-200 p-4 relative overflow-hidden animate-[fadeIn_0.3s_ease_both] hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                  style={{ animationDelay: `${0.03 * (i + 1)}s` }}>
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${status === "green" ? "bg-primary" : status === "amber" ? "bg-amber-600" : status === "red" ? "bg-red-500" : "bg-gray-300"}`} />
                  <div className={`text-sm font-semibold mb-2 min-h-[2rem] ${showAsND ? "text-gray-500" : "text-gray-800"}`}>{ind.name}</div>
                  <div className={`text-xl font-semibold mb-0.5 ${showAsND ? "text-gray-400" : "text-gray-900"}`}>{displayRate}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{showAsND ? "no data" : "prevalence rate"}</div>
                  <div className="h-7 mb-2"><SparklineSVG data={spark} status={status} /></div>
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    {trend ? <span className={`text-xs font-medium ${trend === "up" ? "text-red-600" : trend === "down" ? "text-green-600" : "text-gray-500"}`}>{TREND_LABEL[trend] ?? "→ Stable"}</span> : <span className="text-xs text-gray-400">— No data</span>}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${status === "green" ? "bg-orange-50 text-orange-800" : status === "amber" ? "bg-amber-50 text-amber-800" : status === "red" ? "bg-red-50 text-red-800" : "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[status] ?? STATUS_LABEL.nodata}
                    </span>
                  </div>
                </button>
              );
            })
          : INDICATORS_EMPTY.map((name, i) => (
              <button key={name} type="button" onClick={() => goToChartSection(REPORTS_SECTION_IDS[i] ?? "pi")}
                className="block text-left bg-white rounded-2xl shadow border border-gray-200 p-4 relative overflow-hidden animate-[fadeIn_0.3s_ease_both] hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                style={{ animationDelay: `${0.02 * (i + 1)}s` }}>
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gray-200" />
                <div className="text-sm font-semibold text-gray-500 mb-2 min-h-[2rem]">{name}</div>
                <div className="text-xl font-semibold text-gray-300 mb-0.5">—</div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">no data</div>
                <div className="h-7 mb-2 bg-gray-100 rounded overflow-hidden relative qi-shimmer" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">— awaiting upload</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase bg-gray-100 text-gray-400">No data</span>
                </div>
              </button>
            ))}
      </div>
    </div>
  );

  // ─── Visualization tab ──────────────────────────────────────────────────────

  const activeSection = sections.find(s => s.id === activeChartId) || sections[0];

  const visualizationTab = activeSection ? (
    <div className="flex-1 min-w-0 bg-white rounded-2xl shadow p-8 border border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900"><strong>{activeSection.title}</strong></h2>
          <p className="text-sm text-gray-500 mt-1">{activeSection.subtitle}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${activeSection.badge === "red" ? "bg-red-100 text-red-800" : activeSection.badge === "amber" ? "bg-amber-100 text-amber-800" : activeSection.badge === "green" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
          {activeSection.badgeLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {activeSection.stats.map(stat => (
          <div key={stat.label} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{stat.label}</div>
            <div className={`text-xl font-semibold ${stat.status === "red" ? "text-red-600" : stat.status === "amber" ? "text-amber-700" : "text-gray-900"}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.change}</div>
          </div>
        ))}
      </div>
      <div className={`grid gap-4 ${activeSection.charts.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {activeSection.charts.map((ch, i) => <ChartCard key={i} chart={ch} />)}
      </div>
      <div className="mt-6 text-center">
        <Link to="/reports" className="text-sm text-primary font-medium hover:underline">View detailed breakdown in Reports →</Link>
      </div>
    </div>
  ) : (
    <div className="flex-1 min-w-0 bg-white rounded-2xl shadow p-8 border border-gray-200 text-center">
      <p className="text-gray-500">No visualization data available. Upload QI data to see charts.</p>
      <Link to="/upload-csv" className="text-primary font-medium text-sm hover:underline mt-2 inline-block">Go to Data entry →</Link>
    </div>
  );

  // ─── Trend Analysis tab ─────────────────────────────────────────────────────

  const trendsTab = effectiveTrendSeries.length > 0 ? (
    <div className="flex-1 min-w-0">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900"><strong>Trend Analysis</strong></h2>
        <p className="text-sm text-gray-500 mt-1">Comprehensive QI trend analysis across {quarters.length} assessment dates</p>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Quarterly Change Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-3 py-2 font-semibold text-gray-700">Indicator</th>
                <th className="px-3 py-2 font-semibold text-gray-700 text-right">First</th>
                <th className="px-3 py-2 font-semibold text-gray-700 text-right">Latest</th>
                <th className="px-3 py-2 font-semibold text-gray-700 text-right">Change</th>
                <th className="px-3 py-2 font-semibold text-gray-700 text-right">% Change</th>
                <th className="px-3 py-2 font-semibold text-gray-700 text-center">Direction</th>
                <th className="px-3 py-2 font-semibold text-gray-700 text-center">Volatility</th>
              </tr>
            </thead>
            <tbody>
              {effectiveTrendSeries.map(ts => {
                const first = ts.data[0]?.value;
                const last = ts.data[ts.data.length - 1]?.value;
                const delta = last - first;
                const pctChange = first !== 0 ? ((delta / first) * 100).toFixed(1) : "N/A";
                const improving = ts.lob ? delta < 0 : delta > 0;
                const vals = ts.data.map(d => d.value);
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                const volatility = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length).toFixed(2);
                return (
                  <tr key={ts.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{ts.name}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{first}{ts.unit}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{last}{ts.unit}</td>
                    <td className={`px-3 py-2 text-right font-medium ${improving ? "text-green-600" : "text-red-600"}`}>{delta > 0 ? "+" : ""}{delta.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${improving ? "text-green-600" : "text-red-600"}`}>{pctChange !== "N/A" ? (delta > 0 ? "+" : "") + pctChange + "%" : "N/A"}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${improving ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{improving ? "↓ Improving" : "↑ Worsening"}</span></td>
                    <td className="px-3 py-2 text-center text-gray-500">{volatility}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate of change bar chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Rate of Change — All Indicators</h3>
        <p className="text-sm text-gray-500 mb-4">Absolute change across assessment period. Green = improving, red = worsening.</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={effectiveTrendSeries.map(ts => {
            const delta = ts.data[ts.data.length - 1].value - ts.data[0].value;
            return { name: ts.name.length > 16 ? ts.name.slice(0, 15) + "…" : ts.name, change: Number(delta.toFixed(2)), improving: ts.lob ? delta < 0 : delta > 0 };
          })} margin={{ top: 5, right: 5, left: 5, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
            <Tooltip />
            <Bar dataKey="change" name="Change" radius={4}>
              {effectiveTrendSeries.map((ts, i) => {
                const delta = ts.data[ts.data.length - 1].value - ts.data[0].value;
                return <Cell key={i} fill={(ts.lob ? delta < 0 : delta > 0) ? "#16a34a" : "#dc2626"} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column: Improving vs Worsening */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-base font-semibold text-green-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />Improving Indicators
          </h3>
          <div className="space-y-4">
            {effectiveTrendSeries.filter(ts => { const d = ts.data[ts.data.length - 1].value - ts.data[0].value; return ts.lob ? d < 0 : d > 0; }).map(ts => {
              const first = ts.data[0].value; const last = ts.data[ts.data.length - 1].value; const delta = last - first;
              const vals = ts.data.map(d => d.value); const min = Math.min(...vals); const max = Math.max(...vals);
              return (
                <div key={ts.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-800">{ts.name}</h4>
                    <span className="text-xs font-medium text-green-600">↓ {Math.abs(delta).toFixed(2)}{ts.unit}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mb-2">
                    <span>Min: {min}{ts.unit}</span><span>Max: {max}{ts.unit}</span><span>{ts.lob ? "Lower is better" : "Higher is better"}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={ts.data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#d1d5db" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#d1d5db" width={30} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} name={ts.unit} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />Worsening / Stable
          </h3>
          <div className="space-y-4">
            {effectiveTrendSeries.filter(ts => { const d = ts.data[ts.data.length - 1].value - ts.data[0].value; return ts.lob ? d >= 0 : d <= 0; }).map(ts => {
              const first = ts.data[0].value; const last = ts.data[ts.data.length - 1].value; const delta = last - first;
              const vals = ts.data.map(d => d.value); const min = Math.min(...vals); const max = Math.max(...vals);
              return (
                <div key={ts.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-800">{ts.name}</h4>
                    <span className="text-xs font-medium text-red-600">↑ {Math.abs(delta).toFixed(2)}{ts.unit}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mb-2">
                    <span>Min: {min}{ts.unit}</span><span>Max: {max}{ts.unit}</span><span>{ts.lob ? "Lower is better" : "Higher is better"}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={ts.data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#d1d5db" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#d1d5db" width={30} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="value" stroke="#d85a30" strokeWidth={2} dot={{ r: 3, fill: "#d85a30" }} name={ts.unit} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* All trends grid */}
      <h3 className="text-base font-semibold text-gray-900 mb-3">Individual Indicator Trends</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {effectiveTrendSeries.map(ts => {
          const first = ts.data[0]?.value;
          const last = ts.data[ts.data.length - 1]?.value;
          const delta = last != null && first != null ? last - first : null;
          const improving = ts.lob ? delta < 0 : delta > 0;
          const trendCls = delta === null ? "text-gray-400" : improving ? "text-green-600" : "text-red-600";
          const trendSymbol = delta === null ? "—" : improving ? "↓ Improving" : "↑ Worsening";
          const vals = ts.data.map(d => d.value);
          const min = Math.min(...vals); const max = Math.max(...vals);
          return (
            <div key={ts.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-800">{ts.name}</h3>
                <span className={`text-xs font-medium ${trendCls}`}>{trendSymbol}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">{ts.lob ? "Lower is better" : "Higher is better"} · Unit: {ts.unit}</p>
              <div className="flex gap-3 text-xs text-gray-400 mb-2">
                <span>Range: {min}–{max}</span>
                <span>Δ: {delta != null ? (delta > 0 ? "+" : "") + delta.toFixed(2) : "—"}</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={ts.data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#d1d5db" width={32} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" stroke={improving ? "#f97316" : "#d85a30"} strokeWidth={2} dot={{ r: 3 }} name={ts.unit} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  ) : (
    <div className="flex-1 min-w-0 text-center py-12">
      <p className="text-gray-500">No trend data available. Upload QI data to see trend analysis.</p>
      <Link to="/upload-csv" className="text-primary font-medium text-sm hover:underline mt-2 inline-block">Go to Data entry →</Link>
    </div>
  );

  // ─── Risk Overview tab ──────────────────────────────────────────────────────

  const riskTab = (
    <div className="flex-1 min-w-0">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900"><strong>Risk Overview</strong></h2>
        <p className="text-sm text-gray-500 mt-1">Residents flagged across multiple QI categories</p>
      </div>
      {hasData && dashboardData?.residentsAtRisk?.count > 0 ? (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">At-risk residents</div>
              <div className="text-2xl font-semibold text-red-600">{dashboardData.residentsAtRisk.count}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total residents</div>
              <div className="text-2xl font-semibold text-gray-900">{dashboardData.summaryStrip?.totalResidents ?? "—"}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">At-risk rate</div>
              <div className="text-2xl font-semibold text-amber-600">
                {dashboardData.summaryStrip?.totalResidents ? ((dashboardData.residentsAtRisk.count / dashboardData.summaryStrip.totalResidents) * 100).toFixed(1) : "—"}%
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Residents flagged across 2+ categories</h3>
            <div className="flex flex-wrap gap-2">
              {(dashboardData.residentsAtRisk.residentIds || []).map(id => (
                <span key={id} className="text-sm font-medium bg-red-50 text-red-800 border border-red-200 px-3 py-1.5 rounded-lg">{id}</span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">View detailed per-indicator breakdown in <Link to="/reports" className="text-primary font-medium hover:underline">QI Reports</Link>.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500 text-sm">{hasData ? "No residents currently flagged across multiple categories." : "No risk data available. Upload QI data to see the resident risk overview."}</p>
          {!hasData && <Link to="/upload-csv" className="text-primary font-medium text-sm hover:underline mt-2 inline-block">Go to Data entry →</Link>}
        </div>
      )}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-6 max-w-[1440px] mx-auto gap-5 w-full">
        {sidebar}
        {activePage === "overview" && overviewTab}
        {activePage === "visualization" && visualizationTab}
        {activePage === "trends" && trendsTab}
        {activePage === "risk" && riskTab}
      </main>
      <Footer />
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .qi-shimmer::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent);animation:qi-shimmer 1.6s infinite}
        @keyframes qi-shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
      `}</style>
    </div>
  );
}
