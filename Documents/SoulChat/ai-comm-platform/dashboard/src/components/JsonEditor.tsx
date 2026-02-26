import { useState } from 'react';
import { Copy, Check, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
}

export function JsonEditor({ value, onChange, error, label }: Props) {
  const [copied, setCopied] = useState(false);

  const isValid = (() => {
    if (!value.trim()) return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  })();

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div dir="rtl" className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={8}
          className="w-full font-mono text-sm p-3 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 ltr"
          dir="ltr"
          spellCheck={false}
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white"
            title="העתק"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          {value.trim() && (
            isValid ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : (
              <AlertCircle size={14} className="text-red-500" />
            )
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!isValid && value.trim() && !error && (
        <p className="text-xs text-red-600">JSON לא תקין</p>
      )}
    </div>
  );
}
