import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../../lib/utils';
import { type FlowNodeData, NODE_ACCENT_COLORS } from '../flow-types';

export function MessageNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = NODE_ACCENT_COLORS[data.nodeType] ?? '#22c55e';

  // Build message preview from contentBlocks or config.content
  let preview = '';
  if (data.contentBlocks?.length) {
    const textBlock = data.contentBlocks.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      preview = textBlock.content.slice(0, 60);
      if (textBlock.content.length > 60) preview += '...';
    }
  } else if (data.config.content) {
    const raw = data.config.content as string;
    preview = raw.slice(0, 60);
    if (raw.length > 60) preview += '...';
  }

  const quickReplies = data.buttons?.filter((b) => b.type === 'quick_reply') ?? [];

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
          <span>&#x1F4F1;</span>
          <span>WhatsApp — שלח הודעה</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        {preview ? (
          <p className="text-sm text-gray-700 leading-snug">{preview}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">כתוב הודעה...</p>
        )}

        {/* Quick Reply buttons */}
        {quickReplies.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {quickReplies.map((btn) => (
              <span
                key={btn.id}
                className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-50 text-green-700 border border-green-200"
              >
                {btn.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Reply source handles */}
      {quickReplies.map((btn, idx) => (
        <Handle
          key={btn.id}
          type="source"
          position={Position.Bottom}
          id={`qr-${btn.id}`}
          className="!w-2.5 !h-2.5 !bg-green-400 !border-2 !border-white"
          style={{ left: `${((idx + 1) / (quickReplies.length + 2)) * 100}%` }}
        />
      ))}

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Next Step</span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="next"
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
        />
      </div>
    </div>
  );
}
