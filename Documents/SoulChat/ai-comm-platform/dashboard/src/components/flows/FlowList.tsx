import { useState } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  Play,
  Pause,
  Zap,
  LayoutTemplate,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlows, useFlowActions } from '../../hooks/useFlows';
import { Badge } from '../Badge';
import type { Flow } from '../../lib/types';
import { TRIGGER_LABELS, type TemplateDefinition } from './flow-types';
import { FlowTemplates } from './FlowTemplates';
import toast from 'react-hot-toast';

export interface FlowListProps {
  onSelectFlow: (flow: Flow) => void;
  onCreateFlow: (template?: TemplateDefinition) => void;
}

export function FlowList({ onSelectFlow, onCreateFlow }: FlowListProps) {
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
        <FlowTemplates
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
