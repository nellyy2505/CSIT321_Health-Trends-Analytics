import { useState } from "react";
import { registerUser, API_BASE_URL, getCurrentUser } from "../services/api";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
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
      const data = await registerUser(form);
      localStorage.setItem("token", data.access_token);
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      } else {
        const userData = await getCurrentUser(data.access_token);
        localStorage.setItem("user", JSON.stringify(userData));
      }
      setSuccess(true);
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || error.message;
      alert("Error registering: " + (typeof detail === "string" ? detail : JSON.stringify(detail)));
    } finally {
      setLoading(false);
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

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center">
        <img src="/success.png" alt="Success" className="w-24 h-24 mb-6" />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Account created successfully!
        </h2>
        <p className="text-gray-500 mb-8">
          Welcome aboard! Start your success journey with CareData!
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          className="bg-orange-500 text-white px-6 py-2.5 rounded-md font-medium hover:bg-orange-600 transition"
        >
          Let's Start!
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-grow items-stretch justify-center px-4 py-12 mt-16 min-h-[calc(100vh-8rem)]">
        <div className="flex flex-col md:flex-row w-full max-w-6xl bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Left Panel */}
          <div
            className="hidden md:flex relative flex-col justify-center items-center w-1/2 bg-cover bg-center text-white p-10"
            style={{ backgroundImage: "url('/banner.png')" }}
          >
            <div className="absolute inset-0 bg-white/25"></div>
            <div className="relative z-10 flex flex-col justify-between h-full text-center max-w-sm py-10">
              <div>
                <h1 className="text-3xl font-bold mb-2">Welcome to Care Data</h1>
                <p className="text-gray-200 mb-8">Your Gateway to Government Submission.</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Seamless Integration</h2>
                <p className="text-gray-200 text-sm">
                  Effortlessly submit your data to Government Portal.
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel (Register Form) */}
          <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12 bg-white">
            <div className="w-full max-w-sm">
              <div className="flex items-center justify-center mb-6">
                <img src="/logo_black.png" alt="logo" className="w-8 h-8 mr-2" />
                <h2 className="text-xl font-bold text-gray-900">Care Data Portal</h2>
              </div>

              <div className="flex mb-6 border-b border-gray-200">
                <button
                  className="flex-1 py-2 font-medium text-gray-400 hover:text-gray-600"
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </button>
                <button className="flex-1 py-2 font-medium text-gray-900 border-b-2 border-orange-500">
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      name="first_name"
                      type="text"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="Enter your first name"
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      name="last_name"
                      type="text"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="Enter your last name"
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                    required
                  />
                  <ul className="mt-2 text-sm text-gray-500 space-y-1">
                    <li>
                      <span
                        className={
                          strength === "Strong"
                            ? "text-green-500"
                            : strength === "Medium"
                            ? "text-yellow-500"
                            : "text-red-500"
                        }
                      >
                        ✓ Password Strength: {strength}
                      </span>
                    </li>
                    <li>✓ At least 8 characters</li>
                    <li>✓ Contains a number or symbol</li>
                  </ul>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" className="accent-orange-500" required />
                  I agree to the Terms of Service.
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-orange-500 text-white font-semibold rounded-md hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </form>

              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-3 text-sm text-gray-500">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
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
                  <p className="text-sm text-gray-500 text-center py-2">
                    Set VITE_GOOGLE_CLIENT_ID in Frontend/.env to enable Google sign-in.
                  </p>
                )}
              </div>

              <p className="text-center text-sm mt-6 text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="text-orange-500 font-medium hover:underline">
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
