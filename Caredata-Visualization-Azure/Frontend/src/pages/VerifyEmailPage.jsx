import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail } from "../services/api";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token provided.");
      return;
    }
    verifyEmail(token)
      .then((data) => {
        if (data.access_token) {
          localStorage.setItem("token", data.access_token);
          if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
        }
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(
          err.response?.data?.detail || "Verification failed. The link may be expired or invalid."
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className="flex flex-grow items-center justify-center px-4 mt-16">
        <div
          className="p-10 max-w-md w-full text-center"
          style={{
            background: "var(--bg-white)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {status === "verifying" && (
            <>
              <div
                className="inline-block w-10 h-10 rounded-full animate-spin mb-4"
                style={{
                  border: "3px solid var(--line)",
                  borderTopColor: "var(--sage-ink)",
                }}
              />
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 24,
                  color: "var(--ink-900)",
                  marginBottom: 8,
                }}
              >
                Verifying your email…
              </h2>
              <p style={{ color: "var(--ink-500)", fontSize: 13 }}>Please wait a moment.</p>
            </>
          )}
          {status === "success" && (
            <>
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: "var(--bg-sage-tint)", border: "1px solid var(--line)" }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: "var(--sage-ink)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--ink-900)", marginBottom: 8 }}>
                Email verified
              </h2>
              <p style={{ color: "var(--ink-500)", fontSize: 14, marginBottom: 22 }}>
                Your account is now active. You're all set to use CareData Portal.
              </p>
              <button onClick={() => navigate("/")} className="cd-btn cd-btn-primary">
                Go to dashboard
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: "var(--bg-clay-tint)", border: "1px solid var(--line)" }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: "var(--clay-ink)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--ink-900)", marginBottom: 8 }}>
                Verification failed
              </h2>
              <p style={{ color: "var(--ink-500)", fontSize: 14, marginBottom: 22 }}>{errorMsg}</p>
              <button onClick={() => navigate("/login")} className="cd-btn cd-btn-primary">
                Go to login
              </button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
