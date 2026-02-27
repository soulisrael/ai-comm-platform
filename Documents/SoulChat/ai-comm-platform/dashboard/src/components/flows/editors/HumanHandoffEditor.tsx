interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

export function HumanHandoffEditor({ config, onChange }: EditorProps) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700">
          העברה לנציג אנושי תשלח התראה לצוות ותעביר את השיחה לטיפול ידני.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">סיבת ההעברה</label>
        <textarea
          value={(config.reason as string) || ''}
          onChange={(e) => set('reason', e.target.value)}
          placeholder="הסבר את הסיבה להעברה..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">עדיפות</label>
        <select
          value={(config.priority as string) || 'medium'}
          onChange={(e) => set('priority', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="low">נמוך</option>
          <option value="medium">בינוני</option>
          <option value="high">גבוה</option>
        </select>
      </div>
    </div>
  );
}
