import { useState } from 'react';
import { ChevronUp, ChevronDown, X, Plus, Info } from 'lucide-react';
import type { ContentBlock, MessageButton } from '../flow-types';

interface EditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  nodeId: string;
  contentBlocks?: ContentBlock[];
  buttons?: MessageButton[];
  onContentBlocksChange?: (blocks: ContentBlock[]) => void;
  onButtonsChange?: (buttons: MessageButton[]) => void;
}

const BLOCK_MENU_ITEMS = [
  { type: 'text' as const, icon: '\u{1F4DD}', label: '\u05D8\u05E7\u05E1\u05D8', desc: '\u05D4\u05D5\u05E1\u05E3 \u05D8\u05E7\u05E1\u05D8 \u05D5\u05DB\u05E4\u05EA\u05D5\u05E8\u05D9\u05DD' },
  { type: 'image' as const, icon: '\u{1F5BC}\uFE0F', label: '\u05EA\u05DE\u05D5\u05E0\u05D4', desc: '\u05E9\u05DC\u05D7 \u05EA\u05DE\u05D5\u05E0\u05D4 \u05E2\u05DD \u05DB\u05D9\u05EA\u05D5\u05D1' },
  { type: 'file' as const, icon: '\u{1F4CE}', label: '\u05E7\u05D5\u05D1\u05E5', desc: '\u05E9\u05DC\u05D7 \u05DE\u05E1\u05DE\u05DA' },
  { type: 'delay' as const, icon: '\u23F1\uFE0F', label: '\u05D4\u05E9\u05D4\u05D9\u05D9\u05D4', desc: '\u05D7\u05DB\u05D4 \u05DB\u05DE\u05D4 \u05E9\u05E0\u05D9\u05D5\u05EA' },
  { type: 'collect_info' as const, icon: '\u{1F4CB}', label: '\u05D0\u05D9\u05E1\u05D5\u05E3 \u05DE\u05D9\u05D3\u05E2', desc: '\u05D0\u05E1\u05D5\u05E3 \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC, \u05D8\u05DC\u05E4\u05D5\u05DF' },
];

const BUTTON_TYPES = [
  { value: 'url', label: 'URL' },
  { value: 'phone', label: '\u05D8\u05DC\u05E4\u05D5\u05DF' },
  { value: 'quick_reply', label: '\u05EA\u05E9\u05D5\u05D1\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4' },
];

const COLLECT_FIELDS = [
  { value: 'email', label: '\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC' },
  { value: 'phone', label: '\u05D8\u05DC\u05E4\u05D5\u05DF' },
  { value: 'name', label: '\u05E9\u05DD' },
  { value: 'custom', label: '\u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA' },
];

