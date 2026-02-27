import {
  Save,
  Pause,
  Play,
  FlaskConical,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/* ─── Props ─── */

export interface FlowToolbarProps {
  flowName: string;
  onFlowNameChange: (name: string) => void;
  onBack: () => void;
  onSave: () => void;
  onToggleActive: () => void;
  onTest: () => void;
  onDelete: () => void;
  isActive: boolean;
  isSaving: boolean;
  isTesting: boolean;
  hasFlow: boolean;
  hasUnsavedChanges?: boolean;
}

/* ─── Component ─── */

export function FlowToolbar({
  flowName,
  onFlowNameChange,
  onBack,
  onSave,
  onToggleActive,
  onTest,
  onDelete,
  isActive,
  isSaving,
  isTesting,
  hasFlow,
  hasUnsavedChanges,
}: FlowToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronRight size={18} />
        <span>חזרה</span>
      </button>

      <div className="h-5 w-px bg-gray-200" />

      {/* Flow name */}
      <input
        value={flowName}
        onChange={(e) => onFlowNameChange(e.target.value)}
        className="text-sm font-semibold bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1.5 py-1 min-w-[200px] transition-colors"
      />

      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Save */}
        <button
          onClick={onSave}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50',
            hasUnsavedChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm animate-pulse'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          )}
        >
          <Save size={14} />
          {isSaving ? 'שומר...' : 'שמור'}
        </button>

        {hasFlow && (
          <>
            {/* Toggle active */}
            <button
              onClick={onToggleActive}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
              )}
            >
              {isActive ? <Pause size={14} /> : <Play size={14} />}
              {isActive ? 'כבה' : 'הפעל'}
            </button>

            {/* Test */}
            <button
              onClick={onTest}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              <FlaskConical size={14} />
              {isTesting ? 'בודק...' : 'בדוק'}
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 p-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="מחק אוטומציה"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
