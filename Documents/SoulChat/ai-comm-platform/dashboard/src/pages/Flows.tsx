import {
  useState,
  useCallback,
  useRef,
  useMemo,
  type DragEvent,
  type ReactNode,
} from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type ReactFlowInstance,
  type OnConnect,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Plus,
  Copy,
  Trash2,
  Play,
  Pause,
  Save,
  ArrowRight,
  X,
  Zap,
  LayoutTemplate,
  FlaskConical,
  ChevronLeft,
  GripVertical,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useFlows, useFlow, useFlowActions } from '../hooks/useFlows';
import { useCustomAgents } from '../hooks/useCustomAgents';
import { Badge } from '../components/Badge';
import type { Flow, FlowTriggerType } from '../lib/types';
import toast from 'react-hot-toast';

/* ─────────────────────────── Constants ─────────────────────────── */

const TRIGGER_LABELS: Record<FlowTriggerType, string> = {
  new_contact: 'איש קשר חדש',
  keyword: 'מילת מפתח',
  webhook: 'Webhook',
  manual: 'ידני',
  schedule: 'מתוזמן',
  message_received: 'הודעה נכנסת',
};

type FlowNodeType =
  | 'trigger'
  | 'ai_agent'
  | 'send_message'
  | 'wait_reply'
  | 'delay'
  | 'condition'
  | 'human_handoff'
  | 'tag_update'
  | 'http_request'
  | 'close'
  | 'transfer_agent'
  | 'check_window';

interface PaletteItem {
  type: FlowNodeType;
  label: string;
  icon: string;
  color: string;
}

const PALETTE: PaletteItem[] = [
  { type: 'trigger', label: 'טריגר', icon: '\u{1F7E2}', color: '#22c55e' },
  { type: 'ai_agent', label: 'סוכן AI', icon: '\u{1F916}', color: '#6366f1' },
  { type: 'send_message', label: 'שלח הודעה', icon: '\u{1F4AC}', color: '#3b82f6' },
  { type: 'wait_reply', label: 'המתן לתגובה', icon: '\u231B', color: '#f59e0b' },
  { type: 'delay', label: 'השהייה', icon: '\u23F1\uFE0F', color: '#8b5cf6' },
  { type: 'condition', label: 'תנאי (אם/אחרת)', icon: '\u{1F500}', color: '#ec4899' },
  { type: 'human_handoff', label: 'העבר לנציג', icon: '\u{1F464}', color: '#f97316' },
  { type: 'tag_update', label: 'תיוג / עדכון', icon: '\u{1F3F7}\uFE0F', color: '#14b8a6' },
  { type: 'http_request', label: 'בקשת HTTP', icon: '\u{1F310}', color: '#64748b' },
  { type: 'close', label: 'סגירה', icon: '\u{1F534}', color: '#ef4444' },
  { type: 'transfer_agent', label: 'העבר סוכן', icon: '\u{1F504}', color: '#0ea5e9' },
  { type: 'check_window', label: 'בדוק חלון', icon: '\u23F0', color: '#a855f7' },
];

interface FlowNodeData {
  nodeType: FlowNodeType;
  label: string;
  icon: string;
  color: string;
  config: Record<string, unknown>;
}

/* ─────────────────────── Custom Node Components ─────────────────────── */

function BaseNode({ data, selected }: NodeProps<FlowNodeData>) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border-2 shadow-sm px-4 py-3 min-w-[180px] text-center transition-shadow',
        selected ? 'shadow-lg ring-2 ring-primary-400' : '',
      )}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">{data.icon}</span>
        <span className="text-sm font-medium text-gray-800">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3" style={{ background: data.color }} />
    </div>
  );
}

function ConditionNode({ data, selected }: NodeProps<FlowNodeData>) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border-2 shadow-sm px-4 py-3 min-w-[180px] text-center transition-shadow',
        selected ? 'shadow-lg ring-2 ring-primary-400' : '',
      )}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">{data.icon}</span>
        <span className="text-sm font-medium text-gray-800">{data.label}</span>
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gray-500">
        <span>לא</span>
        <span>כן</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!w-3 !h-3"
        style={{ background: '#22c55e', left: '75%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!w-3 !h-3"
        style={{ background: '#ef4444', left: '25%' }}
      />
    </div>
  );
}

