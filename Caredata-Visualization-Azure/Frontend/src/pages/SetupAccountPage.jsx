import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

export default function SetupAccountPage() {
  const [account, setAccount] = useState({
    avatar: "",
    firstName: "",
    lastName: "",
    facilityName: "",
    abn: "",
    street: "",
    state: "",
    postcode: "",
    contactEmail: "",
    contactPhone: "",
  });

  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAccount((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAccount((prev) => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    console.log("Account setup:", account);
    setSuccess(true);
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate("/"), 4000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/3177/3177440.png";
  const inputStyle = {
    background: "var(--bg-paper)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--ink-900)",
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center" style={{ background: "var(--bg-cream)" }}>
        <div
          className="w-20 h-20 mb-6 rounded-full flex items-center justify-center"
          style={{ background: "var(--bg-sage-tint)", border: "1px solid var(--line)" }}
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: "var(--sage-ink)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink-900)", marginBottom: 8 }}>
          Account created successfully
        </h2>
        <p style={{ color: "var(--ink-500)", marginBottom: 22 }}>
          Welcome aboard. Redirecting you to the homepage…
        </p>
        <button onClick={() => navigate("/")} className="cd-btn cd-btn-primary">
          Let's get started
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pt-10" style={{ background: "var(--bg-cream)" }}>
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6">
        <div className="flex-1 cd-surface p-8">
          <div className="text-center mb-8">
            <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
              <span className="dot" /> One-time setup
            </span>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 34,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              Set up your account
            </h1>
            <p style={{ color: "var(--ink-500)", fontSize: 14, marginTop: 6 }}>
              Complete your profile and facility details to start using CareData Portal.
            </p>
          </div>

          {/* Avatar + Name Section */}
          <div className="flex items-center gap-10 mb-10">
            <div className="flex flex-col items-center justify-center">
              <img
                src={account.avatar || defaultAvatar}
                alt="User Avatar"
                className="w-28 h-28 rounded-full object-cover"
                style={{ border: "3px solid var(--bg-sage-tint)", boxShadow: "var(--shadow-xs)" }}
              />
              <label
                className="mt-3 text-sm font-medium cursor-pointer hover:underline"
                style={{ color: "var(--sage-ink)" }}
              >
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                Upload Avatar
              </label>
            </div>

            <div className="flex flex-col justify-center space-y-4 w-2/3 max-w-sm">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>First name</label>
                <input
                  name="firstName"
                  value={account.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 focus:outline-none"
                  style={inputStyle}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Last name</label>
                <input
                  name="lastName"
                  value={account.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 focus:outline-none"
                  style={inputStyle}
                  placeholder="Enter last name"
                />
              </div>
            </div>
          </div>

          {/* Facility Info */}
          <div className="space-y-4 mb-8">
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-900)", marginBottom: 10 }}>
              Facility information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Facility name</label>
                <input name="facilityName" value={account.facilityName} onChange={handleChange} className="w-full px-4 py-2.5 focus:outline-none" style={inputStyle} placeholder="Enter facility name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>ABN</label>
                <input name="abn" value={account.abn} onChange={handleChange} className="w-full px-4 py-2.5 focus:outline-none" style={inputStyle} placeholder="Enter ABN number" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Street</label>
                <input name="street" value={account.street} onChange={handleChange} className="w-full px-4 py-2.5 focus:outline-none" style={inputStyle} placeholder="Street address" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>State</label>
                <input name="state" value={account.state} onChange={handleChange} className="w-full px-4 py-2.5 focus:outline-none" style={inputStyle} placeholder="State" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Postcode</label>
                <input name="postcode" value={account.postcode} onChange={handleChange} className="w-full px-4 py-2.5 focus:outline-none" style={inputStyle} placeholder="Postcode" />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-900)", marginBottom: 10 }}>
              Contact information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Contact email</label>
                <input name="contactEmail" type="email" value={account.contactEmail} onChange={handleChange} className="w-full px-4 py-2.5 focus:outline-none" style={inputStyle} placeholder="Enter contact email" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Phone number</label>
                <input name="contactPhone" type="tel" value={account.contactPhone} onChange={handleChange} className="w-full px-4 py-2.5 focus:outline-none" style={inputStyle} placeholder="Enter phone number" />
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-10">
            <button onClick={handleSubmit} className="cd-btn cd-btn-primary">
              Complete setup
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
