import { X } from 'lucide-react';
import type { Node } from 'reactflow';
import {
  PALETTE_CATEGORIES,
  type FlowNodeData,
  type FlowNodeType,
  type ContentBlock,
  type MessageButton,
  isTriggerNode,
} from './flow-types';

/* ─── Editor imports ─── */
import { TriggerEditor } from './editors/TriggerEditor';
import { SendMessageEditor } from './editors/SendMessageEditor';
import { SendTemplateEditor } from './editors/SendTemplateEditor';
import { AiAgentEditor } from './editors/AiAgentEditor';
import { TagUpdateEditor } from './editors/TagUpdateEditor';
import { HttpRequestEditor } from './editors/HttpRequestEditor';
import { TransferAgentEditor } from './editors/TransferAgentEditor';
import { HumanHandoffEditor } from './editors/HumanHandoffEditor';
import { CloseConversationEditor } from './editors/CloseConversationEditor';
import { ConditionEditor } from './editors/ConditionEditor';
import { WaitReplyEditor } from './editors/WaitReplyEditor';
import { DelayEditor } from './editors/DelayEditor';
import { CheckWindowEditor } from './editors/CheckWindowEditor';

/* ─── Props ─── */

export interface FlowSidebarProps {
  selectedNode: Node<FlowNodeData> | null;
  onDeselectNode: () => void;
  onAddNode: (type: FlowNodeType) => void;
  onNodeConfigChange: (config: Record<string, unknown>) => void;
  onContentBlocksChange?: (blocks: ContentBlock[]) => void;
  onButtonsChange?: (buttons: MessageButton[]) => void;
}

/* ─── Component ─── */

export function FlowSidebar({
  selectedNode,
  onDeselectNode,
  onAddNode,
  onNodeConfigChange,
  onContentBlocksChange,
  onButtonsChange,
}: FlowSidebarProps) {
  /* ─── Mode 2: Edit Node ─── */
  if (selectedNode) {
    const { nodeType, label, icon } = selectedNode.data;

    return (
      <div className="w-[380px] bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">{icon}</span>
            <h3 className="text-sm font-semibold text-gray-800 truncate">{label}</h3>
          </div>
          <button
            onClick={onDeselectNode}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-5">
          {renderEditor(
            nodeType,
            selectedNode.data.config,
            onNodeConfigChange,
            selectedNode.id,
            selectedNode.data.contentBlocks,
            selectedNode.data.buttons,
            onContentBlocksChange,
            onButtonsChange,
          )}
        </div>
      </div>
    );
  }

  /* ─── Mode 1: Add Step ─── */
  return (
    <div className="w-[380px] bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">הוסף צעד</h3>
        <p className="text-xs text-gray-400 mt-0.5">בחר רכיב להוספה ל-Flow</p>
      </div>

      {/* Categorized list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {PALETTE_CATEGORIES.map((category) => (
          <div key={category.name}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm">{category.icon}</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {category.name}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-1.5">
              {category.items.map((item) => (
                <button
                  key={item.type}
                  onClick={() => onAddNode(item.type)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm transition-all text-right group"
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ backgroundColor: item.color + '15' }}
                  >
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-400 leading-tight mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Editor Renderer ─── */

function renderEditor(
  nodeType: FlowNodeType,
  config: Record<string, unknown>,
  onChange: (config: Record<string, unknown>) => void,
  nodeId: string,
  contentBlocks?: ContentBlock[],
  buttons?: MessageButton[],
  onContentBlocksChange?: (blocks: ContentBlock[]) => void,
  onButtonsChange?: (buttons: MessageButton[]) => void,
) {
  const editorProps = { config, onChange, nodeId };

  // Trigger types all share the same editor
  if (isTriggerNode(nodeType)) {
    return <TriggerEditor {...editorProps} />;
  }

  switch (nodeType) {
    case 'send_message':
      return (
        <SendMessageEditor
          {...editorProps}
          contentBlocks={contentBlocks ?? []}
          buttons={buttons ?? []}
          onContentBlocksChange={onContentBlocksChange ?? (() => {})}
          onButtonsChange={onButtonsChange ?? (() => {})}
        />
      );
    case 'send_template':
      return <SendTemplateEditor {...editorProps} />;
    case 'ai_agent':
      return <AiAgentEditor {...editorProps} />;
    case 'tag_update':
      return <TagUpdateEditor {...editorProps} />;
    case 'http_request':
      return <HttpRequestEditor {...editorProps} />;
    case 'transfer_agent':
      return <TransferAgentEditor {...editorProps} />;
    case 'human_handoff':
      return <HumanHandoffEditor {...editorProps} />;
    case 'close_conversation':
    case 'close':
      return <CloseConversationEditor {...editorProps} />;
    case 'condition':
      return <ConditionEditor {...editorProps} />;
    case 'wait_reply':
      return <WaitReplyEditor {...editorProps} />;
    case 'delay':
      return <DelayEditor {...editorProps} />;
    case 'check_window':
      return <CheckWindowEditor {...editorProps} />;
    default:
      return (
        <p className="text-sm text-gray-500 italic">
          אין הגדרות נוספות עבור רכיב זה
        </p>
      );
  }
}