function CheckWindowNode({ data, selected }: NodeProps<FlowNodeData>) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border-2 shadow-sm px-4 py-3 min-w-[180px] text-center transition-shadow',
        selected ? 'shadow-lg ring-2 ring-primary-400' : '',
      )}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">{data.icon}</span>
        <span className="text-sm font-medium text-gray-800">{data.label}</span>
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gray-500">
        <span>סגור</span>
        <span>פתוח</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="open"
        className="!w-3 !h-3"
        style={{ background: '#22c55e', left: '75%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="closed"
        className="!w-3 !h-3"
        style={{ background: '#ef4444', left: '25%' }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: BaseNode,
  ai_agent: BaseNode,
  send_message: BaseNode,
  wait_reply: BaseNode,
  delay: BaseNode,
  condition: ConditionNode,
  human_handoff: BaseNode,
  tag_update: BaseNode,
  http_request: BaseNode,
  close: BaseNode,
  transfer_agent: BaseNode,
  check_window: CheckWindowNode,
};

/* ─────────────────────── Node Settings Panel ─────────────────────── */

function NodeSettingsPanel({
  node,
  onChange,
  onClose,
}: {
  node: Node<FlowNodeData>;
  onChange: (config: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { data: agentsData } = useCustomAgents({ active: true });
  const agents = agentsData?.agents ?? [];
  const config = node.data.config;

  const update = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  const renderFields = (): ReactNode => {
    switch (node.data.nodeType) {
      case 'trigger':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">סוג טריגר</label>
            <select
              value={(config.triggerType as string) ?? 'message_received'}
              onChange={(e) => update('triggerType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {config.triggerType === 'keyword' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">מילות מפתח (מופרדות בפסיק)</label>
                <input
                  value={(config.keywords as string) ?? ''}
                  onChange={(e) => update('keywords', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="מכירות, מחיר, הצעה"
                />
              </div>
            )}
            {config.triggerType === 'schedule' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cron</label>
                <input
                  value={(config.cron as string) ?? ''}
                  onChange={(e) => update('cron', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  dir="ltr"
                  placeholder="0 9 * * 1-5"
                />
              </div>
            )}
          </>
        );

      case 'ai_agent':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">סוכן</label>
            <select
              value={(config.agentId as string) ?? ''}
              onChange={(e) => update('agentId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">בחר סוכן...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">זמן המתנה מקסימלי (שניות)</label>
              <input
                type="number"
                value={(config.timeout as number) ?? 120}
                onChange={(e) => update('timeout', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                dir="ltr"
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">מקסימום סבבים</label>
              <input
                type="number"
                value={(config.maxTurns as number) ?? 10}
                onChange={(e) => update('maxTurns', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                dir="ltr"
              />
            </div>
          </>
        );

      case 'send_message':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">תוכן ההודעה</label>
            <textarea
              value={(config.content as string) ?? ''}
              onChange={(e) => update('content', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={4}
              placeholder="הקלד את ההודעה..."
            />
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="isTemplate"
                checked={(config.isTemplate as boolean) ?? false}
                onChange={(e) => update('isTemplate', e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isTemplate" className="text-sm text-gray-700">תבנית WhatsApp</label>
            </div>
            {config.isTemplate && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">שם התבנית</label>
                <input
                  value={(config.templateName as string) ?? ''}
                  onChange={(e) => update('templateName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  dir="ltr"
                />
              </div>
            )}
          </>
        );

      case 'wait_reply':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              זמן המתנה מקסימלי (דקות): {(config.timeout as number) ?? 60}
            </label>
            <input
              type="range"
              min={1}
              max={1440}
              value={(config.timeout as number) ?? 60}
              onChange={(e) => update('timeout', Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 דקה</span>
              <span>24 שעות</span>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">הודעת timeout</label>
              <input
                value={(config.timeoutMessage as string) ?? ''}
                onChange={(e) => update('timeoutMessage', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="לא קיבלנו תגובה..."
              />
            </div>
          </>
        );

      case 'delay':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">משך</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={(config.value as number) ?? 5}
                onChange={(e) => update('value', Number(e.target.value))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                dir="ltr"
                min={1}
              />
              <select
                value={(config.unit as string) ?? 'minutes'}
                onChange={(e) => update('unit', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="minutes">דקות</option>
                <option value="hours">שעות</option>
                <option value="days">ימים</option>
              </select>
            </div>
          </>
        );

      case 'condition':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">שדה</label>
            <select
              value={(config.field as string) ?? ''}
              onChange={(e) => update('field', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">בחר שדה...</option>
              <option value="message.content">תוכן הודעה</option>
              <option value="contact.tags">תגיות</option>
              <option value="context.sentiment">סנטימנט</option>
              <option value="context.leadScore">ציון ליד</option>
              <option value="context.intent">כוונה</option>
              <option value="contact.name">שם</option>
              <option value="business_hours">שעות פעילות</option>
              <option value="replied">השיב</option>
            </select>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">אופרטור</label>
              <select
                value={(config.operator as string) ?? 'contains'}
                onChange={(e) => update('operator', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="contains">מכיל</option>
                <option value="equals">שווה</option>
                <option value="greater">גדול מ-</option>
                <option value="less">קטן מ-</option>
              </select>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">ערך</label>
              <input
                value={(config.value as string) ?? ''}
                onChange={(e) => update('value', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="ערך להשוואה"
              />
            </div>
          </>
        );

      case 'http_request':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              value={(config.method as string) ?? 'POST'}
              onChange={(e) => update('method', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              dir="ltr"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                value={(config.url as string) ?? ''}
                onChange={(e) => update('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                dir="ltr"
                placeholder="https://..."
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
              <textarea
                value={(config.headers as string) ?? ''}
                onChange={(e) => update('headers', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                rows={3}
                dir="ltr"
                placeholder='{"Content-Type": "application/json"}'
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Body (JSON)</label>
              <textarea
                value={(config.body as string) ?? ''}
                onChange={(e) => update('body', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                rows={4}
                dir="ltr"
                placeholder='{"key": "value"}'
              />
            </div>
          </>
        );

      case 'check_window':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">פעולה כשהחלון סגור</label>
            <select
              value={(config.closedAction as string) ?? 'use_template'}
              onChange={(e) => update('closedAction', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="use_template">שלח תבנית</option>
              <option value="stop">עצור</option>
              <option value="queue">הכנס לתור</option>
            </select>
          </>
        );

      case 'human_handoff':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיבת ההעברה</label>
            <input
              value={(config.reason as string) ?? ''}
              onChange={(e) => update('reason', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="לקוח לא מרוצה"
            />
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">הקצה ל- (אופציונלי)</label>
              <input
                value={(config.assignTo as string) ?? ''}
                onChange={(e) => update('assignTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="מזהה נציג"
                dir="ltr"
              />
            </div>
          </>
        );

      case 'tag_update':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">פעולה</label>
            <select
              value={(config.action as string) ?? 'add_tag'}
              onChange={(e) => update('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="add_tag">הוסף תגית</option>
              <option value="remove_tag">הסר תגית</option>
              <option value="update_field">עדכן שדה</option>
            </select>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">ערך</label>
              <input
                value={(config.tagValue as string) ?? ''}
                onChange={(e) => update('tagValue', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder={config.action === 'update_field' ? 'field=value' : 'שם התגית'}
              />
            </div>
          </>
        );

      case 'transfer_agent':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">סוכן יעד</label>
            <select
              value={(config.targetAgentId as string) ?? ''}
              onChange={(e) => update('targetAgentId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">בחר סוכן...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </>
        );

      case 'close':
        return (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">הודעת סגירה (אופציונלי)</label>
            <input
              value={(config.closingMessage as string) ?? ''}
              onChange={(e) => update('closingMessage', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="תודה שפנית אלינו!"
            />
          </>
        );

      default:
        return <p className="text-sm text-gray-500">אין הגדרות לצומת זה.</p>;
    }
  };

  return (
    <div className="absolute top-0 left-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg z-20 overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <span>{node.data.icon}</span>
          <span>{node.data.label}</span>
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 space-y-1">
        {renderFields()}
      </div>
    </div>
  );
}

/* ─────────────────────── Sidebar Palette ─────────────────────── */

function Sidebar() {
  const onDragStart = useCallback((e: DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData('application/reactflow-type', item.type);
    e.dataTransfer.setData('application/reactflow-label', item.label);
    e.dataTransfer.setData('application/reactflow-icon', item.icon);
    e.dataTransfer.setData('application/reactflow-color', item.color);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="w-56 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">רכיבים</h3>
        <p className="text-xs text-gray-400 mt-0.5">גרור לקנבס</p>
      </div>
      <div className="p-2 space-y-1">
        {PALETTE.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab hover:bg-gray-50 active:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
          >
            <GripVertical size={12} className="text-gray-300 flex-shrink-0" />
            <span className="text-base">{item.icon}</span>
            <span className="text-sm text-gray-700">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── Templates Dialog ─────────────────────── */

interface TemplateDefinition {
  name: string;
  description: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  triggerType: FlowTriggerType;
}

function getTemplates(): TemplateDefinition[] {
  return [
    {
      name: 'ברוכים הבאים',
      description: 'ברכת איש קשר חדש עם סוכן AI',
      triggerType: 'new_contact',
      nodes: [
        { id: 't1', type: 'trigger', position: { x: 250, y: 0 }, data: { nodeType: 'trigger', label: 'טריגר', icon: '\u{1F7E2}', color: '#22c55e', config: { triggerType: 'new_contact' } } },
        { id: 't2', type: 'send_message', position: { x: 250, y: 120 }, data: { nodeType: 'send_message', label: 'שלח הודעה', icon: '\u{1F4AC}', color: '#3b82f6', config: { content: '\u{05E9}\u{05DC}\u{05D5}\u{05DD}! \u{05D0}\u{05D9}\u{05DA} \u{05D0}\u{05E4}\u{05E9}\u{05E8} \u{05DC}\u{05E2}\u{05D6}\u{05D5}\u{05E8}?' } } },
        { id: 't3', type: 'ai_agent', position: { x: 250, y: 240 }, data: { nodeType: 'ai_agent', label: 'סוכן AI', icon: '\u{1F916}', color: '#6366f1', config: {} } },
        { id: 't4', type: 'wait_reply', position: { x: 250, y: 360 }, data: { nodeType: 'wait_reply', label: 'המתן לתגובה', icon: '\u231B', color: '#f59e0b', config: { timeout: 60 } } },
      ],
      edges: [
        { id: 'te1', source: 't1', target: 't2', animated: true },
        { id: 'te2', source: 't2', target: 't3', animated: true },
        { id: 'te3', source: 't3', target: 't4', animated: true },
      ],
    },
    {
      name: 'מענה אוטומטי',
      description: 'תגובה אוטומטית עם בדיקת חלון שירות',
      triggerType: 'message_received',
      nodes: [
        { id: 'a1', type: 'trigger', position: { x: 250, y: 0 }, data: { nodeType: 'trigger', label: 'טריגר', icon: '\u{1F7E2}', color: '#22c55e', config: { triggerType: 'message_received' } } },
        { id: 'a2', type: 'check_window', position: { x: 250, y: 120 }, data: { nodeType: 'check_window', label: 'בדוק חלון', icon: '\u23F0', color: '#a855f7', config: {} } },
        { id: 'a3', type: 'ai_agent', position: { x: 400, y: 260 }, data: { nodeType: 'ai_agent', label: 'סוכן AI', icon: '\u{1F916}', color: '#6366f1', config: {} } },
        { id: 'a4', type: 'send_message', position: { x: 80, y: 260 }, data: { nodeType: 'send_message', label: 'שלח הודעה', icon: '\u{1F4AC}', color: '#3b82f6', config: { content: '\u{05DB}\u{05E8}\u{05D2}\u{05E2} \u{05E1}\u{05D2}\u{05D5}\u{05E8}, \u{05E0}\u{05D7}\u{05D6}\u{05D5}\u{05E8} \u{05D0}\u{05DC}\u{05D9}\u{05DA} \u{05D1}\u{05D4}\u{05E7}\u{05D3}\u{05DD}' } } },
      ],
      edges: [
        { id: 'ae1', source: 'a1', target: 'a2', animated: true },
        { id: 'ae2', source: 'a2', sourceHandle: 'open', target: 'a3', animated: true, style: { stroke: '#22c55e' } },
        { id: 'ae3', source: 'a2', sourceHandle: 'closed', target: 'a4', animated: true, style: { stroke: '#ef4444' } },
      ],
    },
    {
      name: 'סגירת ליד',
      description: 'מעקב אוטומטי עם סוכן מכירות',
      triggerType: 'message_received',
      nodes: [
        { id: 'l1', type: 'trigger', position: { x: 250, y: 0 }, data: { nodeType: 'trigger', label: 'טריגר', icon: '\u{1F7E2}', color: '#22c55e', config: { triggerType: 'message_received' } } },
        { id: 'l2', type: 'ai_agent', position: { x: 250, y: 120 }, data: { nodeType: 'ai_agent', label: 'סוכן AI', icon: '\u{1F916}', color: '#6366f1', config: {} } },
        { id: 'l3', type: 'wait_reply', position: { x: 250, y: 240 }, data: { nodeType: 'wait_reply', label: 'המתן לתגובה', icon: '\u231B', color: '#f59e0b', config: { timeout: 1440 } } },
        { id: 'l4', type: 'condition', position: { x: 250, y: 370 }, data: { nodeType: 'condition', label: 'תנאי (אם/אחרת)', icon: '\u{1F500}', color: '#ec4899', config: { field: 'replied', operator: 'equals', value: 'true' } } },
        { id: 'l5', type: 'delay', position: { x: 80, y: 510 }, data: { nodeType: 'delay', label: 'השהייה', icon: '\u23F1\uFE0F', color: '#8b5cf6', config: { value: 1, unit: 'days' } } },
        { id: 'l6', type: 'send_message', position: { x: 80, y: 630 }, data: { nodeType: 'send_message', label: 'שלח הודעה', icon: '\u{1F4AC}', color: '#3b82f6', config: { content: '\u{05E8}\u{05E6}\u{05D9}\u{05E0}\u{05D5} \u{05DC}\u{05D1}\u{05D3}\u{05D5}\u{05E7} \u{05D0}\u{05DD} \u{05D9}\u{05E9} \u{05DC}\u{05DA} \u{05E9}\u{05D0}\u{05DC}\u{05D5}\u{05EA} \u{05E0}\u{05D5}\u{05E1}\u{05E4}\u{05D5}\u{05EA}' } } },
      ],
      edges: [
        { id: 'le1', source: 'l1', target: 'l2', animated: true },
        { id: 'le2', source: 'l2', target: 'l3', animated: true },
        { id: 'le3', source: 'l3', target: 'l4', animated: true },
        { id: 'le4', source: 'l4', sourceHandle: 'no', target: 'l5', animated: true, style: { stroke: '#ef4444' } },
        { id: 'le5', source: 'l5', target: 'l6', animated: true },
      ],
    },
    {
      name: 'הסלמה',
      description: 'זיהוי תלונה והעברה לנציג אנושי',
      triggerType: 'keyword',
      nodes: [
        { id: 'e1', type: 'trigger', position: { x: 250, y: 0 }, data: { nodeType: 'trigger', label: 'טריגר', icon: '\u{1F7E2}', color: '#22c55e', config: { triggerType: 'keyword', keywords: '\u{05EA}\u{05DC}\u{05D5}\u{05E0}\u{05D4}' } } },
        { id: 'e2', type: 'ai_agent', position: { x: 250, y: 120 }, data: { nodeType: 'ai_agent', label: 'סוכן AI', icon: '\u{1F916}', color: '#6366f1', config: {} } },
        { id: 'e3', type: 'condition', position: { x: 250, y: 260 }, data: { nodeType: 'condition', label: 'תנאי (אם/אחרת)', icon: '\u{1F500}', color: '#ec4899', config: { field: 'context.sentiment', operator: 'less', value: '0.3' } } },
        { id: 'e4', type: 'human_handoff', position: { x: 400, y: 410 }, data: { nodeType: 'human_handoff', label: 'העבר לנציג', icon: '\u{1F464}', color: '#f97316', config: { reason: '\u{05E1}\u{05E0}\u{05D8}\u{05D9}\u{05DE}\u{05E0}\u{05D8} \u{05E9}\u{05DC}\u{05D9}\u{05DC}\u{05D9}' } } },
      ],
      edges: [
        { id: 'ee1', source: 'e1', target: 'e2', animated: true },
        { id: 'ee2', source: 'e2', target: 'e3', animated: true },
        { id: 'ee3', source: 'e3', sourceHandle: 'yes', target: 'e4', animated: true, style: { stroke: '#22c55e' } },
      ],
    },
  ];
}

function TemplatesDialog({
  onSelect,
  onClose,
}: {
  onSelect: (template: TemplateDefinition) => void;
  onClose: () => void;
}) {
  const templates = getTemplates();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">תבניות אוטומציה</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 grid gap-3">
          {templates.map((t, i) => (
            <button
              key={i}
              onClick={() => onSelect(t)}
              className="text-right border border-gray-200 rounded-lg p-4 hover:bg-primary-50 hover:border-primary-300 transition-colors"
            >
              <div className="font-semibold text-gray-900">{t.name}</div>
              <div className="text-sm text-gray-500 mt-1">{t.description}</div>
              <Badge variant="info" size="sm" className="mt-2">
                {TRIGGER_LABELS[t.triggerType]}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Flow Editor (View 2) ─────────────────────── */

function FlowEditor({
  flow,
  onBack,
}: {
  flow: Flow | null;
  onBack: () => void;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [flowName, setFlowName] = useState(flow?.name ?? 'אוטומציה חדשה');
  const { update, remove, activate, deactivate, test } = useFlowActions();

  const initialNodes = useMemo(() => {
    if (!flow?.nodes?.length) return [] as Node<FlowNodeData>[];
    return flow.nodes as Node<FlowNodeData>[];
  }, [flow]);

  const initialEdges = useMemo(() => {
    if (!flow?.edges?.length) return [] as Edge[];
    return flow.edges as Edge[];
  }, [flow]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      let edgeStyle = {};
      const sourceHandle = params.sourceHandle;
      if (sourceHandle === 'yes' || sourceHandle === 'open') {
        edgeStyle = { stroke: '#22c55e', strokeWidth: 2 };
      } else if (sourceHandle === 'no' || sourceHandle === 'closed') {
        edgeStyle = { stroke: '#ef4444', strokeWidth: 2 };
      } else if (sourceNode) {
        edgeStyle = { stroke: (sourceNode.data as FlowNodeData).color };
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: edgeStyle,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds,
        ),
      );
    },
    [nodes, setEdges],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();

      const type = e.dataTransfer.getData('application/reactflow-type') as FlowNodeType;
      const label = e.dataTransfer.getData('application/reactflow-label');
      const icon = e.dataTransfer.getData('application/reactflow-icon');
      const color = e.dataTransfer.getData('application/reactflow-color');

      if (!type || !rfInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const newNode: Node<FlowNodeData> = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          nodeType: type,
          label,
          icon,
          color,
          config: type === 'trigger' ? { triggerType: 'message_received' } : {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [rfInstance, setNodes],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node as Node<FlowNodeData>);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeConfigChange = useCallback(
    (config: Record<string, unknown>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, config } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, config } } : null,
      );
    },
    [selectedNode, setNodes],
  );

  const handleSave = useCallback(() => {
    if (!flow) return;
    const triggerNode = nodes.find((n) => (n.data as FlowNodeData).nodeType === 'trigger');
    const triggerConfig = triggerNode
      ? ((triggerNode.data as FlowNodeData).config as Record<string, unknown>)
      : {};
    const triggerType = (triggerConfig.triggerType as FlowTriggerType) ?? flow.triggerType;

    update.mutate(
      {
        id: flow.id,
        name: flowName,
        triggerType,
        triggerConfig,
        nodes: nodes as unknown[],
        edges: edges as unknown[],
      },
      {
        onSuccess: () => toast.success('נשמר בהצלחה'),
        onError: () => toast.error('שגיאה בשמירה'),
      },
    );
  }, [flow, nodes, edges, flowName, update]);

  const handleToggleActive = useCallback(() => {
    if (!flow) return;
    if (flow.active) {
      deactivate.mutate(flow.id, {
        onSuccess: () => toast.success('האוטומציה כובתה'),
      });
    } else {
      activate.mutate(flow.id, {
        onSuccess: () => toast.success('האוטומציה הופעלה'),
      });
    }
  }, [flow, activate, deactivate]);

  const handleTest = useCallback(() => {
    if (!flow) return;
    test.mutate(flow.id, {
      onSuccess: () => toast.success('הבדיקה נשלחה'),
      onError: () => toast.error('שגיאה בבדיקה'),
    });
  }, [flow, test]);

  const handleDelete = useCallback(() => {
    if (!flow) return;
    if (!confirm('למחוק את האוטומציה?')) return;
    remove.mutate(flow.id, {
      onSuccess: () => {
        toast.success('האוטומציה נמחקה');
        onBack();
      },
    });
  }, [flow, remove, onBack]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft size={18} />
          חזרה
        </button>
        <div className="h-5 w-px bg-gray-300" />
        <input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 outline-none px-1 py-0.5 min-w-[200px]"
        />
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save size={14} />
          שמור
        </button>
        {flow && (
          <>
            <button
              onClick={handleToggleActive}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg',
                flow.active
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200',
              )}
            >
              {flow.active ? <Pause size={14} /> : <Play size={14} />}
              {flow.active ? 'כבה' : 'הפעל'}
            </button>
            <button
              onClick={handleTest}
              disabled={test.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
            >
              <FlaskConical size={14} />
              בדוק
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Right sidebar (RTL = visual right) */}
        <Sidebar />

        {/* React Flow canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            fitView
            className="bg-gray-50"
          >
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => {
                const d = n.data as FlowNodeData | undefined;
                return d?.color ?? '#ccc';
              }}
              className="!bg-white !border-gray-200"
            />
            <Background gap={16} size={1} />
          </ReactFlow>
        </div>

        {/* Node settings panel (left side for RTL) */}
        {selectedNode && (
          <NodeSettingsPanel
            node={selectedNode}
            onChange={handleNodeConfigChange}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Flow List (View 1) ─────────────────────── */

function FlowList({
  onSelectFlow,
  onCreateFlow,
}: {
  onSelectFlow: (flow: Flow) => void;
  onCreateFlow: (template?: TemplateDefinition) => void;
}) {
  const { data: flowsData, isLoading } = useFlows();
  const flows = flowsData?.flows ?? [];
  const { duplicate, remove, activate, deactivate } = useFlowActions();
  const [showTemplates, setShowTemplates] = useState(false);

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    duplicate.mutate(id, {
      onSuccess: () => toast.success('האוטומציה שוכפלה'),
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('למחוק את האוטומציה?')) return;
    remove.mutate(id, {
      onSuccess: () => toast.success('האוטומציה נמחקה'),
    });
  };

  const handleToggle = (e: React.MouseEvent, flow: Flow) => {
    e.stopPropagation();
    if (flow.active) {
      deactivate.mutate(flow.id);
    } else {
      activate.mutate(flow.id);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">אוטומציות</h1>
          <p className="text-sm text-gray-500 mt-1">בנה וניהל תהליכים אוטומטיים</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <LayoutTemplate size={16} />
            תבניות
          </button>
          <button
            onClick={() => onCreateFlow()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={16} />
            אוטומציה חדשה
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">טוען...</div>
      ) : flows.length === 0 ? (
        <div className="text-center py-16">
          <Zap size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-2">אין אוטומציות עדיין</p>
          <p className="text-sm text-gray-400">צור את האוטומציה הראשונה שלך או בחר תבנית</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => {
            const successRate =
              flow.stats.runs > 0
                ? Math.round((flow.stats.success / flow.stats.runs) * 100)
                : 0;
            return (
              <div
                key={flow.id}
                onClick={() => onSelectFlow(flow)}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{flow.name}</h3>
                    {flow.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{flow.description}</p>
                    )}
                  </div>
                  <Badge
                    variant={flow.active ? 'success' : 'default'}
                    size="sm"
                    className="mr-2 flex-shrink-0"
                  >
                    {flow.active ? 'פעיל' : 'כבוי'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="info" size="sm">
                    {TRIGGER_LABELS[flow.triggerType]}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <span>ריצות: {flow.stats.runs}</span>
                  <span>הצלחה: {successRate}%</span>
                  {flow.stats.failed > 0 && (
                    <span className="text-red-500">שגיאות: {flow.stats.failed}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleToggle(e, flow)}
                    className={cn(
                      'p-1.5 rounded',
                      flow.active
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-green-600 hover:bg-green-50',
                    )}
                    title={flow.active ? 'כבה' : 'הפעל'}
                  >
                    {flow.active ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={(e) => handleDuplicate(e, flow.id)}
                    className="p-1.5 rounded text-gray-500 hover:bg-gray-50"
                    title="שכפל"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, flow.id)}
                    className="p-1.5 rounded text-red-500 hover:bg-red-50"
                    title="מחק"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showTemplates && (
        <TemplatesDialog
          onClose={() => setShowTemplates(false)}
          onSelect={(t) => {
            setShowTemplates(false);
            onCreateFlow(t);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────── Main Page Component ─────────────────────── */

export function FlowBuilder() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const { data: flowData } = useFlow(editingFlowId);
  const { create } = useFlowActions();

  const handleSelectFlow = useCallback((flow: Flow) => {
    setEditingFlowId(flow.id);
    setView('editor');
  }, []);

  const handleCreateFlow = useCallback(
    (template?: TemplateDefinition) => {
      const base: Partial<Flow> = {
        name: template?.name ?? 'אוטומציה חדשה',
        description: template?.description ?? null,
        triggerType: template?.triggerType ?? 'message_received',
        triggerConfig: {},
        nodes: (template?.nodes ?? []) as unknown[],
        edges: (template?.edges ?? []) as unknown[],
        active: false,
      };

      create.mutate(base, {
        onSuccess: (newFlow) => {
          toast.success('האוטומציה נוצרה');
          setEditingFlowId(newFlow.id);
          setView('editor');
        },
        onError: () => toast.error('שגיאה ביצירת אוטומציה'),
      });
    },
    [create],
  );

  const handleBack = useCallback(() => {
    setEditingFlowId(null);
    setView('list');
  }, []);

  if (view === 'editor') {
    return (
      <div className="h-full">
        <FlowEditor flow={flowData ?? null} onBack={handleBack} />
      </div>
    );
  }

  return <FlowList onSelectFlow={handleSelectFlow} onCreateFlow={handleCreateFlow} />;
}

// Backward-compatible export for App.tsx
export { FlowBuilder as Flows };
