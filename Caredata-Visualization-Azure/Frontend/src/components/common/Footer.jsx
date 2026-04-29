import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--bg-paper)",
        borderTop: "1px solid var(--line-soft)",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="text-xs" style={{ color: "var(--ink-500)" }}>
          © {new Date().getFullYear()} Team W08 · University of Wollongong
        </div>
        <div className="flex gap-5 text-xs" style={{ color: "var(--ink-500)" }}>
          <Link to="/privacy" className="hover:opacity-80 transition">Privacy</Link>
          <Link to="/terms" className="hover:opacity-80 transition">Terms</Link>
          <Link to="/about" className="hover:opacity-80 transition">About</Link>
          <Link to="/contact" className="hover:opacity-80 transition">Contact</Link>
          <a
            href="https://developer.health.gov.au/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition"
          >
            Documentation
          </a>
        </div>
      </div>
    </footer>
  );
}
