import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PALETTE_CATEGORIES, type FlowNodeType } from './flow-types';

/* ─── Props ─── */

export interface AddStepMenuProps {
  onSelect: (type: FlowNodeType) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

/* ─── Component ─── */

export function AddStepMenu({ onSelect, onClose, position }: AddStepMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    // Defer so the opening click doesn't immediately close
    const id = setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  function handleSelect(type: FlowNodeType) {
    onSelect(type);
    onClose();
  }

  const style: React.CSSProperties = position
    ? { position: 'fixed', top: position.y, left: position.x }
    : {};

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        ref={panelRef}
        style={style}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[360px] max-h-[480px] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">הוסף צעד</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {PALETTE_CATEGORIES.map((category) => (
            <div key={category.name}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className="text-sm">{category.icon}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {category.name}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-1">
                {category.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleSelect(item.type)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-right group"
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ backgroundColor: item.color + '15' }}
                    >
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-400 leading-tight">
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
    </div>
  );
}
