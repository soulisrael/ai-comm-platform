import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../../lib/utils';
import {
  type FlowNodeData,
  NODE_ACCENT_COLORS,
  TRIGGER_OPTIONS,
  getConfigPreview,
} from '../flow-types';

export function TriggerNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = NODE_ACCENT_COLORS[data.nodeType] ?? '#22c55e';

  // Resolve trigger label
  const triggerType = (data.config.triggerType as string) ?? data.nodeType;
  const option = TRIGGER_OPTIONS.find((o) => o.type === triggerType);
  const triggerLabel = option?.label ?? data.label;
  const triggerIcon = option?.icon ?? data.icon;

  const preview = getConfigPreview(data.nodeType, data.config);

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-md border border-gray-200 min-w-[220px] max-w-[280px] overflow-hidden transition-all',
        selected && 'ring-2 ring-blue-400 shadow-lg',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      {/* Green gradient top bar */}
      <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500" />

      {/* Header */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <span>&#x26A1;</span>
          <span>כש...</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <span>{triggerIcon}</span>
          <span>{triggerLabel}</span>
        </div>
        {preview && (
          <p className="mt-1 text-xs text-gray-500 truncate">{preview}</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Then</span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
        />
      </div>
    </div>
  );
}
