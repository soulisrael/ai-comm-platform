import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../../lib/utils';
import { type FlowNodeData, NODE_ACCENT_COLORS } from '../flow-types';

export function ConditionNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = NODE_ACCENT_COLORS[data.nodeType] ?? '#f97316';

  const field = data.config.field as string | undefined;
  const operator = data.config.operator as string | undefined;
  const value = data.config.value as string | undefined;
  const expression = field ? `${field} ${operator ?? ''} ${value ?? ''}`.trim() : '';

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
          <span>&#x1F500;</span>
          <span>תנאי</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        {expression ? (
          <p className="text-sm text-gray-700 font-mono bg-orange-50 rounded px-2 py-1">{expression}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">הגדר תנאי...</p>
        )}
      </div>

      {/* Dual outputs */}
      <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-red-500 font-medium">&#x274C; לא</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
            style={{ position: 'relative', transform: 'none', left: 'auto', right: 'auto' }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
            style={{ position: 'relative', transform: 'none', left: 'auto', right: 'auto' }}
          />
          <span className="text-[11px] text-green-600 font-medium">&#x2705; כן</span>
        </div>
      </div>
    </div>
  );
}
