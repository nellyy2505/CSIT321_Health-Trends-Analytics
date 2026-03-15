import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { getUploadHistory, getUploadById, downloadUploadCSV, deleteUpload } from "../services/api";

const SELECTED_UPLOAD_KEY = "caredata_selected_upload_id";

function formatUploadDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
const STATUS_LABEL = { red: "Above threshold", amber: "Monitor", green: "On track", nodata: "No data", grey: "No data" };

// Map dashboard indicator id to Reports page sidebar section id (for click-through)
const DASHBOARD_TO_REPORTS_SECTION = {
  pi: "pi", falls: "falls", uwl: "uwl", meds: "meds", adl: "adl",
  incontinence: "ic", rp: "rp", hosp: "hosp", allied_health: "ah",
  consumer_exp: "cx", qol: "qol", workforce: "wf", enrolled_nursing: "en", lifestyle: "ls",
};
const REPORTS_SECTION_IDS = ["pi", "falls", "uwl", "meds", "adl", "ic", "rp", "hosp", "ah", "cx", "qol", "wf", "en", "ls"];

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

/** Parse upload analysis JSON. Returns dashboard payload if valid QI format (header.quarterLabels + indicators). */
function parseDashboardAnalysis(analysis) {
  if (!analysis) return null;
  const raw = typeof analysis === "string" ? analysis.trim() : "";
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const quarterLabels = data?.header?.quarterLabels;
    const indicators = data?.indicators;
    if (Array.isArray(quarterLabels) && Array.isArray(indicators) && indicators.length >= 1) {
      return {
        header: data.header || {},
        summaryStrip: data.summaryStrip || {},
        indicators: indicators,
        residentsAtRisk: data.residentsAtRisk || { count: 0, residentIds: [] },
      };
    }
  } catch (_) {}
  return null;
}

