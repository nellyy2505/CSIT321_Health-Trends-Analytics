import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

const inputStyle = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  color: "var(--ink-900)",
  fontSize: 14,
  padding: "10px 14px",
  outline: "none",
  width: "100%",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className="flex-grow pb-12 px-4 sm:px-6 flex justify-center pt-32">
        <div className="cd-surface max-w-4xl w-full p-10">
          <div className="text-center mb-8">
            <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
              <span className="dot" /> Get in touch
            </span>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 36,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              Contact us
            </h1>
            <p className="mt-2" style={{ color: "var(--ink-500)", fontSize: 14 }}>
              Have questions, feedback, or technical issues? Get in touch with our team.
            </p>
          </div>

          <form className="space-y-5 max-w-lg mx-auto">
            <div>
              <label
                className="block mb-1.5"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}
              >
                Name
              </label>
              <input type="text" style={inputStyle} placeholder="Your name" />
            </div>

            <div>
              <label
                className="block mb-1.5"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}
              >
                Email
              </label>
              <input type="email" style={inputStyle} placeholder="your@email.com" />
            </div>

            <div>
              <label
                className="block mb-1.5"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}
              >
                Message
              </label>
              <textarea rows="5" style={{ ...inputStyle, resize: "vertical" }} placeholder="Your message..." />
            </div>

            <button type="submit" className="cd-btn cd-btn-primary w-full justify-center">
              Send message
            </button>
          </form>

          <div className="mt-10 text-center" style={{ color: "var(--ink-500)", fontSize: 13 }}>
            <p>
              Project developed by{" "}
              <span style={{ fontWeight: 600, color: "var(--sage-ink)" }}>Team W08</span>, University of Wollongong.
            </p>
            <p className="mt-1">
              Email:{" "}
              <span style={{ color: "var(--sage-ink)", fontWeight: 500 }}>caredata@uow.edu.au</span>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
