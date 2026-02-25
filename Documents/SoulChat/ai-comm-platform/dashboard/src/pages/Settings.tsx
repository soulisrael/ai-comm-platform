import { useState } from 'react';
import { Key, Globe, Users, Bell, MessageCircle, Instagram, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      {/* API Keys */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Key size={16} /> API Keys
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">API Secret Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter API key..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => toast.success('API key saved')}
                className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Channel Configuration */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Globe size={16} /> Channel Configuration
        </h2>
        <div className="space-y-4">
          {[
            { icon: MessageCircle, label: 'WhatsApp', color: 'text-green-600', status: 'Not configured' },
            { icon: Instagram, label: 'Instagram', color: 'text-pink-600', status: 'Not configured' },
            { icon: Send, label: 'Telegram', color: 'text-blue-500', status: 'Not configured' },
            { icon: Globe, label: 'Web Widget', color: 'text-gray-600', status: 'Active' },
          ].map(ch => (
            <div key={ch.label} className="flex items-center gap-3 py-2">
              <ch.icon size={18} className={ch.color} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{ch.label}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                ch.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {ch.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Users size={16} /> Team Management
        </h2>
        <p className="text-sm text-gray-500">
          Team management requires Supabase Auth. Configure your Supabase credentials to enable user invitations and role management.
        </p>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Bell size={16} /> Notifications
        </h2>
        <div className="space-y-3">
          {['New handoff requests', 'Conversation escalations', 'System alerts'].map(item => (
            <label key={item} className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-gray-700">{item}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
