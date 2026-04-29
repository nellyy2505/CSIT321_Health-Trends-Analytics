import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser } from "../../services/api";
import BrandMark from "./BrandMark";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Data Entry", path: "/upload-csv" },
  { name: "Voice Screening", path: "/voice/dashboard" },
  { name: "Reports", path: "/reports" },
  { name: "Benchmarking", path: "/benchmarking" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  useEffect(() => {
    const checkUser = () => {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser({
            firstName: parsedUser.first_name || parsedUser.firstName || "",
            lastName: parsedUser.last_name || parsedUser.lastName || "",
          });
          return;
        } catch {
          localStorage.removeItem("user");
        }
      }

      if (token && !savedUser) {
        getCurrentUser(token)
          .then((data) => {
            setUser({ firstName: data.first_name, lastName: data.last_name });
            localStorage.setItem("user", JSON.stringify(data));
          })
          .catch(() => {
            localStorage.removeItem("token");
            setUser(null);
          });
      } else {
        setUser(null);
      }
    };

    checkUser();
    window.addEventListener("storage", (e) => {
      if (e.key === "token" || e.key === "user") checkUser();
    });
    return () => window.removeEventListener("storage", checkUser);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/";
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
    setIsOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    if (path === "/upload-csv") return location.pathname.startsWith("/upload-csv");
    if (path === "/reports") return location.pathname.startsWith("/reports");
    if (path === "/benchmarking") return location.pathname.startsWith("/benchmarking");
    if (path === "/settings") return location.pathname.startsWith("/settings");
    if (path === "/voice/dashboard") return location.pathname.startsWith("/voice/dashboard");
    return location.pathname === path;
  };

  const initial = user?.firstName?.charAt(0)?.toUpperCase() || "U";

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50"
      style={{
        background: "var(--bg-paper)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16 relative">
        {/* Left, brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition">
          <BrandMark size={28} />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>
              CareData
            </span>
            <span className="text-[11px] font-normal mt-[2px]" style={{ color: "var(--ink-500)" }}>
              Health Analytics Portal
            </span>
          </span>
        </Link>

        {/* Mobile hamburger */}
        {user && (
          <button
            type="button"
            className="sm:hidden focus:outline-none p-2 shrink-0"
            style={{ color: "var(--ink-900)" }}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menu"
          >
            {isOpen ? "✕" : "☰"}
          </button>
        )}

        <div
          className={`${user ? (isOpen ? "flex" : "hidden") : "flex"} sm:flex flex-col sm:flex-row sm:items-center sm:ml-auto gap-4 sm:gap-0`}
        >
          {user ? (
            <>
              {/* Center, nav links */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className="px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap rounded-md"
                      style={
                        active
                          ? { background: "var(--ink-900)", color: "var(--bg-paper)" }
                          : { color: "var(--ink-700)" }
                      }
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = "var(--bg-cream)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              {/* Right, user dropdown */}
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 hover:opacity-80 transition"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--bg-sage-tint)",
                      color: "var(--sage-ink)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <span className="text-xs font-semibold">{initial}</span>
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap" style={{ color: "var(--ink-700)" }}>
                    {user.firstName || "User"}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    style={{ color: "var(--ink-500)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-44 rounded-lg py-1 z-50"
                    style={{
                      background: "var(--bg-white)",
                      border: "1px solid var(--line)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <button
                      onClick={() => {
                        navigate("/settings");
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium transition"
                      style={{ color: "var(--ink-700)" }}
                    >
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm font-medium transition"
                      style={{ color: "var(--ink-500)" }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="sm:flex-1 flex sm:justify-end">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="text-sm font-semibold transition whitespace-nowrap"
                style={{ color: "var(--ink-900)" }}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
