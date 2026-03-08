import { useState, useEffect, useMemo } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import { getMyData } from "../../services/api";
import { HEALTH_SCAN_RESULT_KEY } from "../../constants";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function parseNum(s) {
  if (s == null || s === "") return null;
  const n = parseFloat(String(s).trim());
  return isNaN(n) ? null : n;
}

// Never show personal/demographic info in charts — only health data (lab results, vitals, etc.)
const PERSONAL_LIKE = new Set([
  "age", "year of birth", "date of birth", "dob", "yob", "birth year", "birth date",
  "height", "weight", "bmi", "sex", "gender", "patient name", "name", "birth", "years old",
  "address", "phone", "id", "patient id", "patient id number",
]);

function isPersonalInfo(label) {
  const lower = String(label).toLowerCase();
  if (PERSONAL_LIKE.has(lower)) return true;
  if (lower.includes("year of birth") || lower.includes("date of birth") || lower.includes("patient name")) return true;
  if (lower.includes("birth") && (lower.includes("year") || lower.includes("date"))) return true;
  if (lower === "name" || lower === "age") return true;
  return false;
}

/** Match chart suggestion key to entry (handles truncated names). */
function keyMatchesSuggestion(fullLabel, suggestion) {
  if (!suggestion || !fullLabel) return false;
  const s = String(suggestion).trim().toLowerCase();
  const l = String(fullLabel).toLowerCase();
  return l === s || l.startsWith(s) || s.startsWith(l);
}

/** Filter entries to only those whose fullLabel is in the suggested list. */
function filterBySuggestions(entries, suggestedKeys) {
  if (!suggestedKeys || !Array.isArray(suggestedKeys) || suggestedKeys.length === 0) return entries;
  return entries.filter((e) => suggestedKeys.some((k) => keyMatchesSuggestion(e.fullLabel, k)));
}

/** Charts use only health data — never personal info (name, age, DOB, year, etc.). */
function buildChartDataFromMyData(keyInformation, patientContext, clinicalMeasurements, trendAndRisk, chartSuggestions) {
  const allSections = [clinicalMeasurements, keyInformation, trendAndRisk, patientContext];
  const numericEntries = []; // each: { name (short), value, fullLabel }
  allSections.forEach((section) => {
    if (!section || typeof section !== "object") return;
    Object.entries(section).forEach(([label, value]) => {
      const n = parseNum(value);
      if (n != null && isFinite(n)) {
        const shortName = label.length > 18 ? label.slice(0, 16) + "…" : label;
        numericEntries.push({ name: shortName, value: n, fullLabel: label });
      }
    });
  });

  // Never include personal info in any chart — only health data
  const healthOnly = numericEntries.filter((e) => !isPersonalInfo(e.fullLabel));

  const radarKeys = chartSuggestions?.radar;
  const barKeys = chartSuggestions?.bar;
  const lineKeys = chartSuggestions?.line;
  const useSuggestions = (radarKeys?.length || barKeys?.length || lineKeys?.length) > 0;

  const radarSource = useSuggestions && radarKeys?.length
    ? filterBySuggestions(healthOnly, radarKeys)
    : healthOnly;
  const barSource = useSuggestions && barKeys?.length
    ? filterBySuggestions(healthOnly, barKeys)
    : healthOnly;
  const lineSource = useSuggestions && lineKeys?.length
    ? filterBySuggestions(healthOnly, lineKeys)
    : healthOnly;

  const r = radarSource.length ? radarSource : healthOnly;
  const b = barSource.length ? barSource : healthOnly;
  const l = lineSource.length ? lineSource : healthOnly;

  const maxValR = Math.max(...r.map((d) => d.value), 1);
  const radarRows = (r.length ? r : []).slice(0, 6).map((d) => ({
    subject: d.name,
    A: d.value,
    fullMark: Math.max(maxValR * 1.2, 10),
  }));
  const barRows = (b.length ? b : []).map((d) => ({ name: d.name, value: d.value }));
  const lineRows = (l.length ? l : []).map((d) => ({ name: d.name, value: d.value }));
  const tableRows = [];
  [keyInformation, patientContext, clinicalMeasurements, trendAndRisk].forEach((section) => {
    if (!section || typeof section !== "object") return;
    Object.entries(section).forEach(([label, value]) => {
      if (value != null && String(value).trim() !== "") tableRows.push({ label, value: String(value) });
    });
  });

  const emptyBar = [{ name: "No data", value: 0 }];
  return {
    radarRows: radarRows.length ? radarRows : [{ subject: "No data", A: 0, fullMark: 100 }],
    barRows: barRows.length ? barRows : emptyBar,
    lineRows: lineRows.length ? lineRows : emptyBar,
    tableRows,
    hasNumeric: barRows.length > 0 || lineRows.length > 0,
  };
}

