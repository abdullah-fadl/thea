'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTabs, CVisionTabContent, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Heart, HeartPulse, Trophy, Plus, Activity, Smile, Brain,
  Droplets, Moon, BookOpen, Footprints, Dumbbell, RefreshCcw,
  Users, Medal, TrendingUp, AlertTriangle, Link as LinkIcon,
  Video, FileText, Phone, BarChart3, Target, Flame, Star,
  Sparkles, Clock, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════
const API = '/api/cvision/wellness';

function fmtDate(d: any) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const CHALLENGE_TYPES = ['STEPS', 'EXERCISE', 'WATER', 'SLEEP', 'MEDITATION', 'READING', 'CUSTOM'] as const;
type ChallengeType = typeof CHALLENGE_TYPES[number];

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  STEPS: 'Steps',
  EXERCISE: 'Exercise',
  WATER: 'Water',
  SLEEP: 'Sleep',
  MEDITATION: 'Meditation',
  READING: 'Reading',
  CUSTOM: 'Custom',
};

const CHALLENGE_TYPE_COLORS: Record<ChallengeType, string> = {
  STEPS: 'bg-green-50 border-green-200 text-green-800',
  EXERCISE: 'bg-blue-50 border-blue-200 text-blue-800',
  WATER: 'bg-cyan-50 border-cyan-200 text-cyan-800',
  SLEEP: 'bg-purple-50 border-purple-200 text-purple-800',
  MEDITATION: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  READING: 'bg-orange-50 border-orange-200 text-orange-800',
  CUSTOM: 'bg-gray-50 border-gray-200 text-gray-800',
};

const CHALLENGE_TYPE_BADGE: Record<ChallengeType, string> = {
  STEPS: 'bg-green-100 text-green-700 border-green-300',
  EXERCISE: 'bg-blue-100 text-blue-700 border-blue-300',
  WATER: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  SLEEP: 'bg-purple-100 text-purple-700 border-purple-300',
  MEDITATION: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  READING: 'bg-orange-100 text-orange-700 border-orange-300',
  CUSTOM: 'bg-gray-100 text-gray-700 border-gray-300',
};

const CHALLENGE_TYPE_ICONS: Record<ChallengeType, any> = {
  STEPS: Footprints,
  EXERCISE: Dumbbell,
  WATER: Droplets,
  SLEEP: Moon,
  MEDITATION: Brain,
  READING: BookOpen,
  CUSTOM: Target,
};

const RESOURCE_CATEGORIES = ['MENTAL_HEALTH', 'NUTRITION', 'FITNESS', 'STRESS', 'ERGONOMICS'] as const;
type ResourceCategory = typeof RESOURCE_CATEGORIES[number];

const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  MENTAL_HEALTH: 'Mental Health',
  NUTRITION: 'Nutrition',
  FITNESS: 'Fitness',
  STRESS: 'Stress Management',
  ERGONOMICS: 'Ergonomics',
};

const RESOURCE_CATEGORY_COLORS: Record<ResourceCategory, string> = {
  MENTAL_HEALTH: 'bg-purple-50 border-purple-200',
  NUTRITION: 'bg-green-50 border-green-200',
  FITNESS: 'bg-blue-50 border-blue-200',
  STRESS: 'bg-amber-50 border-amber-200',
  ERGONOMICS: 'bg-slate-50 border-slate-200',
};

const RESOURCE_TYPES = ['ARTICLE', 'VIDEO', 'LINK', 'CONTACT'] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  ARTICLE: 'Article',
  VIDEO: 'Video',
  LINK: 'Link',
  CONTACT: 'Contact',
};

const RESOURCE_TYPE_ICONS: Record<ResourceType, any> = {
  ARTICLE: FileText,
  VIDEO: Video,
  LINK: LinkIcon,
  CONTACT: Phone,
};

const MOOD_EMOJIS: Record<number, string> = {
  1: '\u{1F622}',
  2: '\u{1F615}',
  3: '\u{1F610}',
  4: '\u{1F642}',
  5: '\u{1F60A}',
};

const MOOD_LABELS: Record<number, string> = {
  1: 'Very Bad',
  2: 'Bad',
  3: 'Neutral',
  4: 'Good',
  5: 'Great',
};

const MOOD_COLORS: Record<number, string> = {
  1: 'bg-red-100 border-red-300 hover:bg-red-200',
  2: 'bg-orange-100 border-orange-300 hover:bg-orange-200',
  3: 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200',
  4: 'bg-lime-100 border-lime-300 hover:bg-lime-200',
  5: 'bg-green-100 border-green-300 hover:bg-green-200',
};

const MOOD_ACTIVE_COLORS: Record<number, string> = {
  1: 'bg-red-300 border-red-500 ring-2 ring-red-400',
  2: 'bg-orange-300 border-orange-500 ring-2 ring-orange-400',
  3: 'bg-yellow-300 border-yellow-500 ring-2 ring-yellow-400',
  4: 'bg-lime-300 border-lime-500 ring-2 ring-lime-400',
  5: 'bg-green-300 border-green-500 ring-2 ring-green-400',
};

