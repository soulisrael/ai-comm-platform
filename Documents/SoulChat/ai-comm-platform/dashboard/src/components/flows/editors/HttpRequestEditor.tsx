interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function HttpRequestEditor({ config, onChange }: EditorProps) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4" dir="ltr">
      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
        <select
          value={(config.method as string) || 'POST'}
          onChange={(e) => set('method', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* URL */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input
          type="text"
          value={(config.url as string) || ''}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://api.example.com/webhook"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Headers */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
        <textarea
          rows={3}
          value={(config.headers as string) || ''}
          onChange={(e) => set('headers', e.target.value)}
          placeholder='{"Authorization": "Bearer ...", "Content-Type": "application/json"}'
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Body */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Body (JSON)</label>
        <textarea
          rows={4}
          value={(config.body as string) || ''}
          onChange={(e) => set('body', e.target.value)}
          placeholder='{"key": "value"}'
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}