export default function QIDashboardPage() {
  const [hasData, setHasData] = useState(false);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [showSample, setShowSample] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedUploadId, setSelectedUploadId] = useState(() => localStorage.getItem(SELECTED_UPLOAD_KEY) || "");

  useEffect(() => {
    let cancelled = false;
    getUploadHistory()
      .then((list) => {
        if (!cancelled) {
          setHistory(Array.isArray(list) ? list : []);
          if (Array.isArray(list) && list.length > 0) setHasData(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onStorage = () => setSelectedUploadId(localStorage.getItem(SELECTED_UPLOAD_KEY) || "");
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // When selected CSV changes, fetch upload and parse analysis for dashboard
  useEffect(() => {
    const id = selectedUploadId || "";
    if (!id) {
      setDashboardData(null);
      setQuarterIndex(0);
      return;
    }
    let cancelled = false;
    setLoadingDashboard(true);
    getUploadById(id)
      .then((upload) => {
        if (cancelled) return;
        const analysis = upload?.analysis;
        const parsed = parseDashboardAnalysis(analysis);
        setDashboardData(parsed);
        if (parsed?.header?.quarterLabels?.length) {
          setQuarterIndex(Math.max(0, parsed.header.quarterLabels.length - 1));
        } else {
          setQuarterIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboardData(null);
          setQuarterIndex(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDashboard(false);
      });
    return () => { cancelled = true; };
  }, [selectedUploadId]);

  const setSelected = (uploadId) => {
    if (uploadId) localStorage.setItem(SELECTED_UPLOAD_KEY, uploadId);
    else localStorage.removeItem(SELECTED_UPLOAD_KEY);
    setSelectedUploadId(uploadId || "");
  };

  const selectedUpload = history.find((u) => u.uploadId === selectedUploadId) || history[0];
  const effectiveDisplayId = selectedUpload?.uploadId || selectedUploadId || "";

  // Quarters from CSV analysis, or fixed list for sample
  const quartersFromData = dashboardData?.header?.quarterLabels ?? [];
  const quarters = showSample ? QUARTERS : quartersFromData;
  const hasQuarters = Array.isArray(quarters) && quarters.length > 0;
  const safeQuarterIndex = hasQuarters ? Math.min(quarterIndex, quarters.length - 1) : 0;
  const currentQuarterLabel = hasQuarters ? quarters[safeQuarterIndex] : "—";

  const useDataState = (dashboardData != null && dashboardData.indicators?.length > 0) || showSample;

  const handleDownload = async (uploadId, filename) => {
    if (downloadingId) return;
    setDownloadingId(uploadId);
    try {
      await downloadUploadCSV(uploadId, filename || "data.csv");
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const loadHistory = () => {
    getUploadHistory()
      .then((list) => setHistory(Array.isArray(list) ? list : []))
      .catch(() => setHistory([]));
  };

  const handleDelete = async (u) => {
    const uploadId = u?.uploadId ?? u?.upload_id;
    if (!uploadId) {
      console.error("[Dashboard] Delete: no uploadId on row", u);
      return;
    }
    if (deletingId) return;
    if (!window.confirm(`Delete "${u.filename || uploadId}"? This cannot be undone.`)) return;
    setDeletingId(uploadId);
    try {
      await deleteUpload(uploadId);
      if (selectedUploadId === uploadId) setSelected("");
      setHistory((prev) => prev.filter((x) => (x.uploadId ?? x.upload_id) !== uploadId));
      loadHistory();
    } catch (err) {
      console.error("Delete failed:", err);
      loadHistory();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow px-4 sm:px-6 mt-24 pb-12 pt-8 max-w-7xl mx-auto w-full">
        {/* Page header — title only */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">
            {useDataState ? (
              <><span className="font-bold">{dashboardData?.header?.facilityName || "Facility"}</span> — Dashboard</>
            ) : (
              <><span className="font-bold">Facility</span> — Dashboard</>
            )}
          </h1>
        </div>

        {/* CSV display selector + uploads table */}
        {!loadingHistory && history.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-sm font-medium text-gray-700">Displaying:</span>
            <select
              value={effectiveDisplayId}
              onChange={(e) => setSelected(e.target.value || "")}
              className="text-sm font-medium text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 min-w-[200px] focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">— Select a CSV —</option>
              {history.map((u) => {
                const id = u.uploadId ?? u.upload_id;
                return (
                  <option key={id} value={id}>
                    {u.filename || id} ({formatUploadDate(u.uploadedAt ?? u.uploaded_at)})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {!loadingHistory && history.length > 0 && (
          <div className="mb-8 overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-4 py-3 font-medium">CSV file name</th>
                  <th className="px-4 py-3 font-medium">Date uploaded</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((u) => {
                  const rowId = u.uploadId ?? u.upload_id;
                  return (
                    <tr key={rowId} className={`border-t border-gray-200 hover:bg-gray-50 ${selectedUploadId === rowId ? "bg-orange-50/50" : ""}`}>
                      <td className="px-4 py-3 text-gray-900 font-medium">{u.filename || rowId || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{formatUploadDate(u.uploadedAt ?? u.uploaded_at)}</td>
                      <td className="px-4 py-3">
                        {selectedUploadId === rowId ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-orange-800">Displaying</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          <button type="button" onClick={() => handleDownload(rowId, u.filename)} disabled={downloadingId === rowId} className="p-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60" title="Download">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          </button>
                          <button type="button" onClick={() => setSelected(selectedUploadId === rowId ? "" : rowId)} className={`p-1.5 rounded border ${selectedUploadId === rowId ? "bg-primary border-primary text-white" : "border-gray-300 bg-white text-gray-500 hover:bg-orange-50"}`} title={selectedUploadId === rowId ? "Used for display" : "Use for display"}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                          </button>
                          <button type="button" onClick={() => handleDelete(u)} disabled={deletingId === rowId} className="p-1.5 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-60" title="Delete">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loadingHistory && history.length === 0 && (
          <p className="mb-6 text-sm text-gray-500">No CSV uploads yet. Go to <Link to="/upload-csv" className="text-primary font-medium hover:underline">Data entry</Link> to upload a facility CSV.</p>
        )}

        {/* Risk strip — from CSV residentsAtRisk */}
        {useDataState && (dashboardData?.residentsAtRisk?.count > 0 || showSample) && (
          <div className="mb-6 bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-800 flex-1">
              {showSample
                ? "8 residents flagged across 2 or more categories this quarter"
                : `${dashboardData.residentsAtRisk.count} resident(s) flagged across 2 or more categories this quarter`}
            </span>
            <div className="flex gap-2 flex-wrap">
              {(showSample ? ["Resident 004", "Resident 011", "Resident 023", "+5 more"] : (dashboardData.residentsAtRisk.residentIds || []).slice(0, 8)).map((id) => (
                <span key={id} className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">{id}</span>
              ))}
            </div>
            <Link to="/reports" className="text-sm font-medium text-red-700 underline underline-offset-1 hover:text-red-800">
              View all →
            </Link>
          </div>
        )}

        {/* Summary row — from CSV summaryStrip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              label: "Total residents",
              value: useDataState
                ? (dashboardData?.summaryStrip?.totalResidents != null ? <>{dashboardData.summaryStrip.totalResidents} <span className="text-sm text-gray-500 font-normal ml-1">this quarter</span></> : showSample ? <>87 <span className="text-sm text-gray-500 font-normal ml-1">this quarter</span></> : "—")
                : "—",
              empty: !useDataState,
            },
            {
              label: "Categories at risk",
              value: useDataState
                ? (dashboardData?.summaryStrip?.categoriesAtRiskCount != null ? <><span className="text-red-600">{dashboardData.summaryStrip.categoriesAtRiskCount}</span> <span className="text-sm text-gray-500 font-normal ml-1">of {dashboardData.summaryStrip.categoriesAtRiskOf ?? 14} red</span></> : showSample ? <><span className="text-red-600">3</span> <span className="text-sm text-gray-500 font-normal ml-1">of 14 red</span></> : "—")
                : "—",
              empty: !useDataState,
            },
            {
              label: "Last submission",
              value: useDataState
                ? (dashboardData?.summaryStrip?.lastSubmissionDate ? <>{dashboardData.summaryStrip.lastSubmissionDate} <span className="text-sm text-gray-500 font-normal ml-1">{currentQuarterLabel !== "—" ? currentQuarterLabel : ""}</span></> : showSample ? <>14 Oct 2024 <span className="text-sm text-gray-500 font-normal ml-1">Q3</span></> : "—")
                : "—",
              empty: !useDataState,
            },
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

        {/* Section label — Quality indicators on left; ACFI badge + quarter selector on right */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {useDataState ? "Quality indicators" : "Quality indicators — awaiting data"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
              {useDataState
                ? (dashboardData?.header?.residentCountForLatestQuarter != null
                  ? `ACFI registered · ${dashboardData.header.residentCountForLatestQuarter} residents`
                  : "ACFI registered · residents")
                : loadingDashboard
                  ? "Loading…"
                  : "No data loaded"}
            </span>
            {hasQuarters && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition disabled:opacity-50"
                  onClick={() => setQuarterIndex((i) => Math.max(0, i - 1))}
                  disabled={safeQuarterIndex <= 0}
                  aria-label="Previous quarter"
                >
                  ‹
                </button>
                <span className="text-sm font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg min-w-[88px] text-center">
                  {currentQuarterLabel}
                </span>
                <button
                  type="button"
                  className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition disabled:opacity-50"
                  onClick={() => setQuarterIndex((i) => Math.min(quarters.length - 1, i + 1))}
                  disabled={safeQuarterIndex >= quarters.length - 1}
                  aria-label="Next quarter"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card grid — from CSV indicators or sample */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {useDataState
            ? (showSample ? INDICATORS_DATA : (dashboardData?.indicators ?? [])).map((ind, i) => {
                const fromCsv = !showSample && dashboardData && dashboardData.indicators && dashboardData.indicators[i];
                const ratePerQuarter = fromCsv?.ratePerQuarter ?? ind.spark;
                const rateForQuarter = fromCsv && Array.isArray(ratePerQuarter) && ratePerQuarter.length > 0
                  ? (ratePerQuarter[safeQuarterIndex] ?? ratePerQuarter[ratePerQuarter.length - 1])
                  : null;
                const valueDisplay = fromCsv?.valueDisplay ?? ind.rate;
                const isPct = String(valueDisplay ?? "").endsWith("%");
                let displayRate = fromCsv && rateForQuarter != null && typeof rateForQuarter === "number"
                  ? `${Number(rateForQuarter).toFixed(2)}${isPct ? "%" : ""}`
                  : (fromCsv ? (valueDisplay ?? "—") : ind.rate);
                // N/A only when backend sends no data (null/missing or valueDisplay "N/A"). Computed 0% or 0 is valid — show it.
                const isNoData = fromCsv && (rateForQuarter == null || (typeof valueDisplay === "string" && valueDisplay === "N/A"));
                if (isNoData && fromCsv) displayRate = "N/A";
                let status = (fromCsv?.status ?? ind.status) || "grey";
                if (displayRate === "N/A") status = "nodata";
                const trend = displayRate === "N/A" ? null : (fromCsv?.trendArrow ?? ind.trend);
                const spark = displayRate === "N/A" ? [] : (fromCsv && Array.isArray(ratePerQuarter) ? ratePerQuarter.filter((v) => v != null).map(Number) : (ind.spark || []));
                const showAsNoData = displayRate === "N/A";
                const reportSectionId = fromCsv?.id ? (DASHBOARD_TO_REPORTS_SECTION[fromCsv.id] ?? REPORTS_SECTION_IDS[i]) : REPORTS_SECTION_IDS[i];
                return (
                  <Link
                    key={fromCsv?.id ?? ind.name ?? i}
                    to={`/reports?section=${reportSectionId}`}
                    className="block bg-white rounded-2xl shadow border border-gray-200 p-4 relative overflow-hidden animate-[fadeIn_0.3s_ease_both] hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                    style={{ animationDelay: `${0.03 * (i + 1)}s` }}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${
                      status === "green" ? "bg-primary" : status === "amber" ? "bg-amber-600" : status === "red" ? "bg-red-500" : "bg-gray-300"
                    }`} />
                    <div className={`text-sm font-semibold mb-2 min-h-[2rem] ${showAsNoData ? "text-gray-500" : "text-gray-800"}`}>{fromCsv?.name ?? ind.name}</div>
                    <div className={`text-xl font-semibold mb-0.5 ${showAsNoData ? "text-gray-400" : "text-gray-900"}`}>{displayRate}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{showAsNoData ? "no data" : (fromCsv ? (fromCsv.valueDisplay && displayRate !== "N/A" ? "" : "rate") : ind.label)}</div>
                    <div className="h-7 mb-2">
                      <SparklineSVG data={spark} status={status} />
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      {trend ? (
                        <span className={`text-xs font-medium ${
                          trend === "up" ? "text-red-600" : trend === "down" ? "text-green-600" : "text-gray-500"
                        }`}>
                          {TREND_LABEL[trend] ?? "→ Stable"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">— No data</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${
                        status === "green" ? "bg-orange-50 text-orange-800" :
                        status === "amber" ? "bg-amber-50 text-amber-800" :
                        status === "red" ? "bg-red-50 text-red-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        {STATUS_LABEL[status] ?? STATUS_LABEL.nodata}
                      </span>
                    </div>
                  </Link>
                );
              })
            : INDICATORS_EMPTY.map((name, i) => (
                <Link
                  key={name}
                  to={`/reports?section=${REPORTS_SECTION_IDS[i] ?? "pi"}`}
                  className="block bg-white rounded-2xl shadow border border-gray-200 p-4 relative overflow-hidden animate-[fadeIn_0.3s_ease_both] hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
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
                </Link>
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
