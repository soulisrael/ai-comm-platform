import type { Node, Edge } from 'reactflow';
import type { FlowTriggerType } from '../../lib/types';

/* ─────────────────────── Node Type Union ─────────────────────── */

export type FlowNodeType =
  | 'message_received'
  | 'new_contact'
  | 'keyword'
  | 'webhook_trigger'
  | 'schedule'
  | 'ai_agent'
  | 'send_message'
  | 'send_template'
  | 'tag_update'
  | 'http_request'
  | 'transfer_agent'
  | 'human_handoff'
  | 'close_conversation'
  | 'condition'
  | 'wait_reply'
  | 'delay'
  | 'check_window'
  // Backward-compat aliases
  | 'trigger'
  | 'close';

/* ─────────────────────── Content Blocks (for send_message) ─────────────────────── */

export interface ContentBlockText {
  id: string;
  type: 'text';
  content: string;
}

export interface ContentBlockImage {
  id: string;
  type: 'image';
  url: string;
  caption?: string;
}

export interface ContentBlockFile {
  id: string;
  type: 'file';
  url: string;
  filename?: string;
}

export interface ContentBlockDelay {
  id: string;
  type: 'delay';
  seconds: number;
}

export interface ContentBlockCollectInfo {
  id: string;
  type: 'collect_info';
  field: string; // e.g. 'email', 'phone', 'name', 'custom'
  prompt: string;
  variableName?: string;
}

export type ContentBlock =
  | ContentBlockText
  | ContentBlockImage
  | ContentBlockFile
  | ContentBlockDelay
  | ContentBlockCollectInfo;

/* ─────────────────────── Message Buttons ─────────────────────── */

export interface MessageButton {
  id: string;
  type: 'url' | 'phone' | 'quick_reply';
  text: string;
  value?: string; // URL or phone number
}

/* ─────────────────────── Node Data ─────────────────────── */

export interface FlowNodeData {
  nodeType: FlowNodeType;
  label: string;
  icon: string;
  color: string;
  config: Record<string, unknown>;
  configured?: boolean;
  // Send message specific
  contentBlocks?: ContentBlock[];
  buttons?: MessageButton[];
}

/* ─────────────────────── Palette ─────────────────────── */