function getByKey(obj, ...keys) {
  if (!obj || typeof obj !== "object") return null;
  const lowerKeys = keys.map((k) => String(k).toLowerCase());
  for (const [objKey, val] of Object.entries(obj)) {
    if (val == null || String(val).trim() === "") continue;
    if (keys.includes(objKey) || lowerKeys.includes(String(objKey).toLowerCase())) return String(val).trim();
  }
  return null;
}

function getAIRecommendation(keyInformation, patientContext, clinicalMeasurements, trendAndRisk) {
  const ki = keyInformation || {};
  const tr = trendAndRisk || {};
  const cm = clinicalMeasurements || {};
  const hasData =
    Object.keys(ki).length > 0 || Object.keys(patientContext || {}).length > 0 ||
    Object.keys(cm).length > 0 || Object.keys(tr).length > 0;

  if (!hasData) {
    return "Add data in My Data or run a Health Scan to see personalized insights and recommendations here.";
  }

  const parts = [];

  const summary = getByKey(ki, "Overall summary", "Summary", "Interpretation", "Notable finding") ||
    getByKey(tr, "Interpretation", "Summary");
  if (summary) parts.push(summary);

  const testType = getByKey(ki, "Test type", "Report title");
  if (testType) parts.push(`Report type: ${testType}.`);

  const totalIge = getByKey(ki, "Total IgE") || getByKey(cm, "Total IgE");
  if (totalIge) {
    const ref = getByKey(ki, "Total IgE reference range") || getByKey(cm, "Total IgE reference range");
    if (ref) parts.push(`Total IgE ${totalIge} (reference: ${ref}).`);
    else parts.push(`Total IgE: ${totalIge}.`);
  }

  const trendVal = getByKey(tr, "Trend", "trend");
  if (trendVal && String(trendVal).toLowerCase().includes("increasing")) {
    parts.push("Trend is increasing; a follow-up with your doctor may be helpful.");
  }
  const severity = getByKey(tr, "Severity", "severity");
  if (severity && (String(severity).includes("Moderate") || String(severity).includes("Severe") || String(severity).toLowerCase().includes("borderline"))) {
    parts.push("Some results are outside or borderline to the normal range—discuss with your healthcare provider.");
  }

  const suspicious = [];
  Object.entries(cm).forEach(([label, value]) => {
    const v = String(value).toLowerCase();
    if (v.includes("suspicious") || v.includes("positive") || v.includes("elevated") || v.includes("borderline")) {
      suspicious.push(`${label}: ${value}`);
    }
  });
  if (suspicious.length > 0) {
    parts.push("Items to discuss with your doctor: " + suspicious.slice(0, 3).join("; ") + ".");
  }

  if (parts.length === 0) {
    parts.push("Your data is summarized in the charts and table above. Discuss any concerns with your healthcare provider.");
  }

  return parts.join(" ");
}

