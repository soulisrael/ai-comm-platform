import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api-client';
import type { TeamMember } from '../lib/types';

const TOKEN_KEY = 'auth_token';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  teamMember: TeamMember | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      // No token — auto-login as demo user when no API is configured
      setUser({ id: 'demo', email: 'admin@demo.local' });
      setLoading(false);
      return;
    }

    // Validate stored token
    api.setAuthToken(token);
    api.get<{ member: TeamMember }>('/api/team/me')
      .then(({ member }) => {
        setUser({ id: member.id, email: member.email });
        setTeamMember(member);
        setLoading(false);
      })
      .catch(() => {
        // Token invalid — clear and fall back to demo
        localStorage.removeItem(TOKEN_KEY);
        api.setAuthToken(null);
        setUser({ id: 'demo', email: 'admin@demo.local' });
        setLoading(false);
      });
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.post<{ token: string; member: TeamMember }>('/api/team/login', { email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    api.setAuthToken(res.token);
    setUser({ id: res.member.id, email: res.member.email });
    setTeamMember(res.member);
  };

  const signOut = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await api.post('/api/team/logout');
      } catch {
        // Ignore logout API errors
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    api.setAuthToken(null);
    setUser(null);
    setTeamMember(null);
  };

  return (
    <AuthContext.Provider value={{ user, teamMember, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
