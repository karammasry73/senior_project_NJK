import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Mail,
  Mic,
  Settings,
  Database,
  Users,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/invoices', label: 'Invoices', icon: Receipt },
  { to: '/emails', label: 'Email Manager', icon: Mail },
  { to: '/voice', label: 'Voice Assistant', icon: Mic },
];

export default function Sidebar({ user, onLogout }) {
  const items = user.role === 'admin' ? [...navItems, { to: '/users', label: 'User Management', icon: Users }] : navItems;

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600">
          <Database className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            SME Automation
          </h1>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            AI Assistant
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
            }`
          }
        >
          <Settings className="h-5 w-5" />
          Settings
        </NavLink>
      </div>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {user.username}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.role === 'admin' ? 'Administrator' : 'User'}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
