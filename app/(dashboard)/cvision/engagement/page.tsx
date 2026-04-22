'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Lightbulb, ThumbsUp, MessageSquare, BarChart3, Plus, Search,
  TrendingUp, Send, RefreshCcw, Filter, Vote, Trophy,
  CheckCircle, Clock, XCircle, Eye, ChevronUp, Lock,
  Hash, Users, Flame, Award, ArrowUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

// ── Constants ────────────────────────────────────────────────────────────

const API = '/api/cvision/engagement';

const SUGGESTION_CATEGORIES = [
  'PROCESS', 'CULTURE', 'TECHNOLOGY', 'FACILITY', 'BENEFIT', 'OTHER',
] as const;

const SUGGESTION_STATUSES = [
  'NEW', 'UNDER_REVIEW', 'ACCEPTED', 'IMPLEMENTED', 'DECLINED',
] as const;

const POLL_STATUSES = ['ACTIVE', 'CLOSED'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  PROCESS: 'Process',
  CULTURE: 'Culture',
  TECHNOLOGY: 'Technology',
  FACILITY: 'Facility',
  BENEFIT: 'Benefit',
  OTHER: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  PROCESS: 'bg-blue-100 text-blue-700 border-blue-200',
  CULTURE: 'bg-purple-100 text-purple-700 border-purple-200',
  TECHNOLOGY: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  FACILITY: 'bg-orange-100 text-orange-700 border-orange-200',
  BENEFIT: 'bg-green-100 text-green-700 border-green-200',
  OTHER: 'bg-gray-100 text-gray-700 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  UNDER_REVIEW: 'Under Review',
  ACCEPTED: 'Accepted',
  IMPLEMENTED: 'Implemented',
  DECLINED: 'Declined',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  ACCEPTED: 'bg-green-100 text-green-700 border-green-200',
  IMPLEMENTED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-red-100 text-red-700 border-red-200',
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_ICONS: Record<string, any> = {
  NEW: Lightbulb,
  UNDER_REVIEW: Clock,
  ACCEPTED: CheckCircle,
  IMPLEMENTED: Trophy,
  DECLINED: XCircle,
};

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(d: any) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function timeAgo(d: any) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(d);
}

// =========================================================================
// SUGGESTIONS TAB
// =========================================================================

function SuggestionsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitCategory, setSubmitCategory] = useState('');
  const [submitAnonymous, setSubmitAnonymous] = useState(false);
  const [submitName, setSubmitName] = useState('');

  // Detail / comment dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [commentText, setCommentText] = useState('');

  // Respond dialog (admin)
  const [respondOpen, setRespondOpen] = useState(false);
  const [respondSuggestion, setRespondSuggestion] = useState<any>(null);
  const [respondText, setRespondText] = useState('');
  const [respondStatus, setRespondStatus] = useState('');
  const [respondBy, setRespondBy] = useState('');

  const filters = { status: statusFilter || undefined, category: categoryFilter || undefined };
  const { data: suggestionsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.engagement.suggestions(filters),
    queryFn: () => cvisionFetch(`${API}?action=suggestions${statusFilter ? `&status=${statusFilter}` : ''}${categoryFilter ? `&category=${categoryFilter}` : ''}`),
  });
  const suggestions: any[] = suggestionsRaw?.data?.items || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.engagement.all });

  const submitMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (data: any) => {
      if (data.success || data.data) {
        toast.success('Suggestion submitted successfully');
        setSubmitOpen(false);
        resetSubmitForm();
        invalidate();
      } else {
        toast.error(data.error || 'Failed to submit suggestion');
      }
    },
    onError: () => toast.error('Error submitting suggestion'),
  });

  const handleSubmitSuggestion = () => {
    if (!submitTitle.trim() || !submitDescription.trim() || !submitCategory) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!submitAnonymous && !submitName.trim()) {
      toast.error('Please enter your name or submit anonymously');
      return;
    }
    submitMutation.mutate({
      action: 'submit-suggestion',
      title: submitTitle.trim(),
      description: submitDescription.trim(),
      category: submitCategory,
      submittedBy: submitAnonymous ? 'Anonymous' : submitName.trim(),
      anonymous: submitAnonymous,
    });
  };
  const submitting = submitMutation.isPending;

  const resetSubmitForm = () => {
    setSubmitTitle('');
    setSubmitDescription('');
    setSubmitCategory('');
    setSubmitAnonymous(false);
    setSubmitName('');
  };

  const voteMutation = useMutation({
    mutationFn: (suggestionId: string) => cvisionMutate(API, 'POST', { action: 'vote-suggestion', suggestionId, employeeId: 'current-user' }),
    onSuccess: (data: any) => {
      if (data.success || data.data) invalidate();
      else toast.error(data.error || 'Failed to vote');
    },
    onError: () => toast.error('Error voting'),
  });

  const handleVote = (suggestionId: string) => voteMutation.mutate(suggestionId);

  const commentMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (data: any) => {
      if (data.success || data.data) {
        toast.success('Comment added');
        setCommentText('');
        invalidate();
      } else {
        toast.error(data.error || 'Failed to add comment');
      }
    },
    onError: () => toast.error('Error adding comment'),
  });

  const handleComment = () => {
    if (!commentText.trim() || !selectedSuggestion) return;
    commentMutation.mutate({
      action: 'comment-suggestion',
      suggestionId: selectedSuggestion._id || selectedSuggestion.id,
      employeeId: 'current-user',
      text: commentText.trim(),
    });
  };
  const commentSubmitting = commentMutation.isPending;

  const respondMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (data: any) => {
      if (data.success || data.data) {
        toast.success('Response submitted');
        setRespondOpen(false);
        setRespondText('');
        setRespondStatus('');
        setRespondBy('');
        invalidate();
      } else {
        toast.error(data.error || 'Failed to respond');
      }
    },
    onError: () => toast.error('Error responding'),
  });

  const handleRespond = () => {
    if (!respondText.trim() || !respondStatus || !respondSuggestion) {
      toast.error('Please fill in all fields');
      return;
    }
    respondMutation.mutate({
      action: 'respond-suggestion',
      suggestionId: respondSuggestion._id || respondSuggestion.id,
      response: respondText.trim(),
      status: respondStatus,
      respondedBy: respondBy.trim() || 'HR Admin',
    });
  };
  const respondSubmitting = respondMutation.isPending;

  const openDetail = (suggestion: any) => {
    setSelectedSuggestion(suggestion);
    setDetailOpen(true);
    setCommentText('');
  };

  const openRespond = (suggestion: any) => {
    setRespondSuggestion(suggestion);
    setRespondStatus(suggestion.status || 'UNDER_REVIEW');
    setRespondOpen(true);
  };

  const filtered = suggestions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.submittedBy?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              placeholder="Search suggestions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 36, width: 256 }}
            />
          </div>
          <CVisionSelect
                C={C}
                value={statusFilter || 'ALL'}
                placeholder="All Statuses"
                options={[
                  { value: 'ALL', label: tr('كل الحالات', 'All Statuses') },
                  ...SUGGESTION_STATUSES.map((s) => (
                ({ value: s, label: STATUS_LABELS[s] })
              )),
                ]}
                style={{ width: 176 }}
              />
          <CVisionSelect
                C={C}
                value={categoryFilter || 'ALL'}
                placeholder="All Categories"
                options={[
                  { value: 'ALL', label: tr('كل الفئات', 'All Categories') },
                  ...SUGGESTION_CATEGORIES.map((c) => (
                ({ value: c, label: CATEGORY_LABELS[c] })
              )),
                ]}
                style={{ width: 176 }}
              />
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => invalidate()}>
            <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
          </CVisionButton>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => setSubmitOpen(true)}>
          <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Submit Suggestion
        </CVisionButton>
      </div>

      {/* Suggestion Cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 128, width: '100%' }}  />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
            <Lightbulb style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 12 }} />
            <p style={{ color: C.textMuted }}>No suggestions found.</p>
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              Be the first to submit a suggestion!
            </p>
          </CVisionCardBody>
        </CVisionCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((suggestion) => {
            const StatusIcon = STATUS_ICONS[suggestion.status] || Lightbulb;
            const voteCount = suggestion.voteCount ?? suggestion.votes?.length ?? 0;
            const commentCount = suggestion.commentCount ?? suggestion.comments?.length ?? 0;
            return (
              <CVisionCard C={C} key={suggestion._id || suggestion.id} className="hover:shadow-md transition-shadow">
                <CVisionCardBody style={{ padding: 16 }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {/* Vote Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <CVisionButton C={C} isDark={isDark}
                        variant="outline"
                        size="sm"
                        style={{ height: 40, width: 40, padding: 0, borderRadius: '50%', transition: 'color 0.2s, background 0.2s' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(suggestion._id || suggestion.id);
                        }}
                      >
                        <ArrowUp style={{ height: 20, width: 20 }} />
                      </CVisionButton>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>{voteCount}</span>
                      <span style={{ color: C.textMuted, textTransform: 'uppercase' }}>votes</span>
                    </div>

                    {/* Content Column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <h3
                              style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}
                              onClick={() => openDetail(suggestion)}
                            >
                              {suggestion.title}
                            </h3>
                            <CVisionBadge C={C}
                              variant="outline"
                              className={`text-xs ${CATEGORY_COLORS[suggestion.category] || CATEGORY_COLORS.OTHER}`}
                            >
                              {CATEGORY_LABELS[suggestion.category] || suggestion.category}
                            </CVisionBadge>
                            <CVisionBadge C={C}
                              variant="outline"
                              className={`text-xs ${STATUS_COLORS[suggestion.status] || STATUS_COLORS.NEW}`}
                            >
                              <StatusIcon style={{ height: 12, width: 12, marginRight: 4 }} />
                              {STATUS_LABELS[suggestion.status] || suggestion.status}
                            </CVisionBadge>
                          </div>
                          <p style={{ fontSize: 13, color: C.textMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {suggestion.description}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, color: C.textMuted }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {suggestion.anonymous ? (
                            <><Lock style={{ height: 12, width: 12 }} /> Anonymous</>
                          ) : (
                            <><Users style={{ height: 12, width: 12 }} /> {suggestion.submittedBy}</>
                          )}
                        </span>
                        <span>{timeAgo(suggestion.createdAt)}</span>
                        <button
                          style={{ display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.2s, background 0.2s' }}
                          onClick={() => openDetail(suggestion)}
                        >
                          <MessageSquare style={{ height: 12, width: 12 }} /> {commentCount} comments
                        </button>
                        <button
                          style={{ display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.2s, background 0.2s' }}
                          onClick={() => openRespond(suggestion)}
                        >
                          <Send style={{ height: 12, width: 12 }} /> Respond
                        </button>
                      </div>

                      {suggestion.response && (
                        <div style={{ marginTop: 8, padding: 8, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }}>
                          <span style={{ fontWeight: 500 }}>Response:</span>{' '}
                          {suggestion.response}
                          {suggestion.respondedBy && (
                            <span style={{ color: C.textMuted }}> - {suggestion.respondedBy}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* Submit Suggestion Dialog */}
      <CVisionDialog C={C} open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit Response" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Share your ideas to improve our workplace. All suggestions are reviewed by management.
            </p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Title *</CVisionLabel>
              <CVisionInput C={C}
                value={submitTitle}
                onChange={(e) => setSubmitTitle(e.target.value)}
                placeholder="Brief title for your suggestion"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Description *</CVisionLabel>
              <CVisionTextarea C={C}
                value={submitDescription}
                onChange={(e) => setSubmitDescription(e.target.value)}
                placeholder="Describe your suggestion in detail..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Category *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={submitCategory || undefined}
                onChange={setSubmitCategory}
                placeholder="Select a category"
                options={SUGGESTION_CATEGORIES.map((c) => (
                    ({ value: c, label: CATEGORY_LABELS[c] })
                  ))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <Checkbox
                id="anonymous-checkbox"
                checked={submitAnonymous}
                onCheckedChange={(checked) => setSubmitAnonymous(checked === true)}
              />
              <div>
                <CVisionLabel C={C} htmlFor="anonymous-checkbox" style={{ cursor: 'pointer' }}>
                  Submit anonymously
                </CVisionLabel>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Your name will not be shown to anyone
                </p>
              </div>
            </div>
            {!submitAnonymous && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>Your Name *</CVisionLabel>
                <CVisionInput C={C}
                  value={submitName}
                  onChange={(e) => setSubmitName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
            )}
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSubmitSuggestion} disabled={submitting}>
              {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} />}
              Submit Suggestion
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Detail / Comment Dialog */}
      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)} title="Details" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              View suggestion details and leave comments
            </p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            {selectedSuggestion && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CVisionBadge C={C}
                    variant="outline"
                    className={`text-xs ${CATEGORY_COLORS[selectedSuggestion.category] || ''}`}
                  >
                    {CATEGORY_LABELS[selectedSuggestion.category] || selectedSuggestion.category}
                  </CVisionBadge>
                  <CVisionBadge C={C}
                    variant="outline"
                    className={`text-xs ${STATUS_COLORS[selectedSuggestion.status] || ''}`}
                  >
                    {STATUS_LABELS[selectedSuggestion.status] || selectedSuggestion.status}
                  </CVisionBadge>
                  <span style={{ fontSize: 12, color: C.textMuted }}>
                    {selectedSuggestion.anonymous
                      ? 'Anonymous'
                      : selectedSuggestion.submittedBy}{' '}
                    - {fmtDate(selectedSuggestion.createdAt)}
                  </span>
                </div>

                <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 13 }}>{selectedSuggestion.description}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <ThumbsUp style={{ height: 16, width: 16, color: C.blue }} />
                    <span style={{ fontWeight: 600 }}>
                      {selectedSuggestion.voteCount ?? selectedSuggestion.votes?.length ?? 0}
                    </span>
                    <span style={{ color: C.textMuted }}>votes</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <MessageSquare style={{ height: 16, width: 16 }} />
                    <span style={{ fontWeight: 600 }}>
                      {selectedSuggestion.commentCount ?? selectedSuggestion.comments?.length ?? 0}
                    </span>
                    <span style={{ color: C.textMuted }}>comments</span>
                  </div>
                </div>

                {selectedSuggestion.response && (
                  <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.greenDim }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 4 }}>Official Response</p>
                    <p style={{ fontSize: 13 }}>{selectedSuggestion.response}</p>
                    {selectedSuggestion.respondedBy && (
                      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                        - {selectedSuggestion.respondedBy},{' '}
                        {fmtDate(selectedSuggestion.respondedAt)}
                      </p>
                    )}
                  </div>
                )}

                {/* Comments */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare style={{ height: 16, width: 16 }} /> Comments
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                    {(selectedSuggestion.comments || []).length === 0 && (
                      <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>
                        No comments yet. Be the first to comment!
                      </p>
                    )}
                    {(selectedSuggestion.comments || []).map((c: any, i: number) => (
                      <div key={i} style={{ padding: 8, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, fontSize: 12 }}>
                            {c.employeeName || c.employeeId || 'Employee'}
                          </span>
                          <span style={{ fontSize: 12, color: C.textMuted }}>
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p style={{ fontSize: 13 }}>{c.text}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <CVisionInput C={C}
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleComment();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <CVisionButton C={C} isDark={isDark}
                      size="sm"
                      onClick={handleComment}
                      disabled={commentSubmitting || !commentText.trim()}
                    >
                      {commentSubmitting ? (
                        <RefreshCcw style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Send style={{ height: 16, width: 16 }} />
                      )}
                    </CVisionButton>
                  </div>
                </div>
              </>
            )}
          </div>
      </CVisionDialog>

      {/* Respond Dialog */}
      <CVisionDialog C={C} open={respondOpen} onClose={() => setRespondOpen(false)} title="Respond" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Provide an official response and update the suggestion status
            </p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            {respondSuggestion && (
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <p style={{ fontWeight: 500, fontSize: 13 }}>{respondSuggestion.title}</p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {respondSuggestion.description}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Status *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={respondStatus || undefined}
                onChange={setRespondStatus}
                placeholder="Select new status"
                options={SUGGESTION_STATUSES.map((s) => (
                    ({ value: s, label: STATUS_LABELS[s] })
                  ))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Response *</CVisionLabel>
              <CVisionTextarea C={C}
                value={respondText}
                onChange={(e) => setRespondText(e.target.value)}
                placeholder="Write your official response..."
                rows={3}
                className="resize-none"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Responded By</CVisionLabel>
              <CVisionInput C={C}
                value={respondBy}
                onChange={(e) => setRespondBy(e.target.value)}
                placeholder="Your name (defaults to HR Admin)"
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setRespondOpen(false)}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleRespond} disabled={respondSubmitting}>
              {respondSubmitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} />}
              Submit Response
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// =========================================================================
// TRENDING TAB
// =========================================================================

function TrendingTab() {
  const { C, isDark } = useCVisionTheme();
  const queryClient = useQueryClient();

  const { data: trendingRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.engagement.trending(),
    queryFn: () => cvisionFetch(`${API}?action=trending`),
  });
  const trending: any[] = trendingRaw?.data?.items || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.engagement.all });

  const voteMutation = useMutation({
    mutationFn: (suggestionId: string) => cvisionMutate(API, 'POST', { action: 'vote-suggestion', suggestionId, employeeId: 'current-user' }),
    onSuccess: (data: any) => {
      if (data.success || data.data) invalidate();
    },
    onError: () => toast.error('Error voting'),
  });

  const handleVote = (suggestionId: string) => voteMutation.mutate(suggestionId);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96, width: '100%' }}  />
        ))}
      </div>
    );
  }

  if (trending.length === 0) {
    return (
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
          <Flame style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 12 }} />
          <p style={{ color: C.textMuted }}>No trending suggestions yet.</p>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            Suggestions with votes will appear here ranked by popularity.
          </p>
        </CVisionCardBody>
      </CVisionCard>
    );
  }

  const maxVotes = Math.max(...trending.map((s) => s.voteCount ?? s.votes?.length ?? 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Flame style={{ height: 20, width: 20, color: C.orange }} />
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Top Voted Suggestions</h2>
        <CVisionBadge C={C} variant="outline" className="ml-auto">{trending.length} suggestions</CVisionBadge>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => invalidate()}>
          <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
        </CVisionButton>
      </div>

      {trending.map((suggestion, index) => {
        const voteCount = suggestion.voteCount ?? suggestion.votes?.length ?? 0;
        const barWidth = maxVotes > 0 ? Math.round((voteCount / maxVotes) * 100) : 0;
        const rankBg =
          index === 0
            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
            : index === 1
              ? 'bg-gray-100 text-gray-700 border-gray-300'
              : index === 2
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-muted text-muted-foreground';

        return (
          <CVisionCard C={C} key={suggestion._id || suggestion.id} className="hover:shadow-md transition-shadow">
            <CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Rank */}
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-full border-2 font-bold text-lg flex-shrink-0 ${rankBg}`}
                >
                  {index + 1}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h3 style={{ fontWeight: 600, fontSize: 13 }}>{suggestion.title}</h3>
                    <CVisionBadge C={C}
                      variant="outline"
                      className={`text-xs ${CATEGORY_COLORS[suggestion.category] || CATEGORY_COLORS.OTHER}`}
                    >
                      {CATEGORY_LABELS[suggestion.category] || suggestion.category}
                    </CVisionBadge>
                    <CVisionBadge C={C}
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[suggestion.status] || STATUS_COLORS.NEW}`}
                    >
                      {STATUS_LABELS[suggestion.status] || suggestion.status}
                    </CVisionBadge>
                  </div>
                  <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                    {suggestion.description}
                  </p>

                  {/* Vote bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 12, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          index === 0
                            ? 'bg-yellow-500'
                            : index === 1
                              ? 'bg-blue-500'
                              : index === 2
                                ? 'bg-purple-500'
                                : 'bg-primary/60'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.gold, textAlign: 'right' }}>
                      {voteCount} votes
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 12, color: C.textMuted }}>
                    <span>
                      {suggestion.anonymous ? 'Anonymous' : suggestion.submittedBy}
                    </span>
                    <span>{timeAgo(suggestion.createdAt)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MessageSquare style={{ height: 12, width: 12 }} />
                      {suggestion.commentCount ?? suggestion.comments?.length ?? 0}
                    </span>
                  </div>
                </div>

                {/* Vote button */}
                <CVisionButton C={C} isDark={isDark}
                  variant="outline"
                  size="sm"
                  style={{ flexShrink: 0, height: 48, width: 48, padding: 0, borderRadius: '50%', transition: 'color 0.2s, background 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => handleVote(suggestion._id || suggestion.id)}
                >
                  <ChevronUp style={{ height: 20, width: 20 }} />
                  <span style={{ fontWeight: 700 }}>{voteCount}</span>
                </CVisionButton>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        );
      })}
    </div>
  );
}

