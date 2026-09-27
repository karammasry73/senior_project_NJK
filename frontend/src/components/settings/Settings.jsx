import { useEffect, useState } from 'react';
import {
  Bot,
  ScanLine,
  Mic,
  Mail,
  Database,
  Users as UsersIcon,
  Shield,
  HardDrive,
  Cpu,
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getSystemStatus, getStats, getEmailAuthStatus, flushDocuments } from '../../services/api';

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function StatusRow({ icon: Icon, label, status }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 ${status?.available ? 'text-emerald-500' : 'text-zinc-300'}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
          <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500" title={status?.detail}>
            {status?.detail || '...'}
          </p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          status?.available
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
        }`}
      >
        {status?.available ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

export default function Settings({ user }) {
  const [systemStatus, setSystemStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [emailAuth, setEmailAuth] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState(null);
  const [confirmingFlush, setConfirmingFlush] = useState(false);

  const isAdmin = user?.role === 'admin';

  const refresh = () => {
    Promise.all([getSystemStatus(), getStats(), getEmailAuthStatus()])
      .then(([status, s, auth]) => {
        setSystemStatus(status);
        setStats(s);
        setEmailAuth(auth);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err.message));
  };

  useEffect(() => {
    refresh();
  }, []);

  async function handleFlush() {
    setFlushing(true);
    setLoadError(null);
    try {
      const result = await flushDocuments();
      setFlushResult(result.deleted);
      setConfirmingFlush(false);
      refresh();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setFlushing(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Settings</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Real system status and data - nothing here is a mockup.
        </p>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
          {loadError} — is the backend running on :8000?
        </div>
      )}

      {!systemStatus || !stats ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                    <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-white">AI Services</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Live status, not a mock</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-5">
                <StatusRow icon={Bot} label={`Ollama · ${stats.ollama_model}`} status={systemStatus.ollama} />
                <StatusRow icon={ScanLine} label="YOLOv8 Detection" status={systemStatus.yolo} />
                <StatusRow icon={ScanLine} label="PaddleOCR" status={systemStatus.paddleocr} />
                <StatusRow icon={Mic} label="VoxType Voice" status={systemStatus.voxtype} />
              </div>
              <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Ollama Endpoint
                </label>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {stats.ollama_host}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                  Model and endpoint are set via <code>backend/.env</code> - not editable here yet.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Gmail Connection</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Email Manager integration</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">OAuth client configured</span>
                  {emailAuth?.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Account connected</span>
                  {emailAuth?.connected ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-300" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                    <Database className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Data</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Real counts from SQLite</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Documents</p>
                    <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-200">{stats.documents}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Invoices</p>
                    <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-200">{stats.invoices}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Emails</p>
                    <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-200">{stats.emails}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <UsersIcon className="h-3 w-3" /> Users
                    </p>
                    <p className="mt-1 text-xl font-bold text-zinc-800 dark:text-zinc-200">{stats.users}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Database</span>
                    </div>
                    <p className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatBytes(stats.db_size_bytes)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Uploads</span>
                    </div>
                    <p className="mt-1 font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatBytes(stats.uploads_size_bytes)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="rounded-xl border border-red-200 bg-white shadow-sm dark:border-red-500/30 dark:bg-zinc-900">
                <div className="flex items-center gap-2.5 border-b border-red-100 px-5 py-4 dark:border-red-500/20">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Danger Zone</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Admin only - cannot be undone</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Clear all documents &amp; invoices
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        Deletes every uploaded document, its files on disk, and every invoice extracted from one.
                        Emails and users are not affected.
                      </p>
                    </div>
                  </div>

                  {!confirmingFlush ? (
                    <button
                      onClick={() => setConfirmingFlush(true)}
                      className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear all documents &amp; invoices
                    </button>
                  ) : (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Delete all {stats.documents} document{stats.documents === 1 ? '' : 's'} and {stats.invoices} invoice
                        {stats.invoices === 1 ? '' : 's'}? This cannot be undone.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleFlush}
                          disabled={flushing}
                          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {flushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Yes, delete everything
                        </button>
                        <button
                          onClick={() => setConfirmingFlush(false)}
                          disabled={flushing}
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {flushResult != null && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Deleted {flushResult} document{flushResult === 1 ? '' : 's'} (and their invoices).
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Shield className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Privacy &amp; Security</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">All AI processing is offline</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Uploaded documents stored locally only</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Enabled
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">No external API calls for AI tasks</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <Cpu className="h-3.5 w-3.5" />
                    Ollama local
                  </span>
                </div>
                {user && (
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Signed in as</span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {user.username} · {user.role}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
