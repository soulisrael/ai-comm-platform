import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Conversations } from './pages/Conversations';
import { Contacts } from './pages/Contacts';
import { HandoffQueue } from './pages/HandoffQueue';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Flows } from './pages/Flows';
import { Broadcasts } from './pages/Broadcasts';
import { Templates } from './pages/Templates';
import { AgentBuilder } from './pages/AgentBuilder';
// TopicManager removed — brain entries are managed per-agent in AgentBuilder
import { LoadingSpinner } from './components/LoadingSpinner';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="conversations" element={<Conversations />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="handoffs" element={<HandoffQueue />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="agents" element={<AgentBuilder />} />
              <Route path="flows" element={<Flows />} />
              <Route path="broadcasts" element={<Broadcasts />} />
              <Route path="templates" element={<Templates />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
