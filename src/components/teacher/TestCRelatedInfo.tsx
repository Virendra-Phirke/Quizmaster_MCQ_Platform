import { useState } from "react";

const FONTS = "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Fira+Code:wght@400;500&display=swap";

const sections = [
  {
    id: "info", emoji: "📋",
    title: "Basic Info",
    fullTitle: "Basic Information",
    subtitle: "Name & describe your test",
    color: "#38bdf8", dark: "#0c2d4a", glow: "#38bdf8",
    fields: [
      { name: "Test Title", req: "required", note: "The name students see on their dashboard. Must be unique — duplicates are rejected on submit." },
      { name: "Description", req: "optional", note: "Extra context shown to students before starting — scope, allowed resources, or instructions." },
    ],
    tips: [
      "Keep the title under 80 characters for the best display on all devices.",
      "A short description significantly improves student clarity.",
    ],
  },
  {
    id: "timing", emoji: "⏱",
    title: "Timing",
    fullTitle: "Timing Configuration",
    subtitle: "Schedule & countdown",
    color: "#a78bfa", dark: "#2a1654", glow: "#a78bfa",
    fields: [
      { name: "Start Date & Time", req: "required", note: "Test unlocks for students at exactly this moment. Saved with your local timezone." },
      { name: "End Date & Time", req: "required", note: "Hard deadline. Students cannot start or submit after this. Defaults to 7 days from now." },
      { name: "Timer Mode", req: "required", note: "Per Question — each question has its own countdown. Overall Test — one shared timer for the whole test." },
      { name: "Seconds / Question", req: "conditional", note: "Only shown in Per Question mode. Min 10 sec. Total duration = seconds × questions." },
      { name: "Duration (minutes)", req: "conditional", note: "Only shown in Overall Test mode. Total minutes for the entire test." },
    ],
    tips: [
      "Per Question mode auto-advances the student when time runs out.",
      "Overall mode lets students manage their own time per question.",
    ],
    extra: {
      type: "formula",
      rows: [
        { label: "Per Question", val: "sec × questions ÷ 60", eg: "45s × 20 = 15 min" },
        { label: "Overall", val: "your input directly", eg: "30 → 30 min" },
      ],
    },
  },
  {
    id: "settings", emoji: "⚙️",
    title: "Settings",
    fullTitle: "Test Settings",
    subtitle: "Scoring & visibility",
    color: "#34d399", dark: "#042f23", glow: "#34d399",
    fields: [
      { name: "Visibility", req: "required", note: "Public — anyone with the link can attempt. Private — only invited or enrolled students." },
      { name: "Default Marks / Q", req: "required", note: "Auto-applied to every new question. Minimum 1. Can be overridden per question later." },
      { name: "Negative Marking", req: "optional", note: "Toggle to enable. Enter a whole number (1, 2, 3…) to deduct per wrong answer. Blank answers are never penalised." },
    ],
    tips: [
      "Changing Default Marks does not update questions already added.",
      "Total Marks always shows the live sum of all question marks.",
    ],
    extra: {
      type: "score",
      rows: [
        { label: "Correct", val: "+2", color: "#34d399" },
        { label: "Wrong",   val: "−1", color: "#f87171" },
        { label: "Blank",   val:  "0", color: "#475569" },
      ],
      note: "Worth 2 pts · deduct 1",
    },
  },
  {
    id: "questions", emoji: "❓",
    title: "Questions",
    fullTitle: "Questions Manager",
    subtitle: "Build & import",
    color: "#fb923c", dark: "#3d1a05", glow: "#fb923c",
    fields: [
      { name: "Question Type", req: "required", note: "Multiple Choice — 4 custom options A–D. True / False — options are fixed and cannot be edited." },
      { name: "Count", req: "required", note: "How many blank cards to add at once (max 100). Add all at once, fill them in afterwards." },
      { name: "Section Name", req: "optional", note: "Groups questions by topic (e.g. Python, C++). Defaults to General. Used in analytics." },
      { name: "Question Text", req: "required", note: "The question as students see it. Plain text, multi-line supported." },
      { name: "Options A–D", req: "required", note: "Four answer options for MCQ. Fixed to True / False for T/F type. All four must be filled." },
      { name: "Correct Answer", req: "required", note: "Select the correct option from the dropdown. The card highlights it green." },
      { name: "Marks", req: "required", note: "Points for this question. Overrides Default Marks. Minimum 1." },
    ],
    tips: [
      "Add all questions in bulk first, then fill them in — much faster workflow.",
      "Remove deletes immediately with no undo. Questions renumber automatically.",
    ],
    extra: { type: "excel" },
  },
];

