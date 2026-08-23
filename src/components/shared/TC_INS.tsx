import { useState, useEffect } from "react";

interface Row {
  id: number;
  questionId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  
}

const initialRows: Row[] = [
  { id: 1, questionId: "Q1", question: "1+1", optionA: "2", optionB: "4", optionC: "6", optionD: "8", correctOption: "A" },
  { id: 2, questionId: "", question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "" },
  { id: 3, questionId: "Q2", question: "stack is a non-primitive data structure", optionA: "TRUE", optionB: "FALSE", optionC: "", optionD: "", correctOption: "A" },
  { id: 4, questionId: "", question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "" },
];

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

const FilterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z" />
  </svg>
);

const AddIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

export default function MCQTable() {
  const [rows] = useState<Row[]>(initialRows);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  useEffect(() => {
    const css = `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .mcq-root {
        background: #0a0a0a;
        min-height: 50vh;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        padding: clamp(16px, 3vw, 36px);
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        color: #d4d4d4;
      }

      .mcq-wrapper {
        width: 100%;
        max-width: 1280px;
      }

      /* Header bar */
      .mcq-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid #1e1e1e;
      }

      .mcq-title {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.15em;
        color: #555;
        text-transform: uppercase;
      }

      .mcq-badge {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.08em;
        color: #2ecc71;
        background: rgba(46,204,113,0.08);
        border: 1px solid rgba(46,204,113,0.18);
        padding: 2px 8px;
        border-radius: 2px;
        text-transform: uppercase;
      }

      /* Toolbar */
      .mcq-toolbar {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-bottom: 10px;
      }

      .mcq-btn {
        background: transparent;
        border: 1px solid transparent;
        cursor: pointer;
        color: #555;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        transition: color 0.12s, background 0.12s, border-color 0.12s;
        font-family: inherit;
      }

      .mcq-btn:hover {
        color: #d4d4d4;
        background: #161616;
        border-color: #2a2a2a;
      }

      .mcq-btn.add:hover { color: #2ecc71; border-color: rgba(46,204,113,0.25); background: rgba(46,204,113,0.05); }
      .mcq-btn.delete:hover { color: #e74c3c; border-color: rgba(231,76,60,0.25); background: rgba(231,76,60,0.05); }

      .mcq-divider {
        width: 1px;
        height: 18px;
        background: #1e1e1e;
        margin: 0 4px;
      }

      /* Scroll container — hidden scrollbars */
      .mcq-scroll {
        width: 100%;
        overflow-x: auto;
        overflow-y: visible;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .mcq-scroll::-webkit-scrollbar {
        display: none;
      }

      /* Table */
      .mcq-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
        table-layout: auto;
        border: 1px solid #1a1a1a;
        border-radius: 4px;
        overflow: hidden;
      }

      .mcq-table thead {
        position: sticky;
        top: 0;
        z-index: 1;
      }

      .mcq-table th {
        background: #111;
        color: #444;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        text-align: left;
        padding: 10px 14px;
        border-bottom: 1px solid #1e1e1e;
        border-right: 1px solid #161616;
        white-space: nowrap;
        user-select: none;
      }

      .mcq-table th:last-child { border-right: none; text-align: center; color: rgba(46,204,113,0.5); }
      .mcq-table th.col-hash { color: #2a2a2a; width: 40px; min-width: 40px; }

      .mcq-table td {
        background: #0e0e0e;
        color: #c4c4c4;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        font-weight: 400;
        padding: 10px 14px;
        border-bottom: 1px solid #141414;
        border-right: 1px solid #141414;
        vertical-align: middle;
        height: 46px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
        transition: background 0.1s;
      }

      .mcq-table td:last-child { border-right: none; }
      .mcq-table tr:last-child td { border-bottom: none; }

      .mcq-table tr.row-even td { background: #0b0b0b; }

      .mcq-table tr.row-hovered td { background: #131313; }
      .mcq-table tr.row-hovered.row-even td { background: #111; }

      /* Hash cell */
      .mcq-table td.col-hash {
        color: #2a2a2a;
        font-size: 10px;
        width: 40px;
        min-width: 40px;
        text-align: center;
        padding: 10px 8px;
        user-select: none;
      }

      /* Question cell — allow wrapping on small screens */
      .mcq-table td.col-question {
        white-space: normal;
        max-width: 240px;
        min-width: 140px;
        line-height: 1.5;
        padding-top: 9px;
        padding-bottom: 9px;
      }

      /* Correct option cell */
      .mcq-table td.col-correct {
        text-align: center;
        color: #2ecc71;
        font-size: 12px;
        font-weight: 600;
        background: rgba(46,204,113,0.04) !important;
        letter-spacing: 0.05em;
      }

      .mcq-table tr.row-hovered td.col-correct,
      .mcq-table tr.row-even td.col-correct {
        background: rgba(46,204,113,0.04) !important;
      }

      /* Empty row styling */
      .mcq-table tr.row-empty td { opacity: 0.3; }
      .mcq-table tr.row-empty td.col-correct { opacity: 0.15; }

      /* Footer */
      .mcq-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #161616;
      }

      .mcq-footer-stat {
        font-size: 10px;
        color: #333;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .mcq-footer-stat span { color: #555; }

      /* Responsive: on very small screens, shrink padding */
      @media (max-width: 480px) {
        .mcq-root { padding: 12px; }
        .mcq-table td, .mcq-table th { padding: 8px 10px; }
        .mcq-table td.col-question { max-width: 140px; min-width: 100px; }
      }
    `;

    if (!document.getElementById('mcq-refined-styles')) {
      const style = document.createElement('style');
      style.id = 'mcq-refined-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }, []);

  const isEmpty = (row: Row) => !row.questionId && !row.question;
  const filledCount = rows.filter(r => !isEmpty(r)).length;

  const columns = [
    { key: 'questionId', label: 'Question_ID' },
    { key: 'question', label: 'Question', cls: 'col-question' },
    { key: 'optionA', label: 'Option A' },
    { key: 'optionB', label: 'Option B' },
    { key: 'optionC', label: 'Option C' },
    { key: 'optionD', label: 'Option D' },
  ];

  return (
    <div className="mcq-root">
      <div className="mcq-wrapper">

        {/* Header */}
        <div className="mcq-header">
          <span className="mcq-title">MCQ Bank</span>
          <span className="mcq-badge">{filledCount} entries</span>
        </div>

        {/* Toolbar */}
        <div className="mcq-toolbar">
          <button className="mcq-btn search" title="Search"><SearchIcon /></button>
          <button className="mcq-btn filter" title="Filter"><FilterIcon /></button>
          <div className="mcq-divider" />
          <button className="mcq-btn add" title="Add"><AddIcon /></button>
          <button className="mcq-btn delete" title="Delete"><DeleteIcon /></button>
        </div>

        {/* Table */}
        <div className="mcq-scroll">
          <table className="mcq-table">
            <thead>
              <tr>
                <th className="col-hash">#</th>
                {columns.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Correct Answer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const even = idx % 2 === 1;
                const empty = isEmpty(row);
                return (
                  <tr
                    key={row.id}
                    className={[
                      even ? 'row-even' : '',
                      hoveredRow === row.id ? 'row-hovered' : '',
                      empty ? 'row-empty' : '',
                    ].filter(Boolean).join(' ')}
                    onMouseEnter={() => setHoveredRow(row.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="col-hash">{row.id}</td>
                    {columns.map(c => (
                      <td
                        key={c.key}
                        className={c.cls || ''}
                        title={(row as any)[c.key]}
                      >
                        {(row as any)[c.key]}
                      </td>
                    ))}
                    <td className="col-correct">{row.correctOption}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mcq-footer">
          <span className="mcq-footer-stat">rows <span>{rows.length}</span></span>
          <span className="mcq-footer-stat">cols <span>8</span></span>
        </div>

      </div>
    </div>
  );
}