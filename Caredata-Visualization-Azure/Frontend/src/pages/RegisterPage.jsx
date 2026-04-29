import { useState } from "react";
import { registerUser, resendVerification, API_BASE_URL } from "../services/api";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import BrandMark from "../components/common/BrandMark";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [strength, setStrength] = useState("Weak");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const checkStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[0-9!@#$%^&*]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;
    if (score >= 3) return "Strong";
    if (score === 2) return "Medium";
    return "Weak";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "password") setStrength(checkStrength(value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerUser(form);
      setSuccess(true);
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || error.message;
      alert("Error registering: " + (typeof detail === "string" ? detail : JSON.stringify(detail)));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification(form.email);
      alert("Verification email resent! Check your inbox.");
    } catch {
      alert("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const id_token = credentialResponse.credential;
      if (!id_token) {
        alert("Google login failed: no credential");
        return;
      }
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: id_token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Google login failed");
      }
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user || {}));
      navigate("/");
    } catch (err) {
      console.error(err);
      alert(err.message || "Google login failed");
    }
  };

  const handleGoogleError = () => {
    alert("Google login failed");
  };

  const inputStyle = {
    background: "var(--bg-paper)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--ink-900)",
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center px-4"
        style={{ background: "var(--bg-cream)" }}
      >
        <div
          className="p-10 max-w-md w-full"
          style={{
            background: "var(--bg-white)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: "var(--bg-sage-tint)", border: "1px solid var(--line)" }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--sage-ink)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            Check your email
          </h2>
          <p style={{ color: "var(--ink-500)", fontSize: 14, marginBottom: 4 }}>
            We've sent a verification link to:
          </p>
          <p style={{ color: "var(--ink-900)", fontWeight: 500, marginBottom: 18 }}>{form.email}</p>
          <p style={{ color: "var(--ink-500)", fontSize: 13, marginBottom: 18 }}>
            Click the link in the email to activate your account. The link expires in 24 hours.
          </p>
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-sm font-medium hover:underline disabled:opacity-50"
            style={{ color: "var(--sage-ink)" }}
          >
            {resending ? "Resending..." : "Didn't receive it? Resend verification email"}
          </button>
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--line-soft)" }}>
            <button
              onClick={() => navigate("/login")}
              className="text-sm hover:underline"
              style={{ color: "var(--ink-500)" }}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />

      <main className="flex flex-grow items-stretch justify-center px-4 py-12 mt-16 min-h-[calc(100vh-8rem)]">
        <div
          className="flex flex-col md:flex-row w-full max-w-6xl overflow-hidden"
          style={{
            background: "var(--bg-white)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Left Panel */}
          <div
            className="hidden md:flex relative flex-col justify-between w-1/2 p-10"
            style={{
              background:
                "linear-gradient(160deg, var(--bg-blue-tint) 0%, var(--bg-cream) 55%, var(--bg-sage-tint) 100%)",
            }}
          >
            <span className="cd-chip" style={{ width: "fit-content" }}>
              <span className="dot" /> Join CareData
            </span>

            <div className="max-w-sm">
              <h1
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 40,
                  lineHeight: 1.1,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                  marginBottom: 12,
                }}
              >
                A calmer way to run quality indicators.
              </h1>
              <p style={{ color: "var(--ink-500)", fontSize: 14, lineHeight: 1.5 }}>
                Set up a facility workspace in minutes. Upload once and every report,
                benchmark and trend follows.
              </p>
            </div>

            <ul className="space-y-2.5">
              {[
                "Quarterly QI submissions prefilled",
                "National sector benchmarks on tap",
                "Audit-ready reports one click away",
              ].map((l) => (
                <li key={l} className="flex items-center gap-2.5" style={{ fontSize: 13, color: "var(--ink-700)" }}>
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 6, height: 6, background: "var(--sage)" }}
                  />
                  {l}
                </li>
              ))}
            </ul>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12">
            <div className="w-full max-w-sm">
              <div className="flex items-center justify-center gap-2.5 mb-6">
                <BrandMark size={26} />
                <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-900)" }}>CareData</span>
              </div>

              <div className="flex mb-6" style={{ borderBottom: "1px solid var(--line)" }}>
                <button
                  type="button"
                  className="flex-1 py-2.5 text-sm font-medium"
                  style={{ color: "var(--ink-500)" }}
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="flex-1 py-2.5 text-sm font-medium"
                  style={{
                    color: "var(--ink-900)",
                    borderBottom: "2px solid var(--ink-900)",
                    marginBottom: -1,
                  }}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>First name</label>
                    <input
                      name="first_name"
                      type="text"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="e.g. Jordan"
                      className="w-full p-2.5 focus:outline-none"
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Last name</label>
                    <input
                      name="last_name"
                      type="text"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="e.g. Lee"
                      className="w-full p-2.5 focus:outline-none"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Email</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@facility.org"
                    className="w-full p-2.5 focus:outline-none"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Password</label>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Choose a password"
                    className="w-full p-2.5 focus:outline-none"
                    style={inputStyle}
                    required
                  />
                  <ul className="mt-2 text-sm space-y-1" style={{ color: "var(--ink-500)" }}>
                    <li>
                      <span
                        style={{
                          color:
                            strength === "Strong"
                              ? "var(--sage-ink)"
                              : strength === "Medium"
                              ? "var(--amber)"
                              : "var(--clay-ink)",
                        }}
                      >
                        Password strength: {strength}
                      </span>
                    </li>
                    <li>At least 8 characters</li>
                    <li>Contains a number or symbol</li>
                  </ul>
                </div>

                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-700)" }}>
                  <input type="checkbox" required />
                  I agree to the Terms of Service.
                </label>

                <button type="submit" disabled={loading} className="cd-btn cd-btn-primary w-full justify-center disabled:opacity-60">
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>

              <div className="flex items-center my-6">
                <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
                <span className="px-3 text-xs uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
              </div>

              <div className="flex justify-center w-full">
                {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    width={280}
                    useOneTap={false}
                  />
                ) : (
                  <p className="text-sm text-center py-2" style={{ color: "var(--ink-500)" }}>
                    Set VITE_GOOGLE_CLIENT_ID in Frontend/.env to enable Google sign-in.
                  </p>
                )}
              </div>

              <p className="text-center text-sm mt-6" style={{ color: "var(--ink-500)" }}>
                Already have an account?{" "}
                <Link to="/login" className="font-medium hover:underline" style={{ color: "var(--sage-ink)" }}>
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
