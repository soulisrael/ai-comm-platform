import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useCustomAgents,
  useCustomAgent,
  useCustomAgentActions,
  useAgentTest,
} from '../hooks/useCustomAgents';
import { useAgentBrain, useBrainActions } from '../hooks/useAgentBrain';
import type { CustomAgent, CustomAgentWithBrain, BrainEntry } from '../lib/types';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import {
  Plus,
  ArrowRight,
  Copy,
  Trash2,
  Save,
  Power,
  X,
  Tag,
  Bot,
  Settings,
  FileText,
  BookOpen,
  Route,
  ShieldCheck,
  FlaskConical,
  Send,
  RotateCcw,
  Star,
  Hash,
  Upload,
  FileUp,
  Edit3,
} from 'lucide-react';
import { SearchInput } from '../components/SearchInput';
import { LoadingSpinner, PageLoading } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CategoryBadge } from '../components/CategoryBadge';
import { TagInput } from '../components/TagInput';
import { MetadataEditor } from '../components/MetadataEditor';
import { JsonEditor } from '../components/JsonEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditorTab = 'general' | 'prompt' | 'brain' | 'routing' | 'rules' | 'settings' | 'test';

interface TransferRule {
  condition: string;
  targetAgentId: string;
  message: string;
}

interface HandoffConfig {
  triggers: string[];
  maxTurns: number;
  confidenceThreshold: number;
}

interface TestMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: { key: EditorTab; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'כללי', icon: Settings },
  { key: 'prompt', label: 'פרומפט מערכת', icon: FileText },
  { key: 'brain', label: 'מוח / ידע', icon: BookOpen },
  { key: 'routing', label: 'ניתוב', icon: Route },
  { key: 'rules', label: 'כללים', icon: ShieldCheck },
  { key: 'settings', label: 'הגדרות', icon: Settings },
  { key: 'test', label: 'בדיקה', icon: FlaskConical },
];

const HANDOFF_TRIGGER_OPTIONS = [
  { value: 'frustration', label: 'תסכול לקוח' },
  { value: 'repeated_question', label: 'שאלה חוזרת' },
  { value: 'explicit_request', label: 'בקשה מפורשת' },
  { value: 'low_confidence', label: 'ביטחון נמוך' },
];

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const LANGUAGE_OPTIONS = [
  { value: 'Hebrew', label: 'עברית' },
  { value: 'English', label: 'אנגלית' },
  { value: 'Arabic', label: 'ערבית' },
];

