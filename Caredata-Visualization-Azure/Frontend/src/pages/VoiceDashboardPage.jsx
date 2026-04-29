/**
 * VoiceDashboardPage, Phase 3 Nurse-facing voice biomarker dashboard.
 *
 * Redesigned for 100+ residents:
 * - Searchable patient ID input (not select box)
 * - Tag-based batch link generation
 * - Sortable data table (replaces card grid)
 * - Diverse chart types: LineChart, RadarChart, BarChart, PieChart
 * - Style-guide palette colors (no purple)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import VoiceAlertsFeed from "../components/voice/VoiceAlertsFeed";
import {
  getVoiceFacilitySummary,
  getVoiceAlerts,
  getVoiceResidents,
  getVoiceHistory,
  acknowledgeAlert,
  generateVoiceLink,
  generateVoiceLinksBatch,
  listVoiceLinks,
  getVoiceReport,
  getVoiceQiFlags,
  resetResidentPassword,
} from "../services/voiceApi";
import {
  LineChart, Line,
  BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  STATUS, CHART_PALETTE, CHART_GRID, axisTickStyle, tooltipStyle, legendStyle,
} from "../theme/chartTokens";

// Clinical-calm chart palette, sourced from shared chart tokens.
const PALETTE = {
  secondary: CHART_PALETTE[0], // sage-ink
  info:      CHART_PALETTE[1], // dusty-blue-ink
  success:   STATUS.good,
  warning:   STATUS.warn,
  error:     STATUS.bad,
  dark:      "#1F2622",
  gray1:     "#3D4743",
  gray2:     "#6B7570",
  gray3:     "#B4BAB4",
  gray4:     "#ECE6D9",
  gray5:     "#FBF8F2",
};

const ALERT_PIE_COLORS = [STATUS.good, STATUS.warn, STATUS.bad];

export default function VoiceDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  // Detail view
  const [selectedResident, setSelectedResident] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Link generation, searchable input
  const [existingLinks, setExistingLinks] = useState([]);
  const [linkInput, setLinkInput] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [linkError, setLinkError] = useState("");
  const linkInputRef = useRef(null);

  // Batch link generation, tag-based
  const [batchMode, setBatchMode] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [batchTags, setBatchTags] = useState([]);
  const [batchResults, setBatchResults] = useState(null);

  // QI flags
  const [qiFlags, setQiFlags] = useState([]);

  // Password reset
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  // Detail tabs
  const [detailTab, setDetailTab] = useState("chart");

  // Table sorting + search
  const [tableSearch, setTableSearch] = useState("");
  const [sortCol, setSortCol] = useState("display_name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const [summaryData, alertsData, residentsData, linksData, flagsData] = await Promise.all([
        getVoiceFacilitySummary().catch(() => ({ active_alerts: 0, red_alerts: 0, amber_alerts: 0 })),
        getVoiceAlerts().catch(() => ({ alerts: [] })),
        getVoiceResidents().catch(() => ({ residents: [] })),
        listVoiceLinks().catch(() => ({ links: [] })),
        getVoiceQiFlags().catch(() => ({ flags: [] })),
      ]);
      setSummary(summaryData);
      setAlerts(alertsData.alerts || []);
      setResidents(residentsData.residents || []);
      setExistingLinks(linksData.links || []);
      setQiFlags(flagsData.flags || []);
    } catch { /* fallback */ } finally {
      setLoading(false);
      setAlertsLoading(false);
    }
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleAcknowledge = useCallback(async (analysisId) => {
    try {
      await acknowledgeAlert(analysisId);
      setAlerts((prev) => prev.filter((a) => a.analysis_id !== analysisId));
      setSummary((prev) => prev ? { ...prev, active_alerts: Math.max(0, (prev.active_alerts || 1) - 1) } : prev);
    } catch (err) {
      console.error("Acknowledge error:", err);
      const msg = err?.response?.data?.detail || err?.message || "Unknown error";
      alert(`Failed to acknowledge alert: ${msg}`);
    }
  }, []);

  const handleViewHistory = useCallback(async (residentId) => {
    setSelectedResident(residentId);
    setHistoryLoading(true);
    setDetailTab("chart");
    try {
      const data = await getVoiceHistory(residentId);
      setHistoryData(data);
    } catch { setHistoryData(null); } finally { setHistoryLoading(false); }
  }, []);

  // ── Link helpers ────────────────────────────────────────────────────────

  function isExpired(link) {
    if (!link.expires_at) return false;
    try { return new Date() > new Date(link.expires_at); } catch { return false; }
  }

  function hasActiveLink(residentId) {
    return existingLinks.some((l) => l.resident_id === residentId && !isExpired(l));
  }

  function getActiveLinkUrl(residentId) {
    const link = existingLinks.find((l) => l.resident_id === residentId && !isExpired(l));
    return link ? `${window.location.origin}/voice/record/${link.token}` : null;
  }

  // Filtered suggestions for searchable input
  const linkSuggestions = useMemo(() => {
    if (!linkInput.trim()) return [];
    const q = linkInput.trim().toLowerCase();
    // Combine existing residents + links to build full ID list
    const allIds = new Set([
      ...residents.map((r) => r.resident_id).filter(Boolean),
      ...existingLinks.map((l) => l.resident_id).filter(Boolean),
    ]);
    return [...allIds].filter((id) => id.toLowerCase().includes(q)).slice(0, 10);
  }, [linkInput, residents, existingLinks]);

  const handleGenerateLink = useCallback(async (rid) => {
    const residentId = rid || linkInput.trim();
    setLinkError("");
    setGeneratedLink(null);
    if (!residentId) { setLinkError("Enter a resident ID."); return; }

    // Check existing
    const existingUrl = getActiveLinkUrl(residentId);
    if (existingUrl) {
      setGeneratedLink({ url: existingUrl, reused: true });
      setLinkInput("");
      setLinkDropdownOpen(false);
      return;
    }
    try {
      const result = await generateVoiceLink(residentId);
      setGeneratedLink(result);
      setLinkInput("");
      setLinkDropdownOpen(false);
      const updated = await listVoiceLinks().catch(() => ({ links: [] }));
      setExistingLinks(updated.links || []);
    } catch (err) {
      setLinkError(err.response?.data?.detail || "Failed to generate link.");
    }
  }, [linkInput, existingLinks]);

  // ── Batch handlers ──────────────────────────────────────────────────────

  const addBatchTag = useCallback(() => {
    const id = batchInput.trim();
    if (id && !batchTags.includes(id)) {
      setBatchTags([...batchTags, id]);
    }
    setBatchInput("");
  }, [batchInput, batchTags]);

  const removeBatchTag = useCallback((id) => {
    setBatchTags(batchTags.filter((t) => t !== id));
  }, [batchTags]);

  const handleBatchGenerate = useCallback(async () => {
    setLinkError("");
    setBatchResults(null);
    if (batchTags.length === 0) { setLinkError("Add at least one patient ID."); return; }
    try {
      const result = await generateVoiceLinksBatch(batchTags);
      setBatchResults(result.links || []);
      setBatchTags([]);
      const updated = await listVoiceLinks().catch(() => ({ links: [] }));
      setExistingLinks(updated.links || []);
    } catch (err) { setLinkError(err.response?.data?.detail || "Batch generation failed."); }
  }, [batchTags]);

  // ── Password reset ──────────────────────────────────────────────────────

  const handleResetPassword = useCallback(async () => {
    setResetMsg("");
    if (!resetTarget || resetPw.length < 4) { setResetMsg("Password must be at least 4 characters."); return; }
    try {
      await resetResidentPassword(resetTarget, resetPw);
      setResetMsg("Password reset successfully.");
      setResetPw("");
      setTimeout(() => { setResetTarget(null); setResetMsg(""); }, 2000);
    } catch (err) { setResetMsg(err.response?.data?.detail || "Reset failed."); }
  }, [resetTarget, resetPw]);

  // ── Chart data ──────────────────────────────────────────────────────────

  const chartData = historyData?.analyses?.slice().reverse().map((a, i) => ({
    recording: `#${i + 1}`,
    speechRate: a.acoustic_features?.speech_rate_proxy || 0,
    meanPause: a.acoustic_features?.mean_pause_duration_s || 0,
    pitch: a.acoustic_features?.pitch_mean_hz || 0,
    jitter: a.acoustic_features?.jitter_pct || 0,
    energy: a.acoustic_features?.mean_energy || 0,
    shimmer: a.acoustic_features?.shimmer_pct || 0,
    fatigue: a.acoustic_features?.vocal_fatigue_index || 0,
  })) || [];

  // Bar chart data, latest vs baseline
  const barCompareData = useMemo(() => {
    if (!historyData?.analyses || historyData.analyses.length < 2) return [];
    const latest = historyData.analyses[0]?.acoustic_features || {};
    const baseline = historyData.analyses[historyData.analyses.length - 1]?.acoustic_features || {};
    return [
      { metric: "Speech Rate", baseline: baseline.speech_rate_proxy || 0, latest: latest.speech_rate_proxy || 0 },
      { metric: "Pause (s)", baseline: baseline.mean_pause_duration_s || 0, latest: latest.mean_pause_duration_s || 0 },
      { metric: "Jitter (%)", baseline: baseline.jitter_pct || 0, latest: latest.jitter_pct || 0 },
      { metric: "Shimmer (%)", baseline: baseline.shimmer_pct || 0, latest: latest.shimmer_pct || 0 },
      { metric: "Fatigue Idx", baseline: baseline.vocal_fatigue_index || 0, latest: latest.vocal_fatigue_index || 0 },
    ];
  }, [historyData]);

  // Radar data, latest acoustic profile (normalized 0-100)
  const radarData = useMemo(() => {
    if (!historyData?.analyses?.[0]) return [];
    const f = historyData.analyses[0].acoustic_features || {};
    return [
      { feature: "Speech Rate", value: Math.min(100, (f.speech_rate_proxy || 0) * 25) },
      { feature: "Pause Control", value: Math.min(100, Math.max(0, 100 - (f.mean_pause_duration_s || 0) * 30)) },
      { feature: "Vocal Energy", value: Math.min(100, (f.mean_energy || 0) / 30) },
      { feature: "Pitch Stability", value: Math.min(100, Math.max(0, 100 - (f.pitch_std_hz || 0) * 3)) },
      { feature: "Jitter Control", value: Math.min(100, Math.max(0, 100 - (f.jitter_pct || 0) * 15)) },
      { feature: "Endurance", value: Math.min(100, (f.vocal_fatigue_index || 0) * 100) },
    ];
  }, [historyData]);

  // Alert distribution for summary donut
  const alertDistribution = useMemo(() => {
    const counts = { green: 0, amber: 0, red: 0 };
    residents.forEach((r) => {
      const level = r.latest_analysis?.alert_level || "green";
      counts[level] = (counts[level] || 0) + 1;
    });
    return [
      { name: "Normal", value: counts.green, color: PALETTE.success },
      { name: "Monitor", value: counts.amber, color: PALETTE.warning },
      { name: "Alert", value: counts.red, color: PALETTE.error },
    ].filter((d) => d.value > 0);
  }, [residents]);

  // ── Table sorting + filtering ───────────────────────────────────────────

  const filteredResidents = useMemo(() => {
    let list = [...residents];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (r) =>
          (r.resident_id || "").toLowerCase().includes(q) ||
          (r.display_name || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case "alert_level": {
          const order = { red: 0, amber: 1, green: 2 };
          va = order[a.latest_analysis?.alert_level || "green"] ?? 2;
          vb = order[b.latest_analysis?.alert_level || "green"] ?? 2;
          break;
        }
        case "speech_rate":
          va = a.latest_analysis?.acoustic_features?.speech_rate_proxy ?? 0;
          vb = b.latest_analysis?.acoustic_features?.speech_rate_proxy ?? 0;
          break;
        case "pause":
          va = a.latest_analysis?.acoustic_features?.mean_pause_duration_s ?? 0;
          vb = b.latest_analysis?.acoustic_features?.mean_pause_duration_s ?? 0;
          break;
        case "deviation":
          va = a.latest_analysis?.risk_scores?.overall_deviation_pct ?? 0;
          vb = b.latest_analysis?.risk_scores?.overall_deviation_pct ?? 0;
          break;
        case "recordings":
          va = a.recording_count || 0;
          vb = b.recording_count || 0;
          break;
        default:
          va = (a.display_name || a.resident_id || "").toLowerCase();
          vb = (b.display_name || b.resident_id || "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [residents, tableSearch, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="ml-1" style={{ color: "var(--ink-300)" }}>↕</span>;
    return <span className="ml-1" style={{ color: "var(--ink-700)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className="flex-grow pt-28 pb-12 px-4 sm:px-8 max-w-[1400px] mx-auto w-full">
        <div className="mb-6">
          <span className="cd-chip" style={{ display: "inline-flex" }}>
            <span className="dot" /> Phase 3 · Voice screening
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
              marginTop: 8,
              lineHeight: 1.1,
            }}
          >
            Voice Biomarker Screening
          </h1>
          <p style={{ color: "var(--ink-500)", fontSize: 14, marginTop: 6 }}>
            Resident acoustic trends, alerts and recording-link orchestration.
          </p>
        </div>

        {/* ── Summary strip ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <SummaryCard label="Residents Screened" value={residents.length} />
          <SummaryCard label="Active Alerts" value={summary?.active_alerts ?? 0}
            tone={summary?.red_alerts > 0 ? "clay" : "amber"} />
          <SummaryCard label="Red Alerts" value={summary?.red_alerts ?? 0} tone="clay" />
          <SummaryCard label="QI Flags" value={qiFlags.length} tone="blue" />
          {/* Mini alert distribution donut */}
          <div className="cd-surface p-4 flex items-center justify-center">
            {alertDistribution.length > 0 ? (
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={alertDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={38} strokeWidth={1}>
                    {alertDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs" style={{ color: "var(--ink-500)" }}>No data</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column: Alerts + Link gen + QI ─────────────────── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Alerts */}
            <div className="cd-surface p-5">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", marginBottom: 14 }}>
                Alerts
              </h2>
              <VoiceAlertsFeed alerts={alerts} onAcknowledge={handleAcknowledge} loading={alertsLoading} />
            </div>

            {/* ── Generate Recording Link ───────────────────────────── */}
            <div className="cd-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)" }}>
                  Generate Recording Link
                </h2>
                <button onClick={() => { setBatchMode(!batchMode); setGeneratedLink(null); setBatchResults(null); setLinkError(""); }}
                  className="text-xs font-medium hover:underline" style={{ color: "var(--sage-ink)" }}>
                  {batchMode ? "Single" : "Batch"}
                </button>
              </div>

              {!batchMode ? (
                /* ── Single mode, searchable input ──────────────────── */
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      ref={linkInputRef}
                      type="text"
                      value={linkInput}
                      onChange={(e) => { setLinkInput(e.target.value); setLinkDropdownOpen(true); setGeneratedLink(null); }}
                      onFocus={() => setLinkDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setLinkDropdownOpen(false), 200)}
                      placeholder="Type patient ID (e.g. R001)..."
                      className="w-full px-4 py-2.5 text-sm outline-none"
                      style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-paper)", color: "var(--ink-900)" }}
                    />
                    {linkDropdownOpen && linkSuggestions.length > 0 && (
                      <div
                        className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto"
                        style={{ background: "var(--bg-white)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow-sm)" }}
                      >
                        {linkSuggestions.map((id) => (
                          <button
                            key={id}
                            onMouseDown={(e) => { e.preventDefault(); setLinkInput(id); setLinkDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm flex items-center justify-between"
                            style={{ color: "var(--ink-900)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-paper)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <span>{id}</span>
                            {hasActiveLink(id) && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)" }}>Generated</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={() => handleGenerateLink()} className="cd-btn cd-btn-primary w-full justify-center text-sm">
                    {hasActiveLink(linkInput.trim()) ? "Show Existing Link" : "Generate Link"}
                  </button>

                  {linkError && <p className="text-sm" style={{ color: "var(--clay-ink)" }}>{linkError}</p>}
                  {generatedLink && (
                    <div className="p-3" style={{ background: "var(--bg-sage-tint)", border: "1px solid var(--line)", borderRadius: 10 }}>
                      <p className="text-sm font-medium" style={{ color: "var(--sage-ink)" }}>
                        {generatedLink.reused ? "Existing link:" : "Link generated:"}
                      </p>
                      <p className="text-xs break-all mt-1" style={{ color: "var(--ink-700)" }}>{generatedLink.url}</p>
                      <button onClick={() => navigator.clipboard.writeText(generatedLink.url)}
                        className="mt-2 text-xs font-medium hover:underline" style={{ color: "var(--sage-ink)" }}>
                        Copy to clipboard
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Batch mode, tag-based input ────────────────────── */
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "var(--ink-500)" }}>Enter patient IDs to generate links in batch:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBatchTag(); } }}
                      placeholder="Type ID + Enter..."
                      className="flex-1 px-4 py-2 text-sm outline-none"
                      style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-paper)", color: "var(--ink-900)" }}
                    />
                    <button onClick={addBatchTag} className="cd-btn cd-btn-primary text-sm">Add</button>
                  </div>

                  {batchTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {batchTags.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                          style={{ background: "var(--bg-paper)", border: "1px solid var(--line)", color: "var(--ink-700)" }}>
                          {id}
                          {hasActiveLink(id) && <span className="text-xs" style={{ color: "var(--sage-ink)" }}>✓</span>}
                          <button onClick={() => removeBatchTag(id)} className="ml-1" style={{ color: "var(--ink-500)" }}>&times;</button>
                        </span>
                      ))}
                    </div>
                  )}

                  <button onClick={handleBatchGenerate} disabled={batchTags.length === 0}
                    className="cd-btn cd-btn-primary w-full justify-center text-sm disabled:opacity-50">
                    Generate {batchTags.length} Link{batchTags.length !== 1 ? "s" : ""}
                  </button>

                  {linkError && <p className="text-sm" style={{ color: "var(--clay-ink)" }}>{linkError}</p>}
                  {batchResults && (
                    <div className="p-3 space-y-2" style={{ background: "var(--bg-sage-tint)", border: "1px solid var(--line)", borderRadius: 10 }}>
                      <p className="text-sm font-medium" style={{ color: "var(--sage-ink)" }}>{batchResults.length} links generated:</p>
                      {batchResults.map((l) => (
                        <div key={l.token} className="flex items-center justify-between text-xs" style={{ color: "var(--ink-700)" }}>
                          <span className="font-medium">{l.resident_id}</span>
                          <button onClick={() => navigator.clipboard.writeText(l.url)}
                            className="hover:underline" style={{ color: "var(--sage-ink)" }}>Copy</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* QI Flags */}
            {qiFlags.length > 0 && (
              <div className="cd-surface p-5">
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", marginBottom: 14 }}>
                  QI Integration Flags
                </h2>
                <div className="space-y-3">
                  {qiFlags.map((f) => (
                    <div key={f.analysis_id} className="p-3"
                      style={{ border: "1px solid var(--line-soft)", borderRadius: 10, background: "var(--bg-paper)" }}>
                      <p className="font-medium text-sm" style={{ color: "var(--ink-900)" }}>{f.display_name}</p>
                      {f.qi_flags.map((qi, i) => {
                        const sev = qi.severity === "red" ? "var(--clay)" : qi.severity === "amber" ? "var(--amber)" : "var(--sage)";
                        return (
                          <div key={i} className="mt-1 flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: sev }} />
                            <div>
                              <p className="text-xs font-medium" style={{ color: "var(--ink-700)" }}>{qi.qi_category}</p>
                              <p className="text-xs" style={{ color: "var(--ink-500)" }}>{qi.flag}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Password Reset */}
            <div className="cd-surface p-5">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", marginBottom: 14 }}>
                Reset Resident Password
              </h2>
              <div className="space-y-3">
                <select value={resetTarget || ""} onChange={(e) => { setResetTarget(e.target.value || null); setResetMsg(""); }}
                  className="w-full px-4 py-2.5 text-sm outline-none"
                  style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-paper)", color: "var(--ink-900)" }}>
                  <option value="">Select resident...</option>
                  {residents.map((r) => (
                    <option key={r.resident_id} value={r.resident_id}>
                      {r.display_name || r.resident_id}
                    </option>
                  ))}
                </select>
                {resetTarget && (
                  <>
                    <input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
                      placeholder="New password (min 4 chars)"
                      className="w-full px-4 py-2.5 text-sm outline-none"
                      style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-paper)", color: "var(--ink-900)" }} />
                    <button onClick={handleResetPassword} className="cd-btn cd-btn-primary w-full justify-center text-sm">
                      Reset Password
                    </button>
                    {resetMsg && (
                      <p className="text-sm" style={{ color: resetMsg.includes("success") ? "var(--sage-ink)" : "var(--clay-ink)" }}>
                        {resetMsg}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column: Detail + Table ────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detail view */}
            {selectedResident && (
              <div className="cd-surface p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-900)" }}>
                    {historyData?.profile?.display_name || selectedResident}
                  </h2>
                  <div className="flex items-center gap-3">
                    <a href={getVoiceReport(selectedResident)} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline" style={{ color: "var(--sage-ink)" }}>
                      Download Report
                    </a>
                    <button onClick={() => { setSelectedResident(null); setHistoryData(null); }}
                      className="text-sm hover:underline" style={{ color: "var(--ink-500)" }}>Close</button>
                  </div>
                </div>

                {/* Detail tabs */}
                <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid var(--line)" }}>
                  {[
                    { key: "chart", label: "Trend Chart" },
                    { key: "compare", label: "Baseline Compare" },
                    { key: "profile", label: "Acoustic Profile" },
                    { key: "transcript", label: "Transcript" },
                    { key: "qi", label: "QI Flags" },
                  ].map(({ key, label }) => {
                    const active = detailTab === key;
                    return (
                      <button key={key} onClick={() => setDetailTab(key)}
                        className="px-3 py-2 text-sm font-medium transition"
                        style={{
                          borderBottom: `2px solid ${active ? "var(--ink-900)" : "transparent"}`,
                          color: active ? "var(--ink-900)" : "var(--ink-500)",
                          marginBottom: -1,
                        }}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {historyLoading ? (
                  <p className="text-sm py-4" style={{ color: "var(--ink-500)" }}>Loading history...</p>
                ) : detailTab === "chart" ? (
                  chartData.length > 0 ? (
                    <div>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                          <XAxis dataKey="recording" tick={axisTickStyle} stroke={CHART_GRID} />
                          <YAxis tick={axisTickStyle} stroke={CHART_GRID} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={legendStyle} />
                          <Line type="monotone" dataKey="speechRate" stroke={PALETTE.secondary} strokeWidth={2} name="Speech Rate" dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="meanPause" stroke={PALETTE.info} strokeWidth={2} name="Mean Pause (s)" dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="pitch" stroke={PALETTE.success} strokeWidth={2} name="Pitch (Hz)" dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="jitter" stroke={PALETTE.error} strokeWidth={1.5} name="Jitter (%)" dot={{ r: 3 }} strokeDasharray="5 5" />
                        </LineChart>
                      </ResponsiveContainer>
                      {historyData?.analyses?.[0]?.narrative_report && (
                        <div className="mt-4 p-4"
                          style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
                          <p className="text-sm font-medium mb-1" style={{ color: "var(--ink-700)" }}>Latest Clinical Narrative</p>
                          <p className="text-sm" style={{ color: "var(--ink-700)" }}>{historyData.analyses[0].narrative_report}</p>
                        </div>
                      )}
                    </div>
                  ) : <p className="text-sm py-4" style={{ color: "var(--ink-500)" }}>No analysis data available.</p>

                ) : detailTab === "compare" ? (
                  barCompareData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barCompareData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="metric" tick={axisTickStyle} stroke={CHART_GRID} />
                        <YAxis tick={axisTickStyle} stroke={CHART_GRID} />
                        <Tooltip {...tooltipStyle} />
                        <Legend wrapperStyle={legendStyle} />
                        <Bar dataKey="baseline" fill={PALETTE.gray4} name="Baseline" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="latest" fill={PALETTE.secondary} name="Latest" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm py-4" style={{ color: "var(--ink-500)" }}>Need at least 2 recordings for comparison.</p>

                ) : detailTab === "profile" ? (
                  radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke={CHART_GRID} />
                        <PolarAngleAxis dataKey="feature" tick={axisTickStyle} />
                        <PolarRadiusAxis domain={[0, 100]} tick={axisTickStyle} />
                        <Radar name="Current" dataKey="value" stroke={PALETTE.secondary} fill={PALETTE.secondary} fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm py-4" style={{ color: "var(--ink-500)" }}>No analysis data available.</p>

                ) : detailTab === "transcript" ? (
                  <div className="space-y-3">
                    {historyData?.analyses?.filter((a) => a.transcript).length > 0 ? (
                      historyData.analyses.filter((a) => a.transcript).map((a) => {
                        const lvlColor = a.alert_level === "red" ? "var(--clay-ink)" : a.alert_level === "amber" ? "var(--amber)" : "var(--sage-ink)";
                        return (
                          <div key={a.analysis_id} className="p-4"
                            style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
                            <p className="text-xs mb-1" style={{ color: "var(--ink-500)" }}>
                              {a.created_at?.slice(0, 10)} · <span style={{ color: lvlColor }}>{a.alert_level}</span>
                            </p>
                            <p className="text-sm italic" style={{ color: "var(--ink-700)" }}>"{a.transcript}"</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <p style={{ color: "var(--ink-500)" }}>No transcripts available.</p>
                        <p className="text-sm mt-1" style={{ color: "var(--ink-500)" }}>Transcription requires OpenAI API key.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {qiFlags.filter((f) => f.resident_id === selectedResident).length > 0 ? (
                      qiFlags.filter((f) => f.resident_id === selectedResident).map((f) =>
                        f.qi_flags.map((qi, i) => {
                          const sev = qi.severity === "red" ? "var(--clay)" : qi.severity === "amber" ? "var(--amber)" : "var(--sage)";
                          return (
                            <div key={i} className="p-4 flex items-start gap-3"
                              style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
                              <span className="w-3 h-3 rounded-full mt-0.5" style={{ background: sev }} />
                              <div>
                                <p className="text-sm font-medium" style={{ color: "var(--ink-900)" }}>{qi.qi_category}</p>
                                <p className="text-sm" style={{ color: "var(--ink-700)" }}>{qi.flag}</p>
                                <p className="text-xs mt-1" style={{ color: "var(--ink-500)" }}>Indicator: {qi.indicator}</p>
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : (
                      <div className="text-center py-8"><p style={{ color: "var(--ink-500)" }}>No QI flags for this resident.</p></div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Residents Table ───────────────────────────────────── */}
            <div className="cd-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)" }}>
                  Residents ({residents.length})
                </h2>
                <input type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search by name or ID..."
                  className="px-3 py-1.5 text-sm w-56 outline-none"
                  style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-paper)", color: "var(--ink-900)" }} />
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: "var(--ink-500)" }}>Loading residents...</p>
              ) : filteredResidents.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: "var(--ink-500)" }}>
                    {residents.length === 0 ? "No residents screened yet." : "No results match your search."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="cd-table w-full text-sm">
                    <thead>
                      <tr>
                        {[
                          { col: "display_name", label: "Resident" },
                          { col: "alert_level", label: "Status" },
                          { col: "speech_rate", label: "Speech Rate" },
                          { col: "pause", label: "Pause (s)" },
                          { col: "deviation", label: "Deviation" },
                          { col: "recordings", label: "Recordings" },
                        ].map(({ col, label }) => (
                          <th key={col} onClick={() => toggleSort(col)}
                            className="text-left cursor-pointer select-none whitespace-nowrap">
                            {label}<SortIcon col={col} />
                          </th>
                        ))}
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResidents.map((r) => {
                        const level = r.latest_analysis?.alert_level || "green";
                        const f = r.latest_analysis?.acoustic_features || {};
                        const dev = r.latest_analysis?.risk_scores?.overall_deviation_pct;
                        const lvlDot = level === "red" ? "var(--clay)" : level === "amber" ? "var(--amber)" : "var(--sage)";
                        const pillBg = level === "red" ? "var(--bg-clay-tint)" : level === "amber" ? "var(--bg-paper)" : "var(--bg-sage-tint)";
                        const pillInk = level === "red" ? "var(--clay-ink)" : level === "amber" ? "var(--amber)" : "var(--sage-ink)";
                        const isSel = selectedResident === r.resident_id;
                        return (
                          <tr key={r.profile_id}
                            className="cursor-pointer transition-colors"
                            style={{ background: isSel ? "var(--bg-sage-tint)" : "transparent" }}
                            onClick={() => handleViewHistory(r.resident_id)}>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: lvlDot }} />
                                <div>
                                  <p className="font-medium" style={{ color: "var(--ink-900)" }}>{r.display_name || r.resident_id}</p>
                                  <p className="text-xs" style={{ color: "var(--ink-500)" }}>{r.resident_id}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="text-xs font-medium px-2 py-1 rounded-full"
                                style={{ background: pillBg, color: pillInk }}>
                                {level === "red" ? "Alert" : level === "amber" ? "Monitor" : "Normal"}
                              </span>
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>
                              {f.speech_rate_proxy != null ? `${f.speech_rate_proxy}/s` : "—"}
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>
                              {f.mean_pause_duration_s != null ? f.mean_pause_duration_s.toFixed(2) : "—"}
                            </td>
                            <td>
                              {dev != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-cream)" }}>
                                    <div className="h-full rounded-full" style={{ background: lvlDot, width: `${Math.min(100, dev)}%` }} />
                                  </div>
                                  <span className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>{dev.toFixed(0)}%</span>
                                </div>
                              ) : "—"}
                            </td>
                            <td style={{ color: "var(--ink-700)" }}>{r.recording_count || 0}</td>
                            <td className="text-right">
                              <button onClick={(e) => { e.stopPropagation(); handleViewHistory(r.resident_id); }}
                                className="text-xs font-medium hover:underline" style={{ color: "var(--sage-ink)" }}>
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-xs text-center" style={{ color: "var(--ink-500)" }}>
          This analysis is a clinical decision support tool. It does not constitute a diagnosis.
          All flagged conditions require clinical assessment by a qualified health professional.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function SummaryCard({ label, value, tone = "ink" }) {
  const color =
    tone === "clay" ? "var(--clay-ink)"
    : tone === "amber" ? "var(--amber)"
    : tone === "sage" ? "var(--sage-ink)"
    : tone === "blue" ? "var(--blue-ink)"
    : "var(--ink-900)";
  return (
    <div className="cd-kpi p-5">
      <p className="text-sm font-medium" style={{ color: "var(--ink-500)" }}>{label}</p>
      <p className="mt-1" style={{ fontFamily: "var(--font-serif)", fontSize: 30, color, letterSpacing: "-0.01em", lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}
