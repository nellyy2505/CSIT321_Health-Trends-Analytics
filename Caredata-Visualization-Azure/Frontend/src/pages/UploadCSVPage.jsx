import { useState } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { uploadAndAnalyzeCSV } from "../services/api";

const MAX_SIZE_MB = 5;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function UploadCSVPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError("");
    setResult(null);
  };

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 mt-24 pb-12 pt-12">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-center text-gray-900 mb-2">
            Upload Facility Data
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Upload a CSV file from a healthcare facility. We&apos;ll analyze it with AI and save it to your history.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-400 transition cursor-pointer">
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-gray-400 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6H16a5 5 0 011 9.9m-5 3.1v-8m0 0l-3 3m3-3l3 3"
                  />
                </svg>
                <span className="text-gray-700 font-medium">
                  {file ? file.name : "Click or drag a CSV file to upload"}
                </span>
                <span className="text-gray-500 text-sm mt-1">
                  (Only .csv, max {MAX_SIZE_MB} MB)
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full bg-primary text-white py-2.5 rounded-md font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Analyzing…" : "Upload & Analyze"}
            </button>
          </form>

          {result && (
            <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Analysis result</h3>
              <p className="text-gray-600 mb-2">
                <strong>{result.filename}</strong>
                {result.saved === true
                  ? " — saved. View it in Dashboard-CSV or Uploaded History."
                  : " — analysis complete but not saved to history (DynamoDB table may be missing). It won’t appear in Uploaded History or Dashboard-CSV until you create the table and upload again."}
              </p>
              {result.analysis?.summary && (
                <p className="text-gray-700 mb-2">{result.analysis.summary}</p>
              )}
              {result.analysis?.keyMetrics && Object.keys(result.analysis.keyMetrics).length > 0 && (
                <div className="mt-2">
                  <h4 className="font-medium text-gray-700 mb-1">Key metrics</h4>
                  <ul className="list-disc list-inside text-gray-600">
                    {Object.entries(result.analysis.keyMetrics).map(([k, v]) => (
                      <li key={k}>{k}: {String(v)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
            <h3 className="font-semibold mb-2">Guidelines</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Use a .CSV file with clear column headers.</li>
              <li>Data should describe facility metrics (e.g. admissions, length of stay, readmissions).</li>
              <li>For Care Journey Flow: include resident_id, dates (admission, assessment, treatment, review, discharge), risk.</li>
              <li>Maximum file size: {MAX_SIZE_MB} MB.</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