export default function Dashboard() {
  const [myData, setMyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyData()
      .then((data) => {
        if (!cancelled && data) setMyData(data);
      })
      .catch(() => {
        if (!cancelled) setMyData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const keyInformation = myData?.keyInformation || {};
  const patientContext = myData?.patientContext || {};
  const clinicalMeasurements = myData?.clinicalMeasurements || {};
  const trendAndRisk = myData?.trendAndRisk || {};

  // Display recommendations: from API (saved after Health Scan) or from localStorage if save failed
  const savedRecs = myData?.recommendations && (myData.recommendations.actions || myData.recommendations.diet || myData.recommendations.exercise || myData.recommendations.risks)
    ? myData.recommendations
    : null;
  const localScan = (() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(HEALTH_SCAN_RESULT_KEY) : null;
      if (!raw) return null;
      const data = JSON.parse(raw);
      const rec = data?.recommendations;
      if (rec && (rec.actions || rec.diet || rec.exercise || rec.risks)) return rec;
      return null;
    } catch {
      return null;
    }
  })();
  const displayedRecs = savedRecs || localScan;
  const chartSuggestions = null;
  const { radarRows, barRows, lineRows, tableRows } = useMemo(
    () => buildChartDataFromMyData(keyInformation, patientContext, clinicalMeasurements, trendAndRisk, chartSuggestions),
    [keyInformation, patientContext, clinicalMeasurements, trendAndRisk, chartSuggestions]
  );

  const radarData = radarRows;
  const barData = barRows;
  const lineData = lineRows;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6">
        <MyDataSidebar activePage="Dashboard" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Your Health Dashboard
          </h1>
          <p className="text-gray-600 mb-10">
            Charts and summary from your My Data. Run a Health Scan or edit My Data to update.
          </p>

          {loading && (
            <p className="text-center text-gray-500 text-sm mb-6">Loading your data…</p>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Lab & test values (Radar)
              </h3>
              <p className="text-xs text-gray-500 mb-2">Health data only — no name, age, or date of birth.</p>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
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
              <p className="text-xs text-gray-500 mb-2">Health data only — no personal information.</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f97316" name="Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line Chart + AI Recommendation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Lab & test values (Line)
              </h3>
              <p className="text-xs text-gray-500 mb-2">Health data only — no personal information.</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={lineData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                {displayedRecs && (displayedRecs.actions || displayedRecs.diet || displayedRecs.exercise || displayedRecs.risks) && (
                  <div className="space-y-4 text-sm text-gray-700">
                    {displayedRecs.actions && (
                      <div>
                        <h4 className="font-semibold text-orange-800 mb-1">What to do</h4>
                        <p className="leading-relaxed whitespace-pre-line">{displayedRecs.actions}</p>
                      </div>
                    )}
                    {displayedRecs.diet && (
                      <div>
                        <h4 className="font-semibold text-orange-800 mb-1">Diet: what to eat & avoid</h4>
                        <p className="leading-relaxed whitespace-pre-line">{displayedRecs.diet}</p>
                      </div>
                    )}
                    {displayedRecs.exercise && (
                      <div>
                        <h4 className="font-semibold text-orange-800 mb-1">Exercise & activity</h4>
                        <p className="leading-relaxed whitespace-pre-line">{displayedRecs.exercise}</p>
                      </div>
                    )}
                    {displayedRecs.risks && (
                      <div>
                        <h4 className="font-semibold text-orange-800 mb-1">Possible risks / conditions</h4>
                        <p className="leading-relaxed whitespace-pre-line">{displayedRecs.risks}</p>
                      </div>
                    )}
                  </div>
                )}
                {(!displayedRecs || (!displayedRecs.actions && !displayedRecs.diet && !displayedRecs.exercise && !displayedRecs.risks)) && (
                  <p className="text-gray-700 leading-relaxed text-sm">
                    Run a Health Scan to get AI-Assisted Recommendations (what to do, diet, exercise & activity, possible risks). They are generated when you analyze images and saved here.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                My Data summary
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
                <p className="text-gray-500 text-sm py-4">
                  No data yet. Add data in My Data or run a Health Scan to see your summary here.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
