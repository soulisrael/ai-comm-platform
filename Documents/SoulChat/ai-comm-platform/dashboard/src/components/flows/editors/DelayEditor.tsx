interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

const UNIT_OPTIONS = [
  { value: 'seconds', label: '\u05E9\u05E0\u05D9\u05D5\u05EA' },
  { value: 'minutes', label: '\u05D3\u05E7\u05D5\u05EA' },
  { value: 'hours', label: '\u05E9\u05E2\u05D5\u05EA' },
  { value: 'days', label: '\u05D9\u05DE\u05D9\u05DD' },
];

export function DelayEditor({ config, onChange }: EditorProps) {
  const value = (config.value as number) ?? 5;
  const unit = (config.unit as string) || 'minutes';

  function set(key: string, val: unknown) {
    onChange({ ...config, [key]: val });
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">\u05DE\u05E9\u05DA \u05D4\u05E9\u05D4\u05D9\u05D9\u05D4</label>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => set('value', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <select
            value={unit}
            onChange={(e) => set('unit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
