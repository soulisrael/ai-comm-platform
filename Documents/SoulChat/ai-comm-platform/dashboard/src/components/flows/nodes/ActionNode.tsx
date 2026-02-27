import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../../lib/utils';
import { type FlowNodeData, NODE_ACCENT_COLORS, getConfigPreview } from '../flow-types';

export function ActionNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = NODE_ACCENT_COLORS[data.nodeType] ?? '#3b82f6';
  const preview = getConfigPreview(data.nodeType, data.config);

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
          <span>{data.icon}</span>
          <span>{data.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        {preview ? (
          <p className="text-sm text-gray-700 truncate">{preview}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">הגדר...</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Next Step</span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-white"
          style={{ backgroundColor: accent }}
        />
      </div>
    </div>
  );
}
