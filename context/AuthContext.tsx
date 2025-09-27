import { createContext, useContext, useEffect, useState } from 'react';
import axios from '@/utils/axiosInstance';
import { useRouter } from 'next/router';

type User = { userId: number; role: string; name: string };

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const setTokenHeader = (t: string | null) => {
    if (t) axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    else delete axios.defaults.headers.common['Authorization'];
  };

  const refresh = async () => {
    try {
      const t = localStorage.getItem('token');
      setToken(t);
      setTokenHeader(t);
      if (t) {
        const res = await axios.get('/auth/me');
        setUser(res.data?.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email: string, password: string) => {
    const res = await axios.post('/auth/login', { email, password });
    const t = res.data?.access_token;
    localStorage.setItem('token', t);
    setToken(t);
    setTokenHeader(t);
    await refresh();
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setTokenHeader(null);
    router.push('/login');
  };

  const value: AuthState = { user, token, loading, login, logout, refresh };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
