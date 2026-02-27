interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

const UNIT_OPTIONS = [
  { value: 'minutes', label: '\u05D3\u05E7\u05D5\u05EA' },
  { value: 'hours', label: '\u05E9\u05E2\u05D5\u05EA' },
  { value: 'days', label: '\u05D9\u05DE\u05D9\u05DD' },
];

const NO_REPLY_OPTIONS = [
  { value: 'send_reminder', label: '\u05E9\u05DC\u05D7 \u05EA\u05D6\u05DB\u05D5\u05E8\u05EA' },
  { value: 'next_step', label: '\u05D4\u05DE\u05E9\u05DA \u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0' },
  { value: 'close', label: '\u05E1\u05D2\u05D5\u05E8 \u05E9\u05D9\u05D7\u05D4' },
];

export function WaitReplyEditor({ config, onChange }: EditorProps) {
  const timeValue = (config.timeValue as number) ?? 5;
  const timeUnit = (config.timeUnit as string) || 'minutes';
  const noReplyAction = (config.noReplyAction as string) || 'next_step';

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      {/* Time input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">\u05D6\u05DE\u05DF \u05D4\u05DE\u05EA\u05E0\u05D4</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="number"
              min={1}
              value={timeValue}
              onChange={(e) => set('timeValue', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <select
              value={timeUnit}
              onChange={(e) => set('timeUnit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* No reply action */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">\u05D0\u05DD \u05DC\u05D0 \u05E2\u05E0\u05D4:</label>
        <div className="space-y-2">
          {NO_REPLY_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="noReplyAction"
                value={opt.value}
                checked={noReplyAction === opt.value}
                onChange={() => set('noReplyAction', opt.value)}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reminder message */}
      {noReplyAction === 'send_reminder' && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">\u05D4\u05D5\u05D3\u05E2\u05EA \u05EA\u05D6\u05DB\u05D5\u05E8\u05EA</label>
          <textarea
            rows={3}
            value={(config.reminderMessage as string) || ''}
            onChange={(e) => set('reminderMessage', e.target.value)}
            placeholder="\u05D4\u05D9\u05D9, \u05E8\u05E6\u05D9\u05E0\u05D5 \u05DC\u05D5\u05D5\u05D3\u05D0 \u05E9\u05E7\u05D9\u05D1\u05DC\u05EA \u05D0\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05E9\u05DC\u05E0\u05D5..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
}
