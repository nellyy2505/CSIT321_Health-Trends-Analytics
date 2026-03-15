import { useState, useEffect, useMemo } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import { getUploadHistory, getDashboardCSVData } from "../../services/api";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function buildChartDataFromAPI(chartData) {
  if (!Array.isArray(chartData) || chartData.length === 0) {
    const empty = { name: "No data", value: 0 };
    return {
      radarRows: [{ subject: "No data", A: 0, fullMark: 100 }],
      barRows: [empty],
      lineRows: [empty],
      tableRows: [],
    };
  }
  const maxVal = Math.max(...chartData.map((d) => Number(d.value) || 0), 1);
  const radarRows = chartData.slice(0, 8).map((d) => ({
    subject: String(d.name).length > 14 ? String(d.name).slice(0, 12) + "…" : d.name,
    A: Number(d.value) || 0,
    fullMark: Math.max(maxVal * 1.2, 10),
  }));
  const barRows = chartData.map((d) => ({ name: String(d.name), value: Number(d.value) || 0 }));
  const lineRows = barRows.slice();
  const tableRows = chartData.map((d) => ({ label: d.name, value: String(d.value) }));
  return { radarRows, barRows, lineRows, tableRows };
}

export default function DashboardCSV() {
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getUploadHistory()
      .then((list) => {
        console.log("[DashboardCSV] getUploadHistory:", list);
        if (!cancelled) setHistory(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error("[DashboardCSV] getUploadHistory error:", err);
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDashboardData(null);
      setError("");
      return;
    }
    setLoadingDashboard(true);
    setError("");
    getDashboardCSVData(selectedId)
      .then((data) => setDashboardData(data))
      .catch((err) => {
        setDashboardData(null);
        setError(err.response?.data?.detail || err.message || "Failed to load dashboard.");
      })
      .finally(() => setLoadingDashboard(false));
  }, [selectedId]);

  const { radarRows, barRows, lineRows, tableRows } = useMemo(
    () => buildChartDataFromAPI(dashboardData?.chartData || []),
    [dashboardData?.chartData]
  );

  const trendsComing = dashboardData?.trendsComing ?? "";
  const thingsToMonitor = dashboardData?.thingsToMonitor ?? "";
  const hasRecs = trendsComing || thingsToMonitor;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6">
        <MyDataSidebar activePage="Dashboard-CSV" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Facility Dashboard (CSV)
          </h1>
          <p className="text-gray-600 mb-10">
            Same layout and diagrams as the main Dashboard. All values come from your CSV uploads (Upload Data). Select an upload to view charts and AI-Assisted Recommendations.
          </p>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Upload:</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-w-[200px]"
            >
              <option value="">— Select an upload —</option>
              {history.map((u) => (
                <option key={u.uploadId} value={u.uploadId}>
                  {u.filename || u.uploadId} {u.uploadedAt ? `(${new Date(u.uploadedAt).toLocaleDateString()})` : ""}
                </option>
              ))}
            </select>
          </div>

          {loadingHistory && <p className="text-gray-500 text-sm mb-4">Loading upload list…</p>}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {!selectedId && !loadingHistory && history.length === 0 && (
            <p className="text-gray-500 text-sm py-6">
              No uploads yet. Go to Upload Data to upload a facility CSV.
            </p>
          )}

          {selectedId && loadingDashboard && (
            <p className="text-gray-500 text-sm py-6">Generating charts and recommendations…</p>
          )}

          {selectedId && dashboardData && !loadingDashboard && (
            <>
              {/* Same layout as Dashboard page — charts and table from CSV data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Lab & test values (Radar)
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">Data from selected CSV upload — no personal information.</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={radarRows}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis />
                      <Radar
                        name="Value"
                        dataKey="A"
                        stroke="#ea580c"
                        fill="#fb923c"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Lab & test values (Bar)
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">Data from selected CSV upload — no personal information.</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barRows} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f97316" name="Value" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Lab & test values (Line)
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">Data from selected CSV upload — no personal information.</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={lineRows} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#ea580c"
                        strokeWidth={2}
                        name="Value"
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-orange-800 mb-3">
                      AI-Assisted Recommendations
                    </h3>
                    {hasRecs ? (
                      <div className="space-y-4 text-sm text-gray-700">
                        {trendsComing && (
                          <div>
                            <h4 className="font-semibold text-orange-800 mb-1">Trends coming</h4>
                            <p className="leading-relaxed whitespace-pre-line">{trendsComing}</p>
                          </div>
                        )}
                        {thingsToMonitor && (
                          <div>
                            <h4 className="font-semibold text-orange-800 mb-1">Things to monitor and improve</h4>
                            <p className="leading-relaxed whitespace-pre-line">{thingsToMonitor}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm">No recommendations generated for this upload.</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Facility data summary
                  </h3>
                  {tableRows.length > 0 ? (
                    <table className="w-full text-sm text-left border border-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-gray-700 font-medium">Field</th>
                          <th className="px-3 py-2 text-gray-700 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 font-medium">{row.label}</td>
                            <td className="px-3 py-2 text-gray-900">{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-500 text-sm py-4">No data in this upload.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