export interface PaletteItem {
  type: FlowNodeType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface PaletteCategory {
  name: string;
  icon: string;
  items: PaletteItem[];
}

export const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    name: 'WhatsApp',
    icon: '\u{1F4F1}',
    items: [
      { type: 'send_message', label: '\u05E9\u05DC\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D4', description: '\u05E9\u05DC\u05D7 \u05D8\u05E7\u05E1\u05D8, \u05EA\u05DE\u05D5\u05E0\u05D4 \u05D0\u05D5 \u05E7\u05D5\u05D1\u05E5', icon: '\u{1F4AC}', color: '#22c55e' },
      { type: 'send_template', label: '\u05E9\u05DC\u05D7 \u05EA\u05D1\u05E0\u05D9\u05EA', description: '\u05E9\u05DC\u05D7 \u05EA\u05D1\u05E0\u05D9\u05EA WhatsApp \u05DE\u05D0\u05D5\u05E9\u05E8\u05EA', icon: '\u{1F4CB}', color: '#22c55e' },
      { type: 'check_window', label: '\u05D1\u05D3\u05D5\u05E7 \u05D7\u05DC\u05D5\u05DF 24h', description: '\u05D1\u05D3\u05D5\u05E7 \u05D0\u05DD \u05D7\u05DC\u05D5\u05DF \u05D4\u05E9\u05D9\u05E8\u05D5\u05EA \u05E4\u05EA\u05D5\u05D7', icon: '\u23F0', color: '#22c55e' },
    ],
  },
  {
    name: 'AI',
    icon: '\u{1F916}',
    items: [
      { type: 'ai_agent', label: '\u05E1\u05D5\u05DB\u05DF AI', description: '\u05D4\u05E4\u05E2\u05DC \u05E1\u05D5\u05DB\u05DF AI \u05DC\u05E9\u05D9\u05D7\u05D4', icon: '\u{1F916}', color: '#6366f1' },
    ],
  },
  {
    name: '\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA',
    icon: '\u2699\uFE0F',
    items: [
      { type: 'tag_update', label: '\u05E2\u05D3\u05DB\u05DF \u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8', description: '\u05D4\u05D5\u05E1\u05E3/\u05D4\u05E1\u05E8 \u05EA\u05D2\u05D9\u05D5\u05EA \u05D0\u05D5 \u05E2\u05D3\u05DB\u05DF \u05E9\u05D3\u05D5\u05EA', icon: '\u{1F3F7}\uFE0F', color: '#3b82f6' },
      { type: 'transfer_agent', label: '\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E1\u05D5\u05DB\u05DF', description: '\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E1\u05D5\u05DB\u05DF AI \u05D0\u05D7\u05E8', icon: '\u{1F504}', color: '#3b82f6' },
      { type: 'human_handoff', label: '\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E0\u05E6\u05D9\u05D2', description: '\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E0\u05E6\u05D9\u05D2 \u05D0\u05E0\u05D5\u05E9\u05D9', icon: '\u{1F64B}', color: '#3b82f6' },
      { type: 'http_request', label: 'HTTP Request', description: '\u05E9\u05DC\u05D7 \u05D1\u05E7\u05E9\u05EA HTTP', icon: '\u{1F310}', color: '#3b82f6' },
      { type: 'close_conversation', label: '\u05E1\u05D2\u05D5\u05E8 \u05E9\u05D9\u05D7\u05D4', description: '\u05E1\u05D2\u05D5\u05E8 \u05D5\u05E9\u05DC\u05D7 \u05D4\u05D5\u05D3\u05E2\u05EA \u05E1\u05D9\u05D5\u05DD', icon: '\u{1F534}', color: '#3b82f6' },
    ],
  },
  {
    name: '\u05DC\u05D5\u05D2\u05D9\u05E7\u05D4',
    icon: '\u{1F500}',
    items: [
      { type: 'condition', label: '\u05EA\u05E0\u05D0\u05D9', description: '\u05D4\u05EA\u05E0\u05D4 \u05DC\u05E4\u05D9 \u05EA\u05E0\u05D0\u05D9\u05DD', icon: '\u{1F500}', color: '#f97316' },
      { type: 'wait_reply', label: '\u05D4\u05DE\u05EA\u05DF \u05DC\u05EA\u05E9\u05D5\u05D1\u05D4', description: '\u05D7\u05DB\u05D4 \u05DC\u05EA\u05E9\u05D5\u05D1\u05EA \u05D4\u05DC\u05E7\u05D5\u05D7', icon: '\u231B', color: '#f97316' },
      { type: 'delay', label: '\u05D4\u05E9\u05D4\u05D9\u05D9\u05D4', description: '\u05D7\u05DB\u05D4 \u05DB\u05DE\u05D4 \u05D6\u05DE\u05DF \u05DC\u05E4\u05E0\u05D9 \u05D4\u05DE\u05E9\u05DA', icon: '\u23F1\uFE0F', color: '#f97316' },
    ],
  },
];

/* ─────────────────────── Flat palette (for backward compat lookups) ─────────────────────── */

export const ALL_PALETTE_ITEMS: PaletteItem[] = PALETTE_CATEGORIES.flatMap((c) => c.items);

/* ─────────────────────── Node Colors ─────────────────────── */