export function SendMessageEditor({
  config: _config,
  onChange: _onChange,
  nodeId: _nodeId,
  contentBlocks = [],
  buttons = [],
  onContentBlocksChange,
  onButtonsChange,
}: EditorProps) {
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  /* ─── Block helpers ─── */

  function addBlock(type: ContentBlock['type']) {
    const id = crypto.randomUUID();
    let block: ContentBlock;
    switch (type) {
      case 'text':
        block = { id, type: 'text', content: '' };
        break;
      case 'image':
        block = { id, type: 'image', url: '', caption: '' };
        break;
      case 'file':
        block = { id, type: 'file', url: '', filename: '' };
        break;
      case 'delay':
        block = { id, type: 'delay', seconds: 3 };
        break;
      case 'collect_info':
        block = { id, type: 'collect_info', field: 'email', prompt: '' };
        break;
    }
    onContentBlocksChange?.([...contentBlocks, block]);
    setShowBlockMenu(false);
  }

  function updateBlock(index: number, updates: Partial<ContentBlock>) {
    const updated = contentBlocks.map((b, i) =>
      i === index ? { ...b, ...updates } as ContentBlock : b,
    );
    onContentBlocksChange?.(updated);
  }

  function removeBlock(index: number) {
    onContentBlocksChange?.(contentBlocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= contentBlocks.length) return;
    const arr = [...contentBlocks];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onContentBlocksChange?.(arr);
  }

  /* ─── Button helpers ─── */

  function addButton() {
    const id = crypto.randomUUID();
    onButtonsChange?.([...buttons, { id, type: 'quick_reply', text: '', value: '' }]);
  }

  function updateButton(index: number, updates: Partial<MessageButton>) {
    const updated = buttons.map((b, i) => (i === index ? { ...b, ...updates } : b));
    onButtonsChange?.(updated);
  }

  function removeButton(index: number) {
    onButtonsChange?.(buttons.filter((_, i) => i !== index));
  }

  /* ─── Block renderers ─── */

  function renderBlockContent(block: ContentBlock, index: number) {
    switch (block.type) {
      case 'text':
        return (
          <textarea
            rows={3}
            value={block.content}
            onChange={(e) => updateBlock(index, { content: e.target.value })}
            placeholder="\u05D4\u05DB\u05E0\u05E1 \u05D8\u05E7\u05E1\u05D8..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      case 'image':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={block.url}
              onChange={(e) => updateBlock(index, { url: e.target.value })}
              placeholder="URL \u05EA\u05DE\u05D5\u05E0\u05D4"
              dir="ltr"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              value={block.caption || ''}
              onChange={(e) => updateBlock(index, { caption: e.target.value })}
              placeholder="\u05DB\u05D9\u05EA\u05D5\u05D1 (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );
      case 'file':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={block.url}
              onChange={(e) => updateBlock(index, { url: e.target.value })}
              placeholder="URL \u05E7\u05D5\u05D1\u05E5"
              dir="ltr"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              value={block.filename || ''}
              onChange={(e) => updateBlock(index, { filename: e.target.value })}
              placeholder="\u05E9\u05DD \u05E7\u05D5\u05D1\u05E5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );
      case 'delay':
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={block.seconds}
              onChange={(e) => updateBlock(index, { seconds: Number(e.target.value) })}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-600">\u05E9\u05E0\u05D9\u05D5\u05EA</span>
          </div>
        );
      case 'collect_info':
        return (
          <div className="space-y-2">
            <select
              value={block.field}
              onChange={(e) => updateBlock(index, { field: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {COLLECT_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={block.prompt}
              onChange={(e) => updateBlock(index, { prompt: e.target.value })}
              placeholder="\u05DE\u05D4 \u05D4\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05E9\u05DC\u05DA?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );
    }
  }

  const blockTypeLabels: Record<string, string> = {
    text: '\u{1F4DD} \u05D8\u05E7\u05E1\u05D8',
    image: '\u{1F5BC}\uFE0F \u05EA\u05DE\u05D5\u05E0\u05D4',
    file: '\u{1F4CE} \u05E7\u05D5\u05D1\u05E5',
    delay: '\u23F1\uFE0F \u05D4\u05E9\u05D4\u05D9\u05D9\u05D4',
    collect_info: '\u{1F4CB} \u05D0\u05D9\u05E1\u05D5\u05E3 \u05DE\u05D9\u05D3\u05E2',
  };

  return (
    <div className="space-y-4">
      {/* WhatsApp 24h window notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-amber-700">
          <Info size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium">\u05E9\u05DC\u05D7 \u05D1\u05EA\u05D5\u05DA \u05D7\u05DC\u05D5\u05DF 24 \u05E9\u05E2\u05D5\u05EA</span>
        </div>
        <p className="text-xs text-amber-600 mt-1">
          \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05D7\u05D5\u05E4\u05E9\u05D9\u05D5\u05EA \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05DC\u05D5\u05D7 \u05E8\u05E7 \u05D1\u05EA\u05D5\u05DA 24 \u05E9\u05E2\u05D5\u05EA \u05DE\u05D4\u05D5\u05D3\u05E2\u05EA \u05D4\u05DC\u05E7\u05D5\u05D7 \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4.
          \u05DE\u05D7\u05D5\u05E5 \u05DC\u05D7\u05DC\u05D5\u05DF \u05D9\u05E9 \u05DC\u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05EA\u05D1\u05E0\u05D9\u05D5\u05EA \u05DE\u05D0\u05D5\u05E9\u05E8\u05D5\u05EA.
        </p>
      </div>

      {/* Content blocks */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">\u05D1\u05DC\u05D5\u05E7\u05D9 \u05EA\u05D5\u05DB\u05DF</label>

        <div className="space-y-2">
          {contentBlocks.map((block, index) => (
            <div
              key={block.id}
              className="border border-gray-200 rounded-lg p-3 bg-white"
            >
              {/* Block header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">
                  {blockTypeLabels[block.type] || block.type}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveBlock(index, -1)}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveBlock(index, 1)}
                    disabled={index === contentBlocks.length - 1}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => removeBlock(index)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {renderBlockContent(block, index)}
            </div>
          ))}
        </div>

        {/* Add block button / menu */}
        <div className="relative mt-2">
          <button
            onClick={() => setShowBlockMenu(!showBlockMenu)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            <Plus size={16} />
            <span>+ \u05D4\u05D5\u05E1\u05E3 \u05D1\u05DC\u05D5\u05E7 \u05EA\u05D5\u05DB\u05DF</span>
          </button>

          {showBlockMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {BLOCK_MENU_ITEMS.map((item) => (
                <button
                  key={item.type}
                  onClick={() => addBlock(item.type)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-700">{item.label}</div>
                    <div className="text-xs text-gray-400">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Buttons section */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">\u05DB\u05E4\u05EA\u05D5\u05E8\u05D9\u05DD</label>

        <div className="space-y-2">
          {buttons.map((btn, index) => (
            <div
              key={btn.id}
              className="border border-gray-200 rounded-lg p-3 bg-white space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">\u05DB\u05E4\u05EA\u05D5\u05E8 {index + 1}</span>
                <button
                  onClick={() => removeButton(index)}
                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                type="text"
                value={btn.text}
                onChange={(e) => updateButton(index, { text: e.target.value })}
                placeholder="\u05D8\u05E7\u05E1\u05D8 \u05DB\u05E4\u05EA\u05D5\u05E8"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={btn.type}
                onChange={(e) => updateButton(index, { type: e.target.value as MessageButton['type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {BUTTON_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
              {btn.type === 'url' && (
                <input
                  type="text"
                  value={btn.value || ''}
                  onChange={(e) => updateButton(index, { value: e.target.value })}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
              {btn.type === 'phone' && (
                <input
                  type="text"
                  value={btn.value || ''}
                  onChange={(e) => updateButton(index, { value: e.target.value })}
                  placeholder="+972-50-000-0000"
                  dir="ltr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
              {btn.type === 'quick_reply' && (
                <p className="text-xs text-blue-500">\u05D9\u05D5\u05E6\u05E8 \u05E2\u05E0\u05E3 \u05D7\u05D3\u05E9</p>
              )}
            </div>
          ))}
        </div>

        {buttons.length < 3 && (
          <button
            onClick={addButton}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            <Plus size={16} />
            <span>+ \u05D4\u05D5\u05E1\u05E3 \u05DB\u05E4\u05EA\u05D5\u05E8</span>
          </button>
        )}
      </div>
    </div>
  );
}
