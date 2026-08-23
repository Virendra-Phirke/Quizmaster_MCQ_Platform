import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, ArrowLeft, Filter, X, Edit2,
  TrendingUp, Users, Award, Search, BarChart3
} from 'lucide-react';
import { ReviewGridModal } from '../../components/shared/ReviewGridModel';
import { supabase } from '../../lib/supabase';
import { useUser } from '@clerk/clerk-react';
import { useToast } from '../../components/ui/Toast';
import { PremiumDialog } from '../../components/shared/PremiumDialog';
import { ReviewForm } from '../../components/shared/ReviewForm';
import { EditReviewModal } from '../../components/shared/EditReviewModal';
import { canonicalizeRole } from '../../lib/roleUtils';

interface Review {
  id: string;
  user_id: string;
  name: string;
  role: string;
  rating: number;
  comment: string;
  created_at: string;
}

function AllReviewsPage() {
  const { user } = useUser();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filterRating, setFilterRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editFormData, setEditFormData] = useState({ rating: 5, comment: '' });
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const { addToast } = useToast();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const openEditModal = (review: Review) => {
    setEditingReview(review);
    setEditFormData({ rating: review.rating, comment: review.comment });
  };

  const closeEditModal = () => {
    setEditingReview(null);
    setEditFormData({ rating: 5, comment: '' });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview || !user) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .update({ rating: editFormData.rating, comment: editFormData.comment })
        .eq('id', editingReview.id)
        .eq('user_id', user.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No rows were updated. You may not have permission to edit this review.');
      setReviews(reviews.map(r => r.id === editingReview.id ? { ...r, rating: editFormData.rating, comment: editFormData.comment } : r));
      closeEditModal();
      addToast({ type: 'success', title: 'Review Updated', message: 'Your review has been updated successfully.' });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Update Failed', message: error.message || 'Please try again.' });
    } finally {
      setUpdating(false);
    }
  };

  const confirmDeleteReview = async () => {
    const reviewId = showDeleteConfirm;
    if (!user || !reviewId) return;
    setShowDeleteConfirm(null);
    setDeletingReviewId(reviewId);
    try {
      const { data, error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', user.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No rows were deleted. You may not have permission to delete this review.');
      setReviews(reviews.filter(r => r.id !== reviewId));
      addToast({ type: 'success', title: 'Review Deleted', message: 'Your review has been deleted successfully.' });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Delete Failed', message: error.message || 'Please try again.' });
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { addToast({ type: 'error', title: 'Not Signed In', message: 'Please sign in to submit a review.' }); return; }
    setSubmitting(true);
    try {
      const userName = user.fullName || user.firstName || user.username || 'Anonymous User';
      const userRole = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'Student';
      const reviewData = {
        user_id: user.id, name: userName,
        role: userRole.charAt(0).toUpperCase() + userRole.slice(1),
        rating: newReview.rating, comment: newReview.comment
      };
      const { data, error } = await supabase.from('reviews').insert([reviewData]).select().single();
      if (error) {
        if (error.code === '23505') addToast({ type: 'warning', title: 'Already Reviewed', message: 'You have already submitted a review.' });
        else addToast({ type: 'error', title: 'Submission Error', message: error.message || 'Failed to submit review.' });
        return;
      }
      setReviews([data, ...reviews]);
      setNewReview({ rating: 5, comment: '' });
      setShowReviewForm(false);
      addToast({ type: 'success', title: 'Review Submitted', message: 'Thank you for your feedback!' });
    } catch {
      addToast({ type: 'error', title: 'Submission Failed', message: 'Failed to submit review. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => { loadReviews(); }, []);

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase.from('reviews')
        .select('id, user_id, name, role, rating, comment, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedReviews = () => {
    let filtered = filterRating > 0 ? reviews.filter(r => r.rating === filterRating) : reviews;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) || r.comment.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'highest') return b.rating - a.rating;
      return a.rating - b.rating;
    });
    if (user?.id) return [...sorted.filter(r => r.user_id === user.id), ...sorted.filter(r => r.user_id !== user.id)];
    return sorted;
  };

  const getAverageRating = () =>
    reviews.length === 0 ? 0 : (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  const getRatingCount = (rating: number) => reviews.filter(r => r.rating === rating).length;
  const getRatingPercentage = (rating: number) =>
    reviews.length === 0 ? 0 : Math.round((getRatingCount(rating) / reviews.length) * 100);

  const existingReview = user ? reviews.find(r => r.user_id === user.id) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-0 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]" />
      </div>

      {/* ── Compact Header ── */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f] border-b border-white/10 shadow-lg">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-3 py-2.5">
            <Link to="/"
              className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-[color,background-color,border-color]">
              <ArrowLeft className="h-3.5 w-3.5 text-gray-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-xs text-gray-400 group-hover:text-white hidden sm:inline">Back</span>
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                All User Reviews
              </h1>
              <p className="text-[10px] text-gray-500 hidden sm:block">Community feedback and testimonials</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-3">

        {/* ── Small Stat Tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2.5">
          {/* Total Reviews */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-purple-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/20 transition-[color,background-color,border-color,box-shadow,transform]">
            <div className="p-1.5 bg-purple-500/10 rounded-lg shrink-0">
              <Users className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">Total Reviews</p>
              <p className="text-sm font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent leading-none">{reviews.length}</p>
            </div>
          </div>

          {/* Average Rating */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-amber-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/20 transition-[color,background-color,border-color,box-shadow,transform]">
            <div className="p-1.5 bg-amber-500/10 rounded-lg shrink-0">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">Avg Rating</p>
              <div className="flex items-center gap-0.5">
                <p className="text-sm font-black bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent leading-none">{getAverageRating()}</p>
                <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
              </div>
            </div>
          </div>

          {/* 5 Star */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-emerald-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/20 transition-[color,background-color,border-color,box-shadow,transform]">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg shrink-0">
              <Award className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">5 Star</p>
              <p className="text-sm font-black bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent leading-none">{getRatingCount(5)}</p>
            </div>
          </div>

          {/* 4+ Star */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-blue-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/20 transition-[color,background-color,border-color,box-shadow,transform]">
            <div className="p-1.5 bg-blue-500/10 rounded-lg shrink-0">
              <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">4+ Star</p>
              <p className="text-sm font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent leading-none">{getRatingCount(5) + getRatingCount(4)}</p>
            </div>
          </div>
        </div>

        {/* ── Distribution + Filters side-by-side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-2 mb-2.5">

          {/* Rating Distribution */}
          <div className="rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 p-3 shadow-xl">
            <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
              Rating Distribution
            </h3>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 w-7 shrink-0">
                    <span className="text-[10px] font-semibold text-gray-300">{rating}</span>
                    <Star className="h-2 w-2 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full transition-[width] duration-500"
                      style={{ width: `${getRatingPercentage(rating)}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400 w-7 text-right">{getRatingPercentage(rating)}%</span>
                  <span className="text-[10px] text-gray-500 w-5 text-right">({getRatingCount(rating)})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Search + Filters */}
          <div className="rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 p-3 shadow-xl">
            {/* Search row */}
            <div className="relative flex items-center gap-2 mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, comment, or role..."
                className="flex-1 pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 hover:border-purple-500/50 focus:border-purple-500 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-[color,background-color,border-color,box-shadow]" />
              <button
                onClick={() => existingReview ? openEditModal(existingReview) : setShowReviewForm(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-500/20 hover:bg-teal-400/30 text-teal-200 hover:text-white border border-teal-400/30 hover:border-teal-300/50 rounded-lg font-medium text-xs transition-[color,background-color,border-color,transform] active:scale-95">
                {existingReview
                  ? <><Edit2 className="w-3 h-3" /><span className="hidden sm:inline">Edit Review</span><span className="sm:hidden">Edit</span></>
                  : <span>Write Review</span>}
              </button>
            </div>

            {/* Filter + Sort */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <Filter className="h-2.5 w-2.5 text-purple-400" />
                  <span className="text-[10px] text-gray-400 font-semibold">Filter by Rating</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setFilterRating(0)}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${filterRating === 0 ? 'bg-slate-700 text-white border border-slate-600' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'}`}>
                    All
                  </button>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button key={rating} onClick={() => setFilterRating(rating)}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-0.5 ${filterRating === rating ? 'bg-slate-700 text-white border border-slate-600' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'}`}>
                      {rating}<Star className="h-2 w-2 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:w-36">
                <label className="block text-[10px] text-gray-400 font-semibold mb-1">Sort by</label>
                <select title="Sort reviews" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'newest' | 'highest' | 'lowest')}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 hover:border-purple-500/50 focus:border-purple-500 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-[color,background-color,border-color,box-shadow] cursor-pointer">
                  <option value="newest" style={{ backgroundColor: '#1e293b', color: 'white' }}>Newest First</option>
                  <option value="highest" style={{ backgroundColor: '#1e293b', color: 'white' }}>Highest Rating</option>
                  <option value="lowest" style={{ backgroundColor: '#1e293b', color: 'white' }}>Lowest Rating</option>
                </select>
              </div>
            </div>

            {/* Active filters */}
            {(filterRating > 0 || searchQuery.trim()) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-white/10">
                <span className="text-[10px] text-gray-400">Active:</span>
                {filterRating > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">
                    {filterRating}★
                    <button onClick={() => setFilterRating(0)} title="Clear" className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {searchQuery.trim() && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">
                    "{searchQuery.slice(0, 12)}{searchQuery.length > 12 ? '…' : ''}"
                    <button onClick={() => setSearchQuery('')} title="Clear" className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                <button onClick={() => { setFilterRating(0); setSearchQuery(''); }}
                  className="text-[10px] text-gray-400 hover:text-white transition-colors font-semibold">
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Review Form Modal */}
        {showReviewForm && user && (
          <div className="fixed inset-0 z-40 overflow-y-auto animate-fade-in" onClick={() => setShowReviewForm(false)}>
            <div className="flex items-center justify-center min-h-screen px-4 py-8">
              <div className="fixed inset-0 bg-black/80" />
              <div className="relative z-50 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
                <ReviewForm user={user} newReview={newReview} setNewReview={setNewReview} submitting={submitting} onSubmit={handleReviewSubmit} onCancel={() => setShowReviewForm(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Reviews Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-purple-500/30 border-t-purple-500" />
            <p className="text-xs text-slate-400 mt-3 font-medium">Loading reviews...</p>
          </div>
        ) : filteredAndSortedReviews().length > 0 ? (
          <ReviewGridModal
            reviews={filteredAndSortedReviews()}
            currentUserId={user?.id}
            deletingReviewId={deletingReviewId}
            onEdit={openEditModal}
            onDelete={(id) => setShowDeleteConfirm(id)}
            maxItems={Infinity}
          />
        ) : (
          <div className="text-center py-12 rounded-xl bg-white/5 border border-white/10 border-dashed">
            <Filter className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-semibold mb-1">No reviews found</p>
            <p className="text-xs text-gray-500">Try adjusting your filters or search query</p>
          </div>
        )}

        <EditReviewModal
          editingReview={editingReview}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          updating={updating}
          onSubmit={handleEditSubmit}
          onClose={closeEditModal}
        />
      </div>

      <PremiumDialog
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={confirmDeleteReview}
        title="Delete Review"
        message="Are you sure you want to delete this review? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={!!deletingReviewId}
      />
    </div>
  );
}

export default AllReviewsPage;