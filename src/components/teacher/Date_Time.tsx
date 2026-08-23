import { useState, useRef, useEffect, useCallback, CSSProperties } from "react";
import { createPortal } from "react-dom";

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
interface ViewState { year: number; month: number; }
interface SelectedDate { year: number; month: number; day: number; }
interface TimeState { hour: string; minute: string; ampm: string; }
interface CalCell { day: number; outside: boolean; }

interface ScrollColumnProps {
  items: string[];
  active: string;
  onChange: (val: string) => void;
  width?: number;
  colHeight?: number;
}

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  label?: string;
}

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  style?: CSSProperties;
  className?: string;
}

/* ══════════════════════════════════════════
   Helpers
══════════════════════════════════════════ */
function parseISO(iso: string): { date: SelectedDate; time: TimeState } {
  // new Date() correctly converts any ISO string (with or without tz offset) to local time
  // For bare "YYYY-MM-DDTHH:MM" strings (no tz suffix), browsers treat them as LOCAL time
  const dt = iso ? new Date(iso.length === 16 ? iso + ":00" : iso) : new Date();
  const rawH = dt.getHours();
  const ampm = rawH >= 12 ? "PM" : "AM";
  const h12 = rawH % 12 === 0 ? 12 : rawH % 12;
  return {
    date: { year: dt.getFullYear(), month: dt.getMonth(), day: dt.getDate() },
    time: {
      hour: String(h12).padStart(2, "0"),
      minute: String(dt.getMinutes()).padStart(2, "0"),
      ampm,
    },
  };
}

function toISO(date: SelectedDate, time: TimeState): string {
  let h = parseInt(time.hour, 10);
  if (time.ampm === "PM" && h !== 12) h += 12;
  if (time.ampm === "AM" && h === 12) h = 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  // Build a local Date object and convert to ISO with timezone offset
  // so Supabase stores the correct absolute UTC time
  const localDt = new Date(
    date.year,
    date.month,
    date.day,
    h,
    parseInt(time.minute, 10)
  );
  const tzOffset = -localDt.getTimezoneOffset(); // offset in minutes
  const sign = tzOffset >= 0 ? "+" : "-";
  const absOffset = Math.abs(tzOffset);
  const tzHH = pad(Math.floor(absOffset / 60));
  const tzMM = pad(absOffset % 60);
  return `${date.year}-${pad(date.month + 1)}-${pad(date.day)}T${pad(h)}:${pad(parseInt(time.minute, 10))}:00${sign}${tzHH}:${tzMM}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  try {
    const dt = new Date(iso.length === 16 ? iso + ":00" : iso);
    const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const rawH = dt.getHours();
    const ampm = rawH >= 12 ? "PM" : "AM";
    const h12 = rawH % 12 === 0 ? 12 : rawH % 12;
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${mo[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}  ·  ${h12}:${mm} ${ampm}`;
  } catch { return iso; }
}

