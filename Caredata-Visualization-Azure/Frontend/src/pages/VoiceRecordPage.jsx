/**
 * VoiceRecordPage, Public resident-facing recording page.
 *
 * Accessed via /voice/record/:token (no Navbar, no Footer).
 * Elderly-accessible: large fonts, high contrast, minimal UI.
 *
 * Flow:
 *   1. Validate link token
 *   2. If no account → registration form (name + 4-char password)
 *   3. If has account → login (password only)
 *   4. Consent screen (first time only)
 *   5. After auth + consent → show recording interface with prompt
 */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  validateVoiceLink,
  registerResident,
  loginResident,
  uploadRecording,
  getRandomPrompt,
  getConsent,
  updateConsent,
} from "../services/voiceApi";
import RecordingWidget from "../components/voice/RecordingWidget";
import BrandMark from "../components/common/BrandMark";

const inputStyle = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  color: "var(--ink-900)",
  fontSize: 22,
  padding: "16px 20px",
  outline: "none",
  width: "100%",
};

export default function VoiceRecordPage() {
  const { token } = useParams();
  const [step, setStep] = useState("loading"); // loading | invalid | register | login | consent | record
  const [linkData, setLinkData] = useState(null);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState(null);

  // Registration / login fields
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Validate link on mount
  useEffect(() => {
    if (!token) {
      setStep("invalid");
      return;
    }
    validateVoiceLink(token)
      .then((data) => {
        setLinkData(data);
        if (!data.valid) {
          setStep("invalid");
        } else if (data.has_account) {
          setStep("login");
        } else {
          setStep("register");
        }
      })
      .catch(() => {
        setStep("invalid");
      });
  }, [token]);

  // Load prompt when entering record step
  useEffect(() => {
    if (step === "record" && !prompt) {
      getRandomPrompt()
        .then(setPrompt)
        .catch(() =>
          setPrompt({
            id: "fallback",
            type: "open_response",
            text: "Please tell me about your day today.",
          })
        );
    }
  }, [step, prompt]);

  // After successful auth, check consent
  const proceedAfterAuth = useCallback(async () => {
    try {
      const { consent_status } = await getConsent();
      if (consent_status === "active") {
        setStep("record");
      } else {
        setStep("consent");
      }
    } catch {
      setStep("consent");
    }
  }, []);

  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      if (displayName.trim().length < 1) {
        setError("Please enter your name.");
        return;
      }
      if (password.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await registerResident(token, displayName.trim(), password);
        localStorage.setItem("resident_token", result.access_token);
        setStep("consent");
      } catch (err) {
        const msg = err.response?.data?.detail || "Registration failed. Please try again.";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setSubmitting(false);
      }
    },
    [token, displayName, password]
  );

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      if (password.length < 4) {
        setError("Please enter your password.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await loginResident(linkData.resident_id, password);
        localStorage.setItem("resident_token", result.access_token);
        await proceedAfterAuth();
      } catch (err) {
        const msg = err.response?.data?.detail || "Login failed. Please check your password.";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setSubmitting(false);
      }
    },
    [linkData, password, proceedAfterAuth]
  );

  const handleConsent = useCallback(async () => {
    setSubmitting(true);
    try {
      await updateConsent(true);
      setStep("record");
    } catch {
      setError("Failed to save consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleUpload = useCallback(async (wavBlob) => {
    const file = new File([wavBlob], "recording.wav", { type: "audio/wav" });
    await uploadRecording(file);
  }, []);

  const bigBtn = {
    width: "100%",
    padding: "20px",
    fontSize: 22,
    fontWeight: 600,
    borderRadius: 14,
    border: "1px solid var(--ink-900)",
    background: "var(--ink-900)",
    color: "var(--bg-white)",
    cursor: submitting ? "not-allowed" : "pointer",
    opacity: submitting ? 0.6 : 1,
    transition: "all .15s ease",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--bg-cream)" }}
    >
      {/* Logo / Header */}
      <div className="mb-10 text-center flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 38,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
            }}
          >
            CareData
          </span>
        </div>
        <p style={{ fontSize: 18, color: "var(--ink-500)" }}>Voice Health Check</p>
      </div>

      {/* Loading */}
      {step === "loading" && (
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full animate-spin mx-auto"
            style={{
              border: "3px solid var(--line)",
              borderTopColor: "var(--sage-ink)",
            }}
          />
          <p className="mt-4" style={{ fontSize: 18, color: "var(--ink-500)" }}>Loading...</p>
        </div>
      )}

      {/* Invalid link */}
      {step === "invalid" && (
        <div className="text-center max-w-md">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "var(--bg-clay-tint)", border: "1px solid var(--line)" }}
          >
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--clay-ink)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              color: "var(--ink-900)",
              marginBottom: 12,
              letterSpacing: "-0.01em",
            }}
          >
            {linkData?.message || "This link is no longer valid."}
          </h2>
          <p style={{ fontSize: 18, color: "var(--ink-700)" }}>
            Please ask your nurse for a new recording link.
          </p>
        </div>
      )}

      {/* Registration form */}
      {step === "register" && (
        <form onSubmit={handleRegister} className="w-full max-w-md cd-surface p-8 space-y-6">
          <div className="text-center mb-2">
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 30,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              Welcome
            </h2>
            <p className="mt-2" style={{ fontSize: 18, color: "var(--ink-500)" }}>
              Please create your name and password to get started.
            </p>
          </div>

          <div>
            <label className="block mb-2" style={{ fontSize: 17, fontWeight: 500, color: "var(--ink-700)" }}>
              Your Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Margaret"
              autoFocus
            />
          </div>

          <div>
            <label className="block mb-2" style={{ fontSize: 17, fontWeight: 500, color: "var(--ink-700)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="At least 4 characters"
            />
          </div>

          {error && (
            <p style={{ fontSize: 16, color: "var(--clay-ink)" }}>{error}</p>
          )}

          <button type="submit" disabled={submitting} style={bigBtn}>
            {submitting ? "Creating account..." : "Continue"}
          </button>
        </form>
      )}

      {/* Login form */}
      {step === "login" && (
        <form onSubmit={handleLogin} className="w-full max-w-md cd-surface p-8 space-y-6">
          <div className="text-center mb-2">
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 30,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              Welcome back{linkData?.display_name ? `, ${linkData.display_name}` : ""}
            </h2>
            <p className="mt-2" style={{ fontSize: 18, color: "var(--ink-500)" }}>
              Please enter your password to continue.
            </p>
          </div>

          <div>
            <label className="block mb-2" style={{ fontSize: 17, fontWeight: 500, color: "var(--ink-700)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Enter your password"
              autoFocus
            />
          </div>

          {error && (
            <p style={{ fontSize: 16, color: "var(--clay-ink)" }}>{error}</p>
          )}

          <button type="submit" disabled={submitting} style={bigBtn}>
            {submitting ? "Logging in..." : "Continue"}
          </button>
        </form>
      )}

      {/* Consent screen */}
      {step === "consent" && (
        <div className="w-full max-w-lg cd-surface p-8 space-y-6">
          <div className="text-center mb-2">
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 28,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              Consent for Voice Recording
            </h2>
          </div>

          <div
            className="space-y-4"
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: 14,
              padding: 24,
              fontSize: 17,
              color: "var(--ink-700)",
              lineHeight: 1.6,
            }}
          >
            <p>
              <strong style={{ color: "var(--ink-900)" }}>What is recorded:</strong> A short voice sample
              (30&ndash;60 seconds) of you speaking aloud.
            </p>
            <p>
              <strong style={{ color: "var(--ink-900)" }}>How it is used:</strong> Your recording is analysed by
              computer to check for changes in your speech patterns that may indicate health changes.
            </p>
            <p>
              <strong style={{ color: "var(--ink-900)" }}>Who can see results:</strong> Your nurse and care team
              can view the analysis results. They <strong>cannot</strong> listen to your recording.
            </p>
            <p>
              <strong style={{ color: "var(--ink-900)" }}>Your rights:</strong> You own your recordings. You
              can listen to, download, or delete them at any time. You can withdraw consent at any time.
            </p>
            <p>
              <strong style={{ color: "var(--ink-900)" }}>Storage:</strong> Recordings are stored securely and
              encrypted. Analysis results are kept even if you delete the recording.
            </p>
          </div>

          {error && <p style={{ fontSize: 16, color: "var(--clay-ink)" }}>{error}</p>}

          <button onClick={handleConsent} disabled={submitting} style={bigBtn}>
            {submitting ? "Saving..." : "I Agree, Continue"}
          </button>

          <p className="text-center" style={{ fontSize: 14, color: "var(--ink-500)" }}>
            You can withdraw consent at any time through your recording portal.
          </p>
        </div>
      )}

      {/* Recording interface */}
      {step === "record" && (
        <div className="w-full max-w-lg">
          <RecordingWidget prompt={prompt} onUpload={handleUpload} />
        </div>
      )}

      {/* Footer disclaimer */}
      <p className="mt-12 text-center max-w-md" style={{ fontSize: 13, color: "var(--ink-500)" }}>
        This recording is used for health monitoring purposes only.
        You own your recordings and can request deletion at any time.
      </p>
    </div>
  );
}
