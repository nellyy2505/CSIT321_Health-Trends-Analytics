import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { analyzeHealthScanImages, saveMyData } from "../services/api";
import { HEALTH_SCAN_RESULT_KEY } from "../constants";

const ACCEPT_IMAGE = "image/*";
const MAX_SIZE_MB = 10;
const MAX_IMAGES = 5;

export default function HealthScanPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastPromptSent, setLastPromptSent] = useState(null);
  const [showPromptDetail, setShowPromptDetail] = useState(false);
  const [analysisJustComplete, setAnalysisJustComplete] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setError("");
    setAnalysisJustComplete(false);
    setLastPromptSent(null);
    if (selected.length === 0) {
      setFiles([]);
      setPreviews([]);
      return;
    }
    const oversized = selected.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(`Each file must be under ${MAX_SIZE_MB} MB.`);
      setFiles([]);
      setPreviews([]);
      return;
    }
    const next = selected.slice(0, MAX_IMAGES);
    if (selected.length > MAX_IMAGES) setError(`Maximum ${MAX_IMAGES} images. Only the first ${MAX_IMAGES} were added.`);
    setFiles(next);
    const loadPreviews = next.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });
    Promise.all(loadPreviews).then(setPreviews);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setError("");
  };

  const clearAll = () => {
    setFiles([]);
    setPreviews([]);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!files.length) {
      setError("Please select at least one image.");
      return;
    }
    setError("");
    setIsAnalyzing(true);
    try {
      const result = await analyzeHealthScanImages(files);
      if (result.debug?.promptSent) {
        console.log("[Health Scan] Prompt that was sent:", result.debug.promptSent);
        setLastPromptSent(result.debug.promptSent);
      } else {
        setLastPromptSent(null);
      }
      const { debug, ...dataToSave } = result;
      try {
        await saveMyData(dataToSave);
      } catch (err) {
        console.warn("[Health Scan] Save to server failed, using localStorage:", err?.response?.data || err.message);
        localStorage.setItem(HEALTH_SCAN_RESULT_KEY, JSON.stringify(dataToSave));
      }
      setAnalysisJustComplete(true);
    } catch (err) {
      let msg = err.response?.data?.detail || err.message || "Analysis failed.";
      if (err.code === "ERR_NETWORK" || err.message?.includes("Connection refused") || err.message?.includes("Failed to fetch")) {
        msg = "Cannot reach the server. Start the backend (e.g. uvicorn app.main:app --reload --port 8000).";
      }
      setError(Array.isArray(msg) ? msg.join(" ") : msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar active="Health Scan" />

      <main className="flex-grow flex items-center justify-center px-4 mt-24 pb-12 pt-12">
        <div className="cd-surface w-full max-w-2xl p-8">
          <div className="text-center mb-8">
            <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
              <span className="dot" /> AI assist
            </span>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 34,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              Health Scan
            </h1>
            <p style={{ color: "var(--ink-500)", fontSize: 14, marginTop: 6 }}>
              Upload 1&ndash;{MAX_IMAGES} images of your health records. We&apos;ll analyse them and surface
              insights in My Data.
            </p>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-6">
            {/* Upload area */}
            <div
              className="text-center cursor-pointer"
              style={{
                border: `2px dashed ${files.length ? "var(--sage-ink)" : "var(--line-strong)"}`,
                background: files.length ? "var(--bg-sage-tint)" : "var(--bg-paper)",
                borderRadius: 14,
                padding: 32,
                transition: "all .15s ease",
              }}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_IMAGE}
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  style={{ color: "var(--ink-400)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-900)" }}>
                  {files.length
                    ? `${files.length} image(s) selected`
                    : `Click to upload (max ${MAX_IMAGES} images)`}
                </span>
                <span className="mt-1" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                  PNG, JPG, or WEBP &middot; max {MAX_SIZE_MB} MB each
                </span>
              </div>
            </div>

            {/* Previews */}
            {previews.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>Previews</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="hover:underline"
                    style={{ fontSize: 13, color: "var(--sage-ink)", fontWeight: 500 }}
                  >
                    Clear all
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {previews.map((src, i) => (
                    <div
                      key={i}
                      className="relative overflow-hidden aspect-square"
                      style={{
                        border: "1px solid var(--line)",
                        background: "var(--bg-paper)",
                        borderRadius: 12,
                      }}
                    >
                      <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 rounded-full p-1"
                        style={{
                          background: "rgba(31,38,34,0.78)",
                          color: "var(--bg-white)",
                        }}
                        aria-label="Remove image"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span
                        className="absolute bottom-1 left-1 rounded px-1.5 py-0.5"
                        style={{
                          fontSize: 11,
                          color: "var(--bg-white)",
                          background: "rgba(31,38,34,0.55)",
                        }}
                      >
                        {files[i]?.name?.slice(0, 12)}{files[i]?.name?.length > 12 ? "…" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p
                className="px-3 py-2"
                style={{
                  fontSize: 13,
                  color: "var(--clay-ink)",
                  background: "var(--bg-clay-tint)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!files.length || isAnalyzing}
              className="cd-btn cd-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? "Analysing…" : "Analyse health record" + (files.length > 1 ? "s" : "")}
            </button>
          </form>

          {analysisJustComplete && (
            <div
              className="mt-6 p-4"
              style={{
                background: "var(--bg-sage-tint)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            >
              <p className="mb-3" style={{ fontWeight: 500, color: "var(--sage-ink)" }}>
                Analysis saved. View results in My Data.
              </p>
              {lastPromptSent ? (
                <div className="text-left">
                  <button
                    type="button"
                    onClick={() => setShowPromptDetail((v) => !v)}
                    className="hover:underline mb-2"
                    style={{ fontSize: 13, fontWeight: 500, color: "var(--sage-ink)" }}
                  >
                    {showPromptDetail ? "Hide" : "Show"} prompt sent to ChatGPT (verify it&apos;s correct)
                  </button>
                  {showPromptDetail && (
                    <div className="mt-2 space-y-3" style={{ fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 500, color: "var(--ink-700)" }}>System prompt:</span>
                        <pre
                          className="mt-1 p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words"
                          style={{
                            background: "var(--bg-paper)",
                            border: "1px solid var(--line-soft)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--ink-700)",
                          }}
                        >
                          {lastPromptSent.system}
                        </pre>
                      </div>
                      <div>
                        <span style={{ fontWeight: 500, color: "var(--ink-700)" }}>User text:</span>
                        <pre
                          className="mt-1 p-3 overflow-auto whitespace-pre-wrap"
                          style={{
                            background: "var(--bg-paper)",
                            border: "1px solid var(--line-soft)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--ink-700)",
                          }}
                        >
                          {lastPromptSent.userText}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--amber)" }}>
                  Prompt not returned, backend may be older. Restart it to surface the prompt here.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setAnalysisJustComplete(false);
                  setLastPromptSent(null);
                  setShowPromptDetail(false);
                  navigate("/mydata");
                }}
                className="cd-btn cd-btn-primary mt-3 w-full justify-center"
              >
                Go to My Data
              </button>
            </div>
          )}

          <div
            className="mt-8 p-5"
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: 12,
              fontSize: 13,
              color: "var(--ink-700)",
            }}
          >
            <h3 className="mb-2" style={{ fontWeight: 600, color: "var(--ink-900)" }}>Guidelines</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Upload 1&ndash;{MAX_IMAGES} clear photos or scans (lab results, discharge summary, etc.).</li>
              <li>Supported formats: PNG, JPG, WEBP. Max {MAX_SIZE_MB} MB per image.</li>
              <li>Multiple images are combined into one summary in My Data.</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
