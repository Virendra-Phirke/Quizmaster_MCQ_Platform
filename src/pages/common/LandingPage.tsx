import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Navbar } from "../../components/shared/Navbar";
import { canonicalizeRole } from "../../lib/roleUtils";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/Toast";
import { PremiumDialog } from "../../components/shared/PremiumDialog";
import { ReviewForm } from "../../components/shared/ReviewForm";
import { EditReviewModal } from "../../components/shared/EditReviewModal";
import CountUp from "../../components/ui/CountUp";
import Squares from "../../components/ui/Squares";
import {
  Brain,
  BarChart3,
  Shield,
  Smartphone,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Star
} from "lucide-react";
import { ReviewGridModal } from "../../components/shared/ReviewGridModel";
import { ContactForm } from "../../components/shared/ContactForm";

interface Review {
  id: string;
  user_id: string;
  name: string;
  role: string;
  rating: number;
  comment: string;
  created_at: string;
}

function LandingPage() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: ""
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editFormData, setEditFormData] = useState({ rating: 5, comment: "" });
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const { addToast } = useToast();

  // Stats states (raw numeric values for CountUp animation)
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalTests: 0,
    totalQuestions: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Open edit modal
  const openEditModal = (review: Review) => {
    setEditingReview(review);
    setEditFormData({ rating: review.rating, comment: review.comment });
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditingReview(null);
    setEditFormData({ rating: 5, comment: "" });
  };

  // Handle edit review submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview || !user) return;

    setUpdating(true);
    try {
      const { data, error } = await supabase
        .from("reviews")
        .update({
          rating: editFormData.rating,
          comment: editFormData.comment
        })
        .eq("id", editingReview.id)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "No rows were updated. You may not have permission to edit this review."
        );
      }

      setReviews(
        reviews.map((r) =>
          r.id === editingReview.id
            ? {
              ...r,
              rating: editFormData.rating,
              comment: editFormData.comment
            }
            : r
        )
      );

      closeEditModal();
      addToast({
        type: "success",
        title: "Review Updated",
        message: "Your review has been updated successfully."
      });
    } catch (error: any) {
      console.error("Error updating review:", error);
      addToast({
        type: "error",
        title: "Update Failed",
        message: error.message || "Please try again."
      });
    } finally {
      setUpdating(false);
    }
  };

  // Handle delete review
  const confirmDeleteReview = async () => {
    const reviewId = showDeleteConfirm;
    if (!user || !reviewId) return;
    setShowDeleteConfirm(null);

    setDeletingReviewId(reviewId);
    try {
      const { data, error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", reviewId)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "No rows were deleted. You may not have permission to delete this review."
        );
      }

      const updatedReviews = reviews.filter((r) => r.id !== reviewId);
      setReviews(updatedReviews);
      setUserHasReviewed(false);

      addToast({
        type: "success",
        title: "Review Deleted",
        message: "You can now write a new review."
      });
    } catch (error: any) {
      console.error("Error deleting review:", error);
      addToast({
        type: "error",
        title: "Delete Failed",
        message: error.message || "Please try again."
      });
    } finally {
      setDeletingReviewId(null);
    }
  };

  // Load reviews from Supabase — re-run when user loads so sorting works
  useEffect(() => {
    loadReviews();
  }, [user?.id]);

  // Fetch real stats data
  useEffect(() => {
    fetchStats();
  }, []);

  // Check if current user has already reviewed
  useEffect(() => {
    if (user?.id && reviews.length > 0) {
      checkUserReview();
    }
  }, [user?.id, reviews]);

  const fetchStats = async (retryCount = 0) => {
    if (retryCount === 0) setStatsLoading(true);
    try {
      // Primary: Use SECURITY DEFINER RPC function that bypasses RLS
      // This works for both authenticated and unauthenticated (anon) users
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_stats');

      if (!rpcError && rpcData) {
        setStats({
          activeUsers: rpcData.active_users ?? 0,
          totalTests: rpcData.total_tests ?? 0,
          totalQuestions: rpcData.total_questions ?? 0
        });
        setFetchError(false);
        setStatsLoading(false);
        return;
      }

      // Fallback: Direct table queries (works when user is authenticated)
      console.warn("RPC get_public_stats failed, trying direct queries:", rpcError?.message);
      const [usersResult, questionsResult, testsResult] = await Promise.all([
        supabase.from("profiles").select("*", { count: "estimated", head: true }),
        supabase.from("questions").select("*", { count: "estimated", head: true }),
        supabase.from("tests").select("*", { count: "estimated", head: true }),
      ]);

      const newStats = {
        activeUsers: usersResult.count ?? 0,
        totalTests: testsResult.count ?? 0,
        totalQuestions: questionsResult.count ?? 0
      };

      // If all counts are 0, the RLS might be blocking - retry once after a delay
      if (newStats.activeUsers === 0 && newStats.totalTests === 0 && newStats.totalQuestions === 0 && retryCount < 2) {
        console.warn(`Stats returned all zeros (attempt ${retryCount + 1}), retrying...`);
        setTimeout(() => fetchStats(retryCount + 1), 2000);
        return;
      }

      setStats(newStats);
      setFetchError(false);
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Retry on network errors (common on mobile)
      if (retryCount < 2) {
        setTimeout(() => fetchStats(retryCount + 1), 2000);
      } else {
        setFetchError(true);
      }
    } finally {
      if (retryCount >= 2 || retryCount === 0) {
        setStatsLoading(false);
      }
    }
  };

  const loadReviews = async () => {
    try {
      // Primary: Use SECURITY DEFINER RPC (bypasses RLS, works on all devices)
      let reviewsData: Review[] | null = null;

      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_reviews');
        if (!rpcError && rpcData && Array.isArray(rpcData)) {
          reviewsData = rpcData as Review[];
        } else if (rpcError) {
          console.warn('⚠️ RPC get_public_reviews failed, trying direct query:', rpcError.message);
        }
      } catch (rpcErr) {
        console.warn('⚠️ RPC get_public_reviews threw, trying direct query:', rpcErr);
      }

      // Fallback: Direct table query (reviews table has TO public policy)
      if (!reviewsData) {
        const { data, error } = await supabase
          .from("reviews")
          .select("*")
          .order("created_at", { ascending: false });

        if (error && error.code !== "42P01") throw error;
        reviewsData = (data as Review[]) || [];
      }

      if (reviewsData && user?.id) {
        const userReview = reviewsData.filter((r) => r.user_id === user.id);
        const otherReviews = reviewsData.filter((r) => r.user_id !== user.id);
        setReviews([...userReview, ...otherReviews]);
      } else {
        setReviews(reviewsData || []);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
      // Retry once after 2s on error (helps mobile networks)
      setTimeout(async () => {
        try {
          const { data } = await supabase
            .from("reviews")
            .select("*")
            .order("created_at", { ascending: false });
          if (data) setReviews(data as Review[]);
        } catch (retryErr) {
          console.error("Retry loading reviews also failed:", retryErr);
        }
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const checkUserReview = () => {
    if (user?.id) {
      const hasReviewed = reviews.some((review) => review.user_id === user.id);
      setUserHasReviewed(hasReviewed);
    }
  };

  // Handle scroll animations
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-fade-in-up");
        }
      });
    }, observerOptions);

    document.querySelectorAll(".fade-in").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleWriteReviewClick = () => {
    if (!isLoaded) return;

    if (!user) {
      navigate("/auth/signin");
      return;
    }

    if (userHasReviewed) {
      const userReview = reviews.find((review) => review.user_id === user.id);
      if (userReview) {
        openEditModal(userReview);
      }
      return;
    }

    setShowReviewForm(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate("/auth/signin");
      return;
    }

    setSubmitting(true);

    try {
      const userName =
        user.fullName || user.firstName || user.username || "Anonymous User";
      const userRole =
        canonicalizeRole(user.unsafeMetadata?.role as string | undefined) ||
        "Student";

      const reviewData = {
        user_id: user.id,
        name: userName,
        role: userRole.charAt(0).toUpperCase() + userRole.slice(1),
        rating: newReview.rating,
        comment: newReview.comment
      };

      const { data, error } = await supabase
        .from("reviews")
        .insert([reviewData])
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          addToast({
            type: "warning",
            title: "Already Reviewed",
            message: "You have already submitted a review."
          });
        } else if (error.code === "42P01") {
          addToast({
            type: "error",
            title: "Database Error",
            message:
              "Reviews table does not exist. Please run the database migration first."
          });
        } else {
          addToast({
            type: "error",
            title: "Submission Error",
            message:
              error.message || "Failed to submit review. Please try again."
          });
        }
        return;
      }

      setReviews([data, ...reviews]);
      setNewReview({ rating: 5, comment: "" });
      setShowReviewForm(false);
      setSubmitSuccess(true);
      setUserHasReviewed(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error("Error submitting review:", error);
      addToast({
        type: "error",
        title: "Submission Failed",
        message: "Failed to submit review. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      <Navbar />

      {/* Premium Animated Background */}
      <div className="fixed inset-0 z-0">
        {/* Animated Squares Background */}
        <Squares
          speed={0.3}
          squareSize={40}
          direction="diagonal"
          borderColor="rgba(99, 102, 241, 0.1)"
          className="opacity-50"
        />

        {/* Gradient Orbs */}
        <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

        {/* Subtle Noise Texture */}
        <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]"></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 pt-16">
        {/* Hero Section */}
        <section
          id="home"
          className="min-h-screen flex items-center justify-center relative px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-6xl mx-auto text-center">
            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 animate-fade-in-up delay-100">
              <span className="bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                Master Your
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Knowledge
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl lg:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up delay-200">
              Challenge yourself with expertly crafted multiple-choice
              questions. Elevate your learning experience with real-time
              progress tracking and advanced analytics.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up delay-300">
              {user ? (
                <Link
                  to={
                    canonicalizeRole(
                      user.unsafeMetadata?.role as string | undefined
                    ) === "teacher"
                      ? "/teacher"
                      : "/student"
                  }
                  className="gradient-border-btn"
                >
                  Continue Learning
                </Link>
              ) : (
                <>
                  <Link to="/auth/signin" className="gradient-border-btn">
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="relative mt-20 animate-fade-in-up delay-400">
              {fetchError && (
                <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-xl mx-auto flex items-center justify-center gap-3">
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Database Connection Issue</p>
                    <p className="text-xs opacity-70">If statistics are missing, your browser (like Brave/AdBlock) may be blocking the connection. Try disabling shields for this site.</p>
                  </div>
                  <button
                    onClick={() => { fetchStats(); loadReviews(); }}
                    className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors whitespace-nowrap"
                  >
                    Retry Connection
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-3xl mx-auto">
                <div className="p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                  {statsLoading && (
                    <div className="absolute inset-0 bg-white/5 animate-pulse z-20"></div>
                  )}
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                    <CountUp
                      from={0}
                      to={stats.activeUsers >= 1000 ? parseFloat((stats.activeUsers / 1000).toFixed(1)) : stats.activeUsers}
                      decimals={stats.activeUsers >= 1000 && stats.activeUsers % 1000 !== 0 ? 1 : 0}
                      duration={2}
                      className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
                    />
                    {stats.activeUsers >= 1000 && (
                      <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">K+</span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-sm text-gray-400">Active Users</div>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                  {statsLoading && (
                    <div className="absolute inset-0 bg-white/5 animate-pulse z-20"></div>
                  )}
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                    <CountUp
                      from={0}
                      to={stats.totalTests >= 1000 ? parseFloat((stats.totalTests / 1000).toFixed(1)) : stats.totalTests}
                      decimals={stats.totalTests >= 1000 && stats.totalTests % 1000 !== 0 ? 1 : 0}
                      duration={2.2}
                      className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
                    />
                    {stats.totalTests >= 1000 && (
                      <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">K+</span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-sm text-gray-400">Available Tests</div>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                  {statsLoading && (
                    <div className="absolute inset-0 bg-white/5 animate-pulse z-20"></div>
                  )}
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                    <CountUp
                      from={0}
                      to={stats.totalQuestions >= 1000 ? parseFloat((stats.totalQuestions / 1000).toFixed(1)) : stats.totalQuestions}
                      decimals={stats.totalQuestions >= 1000 && stats.totalQuestions % 1000 !== 0 ? 1 : 0}
                      duration={2.5}
                      className="bg-gradient-to-r from-pink-400 to-indigo-400 bg-clip-text text-transparent"
                    />
                    {stats.totalQuestions >= 1000 && (
                      <span className="bg-gradient-to-r from-pink-400 to-indigo-400 bg-clip-text text-transparent">K+</span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-sm text-gray-400">Questions</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-20 fade-in">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Why Choose
                </span>{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  QuizMaster
                </span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Experience the future of learning with our cutting-edge platform
                designed for excellence
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Feature 1 */}
              <div className="group fade-in">
                <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-indigo-500/50 transition-[color,background-color,border-color,transform] duration-500 hover:-translate-y-2 overflow-hidden">
                  {/* Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Icon Container */}
                  <div className="relative mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30">
                    <Brain className="w-8 h-8 text-indigo-400" />
                  </div>

                  <h3 className="relative text-xl font-bold text-white mb-4">
                    Exam-Oriented Training
                  </h3>
                  <p className="relative text-gray-400 leading-relaxed">
                    Practice designed to mirror real exam patterns and
                    difficulty for better preparedness.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group fade-in">
                <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-purple-500/50 transition-[color,background-color,border-color,transform] duration-500 hover:-translate-y-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  <div className="relative mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                    <BarChart3 className="w-8 h-8 text-purple-400" />
                  </div>

                  <h3 className="relative text-xl font-bold text-white mb-4">
                    Progress Tracking
                  </h3>
                  <p className="relative text-gray-400 leading-relaxed">
                    Comprehensive analytics and detailed reports to monitor your
                    improvement across all subjects.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group fade-in">
                <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-pink-500/50 transition-[color,background-color,border-color,transform] duration-500 hover:-translate-y-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-pink-500/5 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  <div className="relative mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-indigo-500/20 flex items-center justify-center border border-pink-500/30">
                    <Shield className="w-8 h-8 text-pink-400" />
                  </div>

                  <h3 className="relative text-xl font-bold text-white mb-4">
                    Anti-Cheating Security
                  </h3>
                  <p className="relative text-gray-400 leading-relaxed">
                    Advanced monitoring with tab-switch detection and fullscreen
                    enforcement for exam integrity.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="group fade-in">
                <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-blue-500/50 transition-[color,background-color,border-color,transform] duration-500 hover:-translate-y-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  <div className="relative mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center border border-blue-500/30">
                    <Smartphone className="w-8 h-8 text-blue-400" />
                  </div>

                  <h3 className="relative text-xl font-bold text-white mb-4">
                    Device Friendly
                  </h3>
                  <p className="relative text-gray-400 leading-relaxed">
                    Study anywhere, anytime with responsive design that works
                    seamlessly across all devices.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="about" className="py-32 px-4 sm:px-6 lg:px-8 relative">
          {/* Decorative Elements */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent pointer-events-none"></div>

          <div className="max-w-7xl mx-auto relative z-10">
            {/* Section Header */}
            <div className="text-center mb-20 fade-in">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  What Our Users
                </span>{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Say
                </span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Join thousands of successful learners who trust QuizMaster
              </p>
            </div>

            {/* Success Message */}
            {submitSuccess && (
              <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 text-center animate-fade-in-up">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="text-green-400 font-semibold">
                    Thank you for your review! It has been added successfully.
                  </span>
                </div>
              </div>
            )}

            {/* Add Review Button */}
            <div className="text-center mb-16">
              <button
                onClick={handleWriteReviewClick}
                className="group/button relative inline-flex items-center justify-center overflow-hidden rounded-md px-6 py-2.5 text-base font-semibold text-white transition-[box-shadow,transform] duration-300 ease-in-out border bg-gray-800/30 hover:scale-110 hover:shadow-xl hover:shadow-pink-600/50 border-white/20"
              >
                <span className="flex items-center gap-2 text-base">
                  <Star size={20} />
                  {userHasReviewed ? "Edit Review" : "Write a Review"}
                </span>
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-10 bg-white/20"></div>
                </div>
              </button>
            </div>

            {/* Review Form Modal */}
            {showReviewForm && user && (
              <div className="fixed inset-0 z-40 overflow-y-auto animate-fade-in" onClick={() => setShowReviewForm(false)}>
                <div className="flex items-center justify-center min-h-screen px-4 py-8">
                  <div className="fixed inset-0 bg-black/80" />
                  <div className="relative z-50 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
                    <ReviewForm
                      user={user}
                      newReview={newReview}
                      setNewReview={setNewReview}
                      submitting={submitting}
                      onSubmit={handleReviewSubmit}
                      onCancel={() => setShowReviewForm(false)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Grid */}
            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-indigo-500/20 border-t-indigo-500"></div>
                <p className="text-gray-400 mt-6 text-lg">Loading reviews...</p>
              </div>
            ) : (
              <ReviewGridModal
                reviews={reviews}
                currentUserId={user?.id}
                deletingReviewId={deletingReviewId}
                onEdit={openEditModal}
                onDelete={(id) => setShowDeleteConfirm(id)}
              />
            )}

            {/* View All Button */}
            <div className="text-center mt-12">
              <Link
                to="/reviews"
                className="group/button relative inline-flex items-center justify-center overflow-hidden rounded-md bg-gray-800/30 px-8 py-3 text-base font-semibold text-white transition-[box-shadow,transform] duration-300 ease-in-out hover:scale-110 hover:shadow-xl hover:shadow-purple-600/50 border border-white/20"
              >
                <span className="text-base">
                  View All Reviews ({reviews.length})
                </span>
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-10 bg-white/20"></div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer
          id="contact"
          className="relative mt-32 border-t border-white/10"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {/* Brand */}
              <div className="lg:col-span-1">
                <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  QuizMaster
                </h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Empowering learners worldwide with cutting-edge educational
                  technology.
                </p>
                <div className="flex gap-3">
                  <a
                    href="#"
                    title="Facebook"
                    aria-label="Visit QuizMaster on Facebook"
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 hover:scale-110 transition-transform"
                  >
                    <Facebook size={18} />
                  </a>
                  <a
                    href="#"
                    title="Twitter"
                    aria-label="Visit QuizMaster on Twitter"
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 hover:scale-110 transition-transform"
                  >
                    <Twitter size={18} />
                  </a>
                  <a
                    href="#"
                    title="Instagram"
                    aria-label="Visit QuizMaster on Instagram"
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-indigo-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 hover:scale-110 transition-transform"
                  >
                    <Instagram size={18} />
                  </a>
                  <a
                    href="#"
                    title="LinkedIn"
                    aria-label="Visit QuizMaster on LinkedIn"
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 hover:scale-110 transition-transform"
                  >
                    <Linkedin size={18} />
                  </a>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="text-white font-bold text-lg mb-6">
                  Quick Links
                </h4>
                <div className="space-y-3">
                  <a
                    href="#privacy"
                    className="block text-gray-400 hover:text-indigo-400 transition-colors"
                  >
                    Privacy Policy
                  </a>
                  <a
                    href="#terms"
                    className="block text-gray-400 hover:text-indigo-400 transition-colors"
                  >
                    Terms of Service
                  </a>
                  <a
                    href="#help"
                    className="block text-gray-400 hover:text-indigo-400 transition-colors"
                  >
                    Help Center
                  </a>
                  <a
                    href="#careers"
                    className="block text-gray-400 hover:text-indigo-400 transition-colors"
                  >
                    Careers
                  </a>
                </div>
              </div>

              {/* Categories */}
              <div>
                <h4 className="text-white font-bold text-lg mb-6">
                  Categories
                </h4>
                <div className="space-y-3">
                  <a
                    href="#science"
                    className="block text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    Science
                  </a>
                  <a
                    href="#math"
                    className="block text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    Mathematics
                  </a>
                  <a
                    href="#history"
                    className="block text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    History
                  </a>
                  <a
                    href="#literature"
                    className="block text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    Literature
                  </a>
                </div>
              </div>

              {/* Contact Us */}
              <div>
                <h4 className="text-white font-bold text-lg mb-4">
                  Contact Us
                </h4>
                <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                  Have a question or feedback? Drop us a message and we'll get back to you.
                </p>
                <ContactForm />
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/10 mt-16 pt-8 text-center">
              <p className="text-gray-500 text-sm">
                &copy; 2025 QuizMaster. All rights reserved. Crafted with
                precision and care.
              </p>
            </div>
          </div>
        </footer>
      </div>


      {/* Edit Review Modal */}
      <EditReviewModal
        editingReview={editingReview}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        updating={updating}
        onSubmit={handleEditSubmit}
        onClose={closeEditModal}
      />

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }

        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, rgba(99, 102, 241, 0.5), rgba(168, 85, 247, 0.5));
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, rgba(99, 102, 241, 0.7), rgba(168, 85, 247, 0.7));
        }
      `}</style>

      {/* Delete Confirmation Dialog */}
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

      {/* Toast Notifications */}
    </div>
  );
}

export default LandingPage;
