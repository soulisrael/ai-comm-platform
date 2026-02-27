import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { TRIGGER_OPTIONS, type TriggerOption } from '../flow-types';

interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

export function TriggerEditor({ config, onChange, nodeId }: EditorProps) {
  const [copied, setCopied] = useState(false);
  const selected = (config.triggerType as string) || 'message_received';

  function select(opt: TriggerOption) {
    onChange({ ...config, triggerType: opt.type });
  }

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  function copyUrl() {
    const url = `${window.location.origin}/api/webhooks/flow/${nodeId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">סוג טריגר</label>

      <div className="space-y-2">
        {TRIGGER_OPTIONS.map((opt) => {
          const isSelected = selected === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => select(opt)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border-2 text-right transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-xl flex-shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.description}</div>
              </div>
              {isSelected && (
                <Check size={18} className="text-blue-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Keyword input */}
      {selected === 'keyword' && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            מילות מפתח (מופרדות בפסיק)
          </label>
          <input
            type="text"
            value={(config.keywords as string) || ''}
            onChange={(e) => set('keywords', e.target.value)}
            placeholder="מכירות, מחיר, הצעה"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Schedule / Cron input */}
      {selected === 'schedule' && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">ביטוי Cron</label>
          <input
            type="text"
            value={(config.cron as string) || ''}
            onChange={(e) => set('cron', e.target.value)}
            dir="ltr"
            placeholder="0 9 * * 1-5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1 dir-ltr">דקות שעה יום חודש יום-בשבוע</p>
        </div>
      )}

      {/* Webhook URL */}
      {selected === 'webhook_trigger' && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={`${window.location.origin}/api/webhooks/flow/${nodeId}`}
              readOnly
              dir="ltr"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={copyUrl}
              className="flex-shrink-0 px-2 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
