import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useCreateTestMutation } from '../../hooks/quizMutations';
import { useSidebar } from '../../contexts/SidebarContext';
import { Question, QuestionType, createDefaultQuestion, isMCQ } from '../../types/question';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Download, Upload, Clock, Award, FileText, Calendar, Settings, HelpCircle, Info, X } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import TestStatusSwitch from '../../components/shared/TestStatusSwitch';
import NegativeMarkingToggle from '../../components/shared/NegativeMarkingToggle';
import MCQTable from '../../components/shared/TC_INS';
import { TeacherLayout } from '../../components/layouts/TeacherLayout';
import { DateTimeField } from '../../components/teacher/Date_Time';
import TestCreationGuide from '../../components/teacher/TestCRelatedInfo';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const card = `rounded-2xl border border-white/[0.07] p-4 sm:p-6`
  + ` bg-gradient-to-br from-[#0d1425]/95 to-[#080f1e]/95`
  + ` shadow-xl shadow-black/40`;

const sectionDivider = `border-b border-white/[0.06] pb-4 mb-5 flex items-center gap-3`;

// Uniform height for every interactive element: h-10 (40 px)
const field = `h-10 w-full px-3 bg-[#0d1425] border border-white/[0.08]`
  + ` rounded-xl text-sm text-slate-100 placeholder-slate-500`
  + ` focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10`
  + ` transition-colors duration-200`;

const fieldTextarea = `w-full px-3 py-2.5 bg-[#0d1425] border border-white/[0.08]`
  + ` rounded-xl text-sm text-slate-100 placeholder-slate-500`
  + ` focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10`
  + ` transition-colors duration-200 resize-y`;

const label = `block mb-1.5 text-xs font-semibold text-slate-400 tracking-wide uppercase`;

