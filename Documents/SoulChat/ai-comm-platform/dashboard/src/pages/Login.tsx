import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export function Login() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהתחברות');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">כניסה למערכת</h1>
          <p className="text-sm text-gray-500 mt-1">AI Comm Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <LoadingSpinner size={16} className="text-white" />}
            כניסה
          </button>
        </form>
      </div>
    </div>
  );
}
