interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

export function SendTemplateEditor({ config, onChange }: EditorProps) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700">
          תבניות WhatsApp חייבות להיות מאושרות מראש דרך Meta Business Manager.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">שם תבנית</label>
        <input
          type="text"
          value={(config.templateName as string) || ''}
          onChange={(e) => set('templateName', e.target.value)}
          placeholder="welcome_message"
          dir="ltr"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">שפה</label>
        <input
          type="text"
          value={(config.language as string) || 'he'}
          onChange={(e) => set('language', e.target.value)}
          dir="ltr"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">פרמטרים (JSON)</label>
        <textarea
          value={(config.parameters as string) || ''}
          onChange={(e) => set('parameters', e.target.value)}
          placeholder={'{"1": "שם הלקוח", "2": "מספר הזמנה"}'}
          rows={4}
          dir="ltr"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
