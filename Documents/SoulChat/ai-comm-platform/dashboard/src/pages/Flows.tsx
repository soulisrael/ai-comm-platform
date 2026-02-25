import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { Plus, Play, Pause, Trash2, Eye, Zap, Clock, MessageSquare, Tag } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface FlowStep {
  id: string;
  action: { type: string; config: Record<string, any> };
  conditions?: Array<{ field: string; operator: string; value: unknown }>;
  nextStepId?: string;
}

interface Flow {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  triggerConfig: Record<string, any>;
  steps: FlowStep[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_OPTIONS = [
  { value: 'message_received', label: 'Message Received', icon: MessageSquare },
  { value: 'keyword_detected', label: 'Keyword Detected', icon: Zap },
  { value: 'conversation_started', label: 'Conversation Started', icon: Play },
  { value: 'conversation_closed', label: 'Conversation Closed', icon: Pause },
  { value: 'tag_added', label: 'Tag Added', icon: Tag },
  { value: 'scheduled', label: 'Scheduled', icon: Clock },
  { value: 'contact_created', label: 'Contact Created', icon: Plus },
];

const ACTION_OPTIONS = [
  { value: 'send_message', label: 'Send Message' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'assign_agent', label: 'Assign Agent' },
  { value: 'wait', label: 'Wait / Delay' },
  { value: 'webhook', label: 'Call Webhook' },
  { value: 'update_contact', label: 'Update Contact' },
  { value: 'close_conversation', label: 'Close Conversation' },
  { value: 'send_image', label: 'Send Image' },
];

export function Flows() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

  const { data: flows = [], isLoading } = useQuery<Flow[]>({
    queryKey: ['flows'],
    queryFn: () => api.get('/api/automation/flows'),
  });

  const createFlow = useMutation({
    mutationFn: (data: any) => api.post('/api/automation/flows', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setShowCreate(false);
      toast.success('Flow created');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.post(`/api/automation/flows/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast.success('Flow updated');
    },
  });

  const deleteFlow = useMutation({
    mutationFn: (id: string) => api.delete(`/api/automation/flows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setSelectedFlow(null);
      toast.success('Flow deleted');
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Flows</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage automated workflows</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={16} /> New Flow
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading flows...</div>
      ) : flows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Zap size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No flows yet. Create your first automation flow.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map(flow => (
            <div
              key={flow.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedFlow(flow)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{flow.name}</h3>
                  {flow.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{flow.description}</p>
                  )}
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  flow.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {flow.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Zap size={12} />
                <span>{TRIGGER_OPTIONS.find(t => t.value === flow.trigger)?.label || flow.trigger}</span>
                <span className="text-gray-300">|</span>
                <span>{flow.steps.length} step{flow.steps.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: flow.id, active: !flow.active }); }}
                  className={cn(
                    'p-1.5 rounded',
                    flow.active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'
                  )}
                  title={flow.active ? 'Deactivate' : 'Activate'}
                >
                  {flow.active ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFlow.mutate(flow.id); }}
                  className="p-1.5 rounded text-red-500 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Flow Modal */}
      {showCreate && (
        <CreateFlowModal
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createFlow.mutate(data)}
        />
      )}

      {/* Flow Detail Modal */}
      {selectedFlow && (
        <FlowDetailModal
          flow={selectedFlow}
          onClose={() => setSelectedFlow(null)}
        />
      )}
    </div>
  );
}

function CreateFlowModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('message_received');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [steps, setSteps] = useState<FlowStep[]>([]);

  const addStep = () => {
    setSteps([...steps, {
      id: `step-${steps.length + 1}`,
      action: { type: 'send_message', config: { content: '' } },
    }]);
  };

