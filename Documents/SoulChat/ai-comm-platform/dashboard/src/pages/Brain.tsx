import { useState } from 'react';
import { useBrainModules, useBrainModule, useBrainAgents, useBrainCompany, useBrainActions } from '../hooks/useBrain';
import { PageLoading } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { AgentBadge } from '../components/AgentBadge';
import { RefreshCw, ChevronRight, Save, Database, Bot, Building2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export function Brain() {
  const [activeModule, setActiveModule] = useState<{ category: string; subcategory: string } | null>(null);
  const { data: modulesData, isLoading } = useBrainModules();
  const { data: agentsData } = useBrainAgents();
  const { data: companyData } = useBrainCompany();
  const { reload } = useBrainActions();

  const handleReload = async () => {
    try {
      await reload.mutateAsync();
      toast.success('Brain data reloaded');
    } catch {
      toast.error('Failed to reload brain');
    }
  };

  if (isLoading) return <PageLoading />;

  if (activeModule) {
    return <ModuleEditor {...activeModule} onBack={() => setActiveModule(null)} />;
  }

  const modules = modulesData?.modules || [];
  const grouped = modules.reduce<Record<string, typeof modules>>((acc, m) => {
    const cat = m.category || m.name.split('/')[0];
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Brain</h1>
        <button
          onClick={handleReload}
          disabled={reload.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={reload.isPending ? 'animate-spin' : ''} />
          Reload All Brain Data
        </button>
      </div>

      {/* Agent Configs */}
      {agentsData && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Bot size={14} /> Agent Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(agentsData).map(([key, config]: [string, any]) => (
              <div key={key} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AgentBadge agent={key} />
                  <span className="text-sm font-medium text-gray-900 capitalize">{key.replace('_', ' ')}</span>
                </div>
                {config?.systemPrompt && (
                  <p className="text-xs text-gray-500 line-clamp-3 mb-2">{config.systemPrompt}</p>
                )}
                {config?.temperature !== undefined && (
                  <p className="text-xs text-gray-400">Temp: {config.temperature} | Max tokens: {config.maxTokens || 'default'}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company Info */}
      {companyData && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Building2 size={14} /> Company Info
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {(() => {
              const info = (companyData as Record<string, any>).info;
              if (!info) return null;
              return (
                <div className="text-sm text-gray-700">
                  <p className="font-medium">{info.name || 'Company'}</p>
                  <p className="text-gray-500 mt-1">{info.description || ''}</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modules Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
          <Database size={14} /> Brain Modules
        </h2>
        {Object.entries(grouped).map(([category, mods]) => (
          <div key={category} className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 capitalize mb-2">{category}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mods.map(m => {
                const sub = m.subcategory || m.name.split('/')[1] || m.name;
                const cat = m.category || m.name.split('/')[0];
                return (
                  <button
                    key={m.name}
                    onClick={() => setActiveModule({ category: cat, subcategory: sub })}
                    className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-primary-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 capitalize">{sub.replace(/-/g, ' ')}</span>
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-primary-500" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{m.entryCount} entries</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleEditor({ category, subcategory, onBack }: { category: string; subcategory: string; onBack: () => void }) {
  const { data, isLoading } = useBrainModule(category, subcategory);
  const { updateModule } = useBrainActions();
  const [editing, setEditing] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const handleEdit = () => {
    setJsonText(JSON.stringify(data, null, 2));
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      await updateModule.mutateAsync({ category, subcategory, data: parsed });
      setEditing(false);
      toast.success('Module updated');
    } catch (err) {
      toast.error(err instanceof SyntaxError ? 'Invalid JSON' : 'Failed to save');
    }
  };

  if (isLoading) return <PageLoading />;

  const entries = data ? Object.entries(data) : [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 capitalize">
          {category} / {subcategory.replace(/-/g, ' ')}
        </h1>
        <div className="flex-1" />
        {!editing ? (
          <button onClick={handleEdit} className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
            Edit JSON
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700">
              <Save size={14} /> Save
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <textarea
          value={jsonText}
          onChange={e => setJsonText(e.target.value)}
          className="w-full h-[60vh] p-4 text-sm font-mono bg-gray-900 text-green-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          spellCheck={false}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {entries.length === 0 ? (
            <EmptyState title="No data" description="This module is empty" />
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.map(([key, value]) => (
                <div key={key} className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900 capitalize">{key.replace(/-/g, ' ')}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {typeof value === 'string' ? value : Array.isArray(value) ? `${value.length} items` : JSON.stringify(value).slice(0, 120)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
