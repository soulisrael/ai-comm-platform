import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTeamMembers, useTeamActions } from '../hooks/useTeam';
import { PageLoading } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import type { TeamRole, TeamStatus } from '../lib/types';

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

const STATUS_COLORS: Record<TeamStatus, string> = {
  online: 'bg-green-100 text-green-700',
  away: 'bg-yellow-100 text-yellow-700',
  busy: 'bg-orange-100 text-orange-700',
  offline: 'bg-gray-100 text-gray-500',
};

export function Team() {
  const { data, isLoading } = useTeamMembers();
  const { create, remove, updateStatus } = useTeamActions();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' as TeamRole });

  if (isLoading) return <PageLoading />;

  const members = data?.members || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      toast.success('חבר צוות נוסף');
      setForm({ name: '', email: '', password: '', role: 'agent' });
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהוספה');
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`למחוק את ${name}?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success('חבר צוות הוסר');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה במחיקה');
    }
  };

  const handleStatusToggle = async (id: string, currentStatus: TeamStatus) => {
    const nextStatus: TeamStatus = currentStatus === 'online' ? 'offline' : 'online';
    try {
      await updateStatus.mutateAsync({ id, status: nextStatus });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">ניהול צוות</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          <Plus size={16} />
          הוסף חבר צוות
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as TeamRole }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="agent">נציג</option>
                <option value="manager">מנהל צוות</option>
                <option value="admin">מנהל</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {create.isPending ? 'שומר...' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-5 py-3 font-medium text-gray-600">שם</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">אימייל</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">תפקיד</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">סטטוס</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map(member => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{member.name}</td>
                <td className="px-5 py-3 text-gray-600">{member.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}>
                    {ROLE_LABELS[member.role]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => handleStatusToggle(member.id, member.status)}
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${STATUS_COLORS[member.status]}`}
                  >
                    {STATUS_LABELS[member.status]}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => handleRemove(member.id, member.name)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  אין חברי צוות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
