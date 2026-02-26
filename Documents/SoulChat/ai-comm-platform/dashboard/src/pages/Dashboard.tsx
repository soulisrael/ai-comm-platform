import { MessageSquare, Users, ArrowRightLeft, Clock } from 'lucide-react';
import { useAnalyticsOverview, useAnalyticsConversations } from '../hooks/useAnalytics';
import { useConversations } from '../hooks/useConversations';
import { PageLoading } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { ChannelIcon } from '../components/ChannelIcon';
import { formatRelativeTime, truncate } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function Dashboard() {
  const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview();
  const { data: volumeData } = useAnalyticsConversations('day');
  const { data: convData } = useConversations({ limit: 10 });
  const navigate = useNavigate();

  if (loadingOverview) return <PageLoading />;

  const stats = overview?.conversations || { total: 0, active: 0, waiting: 0, handoff: 0, closed: 0 };
  const totalContacts = overview?.contacts?.total || 0;
  const todayMessages = overview?.messages?.today || 0;

  const channelData = [
    { name: 'ווב', value: 45 },
    { name: 'וואטסאפ', value: 30 },
    { name: 'אינסטגרם', value: 15 },
    { name: 'טלגרם', value: 10 },
  ];

  const cards = [
    { label: 'שיחות פעילות', value: stats.active, icon: MessageSquare, color: 'text-green-600 bg-green-50' },
    { label: 'הודעות היום', value: todayMessages, icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { label: 'סה״כ אנשי קשר', value: totalContacts, icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'העברות ממתינות', value: stats.handoff, icon: ArrowRightLeft, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">לוח בקרה</h1>

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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">נפח הודעות (7 ימים אחרונים)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={volumeData?.data || []}>
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">לפי ערוץ</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name }) => name}>
                {channelData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent conversations */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">שיחות אחרונות</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(convData?.conversations || []).map(conv => (
            <button
              key={conv.id}
              onClick={() => navigate(`/conversations?id=${conv.id}`)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-right"
            >
              <ChannelIcon channel={conv.channel} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {conv.contactId}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {conv.messages?.length ? truncate(conv.messages[conv.messages.length - 1].content, 60) : 'אין הודעות'}
                </p>
              </div>
              <StatusBadge status={conv.status} />
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatRelativeTime(conv.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
