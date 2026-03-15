import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import { getUploadHistory, downloadUploadCSV } from "../../services/api";

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

export default function DashboardCSV() {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getUploadHistory()
      .then((list) => {
        if (!cancelled) setHistory(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, []);

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

  const handleViewVisualization = (uploadId) => {
    navigate(`/dashboard-csv/visualize/${uploadId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6 w-full">
        <MyDataSidebar activePage="Dashboard-CSV" />

        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Facility Dashboard (CSV)
          </h1>
          <p className="text-gray-600 mb-8">
            Each time you upload a CSV, it appears below. Download the file or open the Visualization page for charts and AI recommendations.
          </p>

          {loadingHistory && (
            <p className="text-gray-500 text-sm py-6">Loading uploads…</p>
          )}

          {!loadingHistory && history.length === 0 && (
            <p className="text-gray-500 text-sm py-6">
              No uploads yet. Go to <strong>Upload Data</strong> to upload a facility CSV.
            </p>
          )}

          {!loadingHistory && history.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">CSV file name</th>
                    <th className="px-4 py-3 font-medium">Date uploaded</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((u) => (
                    <tr key={u.uploadId} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {u.filename || u.uploadId || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatUploadDate(u.uploadedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownload(u.uploadId, u.filename)}
                            disabled={downloadingId === u.uploadId}
                            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-60"
                          >
                            {downloadingId === u.uploadId ? "Downloading…" : "Download"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewVisualization(u.uploadId)}
                            className="px-3 py-1.5 rounded-md bg-orange-500 text-white hover:bg-orange-600 text-sm font-medium"
                          >
                            View visualization
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
