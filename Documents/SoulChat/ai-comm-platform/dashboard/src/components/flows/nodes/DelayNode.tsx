import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../../lib/utils';
import { type FlowNodeData, NODE_ACCENT_COLORS } from '../flow-types';

export function DelayNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = NODE_ACCENT_COLORS[data.nodeType] ?? '#f97316';

  const value = data.config.value as number | undefined;
  const unit = (data.config.unit as string) ?? 'דקות';
  const display = value ? `${value} ${unit}` : '';

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
          <span>&#x23F1;&#xFE0F;</span>
          <span>השהייה</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        {display ? (
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{display}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">הגדר השהייה...</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Next Step</span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
        />
      </div>
    </div>
  );
}
