import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Contacts } from './pages/Contacts';
import { HandoffQueue } from './pages/HandoffQueue';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Flows } from './pages/Flows';
import { Broadcasts } from './pages/Broadcasts';
import { Templates } from './pages/Templates';
import { AgentBuilder } from './pages/AgentBuilder';
import { LiveChat } from './pages/LiveChat';
// TopicManager removed — brain entries are managed per-agent in AgentBuilder
import { LoadingSpinner } from './components/LoadingSpinner';
import { Component, type ReactNode, type ErrorInfo } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, direction: 'ltr', fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>App Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#666' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
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
              <Route path="chat" element={<LiveChat />} />
              <Route path="conversations" element={<LiveChat />} />
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
    </ErrorBoundary>
  );
}
