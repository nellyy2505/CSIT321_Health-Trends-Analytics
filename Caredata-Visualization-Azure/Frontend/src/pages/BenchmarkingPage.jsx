import { useState } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const Q = ["Q1 23", "Q2 23", "Q3 23", "Q4 23", "Q1 24", "Q2 24", "Q3 24", "Q4 24"];

// From HTML: name, facility rate, national median, lowerIsBetter, unit
const INDICATORS = [
  { name: "Pressure injuries", fac: 12.4, nat: 10.2, lib: true, unit: "%" },
  { name: "Falls & major injury", fac: 8.1, nat: 8.3, lib: true, unit: "%" },
  { name: "Unplanned weight loss", fac: 4.2, nat: 5.1, lib: true, unit: "%" },
  { name: "Medications (poly)", fac: 22.0, nat: 19.8, lib: true, unit: "%" },
  { name: "ADL decline", fac: 18.3, nat: 20.1, lib: true, unit: "%" },
  { name: "Incontinence (IAD)", fac: 6.7, nat: 6.9, lib: true, unit: "%" },
  { name: "Restrictive practices", fac: 9.5, nat: 7.8, lib: true, unit: "%" },
  { name: "Hospitalisation", fac: 11.2, nat: 11.0, lib: true, unit: "%" },
  { name: "Allied health gap", fac: 31.3, nat: 34.0, lib: true, unit: "%" },
  { name: "Consumer experience", fac: 78, nat: 75, lib: false, unit: "%" },
  { name: "Quality of life", fac: 64, nat: 66, lib: false, unit: "%" },
  { name: "Workforce adequacy", fac: 92, nat: 90, lib: false, unit: "%" },
  { name: "Enrolled nursing", fac: 88, nat: 91, lib: false, unit: "%" },
  { name: "Lifestyle sessions", fac: 2.4, nat: 2.1, lib: false, unit: "avg" },
];

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

const PERCENTILE_TREND_DATA = Q.map((q, i) => ({
  name: q,
  facility: [58, 56, 55, 54, 54, 53, 52, 52][i],
  national: 50,
}));

const DIFF_DATA = INDICATORS.map((i) => {
  const d = i.lib ? i.fac - i.nat : i.nat - i.fac;
  return { name: i.name.length > 18 ? i.name.slice(0, 18) + "…" : i.name, diff: Math.round(d * 10) / 10 };
});

