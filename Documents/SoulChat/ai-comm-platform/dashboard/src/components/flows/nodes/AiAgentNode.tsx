import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../../lib/utils';
import { type FlowNodeData, NODE_ACCENT_COLORS } from '../flow-types';

export function AiAgentNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = NODE_ACCENT_COLORS[data.nodeType] ?? '#6366f1';

  const agentName = (data.config.agentName as string) || (data.config.agentId ? `סוכן #${(data.config.agentId as string).slice(0, 6)}` : '');
  const timeout = data.config.timeout as number | undefined;
  const maxTurns = data.config.maxTurns as number | undefined;

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-md border border-gray-200 min-w-[220px] max-w-[280px] overflow-hidden transition-all',
        selected && 'ring-2 ring-blue-400 shadow-lg',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-300 !border-2 !border-white"
      />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <span>&#x1F916;</span>
          <span>סוכן AI</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        {agentName ? (
          <p className="text-sm font-semibold text-gray-800">{agentName}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">בחר סוכן...</p>
        )}

        {/* Badges */}
        {(timeout || maxTurns) && (
          <div className="mt-1.5 flex gap-1.5">
            {timeout && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-50 text-indigo-600">
                &#x23F1;&#xFE0F; {timeout}s
              </span>
            )}
            {maxTurns && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-50 text-indigo-600">
                &#x1F504; {maxTurns} סיבובים
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Next Step</span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        />
      </div>
    </div>
  );
}
