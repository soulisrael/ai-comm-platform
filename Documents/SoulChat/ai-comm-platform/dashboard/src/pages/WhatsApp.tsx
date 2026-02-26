import { useState } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useWaConfig, useWaTemplates, useWhatsAppActions } from '../hooks/useWhatsApp';
import { PageLoading } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import type { WaConnectionStatus } from '../lib/types';

const STATUS_MAP: Record<WaConnectionStatus, { label: string; color: string; Icon: typeof Wifi }> = {
  connected: { label: 'מחובר', color: 'text-green-600 bg-green-50', Icon: Wifi },
  disconnected: { label: 'מנותק', color: 'text-gray-500 bg-gray-50', Icon: WifiOff },
  error: { label: 'שגיאה', color: 'text-red-600 bg-red-50', Icon: AlertTriangle },
};

export function WhatsApp() {
  const { data: config, isLoading: loadingConfig } = useWaConfig();
  const { data: templatesData, isLoading: loadingTemplates } = useWaTemplates();
  const { updateConfig, testConnection } = useWhatsAppActions();

  const [form, setForm] = useState({
    phoneNumberId: '',
    accessToken: '',
    verifyToken: '',
  });
  const [formDirty, setFormDirty] = useState(false);

  // Sync form with config when loaded
  if (config && !formDirty) {
    const shouldSync = form.phoneNumberId !== config.phoneNumberId
      || form.accessToken !== config.accessToken
      || form.verifyToken !== config.verifyToken;
    if (shouldSync) {
      setForm({
        phoneNumberId: config.phoneNumberId || '',
        accessToken: config.accessToken || '',
        verifyToken: config.verifyToken || '',
      });
    }
  }

  if (loadingConfig) return <PageLoading />;

  const status = config?.status || 'disconnected';
  const statusInfo = STATUS_MAP[status];
  const templates = templatesData?.templates || [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig.mutateAsync(form);
      toast.success('הגדרות נשמרו');
      setFormDirty(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
    }
  };

  const handleTest = async () => {
    try {
      const result = await testConnection.mutateAsync();
      if (result.success) {
        toast.success(result.message || 'החיבור תקין');
      } else {
        toast.error(result.message || 'החיבור נכשל');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בבדיקה');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">WhatsApp</h1>

      {/* Connection status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusInfo.color}`}>
              <statusInfo.Icon size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">סטטוס חיבור</p>
              <p className="text-xs text-gray-500">{statusInfo.label}</p>
            </div>
          </div>
          {config?.businessName && (
            <span className="text-sm text-gray-600">{config.businessName}</span>
          )}
        </div>
      </div>

      {/* Config form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">הגדרות חיבור</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
            <input
              type="text"
              value={form.phoneNumberId}
              onChange={e => { setForm(f => ({ ...f, phoneNumberId: e.target.value })); setFormDirty(true); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token</label>
            <input
              type="text"
              value={form.verifyToken}
              onChange={e => { setForm(f => ({ ...f, verifyToken: e.target.value })); setFormDirty(true); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
          <input
            type="password"
            value={form.accessToken}
            onChange={e => { setForm(f => ({ ...f, accessToken: e.target.value })); setFormDirty(true); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            dir="ltr"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={updateConfig.isPending}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {updateConfig.isPending ? 'שומר...' : 'שמור הגדרות'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testConnection.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw size={14} className={testConnection.isPending ? 'animate-spin' : ''} />
            בדוק חיבור
          </button>
        </div>
      </form>

      {/* Templates list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">תבניות הודעה</h2>
        </div>
        {loadingTemplates ? (
          <div className="p-8 text-center text-gray-400">טוען...</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-gray-400">אין תבניות</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map(tpl => (
              <div key={tpl.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{tpl.templateName}</p>
                  <p className="text-xs text-gray-500">{tpl.category} - {tpl.language}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tpl.metaStatus === 'APPROVED'
                    ? 'bg-green-100 text-green-700'
                    : tpl.metaStatus === 'REJECTED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {tpl.metaStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
