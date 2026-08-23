import { useState, useEffect, useCallback } from "react";
import { Star, Edit2, Trash2, X } from "lucide-react";

interface Review {
    id: string;
    user_id: string;
    name: string;
    role: string;
    rating: number;
    comment: string;
    created_at: string;
}

interface ReviewGridModalProps {
    reviews: Review[];
    currentUserId?: string;
    deletingReviewId?: string | null;
    onEdit: (review: Review) => void;
    onDelete: (reviewId: string) => void;
    maxItems?: number;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <span className="inline-flex gap-px">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={size}
                    className={
                        s <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-transparent text-gray-600"
                    }
                />
            ))}
        </span>
    );
}

function CenteredModal({
    review,
    onClose,
    currentUserId,
    onEdit,
    onDelete,
    deletingReviewId,
}: {
    review: Review;
    onClose: () => void;
    currentUserId?: string;
    onEdit: (r: Review) => void;
    onDelete: (id: string) => void;
    deletingReviewId?: string | null;
}) {
    const isOwner = currentUserId === review.user_id;

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50"
                style={{ background: "rgba(5,5,12,0.85)" }}
                onClick={onClose}
            />

            {/* Modal panel — full-screen sheet on mobile, centered card on desktop */}
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:px-4">
                <div
                    className="relative w-full pointer-events-auto sm:max-w-xl"
                    style={{
                        background: "rgba(20,21,30,0.98)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        /* Rounded top corners only on mobile (bottom-sheet style) */
                        borderRadius: "16px 16px 0 0",
                        boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                        /* Desktop: normal rounded box */
                        maxHeight: "70%",
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Mobile drag handle */}
                    <div className="flex justify-center pt-3 pb-1 sm:hidden">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    {/* Inner padding — tighter on mobile */}
                    <div className="px-6 pt-4 pb-8 sm:px-12 sm:pt-10 sm:pb-10"
                        style={{ borderRadius: "inherit" }}
                    >
                        {/* X close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>

                        {/* Reviewer name */}
                        <h2
                            className="text-white text-center font-light tracking-wide mb-1 pr-6 sm:pr-0"
                            style={{ fontSize: "clamp(1.2rem, 5vw, 1.9rem)", letterSpacing: "0.02em" }}
                        >
                            {review.name}
                        </h2>

                        {/* Role */}
                        <p className="text-gray-500 text-center mb-4 tracking-widest uppercase" style={{ fontSize: "0.65rem" }}>
                            {review.role}
                        </p>

                        {/* Divider */}
                        <div className="w-10 h-px bg-gray-700 mx-auto mb-5" />

                        {/* Stars */}
                        <div className="flex justify-center mb-4">
                            <StarRating rating={review.rating} size={16} />
                        </div>

                        {/* Label */}
                        <p className="text-gray-500 text-center mb-5 italic" style={{ fontSize: "0.78rem" }}>
                            Full Review
                        </p>

                        {/* Full comment */}
                        <p
                            className="text-gray-200 text-center leading-relaxed"
                            style={{ fontSize: "clamp(0.82rem, 3.5vw, 0.92rem)", lineHeight: "1.8" }}
                        >
                            {review.comment}
                        </p>

                        {/* Date */}
                        <p className="text-gray-600 text-center mt-5 tracking-widest uppercase" style={{ fontSize: "0.62rem" }}>
                            {new Date(review.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>

                        {/* Owner actions */}
                        {isOwner && (
                            <div className="flex justify-center gap-3 mt-7 pt-5 border-t border-white/[0.06]">
                                <button
                                    onClick={() => { onEdit(review); onClose(); }}
                                    className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded text-xs font-medium text-indigo-400 border border-indigo-500/25 bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/30 transition-colors tracking-wide uppercase touch-manipulation"
                                >
                                    <Edit2 size={12} /> Edit
                                </button>
                                <button
                                    onClick={() => { onDelete(review.id); onClose(); }}
                                    disabled={deletingReviewId === review.id}
                                    className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded text-xs font-medium text-red-400 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 transition-colors tracking-wide uppercase disabled:opacity-40 touch-manipulation"
                                >
                                    <Trash2 size={12} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

function ReviewCard({
    review,
    currentUserId,
    deletingReviewId,
    onEdit,
    onDelete,
}: {
    review: Review;
    currentUserId?: string;
    deletingReviewId?: string | null;
    onEdit: (r: Review) => void;
    onDelete: (id: string) => void;
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const isOwner = currentUserId === review.user_id;
    const closeModal = useCallback(() => setModalOpen(false), []);

    useEffect(() => {
        document.body.style.overflow = modalOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [modalOpen]);

    const snippet =
        review.comment.length > 100
            ? review.comment.slice(0, 100).trimEnd() + "…"
            : review.comment;

    return (
        <>
            {modalOpen && (
                <CenteredModal
                    review={review}
                    onClose={closeModal}
                    currentUserId={currentUserId}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    deletingReviewId={deletingReviewId}
                />
            )}

            {/* Card — full-width on mobile, auto-sized on desktop */}
            <div
                className="relative group cursor-pointer select-none transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 touch-manipulation"
                onClick={() => setModalOpen(true)}
                style={{
                    background: "rgba(255,255,255,0.032)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "6px",
                    padding: "16px 16px 14px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                }}
            >
                {/* Reviewer name */}
                <h3
                    className="text-white font-medium mb-1.5 leading-snug"
                    style={{
                        fontSize: "clamp(0.82rem, 3vw, 0.88rem)",
                        letterSpacing: "0.01em",
                        /* Leave room for owner buttons on desktop */
                        paddingRight: isOwner ? "3.5rem" : "0",
                    }}
                >
                    {review.name}
                </h3>

                {/* Role */}
                <p className="text-gray-500 mb-2" style={{ fontSize: "clamp(0.65rem, 2.5vw, 0.72rem)" }}>
                    {review.role}
                </p>

                {/* Rating */}
                <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-gray-500" style={{ fontSize: "0.65rem" }}>Rating:</span>
                    <StarRating rating={review.rating} size={11} />
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-white/[0.06] mb-3" />

                {/* Snippet */}
                <p className="text-gray-500 leading-relaxed" style={{ fontSize: "clamp(0.7rem, 2.5vw, 0.75rem)" }}>
                    {snippet}
                </p>

                {/* "Tap to read" label on mobile */}
                <p className="text-gray-700 mt-2 sm:hidden" style={{ fontSize: "0.62rem", letterSpacing: "0.04em" }}>
                    TAP TO READ FULL REVIEW
                </p>

                {/* Owner quick-action buttons — desktop only (hidden on touch to avoid mis-taps) */}
                {isOwner && (
                    <div
                        className="absolute top-2.5 right-2.5 hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => onEdit(review)}
                            className="p-1.5 rounded text-gray-600 hover:text-indigo-400 transition-colors"
                            title="Edit"
                        >
                            <Edit2 size={11} />
                        </button>
                        <button
                            onClick={() => onDelete(review.id)}
                            disabled={deletingReviewId === review.id}
                            className="p-1.5 rounded text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                            title="Delete"
                        >
                            <Trash2 size={11} />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

/**
 * ReviewGridModal
 *
 * Fully responsive review grid:
 * - Mobile (< sm):  1 column, modal slides up as a bottom sheet
 * - Tablet (sm–lg): 2 columns, centered modal
 * - Desktop (lg+):  4-column auto-fill grid, centered modal
 *
 * Click/tap any card → modal with full review + X close button.
 * Escape key or backdrop tap also closes.
 */
export function ReviewGridModal({
    reviews,
    currentUserId,
    deletingReviewId,
    onEdit,
    onDelete,
    maxItems = 10,
}: ReviewGridModalProps) {
    if (reviews.length === 0) {
        return (
            <div className="text-center py-16 px-4">
                <div className="w-12 h-12 mx-auto mb-4 rounded flex items-center justify-center border border-white/10 bg-white/[0.03]">
                    <Star className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-gray-600 text-sm tracking-wide">
                    No reviews yet. Be the first to share your experience.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-10">
            {reviews.slice(0, maxItems).map((review) => (
                <ReviewCard
                    key={review.id}
                    review={review}
                    currentUserId={currentUserId}
                    deletingReviewId={deletingReviewId}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}