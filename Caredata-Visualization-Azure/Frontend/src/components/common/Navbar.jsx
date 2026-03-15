import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getCurrentUser } from "../../services/api";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Data entry", path: "/upload-csv" },
  { name: "Reports", path: "/reports" },
  { name: "Benchmarking", path: "/benchmarking" },
  { name: "Settings", path: "/settings" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

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

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    if (path === "/upload-csv") return location.pathname.startsWith("/upload-csv");
    if (path === "/reports") return location.pathname.startsWith("/reports");
    if (path === "/benchmarking") return location.pathname.startsWith("/benchmarking");
    if (path === "/settings") return location.pathname.startsWith("/settings");
    return location.pathname === path;
  };

  return (
    <nav className="bg-dark fixed top-0 left-0 w-full z-50 text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3 min-h-[72px]">
        <Link to="/" className="flex flex-col items-center gap-0.5 shrink-0 hover:opacity-90 transition">
          <img src="/favicon.ico" alt="CareData Logo" className="w-10 h-10 block" />
          <span className="text-lg font-bold text-white leading-tight whitespace-nowrap">CareData Portal</span>
        </Link>

        {user && (
          <button
            type="button"
            className="sm:hidden text-white focus:outline-none p-2 shrink-0"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menu"
          >
            {isOpen ? "✕" : "☰"}
          </button>
        )}

        <div className={`${user ? (isOpen ? "flex" : "hidden") : "flex"} sm:flex flex-col sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:flex-1 sm:ml-10 gap-2 sm:gap-3`}>
          {user ? (
            <>
              <div className="flex flex-col sm:flex-row sm:flex-nowrap sm:items-center gap-2 sm:gap-2 sm:mr-20">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`px-4 py-2 rounded-lg text-base font-medium transition-all whitespace-nowrap shrink-0 ${
                      isActive(item.path)
                        ? "bg-primary text-black shadow-md"
                        : "text-gray-300 hover:text-primary hover:bg-grayish"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-nowrap sm:items-center gap-2 sm:gap-4">
                <Link
                  to="/upload-csv"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 rounded-lg text-base font-bold text-center bg-orange-400 text-gray-900 hover:bg-orange-300 transition shadow-sm whitespace-nowrap shrink-0 border border-orange-300"
                >
                  + Upload CSV
                </Link>
                <span className="font-medium text-gray-100 whitespace-nowrap shrink-0 sm:ml-2">Hello, {user.firstName || "User"}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-5 py-2.5 min-w-[120px] rounded-md bg-primary text-black hover:bg-orange-600 transition font-medium shadow-md whitespace-nowrap shrink-0 text-left sm:text-center"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="px-6 py-2.5 min-w-[140px] text-center rounded-md font-semibold transition shadow-md bg-primary text-white hover:bg-orange-600 whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
