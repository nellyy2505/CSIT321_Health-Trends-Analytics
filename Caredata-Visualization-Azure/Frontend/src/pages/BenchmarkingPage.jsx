import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { getQIAggregates } from "../services/api";
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { STATUS, CHART_PALETTE, CHART_GRID, axisTickStyle, tooltipStyle, legendStyle } from "../theme/chartTokens";

// AIHW published national medians, these don't change with uploads
const NATIONAL_MEDIANS = [
  { id: "pi",              name: "Pressure injuries",     nat: 10.2, lib: true,  unit: "%",   convert: null },
  { id: "falls",           name: "Falls & major injury",  nat: 8.3,  lib: true,  unit: "%",   convert: null },
  { id: "uwl",             name: "Unplanned weight loss", nat: 5.1,  lib: true,  unit: "%",   convert: null },
  { id: "meds",            name: "Medications (poly)",    nat: 19.8, lib: true,  unit: "%",   convert: null },
  { id: "adl",             name: "ADL decline",           nat: 20.1, lib: true,  unit: "%",   convert: null },
  { id: "incontinence",    name: "Incontinence (IAD)",    nat: 6.9,  lib: true,  unit: "%",   convert: null },
  { id: "rp",              name: "Restrictive practices", nat: 7.8,  lib: true,  unit: "%",   convert: null },
  { id: "hosp",            name: "Hospitalisation",       nat: 11.0, lib: true,  unit: "%",   convert: null },
  { id: "allied_health",   name: "Allied health gap",     nat: 34.0, lib: true,  unit: "%",   convert: null },
  { id: "consumer_exp",    name: "Consumer experience",   nat: 75,   lib: false, unit: "%",   convert: "score24_to_pct" },
  { id: "qol",             name: "Quality of life",       nat: 66,   lib: false, unit: "%",   convert: "score24_to_pct" },
  { id: "workforce",       name: "Workforce adequacy",    nat: 90,   lib: false, unit: "%",   convert: null },
  { id: "enrolled_nursing", name: "Enrolled nursing",     nat: 91,   lib: false, unit: "%",   convert: null },
  { id: "lifestyle",       name: "Lifestyle sessions",    nat: 2.1,  lib: false, unit: "avg", convert: null },
];


function convertFacilityRate(indicator, natEntry) {
  if (indicator.currentRate == null) return null;
  const rate = indicator.currentRate;
  if (natEntry.convert === "score24_to_pct" && indicator.valueDisplay?.includes("/24")) {
    return Math.round((rate / 24) * 100 * 10) / 10;
  }
  return Math.round(rate * 10) / 10;
}

function buildIndicators(indicators) {
  return NATIONAL_MEDIANS.map((natEntry) => {
    const csvInd = indicators?.find((i) => i.id === natEntry.id);
    let fac = null;
    if (csvInd) {
      fac = convertFacilityRate(csvInd, natEntry);
    }
    return { ...natEntry, fac: fac ?? 0, noFacData: fac == null };
  });
}

function getStatus(ind) {
  const worse = ind.lib ? ind.fac > ind.nat : ind.fac < ind.nat;
  const diff = Math.abs(ind.fac - ind.nat);
  if (diff < 0.5) return "amber";
  return worse ? "red" : "green";
}

function getPercentile(ind) {
  const worse = ind.lib ? ind.fac > ind.nat : ind.fac < ind.nat;
  const diff = ind.nat ? Math.abs(ind.fac - ind.nat) / ind.nat : 0;
  if (diff < 0.03) return { label: "~50th", cls: "amber" };
  if (worse) return diff > 0.1 ? { label: "75th+", cls: "red" } : { label: "60th", cls: "amber" };
  return diff > 0.1 ? { label: "25th", cls: "green" } : { label: "40th", cls: "green" };
}

function computeSummary(indicators) {
  let above = 0, below = 0, atMedian = 0;
  indicators.forEach((ind) => {
    const s = getStatus(ind);
    if (s === "red") above++;
    else if (s === "green") below++;
    else atMedian++;
  });
  const betterRatio = below / indicators.length;
  const percentile = Math.round(50 - (betterRatio - 0.5) * 40);
  return { above, below, atMedian, percentile: Math.max(1, Math.min(99, percentile)) };
}

function buildDiffData(indicators) {
  return indicators.map((i) => {
    const d = i.lib ? i.fac - i.nat : i.nat - i.fac;
    return { name: i.name.length > 18 ? i.name.slice(0, 18) + "…" : i.name, diff: Math.round(d * 10) / 10 };
  });
}

