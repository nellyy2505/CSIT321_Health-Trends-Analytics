import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { uploadAndAnalyzeCSV, getUploadHistory } from "../services/api";

const MAX_SIZE_MB = 5;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatUploadDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function UploadCSVPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const loadHistory = () => {
    getUploadHistory()
      .then((list) => setHistory(Array.isArray(list) ? list : []))
      .catch(() => setHistory([]));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError("");
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) setFile(f);
    setError("");
    setResult(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File must be under ${MAX_SIZE_MB} MB.`);
      return;
    }
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const data = await uploadAndAnalyzeCSV(file);
      setResult(data);
      loadHistory();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = detail != null
        ? (Array.isArray(detail) ? detail.join(" ") : String(detail))
        : (err.message || "Upload failed.");
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError("");
    setResult(null);
    if (document.getElementById("file-input")) document.getElementById("file-input").value = "";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow px-4 sm:px-6 mt-24 pb-12 pt-8 max-w-6xl mx-auto w-full">
        {/* Page header — same as HTML */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            <span className="font-bold">Data entry</span> — Upload QI data
          </h1>
          <p className="text-base text-gray-600">
            Upload your quarterly CSV export from GPMS. All 14 quality indicators will be validated automatically.
          </p>
        </div>

        {/* Two columns: upload card | submission history */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* LEFT: Quarterly CSV upload */}
          <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Quarterly CSV upload</h2>
              <p className="text-sm text-gray-500">Accepted format: GPMS export or the QI Platform template — .csv files only</p>
            </div>

            {/* Drop zone */}
            <div
              className={`mx-5 mt-5 border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition bg-gray-50 ${
                dragOver ? "border-primary bg-orange-50" : file ? "border-primary border-solid bg-orange-50/50" : "border-gray-300 hover:border-orange-400"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="text-base font-semibold text-gray-900 mb-1">Drag and drop your CSV here</div>
              <div className="text-sm text-gray-500 mb-4 leading-relaxed">or click to browse your files.<br />One file per quarterly submission.</div>
              <button
                type="button"
                className="bg-primary text-white text-sm font-semibold py-2.5 px-5 rounded-lg hover:bg-orange-600 transition"
                onClick={(e) => { e.stopPropagation(); document.getElementById("file-input")?.click(); }}
              >
                Browse files
              </button>
              <div className="text-sm text-gray-500 mt-3">Supported: .csv · Max size: {MAX_SIZE_MB} MB</div>
            </div>

            {/* File selected */}
            {file && (
              <div className="mx-5 mt-4 flex items-center gap-3 bg-orange-50/70 border border-orange-200 rounded-lg px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-gray-900 truncate">{file.name}</div>
                  <div className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB · CSV file</div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(); }} className="text-gray-400 hover:text-red-500 text-lg leading-none p-1" title="Remove file">
                  ×
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Success */}
            {result && (
              <div className="mx-5 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-base font-medium text-green-800 flex-1">
                  {result.saved ? "CSV uploaded and validated successfully." : "Analysis complete. " + (result.filename || "")}
                </span>
                {result.saved && (
                  <Link to="/dashboard-csv" className="text-base font-medium text-primary hover:underline whitespace-nowrap">
                    View Dashboard →
                  </Link>
                )}
              </div>
            )}

            {/* Submit row — single button, no Clear */}
            <div className="mx-5 mt-5 mb-5">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={uploading || !file}
                className="w-full bg-primary text-white py-2.5 rounded-md font-medium text-base hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Processing…" : "Process & Validate CSV"}
              </button>
            </div>
          </div>

          {/* RIGHT: Submission history */}
          <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                <polyline points="12 8 12 12 14 14" />
                <path d="M3.05 11a9 9 0 1 1 .5 4" />
                <polyline points="3 16 3 11 8 11" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Submission history</h3>
            </div>
            <div className="p-4">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No submissions yet. Upload a CSV above.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-sm font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="pb-2 pr-2">File</th>
                      <th className="pb-2 pr-2">Date</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.uploadId} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5 pr-2 text-gray-900 font-medium truncate max-w-[140px]" title={item.filename}>
                          {item.filename || "—"}
                        </td>
                        <td className="py-2.5 pr-2 text-gray-500 whitespace-nowrap">{formatUploadDate(item.uploadedAt)}</td>
                        <td className="py-2.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            Submitted
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
