import { useCustomAgents } from '../../../hooks/useCustomAgents';

interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
}

export function TransferAgentEditor({ config, onChange }: EditorProps) {
  const { data: agentsData, isLoading } = useCustomAgents({ active: true });
  const agents = agentsData?.agents ?? [];

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">סוכן יעד</label>
        {isLoading ? (
          <div className="text-sm text-gray-400">טוען סוכנים...</div>
        ) : (
          <select
            value={(config.targetAgentId as string) || ''}
            onChange={(e) => set('targetAgentId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">בחר סוכן...</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">הודעת העברה</label>
        <textarea
          value={(config.message as string) || ''}
          onChange={(e) => set('message', e.target.value)}
          placeholder="הערה פנימית לסוכן המקבל..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
