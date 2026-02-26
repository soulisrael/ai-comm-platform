import { useState } from 'react';
import {
  Plus, Trash2, Edit3, Users, Shield, Bell, Mail, Volume2,
  Activity, Clock, MessageSquare, Check, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTeamMembers, useTeamActions } from '../hooks/useTeam';
import { useCustomAgents } from '../hooks/useCustomAgents';
import { PageLoading } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import type { TeamMember, TeamRole, TeamStatus } from '../lib/types';
import { cn } from '../lib/utils';

// ---------- Constants ----------

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: 'מנהל',
  manager: 'מנהל צוות',
  agent: 'נציג',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  agent: 'bg-gray-100 text-gray-700',
};

const STATUS_LABELS: Record<TeamStatus, string> = {
  online: 'מחובר',
  away: 'לא זמין',
  busy: 'עסוק',
  offline: 'מנותק',
};

const STATUS_DOT: Record<TeamStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-orange-500',
  offline: 'bg-gray-400',
};

const STATUS_COLORS: Record<TeamStatus, string> = {
  online: 'bg-green-100 text-green-700',
  away: 'bg-yellow-100 text-yellow-700',
  busy: 'bg-orange-100 text-orange-700',
  offline: 'bg-gray-100 text-gray-500',
};

const ASSIGNMENT_MODES = [
  { key: 'round_robin', label: 'סיבובי', desc: 'חלוקה שווה בין הנציגים' },
  { key: 'least_busy', label: 'הכי פנוי', desc: 'מקצה לנציג עם הכי פחות שיחות' },
  { key: 'manual', label: 'ידני', desc: 'מנהל מקצה ידנית' },
] as const;

// ---------- Main Component ----------