/* ══════════════════════════════════════════
   Constants
══════════════════════════════════════════ */
const MONTHS: string[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS: string[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const HOURS: string[] = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES: string[] = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPMS: string[] = ["AM", "PM"];
const ITEM_H = 46;

/* ══════════════════════════════════════════
   ScrollColumn
══════════════════════════════════════════ */
function ScrollColumn({ items, active, onChange, width = 56, colHeight = 260 }: ScrollColumnProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const padY = Math.floor((colHeight - ITEM_H) / 2);

  const scrollTo = useCallback(
    (val: string, smooth = true) => {
      const idx = items.indexOf(val);
      if (idx < 0 || !innerRef.current) return;
      innerRef.current.scrollTo({
        top: idx * ITEM_H,
        behavior: smooth ? "smooth" : ("instant" as ScrollBehavior),
      });
    },
    [items]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollTo(active, false); }, []);

  const handleScroll = useCallback(() => {
    if (!innerRef.current) return;
    const idx = Math.round(innerRef.current.scrollTop / ITEM_H);
    const val = items[Math.max(0, Math.min(idx, items.length - 1))];
    if (val !== active) onChange(val);
  }, [active, items, onChange]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const idx = items.indexOf(active);
      const next = e.deltaY > 0
        ? Math.min(idx + 1, items.length - 1)
        : Math.max(idx - 1, 0);
      onChange(items[next]);
      scrollTo(items[next]);
    },
    [active, items, onChange, scrollTo]
  );

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  return (
    <div style={{ position: "relative", width, height: colHeight, overflow: "hidden", flexShrink: 0 }}>
      {/* Fade top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: padY,
        background: "linear-gradient(to bottom, rgba(9,15,30,0.97), transparent)",
        zIndex: 2, pointerEvents: "none",
      }} />
      {/* Fade bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: padY,
        background: "linear-gradient(to top, rgba(9,15,30,0.97), transparent)",
        zIndex: 2, pointerEvents: "none",
      }} />
      {/* Active row highlight */}
      <div style={{
        position: "absolute", top: "50%", transform: "translateY(-50%)",
        left: 4, right: 4, height: ITEM_H,
        background: "rgba(79,172,254,0.05)",
        border: "1px solid rgba(79,172,254,0.14)",
        borderRadius: 10, zIndex: 1, pointerEvents: "none",
      }} />
      <div
        ref={innerRef}
        onScroll={handleScroll}
        style={{
          height: "100%", overflowY: "auto", scrollbarWidth: "none",
          scrollSnapType: "y mandatory", display: "flex", flexDirection: "column",
          alignItems: "center", paddingTop: padY, paddingBottom: padY,
        }}
      >
        {items.map((val) => {
          const isActive = val === active;
          return (
            <div
              key={val}
              onClick={() => { onChange(val); scrollTo(val); }}
              style={{
                flexShrink: 0, width: width - 8, height: ITEM_H,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: width < 50 ? 13 : 15,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "#fff" : "rgba(140,180,240,0.38)",
                background: isActive ? "linear-gradient(135deg,#4facfe,#3a8fef)" : "transparent",
                borderRadius: 10, cursor: "pointer", scrollSnapAlign: "center",
                transition: "background .2s, color .2s",
                boxShadow: isActive ? "0 4px 16px rgba(79,172,254,0.45)" : "none",
                userSelect: "none", position: "relative", zIndex: 3,
                letterSpacing: isActive ? 1 : 0,
              }}
            >
              {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DateTimePicker  (modal content panel)
══════════════════════════════════════════ */
export function DateTimePicker({ value, onChange, onClose, label }: DateTimePickerProps) {
  const today = new Date();
  const parsed = parseISO(value);

  const [view, setView] = useState<ViewState>({ year: parsed.date.year, month: parsed.date.month });
  const [selected, setSelected] = useState<SelectedDate>(parsed.date);
  const [time, setTime] = useState<TimeState>(parsed.time);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* Calendar math */
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstDayRaw = new Date(view.year, view.month, 1).getDay();
  const startOffset = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const prevMonthDays = new Date(view.year, view.month, 0).getDate();

  const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  const goToday = () => {
    setView({ year: today.getFullYear(), month: today.getMonth() });
    setSelected({ year: today.getFullYear(), month: today.getMonth(), day: today.getDate() });
  };

  const cells: CalCell[] = [];
  for (let i = 0; i < startOffset; i++)
    cells.push({ day: prevMonthDays - startOffset + 1 + i, outside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, outside: false });
  const tail = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let i = 1; i <= tail; i++) cells.push({ day: i, outside: true });

  const isSel = (d: number) => selected.year === view.year && selected.month === view.month && selected.day === d;
  const isTod = (d: number) => today.getFullYear() === view.year && today.getMonth() === view.month && today.getDate() === d;

  const handleSet = () => { onChange(toISO(selected, time)); onClose(); };

  /* Shared tokens */
  const colH = mobile ? 184 : 260;
  const colW = mobile ? 42 : 54;
  const ampmW = mobile ? 38 : 48;
  const colSep: CSSProperties = { width: 1, background: "rgba(79,172,254,0.1)", alignSelf: "stretch", margin: "0 2px" };
  const ghostBtn: CSSProperties = {
    flex: 1, borderRadius: 10, fontFamily: "inherit", cursor: "pointer",
    border: "1px solid rgba(80,120,200,0.25)", background: "rgba(50,70,110,0.55)",
    color: "rgba(180,210,255,0.8)", padding: "9px 0", fontSize: 13, fontWeight: 500,
  };
  const primaryBtn: CSSProperties = {
    flex: 1, borderRadius: 10, fontFamily: "inherit", cursor: "pointer",
    border: "none", background: "linear-gradient(135deg,#4facfe,#3a8fef)",
    color: "#fff", padding: "9px 0", fontSize: 13, fontWeight: 700,
    boxShadow: "0 2px 14px rgba(60,160,255,0.35)", letterSpacing: 0.3,
  };
  const navBtn: CSSProperties = {
    background: "rgba(79,172,254,0.08)", border: "1px solid rgba(79,172,254,0.14)",
    color: "rgba(160,210,255,0.8)", fontSize: mobile ? 18 : 20, cursor: "pointer",
    width: mobile ? 30 : 34, height: mobile ? 30 : 34,
    display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9,
  };

  return (
    <div style={{
      display: "flex", flexDirection: mobile ? "column" : "row",
      background: "linear-gradient(160deg,rgba(13,20,42,0.99) 0%,rgba(8,13,28,0.99) 100%)",
      border: "1px solid rgba(79,172,254,0.18)",
      borderRadius: mobile ? 16 : 18,
      boxShadow: "0 0 0 1px rgba(79,172,254,0.05), 0 32px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
      width: "100%", maxWidth: mobile ? 360 : 650,
      overflow: "hidden", fontFamily: "'DM Sans','Segoe UI',sans-serif",
      position: "relative",
    }}>

      {/* Top glow accent */}
      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(to right,transparent,rgba(79,172,254,0.35),transparent)", pointerEvents: "none" }} />

      {/* ── CALENDAR PANEL ── */}
      <div style={{ flex: "1 1 0", padding: mobile ? "16px 14px 12px" : "24px 20px 18px", minWidth: 0 }}>

        {label && (
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(79,172,254,0.65)", letterSpacing: 2, textTransform: "uppercase", marginBottom: mobile ? 10 : 16 }}>
            {label}
          </div>
        )}

        {/* Month navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: mobile ? 10 : 18 }}>
          <button style={navBtn} onClick={prevMonth}>‹</button>
          <span style={{ fontSize: mobile ? 14 : 15, fontWeight: 600, color: "#d0e8ff", letterSpacing: 0.3 }}>
            {MONTHS[view.month]}&nbsp;{view.year}
          </span>
          <button style={navBtn} onClick={nextMonth}>›</button>
        </div>

        {/* Day-of-week headers + day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: mobile ? 1 : 2, textAlign: "center" }}>
          {DAYS.map(d => (
            <div key={d} style={{ fontSize: mobile ? 10 : 11, fontWeight: 600, color: "rgba(79,172,254,0.4)", padding: mobile ? "2px 0 6px" : "3px 0 9px", letterSpacing: 0.6 }}>
              {d}
            </div>
          ))}
          {cells.map((cell, i) => {
            const sel = !cell.outside && isSel(cell.day);
            const tod = !cell.outside && !sel && isTod(cell.day);
            return (
              <div
                key={i}
                onClick={() => !cell.outside && setSelected({ year: view.year, month: view.month, day: cell.day })}
                style={{
                  aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: mobile ? 11 : 13, fontWeight: sel ? 700 : tod ? 600 : 400,
                  color: cell.outside ? "rgba(100,130,180,0.18)" : sel ? "#fff" : tod ? "#7dd3fc" : "rgba(180,210,255,0.8)",
                  background: sel ? "linear-gradient(135deg,#4facfe,#3a8fef)" : "transparent",
                  cursor: cell.outside ? "default" : "pointer", borderRadius: "50%",
                  transition: "background .15s, color .15s", userSelect: "none",
                  boxShadow: sel ? "0 3px 12px rgba(79,172,254,0.5)" : "none",
                  outline: tod && !sel ? "1.5px solid rgba(125,211,252,0.4)" : "none",
                  outlineOffset: -1,
                }}
              >
                {cell.day}
              </div>
            );
          })}
        </div>

        {/* Today shortcut */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: mobile ? 10 : 16 }}>
          <button onClick={goToday} style={{ ...ghostBtn, flex: "none", padding: mobile ? "6px 18px" : "7px 20px", fontSize: mobile ? 12 : 13 }}>
            Today
          </button>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={mobile
        ? { height: 1, background: "rgba(79,172,254,0.1)", margin: "0 14px" }
        : { width: 1, background: "rgba(79,172,254,0.1)", margin: "14px 0" }
      } />

      {/* ── TIME PANEL ── */}
      <div style={{ display: "flex", flexDirection: "column", margin: mobile ? "0" : "14px 14px 14px 0" }}>

        {/* HH:MM AM/PM display */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: mobile ? 4 : 6,
          padding: mobile ? "12px 14px 8px" : "14px 16px 10px",
          background: "rgba(6,11,24,0.6)",
          borderBottom: "1px solid rgba(79,172,254,0.08)",
          borderRadius: mobile ? 0 : "14px 14px 0 0",
        }}>
          <span style={{ fontSize: mobile ? 24 : 30, fontWeight: 800, letterSpacing: 3, color: "#e8f4ff", fontVariantNumeric: "tabular-nums", textShadow: "0 0 28px rgba(79,172,254,0.55)" }}>
            {time.hour}
          </span>
          <span style={{ fontSize: mobile ? 20 : 26, fontWeight: 300, color: "rgba(79,172,254,0.35)", marginBottom: 2 }}>:</span>
          <span style={{ fontSize: mobile ? 24 : 30, fontWeight: 800, letterSpacing: 3, color: "#e8f4ff", fontVariantNumeric: "tabular-nums", textShadow: "0 0 28px rgba(79,172,254,0.55)" }}>
            {time.minute}
          </span>
          <span style={{
            fontSize: mobile ? 10 : 12, fontWeight: 700, color: "#4facfe",
            background: "rgba(79,172,254,0.1)", border: "1px solid rgba(79,172,254,0.28)",
            borderRadius: 7, padding: mobile ? "2px 6px" : "3px 8px", marginLeft: 4, letterSpacing: 1,
          }}>
            {time.ampm}
          </span>
        </div>

        {/* Scroll wheels */}
        <div style={{
          display: "flex", gap: mobile ? 2 : 4,
          padding: mobile ? "6px 14px" : "8px 14px",
          alignItems: "flex-start", justifyContent: "center",
          background: "rgba(6,11,24,0.6)", flex: 1,
        }}>
          <ScrollColumn items={HOURS} active={time.hour} onChange={v => setTime(t => ({ ...t, hour: v }))} width={colW} colHeight={colH} />
          <div style={colSep} />
          <ScrollColumn items={MINUTES} active={time.minute} onChange={v => setTime(t => ({ ...t, minute: v }))} width={colW} colHeight={colH} />
          <div style={colSep} />
          <ScrollColumn items={AMPMS} active={time.ampm} onChange={v => setTime(t => ({ ...t, ampm: v }))} width={ampmW} colHeight={colH} />
        </div>

        {/* Cancel / Set actions */}
        <div style={{
          display: "flex", gap: 8,
          padding: mobile ? "8px 14px 14px" : "8px 14px 14px",
          background: "rgba(6,11,24,0.6)",
          borderTop: "1px solid rgba(79,172,254,0.08)",
          borderRadius: mobile ? 0 : "0 0 14px 14px",
        }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={handleSet} style={primaryBtn}>Set</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DateTimeField
   Drop-in trigger button + portal modal
══════════════════════════════════════════ */
export function DateTimeField({ value, onChange, label, placeholder = "Select date & time", required, style, className }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* Close on backdrop click */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) setOpen(false);
  };

  /* Body scroll lock + Escape key */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", handler); };
  }, [open]);

  const overlay = open ? (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgba(0,0,8,0.74)",
        animation: "dtFadeIn .18s ease",
      }}
    >
      <style>{`
        @keyframes dtFadeIn  { from { opacity:0 }                        to { opacity:1 } }
        @keyframes dtSlideIn { from { opacity:0;transform:scale(.95) translateY(10px) } to { opacity:1;transform:scale(1) translateY(0) } }
        ::-webkit-scrollbar  { display:none }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "calc(100dvh - 32px)", overflowY: "auto", borderRadius: 18, animation: "dtSlideIn .22s cubic-bezier(.22,.68,0,1.2)", width: "100%", maxWidth: 650 }}
      >
        <DateTimePicker value={value} onChange={onChange} onClose={() => setOpen(false)} label={label} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }} className={className}>
        {label && (
          <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(140,180,240,0.55)", letterSpacing: 1.5, textTransform: "uppercase" }}>
            {label}{required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
          </label>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label || "Select date and time"}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
            background: "rgba(14,22,44,0.75)", border: "1px solid rgba(79,140,220,0.22)",
            borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            transition: "border-color .15s, box-shadow .15s",
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = "rgba(79,172,254,0.45)";
            b.style.boxShadow = "0 0 0 3px rgba(79,172,254,0.08)";
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = "rgba(79,140,220,0.22)";
            b.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.03)";
          }}
        >
          {/* Calendar icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(79,172,254,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span style={{ color: value ? "#c8deff" : "rgba(110,145,200,0.4)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          {/* Chevron */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(100,140,200,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {createPortal(overlay, document.body)}
    </>
  );
}

/* ══════════════════════════════════════════
   Demo App  (remove when integrating)
══════════════════════════════════════════ */
function SummaryRow({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: "rgba(100,140,200,0.5)", width: 60, flexShrink: 0, letterSpacing: 0.3 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#a8c8f0", fontWeight: 500 }}>{val}</span>
    </div>
  );
}

export default function App() {
  const [startDate, setStartDate] = useState("2026-05-12T09:00");
  const [endDate, setEndDate] = useState("2026-05-15T17:30");
  const [deadline, setDeadline] = useState("");

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 25% 35%,#0c1d3d 0%,#060c1c 55%,#020407 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "'DM Sans','Segoe UI',sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`::-webkit-scrollbar{display:none}`}</style>

      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Page header */}
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(79,172,254,0.55)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
            Schedule
          </p>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "#e8f4ff", letterSpacing: -0.5, lineHeight: 1.15 }}>
            New Event
          </h1>
          <p style={{ margin: "6px 0 0", color: "rgba(140,170,220,0.45)", fontSize: 13 }}>
            Pick dates and times using the fields below.
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: "rgba(12,20,40,0.8)", border: "1px solid rgba(79,140,220,0.12)",
          borderRadius: 18, padding: 24,
          display: "flex", flexDirection: "column", gap: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}>
          <DateTimeField label="Start" value={startDate} onChange={setStartDate} required />
          <DateTimeField label="End" value={endDate} onChange={setEndDate} required />
          <DateTimeField label="Deadline" value={deadline} onChange={setDeadline} placeholder="No deadline" />
        </div>

        {/* Live summary */}
        {(startDate || endDate || deadline) && (
          <div style={{
            background: "rgba(79,172,254,0.04)", border: "1px solid rgba(79,172,254,0.1)",
            borderRadius: 14, padding: "14px 18px",
            display: "flex", flexDirection: "column", gap: 7,
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: "rgba(79,172,254,0.45)", letterSpacing: 2, textTransform: "uppercase" }}>
              Summary
            </p>
            {startDate && <SummaryRow label="Start" val={formatDisplay(startDate)} />}
            {endDate && <SummaryRow label="End" val={formatDisplay(endDate)} />}
            {deadline && <SummaryRow label="Deadline" val={formatDisplay(deadline)} />}
          </div>
        )}

        {/* CTA */}
        <button style={{
          background: "linear-gradient(135deg,#4facfe,#3a8fef)", border: "none", borderRadius: 13,
          padding: "13px 0", color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.4,
          boxShadow: "0 4px 22px rgba(60,160,255,0.35)",
        }}>
          Save Event
        </button>
      </div>
    </div>
  );
}