import { Loader2, Sparkles, Bot, Send, Reply, CheckCircle2, X, Mail, MailOpen, Pencil, Trash2, Paperclip } from 'lucide-react';
import { CATEGORY_META } from './emailMeta';
import { attachmentUrl } from '../../services/api';

// The classify/summarize/draft/send workspace for one email - shared by the
// list view's popup modal and the board view's inline in-block expansion,
// so both stay in sync instead of duplicating this logic.
export default function EmailDetailPanel({
  detail,
  actionError,
  actionLoading,
  draftText,
  setDraftText,
  composing = false,
  instructions = '',
  setInstructions,
  onClassify,
  onSummarize,
  onDraft,
  onReply,
  onSend,
  onMark,
  onRename,
  onDelete,
  onClose,
  onHeaderMouseDown,
  compact = false,
}) {
  return (
    <div>
      <div
        onMouseDown={onHeaderMouseDown}
        className={`flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${
          compact ? 'cursor-grab px-3 py-2.5 active:cursor-grabbing' : 'px-5 py-4'
        }`}
      >
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
          {detail?.subject || 'Loading...'}
        </p>
        <div className="ml-2 flex shrink-0 items-center gap-0.5">
          {detail && onMark && (
            <button
              onClick={onMark}
              disabled={actionLoading != null}
              title={detail.is_read ? 'Mark as unread' : 'Mark as read'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              {actionLoading === 'mark' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : detail.is_read ? (
                <MailOpen className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
            </button>
          )}
          {detail && onRename && (
            <button
              onClick={onRename}
              disabled={actionLoading != null}
              title="Rename sender"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {detail && onDelete && (
            <button
              onClick={onDelete}
              disabled={actionLoading != null}
              title="Delete (moves to Gmail trash)"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-500/10"
            >
              {actionLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!detail ? (
        <p className="p-5 text-sm text-slate-400">Loading...</p>
      ) : (
        <div className={compact ? 'space-y-3 p-3' : 'space-y-4 p-5'}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">From: {detail.custom_name || detail.sender || 'Unknown'}</span>
            <span className="truncate">To: {detail.recipient || 'Unknown'}</span>
            {detail.category && (
              <span className={`rounded-full px-2 py-0.5 font-medium ${CATEGORY_META[detail.category]?.color}`}>
                {CATEGORY_META[detail.category]?.label}
              </span>
            )}
            {!detail.is_read && (
              <span className="flex items-center gap-1 font-medium text-blue-500 dark:text-blue-400">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Unread
              </span>
            )}
          </div>

          <div
            className={`overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${
              compact ? 'max-h-24' : 'max-h-40'
            }`}
          >
            <pre className="whitespace-pre-wrap font-sans">{detail.body}</pre>
          </div>

          {detail.attachments?.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Attachments ({detail.attachments.length})
              </p>
              {detail.attachments.map((att) => (
                <a
                  key={att.id}
                  href={attachmentUrl(detail.id, att.id)}
                  download={att.filename || 'attachment'}
                  className="flex items-center gap-1.5 truncate rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{att.filename || 'attachment'}</span>
                </a>
              ))}
            </div>
          )}

          {actionError && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
              {actionError}
            </p>
          )}

          {setInstructions && (
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Optional instructions for the AI draft..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClassify}
              disabled={actionLoading != null}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {actionLoading === 'classify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Classify
            </button>
            <button
              onClick={onSummarize}
              disabled={actionLoading != null}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {actionLoading === 'summarize' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Summarize
            </button>
            <button
              onClick={onDraft}
              disabled={actionLoading != null}
              title={detail.drafted_reply ? 'Regenerate the AI draft' : 'Draft a reply with AI'}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              {detail.drafted_reply ? 'Regenerate' : 'Draft Reply'}
            </button>
            <button
              onClick={onReply}
              disabled={actionLoading != null}
              title="Write a reply yourself, no AI"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          </div>

          {detail.summary && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">AI Summary</p>
              <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3 text-xs leading-relaxed text-slate-700 dark:border-purple-500/20 dark:bg-purple-500/5 dark:text-slate-300">
                <pre className="whitespace-pre-wrap font-sans">{detail.summary}</pre>
              </div>
            </div>
          )}

          {(composing || detail.drafted_reply || draftText) && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  {detail.sent ? 'Sent Reply' : detail.drafted_reply ? 'Draft Reply (edit before sending)' : 'Your Reply'}
                </p>
                {detail.sent && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Sent
                  </span>
                )}
              </div>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={detail.sent}
                className={`w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-800/50 ${
                  compact ? 'h-24' : 'h-36'
                }`}
              />
              {!detail.sent && (
                <button
                  onClick={onSend}
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
  );
}
