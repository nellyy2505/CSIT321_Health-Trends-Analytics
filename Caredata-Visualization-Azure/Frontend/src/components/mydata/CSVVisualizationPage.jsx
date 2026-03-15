import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import { getDashboardCSVData, getUploadById } from "../../services/api";
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

const TABS = [
  { id: "basic-info", label: "Basic information" },
  { id: "basic-visualize", label: "Basic Visualize" },
  { id: "ai-recommendations", label: "AI-Assisted Recommendations" },
  { id: "3d-visualize", label: "3D Visualize" },
];

export default function CSVVisualizationPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic-info");
  const [upload, setUpload] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uploadId) {
      setError("Missing upload");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([
      getUploadById(uploadId).catch(() => null),
      getDashboardCSVData(uploadId).catch((err) => {
        throw err;
      }),
    ])
      .then(([u, data]) => {
        setUpload(u || null);
        setDashboardData(data || null);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || "Failed to load data.");
        setDashboardData(null);
      })
      .finally(() => setLoading(false));
  }, [uploadId]);

  const { radarRows, barRows, lineRows, tableRows } = useMemo(
    () => buildChartDataFromAPI(dashboardData?.chartData || []),
    [dashboardData?.chartData]
  );

  const trendsComing = dashboardData?.trendsComing ?? "";
  const thingsToMonitor = dashboardData?.thingsToMonitor ?? "";
  const hasRecs = trendsComing || thingsToMonitor;

  if (!uploadId) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto w-full">
          <p className="text-red-600">Missing upload ID.</p>
          <button type="button" onClick={() => navigate("/dashboard-csv")} className="mt-4 text-orange-600 underline">
            Back to Dashboard CSV
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6 w-full">
        <MyDataSidebar activePage="Dashboard-CSV" />

        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Visualization {upload?.filename ? `— ${upload.filename}` : ""}
              </h1>
              <button
                type="button"
                onClick={() => navigate("/dashboard-csv")}
                className="mt-1 text-sm text-orange-600 hover:underline"
              >
                ← Back to Dashboard CSV
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading && (
            <p className="text-gray-500 py-8">Loading…</p>
          )}

          {error && !loading && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-6">
              {error}
            </div>
          )}

          {!loading && !error && dashboardData && (
            <>
              {/* Tab: Basic information — Facility data summary table */}
              {activeTab === "basic-info" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Facility data summary</h2>
                  {tableRows.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-gray-700 font-medium">Field</th>
                            <th className="px-4 py-2 text-gray-700 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row, i) => (
                            <tr key={i} className="border-t border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-700 font-medium">{row.label}</td>
                              <td className="px-4 py-2 text-gray-900">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No summary data for this upload.</p>
                  )}
                </div>
              )}

              {/* Tab: Basic Visualize — All charts */}
              {activeTab === "basic-visualize" && (
                <div className="space-y-8">
                  <h2 className="text-lg font-semibold text-gray-800">Charts</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-800 mb-3">Radar</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={radarRows}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" />
                          <PolarRadiusAxis />
                          <Radar name="Value" dataKey="A" stroke="#ea580c" fill="#fb923c" fillOpacity={0.5} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-800 mb-3">Bar</h3>
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
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-gray-800 mb-3">Line</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={lineRows} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2} name="Value" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tab: AI-Assisted Recommendations */}
              {activeTab === "ai-recommendations" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">AI-Assisted Recommendations</h2>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                    {hasRecs ? (
                      <div className="space-y-6 text-sm text-gray-700">
                        {trendsComing && (
                          <div>
                            <h4 className="font-semibold text-orange-800 mb-2">Trends coming</h4>
                            <p className="leading-relaxed whitespace-pre-line">{trendsComing}</p>
                          </div>
                        )}
                        {thingsToMonitor && (
                          <div>
                            <h4 className="font-semibold text-orange-800 mb-2">Things to monitor and improve</h4>
                            <p className="leading-relaxed whitespace-pre-line">{thingsToMonitor}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-600">No recommendations generated for this upload.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: 3D Visualize — empty for now */}
              {activeTab === "3d-visualize" && (
                <div className="py-12 text-center text-gray-500">
                  <p>3D Visualize — coming soon.</p>
                  <p className="text-sm mt-2">This tab is reserved for future 3D visualization.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
