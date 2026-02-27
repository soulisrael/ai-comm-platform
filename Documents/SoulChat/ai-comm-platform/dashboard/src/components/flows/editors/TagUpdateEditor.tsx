interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

const ACTION_OPTIONS = [
  { value: 'add_tag', label: '\u05D4\u05D5\u05E1\u05E3 \u05EA\u05D2\u05D9\u05EA' },
  { value: 'remove_tag', label: '\u05D4\u05E1\u05E8 \u05EA\u05D2\u05D9\u05EA' },
  { value: 'update_field', label: '\u05E2\u05D3\u05DB\u05DF \u05E9\u05D3\u05D4' },
];

export function TagUpdateEditor({ config, onChange }: EditorProps) {
  const action = (config.action as string) || 'add_tag';

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">\u05E4\u05E2\u05D5\u05DC\u05D4</label>
        <select
          value={action}
          onChange={(e) => set('action', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">\u05E2\u05E8\u05DA</label>
        <input
          type="text"
          value={(config.tagValue as string) || ''}
          onChange={(e) => set('tagValue', e.target.value)}
          placeholder={action === 'update_field' ? '\u05E9\u05DD \u05D4\u05E9\u05D3\u05D4 = \u05E2\u05E8\u05DA' : '\u05E9\u05DD \u05D4\u05EA\u05D2\u05D9\u05EA'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}
