import type { Node, Edge } from 'reactflow';
import { X } from 'lucide-react';
import { Badge } from '../Badge';
import type { FlowNodeData, TemplateDefinition } from './flow-types';
import { TRIGGER_LABELS } from './flow-types';

/* ─────────────────────── Templates Data ─────────────────────── */

export function getTemplates(): TemplateDefinition[] {
  return [
    {
      name: 'ברוכים הבאים',
      description: 'ברכת איש קשר חדש עם סוכן AI',
      triggerType: 'new_contact',
      nodes: [
        {
          id: 't1',
          type: 'new_contact',
          position: { x: 250, y: 0 },
          data: {
            nodeType: 'new_contact',
            label: 'לקוח חדש',
            icon: '\u{1F464}',
            color: '#22c55e',
            config: {},
          },
        },
        {
          id: 't2',
          type: 'send_message',
          position: { x: 250, y: 120 },
          data: {
            nodeType: 'send_message',
            label: 'שלח הודעה',
            icon: '\u{1F4AC}',
            color: '#3b82f6',
            config: { content: '\u{05E9}\u{05DC}\u{05D5}\u{05DD}! \u{05D0}\u{05D9}\u{05DA} \u{05D0}\u{05E4}\u{05E9}\u{05E8} \u{05DC}\u{05E2}\u{05D6}\u{05D5}\u{05E8}?' },
          },
        },
        {
          id: 't3',
          type: 'ai_agent',
          position: { x: 250, y: 240 },
          data: {
            nodeType: 'ai_agent',
            label: 'סוכן AI',
            icon: '\u{1F916}',
            color: '#6366f1',
            config: {},
          },
        },
        {
          id: 't4',
          type: 'wait_reply',
          position: { x: 250, y: 360 },
          data: {
            nodeType: 'wait_reply',
            label: 'המתן לתגובה',
            icon: '\u231B',
            color: '#f59e0b',
            config: { timeout: 60 },
          },
        },
      ] as Node<FlowNodeData>[],
      edges: [
        { id: 'te1', source: 't1', target: 't2', animated: true },
        { id: 'te2', source: 't2', target: 't3', animated: true },
        { id: 'te3', source: 't3', target: 't4', animated: true },
      ] as Edge[],
    },
    {
      name: 'מענה אוטומטי',
      description: 'תגובה אוטומטית עם בדיקת חלון שירות',
      triggerType: 'message_received',
      nodes: [
        {
          id: 'a1',
          type: 'message_received',
          position: { x: 250, y: 0 },
          data: {
            nodeType: 'message_received',
            label: 'הודעה נכנסת',
            icon: '\u{1F4E9}',
            color: '#22c55e',
            config: {},
          },
        },
        {
          id: 'a2',
          type: 'check_window',
          position: { x: 250, y: 120 },
          data: {
            nodeType: 'check_window',
            label: 'בדוק חלון',
            icon: '\u23F0',
            color: '#a855f7',
            config: {},
          },
        },
        {
          id: 'a3',
          type: 'ai_agent',
          position: { x: 400, y: 260 },
          data: {
            nodeType: 'ai_agent',
            label: 'סוכן AI',
            icon: '\u{1F916}',
            color: '#6366f1',
            config: {},
          },
        },
        {
          id: 'a4',
          type: 'send_message',
          position: { x: 80, y: 260 },
          data: {
            nodeType: 'send_message',
            label: 'שלח הודעה',
            icon: '\u{1F4AC}',
            color: '#3b82f6',
            config: { content: '\u{05DB}\u{05E8}\u{05D2}\u{05E2} \u{05E1}\u{05D2}\u{05D5}\u{05E8}, \u{05E0}\u{05D7}\u{05D6}\u{05D5}\u{05E8} \u{05D0}\u{05DC}\u{05D9}\u{05DA} \u{05D1}\u{05D4}\u{05E7}\u{05D3}\u{05DD}' },
          },
        },
      ] as Node<FlowNodeData>[],
      edges: [
        { id: 'ae1', source: 'a1', target: 'a2', animated: true },
        { id: 'ae2', source: 'a2', sourceHandle: 'open', target: 'a3', animated: true, style: { stroke: '#22c55e' } },
        { id: 'ae3', source: 'a2', sourceHandle: 'closed', target: 'a4', animated: true, style: { stroke: '#ef4444' } },
      ] as Edge[],
    },
    {
      name: 'סגירת ליד',
      description: 'מעקב אוטומטי עם סוכן מכירות',
      triggerType: 'message_received',
      nodes: [
        {
          id: 'l1',
          type: 'message_received',
          position: { x: 250, y: 0 },
          data: {
            nodeType: 'message_received',
            label: 'הודעה נכנסת',
            icon: '\u{1F4E9}',
            color: '#22c55e',
            config: {},
          },
        },
        {
          id: 'l2',
          type: 'ai_agent',
          position: { x: 250, y: 120 },
          data: {
            nodeType: 'ai_agent',
            label: 'סוכן AI',
            icon: '\u{1F916}',
            color: '#6366f1',
            config: {},
          },
        },
        {
          id: 'l3',
          type: 'wait_reply',
          position: { x: 250, y: 240 },
          data: {
            nodeType: 'wait_reply',
            label: 'המתן לתגובה',
            icon: '\u231B',
            color: '#f59e0b',
            config: { timeout: 1440 },
          },
        },
        {
          id: 'l4',
          type: 'condition',
          position: { x: 250, y: 370 },
          data: {
            nodeType: 'condition',
            label: 'תנאי (אם/אחרת)',
            icon: '\u{1F500}',
            color: '#ec4899',
            config: { field: 'replied', operator: 'equals', value: 'true' },
          },
        },
        {
          id: 'l5',
          type: 'delay',
          position: { x: 80, y: 510 },
          data: {
            nodeType: 'delay',
            label: 'השהייה',
            icon: '\u23F1\uFE0F',
            color: '#8b5cf6',
            config: { value: 1, unit: 'days' },
          },
        },
        {
          id: 'l6',
          type: 'send_message',
          position: { x: 80, y: 630 },
          data: {
            nodeType: 'send_message',
            label: 'שלח הודעה',
            icon: '\u{1F4AC}',
            color: '#3b82f6',
            config: { content: '\u{05E8}\u{05E6}\u{05D9}\u{05E0}\u{05D5} \u{05DC}\u{05D1}\u{05D3}\u{05D5}\u{05E7} \u{05D0}\u{05DD} \u{05D9}\u{05E9} \u{05DC}\u{05DA} \u{05E9}\u{05D0}\u{05DC}\u{05D5}\u{05EA} \u{05E0}\u{05D5}\u{05E1}\u{05E4}\u{05D5}\u{05EA}' },
          },
        },
      ] as Node<FlowNodeData>[],
      edges: [
        { id: 'le1', source: 'l1', target: 'l2', animated: true },
        { id: 'le2', source: 'l2', target: 'l3', animated: true },
        { id: 'le3', source: 'l3', target: 'l4', animated: true },
        { id: 'le4', source: 'l4', sourceHandle: 'no', target: 'l5', animated: true, style: { stroke: '#ef4444' } },
        { id: 'le5', source: 'l5', target: 'l6', animated: true },
      ] as Edge[],
    },
    {
      name: 'הסלמה',
      description: 'זיהוי תלונה והעברה לנציג אנושי',
      triggerType: 'keyword',
      nodes: [
        {
          id: 'e1',
          type: 'keyword',
          position: { x: 250, y: 0 },
          data: {
            nodeType: 'keyword',
            label: 'מילת מפתח',
            icon: '\u{1F511}',
            color: '#22c55e',
            config: { keywords: '\u{05EA}\u{05DC}\u{05D5}\u{05E0}\u{05D4}' },
          },
        },
        {
          id: 'e2',
          type: 'ai_agent',
          position: { x: 250, y: 120 },
          data: {
            nodeType: 'ai_agent',
            label: 'סוכן AI',
            icon: '\u{1F916}',
            color: '#6366f1',
            config: {},
          },
        },
        {
          id: 'e3',
          type: 'condition',
          position: { x: 250, y: 260 },
          data: {
            nodeType: 'condition',
            label: 'תנאי (אם/אחרת)',
            icon: '\u{1F500}',
            color: '#ec4899',
            config: { field: 'context.sentiment', operator: 'less', value: '0.3' },
          },
        },
        {
          id: 'e4',
          type: 'human_handoff',
          position: { x: 400, y: 410 },
          data: {
            nodeType: 'human_handoff',
            label: 'העבר לנציג',
            icon: '\u{1F464}',
            color: '#f97316',
            config: { reason: '\u{05E1}\u{05E0}\u{05D8}\u{05D9}\u{05DE}\u{05E0}\u{05D8} \u{05E9}\u{05DC}\u{05D9}\u{05DC}\u{05D9}' },
          },
        },
      ] as Node<FlowNodeData>[],
      edges: [
        { id: 'ee1', source: 'e1', target: 'e2', animated: true },
        { id: 'ee2', source: 'e2', target: 'e3', animated: true },
        { id: 'ee3', source: 'e3', sourceHandle: 'yes', target: 'e4', animated: true, style: { stroke: '#22c55e' } },
      ] as Edge[],
    },
  ];
}

/* ─────────────────────── Templates Dialog ─────────────────────── */

export function FlowTemplates({
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
