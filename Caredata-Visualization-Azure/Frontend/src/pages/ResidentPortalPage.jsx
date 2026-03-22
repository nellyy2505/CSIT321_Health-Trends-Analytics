/**
 * ResidentPortalPage — Resident-authenticated portal to view, play, and delete recordings.
 *
 * Minimal UI (no Navbar), accessible design. Uses resident_token from localStorage.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listRecordings, deleteRecording } from "../services/voiceApi";

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

  return (
    <div className="min-h-screen bg-white px-6 py-12">
      {/* Header */}
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Recordings</h1>
            <p className="text-lg text-gray-500 mt-1">CareData Voice Health Check</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2 text-lg text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Log out
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg text-gray-500 mt-4">Loading recordings...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-lg text-red-600 text-center py-8">{error}</p>
        )}

        {/* Empty state */}
        {!loading && !error && recordings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-2xl text-gray-400">No recordings yet.</p>
            <p className="text-lg text-gray-400 mt-2">
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
                className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex items-center justify-between"
              >
                <div>
                  <p className="text-xl font-medium text-gray-900">
                    {formatDate(rec.created_at)}
                  </p>
                  <p className="text-lg text-gray-500">
                    {rec.duration_s ? `${Math.round(rec.duration_s)}s` : "Unknown duration"}
                    {" · "}
                    <span
                      className={
                        rec.status === "analyzed"
                          ? "text-green-600"
                          : rec.status === "failed"
                          ? "text-red-500"
                          : "text-amber-500"
                      }
                    >
                      {rec.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(rec.recording_id)}
                  className="px-4 py-2 text-lg text-red-600 border border-red-200 rounded-lg
                             hover:bg-red-50 transition-colors"
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
