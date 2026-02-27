import { Plus, X } from 'lucide-react';

interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

interface ConditionRule {
  field: string;
  operator: string;
  value: string;
}

const FIELD_OPTIONS = [
  { value: 'message.content', label: 'message.content' },
  { value: 'contact.tags', label: 'contact.tags' },
  { value: 'context.sentiment', label: 'context.sentiment' },
  { value: 'context.leadScore', label: 'context.leadScore' },
  { value: 'context.intent', label: 'context.intent' },
  { value: 'contact.name', label: 'contact.name' },
  { value: 'business_hours', label: 'business_hours' },
  { value: 'replied', label: 'replied' },
];

const OPERATOR_OPTIONS = [
  { value: 'contains', label: '\u05DE\u05DB\u05D9\u05DC' },
  { value: 'equals', label: '\u05E9\u05D5\u05D5\u05D4' },
  { value: 'greater', label: '\u05D2\u05D3\u05D5\u05DC \u05DE-' },
  { value: 'less', label: '\u05E7\u05D8\u05DF \u05DE-' },
  { value: 'not_equals', label: '\u05DC\u05D0 \u05E9\u05D5\u05D5\u05D4' },
  { value: 'exists', label: '\u05E7\u05D9\u05D9\u05DD' },
];

export function ConditionEditor({ config, onChange }: EditorProps) {
  // Support single condition (backward compat) and conditions array
  const conditions: ConditionRule[] = (config.conditions as ConditionRule[]) || [
    {
      field: (config.field as string) || '',
      operator: (config.operator as string) || 'contains',
      value: (config.value as string) || '',
    },
  ];

  function updateCondition(index: number, updates: Partial<ConditionRule>) {
    const updated = conditions.map((c, i) => (i === index ? { ...c, ...updates } : c));
    onChange({ ...config, conditions: updated });
  }

  function addCondition() {
    onChange({
      ...config,
      conditions: [...conditions, { field: '', operator: 'contains', value: '' }],
    });
  }

  function removeCondition(index: number) {
    if (conditions.length <= 1) return;
    onChange({
      ...config,
      conditions: conditions.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-800">\u05D0\u05DD:</label>

      {conditions.map((cond, index) => (
        <div key={index} className="space-y-3">
          {index > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded">AND</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-3 bg-white relative">
            {conditions.length > 1 && (
              <button
                onClick={() => removeCondition(index)}
                className="absolute top-2 left-2 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <X size={14} />
              </button>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">\u05E9\u05D3\u05D4</label>
                <select
                  value={cond.field}
                  onChange={(e) => updateCondition(index, { field: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">\u05D1\u05D7\u05E8 \u05E9\u05D3\u05D4...</option>
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">\u05D0\u05D5\u05E4\u05E8\u05D8\u05D5\u05E8</label>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(index, { operator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {OPERATOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">\u05E2\u05E8\u05DA</label>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  placeholder="\u05E2\u05E8\u05DA \u05DC\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addCondition}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        <Plus size={16} />
        <span>+ \u05D4\u05D5\u05E1\u05E3 \u05EA\u05E0\u05D0\u05D9 (AND)</span>
      </button>

      {/* Outputs preview */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">\u05D9\u05E6\u05D9\u05D0\u05D5\u05EA:</label>
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-green-600">\u2705</span>
            <span className="text-sm text-green-700">\u05DB\u05DF \u2192</span>
            <span className="text-xs text-green-500 bg-green-100 px-2 py-0.5 rounded">\u05E2\u05E0\u05E3 \u05D9\u05E8\u05D5\u05E7</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-600">\u274C</span>
            <span className="text-sm text-red-700">\u05DC\u05D0 \u2192</span>
            <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded">\u05E2\u05E0\u05E3 \u05D0\u05D3\u05D5\u05DD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
