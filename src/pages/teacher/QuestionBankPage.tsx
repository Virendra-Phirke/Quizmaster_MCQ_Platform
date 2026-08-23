import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Copy,
  CheckCircle,
  X,
  MoreVertical,
  FolderOpen,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import { useTest } from '../../hooks/useTest';
import { LegacyTest } from '../../contexts/TestContext';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { Skeleton } from '../../components/shared/Skeleton';
import { PremiumDialog } from '../../components/shared/PremiumDialog';
import { Checkbox } from '../../components/lightswind/checkbox';
import { TeacherLayout } from '../../components/layouts/TeacherLayout';
import { LightswindPagination } from '../../components/shared/LightswindPagination';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  sourceTestId: string;
  sourceTestTitle: string;
}

const genQId = (i: number) => `Q${i + 1}`;
const letter = (i: number) => String.fromCharCode(65 + i);

async function exportToExcel(questions: Question[], filename?: string) {
  const rows = questions.map((q, i) => ({
    QUESTION_ID: genQId(i),
    QUESTION: q.text,
    OPTION_A: q.options[0] ?? '',
    OPTION_B: q.options[1] ?? '',
    OPTION_C: q.options[2] ?? '',
    OPTION_D: q.options[3] ?? '',
    CORRECT_OPTION: letter(q.correctAnswer),
  }));
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['QUESTION_ID', 'QUESTION', 'OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'CORRECT_OPTION'],
  });
  ws['!cols'] = [{ wch: 13 }, { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, filename ?? `questions-${Date.now()}.xlsx`);
}