function buildPercentileTrend(aggregates, quarterLabels) {
  if (!quarterLabels.length) return [];
  return quarterLabels.map((q, qi) => {
    let aboveCount = 0;
    const agg = aggregates[qi];
    const aggIndicators = agg?.indicators || [];
    NATIONAL_MEDIANS.forEach((natEntry) => {
      const csvInd = aggIndicators.find((a) => a.id === natEntry.id);
      const rate = csvInd?.ratePerQuarter?.[qi] ?? csvInd?.currentRate;
      if (rate == null) return;
      let facRate = rate;
      if (natEntry.convert === "score24_to_pct") facRate = (rate / 24) * 100;
      const worse = natEntry.lib ? facRate > natEntry.nat : facRate < natEntry.nat;
      if (worse) aboveCount++;
    });
    const ratio = aboveCount / NATIONAL_MEDIANS.length;
    return { name: q, facility: Math.round(50 + ratio * 30), national: 50 };
  });
}

export default function BenchmarkingPage() {
  const [peerGroup, setPeerGroup] = useState("All facilities");
  const [sizeFilter, setSizeFilter] = useState("All sizes");
  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState([]);
  const [quarterLabels, setQuarterLabels] = useState([]);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [latestIndicators, setLatestIndicators] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await getQIAggregates();
        if (cancelled) return;
        const aggs = resp?.aggregates || [];
        const labels = resp?.quarterLabels || [];
        setAggregates(aggs);
        setQuarterLabels(labels);
        if (aggs.length) {
          setQuarterIndex(aggs.length - 1);
          setLatestIndicators(aggs[aggs.length - 1]?.indicators || []);
        }
      } catch (err) {
        console.warn("Benchmarking: failed to load QI aggregates", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!aggregates.length) return;
    const agg = aggregates[Math.min(quarterIndex, aggregates.length - 1)];
    if (agg?.indicators) {
      setLatestIndicators(agg.indicators);
    }
  }, [quarterIndex, aggregates]);

  const hasRealData = latestIndicators.length > 0;
  const indicators = buildIndicators(hasRealData ? latestIndicators : null);
  const currentQuarterLabel = quarterLabels.length > 0 ? quarterLabels[Math.min(quarterIndex, quarterLabels.length - 1)] : "—";
  const summary = computeSummary(indicators);
  const diffData = buildDiffData(indicators);
  const percentileTrend = hasRealData
    ? buildPercentileTrend(aggregates, quarterLabels)
    : [];

  const maxVal = Math.max(...indicators.map((i) => Math.max(i.fac, i.nat)), 1);
  const scale = 100 / (maxVal * 1.1);

  const statusColor = (s) =>
    s === "red" ? "var(--clay-ink)" : s === "amber" ? "var(--amber)" : "var(--sage-ink)";
  const statusFill = (s) =>
    s === "red" ? "var(--clay)" : s === "amber" ? "var(--amber)" : "var(--sage)";

  const pillBtn = (active) => ({
    fontSize: 13,
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--ink-900)" : "var(--line)"}`,
    background: active ? "var(--ink-900)" : "var(--bg-white)",
    color: active ? "var(--bg-white)" : "var(--ink-700)",
    fontWeight: active ? 500 : 400,
    cursor: "pointer",
    transition: "all .15s ease",
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />

      <main className="flex-grow pt-28 pb-12 px-4 sm:px-8 max-w-[1280px] mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
              <span className="dot" /> Benchmarking
            </span>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 36,
                letterSpacing: "-0.01em",
                color: "var(--ink-900)",
                lineHeight: 1.1,
                marginTop: 6,
              }}
            >
              Facility vs national
            </h1>
            <p style={{ color: "var(--ink-500)", fontSize: 14, marginTop: 6 }}>
              Facility rates compared against AIHW published national medians
              {currentQuarterLabel !== "—" ? ` · ${currentQuarterLabel}` : ""}
            </p>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
            Source: AIHW QI Program Report 2024
          </div>
        </div>

        {!loading && !hasRealData && (
          <div
            className="mb-5 p-4 text-sm"
            style={{
              background: "var(--bg-clay-tint)",
              borderLeft: "3px solid var(--clay-ink)",
              borderRadius: 10,
              color: "var(--ink-700)",
            }}
          >
            No QI data uploaded yet.{" "}
            <Link
              to="/upload-csv"
              className="font-medium hover:underline"
              style={{ color: "var(--sage-ink)" }}
            >
              Upload a CSV
            </Link>{" "}
            to see your facility's benchmarking data against national medians.
          </div>
        )}

        {loading && (
          <div className="text-center py-12" style={{ color: "var(--ink-500)" }}>
            <div
              className="inline-block w-8 h-8 rounded-full animate-spin mb-3"
              style={{ border: "3px solid var(--line)", borderTopColor: "var(--sage-ink)" }}
            />
            <p className="text-sm">Loading benchmarking data...</p>
          </div>
        )}

        <div
          className="flex flex-wrap items-center gap-2 py-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <span className="text-sm mr-1" style={{ color: "var(--ink-500)" }}>Peer group:</span>
          {["All facilities", "Metro", "Regional", "Rural"].map((opt) => (
            <button key={opt} type="button" onClick={() => setPeerGroup(opt)} style={pillBtn(peerGroup === opt)}>
              {opt}
            </button>
          ))}
          <span className="w-px h-5 mx-2" style={{ background: "var(--line)" }} />
          <span className="text-sm mr-1" style={{ color: "var(--ink-500)" }}>Size:</span>
          {["All sizes", "< 60 beds", "60–120 beds", "> 120 beds"].map((opt) => (
            <button key={opt} type="button" onClick={() => setSizeFilter(opt)} style={pillBtn(sizeFilter === opt)}>
              {opt}
            </button>
          ))}
          {quarterLabels.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center transition disabled:opacity-40"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--bg-white)",
                  color: "var(--ink-700)",
                  borderRadius: 10,
                }}
                onClick={() => setQuarterIndex((i) => Math.max(0, i - 1))}
                disabled={quarterIndex <= 0}
              >
                {"‹"}
              </button>
              <span
                className="text-sm font-medium px-3 py-1.5 min-w-[100px] text-center"
                style={{
                  color: "var(--ink-900)",
                  background: "var(--bg-white)",
                  border: "1px solid var(--line)",
                  borderRadius: 999,
                }}
              >
                {currentQuarterLabel}
              </span>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center transition disabled:opacity-40"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--bg-white)",
                  color: "var(--ink-700)",
                  borderRadius: 10,
                }}
                onClick={() => setQuarterIndex((i) => Math.min(quarterLabels.length - 1, i + 1))}
                disabled={quarterIndex >= quarterLabels.length - 1}
              >
                {"›"}
              </button>
            </div>
          )}
          {quarterLabels.length === 0 && !loading && (
            <span
              className="ml-auto text-sm font-medium px-3 py-1.5"
              style={{
                color: "var(--ink-500)",
                background: "var(--bg-white)",
                border: "1px solid var(--line)",
                borderRadius: 999,
              }}
            >
              Sample data
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 mt-6">
          {[
            { label: "Above national median", value: summary.above, tone: "red", note: "of 14 indicators" },
            { label: "Below national median", value: summary.below, tone: "green", note: "performing better" },
            { label: "At national median", value: summary.atMedian, tone: "amber", note: "within ±0.5%" },
            { label: "Facility percentile", value: `${summary.percentile}nd`, tone: "amber", note: "overall ranking" },
          ].map((item) => (
            <div key={item.label} className="cd-kpi p-5">
              <div
                className="uppercase tracking-wider mb-1"
                style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-500)" }}
              >
                {item.label}
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: statusColor(item.tone) }}>
                {item.value}
              </div>
              <div className="text-sm mt-1" style={{ color: "var(--ink-500)" }}>{item.note}</div>
            </div>
          ))}
        </div>

        <div className="cd-surface p-6 mb-8">
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 22,
              color: "var(--ink-900)",
              marginBottom: 4,
            }}
          >
            Facility vs national median, all 14 indicators
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--ink-500)" }}>
            Each bar shows your facility rate (coloured) vs national median (muted). Clay = above national median (worse). Sage = below (better).
          </p>

          <div className="flex flex-wrap gap-6 mb-4">
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-700)" }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: "var(--clay)" }} />
              Facility, above national (worse)
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-700)" }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: "var(--sage)" }} />
              Facility, below national (better)
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-700)" }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: "var(--line-strong)", opacity: 0.7 }} />
              National median
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-700)" }}>
              <span className="w-0.5 h-3 rounded-full" style={{ background: "var(--ink-500)", opacity: 0.6 }} />
              Median marker
            </div>
          </div>

          <div
            className="grid grid-cols-[minmax(140px,180px)_1fr_70px_70px_70px] gap-2 sm:gap-3 px-2 py-1 mb-1 uppercase tracking-wider min-w-[600px]"
            style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-500)" }}
          >
            <div>Indicator</div>
            <div>Rate comparison</div>
            <div className="text-right">Facility</div>
            <div className="text-right">National</div>
            <div className="text-right">Percentile</div>
          </div>

          <div className="space-y-2 overflow-x-auto">
            {indicators.map((ind) => {
              const status = getStatus(ind);
              const pct = getPercentile(ind);
              const facW = Math.min(100, ind.fac * scale);
              const natW = Math.min(100, ind.nat * scale);
              const medPos = Math.min(100, ind.nat * scale);
              return (
                <div
                  key={ind.name}
                  className="grid grid-cols-[minmax(140px,180px)_1fr_70px_70px_70px] gap-2 sm:gap-3 items-center py-2.5 px-3 min-w-[600px]"
                  style={{
                    background: "var(--bg-paper)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 10,
                  }}
                >
                  <div className="text-sm font-medium truncate" style={{ color: "var(--ink-900)" }}>
                    {ind.name}
                  </div>
                  <div
                    className="relative h-5 rounded overflow-visible"
                    style={{ background: "var(--bg-cream)" }}
                  >
                    <div
                      className="absolute inset-y-1 left-0 rounded transition-all"
                      style={{ width: `${natW}%`, background: "var(--line-strong)", opacity: 0.55 }}
                    />
                    <div
                      className="absolute inset-y-1 left-0 rounded transition-all"
                      style={{ width: `${facW}%`, background: statusFill(status), opacity: 0.95 }}
                    />
                    <div
                      className="absolute top-0 w-0.5 h-5 rounded-full"
                      style={{ left: `${medPos}%`, background: "var(--ink-500)", opacity: 0.5 }}
                    />
                  </div>
                  <div
                    className="text-sm font-medium text-right"
                    style={{ color: ind.noFacData ? "var(--ink-500)" : statusColor(status) }}
                  >
                    {ind.noFacData ? "—" : `${ind.fac}${ind.unit}`}
                  </div>
                  <div className="text-sm text-right" style={{ color: "var(--ink-500)" }}>
                    {ind.nat}
                    {ind.unit}
                  </div>
                  <div className="text-xs font-semibold text-right" style={{ color: statusColor(pct.cls) }}>
                    {pct.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex items-start gap-2 mt-4 p-3 text-xs"
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: 10,
              color: "var(--ink-500)",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              National medians sourced from AIHW QI Program national report. Lower rates are better for most indicators. Consumer experience, Quality of life, Workforce and Enrolled nursing are scored higher = better.
              {hasRealData
                ? " Facility rates computed from your uploaded QI data."
                : " Upload a CSV to see your facility rates compared against national medians."}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="cd-surface p-6">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18,
                color: "var(--ink-900)",
                marginBottom: 4,
              }}
            >
              Facility percentile trend
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--ink-500)" }}>
              Overall ranking vs national peer group
              {quarterLabels.length > 0 ? `,${quarterLabels.length} quarters` : ""}
            </p>
            {percentileTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={percentileTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="name" tick={axisTickStyle} stroke={CHART_GRID} />
                  <YAxis domain={[30, 80]} tick={axisTickStyle} stroke={CHART_GRID} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Line
                    type="monotone"
                    dataKey="facility"
                    stroke={CHART_PALETTE[0]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_PALETTE[0] }}
                    name="Facility percentile"
                  />
                  <Line
                    type="monotone"
                    dataKey="national"
                    stroke={CHART_PALETTE[3]}
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                    name="National median (50th)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: "var(--ink-500)" }}>
                Upload QI data to see percentile trend
              </div>
            )}
          </div>
          <div className="cd-surface p-6">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18,
                color: "var(--ink-900)",
                marginBottom: 4,
              }}
            >
              Above / below national by indicator
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--ink-500)" }}>
              Difference from national median, positive = worse than national
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={diffData} margin={{ top: 5, right: 5, left: 5, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="name"
                  tick={axisTickStyle}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  stroke={CHART_GRID}
                />
                <YAxis tick={axisTickStyle} stroke={CHART_GRID} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="diff" name="Diff from national (%)" radius={4}>
                  {diffData.map((entry, index) => (
                    <Cell key={index} fill={entry.diff > 0 ? STATUS.bad : STATUS.good} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
