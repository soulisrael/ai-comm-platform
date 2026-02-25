import { useState, useRef, useCallback } from 'react';
import { useBrainModules, useBrainModule, useBrainAgents, useBrainCompany, useBrainActions, useDocxUpload } from '../hooks/useBrain';
import { PageLoading } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { AgentBadge } from '../components/AgentBadge';
import { RefreshCw, ChevronRight, Save, Database, Bot, Building2, ArrowLeft, Upload } from 'lucide-react';
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

      {/* Document Upload */}
      <DocxUploadSection />

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

type UploadState = 'idle' | 'uploading' | 'preview' | 'saving' | 'done';

function DocxUploadSection() {
  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('sales');
  const [moduleName, setModuleName] = useState('');
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { preview, confirm } = useDocxUpload();

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.docx')) {
      toast.error('Only .docx files are supported');
      return;
    }
    setFile(f);
    setPreviewData(null);
    setState('idle');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handlePreview = async () => {
    if (!file) return;
    setState('uploading');
    try {
      const result = await preview.mutateAsync({ file, category, moduleName: moduleName || undefined });
      setPreviewData(result.convertedData);
      setState('preview');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to convert document');
      setState('idle');
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setState('saving');
    try {
      await confirm.mutateAsync({ file, category, moduleName: moduleName || undefined });
      toast.success('Document uploaded to brain');
      setState('done');
      setTimeout(() => {
        setState('idle');
        setFile(null);
        setPreviewData(null);
        setModuleName('');
      }, 2000);
    } catch {
      toast.error('Failed to save document');
      setState('preview');
    }
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
        <Upload size={14} /> Upload Document
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <Upload size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            {file ? file.name : 'Drag & drop a .docx file or click to browse'}
          </p>
          {file && <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {/* Options row */}
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="sales">Sales</option>
              <option value="support">Support</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Module name (optional)</label>
            <input
              type="text"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="auto-generated from filename"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={handlePreview}
            disabled={!file || state === 'uploading' || state === 'saving'}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {state === 'uploading' ? 'Converting...' : 'Preview'}
          </button>
        </div>

        {/* Preview JSON */}
        {state === 'preview' && previewData && (
          <div className="space-y-3">
            <pre className="max-h-[40vh] overflow-auto p-4 text-sm font-mono bg-gray-900 text-green-400 rounded-lg">
              {JSON.stringify(previewData, null, 2)}
            </pre>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setState('idle'); setPreviewData(null); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Confirm & Save to Brain
              </button>
            </div>
          </div>
        )}

        {state === 'saving' && (
          <p className="text-sm text-gray-500 text-center">Saving to brain...</p>
        )}
        {state === 'done' && (
          <p className="text-sm text-green-600 text-center font-medium">Document saved successfully!</p>
        )}
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
