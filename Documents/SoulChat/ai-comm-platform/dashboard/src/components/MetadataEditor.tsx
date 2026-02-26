import { Plus, Trash2 } from 'lucide-react';

interface Props {
  metadata: Record<string, unknown>;
  onChange: (metadata: Record<string, unknown>) => void;
}

export function MetadataEditor({ metadata, onChange }: Props) {
  const entries = Object.entries(metadata);

  function updateKey(oldKey: string, newKey: string) {
    if (newKey === oldKey) return;
    const updated: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      updated[k === oldKey ? newKey : k] = v;
    }
    onChange(updated);
  }

  function updateValue(key: string, value: string) {
    onChange({ ...metadata, [key]: value });
  }

  function addPair() {
    let newKey = 'key';
    let i = 1;
    while (newKey in metadata) {
      newKey = `key_${i++}`;
    }
    onChange({ ...metadata, [newKey]: '' });
  }

  function removePair(key: string) {
    const { [key]: _, ...rest } = metadata;
    onChange(rest);
  }

  return (
    <div dir="rtl" className="space-y-2">
      {entries.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 px-1">
          <span>מפתח</span>
          <span>ערך</span>
          <span className="w-8" />
        </div>
      )}

      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <input
            type="text"
            value={key}
            onChange={e => updateKey(key, e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="מפתח"
          />
          <input
            type="text"
            value={String(value ?? '')}
            onChange={e => updateValue(key, e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="ערך"
          />
          <button
            type="button"
            onClick={() => removePair(key)}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addPair}
        className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mt-1"
      >
        <Plus size={14} />
        הוסף שדה
      </button>
    </div>
  );
}
