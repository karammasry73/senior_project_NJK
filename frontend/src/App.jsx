import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Dashboard from './components/dashboard/Dashboard';
import Documents from './components/documents/Documents';
import Invoices from './components/invoices/Invoices';
import Emails from './components/emails/Emails';
import Voice from './components/voice/Voice';
import Settings from './components/settings/Settings';
import Login from './components/auth/Login';
import UserManagement from './components/users/UserManagement';
import { getMe, getToken, logout as apiLogout } from './services/api';

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('sme-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('sme-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('sme:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sme:unauthorized', onUnauthorized);
  }, []);

  async function handleLogout() {
    await apiLogout();
    setUser(null);
  }

  if (checkingSession) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950" />;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar dark={dark} onToggleTheme={() => setDark((d) => !d)} />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/emails" element={<Emails />} />
              <Route path="/voice" element={<Voice />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/users"
                element={user.role === 'admin' ? <UserManagement currentUser={user} /> : <Navigate to="/dashboard" replace />}
              />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
