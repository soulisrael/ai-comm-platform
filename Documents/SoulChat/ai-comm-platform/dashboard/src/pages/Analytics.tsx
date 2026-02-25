import { useState } from 'react';
import { useAnalyticsOverview, useAnalyticsConversations } from '../hooks/useAnalytics';
import { PageLoading } from '../components/LoadingSpinner';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { MessageSquare, Users, ArrowRightLeft, TrendingUp } from 'lucide-react';

export function Analytics() {
  const [groupBy, setGroupBy] = useState<'hour' | 'day' | 'week'>('day');
  const { data: overview, isLoading } = useAnalyticsOverview();
  const { data: volumeData } = useAnalyticsConversations(groupBy);

  if (isLoading) return <PageLoading />;

  const stats = overview?.conversations || { total: 0, active: 0, waiting: 0, handoff: 0, closed: 0 };
  const resolutionRate = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;
  const handoffRate = stats.total > 0 ? Math.round((stats.handoff / stats.total) * 100) : 0;

  const cards = [
    { label: 'Total Conversations', value: stats.total, icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Contacts', value: overview?.contacts?.total || 0, icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Resolution Rate', value: `${resolutionRate}%`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Handoff Rate', value: `${handoffRate}%`, icon: ArrowRightLeft, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Volume chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700">Conversation Volume</h2>
          <div className="flex gap-1">
            {(['hour', 'day', 'week'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${
                  groupBy === g ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={volumeData?.data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Status Breakdown</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={[
            { name: 'Active', count: stats.active },
            { name: 'Waiting', count: stats.waiting },
            { name: 'Handoff', count: stats.handoff },
            { name: 'Closed', count: stats.closed },
          ]}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {[
                { fill: '#10b981' },
                { fill: '#f59e0b' },
                { fill: '#ef4444' },
                { fill: '#6b7280' },
              ].map((props, i) => (
                <Bar key={i} {...props} dataKey="count" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