export default function BenchmarkingPage() {
  const [quarter, setQuarter] = useState("Q3 2024");
  const [peerGroup, setPeerGroup] = useState("All facilities");
  const [sizeFilter, setSizeFilter] = useState("All sizes");

  const maxVal = Math.max(...INDICATORS.map((i) => Math.max(i.fac, i.nat)), 1);
  const scale = 100 / (maxVal * 1.1);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto w-full">
        {/* Page header — same as Reports */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">
              <span className="font-bold">Benchmarking</span> — Sunrise Aged Care vs national
            </h1>
            <p className="text-base text-gray-500">
              Facility rates compared against AIHW published national medians · Q3 2024
            </p>
          </div>
          <div className="text-sm text-gray-400">Source: AIHW QI Program Report 2024</div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 py-4 border-b border-gray-200">
          <span className="text-sm text-gray-500 mr-1">Peer group:</span>
          {["All facilities", "Metro", "Regional", "Rural"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPeerGroup(opt)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                peerGroup === opt
                  ? "bg-gray-900 text-primary border-gray-900 font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}
            >
              {opt}
            </button>
          ))}
          <span className="w-px h-5 bg-gray-200 mx-2" />
          <span className="text-sm text-gray-500 mr-1">Size:</span>
          {["All sizes", "< 60 beds", "60–120 beds", "> 120 beds"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSizeFilter(opt)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                sizeFilter === opt
                  ? "bg-gray-900 text-primary border-gray-900 font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}
            >
              {opt}
            </button>
          ))}
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="ml-auto text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1.5"
          >
            <option>Q3 2024</option>
            <option>Q2 2024</option>
            <option>Q1 2024</option>
            <option>Q4 2023</option>
          </select>
        </div>

        {/* Summary strip — same card style as Reports */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Above national median</div>
            <div className="text-2xl font-semibold text-red-600">5</div>
            <div className="text-sm text-gray-500 mt-1">of 14 indicators</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Below national median</div>
            <div className="text-2xl font-semibold text-green-600">7</div>
            <div className="text-sm text-gray-500 mt-1">performing better</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">At national median</div>
            <div className="text-2xl font-semibold text-amber-600">2</div>
            <div className="text-sm text-gray-500 mt-1">within ±0.5%</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Facility percentile</div>
            <div className="text-2xl font-semibold text-amber-600">52nd</div>
            <div className="text-sm text-gray-500 mt-1">overall ranking</div>
          </div>
        </div>

        {/* Main comparison card */}
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Facility vs national median — all 14 indicators</h2>
          <p className="text-sm text-gray-500 mb-4">
            Each bar shows your facility rate (coloured) vs national median (grey). Red = above national median (worse). Green = below (better).
          </p>

          {/* Legend */}
          <div className="flex flex-wrap gap-6 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              Facility — above national (worse)
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-sm bg-green-600" />
              Facility — below national (better)
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-sm bg-gray-300 opacity-70" />
              National median
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-0.5 h-3 rounded-full bg-gray-500 opacity-60" />
              Median marker
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[minmax(140px,180px)_1fr_70px_70px_70px] gap-2 sm:gap-3 px-2 py-1 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[600px]">
            <div>Indicator</div>
            <div>Rate comparison</div>
            <div className="text-right">Facility</div>
            <div className="text-right">National</div>
            <div className="text-right">Percentile</div>
          </div>

          {/* Indicator rows */}
          <div className="space-y-2 overflow-x-auto">
            {INDICATORS.map((ind) => {
              const status = getStatus(ind);
              const pct = getPercentile(ind);
              const facW = Math.min(100, (ind.fac * scale));
              const natW = Math.min(100, (ind.nat * scale));
              const medPos = Math.min(100, (ind.nat * scale));
              const barColor = status === "red" ? "bg-red-500" : status === "amber" ? "bg-amber-500" : "bg-green-600";
              const textColor = status === "red" ? "text-red-600" : status === "amber" ? "text-amber-600" : "text-green-600";
              const pctColor = pct.cls === "red" ? "text-red-600" : pct.cls === "amber" ? "text-amber-600" : "text-green-600";
              return (
                <div
                  key={ind.name}
                  className="grid grid-cols-[minmax(140px,180px)_1fr_70px_70px_70px] gap-2 sm:gap-3 items-center py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-orange-50/50 hover:border-orange-100 transition min-w-[600px]"
                >
                  <div className="text-sm font-medium text-gray-900 truncate">{ind.name}</div>
                  <div className="relative h-5 bg-gray-200 rounded overflow-visible">
                    <div className="absolute inset-y-1 left-0 rounded bg-gray-300 opacity-50 transition-all" style={{ width: `${natW}%` }} />
                    <div className={`absolute inset-y-1 left-0 rounded opacity-90 transition-all ${barColor}`} style={{ width: `${facW}%` }} />
                    <div className="absolute top-0 w-0.5 h-5 bg-gray-500 opacity-40 rounded-full" style={{ left: `${medPos}%` }} />
                  </div>
                  <div className={`text-sm font-medium text-right ${textColor}`}>
                    {ind.fac}{ind.unit}
                  </div>
                  <div className="text-sm text-gray-500 text-right">{ind.nat}{ind.unit}</div>
                  <div className={`text-xs font-semibold text-right ${pctColor}`}>{pct.label}</div>
                </div>
              );
            })}
          </div>

          {/* AIHW note */}
          <div className="flex items-start gap-2 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              National medians sourced from AIHW QI Program national report. Lower rates are better for most indicators. Consumer experience, Quality of life, Workforce and Enrolled nursing are scored higher = better.
            </span>
          </div>
        </div>

        {/* Bottom charts — same style as Reports/dashboard-csv */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Facility percentile trend</h3>
            <p className="text-sm text-gray-500 mb-4">Overall ranking vs national peer group — 8 quarters</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={PERCENTILE_TREND_DATA} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis domain={[30, 80]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="facility" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Facility percentile" />
                <Line type="monotone" dataKey="national" stroke="#9ca3af" strokeDasharray="4 4" strokeWidth={2} dot={false} name="National median (50th)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Above / below national by indicator</h3>
            <p className="text-sm text-gray-500 mb-4">Difference from national median — positive = worse than national</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DIFF_DATA} margin={{ top: 5, right: 5, left: 5, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="diff" name="Diff from national (%)" radius={4}>
                  {DIFF_DATA.map((entry, index) => (
                    <Cell key={index} fill={entry.diff > 0 ? "#dc2626" : "#16a34a"} />
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
