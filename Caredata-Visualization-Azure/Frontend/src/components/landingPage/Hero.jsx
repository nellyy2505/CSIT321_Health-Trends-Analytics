import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Hero() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("token"));

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
    const interval = setInterval(() => setIsLoggedIn(!!localStorage.getItem("token")), 300);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const scrollToFeatures = () => {
    const el = document.getElementById("features");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative flex items-start justify-center text-center text-white bg-black pt-20"
      style={{ minHeight: "115vh", overflow: "visible", paddingBottom: "4rem" }}
    >
      <div className="absolute top-0 left-0 w-full h-40 bg-[#040404] z-10" />
      <div className="absolute top-40 left-0 right-0 bottom-0 overflow-hidden">
        <img src="/banner.png" alt="Care Data Banner" className="w-full h-full object-cover object-center" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 70%, rgba(255,255,255,1) 100%)" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/3 w-[250px] h-[250px] bg-primary/25 rounded-full blur-3xl"
          animate={{ y: [0, 25, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-20 px-6 max-w-3xl pb-16 pt-10">
        <motion.p
          className="text-sm font-semibold text-primary uppercase tracking-widest mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Australian Residential Aged Care
        </motion.p>
        <motion.h1
          className="text-5xl sm:text-6xl lg:text-7xl font-light text-white tracking-tight leading-tight mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ lineHeight: 1.35 }}
        >
          <span className="block mb-2">Quality indicators,</span>
          <strong className="font-semibold text-primary">visualised clearly</strong>
        </motion.h1>
        <motion.p
          className="text-lg sm:text-xl text-white mb-10 max-w-4xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="block">Upload your quarterly GPMS export and instantly see all 14 AIHW QI indicators, </span>
          <span className="block">trends, benchmarks, and resident risk flags — in one place.</span>
        </motion.p>

        <motion.div
          className="flex flex-wrap justify-center gap-3 mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {isLoggedIn ? (
            <p className="text-orange-700 font-bold text-2xl sm:text-3xl">Welcome to CareData Portal</p>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="bg-primary text-black px-7 py-3 text-base font-semibold rounded-lg hover:bg-orange-600 transition shadow-md"
              >
                Get started
              </button>
              <button
                type="button"
                onClick={scrollToFeatures}
                className="bg-white/50 text-gray-900 border-2 border-primary px-7 py-3 text-base font-semibold rounded-lg hover:bg-white/70 transition shadow-md backdrop-blur-sm"
              >
                See features
              </button>
            </>
          )}
        </motion.div>

        <motion.div
          className="flex flex-nowrap justify-center items-center gap-2 overflow-x-auto pb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {["QI Program Manual 4.0", "14 indicators", "AIHW benchmarking", "GPMS compatible", "Australian aged care"].map((badge) => (
            <span
              key={badge}
              className="text-xs font-semibold text-gray-900 bg-white/50 border border-orange-200 px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 shadow-sm backdrop-blur-sm"
            >
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
