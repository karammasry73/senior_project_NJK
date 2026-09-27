import { useState } from 'react';
import { Search, Bell, Mic, Cpu, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/documents': 'Document Management',
  '/invoices': 'Invoice Processing',
  '/emails': 'Email Manager',
  '/voice': 'AI Assistant',
  '/settings': 'Settings',
};

export default function Topbar({ dark, onToggleTheme }) {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between bg-white px-6 shadow-md shadow-zinc-200/50 transition-colors dark:bg-zinc-900 dark:shadow-black/30">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          {title}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          AI-Powered Business Process Automation
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, invoices..."
            className="w-72 rounded-lg border border-zinc-200/70 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-700 transition-colors placeholder:text-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700/70 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
          />
        </div>

        <div className="flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-50 px-3.5 py-1.5 dark:border-zinc-700/70 dark:bg-zinc-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Ollama
          </span>
          <Cpu className="h-3.5 w-3.5 text-zinc-400" />
        </div>

        <button
          onClick={onToggleTheme}
          className="rounded-full border border-zinc-200/70 p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700/70 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button className="relative rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <button className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
          <Mic className="h-4 w-4 text-amber-500" />
          Start Voice
        </button>
      </div>
    </header>
  );
}