/** Border-left color for the ManyChat-style node card */
export const NODE_ACCENT_COLORS: Record<string, string> = {
  // Triggers — green
  message_received: '#22c55e',
  new_contact: '#22c55e',
  keyword: '#22c55e',
  webhook_trigger: '#22c55e',
  schedule: '#22c55e',
  trigger: '#22c55e',
  // WhatsApp actions — green
  send_message: '#22c55e',
  send_template: '#22c55e',
  check_window: '#22c55e',
  // AI — indigo
  ai_agent: '#6366f1',
  // Actions — blue
  tag_update: '#3b82f6',
  http_request: '#3b82f6',
  transfer_agent: '#3b82f6',
  human_handoff: '#3b82f6',
  close_conversation: '#ef4444',
  close: '#ef4444',
  // Logic — orange
  condition: '#f97316',
  wait_reply: '#f97316',
  delay: '#f97316',
};

export const NODE_BG_COLORS: Record<string, string> = {
  message_received: 'bg-green-50', new_contact: 'bg-green-50', keyword: 'bg-green-50',
  webhook_trigger: 'bg-green-50', schedule: 'bg-green-50', trigger: 'bg-green-50',
  ai_agent: 'bg-indigo-50',
  send_message: 'bg-white', send_template: 'bg-white',
  tag_update: 'bg-blue-50', http_request: 'bg-blue-50', transfer_agent: 'bg-blue-50',
  human_handoff: 'bg-blue-50', close_conversation: 'bg-red-50', close: 'bg-red-50',
  condition: 'bg-orange-50', wait_reply: 'bg-orange-50', delay: 'bg-orange-50',
  check_window: 'bg-emerald-50',
};

export const NODE_BORDER_COLORS: Record<string, string> = {
  message_received: 'border-green-400', new_contact: 'border-green-400', keyword: 'border-green-400',
  webhook_trigger: 'border-green-400', schedule: 'border-green-400', trigger: 'border-green-400',
  ai_agent: 'border-indigo-400',
  send_message: 'border-green-400', send_template: 'border-green-400',
  tag_update: 'border-blue-400', http_request: 'border-blue-400', transfer_agent: 'border-blue-400',
  human_handoff: 'border-blue-400', close_conversation: 'border-red-400', close: 'border-red-400',
  condition: 'border-orange-400', wait_reply: 'border-orange-400', delay: 'border-orange-400',
  check_window: 'border-emerald-600',
};

/* ─────────────────────── Trigger Labels ─────────────────────── */

export const TRIGGER_LABELS: Record<FlowTriggerType, string> = {
  new_contact: '\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8 \u05D7\u05D3\u05E9',
  keyword: '\u05DE\u05D9\u05DC\u05EA \u05DE\u05E4\u05EA\u05D7',
  webhook: 'Webhook',
  manual: '\u05D9\u05D3\u05E0\u05D9',
  schedule: '\u05DE\u05EA\u05D5\u05D6\u05DE\u05DF',
  message_received: '\u05D4\u05D5\u05D3\u05E2\u05D4 \u05E0\u05DB\u05E0\u05E1\u05EA',
};

/* ─────────────────────── Trigger info ─────────────────────── */

export interface TriggerOption {
  type: FlowTriggerType | 'webhook_trigger';
  label: string;
  icon: string;
  description: string;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  { type: 'message_received', label: '\u05D4\u05D5\u05D3\u05E2\u05D4 \u05E0\u05DB\u05E0\u05E1\u05EA', icon: '\u{1F4E8}', description: '\u05DB\u05E9\u05DC\u05E7\u05D5\u05D7 \u05E9\u05D5\u05DC\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D4' },
  { type: 'new_contact', label: '\u05DC\u05E7\u05D5\u05D7 \u05D7\u05D3\u05E9', icon: '\u{1F464}', description: '\u05DB\u05E9\u05DC\u05E7\u05D5\u05D7 \u05D7\u05D3\u05E9 \u05E4\u05D5\u05E0\u05D4 \u05DC\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4' },
  { type: 'keyword', label: '\u05DE\u05D9\u05DC\u05EA \u05DE\u05E4\u05EA\u05D7', icon: '\u{1F524}', description: '\u05DB\u05E9\u05D4\u05D5\u05D3\u05E2\u05D4 \u05DE\u05DB\u05D9\u05DC\u05D4 \u05DE\u05D9\u05DC\u05D9\u05DD \u05DE\u05E1\u05D5\u05D9\u05DE\u05D5\u05EA' },
  { type: 'schedule', label: '\u05EA\u05D6\u05DE\u05D5\u05DF', icon: '\u{1F570}\uFE0F', description: '\u05D4\u05E4\u05E2\u05DC \u05D1\u05D6\u05DE\u05DF \u05E7\u05D1\u05D5\u05E2' },
  { type: 'webhook_trigger', label: 'Webhook', icon: '\u{1F517}', description: '\u05D4\u05E4\u05E2\u05DC \u05DE\u05E7\u05E8\u05D9\u05D0\u05EA API \u05D7\u05D9\u05E6\u05D5\u05E0\u05D9\u05EA' },
];

