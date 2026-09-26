import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Inbox,
  Receipt,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Loader2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { listDocuments, listInvoices, listEmails, getSystemStatus } from '../../services/api';

const POLL_MS = 5000;

const STATUS_META = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  processed: { label: 'Processed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
};

const SERVICES = [
  { key: 'yolo', label: 'YOLO - Document Layout', icon: Zap },
  { key: 'paddleocr', label: 'PaddleOCR', icon: Zap },
  { key: 'ollama', label: 'Ollama LLM', icon: Zap },
  { key: 'voxtype', label: 'VoxType - Voice', icon: Zap },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z')).getTime();
  if (Number.isNaN(then)) return dateStr;
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [emails, setEmails] = useState([]);
  const [system, setSystem] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const prevCounts = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [docs, inv, em, sys] = await Promise.all([
        listDocuments(),
        listInvoices(),
        listEmails(),
        getSystemStatus(),
      ]);
      prevCounts.current = { documents: docs.length, invoices: inv.length, emails: em.length };
      setDocuments(docs);
      setInvoices(inv);
      setEmails(em);
      setSystem(sys);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const processedCount = documents.filter((d) => d.status === 'processed').length;
  const reviewCount = invoices.filter((i) => i.needs_review).length;
  const categorizedCount = emails.filter((e) => e.category).length;
  const activeCount = documents.filter((d) => d.status === 'pending' || d.status === 'processing').length;

  const stats = [
    {
      label: 'Documents Processed',
      value: processedCount.toLocaleString(),
      postfix: activeCount > 0 ? ` (${activeCount} active)` : '',
      icon: FileText,
      color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
    },
    {
      label: 'Invoices Extracted',
      value: invoices.length.toLocaleString(),
      postfix: reviewCount > 0 ? ` (${reviewCount} review)` : '',
      icon: Receipt,
      color: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300',
    },
    {
      label: 'Emails Categorized',
      value: categorizedCount.toLocaleString(),
      postfix: emails.length > categorizedCount ? ` of ${emails.length}` : '',
      icon: Inbox,
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    },
    {
      label: 'Awaiting Review',
      value: reviewCount.toLocaleString(),
      postfix: '',
      icon: AlertTriangle,
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    },
  ];

  const avgConfidence = documents.length
    ? Math.round((documents.reduce((sum, d) => sum + (d.confidence ?? 0), 0) / documents.length) * 100)
    : null;
  const invoiceReviewPct = invoices.length ? Math.round((reviewCount / invoices.length) * 100) : null;
  const emailCategoryPct = emails.length ? Math.round((categorizedCount / emails.length) * 100) : null;

  const performance = [
    { label: 'Avg OCR Confidence', value: avgConfidence, color: 'from-indigo-500 to-purple-500' },
    { label: 'Emails Categorized', value: emailCategoryPct, color: 'from-emerald-500 to-teal-500' },
    { label: 'Invoices Needing Review', value: invoiceReviewPct, color: 'from-amber-500 to-orange-500' },
  ];

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);
    const count = documents.filter((d) => (d.upload_date || '').slice(0, 10) === day).length;
    last7.push({ day, count });
  }
  const peak = Math.max(1, ...last7.map((d) => d.count));
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const recentDocuments = [...documents]
    .sort((a, b) => (b.id > a.id ? 1 : -1))
    .slice(0, 6);

  const onlineServices = system
    ? [system.yolo, system.paddleocr, system.ollama, system.voxtype].filter((s) => s?.available).length
    : 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Welcome back, Karam</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Here's what's happening with your automated workflow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live · {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90">
            <Zap className="h-4 w-4" />
            Quick Process
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
          {error} — is the backend running on :8000?
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, postfix, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-lg p-2.5 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                live
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              {value}
              {postfix && <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">{postfix}</span>}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">Processing Volume</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Documents uploaded, last 7 days</p>
            </div>
          </div>

          <div className="flex h-48 items-end gap-3">
            {last7.map(({ day, count }, i) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{count || ''}</span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-purple-500 transition-all hover:from-indigo-400 hover:to-purple-400"
                  style={{ height: `${Math.round((count / peak) * 100) || 2}%` }}
                />
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{dayLabels[i]}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">YOLO Layout Detection</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">PaddleOCR Extraction</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Clock className="h-4 w-4" />
              </div>
              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                {activeCount} doc{activeCount === 1 ? '' : 's'} in queue
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h4 className="font-semibold text-slate-900 dark:text-white">Live Metrics</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Computed from your data</p>

          <div className="mt-5 space-y-4">
            {performance.map(({ label, value, color }) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                    {value != null ? `${value}%` : '—'}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  {value != null && (
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color}`}
                      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {system ? `${onlineServices} of 4 AI services online` : 'Checking AI services...'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">Recent Documents</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Latest processed files</p>
            </div>
          </div>
          <div>
            {recentDocuments.length === 0 && !error && (
              <p className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                No documents yet. Upload a file from the Documents page to get started.
              </p>
            )}
            {recentDocuments.map((doc, i) => {
              const meta = STATUS_META[doc.status] ?? STATUS_META.pending;
              const confidencePct = doc.confidence != null ? Math.round(doc.confidence * 100) : null;
              return (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between px-6 py-3.5 ${
                    i !== recentDocuments.length - 1
                      ? 'border-b border-slate-50 dark:border-slate-800/60'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{doc.filename}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {doc.file_type?.toUpperCase()} · {timeAgo(doc.upload_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {confidencePct != null && (
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {confidencePct}% conf
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.color}`}>{meta.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900 dark:text-white">System Health</h4>
            {system && (
              <span
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  onlineServices === 4
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                </span>
                {onlineServices === 4 ? 'All Systems Operational' : `${onlineServices}/${4} online`}
              </span>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {SERVICES.map(({ key, label }) => {
              const status = system?.[key];
              return (
                <div key={key} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                  </div>
                  {!system ? (
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking
                    </span>
                  ) : status?.available ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Online
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      Offline
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {system?.ollama && !system.ollama.available && (
            <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">{system.ollama.detail}</p>
          )}

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {reviewCount > 0 ? (
                  <>
                    <strong>{reviewCount} invoice{reviewCount === 1 ? '' : 's'}</strong> flagged for review due to low
                    confidence scores. Processing continues normally.
                  </>
                ) : (
                  'No low-confidence items awaiting review.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}