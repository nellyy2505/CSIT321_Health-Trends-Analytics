/**
 * ResidentVoiceCard — summary card for a resident's voice biomarker status.
 *
 * Shows name, alert level dot, recording count, metrics, and link status.
 *
 * Props:
 *   resident — { profile_id, resident_id, display_name, recording_count, baseline_established, latest_analysis }
 *   onViewHistory — (residentId) => void
 *   hasLink — boolean — whether resident has an active recording link
 */

const ALERT_COLORS = {
  green: { dot: "bg-green-500", bg: "bg-green-50", label: "Normal" },
  amber: { dot: "bg-amber-500", bg: "bg-amber-50", label: "Monitor" },
  red: { dot: "bg-red-500", bg: "bg-red-50", label: "Alert" },
};

export default function ResidentVoiceCard({ resident, onViewHistory, hasLink = false }) {
  const latest = resident.latest_analysis;
  const alertLevel = latest?.alert_level || "green";
  const style = ALERT_COLORS[alertLevel] || ALERT_COLORS.green;

  const features = latest?.acoustic_features || {};
  const speechRate = features.speech_rate_proxy;
  const pauseDuration = features.mean_pause_duration_s;
  const pitch = features.pitch_mean_hz;
  const jitter = features.jitter_pct;
  const hasData = latest != null;
  const hasTranscript = !!latest?.transcript;

  return (
    <div className={`${style.bg} border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-3 h-3 ${style.dot} rounded-full`} />
          <h3 className="font-semibold text-gray-900">
            {resident.display_name || resident.resident_id || "Resident"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasLink && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Link Active
            </span>
          )}
          <span className="text-xs text-gray-500">
            {resident.recording_count || 0} recording{(resident.recording_count || 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Metrics */}
      {hasData ? (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-500">Speech Rate</p>
            <p className="text-lg font-semibold text-gray-900">
              {speechRate != null ? `${speechRate}/s` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg Pause</p>
            <p className="text-lg font-semibold text-gray-900">
              {pauseDuration != null ? `${pauseDuration.toFixed(2)}s` : "—"}
            </p>
          </div>
          {pitch > 0 && (
            <div>
              <p className="text-xs text-gray-500">Pitch</p>
              <p className="text-lg font-semibold text-gray-900">{pitch.toFixed(0)} Hz</p>
            </div>
          )}
          {jitter > 0 && (
            <div>
              <p className="text-xs text-gray-500">Jitter</p>
              <p className="text-lg font-semibold text-gray-900">{jitter.toFixed(2)}%</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-3">No analysis data yet.</p>
      )}

      {/* Risk scores if available */}
      {latest?.risk_scores?.overall_deviation_pct != null && (
        <div className="mb-3">
          <p className="text-xs text-gray-500">Baseline Deviation</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  alertLevel === "red"
                    ? "bg-red-500"
                    : alertLevel === "amber"
                    ? "bg-amber-500"
                    : "bg-green-500"
                }`}
                style={{
                  width: `${Math.min(100, latest.risk_scores.overall_deviation_pct)}%`,
                }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {latest.risk_scores.overall_deviation_pct.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Alert status label + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              alertLevel === "red"
                ? "bg-red-200 text-red-800"
                : alertLevel === "amber"
                ? "bg-amber-200 text-amber-800"
                : "bg-green-200 text-green-800"
            }`}
          >
            {style.label}
          </span>
          {hasTranscript && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Transcript
            </span>
          )}
        </div>
        {onViewHistory && (
          <button
            onClick={() => onViewHistory(resident.resident_id)}
            className="text-sm text-primary font-medium hover:underline"
          >
            View History
          </button>
        )}
      </div>
    </div>
  );
}
