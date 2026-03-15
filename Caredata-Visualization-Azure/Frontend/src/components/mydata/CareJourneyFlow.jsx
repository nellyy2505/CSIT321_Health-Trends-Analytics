import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import { getCareJourneyPatients, updateCareJourneyPatient, getUploadHistory } from "../../services/api";
import { GitBranch, User, CalendarDays, Activity, Info, FileSpreadsheet, Download, RefreshCw, Pencil, Save, X, Plus, Trash2 } from "lucide-react";

function downloadCareJourneyFlow(patient, displayName, displayRisk, displayTimeline) {
  if (!patient) return;
  const name = displayName || patient.id;
  const risk = displayRisk || "Low";
  const timeline = displayTimeline || {};
  const totalDays = Object.values(timeline).reduce((acc, v) => acc + (Number(v?.days) || 0), 0);

  const escapeCsv = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = [];
  rows.push("resident_id,resident_name,risk,total_journey_days");
  rows.push([patient.id, name, risk, totalDays].map(escapeCsv).join(","));
  rows.push("");
  rows.push("stage,date,duration,description,facility,treatment_type,key_activities");

  for (const s of STAGES) {
    const meta = timeline[s.key] || {};
    const keyActivities = Array.isArray(meta.key_activities) ? meta.key_activities.join("; ") : "";
    const desc = (meta.description?.trim() || s.description || "").replace(/\n/g, " ");
    rows.push(
      [
        s.label,
        meta.date ?? "",
        meta.days ?? "",
        desc,
        meta.facility ?? "",
        meta.treatment_type ?? "",
        keyActivities,
      ].map(escapeCsv).join(",")
    );
  }

  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `care-journey-${patient.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STAGES = [
  {
    key: "admission",
    label: "Admission",
    description: "Patient enters the facility. Initial intake, documentation, and baseline health recording.",
  },
  {
    key: "assessment",
    label: "Assessment",
    description: "Clinical evaluation of needs, risks, and care requirements. Care plan development begins.",
  },
  {
    key: "treatment",
    label: "Treatment",
    description: "Active care delivery. Medications, therapies, and interventions per the care plan.",
  },
  {
    key: "review",
    label: "Review",
    description: "Progress review and care plan reassessment. Adjustments made based on outcomes.",
  },
  {
    key: "discharge",
    label: "Discharge",
    description: "Transition out of facility. Handover, follow-up arrangements, and documentation completion.",
  },
];

function formatDate(d) {
  return (d && String(d).trim()) ? d : "—";
}

function hasStageData(timeline, stageKey) {
  const meta = timeline?.[stageKey];
  return meta && ((meta.date && String(meta.date).trim()) || (meta.days != null && meta.days > 0));
}

function getMissingStages(timeline) {
  return STAGES.filter((s) => !hasStageData(timeline, s.key)).map((s) => s.label);
}

function sumDays(timeline) {
  return Object.values(timeline || {}).reduce(
    (acc, v) => acc + (Number(v?.days) || 0),
    0
  );
}

function riskClass(risk) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border";
  if (risk === "High") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (risk === "Medium") return `${base} border-yellow-200 bg-yellow-50 text-yellow-700`;
  return `${base} border-green-200 bg-green-50 text-green-700`;
}

export default function CareJourneyFlow() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [csvUploads, setCsvUploads] = useState([]);
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [patientKey, setPatientKey] = useState("");
  const [activeStageKey, setActiveStageKey] = useState("treatment");
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRisk, setEditRisk] = useState("");
  const [editTimeline, setEditTimeline] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadData = (isInitial = false) => {
    if (!isInitial) setRefreshing(true);
    else setLoading(true);
    const uploadId = selectedUploadId || null;
    Promise.all([
      getUploadHistory(),
      uploadId ? getCareJourneyPatients(uploadId) : Promise.resolve({ patients: [] }),
    ])
      .then(([uploads, data]) => {
        const csvList = Array.isArray(uploads) ? uploads : [];
        setCsvUploads(csvList);
        const uploadIds = new Set(csvList.map((u) => u.uploadId));
        if (selectedUploadId && !uploadIds.has(selectedUploadId)) {
          setSelectedUploadId("");
        }
        const list = data?.patients || [];
        setPatients(list);
        if (list.length > 0) {
          setPatientKey((prev) => {
            const exists = list.some((p) => `${p.uploadId}#${p.id}` === prev);
            return exists ? prev : `${list[0].uploadId}#${list[0].id}`;
          });
        } else {
          setPatientKey("");
        }
      })
      .catch(() => {
        setPatients([]);
        setPatientKey("");
        if (isInitial) setError("Failed to load care journey data.");
      })
      .finally(() => {
        if (isInitial) setLoading(false);
        else setRefreshing(false);
      });
  };

  useEffect(() => {
    loadData(true);
  }, [selectedUploadId]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadData(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [selectedUploadId]);

  const patient = useMemo(() => {
    if (!patientKey) return patients[0] || null;
    return patients.find((p) => `${p.uploadId}#${p.id}` === patientKey) ?? patients[0] ?? null;
  }, [patientKey, patients]);

  const enterEditMode = () => {
    if (!patient) return;
    setEditName(patient.name || patient.id || "");
    setEditRisk(patient.risk || "Low");
    setEditTimeline(JSON.parse(JSON.stringify(patient.timeline || {})));
    setSaveError("");
    setEditing(true);
  };

  const exitEditMode = () => {
    setEditing(false);
    setSaveError("");
  };

  const handleSave = () => {
    if (!patient) return;
    setSaving(true);
    setSaveError("");
    const timelineToSave = Object.fromEntries(
      Object.entries(editTimeline).map(([k, v]) => [
        k,
        { ...(v || {}), days: v?.days !== "" && v?.days != null ? Number(v.days) : 0 },
      ])
    );
    updateCareJourneyPatient(patient.uploadId, patient.id, {
      name: editName.trim() || patient.id,
      risk: editRisk,
      timeline: timelineToSave,
    })
      .then(() => {
        exitEditMode();
        loadData(false);
      })
      .catch((err) => {
        setSaveError(err?.response?.data?.detail || "Failed to save changes.");
      })
      .finally(() => setSaving(false));
  };

  const updateStageField = (stageKey, field, value) => {
    setEditTimeline((prev) => {
      const next = { ...prev };
      if (!next[stageKey]) next[stageKey] = {};
      next[stageKey] = { ...next[stageKey], [field]: value };
      return next;
    });
  };

  const addKeyActivity = (stageKey, activity) => {
    if (!activity?.trim()) return;
    setEditTimeline((prev) => {
      const next = { ...prev };
      if (!next[stageKey]) next[stageKey] = {};
      const activities = Array.isArray(next[stageKey].key_activities) ? next[stageKey].key_activities : [];
      next[stageKey] = { ...next[stageKey], key_activities: [...activities, activity.trim()] };
      return next;
    });
  };

  const removeKeyActivity = (stageKey, index) => {
    setEditTimeline((prev) => {
      const next = { ...prev };
      if (!next[stageKey]) return prev;
      const activities = Array.isArray(next[stageKey].key_activities) ? next[stageKey].key_activities : [];
      next[stageKey] = { ...next[stageKey], key_activities: activities.filter((_, i) => i !== index) };
      return next;
    });
  };

  const displayTimeline = editing ? editTimeline : patient?.timeline;
  const displayName = editing ? editName : patient?.name;
  const displayRisk = editing ? editRisk : patient?.risk;

  const activeStage = useMemo(() => {
    const s = STAGES.find((x) => x.key === activeStageKey) ?? STAGES[0];
    const meta = displayTimeline?.[s.key];
    return { ...s, meta };
  }, [activeStageKey, displayTimeline]);

  const totalDays = useMemo(() => sumDays(displayTimeline), [displayTimeline]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar active="My Data" />
        <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6 w-full">
          <MyDataSidebar activePage="Care Journey Flow" />
          <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch size={18} className="text-orange-600" />
              <h1 className="text-2xl font-semibold text-gray-900">Care Journey Flow</h1>
            </div>
            <p className="text-gray-500 text-sm mt-4">Loading care journey data…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!loading && csvUploads.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar active="My Data" />
        <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6 w-full">
          <MyDataSidebar activePage="Care Journey Flow" />
          <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch size={18} className="text-orange-600" />
              <h1 className="text-2xl font-semibold text-gray-900">Care Journey Flow</h1>
            </div>
            <p className="text-gray-600 mt-2">Visualise patient journey stages with an animated pathway.</p>
            <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <FileSpreadsheet size={32} className="mx-auto text-amber-600 mb-3" />
              <p className="text-amber-800 font-medium mb-2">No care journey data yet</p>
              <p className="text-sm text-amber-700 mb-4">
                Upload a facility CSV with patient/resident data. We support flexible column names (e.g. admission_date, Admission Date).
                Dates are used to compute stage durations automatically.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/upload-csv")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-md font-medium hover:bg-amber-600 transition"
                >
                  Upload CSV
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <MyDataSidebar activePage="Care Journey Flow" />

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={18} className="text-orange-600" />
                <h1 className="text-2xl font-semibold text-gray-900">
                  Care Journey Flow
                </h1>
              </div>
              <p className="text-gray-600">
                Visualise patient journey stages with an animated pathway. Data from your CSV uploads.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadData(false)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/upload-csv")}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-600 border border-amber-500 rounded-md hover:bg-amber-50"
              >
                Upload CSV
              </button>
            </div>
          </div>

          {/* CSV upload selector (matches Uploaded History) */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-orange-600" />
              <label htmlFor="upload-select" className="text-sm font-medium text-gray-700">
                CSV upload:
              </label>
              <select
                id="upload-select"
                value={selectedUploadId}
                onChange={(e) => {
                  if (editing) exitEditMode();
                  setSelectedUploadId(e.target.value);
                }}
                disabled={editing}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 min-w-[200px] disabled:opacity-70"
              >
                <option value="">All uploads</option>
                {csvUploads.map((u) => (
                  <option key={u.uploadId} value={u.uploadId}>
                    {u.filename || u.uploadId}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-500">
              Matches Uploaded History (CSV only).{" "}
              <button
                type="button"
                onClick={() => navigate("/uploaded-history")}
                className="text-amber-600 hover:text-amber-700 font-medium"
              >
                View Uploaded History →
              </button>
              Deleting a CSV there removes its data here.
            </span>
          </div>

          {!selectedUploadId ? (
            <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-gray-700 font-medium mb-2">Select a CSV upload to view care journey data</p>
              <p className="text-sm text-gray-600 mb-4">
                Choose a specific CSV file from the dropdown above to see patient journey stages, timelines, and edit options for that upload. &quot;All uploads&quot; shows no data — select an upload to begin.
              </p>
              {csvUploads.length === 0 ? (
                <p className="text-sm text-amber-700">
                  No CSV uploads yet. <button type="button" onClick={() => navigate("/upload-csv")} className="text-amber-600 font-medium hover:underline">Upload a CSV</button> first.
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  You have {csvUploads.length} CSV upload{csvUploads.length !== 1 ? "s" : ""}. Select one from the dropdown above.
                </p>
              )}
            </div>
          ) : selectedUploadId && patients.length === 0 ? (
            <div className="mt-6 p-6 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 font-medium mb-2">No care journey data for this upload</p>
              <p className="text-sm text-amber-700 mb-4">
                This CSV may not have the expected columns (resident_id, admission_date, assessment_date, treatment_date, review_date, discharge_date, risk). Try re-uploading a CSV with those columns, or create the CareDataCareJourney DynamoDB table if it doesn&apos;t exist.
              </p>
              <button
                type="button"
                onClick={() => navigate("/upload-csv")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-md font-medium hover:bg-amber-600 transition"
              >
                Re-upload CSV
              </button>
            </div>
          ) : (
          <>
          {/* Resident selector + summary */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <User size={16} className="text-gray-500" />
                <select
                  value={patientKey}
                  onChange={(e) => {
                    if (editing) exitEditMode();
                    setPatientKey(e.target.value);
                    setActiveStageKey("treatment");
                  }}
                  disabled={editing}
                  className="text-sm outline-none bg-transparent text-gray-800 min-w-[180px] disabled:opacity-70"
                >
                  {patients.map((p) => (
                    <option key={`${p.uploadId}#${p.id}`} value={`${p.uploadId}#${p.id}`}>
                      {p.name || p.id} ({p.id}) — {p.risk || "Low"} Risk
                    </option>
                  ))}
                </select>
              </div>
              {editing ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Patient name"
                    className="text-sm border border-gray-300 rounded-md px-2 py-1.5 w-40"
                  />
                  <select
                    value={editRisk}
                    onChange={(e) => setEditRisk(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </>
              ) : (
                <>
                  <span className={riskClass(displayRisk)}>{displayRisk || "Low"} Risk</span>
                  {displayName && (
                    <span className="text-sm text-gray-600">{displayName}</span>
                  )}
                </>
              )}
              {!editing ? (
                <button
                  type="button"
                  onClick={enterEditMode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 border border-amber-500 rounded-md hover:bg-amber-50 transition"
                >
                  <Pencil size={14} />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50 transition"
                  >
                    <Save size={14} className={saving ? "animate-pulse" : ""} />
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={exitEditMode}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              {editing ? "Modify dates and durations below, then Save" : "Tip: click a stage to see details"}
            </div>
          </div>

          {saveError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {saveError}
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <KpiCard
              title="Total Journey Days"
              value={totalDays}
              icon={<Activity size={16} className="text-gray-400" />}
              hint="Sum of stage durations"
            />
            <KpiCard
              title="Current Highlight"
              value={activeStage.label}
              icon={<Info size={16} className="text-gray-400" />}
              hint="Selected stage"
            />
            <KpiCard
              title="Stage Date"
              value={formatDate(activeStage.meta?.date)}
              icon={<CalendarDays size={16} className="text-gray-400" />}
              hint={`Duration: ${activeStage.meta?.days ?? 0} day(s)`}
            />
          </div>

          {/* Diagram */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">
                Patient Journey (Animated Flow)
              </h3>
              <div className="text-xs text-gray-500">
                Node value = duration (days)
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <FlowDiagram
                  stages={STAGES}
                  timeline={displayTimeline}
                  activeStageKey={activeStageKey}
                  onSelectStage={setActiveStageKey}
                />
              </div>
            </div>
            {(() => {
              const missing = getMissingStages(displayTimeline || {});
              if (missing.length > 0 && missing.length < STAGES.length) {
                return (
                  <p className="mt-3 text-sm text-amber-700">
                    Missing data for: {missing.join(", ")}. Add dates in your CSV and re-upload to complete the journey.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          {/* Full timeline table (CSV data) */}
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Timeline from CSV
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              All stages for {displayName || patient?.id} — {editing ? "Edit dates and durations" : "dates and durations from your uploaded CSV"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-700">Stage</th>
                    <th className="px-3 py-2 font-medium text-gray-700">Description</th>
                    <th className="px-3 py-2 font-medium text-gray-700">Date</th>
                    <th className="px-3 py-2 font-medium text-gray-700">Duration (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGES.map((s) => {
                    const meta = displayTimeline?.[s.key];
                    const hasData = hasStageData(displayTimeline, s.key);
                    const dateVal = meta?.date ?? "";
                    const daysVal = meta?.days ?? "";
                    return (
                      <tr
                        key={s.key}
                        className={`border-b ${!editing ? "cursor-pointer hover:bg-gray-50" : ""} ${s.key === activeStageKey ? "bg-amber-50" : ""}`}
                        onClick={() => !editing && setActiveStageKey(s.key)}
                      >
                        <td className="px-3 py-2 font-medium text-gray-800">{s.label}</td>
                        <td className="px-3 py-2 text-gray-600 text-xs max-w-[220px]">{meta?.description?.trim() || s.description}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {editing ? (
                            <input
                              type="date"
                              value={dateVal}
                              onChange={(e) => updateStageField(s.key, "date", e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1 w-36"
                            />
                          ) : (
                            hasData ? formatDate(meta?.date) : "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              value={daysVal}
                              onChange={(e) => updateStageField(s.key, "days", e.target.value ? Number(e.target.value) : "")}
                              placeholder="0"
                              className="text-sm border border-gray-300 rounded px-2 py-1 w-20"
                            />
                          ) : (
                            hasData ? `${meta?.days ?? 0}` : "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Stage Details (selected)
              </h3>
              <div className="space-y-3 text-sm text-gray-700">
                <Row label="Stage" value={activeStage.label} />
                <Row
                  label="Date"
                  value={hasStageData(displayTimeline, activeStageKey) ? formatDate(activeStage.meta?.date) : "No data"}
                />
                <Row
                  label="Duration"
                  value={
                    hasStageData(displayTimeline, activeStageKey)
                      ? `${activeStage.meta?.days ?? 0} day(s)`
                      : "—"
                  }
                />
                {editing ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <textarea
                      value={activeStage.meta?.description ?? activeStage.description ?? ""}
                      onChange={(e) => updateStageField(activeStageKey, "description", e.target.value)}
                      placeholder={activeStage.description}
                      rows={3}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-gray-700">{activeStage.meta?.description?.trim() || activeStage.description}</p>
                  </div>
                )}

                {editing ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Facility</label>
                      <input
                        type="text"
                        value={activeStage.meta?.facility ?? ""}
                        onChange={(e) => updateStageField(activeStageKey, "facility", e.target.value)}
                        placeholder="e.g. North Wing, Ward 3"
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Treatment type</label>
                      <input
                        type="text"
                        value={activeStage.meta?.treatment_type ?? ""}
                        onChange={(e) => updateStageField(activeStageKey, "treatment_type", e.target.value)}
                        placeholder="e.g. Physical therapy, Medication management"
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Key activities</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          id={`new-activity-${activeStageKey}`}
                          placeholder="e.g. Medication started"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addKeyActivity(activeStageKey, e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`new-activity-${activeStageKey}`);
                            addKeyActivity(activeStageKey, input?.value);
                            if (input) input.value = "";
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-amber-600 border border-amber-500 rounded-md hover:bg-amber-50 text-sm font-medium"
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      </div>
                      <ul className="space-y-1.5">
                        {(Array.isArray(activeStage.meta?.key_activities) ? activeStage.meta.key_activities : []).map((act, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-2 py-1 px-2 bg-white border border-gray-200 rounded text-gray-800"
                          >
                            <span className="flex-1">• {act}</span>
                            <button
                              type="button"
                              onClick={() => removeKeyActivity(activeStageKey, i)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              aria-label="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                        {(!activeStage.meta?.key_activities || activeStage.meta.key_activities.length === 0) && (
                          <li className="text-gray-400 text-xs italic">No activities yet. Add above.</li>
                        )}
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    {(activeStage.meta?.facility || activeStage.meta?.treatment_type || (activeStage.meta?.key_activities?.length > 0)) ? (
                      <>
                        {activeStage.meta?.facility && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Facility</p>
                            <p className="text-gray-700">{activeStage.meta.facility}</p>
                          </div>
                        )}
                        {activeStage.meta?.treatment_type && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Treatment type</p>
                            <p className="text-gray-700">{activeStage.meta.treatment_type}</p>
                          </div>
                        )}
                        {activeStage.meta?.key_activities?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Key activities</p>
                            <ul className="list-disc pl-5 text-gray-700 space-y-0.5">
                              {activeStage.meta.key_activities.map((act, i) => (
                                <li key={i}>{act}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">Click Edit to add facility, treatment type, and key activities.</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Data from CSV upload session
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Overview of care journey data from your uploaded CSV files. The system stores {patients.length} resident{patients.length !== 1 ? "s" : ""} across your uploads. Each record includes resident ID, name, risk level, and a full timeline (dates, durations, descriptions, facility, treatment type, key activities) for the five stages: Admission → Assessment → Treatment → Review → Discharge.
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Data is stored in CareDataCareJourney. You can edit stage details and export the current patient&apos;s journey below.
              </p>
              <button
                type="button"
                onClick={() => downloadCareJourneyFlow(patient, displayName, displayRisk, displayTimeline)}
                className="inline-flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
              >
                <Download size={14} />
                Download Care Journey Flow
              </button>
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

function KpiCard({ title, value, icon, hint }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function FlowDiagram({ stages, timeline, activeStageKey, onSelectStage }) {
  const W = 760;
  const H = 170;
  const nodeR = 20;

  const positions = stages.map((s, i) => {
    const x = 90 + i * 150;
    const y = 70;
    return { ...s, x, y };
  });

  const activeIndex = stages.findIndex((x) => x.key === activeStageKey);

  return (
    <div className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          <style>
            {`
              .flow-line {
                stroke-dasharray: 6 6;
                animation: dash 2.2s linear infinite;
              }
              @keyframes dash {
                to { stroke-dashoffset: -24; }
              }
              .pulse {
                transform-origin: center;
                animation: pulse 1.6s ease-in-out infinite;
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.08); }
              }
            `}
          </style>
        </defs>

        {/* connectors */}
        {positions.slice(0, -1).map((p, idx) => {
          const n = positions[idx + 1];
          const isActivePath = activeIndex >= idx + 1;

          return (
            <g key={`${p.key}-${n.key}`}>
              <line
                x1={p.x + nodeR}
                y1={p.y}
                x2={n.x - nodeR}
                y2={n.y}
                stroke={isActivePath ? "#f97316" : "#d1d5db"}
                strokeWidth="3"
                className="flow-line"
              />
              <polygon
                points={`${n.x - nodeR},${n.y} ${n.x - nodeR - 10},${n.y - 6} ${
                  n.x - nodeR - 10
                },${n.y + 6}`}
                fill={isActivePath ? "#f97316" : "#d1d5db"}
              />
            </g>
          );
        })}

        {/* nodes */}
        {positions.map((p) => {
          const isActive = p.key === activeStageKey;
          const meta = timeline?.[p.key];
          const hasData = meta && ((meta.date && String(meta.date).trim()) || (meta.days != null && meta.days > 0));

          return (
            <g
              key={p.key}
              className="cursor-pointer"
              onClick={() => onSelectStage(p.key)}
            >
              <title>{p.description}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR + 10}
                fill={isActive ? "rgba(249,115,22,0.15)" : hasData ? "rgba(156,163,175,0.10)" : "rgba(156,163,175,0.05)"}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR}
                fill={isActive ? "#f97316" : "#ffffff"}
                stroke={isActive ? "#f97316" : hasData ? "#d1d5db" : "#e5e7eb"}
                strokeWidth={hasData ? "2" : "1.5"}
                strokeDasharray={!hasData ? "4 4" : "none"}
                className={isActive ? "pulse" : ""}
              />
              <text
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={isActive ? "#ffffff" : hasData ? "#374151" : "#9ca3af"}
              >
                {hasData ? String(meta?.days ?? 0) : "—"}
              </text>

              <text
                x={p.x}
                y={p.y + 45}
                textAnchor="middle"
                fontSize="12"
                fill={isActive ? "#111827" : "#374151"}
                fontWeight={isActive ? "700" : "600"}
              >
                {p.label}
              </text>

              <text
                x={p.x}
                y={p.y + 62}
                textAnchor="middle"
                fontSize="11"
                fill={hasData ? "#6b7280" : "#9ca3af"}
              >
                {hasData ? (meta?.date || "—") : "—"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
        <span>Orange line shows progress up to selected stage</span>
        <span>Click nodes to inspect</span>
      </div>
    </div>
  );
}
