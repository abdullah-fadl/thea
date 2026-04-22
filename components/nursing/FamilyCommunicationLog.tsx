'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Users, Phone, Clock, MessageSquare, AlertCircle, Check, User, Globe } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  type FamilyCommData, type FamilyCommunicationEntry, type FamilyContact,
  type CommMethod, type CommTopic, type FamilyRelation, type EmotionalState,
  DEFAULT_FAMILY_COMM, COMM_METHODS, COMM_TOPICS, FAMILY_RELATIONS, EMOTIONAL_STATES,
} from '@/lib/clinical/familyCommunication';

interface FamilyCommunicationLogProps {
  value: FamilyCommData | null;
  onChange: (data: FamilyCommData) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function FamilyCommunicationLog({ value, onChange, compact = false, disabled = false }: FamilyCommunicationLogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_FAMILY_COMM;
  const [expanded, setExpanded] = useState(!compact);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  const update = useCallback((patch: Partial<FamilyCommData>) => {
    onChange({ ...data, ...patch });
  }, [data, onChange]);

  if (compact) {
    if (!value || data.entries.length === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
        <Users className="w-3 h-3" /> {data.entries.length}
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-indigo-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-sm text-indigo-700">
            {tr('سجل التواصل مع الأسرة', 'Family Communication Log')}
          </span>
          {data.entries.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {data.entries.length} {tr('تواصل', 'entry(s)')}
            </span>
          )}
          {data.contacts.length > 0 && (
            <span className="text-xs text-muted-foreground">
              • {data.contacts.length} {tr('جهة اتصال', 'contact(s)')}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Contacts section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {tr('جهات الاتصال', 'Family Contacts')}
              </label>
              {!disabled && (
                <button
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-3 h-3" />
                  {tr('إضافة جهة', 'Add Contact')}
                </button>
              )}
            </div>

            {showAddContact && !disabled && (
              <ContactForm
                tr={tr}
                language={language}
                onAdd={(contact) => {
                  update({ contacts: [...data.contacts, contact] });
                  setShowAddContact(false);
                }}
                onCancel={() => setShowAddContact(false)}
              />
            )}

            {data.contacts.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.contacts.map((c, i) => {
                  const rel = FAMILY_RELATIONS.find(r => r.value === c.relation);
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border text-xs">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-muted-foreground">({tr(rel?.labelAr || '', rel?.labelEn || '')})</span>
                      {c.isDecisionMaker && (
                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          {tr('صانع قرار', 'Decision Maker')}
                        </span>
                      )}
                      {c.phone && <span className="text-muted-foreground flex items-center gap-0.5"><Phone className="w-3 h-3" />{c.phone}</span>}
                      {!disabled && (
                        <button
                          onClick={() => update({ contacts: data.contacts.filter((_, j) => j !== i) })}
                          className="text-muted-foreground hover:text-red-500 ml-1"
                        >×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-1">{tr('لم تُضف جهات اتصال بعد', 'No contacts added yet')}</p>
            )}
          </div>

          <hr className="border-border" />

          {/* Communication entries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {tr('سجل التواصل', 'Communication Log')}
              </label>
              {!disabled && (
                <button
                  onClick={() => setShowNewEntry(!showNewEntry)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-3 h-3" />
                  {tr('تواصل جديد', 'New Entry')}
                </button>
              )}
            </div>

            {showNewEntry && !disabled && (
              <CommunicationEntryForm
                tr={tr}
                language={language}
                contacts={data.contacts}
                onAdd={(entry) => {
                  update({ entries: [entry, ...data.entries] });
                  setShowNewEntry(false);
                }}
                onCancel={() => setShowNewEntry(false)}
              />
            )}

            {data.entries.length > 0 ? (
              <div className="space-y-2 mt-2">
                {data.entries.map((entry, i) => (
                  <CommunicationCard key={entry.id} entry={entry} tr={tr} language={language} disabled={disabled} onRemove={() => {
                    update({ entries: data.entries.filter((_, j) => j !== i) });
                  }} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-1">{tr('لا يوجد سجلات تواصل', 'No communication entries')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactForm({ tr, language, onAdd, onCancel }: {
  tr: (ar: string, en: string) => string;
  language: string;
  onAdd: (c: FamilyContact) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<FamilyRelation>('SPOUSE');
  const [phone, setPhone] = useState('');
  const [isDecisionMaker, setIsDecisionMaker] = useState(false);

  return (
    <div className="p-3 bg-muted/50 rounded-lg border space-y-2 mb-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={tr('اسم جهة الاتصال', 'Contact name')}
          className="text-xs border rounded px-2 py-1.5"
        />
        <select
          value={relation}
          onChange={e => setRelation(e.target.value as FamilyRelation)}
          className="text-xs border rounded px-2 py-1.5"
        >
          {FAMILY_RELATIONS.map(r => (
            <option key={r.value} value={r.value}>{language === 'ar' ? r.labelAr : r.labelEn}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder={tr('رقم الهاتف (اختياري)', 'Phone (optional)')}
          className="flex-1 text-xs border rounded px-2 py-1.5"
        />
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={isDecisionMaker}
            onChange={e => setIsDecisionMaker(e.target.checked)}
            className="rounded border-border text-indigo-600"
          />
          {tr('صانع قرار', 'Decision maker')}
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">{tr('إلغاء', 'Cancel')}</button>
        <button
          onClick={() => name.trim() && onAdd({ name: name.trim(), relation, phone: phone.trim() || undefined, isDecisionMaker })}
          disabled={!name.trim()}
          className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-40"
        >
          {tr('إضافة', 'Add')}
        </button>
      </div>
    </div>
  );
}

function CommunicationEntryForm({ tr, language, contacts, onAdd, onCancel }: {
  tr: (ar: string, en: string) => string;
  language: string;
  contacts: FamilyContact[];
  onAdd: (e: FamilyCommunicationEntry) => void;
  onCancel: () => void;
}) {
  const [contactIdx, setContactIdx] = useState(0);
  const [method, setMethod] = useState<CommMethod>('IN_PERSON');
  const [topics, setTopics] = useState<CommTopic[]>([]);
  const [summary, setSummary] = useState('');
  const [questions, setQuestions] = useState('');
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('CALM');
  const [informedConsent, setInformedConsent] = useState(false);
  const [interpreterUsed, setInterpreterUsed] = useState(false);
  const [interpreterLang, setInterpreterLang] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualRelation, setManualRelation] = useState<FamilyRelation>('SPOUSE');

  const hasContacts = contacts.length > 0;

  const toggleTopic = (t: CommTopic) => {
    setTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSubmit = () => {
    const contact: FamilyContact = hasContacts
      ? contacts[contactIdx] || contacts[0]
      : { name: manualName.trim(), relation: manualRelation, isDecisionMaker: false };

    if (!contact.name || !summary.trim()) return;

    onAdd({
      id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      contact,
      method,
      topics,
      summary: summary.trim(),
      familyQuestions: questions.trim(),
      familyEmotionalState: emotionalState,
      informedConsent,
      interpreterUsed,
      interpreterLanguage: interpreterUsed ? interpreterLang : undefined,
      followUpNeeded: followUp,
      followUpNote: followUp ? followUpNote : undefined,
      communicatedBy: '',
    });
  };

  return (
    <div className="p-3 bg-indigo-50/30 rounded-lg border border-indigo-100 space-y-3 mb-2">
      {/* Contact selection */}
      {hasContacts ? (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('التواصل مع', 'Communicating with')}</label>
          <select
            value={contactIdx}
            onChange={e => setContactIdx(Number(e.target.value))}
            className="w-full text-xs border rounded px-2 py-1.5"
          >
            {contacts.map((c, i) => {
              const rel = FAMILY_RELATIONS.find(r => r.value === c.relation);
              return <option key={i} value={i}>{c.name} ({language === 'ar' ? rel?.labelAr : rel?.labelEn})</option>;
            })}
          </select>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            placeholder={tr('اسم الشخص', 'Person name')}
            className="text-xs border rounded px-2 py-1.5"
          />
          <select value={manualRelation} onChange={e => setManualRelation(e.target.value as FamilyRelation)} className="text-xs border rounded px-2 py-1.5">
            {FAMILY_RELATIONS.map(r => (
              <option key={r.value} value={r.value}>{language === 'ar' ? r.labelAr : r.labelEn}</option>
            ))}
          </select>
        </div>
      )}

      {/* Method */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('طريقة التواصل', 'Method')}</label>
        <div className="flex gap-1">
          {COMM_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors text-center
                ${method === m.value ? 'bg-indigo-600 text-white' : 'bg-card text-muted-foreground border hover:border-indigo-300'}`}
            >
              {m.icon} {tr(m.labelAr, m.labelEn)}
            </button>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('المواضيع', 'Topics')}</label>
        <div className="flex flex-wrap gap-1.5">
          {COMM_TOPICS.map(t => (
            <button
              key={t.value}
              onClick={() => toggleTopic(t.value)}
              className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors
                ${topics.includes(t.value)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-card text-muted-foreground border-border hover:border-indigo-300'}`}
            >
              {tr(t.labelAr, t.labelEn)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('ملخص التواصل', 'Communication Summary')}</label>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          rows={2}
          placeholder={tr('ماذا تم مناقشته؟', 'What was discussed?')}
          className="w-full text-xs border rounded px-2 py-1.5 resize-none"
        />
      </div>

      {/* Family questions */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('أسئلة الأسرة', 'Family Questions')}</label>
        <textarea
          value={questions}
          onChange={e => setQuestions(e.target.value)}
          rows={1}
          placeholder={tr('أسئلة أو مخاوف أبداها الأهل', 'Questions or concerns raised')}
          className="w-full text-xs border rounded px-2 py-1.5 resize-none"
        />
      </div>

      {/* Emotional state */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الحالة النفسية للأسرة', 'Family Emotional State')}</label>
        <div className="flex gap-1">
          {EMOTIONAL_STATES.map(es => (
            <button
              key={es.value}
              onClick={() => setEmotionalState(es.value)}
              className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors text-center
                ${emotionalState === es.value ? 'bg-indigo-600 text-white' : 'bg-card text-muted-foreground border hover:border-indigo-300'}`}
            >
              {es.emoji} {tr(es.labelAr, es.labelEn)}
            </button>
          ))}
        </div>
      </div>

      {/* Flags row */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={informedConsent} onChange={e => setInformedConsent(e.target.checked)} className="rounded border-border text-indigo-600" />
          {tr('تم أخذ موافقة مستنيرة', 'Informed consent obtained')}
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={interpreterUsed} onChange={e => setInterpreterUsed(e.target.checked)} className="rounded border-border text-indigo-600" />
          {tr('استخدام مترجم', 'Interpreter used')}
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} className="rounded border-border text-indigo-600" />
          {tr('يحتاج متابعة', 'Follow-up needed')}
        </label>
      </div>

      {interpreterUsed && (
        <input
          type="text"
          value={interpreterLang}
          onChange={e => setInterpreterLang(e.target.value)}
          placeholder={tr('لغة الترجمة', 'Interpreter language')}
          className="w-full text-xs border rounded px-2 py-1.5"
        />
      )}

      {followUp && (
        <input
          type="text"
          value={followUpNote}
          onChange={e => setFollowUpNote(e.target.value)}
          placeholder={tr('تفاصيل المتابعة المطلوبة', 'Follow-up details')}
          className="w-full text-xs border rounded px-2 py-1.5"
        />
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">{tr('إلغاء', 'Cancel')}</button>
        <button
          onClick={handleSubmit}
          disabled={!summary.trim() || (!hasContacts && !manualName.trim())}
          className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-40"
        >
          {tr('حفظ التواصل', 'Save Entry')}
        </button>
      </div>
    </div>
  );
}

function CommunicationCard({ entry, tr, language, disabled, onRemove }: {
  entry: FamilyCommunicationEntry;
  tr: (ar: string, en: string) => string;
  language: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const methodCfg = COMM_METHODS.find(m => m.value === entry.method);
  const emotionCfg = EMOTIONAL_STATES.find(e => e.value === entry.familyEmotionalState);
  const relCfg = FAMILY_RELATIONS.find(r => r.value === entry.contact.relation);
  const ts = new Date(entry.timestamp);
  const timeStr = ts.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = ts.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors">
        <span className="text-base">{methodCfg?.icon || <User className="h-4 w-4" />}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-foreground truncate">{entry.contact.name}</span>
            <span className="text-muted-foreground">({tr(relCfg?.labelAr || '', relCfg?.labelEn || '')})</span>
            <span className="text-muted-foreground flex items-center gap-0.5 shrink-0"><Clock className="w-3 h-3" />{dateStr} {timeStr}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.summary}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {entry.followUpNeeded && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
          {entry.informedConsent && <Check className="w-3.5 h-3.5 text-green-500" />}
          <span className="text-sm">{emotionCfg?.emoji}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          {entry.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.topics.map(t => {
                const tcfg = COMM_TOPICS.find(x => x.value === t);
                return (
                  <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">
                    {tr(tcfg?.labelAr || '', tcfg?.labelEn || '')}
                  </span>
                );
              })}
            </div>
          )}
          <p className="text-xs text-foreground">{entry.summary}</p>
          {entry.familyQuestions && (
            <div className="p-2 bg-amber-50 rounded text-xs">
              <span className="font-medium text-amber-700"><MessageSquare className="w-3 h-3 inline mr-1" />{tr('أسئلة الأسرة:', 'Family questions:')}</span>
              <p className="text-amber-800 mt-0.5">{entry.familyQuestions}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>{tr('الحالة النفسية:', 'Emotional state:')} {emotionCfg?.emoji} {tr(emotionCfg?.labelAr || '', emotionCfg?.labelEn || '')}</span>
            {entry.interpreterUsed && <span><Globe className="h-3 w-3 inline mr-0.5" /> {tr('مترجم:', 'Interpreter:')} {entry.interpreterLanguage}</span>}
            {entry.informedConsent && <span className="text-green-600"><Check className="h-3 w-3 inline mr-0.5" /> {tr('موافقة مستنيرة', 'Informed consent')}</span>}
          </div>
          {entry.followUpNeeded && entry.followUpNote && (
            <div className="p-2 bg-amber-50 rounded text-xs text-amber-700">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {tr('متابعة:', 'Follow-up:')} {entry.followUpNote}
            </div>
          )}
          {!disabled && (
            <div className="flex justify-end">
              <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">{tr('حذف', 'Remove')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
