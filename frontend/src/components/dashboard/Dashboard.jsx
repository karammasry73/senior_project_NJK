import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  Receipt,
  FileText,
  MailWarning,
  ArrowUpRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { listDocuments, listInvoices, listEmails, getSystemStatus } from '../../services/api';

const STATUS_META = {
  pending: { label: 'Pending', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  processed: { label: 'Processed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
};

const SERVICE_LABELS = {
  yolo: 'YOLOv8 - Document Layout',
  paddleocr: 'PaddleOCR',
  ollama: 'Ollama',
  voxtype: 'VoxType - Voice',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr.includes('T') ? dateStr : `${dateStr}Z`).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.round(diffHr / 24)} d ago`;
}

function last7DaysCounts(documents) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: 'short' });
    const count = documents.filter((doc) => (doc.upload_date || '').slice(0, 10) === key).length;
    days.push({ key, label, count });
  }
  return days;
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [emails, setEmails] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listDocuments(), listInvoices(), listEmails(), getSystemStatus()])
      .then(([docs, invs, mails, status]) => {
        setDocuments(docs);
        setInvoices(invs);
        setEmails(mails);
        setSystemStatus(status);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const unreadEmails = emails.filter((e) => !e.is_read && e.direction !== 'out').length;
  const invoicesNeedingReview = invoices.filter((i) => i.needs_review).length;
  const failedDocuments = documents.filter((d) => d.status === 'failed').length;
  const statusCounts = documents.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});
  const chartDays = last7DaysCounts(documents);
  const maxDayCount = Math.max(1, ...chartDays.map((d) => d.count));
  const recentDocuments = documents.slice(0, 5);
  const servicesOnline = systemStatus ? Object.values(systemStatus).filter((s) => s.available).length : 0;
  const servicesTotal = systemStatus ? Object.keys(systemStatus).length : 0;

  const stats = [
    { label: 'Documents', value: documents.length, icon: FileText, color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    { label: 'Invoices', value: invoices.length, icon: Receipt, color: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300' },
    { label: 'Emails Synced', value: emails.length, icon: Inbox, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
    { label: 'Unread Emails', value: unreadEmails, icon: MailWarning, color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Welcome back{user?.username ? `, ${user.username}` : ''}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Here's what's happening with your automated workflow.</p>
        </div>
        <button
          onClick={() => navigate('/documents')}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Zap className="h-4 w-4" />
          Quick Process
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
          {loadError} — is the backend running on :8000?
        </div>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className={`inline-flex rounded-lg p-2.5 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-6">
            <div className="col-span-2 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-white">Upload Volume</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Last 7 days</p>
                </div>
                <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {documents.length} total
                </span>
              </div>

              <div className="flex h-48 items-end gap-3">
                {chartDays.map((day) => (
                  <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg bg-amber-500 transition-colors hover:bg-amber-400"
                      style={{ height: `${Math.max(4, (day.count / maxDayCount) * 100)}%` }}
                      title={`${day.count} document${day.count === 1 ? '' : 's'}`}
                    />
                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">{day.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-4 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                {(['pending', 'processing', 'processed', 'failed']).map((status) => (
                  <div key={status} className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${STATUS_META[status].color}`}
                    >
                      {statusCounts[status] || 0}
                    </div>
                    <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">{STATUS_META[status].label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-zinc-900 dark:text-white">System Health</h4>
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    servicesOnline === servicesTotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                        servicesOnline === servicesTotal ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${servicesOnline === servicesTotal ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  </span>
                  {servicesOnline}/{servicesTotal} Online
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {systemStatus &&
                  Object.entries(systemStatus).map(([key, status]) => (
                    <div key={key} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className={`h-4 w-4 ${status.available ? 'text-amber-500' : 'text-zinc-300'}`} />
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {SERVICE_LABELS[key] || key}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            status.available
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                          }`}
                        >
                          {status.available ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-zinc-400 dark:text-zinc-500" title={status.detail}>
                        {status.detail}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-6">
            <div className="col-span-2 rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-white">Recent Documents</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Latest uploads</p>
                </div>
                <button
                  onClick={() => navigate('/documents')}
                  className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400"
                >
                  View all
                </button>
              </div>
              <div>
                {recentDocuments.length === 0 && (
                  <p className="px-6 py-8 text-center text-sm text-zinc-400">No documents uploaded yet.</p>
                )}
                {recentDocuments.map((doc, i) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between px-6 py-3.5 ${
                      i !== recentDocuments.length - 1 ? 'border-b border-zinc-50 dark:border-zinc-800/60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        <FileText className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{doc.filename}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{timeAgo(doc.upload_date)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {doc.confidence != null && (
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {Math.round(doc.confidence * 100)}% conf
                        </span>
                      )}
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[doc.status]?.color}`}>
                        {STATUS_META[doc.status]?.label ?? doc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="font-semibold text-zinc-900 dark:text-white">Needs Attention</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Real items across the app</p>

              <div className="mt-4 space-y-3">
                {failedDocuments === 0 && invoicesNeedingReview === 0 && unreadEmails === 0 && (
                  <div className="flex items-center rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                    <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 text-emerald-500" />
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">Nothing needs attention right now.</p>
                  </div>
                )}
                {failedDocuments > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-xs text-red-800 dark:text-red-200">
                      <strong>{failedDocuments}</strong> document{failedDocuments === 1 ? '' : 's'} failed processing.
                    </p>
                  </div>
                )}
                {invoicesNeedingReview > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>{invoicesNeedingReview}</strong> invoice{invoicesNeedingReview === 1 ? '' : 's'} flagged for review.
                    </p>
                  </div>
                )}
                {unreadEmails > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>{unreadEmails}</strong> unread email{unreadEmails === 1 ? '' : 's'} waiting.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
