/**
 * VoiceAlertsFeed — displays unacknowledged voice biomarker alerts.
 *
 * Props:
 *   alerts          — array of alert objects from API
 *   onAcknowledge   — async (analysisId) => void
 *   loading         — boolean
 */
export default function VoiceAlertsFeed({ alerts = [], onAcknowledge, loading = false }) {
  if (loading) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-400">Loading alerts...</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 bg-green-50 border border-green-200 rounded-xl">
        <p className="text-green-700 font-medium">No active alerts</p>
        <p className="text-sm text-green-600 mt-1">All voice biomarkers are within normal range.</p>
      </div>
    );
  }

  const formatDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const levelStyles = {
    red: { bg: "bg-red-50", border: "border-red-300", dot: "bg-red-500", text: "text-red-700" },
    amber: { bg: "bg-amber-50", border: "border-amber-300", dot: "bg-amber-500", text: "text-amber-700" },
    urgent: { bg: "bg-red-100", border: "border-red-400", dot: "bg-red-600", text: "text-red-800" },
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const style = levelStyles[alert.alert_level] || levelStyles.amber;
        return (
          <div
            key={alert.analysis_id}
            className={`${style.bg} ${style.border} border rounded-xl p-4 flex items-start justify-between gap-4`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className={`w-3 h-3 ${style.dot} rounded-full mt-1.5 flex-shrink-0`} />
              <div className="min-w-0">
                <p className={`font-semibold ${style.text}`}>
                  {alert.display_name || alert.resident_id || "Resident"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                  {alert.narrative_report
                    ? alert.narrative_report.slice(0, 120) + (alert.narrative_report.length > 120 ? "..." : "")
                    : `${alert.alert_level.toUpperCase()} alert — voice biomarker deviation detected.`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(alert.created_at)} · Confidence: {alert.confidence || "low"}
                </p>
              </div>
            </div>
            <button
              onClick={() => onAcknowledge(alert.analysis_id)}
              className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white
                         border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Acknowledge
            </button>
          </div>
        );
      })}
    </div>
  );
}
