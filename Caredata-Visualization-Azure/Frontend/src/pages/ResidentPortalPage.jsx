/**
 * ResidentPortalPage, Resident-authenticated portal to view, play, and delete recordings.
 *
 * Minimal UI (no Navbar), accessible design. Uses resident_token from localStorage.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listRecordings, deleteRecording } from "../services/voiceApi";
import BrandMark from "../components/common/BrandMark";

export default function ResidentPortalPage() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const residentToken = localStorage.getItem("resident_token");

  useEffect(() => {
    if (!residentToken) {
      setError("Please use your recording link to access this page.");
      setLoading(false);
      return;
    }
    fetchRecordings();
  }, [residentToken]);

  const fetchRecordings = async () => {
    try {
      const data = await listRecordings();
      setRecordings(data.recordings || []);
    } catch {
      setError("Could not load recordings.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Are you sure you want to delete this recording?")) return;
    try {
      await deleteRecording(id);
      setRecordings((prev) => prev.filter((r) => r.recording_id !== id));
    } catch {
      alert("Could not delete recording.");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("resident_token");
    navigate("/");
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const statusColor = (s) =>
    s === "analyzed" ? "var(--sage-ink)" : s === "failed" ? "var(--clay-ink)" : "var(--amber)";

  return (
    <div className="min-h-screen px-6 py-12" style={{ background: "var(--bg-cream)" }}>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 30,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                My Recordings
              </h1>
              <p style={{ fontSize: 14, color: "var(--ink-500)", marginTop: 2 }}>
                CareData Voice Health Check
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="cd-btn cd-btn-ghost">
            Log out
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div
              className="w-10 h-10 rounded-full animate-spin mx-auto"
              style={{
                border: "3px solid var(--line)",
                borderTopColor: "var(--sage-ink)",
              }}
            />
            <p className="mt-4" style={{ fontSize: 16, color: "var(--ink-500)" }}>
              Loading recordings...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="text-center py-8 cd-surface"
            style={{ background: "var(--bg-clay-tint)" }}
          >
            <p style={{ fontSize: 16, color: "var(--clay-ink)" }}>{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && recordings.length === 0 && (
          <div className="cd-surface text-center py-12">
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 24,
                color: "var(--ink-700)",
              }}
            >
              No recordings yet.
            </p>
            <p className="mt-2" style={{ fontSize: 16, color: "var(--ink-500)" }}>
              Use your recording link to make your first voice recording.
            </p>
          </div>
        )}

        {/* Recordings list */}
        {!loading && recordings.length > 0 && (
          <div className="space-y-4">
            {recordings.map((rec) => (
              <div
                key={rec.recording_id}
                className="cd-surface p-6 flex items-center justify-between"
              >
                <div>
                  <p
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      color: "var(--ink-900)",
                    }}
                  >
                    {formatDate(rec.created_at)}
                  </p>
                  <p style={{ fontSize: 15, color: "var(--ink-500)", marginTop: 4 }}>
                    {rec.duration_s ? `${Math.round(rec.duration_s)}s` : "Unknown duration"}
                    {" · "}
                    <span style={{ color: statusColor(rec.status), fontWeight: 500 }}>
                      {rec.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(rec.recording_id)}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--clay-ink)",
                    background: "var(--bg-clay-tint)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all .15s ease",
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
