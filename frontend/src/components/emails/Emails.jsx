import { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  Search,
  Loader2,
  Sparkles,
  Bot,
  Send,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  getEmailAuthStatus,
  getEmailAuthUrl,
  syncEmails,
  listEmails,
  getEmail,
  classifyEmail,
  summarizeEmail,
  draftEmail,
  sendEmail,
  getSystemStatus,
} from '../../services/api';

const CATEGORY_META = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  follow_up: { label: 'Follow-up', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  informational: { label: 'Info', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  action: { label: 'Action', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' },
  spam: { label: 'Spam', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const CATEGORY_FILTERS = ['All', 'Urgent', 'Follow-up', 'Info', 'Action', 'Spam'];

export default function Emails() {
  const [authStatus, setAuthStatus] = useState(null);
  const [ollamaAvailable, setOllamaAvailable] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // 'classify' | 'summarize' | 'draft' | 'send' | null
  const [draftText, setDraftText] = useState('');
  const [connectBanner, setConnectBanner] = useState(null);

  const refreshAuth = useCallback(async () => {
    try {
      const status = await getEmailAuthStatus();
      setAuthStatus(status);
      return status;
    } catch (err) {
      setLoadError(err.message);
      return null;
    }
  }, []);

  const refreshEmails = useCallback(async () => {
    try {
      const rows = await listEmails();
      setEmails(rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    getSystemStatus()
      .then((s) => setOllamaAvailable(s.ollama.available))
      .catch(() => setOllamaAvailable(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected')) {
      setConnectBanner({ type: 'success', text: 'Gmail connected successfully.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('gmail_error')) {
      setConnectBanner({ type: 'error', text: `Gmail connection failed: ${params.get('gmail_error')}` });
      window.history.replaceState({}, '', window.location.pathname);
    }

    refreshAuth().then((status) => {
      if (status?.connected) refreshEmails();
    });
  }, [refreshAuth, refreshEmails]);

  useEffect(() => {
    if (selectedId == null) {
      setSelectedDetail(null);
      setActionError(null);
      return;
    }
    getEmail(selectedId)
      .then((detail) => {
        setSelectedDetail(detail);
        setDraftText(detail.drafted_reply ?? '');
      })
      .catch((err) => setLoadError(err.message));
  }, [selectedId]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await getEmailAuthUrl();
      window.location.href = url;
    } catch (err) {
      setLoadError(err.message);
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await syncEmails();
      await refreshEmails();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function runAction(action, fn) {
    setActionLoading(action);
    setActionError(null);
    try {
      const updated = await fn(selectedId);
      setSelectedDetail(updated);
      if (action === 'draft') setDraftText(updated.drafted_reply ?? '');
      setEmails((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSend() {
    setActionLoading('send');
    setActionError(null);
    try {
      const updated = await sendEmail(selectedId, draftText);
      setSelectedDetail(updated);
      setEmails((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = emails.filter((e) => {
    const haystack = `${e.subject ?? ''} ${e.sender ?? ''}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === 'All' || CATEGORY_META[e.category]?.label === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Email Manager</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gmail fetches your mail · Ollama classifies, summarizes, and drafts replies locally
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            ollamaAvailable
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          {ollamaAvailable == null ? 'Checking Ollama...' : ollamaAvailable ? 'Ollama Active' : 'Ollama Unavailable'}
        </span>
      </div>

      {connectBanner && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
            connectBanner.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
          }`}
        >
          {connectBanner.text}
        </div>
      )}

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
          {loadError} — is the backend running on :8000?
        </div>
      )}

      {!authStatus ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : !authStatus.configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Gmail isn't configured yet
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-200">
            Create an OAuth client at{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              console.cloud.google.com <ExternalLink className="h-3 w-3" />
            </a>{' '}
            (type: Web application, with the Gmail API enabled), add{' '}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">
              http://localhost:8000/api/emails/auth/callback
            </code>{' '}
            as an authorized redirect URI, then set <code>SME_GOOGLE_CLIENT_ID</code> and{' '}
            <code>SME_GOOGLE_CLIENT_SECRET</code> in <code>backend/.env</code> and restart the backend.
          </p>
        </div>
      ) : !authStatus.connected ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Mail className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Connect your Gmail account</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Email content is sent to Google to fetch/send mail - AI processing (classify/summarize/draft) stays local via Ollama.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Connect Gmail
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex gap-2">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setCategoryFilter(filter)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    categoryFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Gmail'}
            </button>
          </div>

          <div className="relative border-b border-slate-100 p-4 dark:border-slate-800">
            <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject or sender..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
          </div>

          <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {filtered.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                {emails.length === 0 ? 'No emails synced yet. Click "Sync Gmail" to fetch your inbox.' : 'No emails match this filter.'}
              </p>
            )}
            {filtered.map((email) => {
              const meta = CATEGORY_META[email.category];
              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedId(email.id)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                    {(email.sender ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {email.subject || '(no subject)'}
                    </p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{email.sender}</p>
                  </div>
                  {email.summary && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-purple-400">
                      <Sparkles className="h-3 w-3" />
                      Summarized
                    </span>
                  )}
                  {email.sent && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" />
                      Replied
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${meta?.color ?? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                  >
                    {meta?.label ?? 'Unclassified'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {selectedDetail?.subject || 'Loading...'}
              </p>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!selectedDetail ? (
              <p className="p-5 text-sm text-slate-400">Loading...</p>
            ) : (
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>From: {selectedDetail.sender}</span>
                  <span>{selectedDetail.received_date}</span>
                  {selectedDetail.category && (
                    <span className={`rounded-full px-2 py-0.5 font-medium ${CATEGORY_META[selectedDetail.category]?.color}`}>
                      {CATEGORY_META[selectedDetail.category]?.label}
                    </span>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <pre className="whitespace-pre-wrap font-sans">{selectedDetail.body}</pre>
                </div>

                {actionError && (
                  <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
                    {actionError}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => runAction('classify', classifyEmail)}
                    disabled={actionLoading != null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {actionLoading === 'classify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Classify
                  </button>
                  <button
                    onClick={() => runAction('summarize', summarizeEmail)}
                    disabled={actionLoading != null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {actionLoading === 'summarize' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Summarize
                  </button>
                  <button
                    onClick={() => runAction('draft', draftEmail)}
                    disabled={actionLoading != null}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {actionLoading === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                    Draft Reply
                  </button>
                </div>

                {selectedDetail.summary && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">AI Summary</p>
                    <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3 text-xs leading-relaxed text-slate-700 dark:border-purple-500/20 dark:bg-purple-500/5 dark:text-slate-300">
                      <pre className="whitespace-pre-wrap font-sans">{selectedDetail.summary}</pre>
                    </div>
                  </div>
                )}

                {(selectedDetail.drafted_reply || draftText) && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        {selectedDetail.sent ? 'Sent Reply' : 'Draft Reply (edit before sending)'}
                      </p>
                      {selectedDetail.sent && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </span>
                      )}
                    </div>
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      disabled={selectedDetail.sent}
                      className="h-36 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-800/50"
                    />
                    {!selectedDetail.sent && (
                      <button
                        onClick={handleSend}
                        disabled={actionLoading != null || !draftText.trim()}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send Reply
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
