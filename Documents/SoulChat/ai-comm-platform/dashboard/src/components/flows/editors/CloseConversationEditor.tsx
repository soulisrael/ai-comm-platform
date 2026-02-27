interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

export function CloseConversationEditor({ config, onChange }: EditorProps) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-700">
          סגירת השיחה תשלח הודעת סיום ללקוח ותעביר את השיחה לסטטוס "סגור".
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הודעת סגירה</label>
        <textarea
          value={(config.closingMessage as string) || ''}
          onChange={(e) => set('closingMessage', e.target.value)}
          placeholder="תודה שפנית אלינו!"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
