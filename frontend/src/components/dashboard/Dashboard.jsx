import {
  Inbox,
  Receipt,
  FileText,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const stats = [
  {
    label: 'Documents Processed',
    value: '1,284',
    change: '+12.5%',
    icon: FileText,
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
    trend: 'up',
  },
  {
    label: 'Invoices Extracted',
    value: '342',
    change: '+8.2%',
    icon: Receipt,
    color: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300',
    trend: 'up',
  },
  {
    label: 'Emails Categorized',
    value: '2,847',
    change: '+23.1%',
    icon: Inbox,
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    trend: 'up',
  },
  {
    label: 'Time Saved (hrs)',
    value: '156',
    change: '+15.4%',
    icon: Clock,
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    trend: 'up',
  },
];

const recentDocuments = [
  {
    id: 1,
    name: 'invoice_acme_corp_march.pdf',
    type: 'Invoice',
    status: 'Processed',
    statusColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    time: '2 min ago',
    confidence: 98,
  },
  {
    id: 2,
    name: 'purchase_order_2024.pdf',
    type: 'Document',
    status: 'Processed',
    statusColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    time: '15 min ago',
    confidence: 95,
  },
  {
    id: 3,
    name: 'scan_receipt_0145.jpg',
    type: 'Receipt',
    status: 'Review Needed',
    statusColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    time: '1 hr ago',
    confidence: 72,
  },
  {
    id: 4,
    name: 'supplier_contract_v2.pdf',
    type: 'Contract',
    status: 'Processing',
    statusColor: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    time: '2 hrs ago',
    confidence: null,
  },
  {
    id: 5,
    name: 'email_chain_client_renewal.txt',
    type: 'Email',
    status: 'Processed',
    statusColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    time: '3 hrs ago',
    confidence: 96,
  },
];

const pipelineSteps = [
  { label: 'YOLO Layout Detection', status: 'active', progress: 100 },
  { label: 'PaddleOCR Extraction', status: 'active', progress: 100 },
  { label: 'Ollama Data Structuring', status: 'active', progress: 64 },
  { label: 'Validation & Storage', status: 'pending', progress: 0 },
];

export default function Dashboard() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Welcome back, Karam
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Here's what's happening with your automated workflow.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90">
          <Zap className="h-4 w-4" />
          Quick Process
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, change, icon: Icon, color }) => (
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
                {change}
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              {value}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">
                Processing Volume
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Last 7 days
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ArrowUpRight className="h-3.5 w-3.5" />
              32.5%
            </span>
          </div>

          <div className="flex h-48 items-end gap-3">
            {[42, 65, 38, 82, 58, 90, 71].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-purple-500 transition-all hover:from-indigo-400 hover:to-purple-400"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.status === 'active'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                    {step.label}
                  </p>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h4 className="font-semibold text-slate-900 dark:text-white">
            Model Performance
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI accuracy overview
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Extraction Accuracy
                </span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                  96.4%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-[96%] rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Classification
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                  98.1%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Summarization Quality
                </span>
                <span className="font-semibold text-purple-600 dark:text-purple-300">
                  94.2%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Voice Command Accuracy
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-300">
                  91.7%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-xs text-slate-600 dark:text-slate-300">
              All AI services running in offline mode via Ollama
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">
                Recent Documents
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latest processed files
              </p>
            </div>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              View all
            </button>
          </div>
          <div>
            {recentDocuments.map((doc, i) => (
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
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {doc.name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {doc.time}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {doc.confidence && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {doc.confidence}% conf
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${doc.statusColor}`}
                  >
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              System Health
            </h4>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              All Systems Operational
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  YOLOv8 - Document Layout
                </span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Online
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  PaddleOCR
                </span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Online
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ollama - llama3.1:8b
                </span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Online
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  VoxType - Voice
                </span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Online
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>3 documents</strong> flagged for review due to low OCR
                confidence scores. Processing continues normally.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}