/* Icon badge */
function IconBadge({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${gradient} shadow-lg`}>
      {children}
    </div>
  );
}

/* Stat pill */
function StatPill({ icon, value, color }: { icon: React.ReactNode; value: string; color: string }) {
  return (
    <div className={`h-10 flex items-center gap-2 px-3 rounded-xl border ${color} text-sm font-bold`}>
      {icon}
      <span className="truncate">{value}</span>
    </div>
  );
}

/* Action button – unified height h-10 */
function ActionBtn({
  onClick, color, icon, label, className = '',
}: {
  onClick?: () => void; color: string; icon: React.ReactNode; label?: string; className?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl font-semibold text-sm
          border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] ${color} ${className}`}>
      {icon}
      {label && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

function TestCreation() {
  const { user } = useUser();
  const createTestMutation = useCreateTestMutation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { minimizeSidebar } = useSidebar();

  useEffect(() => { minimizeSidebar(); }, [minimizeSidebar]);

  // Helper: returns local datetime as an ISO string with timezone offset (e.g. "2026-03-05T14:30:00+05:30")
  const toLocalISO = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const tzOffset = -date.getTimezoneOffset();
    const sign = tzOffset >= 0 ? '+' : '-';
    const absOffset = Math.abs(tzOffset);
    const tzHH = pad(Math.floor(absOffset / 60));
    const tzMM = pad(absOffset % 60);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${tzHH}:${tzMM}`;
  };

  const [testData, setTestData] = useState({
    title: '', description: '', duration: 30,
    startDate: toLocalISO(new Date()),
    endDate: toLocalISO(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    isPublic: true, negativeMarkingEnabled: false, defaultMarks: 1, negativeMarks: 1,
  });

  const [timeMode, setTimeMode] = useState<'per_question' | 'overall'>('per_question');
  const [timePerQuestion, setTimePerQuestion] = useState(60);
  const [overallDurationMinutes, setOverallDurationMinutes] = useState(30);

  const [numQuestionsToAdd, setNumQuestionsToAdd] = useState(1);
  const [selectedType, setSelectedType] = useState<QuestionType>('mcq');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleTestDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setTestData({ ...testData, [e.target.name]: e.target.value });

  const handleQuestionChange = (qi: number, field: string, value: string) => {
    setQuestions(questions.map((q, i) => {
      if (i !== qi) return q;
      if (field === 'question') return { ...q, question: value };
      if (field === 'correctAnswerText' && q.type === 'short_answer') return { ...q, correctAnswer: value };
      return q;
    }) as Question[]);
  };

  const handleOptionChange = (qi: number, oi: number, value: string) => {
    setQuestions(questions.map((q, i) => {
      if (i !== qi || !isMCQ(q)) return q;
      const opts = [...q.options]; opts[oi] = value;
      return { ...q, options: opts };
    }) as Question[]);
  };

  const handleCorrectAnswerChange = (qi: number, correctAnswer: number) => {
    setQuestions(questions.map((q, i) => (i === qi && isMCQ(q) ? { ...q, correctAnswer } : q)) as Question[]);
  };

  const handleMarksChange = (qi: number, marks: number) => {
    setQuestions(questions.map((q, i) => (i === qi ? { ...q, marks: Math.max(0, marks) } : q)) as Question[]);
  };

  const addQuestions = () => {
    if (numQuestionsToAdd < 1 || numQuestionsToAdd > 100) {
      addToast({ type: 'error', title: 'Invalid Input', message: 'Please enter a number between 1 and 100' }); return;
    }
    const newQs: Question[] = Array.from({ length: numQuestionsToAdd }, (_, i) => {
      const q = createDefaultQuestion((questions.length + i + 1).toString(), selectedType);
      q.marks = testData.defaultMarks; return q;
    });
    setQuestions([...questions, ...newQs]);
    setNumQuestionsToAdd(1);
  };

  const removeQuestion = (qi: number) => setQuestions(questions.filter((_, i) => i !== qi));

  const calculatePerQuestionTotalDuration = () => {
    const s = timePerQuestion * questions.length;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (sec > 0 || s === 0) parts.push(`${sec}s`);
    return parts.join(' ') || '--';
  };

  const getEffectiveDurationMinutes = () => {
    if (timeMode === 'overall') return overallDurationMinutes;
    return Math.ceil((timePerQuestion * questions.length) / 60);
  };

  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

  const handleCancel = () => {
    if (questions.length > 0 || testData.title || testData.description) {
      if (window.confirm('Are you sure? All data will be lost.')) navigate('/teacher');
    } else navigate('/teacher');
  };

  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/QuizMaster_MCQ_AutoID_Template.xlsx';
    a.download = 'QuizMaster_MCQ_AutoID_Template.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    addToast({ type: 'success', title: 'Template Downloaded', message: 'Template file downloaded.' });
  };

  const handleImportQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', blankrows: false });
      if (!jsonData || jsonData.length === 0) {
        addToast({ type: 'error', title: 'Import Failed', message: 'No questions found in the Excel file' });
        return;
      }
      const importedQuestions: Question[] = (jsonData as any[]).map((rawRow: any, index: number) => {
        // Normalize keys
        const row: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawRow)) {
          row[k.trim().toUpperCase()] = v;
        }

        const getVal = (names: string[]): string => {
          for (const name of names) {
            const val = row[name.toUpperCase()];
            if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
          }
          return '';
        };

        const question = getVal(['QUESTION', 'QUESTION TEXT', 'Q']);
        const section = getVal(['SECTION', 'CATEGORY']) || 'General';
        const optionA = getVal(['OPTION_A', 'OPTION A', 'A']);
        const optionB = getVal(['OPTION_B', 'OPTION B', 'B']);
        const optionC = getVal(['OPTION_C', 'OPTION C', 'C']);
        const optionD = getVal(['OPTION_D', 'OPTION D', 'D']);
        const correctAnswerText = getVal([
          'CORRECT_OPTION', 'CORRECT_ANSWER', 'CORRECT ANSWER',
          'ANSWER', 'CORRECT'
        ]);
        if (!question) return null;
        let correctAnswer = 0;
        const answerUpper = correctAnswerText.toUpperCase().trim();
        if (answerUpper === 'B') correctAnswer = 1;
        else if (answerUpper === 'C') correctAnswer = 2;
        else if (answerUpper === 'D') correctAnswer = 3;
        return {
          id: (questions.length + index + 1).toString(),
          type: 'mcq',
          question,
          options: [optionA, optionB, optionC, optionD],
          correctAnswer,
          marks: testData.defaultMarks || 1,
          section,
          created_at: new Date().toISOString(),
        } as Question;
      }).filter((q: any) => {
        if (!q || !q.question) return false;
        if (isMCQ(q as Question)) {
          return (q as Question & { options: string[] }).options.every((opt: string) => opt !== '');
        }
        return true;
      }) as Question[];
      if (importedQuestions.length === 0) {
        addToast({ type: 'error', title: 'Import Failed', message: 'No valid questions found. Check template format.' });
        return;
      }
      setQuestions([...questions, ...importedQuestions]);
      addToast({ type: 'success', title: 'Questions Imported', message: `✓ Imported ${importedQuestions.length} question(s).` });
      e.target.value = '';
    } catch (error) {
      addToast({ type: 'error', title: 'Import Error', message: error instanceof Error ? error.message : 'Failed to read file' });
      e.target.value = '';
    }
  };

  const handleSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (!testData.title) { addToast({ type: 'error', title: 'Validation Error', message: 'Please enter a test title' }); return; }
    if (!questions.length) { addToast({ type: 'error', title: 'Validation Error', message: 'Please add at least one question' }); return; }
    const invalid = questions.filter(q => !q.question || (isMCQ(q) && q.options.some(o => !o)));
    if (invalid.length) { addToast({ type: 'error', title: 'Validation Error', message: 'Fill in all question fields' }); return; }
    setLoading(true);
    try {
      const id = await createTestMutation.mutateAsync({
        ...testData, questions, createdBy: user?.id || '',
        duration: getEffectiveDurationMinutes(),
        timePerQuestion: timeMode === 'overall' ? undefined : timePerQuestion,
        totalMarks,
      });
      addToast({ type: 'success', title: 'Test Created', message: 'Your test has been created!' });
      navigate(`/teacher/test/${id}`);
    } catch (err: unknown) {
      let msg = 'Please check your connection and try again.';
      if (err instanceof Error) {
        if (err.message.includes('duplicate key')) msg = 'A test with this title already exists.';
        else msg = err.message;
      }
      addToast({ type: 'error', title: 'Failed to Create Test', message: msg });
    } finally { setLoading(false); }
  };

  return (
    <TeacherLayout
      activeNav="create"
      title="Create Test"
      subtitle="Design your custom MCQ test"
      headerActions={
        <button
          type="button"
          onClick={() => setShowInfoModal(true)}
          title="Test Creation Guide"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-gray-800/60 border border-white/[0.06] transition-all"
        >
          <Info className="w-4 h-4" />
        </button>
      }
    >
      <div className="w-full px-3 sm:px-5 lg:px-8 xl:px-12 py-5 pb-28">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Basic Information ───────────────────────────────────── */}
          <div className={card}>
            <div className={sectionDivider}>
              <IconBadge gradient="from-blue-500 to-cyan-500">
                <FileText className="w-4 h-4 text-white" />
              </IconBadge>
              <div>
                <h2 className="text-sm font-bold text-white">Basic Information</h2>
                <p className="text-[11px] text-slate-500">Test title and description</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className={label}>Test Title <span className="text-red-400 normal-case">*</span></label>
                <input type="text" name="title" value={testData.title} onChange={handleTestDataChange}
                  placeholder="e.g., Mathematics Final Exam" className={field} required />
              </div>
              <div>
                <label className={label}>Description <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
                <textarea name="description" value={testData.description} onChange={handleTestDataChange}
                  placeholder="Additional info about the test…"
                  className={`${fieldTextarea} min-h-[40px] max-h-[96px]`} />
              </div>
            </div>
          </div>

          {/* ── Timing Configuration ────────────────────────────────── */}
          <div className={card}>
            <div className={sectionDivider}>
              <IconBadge gradient="from-violet-500 to-purple-600">
                <Calendar className="w-4 h-4 text-white" />
              </IconBadge>
              <div>
                <h2 className="text-sm font-bold text-white">Timing Configuration</h2>
                <p className="text-[11px] text-slate-500">Schedule and test timer</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <DateTimeField
                  value={testData.startDate}
                  onChange={v => setTestData(d => ({ ...d, startDate: v }))}
                  label="Start Time"
                  required
                />
              </div>
              <div>
                <DateTimeField
                  value={testData.endDate}
                  onChange={v => setTestData(d => ({ ...d, endDate: v }))}
                  label="End Time"
                  required
                />
              </div>

              {/* Mode Selector */}
              <div>
                <label className={label}>Timer Mode</label>
                <select
                  value={timeMode}
                  onChange={(e) => setTimeMode(e.target.value as 'per_question' | 'overall')}
                  className={`${field} cursor-pointer`}
                >
                  <option value="per_question">Time per Question</option>
                  <option value="overall">Overall Test Time</option>
                </select>
              </div>

              {timeMode === 'per_question' ? (
                <>
                  <div>
                    <label className={label}>Time / Question (sec)</label>
                    <input type="number" value={timePerQuestion || ''} onChange={e => setTimePerQuestion(parseInt(e.target.value) || 0)}
                      min="10" placeholder="60" className={field} />
                  </div>
                  {/* Duration stat (calculated) */}
                  <div>
                    <label className={label}>Total Duration</label>
                    <StatPill
                      icon={<Clock className="w-3.5 h-3.5 flex-shrink-0" />}
                      value={calculatePerQuestionTotalDuration()}
                      color="bg-blue-500/10 border-blue-500/25 text-blue-400"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={label}>Duration (minutes)</label>
                    <input type="number" value={overallDurationMinutes || ''} onChange={e => setOverallDurationMinutes(parseInt(e.target.value) || 0)}
                      min="1" placeholder="30" className={field} />
                  </div>
                  <div>
                    <label className={label}>Total Time</label>
                    <StatPill
                      icon={<Clock className="w-3.5 h-3.5 flex-shrink-0" />}
                      value={`${overallDurationMinutes} min${overallDurationMinutes !== 1 ? 's' : ''}`}
                      color="bg-purple-500/10 border-purple-500/25 text-purple-400"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Test Settings ───────────────────────────────────────── */}
          <div className={card}>
            <div className={sectionDivider}>
              <IconBadge gradient="from-indigo-500 to-violet-600">
                <Settings className="w-4 h-4 text-white" />
              </IconBadge>
              <div>
                <h2 className="text-sm font-bold text-white">Test Settings</h2>
                <p className="text-[11px] text-slate-500">Visibility, marks, and penalties</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">

              {/* Visibility */}
              <div>
                <label className={label}>Visibility</label>
                <TestStatusSwitch isPublic={testData.isPublic} onChange={isPublic => setTestData({ ...testData, isPublic })} />
              </div>

              {/* Default marks + Total Marks */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className={label}>Default Marks / Q</label>
                  <input type="number" min="1" step="1"
                    value={isNaN(testData.defaultMarks) ? '' : testData.defaultMarks}
                    onChange={e => { const v = e.target.value; setTestData({ ...testData, defaultMarks: v === '' ? NaN : parseInt(v) }); }}
                    onBlur={() => { if (isNaN(testData.defaultMarks) || testData.defaultMarks < 1) setTestData({ ...testData, defaultMarks: 1 }); }}
                    title="Default marks per question" placeholder="1" className={field} />
                </div>
                <div>
                  <label className={label}>Total Marks</label>
                  <StatPill
                    icon={<Award className="w-3.5 h-3.5 flex-shrink-0" />}
                    value={String(totalMarks)}
                    color="bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  />
                </div>
              </div>

              {/* Negative marking */}
              <div>
                <NegativeMarkingToggle
                  enabled={testData.negativeMarkingEnabled}
                  onChange={v => setTestData({ ...testData, negativeMarkingEnabled: v })}
                  negativeMarks={testData.negativeMarks}
                  showDescription={false}
                />
                {testData.negativeMarkingEnabled && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-xs text-slate-400 whitespace-nowrap">Deduct</span>
                    <input type="number" min="0" step="0.25"
                      value={isNaN(testData.negativeMarks) ? '' : testData.negativeMarks}
                      onChange={e => { const v = e.target.value; setTestData({ ...testData, negativeMarks: v === '' ? NaN : parseFloat(v) }); }}
                      onBlur={() => { if (isNaN(testData.negativeMarks) || testData.negativeMarks < 0) setTestData({ ...testData, negativeMarks: 0 }); }}
                      title="Negative marks deduction" placeholder="0"
                      className="h-8 w-20 px-2 bg-[#0d1425] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-colors" />
                    <span className="text-xs text-slate-400 whitespace-nowrap">mark(s) per wrong answer</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Questions ───────────────────────────────────────────── */}
          <div className={card}>
            <div className={sectionDivider}>
              <IconBadge gradient="from-cyan-500 to-blue-600">
                <HelpCircle className="w-4 h-4 text-white" />
              </IconBadge>
              <div>
                <h2 className="text-sm font-bold text-white">Questions</h2>
                <p className="text-[11px] text-slate-500">
                  {questions.length > 0 ? `${questions.length} question${questions.length > 1 ? 's' : ''} added` : 'Add and manage test questions'}
                </p>
              </div>
            </div>

            {/* Controls bar */}
            <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-[#080f1e]/60 border border-white/[0.06] mb-5">
              {/* Type */}
              <div className="flex-1 min-w-[130px]">
                <label className={label}>Question Type</label>
                <select value={selectedType} onChange={e => setSelectedType(e.target.value as QuestionType)}
                  title="Question type" className={`${field} cursor-pointer`}>
                  <option value="mcq">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                </select>
              </div>
              {/* Count */}
              <div className="w-24">
                <label className={label}>Count</label>
                <input type="number" value={numQuestionsToAdd || ''} onChange={e => setNumQuestionsToAdd(parseInt(e.target.value) || 0)}
                  min="1" max="100" title="Number of questions to add" placeholder="1" className={field} />
              </div>
              {/* Add */}
              <ActionBtn
                onClick={addQuestions}
                icon={<Plus className="w-4 h-4" />}
                label="Add Questions"
                color="bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-300"
              />

              {/* Import tools — pushed to the right */}
              <div className="flex gap-2.5 ml-auto flex-wrap">
                <ActionBtn
                  onClick={downloadTemplate}
                  icon={<Download className="w-4 h-4" />}
                  label="DownloadTemplate"
                  color="bg-emerald-500/12 hover:bg-emerald-500/22 border-emerald-500/25 text-emerald-300"
                  className="hidden sm:flex"
                />
                {/* mobile: icon only */}
                <ActionBtn
                  onClick={downloadTemplate}
                  icon={<Download className="w-4 h-4" />}
                  color="bg-emerald-500/12 hover:bg-emerald-500/22 border-emerald-500/25 text-emerald-300"
                  className="sm:hidden w-10 !px-0"
                />

                <ActionBtn
                  onClick={() => setShowTemplateModal(true)}
                  icon={<Info className="w-4 h-4" />}
                  color="bg-blue-500/12 hover:bg-blue-500/22 border-blue-500/25 text-blue-300"
                  className="w-10 !px-0"
                />

                <label className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl font-semibold text-sm
                    border border-amber-500/25 bg-amber-500/12 hover:bg-amber-500/22 text-amber-300
                    transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer`}>
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline whitespace-nowrap">Import Questions</span>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportQuestions} className="hidden" />
                </label>
              </div>
            </div>

            {/* Empty state */}
            {questions.length === 0 ? (
              <div className="py-14 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.01]">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-white/[0.06] flex items-center justify-center mb-3">
                  <HelpCircle className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No questions added yet</p>
                <p className="text-xs text-slate-600 mt-1">Add manually or import from a template</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, qi) => (
                  <div key={qi}
                    className="group rounded-xl border border-white/[0.06] hover:border-cyan-500/25 bg-[#080f1e]/50 p-4 transition-colors duration-200">

                    {/* Q header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.05]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {qi + 1}
                        </div>
                        <span className="font-semibold text-sm text-slate-300">
                          Question {qi + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-white/[0.07] text-slate-500 bg-white/[0.03]">
                          {question.type.replace('_', ' ')}
                        </span>
                      </div>
                      <button type="button" onClick={() => removeQuestion(qi)}
                        className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold
                            bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300
                            transition-all duration-200">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left */}
                      <div className="space-y-3">
                        <div>
                          <label className={label}>Section Name</label>
                          <input type="text" value={question.section || 'General'}
                            onChange={e => handleQuestionChange(qi, 'section', e.target.value)}
                            placeholder="e.g. C++, Python, General"
                            className={field} />
                        </div>
                        <div>
                          <label className={label}>Question Text <span className="text-red-400">*</span></label>
                          <textarea value={question.question}
                            onChange={e => handleQuestionChange(qi, 'question', e.target.value)}
                            placeholder="Enter your question here"
                            className={`${fieldTextarea} min-h-[72px] max-h-[140px]`} required />
                        </div>

                        {isMCQ(question) && (
                          <div>
                            <label className={label}>Options <span className="text-red-400">*</span></label>
                            <div className="space-y-2">
                              {question.options.map((opt: string, oi: number) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <div className="w-7 h-7 flex-shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.03] flex items-center justify-center text-slate-500 font-bold text-xs">
                                    {String.fromCharCode(65 + oi)}
                                  </div>
                                  <input type="text" value={opt}
                                    onChange={e => handleOptionChange(qi, oi, e.target.value)}
                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                    className={field}
                                    readOnly={question.type === 'true_false'} required />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right */}
                      <div className="space-y-3">
                        <div>
                          <label className={label}>Correct Answer <span className="text-red-400">*</span></label>
                          {isMCQ(question) ? (
                            <select value={question.correctAnswer}
                              onChange={e => handleCorrectAnswerChange(qi, parseInt(e.target.value))}
                              title="Select correct answer" className={`${field} cursor-pointer`} required>
                              <option value="">Select correct answer</option>
                              {question.options.map((_: string, oi: number) => (
                                <option key={oi} value={oi}>
                                  Option {String.fromCharCode(65 + oi)}
                                  {question.type === 'true_false' ? ` (${question.options[oi]})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="text" value={question.correctAnswer as string}
                              onChange={e => handleQuestionChange(qi, 'correctAnswerText', e.target.value)}
                              placeholder="Exact answer text"
                              className={field} required />
                          )}
                        </div>
                        <div>
                          <label className={label}>Marks <span className="text-red-400">*</span></label>
                          <input type="number" value={question.marks > 0 ? question.marks : ''}
                            onChange={e => handleMarksChange(qi, parseInt(e.target.value) || 0)}
                            onBlur={() => { if (!question.marks || question.marks < 1) handleMarksChange(qi, 1); }}
                            min="1" placeholder="1" className={field} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* ── Test Creation Guide Modal ───────────────────────────────── */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowInfoModal(false); }}>
          <div className="min-h-screen relative">
            <button
              onClick={() => setShowInfoModal(false)}
              title="Close Guide"
              className="fixed top-2 right-4 z-[60] w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900/90 border border-white/[0.12] text-slate-400 hover:text-white hover:bg-gray-800 transition-all shadow-xl"
            >
              <X className="w-4 h-4" />
            </button>
            <TestCreationGuide />
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70">
          <div className="bg-[#0d1425] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
              <h2 className="text-base font-bold text-white">Excel Template Format Guide</h2>
              <button onClick={() => setShowTemplateModal(false)} title="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <p className="text-sm text-slate-400">Use this template format when importing questions via Excel:</p>
              <div className="overflow-x-auto"><MCQTable /></div>
              <div className="p-3.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                <p className="text-xs text-slate-500">
                  <span className="text-cyan-400 font-semibold">Note: </span>
                  Columns with values will be imported. Empty rows are skipped automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Bottom Bar ────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#080f1e] border-t border-white/[0.06]">
        <div className="w-full px-4 sm:px-6 xl:px-12 py-3 flex items-center justify-end gap-3">
          <button type="button" onClick={handleCancel}
            className="h-10 px-5 rounded-xl font-semibold text-sm text-slate-300 hover:text-white
                bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07]
                transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
            Cancel
          </button>
          <button type="button" onClick={() => handleSubmit()} disabled={loading}
            className="h-10 px-6 rounded-xl font-semibold text-sm text-white
                bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600
                border border-emerald-500/40 shadow-lg shadow-emerald-900/30
                transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                flex items-center gap-2">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Creating…</span></>
            ) : (
              <><Plus className="w-4 h-4" /><span>Create Test</span></>
            )}
          </button>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default TestCreation;