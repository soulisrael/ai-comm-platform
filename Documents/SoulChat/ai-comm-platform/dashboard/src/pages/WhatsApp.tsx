import { useState } from 'react';
import {
  Wifi, WifiOff, AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp,
  Plus, Send, Info, Settings, MessageSquare, BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useWaConfig, useWaTemplates, useWhatsAppActions } from '../hooks/useWhatsApp';
import { PageLoading } from '../components/LoadingSpinner';
import { TabsNav } from '../components/TabsNav';
import toast from 'react-hot-toast';
import type { WaConnectionStatus, WaTemplate } from '../lib/types';
import { cn } from '../lib/utils';

// ---------- Constants ----------

const STATUS_MAP: Record<WaConnectionStatus, { label: string; color: string; Icon: typeof Wifi }> = {
  connected: { label: 'מחובר', color: 'text-green-600 bg-green-50', Icon: Wifi },
  disconnected: { label: 'מנותק', color: 'text-gray-500 bg-gray-50', Icon: WifiOff },
  error: { label: 'שגיאה', color: 'text-red-600 bg-red-50', Icon: AlertTriangle },
};

const TABS = [
  { key: 'connection', label: 'חיבור', icon: Wifi },
  { key: 'templates', label: 'תבניות', icon: MessageSquare },
  { key: 'settings', label: 'הגדרות', icon: Settings },
  { key: 'stats', label: 'סטטיסטיקס', icon: BarChart3 },
];

const CATEGORY_LABELS: Record<string, string> = {
  marketing: 'שיווק',
  utility: 'שירות',
  authentication: 'אימות',
};

// ---------- Main Component ----------

export function WhatsApp() {
  const { data: config, isLoading: loadingConfig } = useWaConfig();
  const { data: templatesData, isLoading: loadingTemplates } = useWaTemplates();
  const { updateConfig, testConnection, sendTest, createTemplate } = useWhatsAppActions();

  const [activeTab, setActiveTab] = useState('connection');

  if (loadingConfig) return <PageLoading />;

  const status = config?.status || 'disconnected';
  const templates = templatesData?.templates || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">WhatsApp</h1>
      <TabsNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'connection' && (
        <ConnectionTab
          config={config}
          status={status}
          updateConfig={updateConfig}
          testConnection={testConnection}
          sendTest={sendTest}
        />
      )}
      {activeTab === 'templates' && (
        <TemplatesTab
          templates={templates}
          loading={loadingTemplates}
          createTemplate={createTemplate}
        />
      )}
      {activeTab === 'settings' && <SettingsTab config={config} updateConfig={updateConfig} />}
      {activeTab === 'stats' && <StatsTab />}
    </div>
  );
}

// ---------- Connection Tab ----------

