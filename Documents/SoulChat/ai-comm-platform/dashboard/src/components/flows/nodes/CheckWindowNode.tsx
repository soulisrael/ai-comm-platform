import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../../lib/utils';
import { type FlowNodeData, NODE_ACCENT_COLORS } from '../flow-types';

export function CheckWindowNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = NODE_ACCENT_COLORS[data.nodeType] ?? '#22c55e';

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
          <span>&#x23F0;</span>
          <span>בדוק חלון 24h</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        <p className="text-sm text-gray-700">בודק אם חלון השירות פתוח</p>
      </div>

      {/* Dual outputs */}
      <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-red-500 font-medium">&#x1F534; חלון סגור</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="closed"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
            style={{ position: 'relative', transform: 'none', left: 'auto', right: 'auto' }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Handle
            type="source"
            position={Position.Bottom}
            id="open"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
            style={{ position: 'relative', transform: 'none', left: 'auto', right: 'auto' }}
          />
          <span className="text-[11px] text-green-600 font-medium">&#x1F7E2; חלון פתוח</span>
        </div>
      </div>
    </div>
  );
}