export function Team() {
  const { data, isLoading } = useTeamMembers();
  const { create, update, remove, updateStatus } = useTeamActions();
  const { data: agentsData } = useCustomAgents({ active: true });
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<string>('round_robin');

  if (isLoading) return <PageLoading />;

  const members = data?.members || [];
  const agents = agentsData?.agents || [];
  const onlineCount = members.filter(m => m.status === 'online').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">ניהול צוות</h1>
        <button
          onClick={() => { setShowCreate(true); setEditingMember(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          <Plus size={16} />
          הוסף נציג
        </button>
      </div>

      {/* Mini dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashCard icon={Users} label="נציגים מחוברים" value={String(onlineCount)} color="text-green-600" />
        {/* TODO: Replace with real API */}
        <DashCard icon={Clock} label="זמן תגובה ממוצע" value="2.5 דקות" color="text-blue-600" />
        <DashCard icon={Check} label="שיחות שנפתרו היום" value="18" color="text-purple-600" />
        <DashCard icon={MessageSquare} label="ממתינות לנציג" value="3" color="text-orange-600" />
      </div>

      {/* Create/Edit form */}
      {(showCreate || editingMember) && (
        <MemberEditor
          member={editingMember}
          agents={agents}
          onCreate={async (data) => {
            try {
              await create.mutateAsync(data);
              toast.success('נציג נוסף');
              setShowCreate(false);
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : 'שגיאה');
            }
          }}
          onUpdate={async (id, data) => {
            try {
              await update.mutateAsync({ id, ...data });
              toast.success('עודכן');
              setEditingMember(null);
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : 'שגיאה');
            }
          }}
          onCancel={() => { setShowCreate(false); setEditingMember(null); }}
          isPending={create.isPending || update.isPending}
        />
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-5 py-3 font-medium text-gray-600">נציג</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">אימייל</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">תפקיד</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">סטטוס</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">עומס</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">נראה לאחרונה</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                onEdit={() => { setEditingMember(member); setShowCreate(false); }}
                onRemove={async () => {
                  if (!confirm(`למחוק את ${member.name}?`)) return;
                  try {
                    await remove.mutateAsync(member.id);
                    toast.success('נציג הוסר');
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'שגיאה');
                  }
                }}
                onStatusChange={async (status) => {
                  try {
                    await updateStatus.mutateAsync({ id: member.id, status });
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'שגיאה');
                  }
                }}
              />
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  <Users size={32} className="mx-auto mb-2 text-gray-300" />
                  <p>אין חברי צוות</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Permissions table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowPermissions(!showPermissions)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Shield size={16} />
            <span>הרשאות לפי תפקיד</span>
          </div>
          {showPermissions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showPermissions && (
          <div className="px-5 pb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-right py-2 font-medium text-gray-600">תפקיד</th>
                  <th className="text-right py-2 font-medium text-gray-600">סוכנים</th>
                  <th className="text-right py-2 font-medium text-gray-600">צוות</th>
                  <th className="text-right py-2 font-medium text-gray-600">שיחות</th>
                  <th className="text-right py-2 font-medium text-gray-600">Flows</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-gray-100">
                  <td className="py-2"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> מנהל</span></td>
                  <td className="py-2">הכל</td>
                  <td className="py-2">הכל</td>
                  <td className="py-2">הכל</td>
                  <td className="py-2">הכל</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> מנהל צוות</span></td>
                  <td className="py-2">צפייה</td>
                  <td className="py-2">צפייה</td>
                  <td className="py-2">הכל</td>
                  <td className="py-2">עדכון</td>
                </tr>
                <tr>
                  <td className="py-2"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> נציג</span></td>
                  <td className="py-2 text-gray-400">—</td>
                  <td className="py-2 text-gray-400">—</td>
                  <td className="py-2">צפייה + שליטה</td>
                  <td className="py-2 text-gray-400">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auto-assignment settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Activity size={16} />
          Auto-Assignment
        </h3>
        <div className="flex gap-3">
          {ASSIGNMENT_MODES.map(mode => (
            <button
              key={mode.key}
              onClick={() => setAssignmentMode(mode.key)}
              className={cn(
                'flex-1 p-3 rounded-lg border text-sm text-right transition-colors',
                assignmentMode === mode.key
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600',
              )}
            >
              <p className="font-medium">{mode.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{mode.desc}</p>
            </button>
          ))}
        </div>

        {/* Workload bars */}
        <div className="space-y-2 mt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">עומס נציגים</p>
          {members.filter(m => m.status !== 'offline').map(member => {
            const max = member.maxConcurrentChats || 8;
            // TODO: Replace with real active chat count
            const active = Math.floor(Math.random() * (max + 1));
            const pct = Math.round((active / max) * 100);
            const barColor = pct < 50 ? 'bg-green-500' : pct < 75 ? 'bg-yellow-500' : 'bg-red-500';

            return (
              <div key={member.id} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-28 truncate">{member.name}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-10 text-left" dir="ltr">{active}/{max}</span>
              </div>
            );
          })}
          {members.filter(m => m.status !== 'offline').length === 0 && (
            <p className="text-xs text-gray-400">אין נציגים מחוברים</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Dashboard Card ----------

function DashCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-gray-50', color)}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Member Row ----------

function MemberRow({
  member,
  onEdit,
  onRemove,
  onStatusChange,
}: {
  member: TeamMember;
  onEdit: () => void;
  onRemove: () => void;
  onStatusChange: (status: TeamStatus) => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const max = member.maxConcurrentChats || 8;
  // TODO: Replace with real active chat count
  const active = Math.min(Math.floor(Math.random() * 5), max);
  const pct = Math.round((active / max) * 100);

  return (
    <tr className="hover:bg-gray-50">
      {/* Name + avatar */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <span className={cn('absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-white', STATUS_DOT[member.status])} />
          </div>
          <span className="font-medium text-gray-900">{member.name}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-gray-600">{member.email}</td>
      <td className="px-5 py-3">
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[member.role])}>
          {ROLE_LABELS[member.role]}
        </span>
      </td>
      {/* Status (clickable) */}
      <td className="px-5 py-3 relative">
        <button
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer', STATUS_COLORS[member.status])}
        >
          {STATUS_LABELS[member.status]}
        </button>
        {showStatusMenu && (
          <div className="absolute z-10 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
            {(Object.keys(STATUS_LABELS) as TeamStatus[]).map(s => (
              <button
                key={s}
                onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                className={cn(
                  'w-full text-right px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2',
                  member.status === s ? 'font-medium' : '',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[s])} />
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </td>
      {/* Workload */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', pct < 50 ? 'bg-green-500' : pct < 75 ? 'bg-yellow-500' : 'bg-red-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500" dir="ltr">{active}/{max}</span>
        </div>
      </td>
      {/* Last seen */}
      <td className="px-5 py-3 text-xs text-gray-500">
        {member.lastSeenAt ? new Date(member.lastSeenAt).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}
      </td>
      {/* Actions */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="עריכה">
            <Edit3 size={15} />
          </button>
          <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="מחיקה">
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------- Member Editor ----------

interface EditorForm {
  name: string;
  email: string;
  password: string;
  role: TeamRole;
  maxConcurrentChats: number;
  assignedAgents: string[];
  skills: string[];
  notifications: { sound: boolean; browser: boolean; emailOnHandoff: boolean };
}

function MemberEditor({
  member,
  agents,
  onCreate,
  onUpdate,
  onCancel,
  isPending,
}: {
  member: TeamMember | null;
  agents: { id: string; name: string }[];
  onCreate: (data: { name: string; email: string; password: string; role: TeamRole }) => Promise<void>;
  onUpdate: (id: string, data: Partial<TeamMember>) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
}) {
  const isEdit = !!member;

  const [form, setForm] = useState<EditorForm>({
    name: member?.name || '',
    email: member?.email || '',
    password: '',
    role: member?.role || 'agent',
    maxConcurrentChats: member?.maxConcurrentChats || 8,
    assignedAgents: member?.assignedAgents || [],
    skills: member?.skills || [],
    notifications: {
      sound: (member?.settings as any)?.notifications?.sound ?? true,
      browser: (member?.settings as any)?.notifications?.browser ?? true,
      emailOnHandoff: (member?.settings as any)?.notifications?.emailOnHandoff ?? false,
    },
  });
  const [skillInput, setSkillInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && member) {
      await onUpdate(member.id, {
        name: form.name,
        role: form.role,
        maxConcurrentChats: form.maxConcurrentChats,
        assignedAgents: form.assignedAgents,
        skills: form.skills,
        settings: { notifications: form.notifications },
      } as any);
    } else {
      await onCreate({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
    }
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !form.skills.includes(skill)) {
      setForm(f => ({ ...f, skills: [...f.skills, skill] }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setForm(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }));
  };

  const toggleAgent = (agentId: string) => {
    setForm(f => ({
      ...f,
      assignedAgents: f.assignedAgents.includes(agentId)
        ? f.assignedAgents.filter(a => a !== agentId)
        : [...f.assignedAgents, agentId],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <h3 className="text-sm font-semibold text-gray-900">{isEdit ? 'עריכת נציג' : 'נציג חדש'}</h3>

      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
            disabled={isEdit}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
          />
        </div>
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
        <select
          value={form.role}
          onChange={e => setForm(f => ({ ...f, role: e.target.value as TeamRole }))}
          className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="agent">נציג — צפייה ושליטה בשיחות</option>
          <option value="manager">מנהל צוות — הכל בשיחות + צפייה</option>
          <option value="admin">מנהל — הכל</option>
        </select>
      </div>

      {/* Max concurrent chats */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">מקסימום שיחות מקביל</label>
          <span className="text-sm text-gray-600 font-mono">{form.maxConcurrentChats}</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={form.maxConcurrentChats}
          onChange={e => setForm(f => ({ ...f, maxConcurrentChats: Number(e.target.value) }))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1</span>
          <span>20</span>
        </div>
      </div>

      {/* Assigned agents */}
      {isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">סוכני AI משויכים</label>
          <div className="flex flex-wrap gap-2">
            {agents.map(agent => (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  form.assignedAgents.includes(agent.id)
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {agent.name}
              </button>
            ))}
            {agents.length === 0 && <p className="text-xs text-gray-400">אין סוכנים פעילים</p>}
          </div>
        </div>
      )}

      {/* Skills */}
      {isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">כישורים</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.skills.map(skill => (
              <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} className="text-gray-400 hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="מכירות, שירות, עברית..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button type="button" onClick={addSkill} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
              הוסף
            </button>
          </div>
        </div>
      )}

      {/* Notification settings */}
      {isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Bell size={14} />
            התראות
          </label>
          <div className="space-y-2">
            <NotificationToggle
              icon={Volume2}
              label="צליל בשיחה חדשה"
              checked={form.notifications.sound}
              onChange={v => setForm(f => ({ ...f, notifications: { ...f.notifications, sound: v } }))}
            />
            <NotificationToggle
              icon={Bell}
              label="Browser notification"
              checked={form.notifications.browser}
              onChange={v => setForm(f => ({ ...f, notifications: { ...f.notifications, browser: v } }))}
            />
            <NotificationToggle
              icon={Mail}
              label="אימייל ב-handoff"
              checked={form.notifications.emailOnHandoff}
              onChange={v => setForm(f => ({ ...f, notifications: { ...f.notifications, emailOnHandoff: v } }))}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {isPending ? 'שומר...' : isEdit ? 'עדכן' : 'צור נציג'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

// ---------- Notification Toggle ----------

function NotificationToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof Bell;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Icon size={14} className="text-gray-400" />
        {label}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-gray-300',
        )}
      >
        <span className={cn(
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'right-0.5' : 'left-0.5',
        )} />
      </button>
    </div>
  );
}