function ConnectionTab({
  config,
  status,
  updateConfig,
  testConnection,
  sendTest,
}: {
  config: any;
  status: WaConnectionStatus;
  updateConfig: any;
  testConnection: any;
  sendTest: any;
}) {
  const statusInfo = STATUS_MAP[status];
  const [form, setForm] = useState({
    phoneNumberId: config?.phoneNumberId || '',
    wabaId: config?.wabaId || '',
    accessToken: config?.accessToken || '',
    verifyToken: config?.verifyToken || '',
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const webhookUrl = 'https://your-domain.com/api/webhooks/whatsapp';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig.mutateAsync(form);
      toast.success('הגדרות נשמרו');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
    }
  };

  const handleTest = async () => {
    try {
      const result = await testConnection.mutateAsync();
      if (result.success) toast.success(result.message || 'החיבור תקין');
      else toast.error(result.message || 'החיבור נכשל');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בבדיקה');
    }
  };

  const handleSendTest = async () => {
    if (!testPhone) return;
    try {
      await sendTest.mutateAsync({ to: testPhone, message: 'הודעת בדיקה מהמערכת' });
      toast.success('הודעת בדיקה נשלחה');
      setShowTestDialog(false);
      setTestPhone('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשליחה');
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('הועתק');
  };

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${statusInfo.color}`}>
              <statusInfo.Icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">סטטוס חיבור</p>
              <p className="text-lg font-semibold" style={{ color: status === 'connected' ? '#16a34a' : status === 'error' ? '#dc2626' : '#6b7280' }}>
                {statusInfo.label}
              </p>
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
              onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WABA ID</label>
            <input
              type="text"
              value={form.wabaId}
              onChange={e => setForm(f => ({ ...f, wabaId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
            <input
              type="password"
              value={form.accessToken}
              onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token</label>
            <input
              type="text"
              value={form.verifyToken}
              onChange={e => setForm(f => ({ ...f, verifyToken: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
        </div>

        {/* Webhook URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
              dir="ltr"
            />
            <button type="button" onClick={copyWebhook} className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
              <Copy size={16} />
            </button>
          </div>
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
          <button
            type="button"
            onClick={() => setShowTestDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100"
          >
            <Send size={14} />
            שלח הודעת בדיקה
          </button>
        </div>
      </form>

      {/* Send test dialog */}
      {showTestDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">שלח הודעת בדיקה</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מספר טלפון</label>
              <input
                type="text"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="972501234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                dir="ltr"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTestDialog(false)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">ביטול</button>
              <button
                onClick={handleSendTest}
                disabled={!testPhone || sendTest.isPending}
                className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {sendTest.isPending ? 'שולח...' : 'שלח'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection instructions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>הוראות חיבור</span>
          {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showInstructions && (
          <div className="px-5 pb-5 space-y-2 text-sm text-gray-600">
            <p>1. היכנסו ל-developers.facebook.com</p>
            <p>2. צרו App חדש (Enterprise)</p>
            <p>3. הוסיפו WhatsApp כשירות</p>
            <p>4. העתיקו Phone Number ID ו-WABA ID</p>
            <p>5. צרו System User + Permanent Token</p>
            <p>6. הדביקו את ה-Webhook URL בהגדרות ה-App</p>
            <p>7. לחצו "בדוק חיבור"</p>
          </div>
        )}
      </div>

      {/* Service window info */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-semibold">חלון שירות WhatsApp</p>
            <p>כשלקוח שולח הודעה נפתח חלון 24 שעות.</p>
            <p>בתוך החלון: הודעות חופשיות (חינם)</p>
            <p>מחוץ לחלון: רק templates (בתשלום)</p>
            <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
              <p><span className="font-medium">Marketing</span> — תמיד בתשלום</p>
              <p><span className="font-medium">Utility בחלון</span> — חינם</p>
              <p><span className="font-medium">Service (תשובות) בחלון</span> — חינם</p>
            </div>
            <p className="mt-2 text-blue-700 font-medium">CTWA Ads → חלון 72h + הכל חינם</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Templates Tab ----------

function TemplatesTab({
  templates,
  loading,
  createTemplate,
}: {
  templates: WaTemplate[];
  loading: boolean;
  createTemplate: any;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [previewTpl, setPreviewTpl] = useState<WaTemplate | null>(null);
  const [form, setForm] = useState({
    templateName: '',
    category: 'utility',
    language: 'he',
    content: '',
    header: null as Record<string, unknown> | null,
    footer: '',
    buttons: [] as Record<string, unknown>[],
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTemplate.mutateAsync({
        templateName: form.templateName,
        category: form.category,
        language: form.language,
        content: form.content,
        header: form.header,
        footer: form.footer || null,
        buttons: form.buttons,
      });
      toast.success('תבנית נוצרה');
      setShowCreate(false);
      setForm({ templateName: '', category: 'utility', language: 'he', content: '', header: null, footer: '', buttons: [] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה ביצירה');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">תבניות הודעה ({templates.length})</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
        >
          <Plus size={14} />
          תבנית חדשה
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם (אנגלית, lowercase)</label>
              <input
                type="text"
                value={form.templateName}
                onChange={e => setForm(f => ({ ...f, templateName: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="welcome_message"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="marketing">שיווק (Marketing)</option>
                <option value="utility">שירות (Utility)</option>
                <option value="authentication">אימות (Authentication)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שפה</label>
              <select
                value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="he">עברית</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תוכן ההודעה</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={4}
              placeholder={'שלום {{1}},\nתודה שפנית אלינו. {{2}}'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
            <p className="text-xs text-gray-400 mt-1">{'השתמשו ב-{{1}} {{2}} למשתנים'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Header (אופציונלי)</label>
              <select
                value={form.header ? 'text' : 'none'}
                onChange={e => setForm(f => ({ ...f, header: e.target.value === 'none' ? null : { type: e.target.value } }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="none">ללא</option>
                <option value="text">טקסט</option>
                <option value="image">תמונה</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Footer (אופציונלי)</label>
              <input
                type="text"
                value={form.footer}
                onChange={e => setForm(f => ({ ...f, footer: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="הודעה זו נשלחה אוטומטית"
              />
            </div>
          </div>

          {/* Preview */}
          {form.content && (
            <div className="flex justify-center">
              <TemplatePreview content={form.content} footer={form.footer} />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createTemplate.isPending}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {createTemplate.isPending ? 'יוצר...' : 'צור תבנית'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Templates list */}
      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-400">טוען...</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare size={32} className="mx-auto mb-2 text-gray-300" />
            <p>אין תבניות</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map(tpl => (
              <div
                key={tpl.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                onClick={() => setPreviewTpl(previewTpl?.id === tpl.id ? null : tpl)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{tpl.templateName}</p>
                  <p className="text-xs text-gray-500">
                    {CATEGORY_LABELS[tpl.category] || tpl.category} · {tpl.language}
                  </p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  tpl.metaStatus === 'APPROVED' ? 'bg-green-100 text-green-700'
                    : tpl.metaStatus === 'REJECTED' ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                )}>
                  {tpl.metaStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview panel */}
      {previewTpl && (
        <div className="flex justify-center">
          <TemplatePreview content={previewTpl.content} footer={previewTpl.footer || undefined} />
        </div>
      )}
    </div>
  );
}

// ---------- Template Preview (WhatsApp bubble) ----------

function TemplatePreview({ content, footer }: { content: string; footer?: string }) {
  return (
    <div className="w-72 bg-gray-100 rounded-xl p-4">
      <div className="bg-green-100 rounded-lg p-3 text-sm text-gray-900 whitespace-pre-wrap" dir="rtl">
        {content}
        {footer && (
          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-green-200">{footer}</p>
        )}
      </div>
      <p className="text-[10px] text-gray-400 text-left mt-1" dir="ltr">12:00</p>
    </div>
  );
}

// ---------- Settings Tab ----------

function SettingsTab({ config, updateConfig }: { config: any; updateConfig: any }) {
  const settings = config?.settings || {};
  const [autoResponse, setAutoResponse] = useState<boolean>(settings.autoResponse ?? true);
  const [batchDelay, setBatchDelay] = useState<number>(settings.batchDelay ?? 3);
  const [offHoursMsg, setOffHoursMsg] = useState<string>(settings.offHoursMessage ?? 'תודה שפנית אלינו! כרגע אנחנו לא זמינים. נחזור אליך בהקדם.');
  const [welcomeMsg, setWelcomeMsg] = useState<string>(settings.welcomeMessage ?? 'שלום! ברוכים הבאים. איך נוכל לעזור?');
  const [hoursStart, setHoursStart] = useState<string>(settings.businessHoursStart ?? '09:00');
  const [hoursEnd, setHoursEnd] = useState<string>(settings.businessHoursEnd ?? '18:00');

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync({
        settings: {
          ...settings,
          autoResponse,
          batchDelay,
          offHoursMessage: offHoursMsg,
          welcomeMessage: welcomeMsg,
          businessHoursStart: hoursStart,
          businessHoursEnd: hoursEnd,
        },
      });
      toast.success('הגדרות נשמרו');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        {/* Auto response */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">מענה אוטומטי</p>
            <p className="text-xs text-gray-500">סוכן AI עונה על הודעות נכנסות</p>
          </div>
          <button
            onClick={() => setAutoResponse(!autoResponse)}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              autoResponse ? 'bg-primary-600' : 'bg-gray-300',
            )}
          >
            <span className={cn(
              'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
              autoResponse ? 'right-0.5' : 'left-0.5',
            )} />
          </button>
        </div>

        {/* Batch delay */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900">Batch delay</p>
            <span className="text-sm text-gray-600" dir="ltr">{batchDelay}s</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={batchDelay}
            onChange={e => setBatchDelay(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400" dir="ltr">
            <span>1s</span>
            <span>10s</span>
          </div>
        </div>

        {/* Business hours */}
        <div>
          <p className="text-sm font-medium text-gray-900 mb-2">שעות פעילות</p>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={hoursStart}
              onChange={e => setHoursStart(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-gray-400">—</span>
            <input
              type="time"
              value={hoursEnd}
              onChange={e => setHoursEnd(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Off-hours message */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">הודעת "מחוץ לשעות פעילות"</label>
          <textarea
            value={offHoursMsg}
            onChange={e => setOffHoursMsg(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        {/* Welcome message */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">הודעת ברוכים הבאים (לקוח חדש)</label>
          <textarea
            value={welcomeMsg}
            onChange={e => setWelcomeMsg(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {updateConfig.isPending ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </div>
    </div>
  );
}

// ---------- Stats Tab ----------

// TODO: Replace with real API data when available
const MOCK_DAILY_DATA = [
  { day: 'א', sent: 45, received: 62 },
  { day: 'ב', sent: 38, received: 55 },
  { day: 'ג', sent: 52, received: 71 },
  { day: 'ד', sent: 41, received: 48 },
  { day: 'ה', sent: 67, received: 83 },
  { day: 'ו', sent: 23, received: 30 },
  { day: 'ש', sent: 5, received: 12 },
];

function StatsTab() {
  // TODO: Replace with real API
  const stats = {
    sentToday: 67,
    receivedToday: 83,
    sentWeek: 271,
    receivedWeek: 361,
    sentMonth: 1120,
    receivedMonth: 1480,
    marketing: 85,
    utility: 420,
    service: 615,
    estimatedCost: 42.50,
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="נשלחו היום" value={stats.sentToday} />
        <StatCard label="התקבלו היום" value={stats.receivedToday} />
        <StatCard label="נשלחו השבוע" value={stats.sentWeek} />
        <StatCard label="התקבלו השבוע" value={stats.receivedWeek} />
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">חלוקה לפי קטגוריה</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.marketing}</p>
            <p className="text-xs text-gray-500">שיווק</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.utility}</p>
            <p className="text-xs text-gray-500">שירות</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.service}</p>
            <p className="text-xs text-gray-500">תשובות</p>
          </div>
        </div>
      </div>

      {/* Cost estimate */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-2">עלות מוערכת החודש</h3>
        <p className="text-3xl font-bold text-gray-900" dir="ltr">
          ₪{stats.estimatedCost.toFixed(2)}
        </p>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">הודעות לפי יום</h3>
        <div style={{ width: '100%', height: 260 }} dir="ltr">
          <ResponsiveContainer>
            <BarChart data={MOCK_DAILY_DATA}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <RechartsTooltip />
              <Bar dataKey="received" name="התקבלו" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sent" name="נשלחו" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
