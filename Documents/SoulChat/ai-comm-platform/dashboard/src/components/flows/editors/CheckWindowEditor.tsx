import { Info } from 'lucide-react';

interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

const CLOSED_OPTIONS = [
  { value: 'send_template', label: '\u05E9\u05DC\u05D7 \u05EA\u05D1\u05E0\u05D9\u05EA \u05DE\u05D0\u05D5\u05E9\u05E8\u05EA' },
  { value: 'stop', label: '\u05E2\u05E6\u05D5\u05E8 \u05DC\u05DC\u05D0 \u05DC\u05E9\u05DC\u05D5\u05D7' },
  { value: 'wait', label: '\u05D4\u05DE\u05EA\u05DF \u05DC\u05D7\u05DC\u05D5\u05DF \u05D7\u05D3\u05E9' },
];

export function CheckWindowEditor({ config, onChange }: EditorProps) {
  const closedAction = (config.closedAction as string) || 'send_template';

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2 text-blue-700">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">\u05D7\u05DC\u05D5\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA 24 \u05E9\u05E2\u05D5\u05EA</p>
            <p className="text-xs text-blue-600 mt-1">
              WhatsApp \u05DE\u05D0\u05E4\u05E9\u05E8 \u05E9\u05DC\u05D9\u05D7\u05EA \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05D7\u05D5\u05E4\u05E9\u05D9\u05D5\u05EA \u05E8\u05E7 \u05D1\u05EA\u05D5\u05DA 24 \u05E9\u05E2\u05D5\u05EA
              \u05DE\u05D4\u05D5\u05D3\u05E2\u05EA \u05D4\u05DC\u05E7\u05D5\u05D7 \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4. \u05DE\u05D7\u05D5\u05E5 \u05DC\u05D7\u05DC\u05D5\u05DF \u05D9\u05E9 \u05DC\u05E9\u05DC\u05D5\u05D7 \u05E8\u05E7
              \u05EA\u05D1\u05E0\u05D9\u05D5\u05EA \u05DE\u05D0\u05D5\u05E9\u05E8\u05D5\u05EA \u05DE\u05E8\u05D0\u05E9.
            </p>
          </div>
        </div>
      </div>

      {/* Open window path */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-lg">{'\u{1F7E2}'}</span>
        <div>
          <div className="text-sm font-medium text-green-700">\u05D7\u05DC\u05D5\u05DF \u05E4\u05EA\u05D5\u05D7</div>
          <div className="text-xs text-green-600">\u05D4\u05DE\u05E9\u05DA \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05D7\u05D5\u05E4\u05E9\u05D9\u05D5\u05EA</div>
        </div>
      </div>

      {/* Closed window action */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{'\u{1F534}'}</span>
          <label className="text-sm font-medium text-gray-700">\u05D7\u05DC\u05D5\u05DF \u05E1\u05D2\u05D5\u05E8 \u2014 \u05DE\u05D4 \u05DC\u05E2\u05E9\u05D5\u05EA?</label>
        </div>
        <div className="space-y-2">
          {CLOSED_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="closedAction"
                value={opt.value}
                checked={closedAction === opt.value}
                onChange={() => set('closedAction', opt.value)}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
