import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowRightIcon } from "@heroicons/react/20/solid";

export default function Hero() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("token"));

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
    const interval = setInterval(() => setIsLoggedIn(!!localStorage.getItem("token")), 300);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-black">

      {/* Black box to push image down — do not remove */}
      <div className="absolute top-0 left-0 w-full h-[20px] bg-black z-[1]" />

      {/* Full-bleed background image */}
      <img
        src="/banner.png"
        alt=""
        className="absolute top-[20px] left-0 w-full h-[calc(100%-20px)] object-cover object-top"
      />

      {/* Gradient overlay — solid black at top for text, fades to show image, then white */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom,
            #000 0%, #000 32%,
            rgba(0,0,0,0.75) 45%,
            rgba(0,0,0,0.3) 58%,
            rgba(0,0,0,0) 68%,
            rgba(255,255,255,0.85) 90%,
            #fff 100%)`,
        }}
      />

      {/* Content — positioned in the black zone */}
      <div className="relative z-20 flex flex-col items-center text-center px-6 pt-[134px] pb-10">

        {/* Eyebrow */}
        <motion.p
          className="text-xs font-medium uppercase tracking-[0.2em] text-white mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Australian Residential Aged Care
        </motion.p>

        {/* Horizontal line */}
        <motion.div
          className="w-12 border-t border-white/20 mb-8"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        />

        {/* Hook — bold, big, mixed color */}
        <motion.h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06 }}
        >
          Insight at a <span className="text-primary">glance.</span>
        </motion.h1>

        {/* Headline — regular weight */}
        <motion.p
          className="text-base sm:text-lg font-normal text-white/50 max-w-md mb-8 leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          Track your facility's quality indicators, all in one place.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.22 }}
        >
          <button
            onClick={() => navigate(isLoggedIn ? "/mydata" : "/login")}
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 text-base font-semibold rounded-md hover:bg-orange-500 transition"
          >
            {isLoggedIn ? "Go to Dashboard" : "Get Started"}
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </motion.div>

      </div>
    </section>
  );
}
