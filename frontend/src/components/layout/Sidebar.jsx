import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Mail,
  Bot,
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
  { to: '/voice', label: 'AI Assistant', icon: Bot },
];

export default function Sidebar({ user, onLogout }) {
  const items = user.role === 'admin' ? [...navItems, { to: '/users', label: 'User Management', icon: Users }] : navItems;

  return (
    <aside className="flex w-64 flex-col bg-zinc-900 text-zinc-100">
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500">
          <Database className="h-5 w-5 text-zinc-900" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white">
            SME Automation
          </h1>
          <p className="text-[11px] font-medium text-zinc-500">
            AI Assistant
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 border-l-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-amber-500 bg-zinc-800/80 text-white'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 border-l-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'border-amber-500 bg-zinc-800/80 text-white'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`
          }
        >
          <Settings className="h-5 w-5" />
          Settings
        </NavLink>
      </div>

      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-zinc-100">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {user.username}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {user.role === 'admin' ? 'Administrator' : 'User'}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