// ═══════════════════════════════════════════════════════════════════════
// CHALLENGES TAB
// ═══════════════════════════════════════════════════════════════════════
function ChallengesTab() {
  const { C, isDark } = useCVisionTheme();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  // Create challenge form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('STEPS');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newReward, setNewReward] = useState('');

  // Join challenge
  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [joinEmployeeId, setJoinEmployeeId] = useState('');
  const [joinEmployeeName, setJoinEmployeeName] = useState('');
  // Update progress
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressChallenge, setProgressChallenge] = useState<any>(null);
  const [progressEmployeeId, setProgressEmployeeId] = useState('');
  const [progressValue, setProgressValue] = useState('');

  const { data: chalRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.wellness.challenges(),
    queryFn: () => cvisionFetch<any>(`${API}?action=challenges`),
  });
  const challenges: any[] = chalRaw?.data?.items || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.wellness.challenges() });

  const createMutation = useMutation({
    mutationFn: () => cvisionMutate(API, 'POST', {
      action: 'create-challenge', name: newName, type: newType,
      startDate: newStartDate, endDate: newEndDate,
      target: Number(newTarget), unit: newUnit, reward: newReward,
    }),
    onSuccess: (d: any) => {
      if (d.success || d.data) {
        toast.success('Challenge created successfully');
        setCreateOpen(false);
        resetCreateForm();
        invalidate();
      } else { toast.error(d.error || 'Failed to create challenge'); }
    },
    onError: () => { toast.error('Error creating challenge'); },
  });
  const submitting = createMutation.isPending;

  const handleCreate = () => {
    if (!newName || !newStartDate || !newEndDate || !newTarget) {
      toast.error('Please fill all required fields');
      return;
    }
    createMutation.mutate();
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewType('STEPS');
    setNewStartDate('');
    setNewEndDate('');
    setNewTarget('');
    setNewUnit('');
    setNewReward('');
  };

  const joinMutation = useMutation({
    mutationFn: () => cvisionMutate(API, 'POST', {
      action: 'join-challenge',
      challengeId: selectedChallenge?._id || selectedChallenge?.challengeId,
      employeeId: joinEmployeeId, employeeName: joinEmployeeName,
    }),
    onSuccess: (d: any) => {
      if (d.success || d.data) {
        toast.success('Joined challenge successfully');
        setJoinOpen(false); setJoinEmployeeId(''); setJoinEmployeeName('');
        invalidate();
      } else { toast.error(d.error || 'Failed to join challenge'); }
    },
    onError: () => { toast.error('Error joining challenge'); },
  });
  const joining = joinMutation.isPending;

  const handleJoin = () => {
    if (!selectedChallenge || !joinEmployeeId || !joinEmployeeName) {
      toast.error('Please provide your Employee ID and Name');
      return;
    }
    joinMutation.mutate();
  };

  const progressMutation = useMutation({
    mutationFn: () => cvisionMutate(API, 'POST', {
      action: 'update-progress',
      challengeId: progressChallenge?._id || progressChallenge?.challengeId,
      employeeId: progressEmployeeId, progress: Number(progressValue),
    }),
    onSuccess: (d: any) => {
      if (d.success || d.data) {
        toast.success('Progress updated');
        setProgressOpen(false); setProgressEmployeeId(''); setProgressValue('');
        invalidate();
      } else { toast.error(d.error || 'Failed to update progress'); }
    },
    onError: () => { toast.error('Error updating progress'); },
  });
  const updatingProgress = progressMutation.isPending;

  const handleUpdateProgress = () => {
    if (!progressChallenge || !progressEmployeeId || !progressValue) {
      toast.error('Please fill all fields');
      return;
    }
    progressMutation.mutate();
  };

  const getProgressPercent = (challenge: any) => {
    if (!challenge.target || challenge.target <= 0) return 0;
    const totalProgress = (challenge.participants || []).reduce(
      (sum: number, p: any) => sum + (p.progress || 0), 0
    );
    const avgProgress = challenge.participants?.length
      ? totalProgress / challenge.participants.length
      : 0;
    return Math.min(100, Math.round((avgProgress / challenge.target) * 100));
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 208, width: '100%', borderRadius: 16 }}  />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13, color: C.textMuted }}>
          {challenges.length} active challenge{challenges.length !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => invalidate()}>
            <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setCreateOpen(true)}>
            <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> New Challenge
          </CVisionButton>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {challenges.map((ch) => {
          const typ = (ch.type || 'CUSTOM') as ChallengeType;
          const Icon = CHALLENGE_TYPE_ICONS[typ] || Target;
          const cardColor = CHALLENGE_TYPE_COLORS[typ] || CHALLENGE_TYPE_COLORS.CUSTOM;
          const badgeColor = CHALLENGE_TYPE_BADGE[typ] || CHALLENGE_TYPE_BADGE.CUSTOM;
          const pct = getProgressPercent(ch);
          return (
            <CVisionCard C={C} key={ch._id || ch.challengeId} className={`border ${cardColor} transition-shadow hover:shadow-md`}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ height: 36, width: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon style={{ height: 20, width: 20 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ch.name}</div>
                      <CVisionBadge C={C} variant="outline" className={`mt-1 text-xs ${badgeColor}`}>
                        {CHALLENGE_TYPE_LABELS[typ] || typ}
                      </CVisionBadge>
                    </div>
                  </div>
                </div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
                  <Calendar style={{ height: 14, width: 14 }} />
                  <span>{fmtDate(ch.startDate)} - {fmtDate(ch.endDate)}</span>
                </div>

                {ch.target && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>Progress</span>
                      <span style={{ fontWeight: 500 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      Target: {ch.target} {ch.unit || ''}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textMuted }}>
                    <Users style={{ height: 14, width: 14 }} />
                    <span>{(ch.participants || []).length} participant{(ch.participants || []).length !== 1 ? 's' : ''}</span>
                  </div>
                  {ch.reward && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <Trophy style={{ height: 14, width: 14, color: C.orange }} />
                      <span style={{ fontWeight: 500 }}>{ch.reward}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="outline"
                    style={{ flex: 1, fontSize: 12 }}
                    onClick={() => {
                      setSelectedChallenge(ch);
                      setJoinOpen(true);
                    }}
                  >
                    Join
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="outline"
                    style={{ flex: 1, fontSize: 12 }}
                    onClick={() => {
                      setProgressChallenge(ch);
                      setProgressOpen(true);
                    }}
                  >
                    Update Progress
                  </CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
        {challenges.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textMuted, paddingTop: 48, paddingBottom: 48 }}>
            No active challenges. Create one to get started!
          </div>
        )}
      </div>

      {/* Create Challenge Dialog */}
      <CVisionDialog C={C} open={createOpen} onClose={() => setCreateOpen(false)} title="Create Program" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Set up a new challenge for your team</p>          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Challenge Name *</CVisionLabel>
              <CVisionInput C={C}
                placeholder="e.g. 10K Steps Daily"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Type *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={newType || undefined}
                onChange={setNewType}
                placeholder="Select type"
                options={CHALLENGE_TYPES.map((t) => (
                    ({ value: t, label: CHALLENGE_TYPE_LABELS[t] })
                  ))}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Start Date *</CVisionLabel>
                <CVisionInput C={C}
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>End Date *</CVisionLabel>
                <CVisionInput C={C}
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Target *</CVisionLabel>
                <CVisionInput C={C}
                  type="number"
                  placeholder="e.g. 10000"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Unit</CVisionLabel>
                <CVisionInput C={C}
                  placeholder="e.g. steps, minutes, glasses"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Reward</CVisionLabel>
              <CVisionInput C={C}
                placeholder="e.g. 500 wellness points"
                value={newReward}
                onChange={(e) => setNewReward(e.target.value)}
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleCreate} disabled={submitting}>
              {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              Create Challenge
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Join Challenge Dialog */}
      <CVisionDialog C={C} open={joinOpen} onClose={() => setJoinOpen(false)} title="Join Program" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Join &quot;{selectedChallenge?.name || ''}&quot; challenge
            </p>          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Employee ID *</CVisionLabel>
              <CVisionInput C={C}
                placeholder="Your Employee ID"
                value={joinEmployeeId}
                onChange={(e) => setJoinEmployeeId(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Your Name *</CVisionLabel>
              <CVisionInput C={C}
                placeholder="Your full name"
                value={joinEmployeeName}
                onChange={(e) => setJoinEmployeeName(e.target.value)}
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setJoinOpen(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleJoin} disabled={joining}>
              {joining && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              Join Challenge
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Update Progress Dialog */}
      <CVisionDialog C={C} open={progressOpen} onClose={() => setProgressOpen(false)} title="Log Progress" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Log your progress for &quot;{progressChallenge?.name || ''}&quot;
            </p>          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Employee ID *</CVisionLabel>
              <CVisionInput C={C}
                placeholder="Your Employee ID"
                value={progressEmployeeId}
                onChange={(e) => setProgressEmployeeId(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>
                Progress ({progressChallenge?.unit || 'units'}) *
              </CVisionLabel>
              <CVisionInput C={C}
                type="number"
                placeholder={`e.g. ${progressChallenge?.target || 100}`}
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.value)}
              />
            </div>
            {progressChallenge?.target && (
              <p style={{ fontSize: 12, color: C.textMuted }}>
                Target: {progressChallenge.target} {progressChallenge.unit || ''}
              </p>
            )}
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setProgressOpen(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleUpdateProgress} disabled={updatingProgress}>
              {updatingProgress && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              Save Progress
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MOOD TAB
// ═══════════════════════════════════════════════════════════════════════
function MoodTab() {
  const { C, isDark } = useCVisionTheme();
  const queryClient = useQueryClient();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => cvisionFetch('/api/auth/me'),
  });
  const employeeId = (meData as Record<string, unknown>)?.user ? ((meData as Record<string, unknown>).user as Record<string, unknown>)?.employeeId as string || '' : (meData as Record<string, unknown>)?.employeeId as string || '';
  const setEmployeeId = (_v: string) => { /* derived from auth — read-only */ };

  const { data: trendsRaw, isLoading: loadingTrends } = useQuery({
    queryKey: cvisionKeys.wellness.moodTrends(),
    queryFn: () => cvisionFetch<any>(`${API}?action=mood-trends`),
  });
  const trends = trendsRaw?.data || trendsRaw || null;

  const moodMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (d: any) => {
      if (d.success || d.data) {
        toast.success('Mood logged successfully');
        setSelectedMood(null);
        setNotes('');
        queryClient.invalidateQueries({ queryKey: cvisionKeys.wellness.moodTrends() });
      } else toast.error(d.error || 'Failed to log mood');
    },
    onError: () => toast.error('Error logging mood'),
  });
  const submitting = moodMutation.isPending;

  const handleLogMood = () => {
    if (selectedMood === null) { toast.error('Please select a mood'); return; }
    if (!employeeId) { toast.error('Employee ID is required'); return; }
    moodMutation.mutate({ action: 'log-mood', employeeId, mood: selectedMood, notes });
  };

  const getMaxDistribution = () => {
    if (!trends?.distribution) return 1;
    return Math.max(1, ...Object.values(trends.distribution as Record<string, number>));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Mood Logging Section */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smile style={{ height: 20, width: 20, color: C.orange }} /> How are you feeling today?
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Log your mood to help us understand team wellness</div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!employeeId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Employee ID</CVisionLabel>
              <CVisionInput C={C}
                placeholder="Enter your Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((mood) => (
              <button
                key={mood}
                onClick={() => setSelectedMood(mood)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  selectedMood === mood
                    ? MOOD_ACTIVE_COLORS[mood]
                    : MOOD_COLORS[mood]
                }`}
              >
                <span className="text-4xl">{MOOD_EMOJIS[mood]}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{MOOD_LABELS[mood]}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C}>Notes (optional)</CVisionLabel>
            <CVisionTextarea C={C}
              placeholder="Add any thoughts about how you're feeling..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <CVisionButton C={C} isDark={isDark}
            onClick={handleLogMood}
            disabled={submitting || selectedMood === null}
            style={{ width: '100%' }}
          >
            {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            <Heart style={{ height: 16, width: 16, marginRight: 8 }} />
            Log Mood
          </CVisionButton>
        </CVisionCardBody>
      </CVisionCard>

      {/* Mood Trends */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 style={{ height: 20, width: 20, color: C.blue }} /> Mood Trends
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Team mood distribution overview</div>
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: cvisionKeys.wellness.moodTrends() })}>
              <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
            </CVisionButton>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {loadingTrends ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 24, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 24, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 24, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 24, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 24, width: '100%' }}  />
            </div>
          ) : trends ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div style={{ textAlign: 'center', padding: 16, borderRadius: 12 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: C.gold }}>
                    {trends.averageMood != null ? Number(trends.averageMood).toFixed(1) : '—'}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Average Mood</div>
                  {trends.averageMood != null && (
                    <div style={{ fontSize: 24, marginTop: 4 }}>
                      {MOOD_EMOJIS[Math.round(trends.averageMood)] || MOOD_EMOJIS[3]}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center', padding: 16, borderRadius: 12 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: C.gold }}>
                    {trends.totalEntries || 0}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Total Entries</div>
                </div>
              </div>

              {/* Distribution Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600 }}>Distribution</h4>
                {[5, 4, 3, 2, 1].map((mood) => {
                  const count = trends.distribution?.[mood] || 0;
                  const max = getMaxDistribution();
                  const pct = max > 0 ? (count / max) * 100 : 0;
                  return (
                    <div key={mood} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 96, flexShrink: 0 }}>
                        <span style={{ fontSize: 18 }}>{MOOD_EMOJIS[mood]}</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{MOOD_LABELS[mood]}</span>
                      </div>
                      <div style={{ flex: 1, height: 28, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            mood >= 4 ? 'bg-green-400' : mood === 3 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                        {count > 0 && (
                          <span style={{ position: 'absolute', display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 12, fontWeight: 500 }}>
                            {count}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>
              No mood data available yet. Start logging moods to see trends.
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LEADERBOARD TAB
// ═══════════════════════════════════════════════════════════════════════
function LeaderboardTab() {
  const { C, isDark } = useCVisionTheme();
  const queryClient = useQueryClient();

  const { data: lbRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.wellness.leaderboard(),
    queryFn: () => cvisionFetch<any>(`${API}?action=leaderboard`),
  });
  const leaderboard = ((lbRaw as { data?: { items?: Record<string, unknown>[] } } | undefined)?.data?.items || []) as Record<string, unknown>[];

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-amber-100 text-amber-700 border-amber-300';
    if (rank === 2) return 'bg-slate-100 text-slate-600 border-slate-300';
    if (rank === 3) return 'bg-orange-100 text-orange-700 border-orange-300';
    return '';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy style={{ height: 20, width: 20, color: C.orange }} />;
    if (rank === 2) return <Medal style={{ height: 20, width: 20 }} />;
    if (rank === 3) return <Medal style={{ height: 20, width: 20, color: C.orange }} />;
    return <span style={{ fontSize: 13, fontWeight: 700, color: C.textMuted }}>{rank}</span>;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 128, width: '100%' }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ height: 256, width: '100%' }}  />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[1, 0, 2].map((idx) => {
            const emp = leaderboard[idx];
            if (!emp) return null;
            const isFirst = idx === 0;
            return (
              <CVisionCard C={C}
                key={String(emp.employeeId || idx)}
                className={`text-center transition-shadow ${
                  isFirst ? 'border-amber-300 bg-amber-50 -mt-4 shadow-md' : 'border-muted'
                }`}
              >
                <CVisionCardBody style={{ paddingTop: 24, paddingBottom: 16 }}>
                  <div
                    className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                      isFirst
                        ? 'bg-amber-200 text-amber-800'
                        : idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-orange-200 text-orange-800'
                    }`}
                  >
                    {isFirst ? (
                      <Trophy style={{ height: 32, width: 32, color: C.orange }} />
                    ) : (
                      <span>{idx === 1 ? '2' : '3'}</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 12 }}>{String(emp.name || emp.employeeName || 'Employee')}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{String(emp.department || '')}</div>
                  <div className={`text-xl font-bold mt-2 ${isFirst ? 'text-amber-700' : 'text-primary'}`}>
                    {String(emp.wellnessPoints || emp.points || 0)} pts
                  </div>
                  {emp.badge && (
                    <CVisionBadge C={C} variant="outline" style={{ marginTop: 8, fontSize: 12 }}>
                      {String(emp.badge)}
                    </CVisionBadge>
                  )}
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy style={{ height: 20, width: 20, color: C.orange }} /> Wellness Leaderboard
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: cvisionKeys.wellness.leaderboard() })}>
              <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
            </CVisionButton>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
                <CVisionTh C={C} style={{ width: 64 }}>Rank</CVisionTh>
                <CVisionTh C={C}>Employee</CVisionTh>
                <CVisionTh C={C}>Department</CVisionTh>
                <CVisionTh C={C} align="right">Wellness Points</CVisionTh>
                <CVisionTh C={C}>Badge</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {leaderboard.map((emp, index) => {
                const rank = index + 1;
                return (
                  <CVisionTr C={C} key={String(emp.employeeId || index)}
                    className={rank <= 3 ? 'bg-amber-50/50' : ''}>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
                        {getRankIcon(rank)}
                      </div>
                    </CVisionTd>
                    <CVisionTd style={{ fontWeight: 500 }}>
                      {String(emp.name || emp.employeeName || 'Employee')}
                    </CVisionTd>
                    <CVisionTd style={{ color: C.textMuted }}>
                      {String(emp.department || '—')}
                    </CVisionTd>
                    <CVisionTd align="right" style={{ fontWeight: 600 }}>
                      {String(emp.wellnessPoints || emp.points || 0)}
                    </CVisionTd>
                    <CVisionTd>
                      {emp.badge ? (
                        <CVisionBadge C={C} variant="outline" className={`text-xs ${getRankBadge(rank)}`}>
                          {String(emp.badge)}
                        </CVisionBadge>
                      ) : (
                        <span style={{ fontSize: 12, color: C.textMuted }}>—</span>
                      )}
                    </CVisionTd>
                  </CVisionTr>
                );
              })}
              {leaderboard.length === 0 && (
                <CVisionTr C={C}>
                  <CVisionTd align="center" colSpan={5} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>
                    No leaderboard data yet. Participate in challenges to earn points!
                  </CVisionTd>
                </CVisionTr>
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RESOURCES TAB
// ═══════════════════════════════════════════════════════════════════════
function ResourcesTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [addOpen, setAddOpen] = useState(false);

  // Add resource form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('MENTAL_HEALTH');
  const [newType, setNewType] = useState<string>('ARTICLE');
  const [newUrl, setNewUrl] = useState('');
  const [newContent, setNewContent] = useState('');

  const { data: resRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.wellness.resources({ category: categoryFilter }),
    queryFn: () => cvisionFetch<any>(`${API}?action=resources${categoryFilter ? `&category=${categoryFilter}` : ''}`),
  });
  const resources: any[] = resRaw?.data?.items || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.wellness.all });

  const addMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (d: any) => {
      if (d.success || d.data) {
        toast.success('Resource added successfully');
        setAddOpen(false);
        resetAddForm();
        invalidate();
      } else toast.error(d.error || 'Failed to add resource');
    },
    onError: () => toast.error('Error adding resource'),
  });
  const submitting = addMutation.isPending;

  const handleAdd = () => {
    if (!newTitle) { toast.error('Title is required'); return; }
    addMutation.mutate({
      action: 'add-resource', title: newTitle, category: newCategory,
      type: newType, url: newUrl, content: newContent,
    });
  };

  const resetAddForm = () => {
    setNewTitle('');
    setNewCategory('MENTAL_HEALTH');
    setNewType('ARTICLE');
    setNewUrl('');
    setNewContent('');
  };

  // Group by category
  const grouped = resources.reduce<Record<string, any[]>>((acc, res) => {
    const cat = res.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(res);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 24, width: 160 }}  />
            <div style={{ display: 'grid', gap: 12 }}>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 128, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 128, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 128, width: '100%' }}  />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CVisionSelect
                C={C}
                value={categoryFilter || 'ALL'}
                placeholder="All Categories"
                options={[
                  { value: 'ALL', label: tr('كل الفئات', 'All Categories') },
                  ...RESOURCE_CATEGORIES.map((cat) => (
                ({ value: cat, label: RESOURCE_CATEGORY_LABELS[cat] })
              )),
                ]}
                style={{ width: 208 }}
              />
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => invalidate()}>
            <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
          </CVisionButton>
        </div>
        <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setAddOpen(true)}>
          <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Add Resource
        </CVisionButton>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', color: C.textMuted, paddingTop: 48, paddingBottom: 48 }}>
          No resources found. Add some wellness resources to help your team!
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => {
        const catKey = cat as ResourceCategory;
        const catColor = RESOURCE_CATEGORY_COLORS[catKey] || 'bg-slate-50 border-slate-200';
        return (
          <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HeartPulse style={{ height: 20, width: 20, color: C.gold }} />
              {RESOURCE_CATEGORY_LABELS[catKey] || cat}
              <CVisionBadge C={C} variant="secondary" style={{ marginLeft: 4 }}>{items.length}</CVisionBadge>
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map((res: any, idx: number) => {
                const resType = (res.type || 'LINK') as ResourceType;
                const TypeIcon = RESOURCE_TYPE_ICONS[resType] || LinkIcon;
                return (
                  <CVisionCard C={C}
                    key={res._id || idx}
                    className={`border ${catColor} hover:shadow-md transition-shadow`}
                  >
                    <CVisionCardBody style={{ paddingTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ height: 36, width: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${C.border}` }}>
                          <TypeIcon style={{ height: 20, width: 20, color: C.gold }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>
                            {res.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>
                              {RESOURCE_TYPE_LABELS[resType] || resType}
                            </CVisionBadge>
                          </div>
                          {res.content && (
                            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {res.content}
                            </p>
                          )}
                          {res.url && (
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: C.blue, marginTop: 8 }}
                            >
                              Open resource
                            </a>
                          )}
                        </div>
                      </div>
                    </CVisionCardBody>
                  </CVisionCard>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Resource Dialog */}
      <CVisionDialog C={C} open={addOpen} onClose={() => setAddOpen(false)} title="Add Entry" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Share a helpful wellness resource with the team</p>          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Title *</CVisionLabel>
              <CVisionInput C={C}
                placeholder="e.g. Managing Workplace Stress"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Category *</CVisionLabel>
                <CVisionSelect
                C={C}
                value={newCategory || undefined}
                onChange={setNewCategory}
                placeholder="Select category"
                options={RESOURCE_CATEGORIES.map((cat) => (
                      ({ value: cat, label: RESOURCE_CATEGORY_LABELS[cat] })
                    ))}
              />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Type *</CVisionLabel>
                <CVisionSelect
                C={C}
                value={newType || undefined}
                onChange={setNewType}
                placeholder="Select type"
                options={RESOURCE_TYPES.map((t) => (
                      ({ value: t, label: RESOURCE_TYPE_LABELS[t] })
                    ))}
              />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>URL</CVisionLabel>
              <CVisionInput C={C}
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Description / Content</CVisionLabel>
              <CVisionTextarea C={C}
                placeholder="Brief description of the resource..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setAddOpen(false); resetAddForm(); }}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleAdd} disabled={submitting}>
              {submitting && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              Add Resource
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STATS TAB
// ═══════════════════════════════════════════════════════════════════════
function StatsTab() {
  const { C, isDark } = useCVisionTheme();
  const queryClient = useQueryClient();
  // Calculate burnout
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcEmployeeId, setCalcEmployeeId] = useState('');
  const [calcResult, setCalcResult] = useState<any>(null);

  const { data: statsRaw, isLoading: loadingStats } = useQuery({
    queryKey: cvisionKeys.wellness.stats(),
    queryFn: () => cvisionFetch<any>(`${API}?action=stats`),
  });
  const stats = statsRaw?.data || statsRaw || null;

  const { data: burnoutRaw, isLoading: loadingBurnout } = useQuery({
    queryKey: cvisionKeys.wellness.burnoutReport(),
    queryFn: () => cvisionFetch<any>(`${API}?action=burnout-report`),
  });
  const burnoutReport = burnoutRaw?.data?.items || [];

  const burnoutMutation = useMutation({
    mutationFn: (employeeId: string) => cvisionMutate(API, 'POST', { action: 'calculate-burnout', employeeId }),
    onMutate: () => { setCalcResult(null); },
    onSuccess: (d: any) => {
      if (d.success || d.data) {
        setCalcResult(d.data || d);
        toast.success('Burnout risk calculated');
        queryClient.invalidateQueries({ queryKey: cvisionKeys.wellness.burnoutReport() });
      } else { toast.error(d.error || 'Failed to calculate burnout risk'); }
    },
    onError: () => { toast.error('Error calculating burnout risk'); },
  });
  const calculating = burnoutMutation.isPending;

  const handleCalculateBurnout = () => {
    if (!calcEmployeeId) {
      toast.error('Please enter an Employee ID');
      return;
    }
    burnoutMutation.mutate(calcEmployeeId);
  };

  const getBurnoutRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'HIGH': return 'bg-red-100 text-red-700 border-red-300';
      case 'MEDIUM': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'LOW': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getBurnoutIcon = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'HIGH': return <Flame style={{ height: 16, width: 16, color: C.red }} />;
      case 'MEDIUM': return <AlertTriangle style={{ height: 16, width: 16, color: C.orange }} />;
      case 'LOW': return <Heart style={{ height: 16, width: 16, color: C.green }} />;
      default: return <Activity style={{ height: 16, width: 16 }} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat Cards */}
      {loadingStats ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 112, width: '100%' }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 112, width: '100%' }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 112, width: '100%' }}  />
        </div>
      ) : stats ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <CVisionCard C={C} style={{ background: C.greenDim }}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ height: 48, width: 48, borderRadius: 16, background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target style={{ height: 24, width: 24, color: C.green }} />
                </div>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: C.green }}>
                    {stats.activeChallenges ?? 0}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Active Challenges</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ background: C.blueDim }}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ height: 48, width: 48, borderRadius: 16, background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen style={{ height: 24, width: 24, color: C.blue }} />
                </div>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: C.blue }}>
                    {stats.resources ?? 0}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Wellness Resources</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ background: C.purpleDim }}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ height: 48, width: 48, borderRadius: 16, background: C.purpleDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users style={{ height: 24, width: 24, color: C.purple }} />
                </div>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: C.purple }}>
                    {stats.participants ?? 0}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Active Participants</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      ) : null}

      {/* Burnout Calculator */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain style={{ height: 20, width: 20, color: C.purple }} /> Burnout Risk Calculator
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Assess burnout risk for individual employees</div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Employee ID</CVisionLabel>
              <CVisionInput C={C}
                placeholder="Enter Employee ID"
                value={calcEmployeeId}
                onChange={(e) => setCalcEmployeeId(e.target.value)}
              />
            </div>
            <CVisionButton C={C} isDark={isDark} onClick={handleCalculateBurnout} disabled={calculating || !calcEmployeeId}>
              {calculating && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              <Activity style={{ height: 16, width: 16, marginRight: 8 }} />
              Calculate
            </CVisionButton>
          </div>

          {calcResult && (
            <CVisionCard C={C} className="border-2">
              <CVisionCardBody style={{ paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className={`h-16 w-16 rounded-xl flex items-center justify-center ${
                    calcResult.riskLevel === 'HIGH' ? 'bg-red-100' :
                    calcResult.riskLevel === 'MEDIUM' ? 'bg-amber-100' : 'bg-green-100'
                  }`}>
                    {getBurnoutIcon(calcResult.riskLevel)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>Burnout Risk Level</div>
                    <CVisionBadge C={C}
                      variant="outline"
                      className={`text-sm mt-1 ${getBurnoutRiskColor(calcResult.riskLevel)}`}
                    >
                      {calcResult.riskLevel || 'Unknown'}
                    </CVisionBadge>
                    {calcResult.score != null && (
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                        Score: {calcResult.score}/100
                      </div>
                    )}
                  </div>
                  {calcResult.factors && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: C.textMuted }}>Contributing Factors</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                        {(Array.isArray(calcResult.factors) ? calcResult.factors : []).map(
                          (f: string, i: number) => (
                            <CVisionBadge C={C} key={i} variant="secondary" style={{ fontSize: 12 }}>{f}</CVisionBadge>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {calcResult.recommendations && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Recommendations</div>
                    <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(Array.isArray(calcResult.recommendations) ? calcResult.recommendations : []).map(
                        (rec: string, i: number) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                            <Sparkles style={{ height: 12, width: 12, marginTop: 2, color: C.gold, flexShrink: 0 }} />
                            {rec}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Burnout Report */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle style={{ height: 20, width: 20, color: C.orange }} /> Burnout Report
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Employees identified as at-risk for burnout</div>
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: cvisionKeys.wellness.burnoutReport() })}>
              <RefreshCcw style={{ height: 16, width: 16, marginRight: 4 }} /> Refresh
            </CVisionButton>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {loadingBurnout ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 48, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 48, width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 48, width: '100%' }}  />
            </div>
          ) : burnoutReport.length > 0 ? (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>Employee</CVisionTh>
                  <CVisionTh C={C}>Department</CVisionTh>
                  <CVisionTh C={C}>Risk Level</CVisionTh>
                  <CVisionTh C={C} align="right">Score</CVisionTh>
                  <CVisionTh C={C}>Last Assessed</CVisionTh>
                  <CVisionTh C={C}>Factors</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {burnoutReport.map((emp, idx) => (
                  <CVisionTr C={C} key={emp.employeeId || idx}>
                    <CVisionTd style={{ fontWeight: 500 }}>
                      {emp.name || emp.employeeName || emp.employeeId || '—'}
                    </CVisionTd>
                    <CVisionTd style={{ color: C.textMuted }}>
                      {emp.department || '—'}
                    </CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {getBurnoutIcon(emp.riskLevel)}
                        <CVisionBadge C={C}
                          variant="outline"
                          className={`text-xs ${getBurnoutRiskColor(emp.riskLevel)}`}
                        >
                          {emp.riskLevel || '—'}
                        </CVisionBadge>
                      </div>
                    </CVisionTd>
                    <CVisionTd align="right" style={{ fontWeight: 600 }}>
                      {emp.score != null ? emp.score : '—'}
                    </CVisionTd>
                    <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>
                      {fmtDate(emp.lastAssessed || emp.updatedAt)}
                    </CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(Array.isArray(emp.factors) ? emp.factors : []).slice(0, 3).map(
                          (f: string, i: number) => (
                            <CVisionBadge C={C} key={i} variant="secondary" style={{ fontSize: 12 }}>{f}</CVisionBadge>
                          )
                        )}
                        {(emp.factors || []).length > 3 && (
                          <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>
                            +{emp.factors.length - 3}
                          </CVisionBadge>
                        )}
                      </div>
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          ) : (
            <div style={{ textAlign: 'center', color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>
              No burnout risk data available. Use the calculator above to assess employees.
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Burnout Calculate Dialog (for mobile / alternate flow) */}
      <CVisionDialog C={C} open={calcOpen} onClose={() => setCalcOpen(false)} title="Calculator" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Enter an employee ID to assess burnout risk</p>          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Employee ID *</CVisionLabel>
              <CVisionInput C={C}
                placeholder="e.g. EMP-001"
                value={calcEmployeeId}
                onChange={(e) => setCalcEmployeeId(e.target.value)}
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCalcOpen(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleCalculateBurnout} disabled={calculating}>
              {calculating && <RefreshCcw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              Calculate
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function WellnessPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
          <HeartPulse style={{ height: 32, width: 32 }} /> Employee Wellness
        </h1>
        <p style={{ color: C.textMuted }}>
          Track wellness challenges, log moods, access resources, and monitor burnout risk
        </p>
      </div>

      <CVisionTabs
        C={C}
        defaultTab="challenges"
        tabs={[
          { id: 'challenges', label: tr('التحديات', 'Challenges'), icon: <Target style={{ height: 14, width: 14 }} /> },
          { id: 'mood', label: tr('المزاج', 'Mood'), icon: <Smile style={{ height: 14, width: 14 }} /> },
          { id: 'leaderboard', label: tr('لوحة المتصدرين', 'Leaderboard'), icon: <Trophy style={{ height: 14, width: 14 }} /> },
          { id: 'resources', label: tr('الموارد', 'Resources'), icon: <BookOpen style={{ height: 14, width: 14 }} /> },
          { id: 'stats', label: tr('الإحصائيات', 'Stats'), icon: <BarChart3 style={{ height: 14, width: 14 }} /> },
        ]}
      >
        <CVisionTabContent tabId="challenges">
          <ChallengesTab />
        </CVisionTabContent>
        <CVisionTabContent tabId="mood">
          <MoodTab />
        </CVisionTabContent>
        <CVisionTabContent tabId="leaderboard">
          <LeaderboardTab />
        </CVisionTabContent>
        <CVisionTabContent tabId="resources">
          <ResourcesTab />
        </CVisionTabContent>
        <CVisionTabContent tabId="stats">
          <StatsTab />
        </CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
