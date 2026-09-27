import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mail,
  Search,
  Loader2,
  Sparkles,
  Bot,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  LayoutList,
  LayoutGrid,
  History,
  Undo2,
  EyeOff,
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
  saveEmailPosition,
  restoreEmail,
  markEmailRead,
  deleteEmail,
  nameSender,
  getSystemStatus,
} from '../../services/api';
import EmailSpace from './EmailSpace';
import EmailDetailPanel from './EmailDetailPanel';
import { CATEGORY_META } from './emailMeta';

const CATEGORY_FILTERS = ['All', 'Urgent', 'Follow-up', 'Info', 'Action', 'Spam'];

const RANGE_PRESETS = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: 'All', days: null },
];

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
  const [draftInstructions, setDraftInstructions] = useState('');
  const [connectBanner, setConnectBanner] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'board'
  const [composing, setComposing] = useState(false); // manual (no-AI) reply box forced open, in the list modal
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [classifyAllProgress, setClassifyAllProgress] = useState(null); // {done, total}
  const [range, setRange] = useState({ label: 'Recent', after: null, before: null });
  const [rangeOpen, setRangeOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [lastDeleted, setLastDeleted] = useState(null); // {email, timeoutId}
  const [hidePromotions, setHidePromotions] = useState(
    () => localStorage.getItem('sme-hide-promotions') === '1'
  );
  const undoTimeoutRef = useRef(null);

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
    setComposing(false);
    setDraftInstructions('');
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

  useEffect(() => {
    localStorage.setItem('sme-hide-promotions', hidePromotions ? '1' : '0');
  }, [hidePromotions]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncEmails(range.after, range.before);
      await refreshEmails();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  function applyPreset(days) {
    const after = days == null ? null : Math.floor(Date.now() / 1000) - days * 86400;
    setRange({ label: days == null ? 'All' : `${days} days`, after, before: null });
    setRangeOpen(false);
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    const after = Math.floor(new Date(customFrom).getTime() / 1000);
    const before = Math.floor(new Date(customTo).getTime() / 1000) + 86400; // include the whole "to" day
    if (after > before) return;
    setRange({ label: `${customFrom} → ${customTo}`, after, before });
    setRangeOpen(false);
  }

  function handleBoardDelete(email) {
    setEmails((prev) => prev.filter((e) => e.id !== email.id));
    if (selectedId === email.id) setSelectedId(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setLastDeleted(null), 8000);
    setLastDeleted(email);
  }

  async function handleUndoDelete() {
    if (!lastDeleted) return;
    clearTimeout(undoTimeoutRef.current);
    const email = lastDeleted;
    setLastDeleted(null);
    try {
      const restored = await restoreEmail(email);
      setEmails((prev) => [restored, ...prev]);
    } catch (err) {
      setLoadError(err.message);
    }
  }

  async function handlePositionChange(id, x, y) {
    try {
      await saveEmailPosition(id, x, y);
    } catch (err) {
      setLoadError(err.message);
    }
  }

  async function handleMarkSelected() {
    if (!selectedDetail) return;
    await runAction('mark', (id) => markEmailRead(id, !selectedDetail.is_read));
  }

  async function handleRenameSelected() {
    if (!selectedDetail) return;
    const name = window.prompt('Custom name for this sender:', selectedDetail.custom_name || '');
    if (!name) return;
    await runAction('rename', (id) => nameSender(id, name));
    refreshEmails();
  }

  async function handleDeleteSelected() {
    if (!selectedDetail) return;
    setActionLoading('delete');
    setActionError(null);
    try {
      await deleteEmail(selectedId);
      handleBoardDelete(selectedDetail);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
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
      // A send also inserts a new "out" row in the same thread on the
      // backend (the reply itself) - reload the full list so that new
      // branch node shows up on the board, not just the updated original.
      await refreshEmails();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  function switchView(next) {
    setView(next);
    setSelectedId(null);
  }

  function handleBoardUpdate(updated) {
    setEmails((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
  }

  async function handleClassifyAll() {
    const targets = emails.filter((e) => !e.category);
    if (targets.length === 0) return;
    setClassifyingAll(true);
    setClassifyAllProgress({ done: 0, total: targets.length });
    // Sequential, not Promise.all: Ollama runs one local model on this CPU,
    // so firing every request at once would just queue them anyway while
    // making the progress counter useless.
    for (let i = 0; i < targets.length; i++) {
      try {
        const updated = await classifyEmail(targets[i].id);
        setEmails((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      } catch (err) {
        setLoadError(err.message);
      }
      setClassifyAllProgress({ done: i + 1, total: targets.length });
    }
    setClassifyingAll(false);
    setClassifyAllProgress(null);
  }

  const filtered = emails.filter((e) => {
    const haystack = `${e.subject ?? ''} ${e.sender ?? ''}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === 'All' || CATEGORY_META[e.category]?.label === categoryFilter;
    const matchesPromotions = !hidePromotions || e.gmail_category !== 'promotions';
    return matchesSearch && matchesCategory && matchesPromotions;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Email Manager</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
        <p className="text-sm text-zinc-400">Loading...</p>
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Mail className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">Connect your Gmail account</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Email content is sent to Google to fetch/send mail - AI processing (classify/summarize/draft) stays local via Ollama.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Connect Gmail
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
            <div className="flex gap-2">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setCategoryFilter(filter)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    categoryFilter === filter
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
                <button
                  onClick={() => switchView('list')}
                  title="List view"
                  className={`rounded-md p-1.5 transition-colors ${
                    view === 'list'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => switchView('board')}
                  title="Board view - categorized 2D space with threaded branches"
                  className={`rounded-md p-1.5 transition-colors ${
                    view === 'board'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => setHidePromotions((v) => !v)}
                title="Hide promotional emails (Gmail's own Promotions category)"
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  hidePromotions
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Promotions
              </button>
              <button
                onClick={handleClassifyAll}
                disabled={classifyingAll || !emails.some((e) => !e.category)}
                title="Classify every unclassified email with Ollama"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {classifyingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {classifyingAll ? `Classifying ${classifyAllProgress.done}/${classifyAllProgress.total}...` : 'Classify All'}
              </button>
              <div className="relative">
                <button
                  onClick={() => setRangeOpen((v) => !v)}
                  title="Choose how far back to sync"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <History className="h-3.5 w-3.5" />
                  {range.label}
                </button>
                {rangeOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="flex flex-wrap gap-1.5">
                      {RANGE_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => applyPreset(p.days)}
                          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2.5 space-y-1.5 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      />
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      />
                      <button
                        onClick={applyCustomRange}
                        disabled={!customFrom || !customTo}
                        className="w-full rounded-md bg-zinc-900 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Apply custom range
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Gmail'}
              </button>
            </div>
          </div>

          <div className="relative border-b border-zinc-100 p-4 dark:border-zinc-800">
            <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject or sender..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
            />
          </div>

          {view === 'board' ? (
            <div className="p-4">
              <EmailSpace
                emails={filtered}
                onUpdate={handleBoardUpdate}
                onSent={refreshEmails}
                onPositionChange={handlePositionChange}
                onDelete={handleBoardDelete}
              />
            </div>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {filtered.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  {emails.length === 0 ? 'No emails synced yet. Click "Sync Gmail" to fetch your inbox.' : 'No emails match this filter.'}
                </p>
              )}
              {filtered.map((email) => {
                const meta = CATEGORY_META[email.category];
                return (
                  <button
                    key={email.id}
                    onClick={() => setSelectedId(email.id)}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {(email.sender ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm text-zinc-800 dark:text-zinc-200 ${
                          !email.is_read && email.direction !== 'out' ? 'font-bold' : 'font-medium'
                        }`}
                      >
                        {email.subject || '(no subject)'}
                      </p>
                      <p className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {email.direction === 'out' ? 'You' : email.custom_name || email.sender}
                      </p>
                    </div>
                    {!email.is_read && email.direction !== 'out' && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Unread" />
                    )}
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
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${meta?.color ?? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}
                    >
                      {meta?.label ?? 'Unclassified'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'list' && selectedId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-zinc-900">
            <EmailDetailPanel
              detail={selectedDetail}
              actionError={actionError}
              actionLoading={actionLoading}
              draftText={draftText}
              setDraftText={setDraftText}
              composing={composing}
              instructions={draftInstructions}
              setInstructions={setDraftInstructions}
              onClassify={() => runAction('classify', classifyEmail)}
              onSummarize={() => runAction('summarize', summarizeEmail)}
              onDraft={() => runAction('draft', (id) => draftEmail(id, draftInstructions))}
              onReply={() => setComposing(true)}
              onSend={handleSend}
              onMark={handleMarkSelected}
              onRename={handleRenameSelected}
              onDelete={handleDeleteSelected}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>
      )}

      {lastDeleted && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-xl dark:bg-zinc-800">
          <span>Email moved to trash.</span>
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