const PROMPT_TEMPLATES: { label: string; content: string }[] = [
  {
    label: 'מכירות',
    content: `אתה סוכן מכירות מקצועי של {companyName}. תפקידך לעזור ללקוחות פוטנציאליים להבין את המוצרים והשירותים שלנו, לענות על שאלות, ולהוביל אותם לרכישה.

כללים:
- היה ידידותי ומקצועי
- הדגש את היתרונות של המוצר
- ענה על התנגדויות בצורה חיובית
- הצע תמיד צעד הבא ברור
- פנה ללקוח בשמו: {contactName}
- ערוץ תקשורת: {channel}`,
  },
  {
    label: 'תמיכה',
    content: `אתה סוכן תמיכה טכנית של {companyName}. תפקידך לעזור ללקוחות לפתור בעיות, לענות על שאלות טכניות, ולהבטיח שביעות רצון.

כללים:
- הבן את הבעיה לעומק לפני שאתה מציע פתרון
- תן הוראות צעד-אחר-צעד
- אם אינך יכול לפתור, העבר לנציג אנושי
- פנה ללקוח בשמו: {contactName}
- ערוץ תקשורת: {channel}`,
  },
  {
    label: 'שיעור ניסיון',
    content: `אתה סוכן לתיאום שיעורי ניסיון ב-{companyName}. תפקידך לעזור ללקוחות לקבוע שיעור ניסיון, לספר על התוכניות, ולענות על שאלות.

כללים:
- הצע מועדים זמינים
- הסבר מה כולל שיעור הניסיון
- אסוף פרטי קשר
- שלח אישור לאחר קביעת מועד
- פנה ללקוח בשמו: {contactName}
- ערוץ תקשורת: {channel}`,
  },
  {
    label: 'כללי',
    content: `אתה סוכן AI של {companyName}. תפקידך לעזור ללקוחות ולענות על שאלותיהם.

כללים:
- היה ידידותי ומועיל
- ענה בצורה ברורה ותמציתית
- אם אינך יודע את התשובה, אמור זאת בכנות
- פנה ללקוח בשמו: {contactName}
- ערוץ תקשורת: {channel}`,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultForm(): FormState {
  return {
    name: '',
    description: '',
    active: true,
    isDefault: false,
    language: 'Hebrew',
    systemPrompt: '',
    routingKeywords: [] as string[],
    routingDescription: '',
    handoff: { triggers: [], maxTurns: 20, confidenceThreshold: 0.3 },
    transfers: [] as TransferRule[],
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0.7,
    maxTokens: 500,
  };
}

type FormState = {
  name: string;
  description: string;
  active: boolean;
  isDefault: boolean;
  language: string;
  systemPrompt: string;
  routingKeywords: string[];
  routingDescription: string;
  handoff: HandoffConfig;
  transfers: TransferRule[];
  model: string;
  temperature: number;
  maxTokens: number;
};

function agentToForm(agent: CustomAgentWithBrain): FormState {
  const ho = agent.handoffRules as Partial<HandoffConfig> | undefined;
  const tr = agent.transferRules as { rules?: TransferRule[] } | undefined;
  return {
    name: agent.name,
    description: agent.description ?? '',
    active: agent.active,
    isDefault: agent.isDefault,
    language: agent.settings?.language ?? 'Hebrew',
    systemPrompt: agent.systemPrompt ?? '',
    routingKeywords: agent.routingKeywords ?? [],
    routingDescription: agent.routingDescription ?? '',
    handoff: {
      triggers: (ho?.triggers as string[]) ?? [],
      maxTurns: ho?.maxTurns ?? 10,
      confidenceThreshold: ho?.confidenceThreshold ?? 0.5,
    },
    transfers: (tr?.rules as TransferRule[]) ?? [],
    model: agent.settings?.model ?? 'claude-sonnet-4-5-20250929',
    temperature: agent.settings?.temperature ?? 0.7,
    maxTokens: agent.settings?.maxTokens ?? 500,
  };
}

function formToPayload(form: FormState) {
  return {
    name: form.name,
    description: form.description || null,
    systemPrompt: form.systemPrompt || null,
    routingKeywords: form.routingKeywords,
    routingDescription: form.routingDescription || null,
    handoffRules: {
      triggers: form.handoff.triggers,
      maxTurns: form.handoff.maxTurns,
      confidenceThreshold: form.handoff.confidenceThreshold,
    },
    transferRules: { rules: form.transfers },
    settings: {
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      language: form.language,
      model: form.model,
    },
    isDefault: form.isDefault,
    active: form.active,
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AgentBuilder() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [search, setSearch] = useState('');
  const { data: agentsData, isLoading } = useCustomAgents();
  const actions = useCustomAgentActions();

  const agents = agentsData?.agents ?? [];
  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreateNew = async () => {
    try {
      const created = await actions.create.mutateAsync({
        name: 'סוכן חדש',
        description: 'תיאור הסוכן',
        settings: { temperature: 0.7, maxTokens: 500, language: 'Hebrew', model: 'claude-sonnet-4-5-20250929' },
      });
      setEditingId(created.id);
      toast.success('סוכן חדש נוצר');
    } catch {
      toast.error('שגיאה ביצירת סוכן');
    }
  };

  const handleToggleActive = async (agent: CustomAgent) => {
    try {
      if (agent.active) {
        await actions.deactivate.mutateAsync(agent.id);
        toast.success(`${agent.name} הושבת`);
      } else {
        await actions.activate.mutateAsync(agent.id);
        toast.success(`${agent.name} הופעל`);
      }
    } catch {
      toast.error('שגיאה בעדכון סטטוס');
    }
  };

  const handleDuplicate = async (agent: CustomAgent) => {
    try {
      await actions.duplicate.mutateAsync(agent.id);
      toast.success(`${agent.name} שוכפל`);
    } catch {
      toast.error('שגיאה בשכפול');
    }
  };

  if (isLoading) return <PageLoading />;

  if (editingId || creatingNew) {
    return (
      <AgentEditor
        agentId={editingId}
        onBack={() => {
          setEditingId(null);
          setCreatingNew(false);
        }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">בונה סוכנים</h1>
        <button
          onClick={handleCreateNew}
          disabled={actions.create.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus size={16} />
          סוכן חדש +
        </button>
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder="חיפוש סוכן..." />

      {/* Agent Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="אין סוכנים"
          description={search ? 'לא נמצאו סוכנים התואמים לחיפוש' : 'צור סוכן חדש כדי להתחיל'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => setEditingId(agent.id)}
              onToggleActive={() => handleToggleActive(agent)}
              onDuplicate={() => handleDuplicate(agent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Card
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  onEdit,
  onToggleActive,
  onDuplicate,
}: {
  agent: CustomAgent;
  onEdit: () => void;
  onToggleActive: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div
      onClick={onEdit}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-primary-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 truncate">{agent.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {agent.isDefault && (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <Star size={10} />
              ברירת מחדל
            </span>
          )}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              agent.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
            )}
          >
            {agent.active ? 'פעיל' : 'לא פעיל'}
          </span>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{agent.description}</p>
      )}

      {/* Keywords */}
      {agent.routingKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.routingKeywords.slice(0, 5).map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
            >
              <Tag size={8} />
              {kw}
            </span>
          ))}
          {agent.routingKeywords.length > 5 && (
            <span className="text-[10px] text-gray-400">+{agent.routingKeywords.length - 5}</span>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          עודכן {new Date(agent.updatedAt).toLocaleDateString('he-IL')}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleActive}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              agent.active
                ? 'text-green-600 hover:bg-green-50'
                : 'text-gray-400 hover:bg-gray-50',
            )}
            title={agent.active ? 'השבת' : 'הפעל'}
          >
            <Power size={14} />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="שכפל"
          >
            <Copy size={14} />
          </button>
          <ArrowRight
            size={14}
            className="text-gray-400 group-hover:text-primary-500 transition-colors mr-1"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Editor
// ---------------------------------------------------------------------------

function AgentEditor({ agentId, onBack }: { agentId: string | null; onBack: () => void }) {
  const { data: agentData, isLoading } = useCustomAgent(agentId);
  const actions = useCustomAgentActions();
  const { data: allAgentsData } = useCustomAgents();
  const [tab, setTab] = useState<EditorTab>('general');
  const [form, setForm] = useState<FormState>(buildDefaultForm);
  const [loaded, setLoaded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Load form when agent data arrives
  useEffect(() => {
    if (agentData && !loaded) {
      setForm(agentToForm(agentData));
      setLoaded(true);
    }
  }, [agentData, loaded]);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    if (!agentId) return;
    if (!form.name.trim()) {
      toast.error('שם הסוכן הוא שדה חובה');
      return;
    }
    try {
      await actions.update.mutateAsync({ id: agentId, ...formToPayload(form) });
      toast.success('הסוכן נשמר בהצלחה');
    } catch {
      toast.error('שגיאה בשמירת הסוכן');
    }
  };

  const handleSaveAndActivate = async () => {
    if (!agentId) return;
    if (!form.name.trim()) {
      toast.error('שם הסוכן הוא שדה חובה');
      return;
    }
    try {
      await actions.update.mutateAsync({ id: agentId, ...formToPayload(form) });
      await actions.activate.mutateAsync(agentId);
      updateField('active', true);
      toast.success('הסוכן נשמר והופעל');
    } catch {
      toast.error('שגיאה בשמירה/הפעלה');
    }
  };

  const handleDelete = async () => {
    if (!agentId) return;
    try {
      await actions.remove.mutateAsync(agentId);
      toast.success('הסוכן נמחק');
      onBack();
    } catch {
      toast.error('שגיאה במחיקת הסוכן');
    }
  };

  const handleDuplicate = async () => {
    if (!agentId) return;
    try {
      await actions.duplicate.mutateAsync(agentId);
      toast.success('הסוכן שוכפל');
      onBack();
    } catch {
      toast.error('שגיאה בשכפול');
    }
  };

  if (isLoading || !loaded) return <PageLoading />;

  const allAgents = allAgentsData?.agents ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowRight size={18} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{form.name || 'סוכן חדש'}</h1>
          {form.active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              פעיל
            </span>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap',
                tab === t.key
                  ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50',
              )}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'general' && <GeneralTab form={form} updateField={updateField} />}
        {tab === 'prompt' && <PromptTab form={form} updateField={updateField} agentId={agentId} agentData={agentData} />}
        {tab === 'brain' && agentId && <BrainTab agentId={agentId} />}
        {tab === 'routing' && <RoutingTab form={form} updateField={updateField} />}
        {tab === 'rules' && (
          <RulesTab form={form} updateField={updateField} allAgents={allAgents} />
        )}
        {tab === 'settings' && <SettingsTab form={form} updateField={updateField} />}
        {tab === 'test' && agentId && <TestTab agentId={agentId} />}
      </div>

      {/* Bottom bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={actions.update.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save size={14} />
          {actions.update.isPending ? 'שומר...' : 'שמור'}
        </button>
        <button
          onClick={handleSaveAndActivate}
          disabled={actions.update.isPending || actions.activate.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Power size={14} />
          שמור והפעל
        </button>
        <button
          onClick={handleDuplicate}
          disabled={actions.duplicate.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          <Copy size={14} />
          שכפל
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setDeleteOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
        >
          <Trash2 size={14} />
          מחק
        </button>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          חזור
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="מחיקת סוכן"
        description={`האם אתה בטוח שברצונך למחוק את הסוכן "${form.name}"? פעולה זו אינה ניתנת לביטול.`}
        confirmLabel="מחק"
        onConfirm={() => {
          setDeleteOpen(false);
          handleDelete();
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: General
// ---------------------------------------------------------------------------

function GeneralTab({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">פרטים כלליים</h2>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">שם הסוכן *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="לדוגמה: סוכן מכירות"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">תיאור</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            placeholder="תיאור קצר של תפקיד הסוכן..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Language */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">שפה</label>
          <select
            value={form.language}
            onChange={(e) => updateField('language', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">סוכן פעיל</p>
            <p className="text-xs text-gray-400">הסוכן יהיה זמין לשיחות</p>
          </div>
          <ToggleSwitch
            checked={form.active}
            onChange={(v) => updateField('active', v)}
          />
        </div>

        {/* Default toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">סוכן ברירת מחדל</p>
            <p className="text-xs text-gray-400">יופעל כאשר אין סוכן מתאים אחר</p>
          </div>
          <ToggleSwitch
            checked={form.isDefault}
            onChange={(v) => updateField('isDefault', v)}
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: System Prompt
// ---------------------------------------------------------------------------

function PromptTab({
  form,
  updateField,
  agentId,
  agentData,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  agentId: string | null;
  agentData: import('../lib/types').CustomAgentWithBrain | undefined;
}) {
  const actions = useCustomAgentActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const documentFilename = agentData?.mainDocumentFilename || null;
  const hasDocument = !!documentFilename;

  const handleUpload = async (file: File) => {
    if (!agentId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await actions.uploadDocument.mutateAsync({ agentId, formData });
      toast.success(`הקובץ "${file.name}" הועלה בהצלחה`);
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = async () => {
    if (!agentId) return;
    try {
      await actions.removeDocument.mutateAsync(agentId);
      toast.success('המסמך הוסר');
    } catch {
      toast.error('שגיאה בהסרת המסמך');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">פרומפט מערכת</h2>
          <span className="text-xs text-gray-400">{form.systemPrompt.length} תווים</span>
        </div>

        {/* Template presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center">תבניות:</span>
          {PROMPT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              onClick={() => updateField('systemPrompt', tpl.content)}
              className="px-3 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              {tpl.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={form.systemPrompt}
          onChange={(e) => updateField('systemPrompt', e.target.value)}
          rows={16}
          placeholder="כתוב כאן את הוראות המערכת לסוכן..."
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y font-mono leading-relaxed"
          dir="rtl"
        />

        {/* Variable hints */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">משתנים זמינים:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { var: '{companyName}', desc: 'שם החברה' },
              { var: '{contactName}', desc: 'שם הלקוח' },
              { var: '{channel}', desc: 'ערוץ תקשורת' },
            ].map((v) => (
              <span
                key={v.var}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded font-mono"
              >
                <Hash size={10} className="text-gray-400" />
                {v.var}
                <span className="text-gray-400 font-sans">- {v.desc}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Main Document Upload */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">מסמך מרכזי</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              העלה קובץ (txt, pdf, docx) שמתאר מי הסוכן. התוכן נכנס אוטומטית לפרומפט.
            </p>
          </div>
        </div>

        {hasDocument ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <FileText size={18} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 truncate">{documentFilename}</p>
              <p className="text-xs text-green-600">
                {agentData?.mainDocumentText?.length?.toLocaleString()} תווים
              </p>
            </div>
            <button
              onClick={handleRemoveDocument}
              disabled={actions.removeDocument.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={12} />
              הסר
            </button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
              uploading
                ? 'border-primary-300 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            )}
          >
            {uploading ? (
              <LoadingSpinner size={24} />
            ) : (
              <FileUp size={28} className="text-gray-400" />
            )}
            <p className="text-sm text-gray-500">
              {uploading ? 'מעלה...' : 'גרור קובץ לכאן או לחץ לבחירה'}
            </p>
            <p className="text-xs text-gray-400">txt, pdf, docx (עד 10MB)</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Brain (per-agent knowledge base)
// ---------------------------------------------------------------------------

const BRAIN_CATEGORIES = [
  { value: 'general', label: 'כללי' },
  { value: 'product', label: 'מוצר' },
  { value: 'policy', label: 'מדיניות' },
  { value: 'faq', label: 'שאלות נפוצות' },
  { value: 'script', label: 'תסריט' },
];

function BrainTab({ agentId }: { agentId: string }) {
  const { data: brainData, isLoading } = useAgentBrain(agentId);
  const actions = useBrainActions(agentId);
  const [editingEntry, setEditingEntry] = useState<BrainEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportValue, setJsonImportValue] = useState('');
  const [jsonImportError, setJsonImportError] = useState('');

  const entries = brainData?.entries ?? [];

  const handleCreate = async (data: { title: string; content: string; category: string; metadata: Record<string, any> }) => {
    try {
      await actions.create.mutateAsync({
        ...data,
        sortOrder: entries.length,
      });
      setIsCreating(false);
      toast.success('פריט ידע נוצר בהצלחה');
    } catch {
      toast.error('שגיאה ביצירת פריט ידע');
    }
  };

  const handleUpdate = async (id: string, data: Partial<{ title: string; content: string; category: string; metadata: Record<string, any>; active: boolean }>) => {
    try {
      await actions.update.mutateAsync({ id, ...data });
      setEditingEntry(null);
      toast.success('פריט ידע עודכן');
    } catch {
      toast.error('שגיאה בעדכון פריט ידע');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await actions.remove.mutateAsync(id);
      toast.success('פריט ידע נמחק');
    } catch {
      toast.error('שגיאה במחיקת פריט ידע');
    }
  };

  const handleToggleActive = async (entry: BrainEntry) => {
    await handleUpdate(entry.id, { active: !entry.active });
  };

  const handleExportJson = () => {
    const exportData = entries.map(({ title, content, category, metadata, active, sortOrder }) => ({
      title,
      content,
      category,
      metadata,
      active,
      sortOrder,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brain-entries-${agentId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('ייצוא הושלם');
  };

  const handleImportJson = async () => {
    setJsonImportError('');
    try {
      const parsed = JSON.parse(jsonImportValue);
      if (!Array.isArray(parsed)) {
        setJsonImportError('JSON חייב להיות מערך של פריטי ידע');
        return;
      }
      for (const item of parsed) {
        if (!item.title || !item.content) {
          setJsonImportError('כל פריט חייב לכלול title ו-content');
          return;
        }
      }
      let imported = 0;
      for (const item of parsed) {
        await actions.create.mutateAsync({
          title: item.title,
          content: item.content,
          category: item.category ?? 'general',
          metadata: item.metadata ?? {},
          sortOrder: entries.length + imported,
        });
        imported++;
      }
      setShowJsonImport(false);
      setJsonImportValue('');
      toast.success(`${imported} פריטי ידע יובאו בהצלחה`);
    } catch {
      setJsonImportError('JSON לא תקין');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            בסיס הידע של הסוכן ({entries.length} פריטים)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              disabled={entries.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <Upload size={12} />
              ייצוא JSON
            </button>
            <button
              onClick={() => setShowJsonImport(!showJsonImport)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FileUp size={12} />
              ייבוא JSON
            </button>
            <button
              onClick={() => { setIsCreating(true); setEditingEntry(null); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              <Plus size={12} />
              פריט ידע חדש
            </button>
          </div>
        </div>

        {/* JSON Import panel */}
        {showJsonImport && (
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
            <h3 className="text-xs font-semibold text-gray-700">ייבוא פריטי ידע מ-JSON</h3>
            <JsonEditor
              value={jsonImportValue}
              onChange={(v) => { setJsonImportValue(v); setJsonImportError(''); }}
              error={jsonImportError}
              label=""
            />
            <p className="text-[10px] text-gray-400">
              פורמט: מערך JSON של אובייקטים עם title, content, category (אופציונלי), metadata (אופציונלי)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportJson}
                disabled={!jsonImportValue.trim() || actions.create.isPending}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <FileUp size={14} />
                {actions.create.isPending ? 'מייבא...' : 'ייבא'}
              </button>
              <button
                onClick={() => { setShowJsonImport(false); setJsonImportValue(''); setJsonImportError(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Create / Edit form */}
        {(isCreating || editingEntry) && (
          <BrainEntryForm
            entry={editingEntry}
            onSave={(data) => {
              if (editingEntry) {
                handleUpdate(editingEntry.id, data);
              } else {
                handleCreate(data as { title: string; content: string; category: string; metadata: Record<string, any> });
              }
            }}
            onCancel={() => { setIsCreating(false); setEditingEntry(null); }}
            isPending={actions.create.isPending || actions.update.isPending}
          />
        )}

        {/* Entries list */}
        {entries.length === 0 && !isCreating ? (
          <div className="text-center py-8">
            <BookOpen size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">אין תוכן ידע לסוכן זה</p>
            <p className="text-xs text-gray-300 mt-1">הוסף פריטי ידע כדי לבנות את המוח של הסוכן</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  entry.active
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-gray-50/50 border-gray-100 opacity-60'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                      <CategoryBadge category={entry.category} />
                      {!entry.active && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">
                          לא פעיל
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-line">{entry.content}</p>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(entry.metadata).map(([key, value]) => (
                          <span key={key} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                    <button
                      onClick={() => handleToggleActive(entry)}
                      className={cn(
                        'p-1 rounded transition-colors',
                        entry.active
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      )}
                      title={entry.active ? 'השבת' : 'הפעל'}
                    >
                      <Power size={12} />
                    </button>
                    <button
                      onClick={() => { setEditingEntry(entry); setIsCreating(false); }}
                      className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="ערוך"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="מחק"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brain Entry Form (create/edit)
// ---------------------------------------------------------------------------

function BrainEntryForm({
  entry,
  onSave,
  onCancel,
  isPending,
}: {
  entry: BrainEntry | null;
  onSave: (data: { title: string; content: string; category: string; metadata: Record<string, any> }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [category, setCategory] = useState(entry?.category ?? 'general');
  const [metadata, setMetadata] = useState<Record<string, unknown>>(
    entry?.metadata && Object.keys(entry.metadata).length > 0 ? { ...entry.metadata } : {},
  );

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('כותרת ותוכן הם שדות חובה');
      return;
    }

    onSave({ title: title.trim(), content: content.trim(), category, metadata: metadata as Record<string, any> });
  };

  return (
    <div className="mb-4 p-4 bg-primary-50/50 border border-primary-200 rounded-lg space-y-3">
      <h3 className="text-xs font-semibold text-primary-700">
        {entry ? 'עריכת פריט ידע' : 'פריט ידע חדש'}
      </h3>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">כותרת *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לדוגמה: חוג מוזיקה"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">קטגוריה</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {BRAIN_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">תוכן *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="כתוב את תוכן הידע כאן..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
          dir="rtl"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">מטה-דאטה</label>
        <MetadataEditor metadata={metadata} onChange={setMetadata} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save size={14} />
          {isPending ? 'שומר...' : entry ? 'עדכן' : 'צור'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Routing
// ---------------------------------------------------------------------------

function RoutingTab({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">מילות מפתח לניתוב</h2>

        <TagInput
          tags={form.routingKeywords}
          onChange={(tags) => updateField('routingKeywords', tags)}
          placeholder="הוסף מילת מפתח..."
          duplicateMessage="מילת מפתח כבר קיימת"
        />

        {form.routingKeywords.length === 0 && (
          <p className="text-xs text-gray-400">אין מילות מפתח. הוסף מילים שיעזרו לנתב שיחות לסוכן זה.</p>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">תיאור ניתוב</h2>
        <textarea
          value={form.routingDescription}
          onChange={(e) => updateField('routingDescription', e.target.value)}
          rows={4}
          placeholder="תאר באילו מקרים יש לנתב שיחות לסוכן זה..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Rules
// ---------------------------------------------------------------------------

function RulesTab({
  form,
  updateField,
  allAgents,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  allAgents: CustomAgent[];
}) {
  const toggleTrigger = (trigger: string) => {
    const current = form.handoff.triggers;
    const next = current.includes(trigger)
      ? current.filter((t) => t !== trigger)
      : [...current, trigger];
    updateField('handoff', { ...form.handoff, triggers: next });
  };

  const addTransferRule = () => {
    updateField('transfers', [
      ...form.transfers,
      { condition: '', targetAgentId: '', message: '' },
    ]);
  };

  const updateTransferRule = (index: number, field: keyof TransferRule, value: string) => {
    const next = [...form.transfers];
    next[index] = { ...next[index], [field]: value };
    updateField('transfers', next);
  };

  const removeTransferRule = (index: number) => {
    updateField(
      'transfers',
      form.transfers.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="max-w-2xl space-y-4">
      {/* Handoff rules */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">כללי העברה לנציג (Handoff)</h2>

        {/* Triggers */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">טריגרים להעברה</label>
          <div className="grid grid-cols-2 gap-2">
            {HANDOFF_TRIGGER_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                  form.handoff.triggers.includes(opt.value)
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-200 hover:bg-gray-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={form.handoff.triggers.includes(opt.value)}
                  onChange={() => toggleTrigger(opt.value)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Max turns */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">מקסימום תורות</label>
            <span className="text-xs font-semibold text-gray-700">{form.handoff.maxTurns}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={form.handoff.maxTurns}
            onChange={(e) =>
              updateField('handoff', { ...form.handoff, maxTurns: Number(e.target.value) })
            }
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        {/* Confidence threshold */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">סף ביטחון</label>
            <span className="text-xs font-semibold text-gray-700">
              {form.handoff.confidenceThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={form.handoff.confidenceThreshold}
            onChange={(e) =>
              updateField('handoff', {
                ...form.handoff,
                confidenceThreshold: Number(e.target.value),
              })
            }
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span>1</span>
          </div>
        </div>
      </section>

      {/* Transfer rules */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">כללי העברה לסוכן אחר (Transfer)</h2>
          <button
            onClick={addTransferRule}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <Plus size={12} />
            הוסף כלל
          </button>
        </div>

        {form.transfers.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            אין כללי העברה. הוסף כלל כדי להעביר שיחות לסוכנים אחרים בתנאים מסוימים.
          </p>
        ) : (
          <div className="space-y-3">
            {form.transfers.map((rule, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4 space-y-3 relative">
                <button
                  onClick={() => removeTransferRule(i)}
                  className="absolute top-2 left-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <X size={14} />
                </button>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">תנאי</label>
                  <input
                    type="text"
                    value={rule.condition}
                    onChange={(e) => updateTransferRule(i, 'condition', e.target.value)}
                    placeholder="לדוגמה: הלקוח מבקש תמיכה טכנית"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">סוכן יעד</label>
                  <select
                    value={rule.targetAgentId}
                    onChange={(e) => updateTransferRule(i, 'targetAgentId', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">בחר סוכן...</option>
                    {allAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">הודעת העברה</label>
                  <input
                    type="text"
                    value={rule.message}
                    onChange={(e) => updateTransferRule(i, 'message', e.target.value)}
                    placeholder="ההודעה שתוצג ללקוח בעת ההעברה"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Settings
// ---------------------------------------------------------------------------

function SettingsTab({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">הגדרות מודל</h2>

        {/* Model */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">מודל</label>
          <select
            value={form.model}
            onChange={(e) => updateField('model', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">טמפרטורה (Temperature)</label>
            <span className="text-xs font-semibold text-gray-700">{form.temperature.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={form.temperature}
            onChange={(e) => updateField('temperature', Number(e.target.value))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0 (מדויק)</span>
            <span>2 (יצירתי)</span>
          </div>
        </div>

        {/* Max tokens */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">מקסימום טוקנים</label>
            <span className="text-xs font-semibold text-gray-700">{form.maxTokens}</span>
          </div>
          <input
            type="range"
            min={100}
            max={4000}
            step={100}
            value={form.maxTokens}
            onChange={(e) => updateField('maxTokens', Number(e.target.value))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>100</span>
            <span>4000</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Test
// ---------------------------------------------------------------------------

function TestTab({ agentId }: { agentId: string }) {
  const testMutation = useAgentTest(agentId);
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: TestMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const res = await testMutation.mutateAsync(text);
      const botMsg: TestMessage = { role: 'assistant', content: res.response };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      toast.error('שגיאה בשליחת הודעת בדיקה');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <div className="max-w-2xl">
      <section className="bg-white rounded-xl border border-gray-200 flex flex-col h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FlaskConical size={14} />
            בדיקת סוכן
          </h2>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw size={12} />
            אפס
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">שלח הודעה כדי לבדוק את הסוכן</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn('flex', msg.role === 'user' ? 'justify-start' : 'justify-end')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-gray-100 text-gray-900'
                    : 'bg-primary-500 text-white',
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {testMutation.isPending && (
            <div className="flex justify-end">
              <div className="bg-primary-100 rounded-lg px-4 py-2">
                <LoadingSpinner size={16} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="כתוב הודעת בדיקה..."
              disabled={testMutation.isPending}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || testMutation.isPending}
              className="flex items-center justify-center w-9 h-9 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary-600' : 'bg-gray-300',
      )}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{
          position: 'absolute',
          insetInlineStart: checked ? '1.375rem' : '0.25rem',
          transition: 'inset-inline-start 150ms ease-in-out',
        }}
      />
    </button>
  );
}
