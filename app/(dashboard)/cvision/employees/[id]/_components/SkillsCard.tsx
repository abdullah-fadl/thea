'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraduationCap, ExternalLink } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionSkeletonCard , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

interface SkillEntry {
  name: string;
  level: number;
}

interface SkillsCardProps {
  employeeId: string;
}

export default function SkillsCard({ employeeId }: SkillsCardProps) {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/cvision/ai/skills?action=assess-gaps&employeeId=${employeeId}`, {
      credentials: 'include', signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.skills && Array.isArray(data.skills)) {
          const sorted = [...data.skills]
            .sort((a: any, b: any) => (b.level || b.score || 0) - (a.level || a.score || 0))
            .slice(0, 5)
            .map((s: any) => ({
              name: s.name || s.skill || 'Unknown',
              level: s.level || s.score || 0,
            }));
          setSkills(sorted);
        } else if (data?.assessment?.skills) {
          const sorted = [...data.assessment.skills]
            .sort((a: any, b: any) => (b.level || 0) - (a.level || 0))
            .slice(0, 5)
            .map((s: any) => ({
              name: s.name || s.skill || 'Unknown',
              level: s.level || 0,
            }));
          setSkills(sorted);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [employeeId]);

  return (
    <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GraduationCap style={{ width: 16, height: 16, color: C.textMuted }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('المهارات', 'Skills')}</h3>
        </div>
        <Link
          href="/cvision/ai/skills"
          style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
        >
          {tr('عرض المصفوفة', 'View Matrix')}
          <ExternalLink style={{ width: 12, height: 12 }} />
        </Link>
      </div>
      <div style={{ padding: 20 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <CVisionSkeletonCard C={C} height={12} />
                <CVisionSkeletonCard C={C} height={8} />
              </div>
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لم يتم تقييم المهارات بعد', 'No skills assessed yet')}</p>
            <Link
              href="/cvision/ai/skills"
              style={{ fontSize: 12, color: C.gold, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}
            >
              {tr('عرض مصفوفة المهارات', 'View Skills Matrix')}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {skills.map((skill) => (
              <div key={skill.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{skill.level}/5</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: `${C.textMuted}20`, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 3,
                    background: skill.level >= 4 ? C.green : skill.level >= 2 ? C.orange : C.red,
                    width: `${Math.min(skill.level * 20, 100)}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
