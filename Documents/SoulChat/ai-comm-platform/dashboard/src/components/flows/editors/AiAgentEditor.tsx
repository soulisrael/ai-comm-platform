import { useCustomAgents } from '../../../hooks/useCustomAgents';

interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

const ON_FINISH_OPTIONS = [
  { value: 'continue', label: '\u05D4\u05DE\u05E9\u05DA \u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0' },
  { value: 'wait_reply', label: '\u05D4\u05DE\u05EA\u05DF \u05DC\u05EA\u05E9\u05D5\u05D1\u05D4' },
  { value: 'close', label: '\u05E1\u05D2\u05D5\u05E8 \u05E9\u05D9\u05D7\u05D4' },
];

const HANDOFF_OPTIONS = [
  { value: 'customer_request', label: '\u05D4\u05DC\u05E7\u05D5\u05D7 \u05D1\u05D9\u05E7\u05E9 \u05E0\u05E6\u05D9\u05D2' },
  { value: 'negative_sentiment', label: '\u05E1\u05E0\u05D8\u05D9\u05DE\u05E0\u05D8 \u05E9\u05DC\u05D9\u05DC\u05D9' },
  { value: 'max_turns_reached', label: '\u05D4\u05D2\u05D9\u05E2 \u05DC\u05DE\u05E7\u05E1\u05D9\u05DE\u05D5\u05DD \u05E1\u05D9\u05D1\u05D5\u05D1\u05D9\u05DD' },
];

export function AiAgentEditor({ config, onChange }: EditorProps) {
  const { data: agentsData } = useCustomAgents({ active: true });
  const agents = agentsData?.agents ?? [];

  const timeout = (config.timeout as number) ?? 5;
  const maxTurns = (config.maxTurns as number) ?? 10;
  const onFinish = (config.onFinish as string) || 'continue';
  const handoffTriggers = (config.handoffTriggers as string[]) || ['customer_request'];

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  function toggleHandoff(value: string) {
    const current = [...handoffTriggers];
    const idx = current.indexOf(value);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(value);
    }
    set('handoffTriggers', current);
  }

  return (
    <div className="space-y-4">
      {/* Agent select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">\u05E1\u05D5\u05DB\u05DF AI</label>
        <select
          value={(config.agentId as string) || ''}
          onChange={(e) => set('agentId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">\u05D1\u05D7\u05E8 \u05E1\u05D5\u05DB\u05DF...</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Timeout slider */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Timeout ({timeout} \u05D3\u05E7\u05D5\u05EA)
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={timeout}
          onChange={(e) => set('timeout', Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 \u05D3\u05E7\u05D4</span>
          <span>10 \u05D3\u05E7\u05D5\u05EA</span>
        </div>
      </div>

      {/* Max turns slider */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          \u05DE\u05E7\u05E1\u05D9\u05DE\u05D5\u05DD \u05E1\u05D9\u05D1\u05D5\u05D1\u05D9\u05DD ({maxTurns})
        </label>
        <input
          type="range"
          min={1}
          max={30}
          value={maxTurns}
          onChange={(e) => set('maxTurns', Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1</span>
          <span>30</span>
        </div>
      </div>

      {/* On finish */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">\u05DB\u05E9\u05D4\u05E1\u05D5\u05DB\u05DF \u05DE\u05E1\u05D9\u05D9\u05DD:</label>
        <div className="space-y-2">
          {ON_FINISH_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="onFinish"
                value={opt.value}
                checked={onFinish === opt.value}
                onChange={() => set('onFinish', opt.value)}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Handoff triggers */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">\u05DE\u05EA\u05D9 \u05DC\u05D4\u05E2\u05D1\u05D9\u05E8 \u05DC\u05E0\u05E6\u05D9\u05D2:</label>
        <div className="space-y-2">
          {HANDOFF_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={handoffTriggers.includes(opt.value)}
                onChange={() => toggleHandoff(opt.value)}
                className="rounded text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
