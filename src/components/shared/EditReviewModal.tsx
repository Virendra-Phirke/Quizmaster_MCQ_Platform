import { X } from 'lucide-react';

interface Review {
  id: string;
  user_id: string;
  name: string;
  role: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface EditReviewModalProps {
  editingReview: Review | null;
  editFormData: { rating: number; comment: string };
  setEditFormData: (value: { rating: number; comment: string }) => void;
  updating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function EditReviewModal({
  editingReview,
  editFormData,
  setEditFormData,
  updating,
  onSubmit,
  onClose,
}: EditReviewModalProps) {
  if (!editingReview) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Outer subtle border glow ── */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-slate-400/10 via-slate-600/5 to-slate-400/8 pointer-events-none" />

        <div className="relative rounded-2xl overflow-hidden bg-slate-900/95 border border-slate-700/60 shadow-[0_32px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {/* ── Ambient blobs ── */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-slate-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-slate-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative p-5 sm:p-7 md:p-8">
            {/* ── Header row ── */}
            <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-slate-300"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Edit Review
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-100 leading-tight tracking-tight">
                  Update Your Experience
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Revise your rating or comment below.
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-[color,background-color,border-color,transform] duration-150 active:scale-95"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* ── Divider ── */}
            <div className="h-px bg-slate-800 mb-5 sm:mb-6" />

            <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">
              {/* ── Star Rating ── */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="flex-shrink-0 text-slate-500"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Rating
                </label>
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setEditFormData({ ...editFormData, rating: star })
                      }
                      className={`
                        group p-1 rounded-lg transition-transform duration-150 focus:outline-none
                        hover:scale-110 active:scale-95
                        ${
                          star <= editFormData.rating
                            ? 'bg-yellow-400/10 border border-yellow-500/25'
                            : 'hover:bg-slate-700/60 border border-transparent'
                        }
                      `}
                      aria-label={`Rate ${star} stars`}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-[width,transform] duration-150 sm:w-6 sm:h-6 ${
                          star <= editFormData.rating
                            ? 'fill-yellow-400 stroke-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.4)]'
                            : 'fill-transparent stroke-slate-600 group-hover:stroke-slate-400'
                        }`}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  ))}
                  <div className="ml-2 flex items-center gap-1.5">
                    <span className="text-xs font-bold text-yellow-400">
                      {editFormData.rating}
                    </span>
                    <span className="text-[10px] text-slate-600">/5</span>
                    <span
                      className={`text-[10px] font-medium ${
                        editFormData.rating >= 5
                          ? 'text-slate-300'
                          : editFormData.rating >= 4
                            ? 'text-slate-400'
                            : editFormData.rating >= 3
                              ? 'text-yellow-500/80'
                              : editFormData.rating >= 2
                                ? 'text-orange-400/80'
                                : 'text-red-400/80'
                      }`}
                    >
                      {editFormData.rating >= 5
                        ? '· Excellent'
                        : editFormData.rating >= 4
                          ? '· Good'
                          : editFormData.rating >= 3
                            ? '· Average'
                            : editFormData.rating >= 2
                              ? '· Poor'
                              : '· Very Poor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Textarea ── */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="flex-shrink-0"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Your Review
                </label>
                <div className="relative group">
                  <textarea
                    value={editFormData.comment}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        comment: e.target.value
                      })
                    }
                    className="w-full px-4 py-3.5 bg-slate-800/70 border border-slate-700/60 focus:border-slate-500/80 focus:bg-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500/30 h-28 sm:h-32 resize-none transition-[color,background-color,border-color,box-shadow] duration-200 text-xs sm:text-sm leading-relaxed"
                    placeholder="Share your thoughts about QuizMaster…"
                    required
                    minLength={10}
                  />
                  <div className="absolute bottom-2.5 right-3.5 flex items-center gap-2 pointer-events-none select-none">
                    {editFormData.comment.length < 10 &&
                      editFormData.comment.length > 0 && (
                        <span className="text-[10px] text-orange-400/70">
                          {10 - editFormData.comment.length} more
                        </span>
                      )}
                    <span className="text-[10px] text-slate-600">
                      {editFormData.comment.length > 0 &&
                        editFormData.comment.length}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 pl-0.5">
                  Minimum 10 characters required.
                </p>
              </div>

              {/* ── Action row ── */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[10px] text-slate-600 hidden sm:block">
                  Changes visible after moderation.
                </p>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] sm:text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-slate-600 transition-[color,background-color,border-color,transform] duration-150 active:scale-95"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>

                  {/* Save */}
                  <button
                    type="submit"
                    disabled={
                      updating || editFormData.comment.length < 10
                    }
                    className={`
                      group relative flex items-center gap-1.5
                      px-4 py-2 rounded-xl text-[11px] sm:text-xs font-semibold tracking-wide
                      transition-[width,transform] duration-200 overflow-hidden whitespace-nowrap
                      ${
                        updating || editFormData.comment.length < 10
                          ? 'opacity-40 cursor-not-allowed bg-slate-800 border border-slate-700/60 text-slate-500'
                          : 'bg-slate-700 hover:bg-slate-600 border border-slate-600/80 hover:border-slate-500 text-slate-100 hover:text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] hover:shadow-[0_4px_18px_rgba(0,0,0,0.45)] active:scale-95'
                      }
                    `}
                  >
                    {/* Top glass sheen */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                    {/* Shimmer sweep */}
                    {!updating && editFormData.comment.length >= 10 && (
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/8 to-transparent skew-x-12 pointer-events-none" />
                    )}

                    {updating ? (
                      <>
                        <svg
                          className="animate-spin w-3 h-3 relative z-10"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        <span className="relative z-10">Saving…</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="relative z-10 transition-transform duration-150 group-hover:scale-110"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="relative z-10">Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