const validation = [
  "Test title is not empty",
  "At least one question has been added",
  "All question text fields are filled",
  "All MCQ option fields are filled",
];

const reqConfig: Record<string, { label: string; color: string; bg: string }> = {
  required:    { label: "required",    color: "#38bdf8", bg: "#0c2d4a" },
  optional:    { label: "optional",    color: "#475569", bg: "#111827" },
  conditional: { label: "conditional", color: "#fcd34d", bg: "#3d2a00" },
};

export default function App() {
  const [active, setActive] = useState("info");
  const [animKey, setAnimKey] = useState(0);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const cur = sections.find(s => s.id === active)!;

  const handleTab = (id: string) => {
    if (id === active) return;
    setActive(id);
    setAnimKey(k => k + 1);
    setHoveredField(null);
  };

  return (
    <>
      <style>{`
        @import url('${FONTS}');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #060a12; overflow-x: hidden; }
        * { scrollbar-width: none; -ms-overflow-style: none; }
        *::-webkit-scrollbar { display: none; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(60px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(500%); opacity: 0; }
        }
        @keyframes borderFlow {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes dot-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes counter {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }

        .tab-pill {
          position: relative;
          transition: transform 0.2s ease;
        }
        .tab-pill:hover { transform: translateY(-1px); }
        .tab-pill:active { transform: scale(0.97); }

        .field-row {
          transition: transform 0.18s ease;
        }
        .field-row:hover { transform: translateX(4px); }

        .sidebar-card {
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .sidebar-card:hover { transform: translateY(-2px); }

        .flow-btn {
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .flow-btn:hover { background: rgba(255,255,255,0.04) !important; }

        @media (max-width: 760px) {
          .layout { grid-template-columns: 1fr !important; }
          .tabs-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .header-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .header-inner { min-width: 420px; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060a12", fontFamily: "'Poppins', sans-serif", color: "#e2e8f0", position: "relative", overflow: "hidden" }}>

        {/* ── Background ambience ── */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          overflow: "hidden",
        }}>
          {/* Large orbs — no backdrop */}
          <div style={{
            position: "absolute", top: -200, left: -200,
            width: 600, height: 600, borderRadius: "50%",
            background: `radial-gradient(circle, ${cur.glow}08 0%, transparent 70%)`,
            transition: "background 1s ease",
          }} />
          <div style={{
            position: "absolute", bottom: -150, right: -150,
            width: 500, height: 500, borderRadius: "50%",
            background: `radial-gradient(circle, ${cur.glow}06 0%, transparent 70%)`,
            transition: "background 1s ease",
          }} />
          {/* Subtle grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }} />
          {/* Scan line */}
          <div style={{
            position: "absolute", left: 0, right: 0,
            height: 120,
            background: `linear-gradient(180deg, transparent, ${cur.glow}06, transparent)`,
            animation: "scan 8s ease-in-out infinite",
            transition: "background 1s ease",
          }} />
        </div>

        {/* ── HEADER ── */}
        <div style={{ position: "relative", zIndex: 10 }}>
          <div className="header-scroll">
            <div className="header-inner" style={{ padding: "28px 28px 0" }}>

              {/* Top row */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", lineHeight: 1.15, letterSpacing: "-0.5px" }}>
                    Test Creation
                  </div>
                  <div style={{ fontSize: 13, color: "#334155", fontWeight: 400, marginTop: 4 }}>
                    Quick reference guide for teachers
                  </div>
                </div>

                {/* Animated section indicator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", borderRadius: 99,
                  background: cur.dark,
                  border: `1px solid ${cur.color}30`,
                  animation: "fadeIn 0.3s ease",
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: cur.color,
                    display: "inline-block",
                    animation: "dot-blink 2s ease infinite",
                    boxShadow: `0 0 6px ${cur.color}80`,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: cur.color, fontFamily: "'Fira Code', monospace", whiteSpace: "nowrap" }}>
                    {cur.fullTitle}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="tabs-wrap" style={{ display: "flex", gap: 6 }}>
                {sections.map(s => {
                  const isActive = s.id === active;
                  return (
                    <button key={s.id} className="tab-pill"
                      onClick={() => handleTab(s.id)}
                      onMouseEnter={() => setHoveredTab(s.id)}
                      onMouseLeave={() => setHoveredTab(null)}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 10,
                        border: isActive ? `1px solid ${s.color}40` : "1px solid transparent",
                        background: isActive ? s.dark : hoveredTab === s.id ? "#0f172a" : "transparent",
                        color: isActive ? s.color : "#334155",
                        cursor: "pointer",
                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                        fontFamily: "'Poppins', sans-serif",
                        display: "flex", alignItems: "center", gap: 7,
                        whiteSpace: "nowrap", flexShrink: 0,
                        boxShadow: isActive ? `0 0 20px ${s.color}15` : "none",
                        marginBottom: isActive ? 0 : 0,
                        position: "relative",
                        transition: "all 0.2s ease",
                      }}>
                      {isActive && (
                        <span style={{
                          position: "absolute", bottom: -1, left: "20%", right: "20%", height: 2,
                          background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
                          borderRadius: 99,
                        }} />
                      )}
                      <span style={{ fontSize: 14 }}>{s.emoji}</span>
                      <span>{s.title}</span>
                    </button>
                  );
                })}
              </div>

            </div>
          </div>

          {/* Divider */}
          <div style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${cur.color}30, transparent)`,
            margin: "0 28px",
            transition: "background 0.6s ease",
          }} />
        </div>

        {/* ── BODY ── */}
        <div key={animKey} style={{
          position: "relative", zIndex: 10,
          maxWidth: 1060, margin: "0 auto",
          padding: "28px 24px 60px",
          animation: "fadeUp 0.3s ease",
        }}>

          {/* Section banner */}
          <div style={{
            padding: "18px 22px",
            background: cur.dark,
            border: `1px solid ${cur.color}25`,
            borderRadius: 16,
            marginBottom: 22,
            display: "flex", alignItems: "center", gap: 16,
            boxShadow: `0 4px 40px ${cur.color}10`,
            position: "relative", overflow: "hidden",
          }}>
            {/* Banner shimmer */}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(105deg, transparent 40%, ${cur.color}08 50%, transparent 60%)`,
              backgroundSize: "200% 100%",
              animation: "shimmer 3s ease infinite",
            }} />
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: `radial-gradient(circle at 30% 30%, ${cur.color}25, ${cur.color}08)`,
              border: `1px solid ${cur.color}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
              boxShadow: `0 0 20px ${cur.color}20`,
              animation: "float 4s ease-in-out infinite",
              position: "relative", zIndex: 1,
            }}>{cur.emoji}</div>
            <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.3px" }}>{cur.fullTitle}</div>
              <div style={{ fontSize: 12, color: `${cur.color}90`, fontWeight: 500, marginTop: 2 }}>{cur.subtitle}</div>
            </div>
            <div style={{
              padding: "5px 14px", borderRadius: 99, flexShrink: 0,
              background: `${cur.color}12`,
              border: `1px solid ${cur.color}30`,
              fontSize: 11, fontWeight: 700, color: cur.color,
              fontFamily: "'Fira Code', monospace",
              position: "relative", zIndex: 1,
              boxShadow: `0 0 14px ${cur.color}15`,
            }}>{cur.fields.length} fields</div>
          </div>

          {/* Two-col layout */}
          <div className="layout" style={{ display: "grid", gridTemplateColumns: "1fr 292px", gap: 16 }}>

            {/* ── LEFT ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

              {cur.fields.map((f, i) => {
                const rc = reqConfig[f.req];
                const isHov = hoveredField === `${cur.id}-${i}`;
                return (
                  <div key={i} className="field-row"
                    onMouseEnter={() => setHoveredField(`${cur.id}-${i}`)}
                    onMouseLeave={() => setHoveredField(null)}
                    style={{
                      background: isHov ? "#0c1628" : "#080f1c",
                      border: `1px solid ${isHov ? cur.color + "30" : "#0f1a2e"}`,
                      borderRadius: 12,
                      padding: "14px 18px",
                      display: "flex", gap: 14, alignItems: "flex-start",
                      animation: `slideRight 0.25s ease ${i * 0.06}s both`,
                      boxShadow: isHov ? `0 0 24px ${cur.color}08, inset 0 0 24px ${cur.color}04` : "none",
                      transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
                      position: "relative", overflow: "hidden",
                    }}>
                    {isHov && (
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                        background: `linear-gradient(180deg, transparent, ${cur.color}, transparent)`,
                        borderRadius: "99px 0 0 99px",
                      }} />
                    )}
                    {!isHov && (
                      <div style={{
                        position: "absolute", left: 0, top: "20%", bottom: "20%", width: 2,
                        background: rc.color,
                        borderRadius: "99px 0 0 99px",
                        opacity: f.req === "optional" ? 0.15 : 0.4,
                      }} />
                    )}
                    <div style={{ flex: 1, paddingLeft: 2 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isHov ? "#f1f5f9" : "#e2e8f0" }}>{f.name}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          padding: "2px 8px", borderRadius: 99,
                          background: rc.bg,
                          color: rc.color,
                          border: `1px solid ${rc.color}25`,
                          fontFamily: "'Fira Code', monospace",
                        }}>{rc.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#4b6280", lineHeight: 1.75, fontWeight: 400 }}>{f.note}</div>
                    </div>
                  </div>
                );
              })}

              {/* Validation block */}
              {cur.id === "info" && (
                <div style={{
                  background: "#080f1c",
                  border: "1px solid #0f1a2e",
                  borderRadius: 12, overflow: "hidden",
                  animation: "slideRight 0.25s ease 0.42s both",
                  marginTop: 4,
                }}>
                  <div style={{
                    padding: "12px 18px", borderBottom: "1px solid #0f1a2e",
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#38bdf808",
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6,
                      background: "#0c2d4a", border: "1px solid #38bdf830",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, color: "#38bdf8",
                    }}>✓</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Pre-submit Checks</span>
                  </div>
                  {validation.map((v, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 18px",
                      borderBottom: i < validation.length - 1 ? "1px solid #0a1525" : "none",
                    }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: "#38bdf8", flexShrink: 0, opacity: 0.6,
                      }} />
                      <span style={{ fontSize: 12, color: "#4b6280", fontWeight: 400 }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Excel import */}
              {cur.id === "questions" && (
                <div style={{
                  background: "#080f1c",
                  border: "1px solid #0f1a2e",
                  borderRadius: 12, overflow: "hidden",
                  animation: "slideRight 0.25s ease 0.45s both",
                  marginTop: 4,
                }}>
                  <div style={{
                    padding: "12px 18px", borderBottom: "1px solid #0f1a2e",
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#fb923c08",
                  }}>
                    <span style={{ fontSize: 15 }}>📥</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Bulk Import via Excel</span>
                  </div>
                  {[
                    { step: "1", icon: "⬇️", title: "Download the Template", desc: "Click Download Template in the Questions toolbar." },
                    { step: "2", icon: "✏️", title: "Fill in Your Questions", desc: "Open the file and enter questions following the existing column headers." },
                    { step: "3", icon: "⬆️", title: "Import Questions", desc: "Click Import Questions, select your file — all valid rows are added instantly." },
                  ].map((s, i, arr) => (
                    <div key={i} style={{
                      display: "flex", gap: 14, alignItems: "flex-start",
                      padding: "14px 18px",
                      borderBottom: i < arr.length - 1 ? "1px solid #0a1525" : "none",
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: "#3d1a05",
                        border: "1px solid #fb923c30",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800, color: "#fb923c",
                        fontFamily: "'Fira Code', monospace",
                        animation: `counter 0.3s ease ${i * 0.1}s both`,
                      }}>{s.step}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>{s.icon} {s.title}</div>
                        <div style={{ fontSize: 11, color: "#4b6280", lineHeight: 1.65 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Tips card */}
              <div className="sidebar-card" style={{
                background: "#080f1c",
                border: `1px solid ${cur.color}20`,
                borderRadius: 14, overflow: "hidden",
                boxShadow: `0 4px 30px ${cur.color}08`,
              }}>
                <div style={{
                  padding: "11px 16px",
                  borderBottom: `1px solid ${cur.color}10`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: cur.dark, border: `1px solid ${cur.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11,
                  }}>💡</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cur.color, letterSpacing: "0.06em" }}>Tips</span>
                </div>
                {cur.tips.map((t, i) => (
                  <div key={i} style={{
                    padding: "12px 16px",
                    borderBottom: i < cur.tips.length - 1 ? "1px solid #0a1525" : "none",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: "50%",
                      background: cur.color, marginTop: 6, flexShrink: 0, opacity: 0.5,
                    }} />
                    <span style={{ fontSize: 12, color: "#4b6280", lineHeight: 1.7, fontWeight: 400 }}>{t}</span>
                  </div>
                ))}
              </div>

              {/* Formula */}
              {cur.extra?.type === "formula" && (
                <div className="sidebar-card" style={{
                  background: "#080f1c",
                  border: "1px solid #a78bfa20",
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: "0 4px 30px #a78bfa08",
                }}>
                  <div style={{ padding: "11px 16px", borderBottom: "1px solid #0a1525", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.06em" }}>⚡ Duration Formula</span>
                  </div>
                  {(cur.extra?.rows ?? []).map((r, i) => (
                    <div key={i} style={{ padding: "12px 16px", borderBottom: i < (cur.extra?.rows?.length ?? 0) - 1 ? "1px solid #0a1525" : "none" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'Fira Code', monospace", marginBottom: 3 }}>{r.val}</div>
                      <div style={{ fontSize: 10, color: "#2d3e58", fontFamily: "'Fira Code', monospace" }}>e.g. {(r as any).eg}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Score example */}
              {cur.extra?.type === "score" && (
                <div className="sidebar-card" style={{
                  background: "#080f1c",
                  border: "1px solid #34d39920",
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: "0 4px 30px #34d39908",
                }}>
                  <div style={{ padding: "11px 16px", borderBottom: "1px solid #0a1525", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: "0.06em" }}>📊 Scoring Example</span>
                  </div>
                  <div style={{ padding: "8px 16px", borderBottom: "1px solid #0a1525" }}>
                    <span style={{ fontSize: 10, color: "#1e3a2e", fontFamily: "'Fira Code', monospace" }}>{(cur.extra as any).note}</span>
                  </div>
                  {(cur.extra?.rows ?? []).map((r, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 16px",
                      borderBottom: i < (cur.extra?.rows?.length ?? 0) - 1 ? "1px solid #0a1525" : "none",
                    }}>
                      <span style={{ fontSize: 12, color: "#4b6280" }}>{r.label}</span>
                      <span style={{
                        fontSize: 16, fontWeight: 800, color: (r as any).color,
                        fontFamily: "'Fira Code', monospace",
                        textShadow: `0 0 12px ${(r as any).color}50`,
                      }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Page flow */}
              <div className="sidebar-card" style={{
                background: "#080f1c",
                border: "1px solid #0f1a2e",
                borderRadius: 14, overflow: "hidden",
              }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid #0a1525" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Fira Code', monospace" }}>Page Flow</span>
                </div>
                {sections.map((s, i) => (
                  <div key={s.id} className="flow-btn"
                    onClick={() => handleTab(s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px",
                      borderBottom: i < sections.length - 1 ? "1px solid #0a1525" : "none",
                      background: s.id === active ? s.dark : "transparent",
                    }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                      background: s.id === active ? `${s.color}18` : "#0c1525",
                      border: `1px solid ${s.id === active ? s.color + "35" : "#1a2a40"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13,
                      boxShadow: s.id === active ? `0 0 12px ${s.color}20` : "none",
                      transition: "all 0.2s",
                    }}>{s.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: s.id === active ? 700 : 500, color: s.id === active ? s.color : "#334155", transition: "color 0.2s" }}>{s.fullTitle}</div>
                    </div>
                    {s.id === active && (
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: s.color, flexShrink: 0,
                        boxShadow: `0 0 8px ${s.color}`,
                        animation: "dot-blink 2s ease infinite",
                      }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Sticky bar */}
              <div className="sidebar-card" style={{
                padding: "13px 15px",
                background: "#080f1c",
                border: "1px solid #22c55e18",
                borderRadius: 12,
                borderLeft: "3px solid #22c55e",
                boxShadow: "0 4px 20px #22c55e06",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", marginBottom: 5 }}>Sticky bottom bar</div>
                <div style={{ fontSize: 11, color: "#4b6280", lineHeight: 1.7 }}>
                  <b style={{ color: "#94a3b8", fontWeight: 600 }}>Create Test</b> and <b style={{ color: "#94a3b8", fontWeight: 600 }}>Cancel</b> are always visible at the bottom of the page regardless of scroll position.
                </div>
              </div>

              {/* Unsaved */}
              <div className="sidebar-card" style={{
                padding: "13px 15px",
                background: "#080f1c",
                border: "1px solid #f8717118",
                borderRadius: 12,
                borderLeft: "3px solid #f87171",
                boxShadow: "0 4px 20px #f8717106",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 5 }}>⚠ Unsaved data</div>
                <div style={{ fontSize: 11, color: "#4b6280", lineHeight: 1.7 }}>
                  All data is held in memory only. Refreshing or closing the tab loses all progress.
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          position: "relative", zIndex: 10,
          borderTop: "1px solid #0a1525",
          padding: "14px 28px",
          display: "flex", flexWrap: "wrap",
          justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {[
              { c: "#38bdf8", l: "Required" },
              { c: "#fcd34d", l: "Conditional" },
              { c: "#334155", l: "Optional" },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: x.c }} />
                <span style={{ fontSize: 11, color: "#1e3a5f", fontWeight: 500 }}>{x.l}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#0f1a2e", fontFamily: "'Fira Code', monospace" }}>
            teacher quick-reference · quizmaster
          </span>
        </div>

      </div>
    </>
  );
}