/* ─────────────────────── Trigger Types Set ─────────────────────── */

const TRIGGER_TYPES: Set<FlowNodeType> = new Set([
  'message_received', 'new_contact', 'keyword', 'webhook_trigger', 'schedule', 'trigger',
]);

export function isTriggerNode(type: FlowNodeType): boolean {
  return TRIGGER_TYPES.has(type);
}

/* ─────────────────────── Dual-output nodes ─────────────────────── */

const DUAL_OUTPUT_TYPES: Set<FlowNodeType> = new Set(['condition', 'check_window']);

export function isDualOutputNode(type: FlowNodeType): boolean {
  return DUAL_OUTPUT_TYPES.has(type);
}

/* ─────────────────────── Config Preview Helpers ─────────────────────── */

export function getConfigPreview(nodeType: FlowNodeType, config: Record<string, unknown>): string {
  switch (nodeType) {
    case 'keyword': return (config.keywords as string) || '';
    case 'schedule': return (config.cron as string) || '';
    case 'webhook_trigger': return 'URL \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9';
    case 'ai_agent': return config.agentId ? `\u05E1\u05D5\u05DB\u05DF #${(config.agentId as string).slice(0, 6)}` : '';
    case 'send_message': return ((config.content as string) || '').slice(0, 40);
    case 'send_template': return (config.templateName as string) || '';
    case 'tag_update': return (config.tagValue as string) || '';
    case 'http_request': return `${(config.method as string) || 'POST'} ${((config.url as string) || '').slice(0, 20)}`;
    case 'transfer_agent': return config.targetAgentId ? `\u05E1\u05D5\u05DB\u05DF #${(config.targetAgentId as string).slice(0, 6)}` : '';
    case 'human_handoff': return (config.reason as string) || '';
    case 'close_conversation': case 'close': return (config.closingMessage as string) || '';
    case 'condition': return config.field ? `${config.field} ${config.operator || ''} ${config.value || ''}` : '';
    case 'wait_reply': return config.timeout ? `${config.timeout} \u05D3\u05E7\u05D5\u05EA` : '';
    case 'delay': return config.value ? `${config.value} ${config.unit || '\u05D3\u05E7\u05D5\u05EA'}` : '';
    case 'check_window': return (config.closedAction as string) || '';
    case 'trigger': return (config.triggerType as string) || '';
    default: return '';
  }
}

/* ─────────────────────── Default node data factory ─────────────────────── */

export function createNodeData(type: FlowNodeType): FlowNodeData {
  const item = ALL_PALETTE_ITEMS.find((p) => p.type === type);
  const defaultConfig: Record<string, unknown> = {};
  if (type === 'trigger') defaultConfig.triggerType = 'message_received';
  return {
    nodeType: type,
    label: item?.label ?? type,
    icon: item?.icon ?? '\u2699\uFE0F',
    color: item?.color ?? NODE_ACCENT_COLORS[type] ?? '#6b7280',
    config: defaultConfig,
  };
}

/* ─────────────────────── Template Definition ─────────────────────── */

export interface TemplateDefinition {
  name: string;
  description: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  triggerType: FlowTriggerType;
}
