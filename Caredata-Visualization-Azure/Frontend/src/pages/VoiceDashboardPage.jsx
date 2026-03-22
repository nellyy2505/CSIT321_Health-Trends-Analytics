/**
 * VoiceDashboardPage — Nurse-facing voice biomarker dashboard.
 *
 * Shows facility summary, alerts feed, resident cards with trend data,
 * and link generation controls. Full portal page with Navbar.
 */
import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import VoiceAlertsFeed from "../components/voice/VoiceAlertsFeed";
import ResidentVoiceCard from "../components/voice/ResidentVoiceCard";
import {
  getVoiceFacilitySummary,
  getVoiceAlerts,
  getVoiceResidents,
  getVoiceHistory,
  acknowledgeAlert,
  generateVoiceLink,
} from "../services/voiceApi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

  // Link generation
  const [linkResidentId, setLinkResidentId] = useState("");
  const [generatedLink, setGeneratedLink] = useState(null);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [summaryData, alertsData, residentsData] = await Promise.all([
        getVoiceFacilitySummary().catch(() => ({ active_alerts: 0, red_alerts: 0, amber_alerts: 0 })),
        getVoiceAlerts().catch(() => ({ alerts: [] })),
        getVoiceResidents().catch(() => ({ residents: [] })),
      ]);
      setSummary(summaryData);
      setAlerts(alertsData.alerts || []);
      setResidents(residentsData.residents || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
      setAlertsLoading(false);
    }
  };

  const handleAcknowledge = useCallback(async (analysisId) => {
    try {
      await acknowledgeAlert(analysisId);
      setAlerts((prev) => prev.filter((a) => a.analysis_id !== analysisId));
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              active_alerts: Math.max(0, (prev.active_alerts || 1) - 1),
            }
          : prev
      );
    } catch {
      alert("Failed to acknowledge alert.");
    }
  }, []);

  const handleViewHistory = useCallback(async (residentId) => {
    setSelectedResident(residentId);
    setHistoryLoading(true);
    try {
      const data = await getVoiceHistory(residentId);
      setHistoryData(data);
    } catch {
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleGenerateLink = useCallback(async () => {
    setLinkError("");
    setGeneratedLink(null);
    if (!linkResidentId.trim()) {
      setLinkError("Please enter a Resident ID.");
      return;
    }
    try {
      const result = await generateVoiceLink(linkResidentId.trim());
      setGeneratedLink(result);
    } catch (err) {
      setLinkError(err.response?.data?.detail || "Failed to generate link.");
    }
  }, [linkResidentId]);

  // Build chart data from history
  const chartData =
    historyData?.analyses
      ?.slice()
      .reverse()
      .map((a, i) => ({
        recording: `#${i + 1}`,
        speechRate: a.acoustic_features?.speech_rate_proxy || 0,
        meanPause: a.acoustic_features?.mean_pause_duration_s || 0,
        deviation: a.risk_scores?.overall_deviation_pct || 0,
      })) || [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Voice Biomarker Screening</h1>

        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard
            label="Residents Screened"
            value={residents.length}
            color="text-gray-900"
          />
          <SummaryCard
            label="Active Alerts"
            value={summary?.active_alerts ?? 0}
            color={summary?.red_alerts > 0 ? "text-red-600" : "text-amber-600"}
          />
          <SummaryCard
            label="Red Alerts"
            value={summary?.red_alerts ?? 0}
            color="text-red-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Alerts + Link generation */}
          <div className="lg:col-span-1 space-y-6">
            {/* Alerts */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts</h2>
              <VoiceAlertsFeed
                alerts={alerts}
                onAcknowledge={handleAcknowledge}
                loading={alertsLoading}
              />
            </div>

            {/* Generate link */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Recording Link</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  value={linkResidentId}
                  onChange={(e) => setLinkResidentId(e.target.value)}
                  placeholder="Resident ID (e.g. R-001)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:border-primary focus:ring-1 focus:ring-orange-200 outline-none"
                />
                <button
                  onClick={handleGenerateLink}
                  className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg
                             hover:bg-orange-600 transition-colors text-sm"
                >
                  Generate Link
                </button>
                {linkError && <p className="text-sm text-red-600">{linkError}</p>}
                {generatedLink && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800 font-medium">Link generated:</p>
                    <p className="text-xs text-green-700 break-all mt-1">{generatedLink.url}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink.url);
                      }}
                      className="mt-2 text-xs text-primary font-medium hover:underline"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: Resident cards + detail view */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detail view (if selected) */}
            {selectedResident && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Voice History — {historyData?.profile?.display_name || selectedResident}
                  </h2>
                  <button
                    onClick={() => {
                      setSelectedResident(null);
                      setHistoryData(null);
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>

                {historyLoading ? (
                  <p className="text-sm text-gray-400 py-4">Loading history...</p>
                ) : chartData.length > 0 ? (
                  <div>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="recording" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="speechRate"
                          stroke="#ff7b00"
                          strokeWidth={2}
                          name="Speech Rate"
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="meanPause"
                          stroke="#6366f1"
                          strokeWidth={2}
                          name="Mean Pause (s)"
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Narrative from latest */}
                    {historyData?.analyses?.[0]?.narrative_report && (
                      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Latest Clinical Narrative</p>
                        <p className="text-sm text-gray-600">
                          {historyData.analyses[0].narrative_report}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4">No analysis data available.</p>
                )}
              </div>
            )}

            {/* Resident grid */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Residents ({residents.length})
              </h2>
              {loading ? (
                <p className="text-sm text-gray-400">Loading residents...</p>
              ) : residents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No residents have been screened yet.</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Generate a recording link to get started.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {residents.map((r) => (
                    <ResidentVoiceCard
                      key={r.profile_id}
                      resident={r}
                      onViewHistory={handleViewHistory}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-xs text-gray-400 text-center">
          This analysis is a clinical decision support tool. It does not constitute a diagnosis.
          All flagged conditions require clinical assessment by a qualified health professional.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function SummaryCard({ label, value, color = "text-gray-900" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