// =========================================================================
// POLLS TAB
// =========================================================================

function PollsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  // Create poll dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollAnonymous, setPollAnonymous] = useState(true);
  const [pollExpiresAt, setPollExpiresAt] = useState('');
  const [pollCreatedBy, setPollCreatedBy] = useState('');

  const pollFilters = { status: statusFilter || undefined };
  const { data: pollsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.engagement.polls(pollFilters),
    queryFn: () => cvisionFetch(`${API}?action=polls${statusFilter ? `&status=${statusFilter}` : ''}`),
  });
  const polls: any[] = pollsRaw?.data?.items || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.engagement.all });

  const createPollMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (data: any) => {
      if (data.success || data.data) {
        toast.success('Poll created successfully');
        setCreateOpen(false);
        resetPollForm();
        invalidate();
      } else {
        toast.error(data.error || 'Failed to create poll');
      }
    },
    onError: () => toast.error('Error creating poll'),
  });

  const handleCreatePoll = () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim()) {
      toast.error('Please enter a question');
      return;
    }
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options');
      return;
    }
    createPollMutation.mutate({
      action: 'create-poll',
      question: pollQuestion.trim(),
      options: validOptions,
      anonymous: pollAnonymous,
      expiresAt: pollExpiresAt || undefined,
      createdBy: pollCreatedBy.trim() || 'HR Admin',
    });
  };
  const creating = createPollMutation.isPending;

  const resetPollForm = () => {
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollAnonymous(true);
    setPollExpiresAt('');
    setPollCreatedBy('');
  };

  const addPollOption = () => {
    if (pollOptions.length >= 10) {
      toast.error('Maximum 10 options allowed');
      return;
    }
    setPollOptions([...pollOptions, '']);
  };

  const removePollOption = (idx: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== idx));
  };

  const updatePollOption = (idx: number, value: string) => {
    const updated = [...pollOptions];
    updated[idx] = value;
    setPollOptions(updated);
  };

  const votePollMutation = useMutation({
    mutationFn: (payload: { pollId: string; optionId: string }) => cvisionMutate(API, 'POST', { action: 'vote-poll', ...payload, employeeId: 'current-user' }),
    onSuccess: (data: any) => {
      if (data.success || data.data) { toast.success('Vote recorded'); invalidate(); }
      else toast.error(data.error || 'Failed to vote');
    },
    onError: () => toast.error('Error voting'),
  });

  const handleVotePoll = (pollId: string, optionId: string) => votePollMutation.mutate({ pollId, optionId });

  const closePollMutation = useMutation({
    mutationFn: (pollId: string) => cvisionMutate(API, 'POST', { action: 'close-poll', pollId }),
    onSuccess: (data: any) => {
      if (data.success || data.data) { toast.success('Poll closed'); invalidate(); }
      else toast.error(data.error || 'Failed to close poll');
    },
    onError: () => toast.error('Error closing poll'),
  });

  const handleClosePoll = (pollId: string) => closePollMutation.mutate(pollId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionSelect
                C={C}
                value={statusFilter || 'ALL'}
                placeholder="All Statuses"
                options={[
                  { value: 'ALL', label: tr('كل الحالات', 'All Statuses') },
                  ...POLL_STATUSES.map((s) => (
                ({ value: s, label: STATUS_LABELS[s] })
              )),
                ]}
                style={{ width: 160 }}
              />
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => invalidate()}>
            <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
          </CVisionButton>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => setCreateOpen(true)}>
          <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Create Poll
        </CVisionButton>
      </div>

      {/* Poll Cards */}
      {loading ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 192, width: '100%' }}  />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
            <Vote style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 12 }} />
            <p style={{ color: C.textMuted }}>No polls found.</p>
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              Create a poll to gather quick feedback from employees.
            </p>
          </CVisionCardBody>
        </CVisionCard>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {polls.map((poll) => {
            const totalVotes = (poll.options || []).reduce(
              (acc: number, opt: any) => acc + (opt.voteCount ?? opt.votes?.length ?? 0),
              0
            );
            const isActive = poll.status === 'ACTIVE';
            const isExpired =
              poll.expiresAt && new Date(poll.expiresAt) < new Date();

            return (
              <CVisionCard C={C}
                key={poll._id || poll.id}
                className={`hover:shadow-md transition-shadow ${
                  !isActive ? 'opacity-80' : ''
                }`}
              >
                <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {poll.question}
                    </div>
                    <CVisionBadge C={C}
                      variant="outline"
                      className={`text-xs flex-shrink-0 ${STATUS_COLORS[poll.status] || ''}`}
                    >
                      {STATUS_LABELS[poll.status] || poll.status}
                    </CVisionBadge>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    Created by {poll.createdBy || 'HR'} - {fmtDate(poll.createdAt)}
                    {poll.expiresAt && (
                      <span style={{ marginLeft: 8 }}>
                        {isExpired ? 'Expired' : `Expires ${fmtDate(poll.expiresAt)}`}
                      </span>
                    )}
                    {poll.anonymous && (
                      <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center' }}>
                        <Lock style={{ height: 12, width: 12 }} /> Anonymous
                      </span>
                    )}
                  </div>
                </CVisionCardHeader>
                <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Options with vote bars */}
                  {(poll.options || []).map((option: any, idx: number) => {
                    const optVotes = option.voteCount ?? option.votes?.length ?? 0;
                    const pct =
                      totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                    const optionId = option.optionId || option._id || option.id || `opt-${idx}`;

                    return (
                      <div key={optionId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ fontWeight: 500 }}>
                            {option.text || option.label || `Option ${idx + 1}`}
                          </span>
                          <span style={{ fontSize: 12, color: C.textMuted }}>
                            {optVotes} ({pct}%)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 10, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                idx === 0
                                  ? 'bg-blue-500'
                                  : idx === 1
                                    ? 'bg-purple-500'
                                    : idx === 2
                                      ? 'bg-green-500'
                                      : idx === 3
                                        ? 'bg-orange-500'
                                        : 'bg-cyan-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {isActive && !isExpired && (
                            <CVisionButton C={C} isDark={isDark}
                              variant="outline"
                              size="sm"
                              style={{ height: 28, fontSize: 12, paddingLeft: 8, paddingRight: 8 }}
                              onClick={() =>
                                handleVotePoll(poll._id || poll.id, optionId)
                              }
                            >
                              Vote
                            </CVisionButton>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      {totalVotes} total votes
                    </span>
                    {isActive && (
                      <CVisionButton C={C} isDark={isDark}
                        variant="ghost"
                        size="sm"
                        style={{ height: 28, fontSize: 12 }}
                        onClick={() => handleClosePoll(poll._id || poll.id)}
                      >
                        Close Poll
                      </CVisionButton>
                    )}
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* Create Poll Dialog */}
      <CVisionDialog C={C} open={createOpen} onClose={() => setCreateOpen(false)} title="Create Program" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Create a quick poll to gather employee opinions on any topic.
            </p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Question *</CVisionLabel>
              <CVisionTextarea C={C}
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="What would you like to ask?"
                rows={2}
                className="resize-none"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <CVisionLabel C={C}>Options *</CVisionLabel>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={addPollOption}>
                  <Plus style={{ height: 12, width: 12, marginRight: 4 }} /> Add Option
                </CVisionButton>
              </div>
              {pollOptions.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, width: 24, borderRadius: '50%', background: C.bgSubtle, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <CVisionInput C={C}
                    value={opt}
                    onChange={(e) => updatePollOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    style={{ flex: 1 }}
                  />
                  {pollOptions.length > 2 && (
                    <CVisionButton C={C} isDark={isDark}
                      variant="ghost"
                      size="sm"
                      style={{ height: 32, width: 32, padding: 0, color: C.red }}
                      onClick={() => removePollOption(idx)}
                    >
                      <XCircle style={{ height: 16, width: 16 }} />
                    </CVisionButton>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>Expires At</CVisionLabel>
                <CVisionInput C={C}
                  type="datetime-local"
                  value={pollExpiresAt}
                  onChange={(e) => setPollExpiresAt(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>Created By</CVisionLabel>
                <CVisionInput C={C}
                  value={pollCreatedBy}
                  onChange={(e) => setPollCreatedBy(e.target.value)}
                  placeholder="Your name (defaults to HR Admin)"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <Checkbox
                id="poll-anonymous-checkbox"
                checked={pollAnonymous}
                onCheckedChange={(checked) => setPollAnonymous(checked === true)}
              />
              <div>
                <CVisionLabel C={C} htmlFor="poll-anonymous-checkbox" style={{ cursor: 'pointer' }}>
                  Anonymous voting
                </CVisionLabel>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Voters will not be identified
                </p>
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleCreatePoll} disabled={creating}>
              {creating && <RefreshCcw style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} />}
              Create Poll
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// =========================================================================
// STATS TAB
// =========================================================================

function StatsTab() {
  const { C, isDark } = useCVisionTheme();

  const { data: statsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.engagement.stats(),
    queryFn: () => cvisionFetch(`${API}?action=stats`),
  });
  const stats = statsRaw?.data ?? (statsRaw?.totalSuggestions !== undefined ? statsRaw : null);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 128, width: '100%' }}  />
          ))}
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 256, width: '100%' }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 256, width: '100%' }}  />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
          <BarChart3 style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 12 }} />
          <p style={{ color: C.textMuted }}>No statistics available yet.</p>
        </CVisionCardBody>
      </CVisionCard>
    );
  }

  const statCards = [
    {
      title: 'Total Suggestions',
      value: stats.totalSuggestions ?? 0,
      icon: Lightbulb,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100',
    },
    {
      title: 'New Suggestions',
      value: stats.newSuggestions ?? 0,
      icon: Flame,
      color: 'text-orange-600',
      bg: 'bg-orange-50 border-orange-200',
      iconBg: 'bg-orange-100',
    },
    {
      title: 'Implemented',
      value: stats.implemented ?? 0,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      iconBg: 'bg-emerald-100',
    },
    {
      title: 'Active Polls',
      value: stats.activePolls ?? 0,
      icon: Vote,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200',
      iconBg: 'bg-purple-100',
    },
  ];

  // Derive category breakdown from stats if available
  const categoryBreakdown = stats.byCategory || stats.categoryBreakdown || [];
  const statusBreakdown = stats.byStatus || stats.statusBreakdown || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Main Stat Cards */}
      <div style={{ display: 'grid', gap: 16 }}>
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <CVisionCard C={C} key={stat.title} className={`border ${stat.bg}`}>
              <CVisionCardBody style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, color: C.textMuted }}>{stat.title}</p>
                    <p className={`text-3xl font-bold mt-1 ${stat.color}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`h-12 w-12 rounded-full ${stat.iconBg} flex items-center justify-center`}
                  >
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Category Breakdown */}
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash style={{ height: 16, width: 16 }} /> Suggestions by Category
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Distribution of suggestions across categories
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            {categoryBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {categoryBreakdown.map((item: any) => {
                  const catKey = item.category || item._id || item.name;
                  const count = item.count || item.total || 0;
                  const maxCount = Math.max(
                    ...categoryBreakdown.map((c: any) => c.count || c.total || 0),
                    1
                  );
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={catKey} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CVisionBadge C={C}
                            variant="outline"
                            className={`text-xs ${CATEGORY_COLORS[catKey] || CATEGORY_COLORS.OTHER}`}
                          >
                            {CATEGORY_LABELS[catKey] || catKey}
                          </CVisionBadge>
                        </span>
                        <span style={{ fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                        <div
                          style={{ borderRadius: '50%', transition: 'all 0.2s', width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SUGGESTION_CATEGORIES.map((cat) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                    <CVisionBadge C={C}
                      variant="outline"
                      className={`text-xs ${CATEGORY_COLORS[cat]}`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </CVisionBadge>
                    <span style={{ fontSize: 13, color: C.textMuted }}>--</span>
                  </div>
                ))}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>

        {/* Status Breakdown */}
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 style={{ height: 16, width: 16 }} /> Suggestions by Status
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Current status distribution of all suggestions
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            {statusBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {statusBreakdown.map((item: any) => {
                  const statusKey = item.status || item._id || item.name;
                  const count = item.count || item.total || 0;
                  const maxCount = Math.max(
                    ...statusBreakdown.map((s: any) => s.count || s.total || 0),
                    1
                  );
                  const pct = Math.round((count / maxCount) * 100);
                  const StatusIcon = STATUS_ICONS[statusKey] || Lightbulb;
                  return (
                    <div key={statusKey} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CVisionBadge C={C}
                            variant="outline"
                            className={`text-xs ${STATUS_COLORS[statusKey] || STATUS_COLORS.NEW}`}
                          >
                            <StatusIcon style={{ height: 12, width: 12, marginRight: 4 }} />
                            {STATUS_LABELS[statusKey] || statusKey}
                          </CVisionBadge>
                        </span>
                        <span style={{ fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                        <div
                          style={{ borderRadius: '50%', transition: 'all 0.2s', width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SUGGESTION_STATUSES.map((status) => {
                  const StatusIcon = STATUS_ICONS[status] || Lightbulb;
                  return (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                      <CVisionBadge C={C}
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[status]}`}
                      >
                        <StatusIcon style={{ height: 12, width: 12, marginRight: 4 }} />
                        {STATUS_LABELS[status]}
                      </CVisionBadge>
                      <span style={{ fontSize: 13, color: C.textMuted }}>--</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Implementation Rate */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp style={{ height: 16, width: 16 }} /> Implementation Rate
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            Percentage of suggestions that have been implemented
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>Progress</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {stats.totalSuggestions > 0
                    ? Math.round(
                        ((stats.implemented ?? 0) / stats.totalSuggestions) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${
                  stats.totalSuggestions > 0
                    ? Math.round(
                        ((stats.implemented ?? 0) / stats.totalSuggestions) * 100
                      )
                    : 0
                }%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: C.textMuted }}>
                <span>{stats.implemented ?? 0} implemented</span>
                <span>{stats.totalSuggestions ?? 0} total</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <Award style={{ height: 32, width: 32, marginBottom: 4 }} />
              <p style={{ fontSize: 24, fontWeight: 700 }}>
                {stats.totalSuggestions > 0
                  ? Math.round(
                      ((stats.implemented ?? 0) / stats.totalSuggestions) * 100
                    )
                  : 0}
                %
              </p>
              <p style={{ fontSize: 12 }}>Implementation Rate</p>
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Quick Summary Cards */}
      <div style={{ display: 'grid', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
            <ThumbsUp style={{ height: 24, width: 24, color: C.blue, marginBottom: 8 }} />
            <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.totalVotes ?? '--'}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>Total Votes Cast</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
            <MessageSquare style={{ height: 24, width: 24, color: C.green, marginBottom: 8 }} />
            <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.totalComments ?? '--'}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>Total Comments</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
            <Users style={{ height: 24, width: 24, color: C.purple, marginBottom: 8 }} />
            <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.uniqueParticipants ?? '--'}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>Unique Participants</p>
          </CVisionCardBody>
        </CVisionCard>
      </div>
    </div>
  );
}

// =========================================================================
// MAIN PAGE
// =========================================================================

export default function EngagementPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('suggestions');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lightbulb style={{ height: 28, width: 28, color: C.orange }} /> Employee Engagement
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Suggestion box, polls, and engagement analytics. Share ideas and vote on what matters.
        </p>
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'suggestions', label: tr('الاقتراحات', 'Suggestions'), icon: <Lightbulb style={{ height: 14, width: 14 }} /> },
          { id: 'trending', label: tr('الرائج', 'Trending'), icon: <TrendingUp style={{ height: 14, width: 14 }} /> },
          { id: 'polls', label: tr('الاستطلاعات', 'Polls'), icon: <Vote style={{ height: 14, width: 14 }} /> },
          { id: 'stats', label: tr('الإحصائيات', 'Stats'), icon: <BarChart3 style={{ height: 14, width: 14 }} /> },
        ]}
      >
        <CVisionTabContent tabId="suggestions">
          <SuggestionsTab />
        </CVisionTabContent>
        <CVisionTabContent tabId="trending">
          <TrendingTab />
        </CVisionTabContent>
        <CVisionTabContent tabId="polls">
          <PollsTab />
        </CVisionTabContent>
        <CVisionTabContent tabId="stats">
          <StatsTab />
        </CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