  const updateStep = (idx: number, updates: Partial<FlowStep>) => {
    const newSteps = [...steps];
    newSteps[idx] = { ...newSteps[idx], ...updates };
    setSteps(newSteps);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Create Flow</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., Welcome Flow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="What does this flow do?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
            <select
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {TRIGGER_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {trigger === 'keyword_detected' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
              <input
                value={(triggerConfig.keywords || []).join(', ')}
                onChange={e => setTriggerConfig({ ...triggerConfig, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="pricing, price, cost"
              />
            </div>
          )}
          {trigger === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
              <input
                value={triggerConfig.cron || ''}
                onChange={e => setTriggerConfig({ ...triggerConfig, cron: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0 9 * * 1-5"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Steps</label>
              <button onClick={addStep} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus size={14} /> Add Step
              </button>
            </div>
            {steps.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-300 rounded-lg">
                No steps yet. Add an action step.
              </p>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={step.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Step {idx + 1}</span>
                      <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <select
                      value={step.action.type}
                      onChange={e => updateStep(idx, { action: { type: e.target.value, config: {} } })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2"
                    >
                      {ACTION_OPTIONS.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    {step.action.type === 'send_message' && (
                      <textarea
                        value={step.action.config.content || ''}
                        onChange={e => updateStep(idx, { action: { ...step.action, config: { content: e.target.value } } })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        rows={2}
                        placeholder="Message content..."
                      />
                    )}
                    {(step.action.type === 'add_tag' || step.action.type === 'remove_tag') && (
                      <input
                        value={step.action.config.tag || ''}
                        onChange={e => updateStep(idx, { action: { ...step.action, config: { tag: e.target.value } } })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="Tag name"
                      />
                    )}
                    {step.action.type === 'wait' && (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={step.action.config.amount || ''}
                          onChange={e => updateStep(idx, { action: { ...step.action, config: { ...step.action.config, amount: Number(e.target.value) } } })}
                          className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="5"
                        />
                        <select
                          value={step.action.config.unit || 'minutes'}
                          onChange={e => updateStep(idx, { action: { ...step.action, config: { ...step.action.config, unit: e.target.value } } })}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="seconds">Seconds</option>
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    )}
                    {step.action.type === 'assign_agent' && (
                      <select
                        value={step.action.config.agentType || ''}
                        onChange={e => updateStep(idx, { action: { ...step.action, config: { agentType: e.target.value } } })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Select agent...</option>
                        <option value="sales">Sales</option>
                        <option value="support">Support</option>
                        <option value="trial_meeting">Trial Meeting</option>
                      </select>
                    )}
                    {step.action.type === 'webhook' && (
                      <input
                        value={step.action.config.url || ''}
                        onChange={e => updateStep(idx, { action: { ...step.action, config: { url: e.target.value } } })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="https://..."
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit({ name, description, trigger, triggerConfig, steps })}
            disabled={!name}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Create Flow
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowDetailModal({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const { data: executions = [] } = useQuery<any[]>({
    queryKey: ['flow-executions', flow.id],
    queryFn: () => api.get(`/api/automation/flows/${flow.id}/executions`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{flow.name}</h2>
            {flow.description && <p className="text-sm text-gray-500 mt-1">{flow.description}</p>}
          </div>
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            flow.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          )}>
            {flow.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Trigger</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <Zap size={16} className="text-primary-500" />
              {TRIGGER_OPTIONS.find(t => t.value === flow.trigger)?.label || flow.trigger}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Steps ({flow.steps.length})</h3>
            <div className="space-y-2">
              {flow.steps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-800">
                      {ACTION_OPTIONS.find(a => a.value === step.action.type)?.label || step.action.type}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {JSON.stringify(step.action.config)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              <Eye size={14} className="inline mr-1" />
              Recent Executions ({executions.length})
            </h3>
            {executions.length === 0 ? (
              <p className="text-sm text-gray-400">No executions yet.</p>
            ) : (
              <div className="space-y-1">
                {executions.slice(0, 10).map((exec: any) => (
                  <div key={exec.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                    <span className={cn(
                      'font-medium',
                      exec.status === 'completed' ? 'text-green-600' : exec.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                    )}>
                      {exec.status}
                    </span>
                    <span className="text-gray-400">{new Date(exec.startedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  );
}