function GlassBtn({
  onClick, icon: Icon, label, accent = 'slate', count, className = '',
}: {
  onClick: () => void; icon: React.ElementType; label: string;
  accent?: 'slate' | 'indigo' | 'emerald' | 'amber'; count?: number; className?: string;
}) {
  const styles: Record<string, string> = {
    slate: 'border-slate-600/60 hover:border-slate-500/80 hover:bg-slate-700/40 text-slate-300 hover:text-white',
    indigo: 'border-indigo-500/40 hover:border-indigo-400/60 hover:bg-indigo-500/10 text-indigo-300 hover:text-indigo-100',
    emerald: 'border-emerald-500/40 hover:border-emerald-400/60 hover:bg-emerald-500/10 text-emerald-300 hover:text-emerald-100',
    amber: 'border-amber-500/40 hover:border-amber-400/60 hover:bg-amber-500/10 text-amber-300 hover:text-amber-100',
  };
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
        bg-slate-900/80 border ${styles[accent]}
        text-xs font-semibold transition-all duration-200 overflow-hidden active:scale-95
        shadow-[0_1px_8px_rgba(0,0,0,0.4)] ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/6 to-transparent skew-x-12 pointer-events-none" />
      <Icon className="h-3.5 w-3.5 relative z-10 flex-shrink-0" />
      <span className="relative z-10 whitespace-nowrap">
        {label}{count !== undefined ? ` (${count})` : ''}
      </span>
    </button>
  );
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.className = 'fixed bottom-5 right-5 z-[999] flex items-center gap-2.5 px-4 py-3 rounded-xl ' +
    'bg-slate-900/95 border border-emerald-500/40 shadow-2xl text-sm font-semibold text-white';
  el.innerHTML = `
    <span class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40">
      <svg class="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>
    </span>
    <span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2800);
}

function QuestionBankPage() {
  const { user } = useUser();
  const { tests } = useTest();
  const [userUUID, setUserUUID] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const QUESTIONS_PER_PAGE = 20;

  useEffect(() => {
    const init = async () => {
      if (user?.id) setUserUUID(await getCachedUUIDFromClerkId(user.id));
      setLoading(false);
    };
    init();
  }, [user?.id]);

  const myTests = useMemo(() =>
    tests.filter((t: LegacyTest) => t.createdBy === userUUID), [tests, userUUID]);

  const allQuestions: Question[] = useMemo(() => {
    const qs: Question[] = [];
    myTests.forEach((test: LegacyTest) => {
      test.questions.forEach((q, i) => {
        qs.push({
          id: `${test.id}-${i}`,
          text: q.question,
          options: 'options' in q ? q.options : [],
          correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
          sourceTestId: test.id,
          sourceTestTitle: test.title,
        });
      });
    });
    return qs;
  }, [myTests]);

  const filtered = useMemo(() => {
    if (!search) return allQuestions;
    const q = search.toLowerCase();
    return allQuestions.filter(x =>
      x.text.toLowerCase().includes(q) ||
      x.options.some(o => o.toLowerCase().includes(q))
    );
  }, [allQuestions, search]);

  // Reset to page 1 when search changes
  useEffect(() => { setCurrentPage(1); }, [search]);

  const totalPages = Math.ceil(filtered.length / QUESTIONS_PER_PAGE);
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
    return filtered.slice(start, start + QUESTIONS_PER_PAGE);
  }, [filtered, currentPage, QUESTIONS_PER_PAGE]);

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const allSel = filtered.length > 0 && selected.size === filtered.length;
  const selectAll = () => setSelected(allSel ? new Set() : new Set(filtered.map(q => q.id)));

  const copyQuestion = (q: Question) => {
    navigator.clipboard.writeText(
      `${q.text}\n` +
      q.options.map((o, i) => `${letter(i)}. ${o}${i === q.correctAnswer ? ' ✓' : ''}`).join('\n') +
      `\nAnswer: ${letter(q.correctAnswer)}`
    );
    showToast('Question copied!');
  };

  const copySelected = () => {
    const qs = filtered.filter(q => selected.has(q.id));
    navigator.clipboard.writeText(
      qs.map((q, i) =>
        `${i + 1}. ${q.text}\n` +
        q.options.map((o, j) => `   ${letter(j)}. ${o}${j === q.correctAnswer ? ' ✓' : ''}`).join('\n')
      ).join('\n\n')
    );
    showToast(`${qs.length} question${qs.length > 1 ? 's' : ''} copied!`);
  };

  const exportSelected = () => {
    const qs = filtered.filter(q => selected.has(q.id));
    exportToExcel(qs);
    showToast(`${qs.length} question${qs.length > 1 ? 's' : ''} exported!`);
  };

  if (loading) {
    return (
      <TeacherLayout activeNav="questions" title="Question Bank" subtitle="Manage your questions library">
        <div className="p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-2xl bg-slate-800/50" />)}
          </div>
          <Skeleton className="h-12 rounded-xl bg-slate-800/50" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl bg-slate-800/50" />)}
        </div>
      </TeacherLayout>
    );
  }

  const headerActions = (
    <button
      onClick={() => setShowAddModal(true)}
      className="group relative inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl
        bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-500/15
        text-amber-300 hover:text-white text-xs sm:text-sm font-semibold
        transition-all duration-200 overflow-hidden active:scale-95"
    >
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/8 to-transparent skew-x-12 pointer-events-none" />
      <Plus className="h-3.5 w-3.5 relative z-10" />
      <span className="relative z-10 hidden sm:inline">Add Question</span>
    </button>
  );

  return (
    <TeacherLayout
      activeNav="questions"
      title="Question Bank"
      subtitle="Manage your questions library"
      headerActions={headerActions}
    >
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.04),transparent_60%)] pointer-events-none" />

      <main className="relative max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">

        {/* ── Stats — compact horizontal tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Total Questions', value: allQuestions.length, icon: BookOpen, clr: 'text-amber-400', iconBg: 'bg-amber-500/10 border-amber-500/20', glow: 'from-amber-500/8' },
            { label: 'Source Tests', value: myTests.length, icon: FolderOpen, clr: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20', glow: 'from-emerald-500/8' },
            { label: 'Selected', value: selected.size, icon: CheckCircle, clr: 'text-blue-400', iconBg: 'bg-blue-500/10 border-blue-500/20', glow: 'from-blue-500/8', hideOnMobile: true },
          ].map(({ label, value, icon: Icon, clr, iconBg, glow, hideOnMobile }) => (
            <div
              key={label}
              className={`${hideOnMobile ? 'hidden sm:flex' : 'flex'} relative overflow-hidden bg-slate-900/70 border border-slate-700/50 hover:border-slate-600/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-200 items-center gap-2.5 sm:gap-3`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${glow} to-transparent pointer-events-none`} />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
              <div className={`relative inline-flex p-1.5 rounded-lg border ${iconBg} flex-shrink-0`}>
                <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${clr}`} />
              </div>
              <div className="relative">
                <p className="text-lg sm:text-xl lg:text-2xl font-black text-white leading-none mb-0.5">{value}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 leading-none">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="relative bg-slate-900/70 border border-slate-700/50 rounded-xl p-3 shadow-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent rounded-t-xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-amber-400 transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Search questions or answers…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg
                  text-sm text-white placeholder:text-slate-500
                  focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20
                  outline-none transition-all duration-200"
              />
              {search && (
                <button type="button" title="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white hover:bg-slate-700/40 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <GlassBtn onClick={selectAll} icon={allSel ? X : Check} label={allSel ? 'Deselect All' : 'Select All'} accent="slate" />
              {selected.size > 0 && (
                <>
                  <GlassBtn onClick={copySelected} icon={Copy} label="Copy" accent="indigo" count={selected.size} />
                  <GlassBtn onClick={exportSelected} icon={FileSpreadsheet} label="Export .xlsx" accent="emerald" count={selected.size} />
                </>
              )}
            </div>
          </div>

          {/* Status line */}
          {(search || selected.size > 0) && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800/60 text-xs text-slate-500">
              <span>
                <span className="text-slate-300 font-semibold">{filtered.length}</span> of {allQuestions.length}
              </span>
              {selected.size > 0 && (
                <>
                  <span className="w-px h-3 bg-slate-700" />
                  <span className="text-amber-400 font-semibold">{selected.size} selected</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Questions ── */}
        <div className="space-y-2.5 sm:space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900/60 border border-slate-700/50 rounded-2xl">
              <div className="w-14 h-14 mb-4 bg-slate-800/80 border border-slate-700/50 rounded-2xl flex items-center justify-center">
                <BookOpen className="h-7 w-7 text-slate-600" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">No questions found</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                {allQuestions.length === 0 ? 'Create a test to start building your question library.' : 'Try adjusting your search.'}
              </p>
              {allQuestions.length === 0 && (
                <Link to="/teacher/create-test" className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors">
                  <Plus className="h-4 w-4" /> Create First Test
                </Link>
              )}
            </div>
          ) : (
            paginatedQuestions.map((q, idx) => {
              const globalIdx = (currentPage - 1) * QUESTIONS_PER_PAGE + idx;
              const isSel = selected.has(q.id);
              return (
                <div
                  key={q.id}
                  className={`relative rounded-xl sm:rounded-2xl transition-all duration-200
                    ${isSel
                      ? 'border-2 border-amber-500/50 bg-slate-900 shadow-lg shadow-amber-500/8'
                      : 'border border-slate-700/50 bg-slate-900/60 hover:border-slate-600/60 hover:bg-slate-900/80'
                    }`}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent pointer-events-none" />

                  <div className="relative p-3.5 sm:p-5">
                    <div className="flex items-start gap-3">

                      {/* Checkbox */}
                      <div className="flex-shrink-0 pt-0.5">
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggle(q.id)}
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded border-2 cursor-pointer transition-all duration-200
                            ${isSel
                              ? 'bg-amber-500 border-amber-500 shadow shadow-amber-500/30'
                              : 'border-slate-600 hover:border-amber-500/60 bg-transparent'
                            }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 bg-amber-500/12 border border-amber-500/25 rounded-md text-amber-300 text-[10px] sm:text-xs font-bold font-mono">
                            {genQId(globalIdx)}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800/70 border border-slate-700/40 rounded-md text-slate-400 text-[10px] sm:text-xs font-medium">
                            <FolderOpen className="h-2.5 w-2.5 flex-shrink-0" />
                            <span className="truncate max-w-[120px] sm:max-w-[180px]">{q.sourceTestTitle}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/8 border border-emerald-500/20 rounded-md text-emerald-400 text-[10px] sm:text-xs font-bold font-mono">
                            ✓ {letter(q.correctAnswer)}
                          </span>
                        </div>

                        {/* Question */}
                        <p className="text-white font-semibold text-sm sm:text-base leading-snug mb-3">
                          {q.text}
                        </p>

                        {/* Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {q.options.map((opt, oi) => {
                            const correct = oi === q.correctAnswer;
                            return (
                              <div
                                key={oi}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors
                                  ${correct
                                    ? 'bg-[#091a10] border border-emerald-500/45 shadow-[0_0_8px_rgba(16,185,129,0.10)]'
                                    : 'bg-slate-800/35 border border-slate-700/35'
                                  }`}
                              >
                                <span className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-[10px] sm:text-xs font-bold font-mono
                                  ${correct ? 'bg-emerald-500 text-white' : 'bg-slate-700/80 text-slate-400 border border-slate-600/40'}`}>
                                  {letter(oi)}
                                </span>
                                <span className={`flex-1 text-xs sm:text-sm min-w-0 truncate ${correct ? 'text-white font-medium' : 'text-slate-400'}`}>
                                  {opt}
                                </span>
                                {correct && <CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ⋮ Menu */}
                      <div className="relative flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (actionMenu === q.id) { setActionMenu(null); return; }
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                            setActionMenu(q.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all"
                          aria-label="More options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {actionMenu === q.id && createPortal(
                          <>
                            <div className="fixed inset-0 z-[9998]" onClick={() => setActionMenu(null)} />
                            <div
                              className="fixed z-[9999] w-52 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
                              style={{ top: menuPos.top, right: menuPos.right }}
                            >
                              <button
                                type="button"
                                onClick={() => { copyQuestion(q); setActionMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:text-white hover:bg-slate-800 rounded-t-xl transition-colors"
                              >
                                <Copy className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                                Copy Question
                              </button>
                              <button
                                type="button"
                                onClick={() => { exportToExcel([q], `${genQId(globalIdx)}.xlsx`); setActionMenu(null); showToast('Exported as Excel!'); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                <FileSpreadsheet className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                                Export as Excel
                              </button>
                              <div className="h-px bg-slate-700 mx-3" />
                              <Link
                                to={`/teacher/edit-test/${q.sourceTestId}`}
                                onClick={() => setActionMenu(null)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:text-white hover:bg-slate-800 rounded-b-xl transition-colors"
                              >
                                <Edit2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
                                Edit in Test
                              </Link>
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Pagination ── */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            {totalPages > 1 && (
              <LightswindPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-t border-slate-800/50">
              <span className="text-xs text-slate-500">
                Showing <span className="text-slate-300 font-semibold">{(currentPage - 1) * QUESTIONS_PER_PAGE + 1}–{Math.min(currentPage * QUESTIONS_PER_PAGE, filtered.length)}</span> of <span className="text-slate-300 font-semibold">{filtered.length}</span>{filtered.length !== allQuestions.length && <> (filtered from <span className="text-slate-300 font-semibold">{allQuestions.length}</span>)</>} questions
              </span>
              {selected.size > 0 && (
                <GlassBtn onClick={exportSelected} icon={FileSpreadsheet} label="Export .xlsx" accent="emerald" count={selected.size} />
              )}
            </div>
          </div>
        )}

        {/* ── Add Question Modal ── */}
        <PremiumDialog
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Question"
          subtitle="Create or import questions"
          maxWidth="max-w-lg"
          hideIcon
        >
          <div className="text-center pt-2">
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 mb-5">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-2xl blur-xl" />
              <div className="relative w-full h-full bg-slate-800/80 border border-slate-700/50 rounded-2xl flex items-center justify-center">
                <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-amber-400" />
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-300 mb-6 leading-relaxed">
              To add new questions, create or edit a test. All questions automatically appear in your Question Bank.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded-xl text-white font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <Link
                to="/teacher/create-test"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-colors"
              >
                <Plus className="h-4 w-4" /> Create Test
              </Link>
            </div>
          </div>
        </PremiumDialog>

      </main>
    </TeacherLayout>
  );
}

export default QuestionBankPage;