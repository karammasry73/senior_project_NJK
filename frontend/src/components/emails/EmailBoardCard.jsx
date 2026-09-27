import { useState } from 'react';
import {
  Loader2,
  Sparkles,
  Bot,
  CheckCircle2,
  Reply,
  ChevronDown,
  ChevronUp,
  Mail,
  MailOpen,
  Pencil,
  Trash2,
  Paperclip,
} from 'lucide-react';
import { CATEGORY_META } from './emailMeta';
import {
  classifyEmail,
  summarizeEmail,
  draftEmail,
  getEmail,
  markEmailRead,
  deleteEmail,
  nameSender,
  attachmentUrl,
} from '../../services/api';

export const CARD_W = 300;
// Nominal height used for branch-connector/layout math - the rendered card
// can grow a bit past this (summary length, etc); it just scrolls
// internally past CARD_MAX_H instead of overlapping the next thread row.
export const CARD_H = 340;
// The tallest a card can ever render (summary + attachments + draft box all expanded) -
// exported so EmailSpace's drag-clamp can reserve this much room, not just CARD_H, or a
// snapped-back card could still hang out past the region's bottom edge.
export const CARD_MAX_H = 480;

// A full "handy" card, not a compact block that pops a separate panel on
// click - classify/summarize/draft live directly on the card, so nothing
// ever opens over the canvas for those. Replying opens the Gmail-style
// ComposeModal instead (see onOpenCompose) - a card this small isn't a good
// place to actually write and review an email. Reports results up via
// onUpdate (merge) / onSent (something needs a full refetch) / onDelete
// (parent tracks it for undo).
export default function EmailBoardCard({ email, pos, isDragging, onCardPointerDown, onUpdate, onSent, onDelete, onOpenCompose }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalBody, setOriginalBody] = useState(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);

  const outgoing = email.direction === 'out';
  const meta = CATEGORY_META[email.category];
  const stop = (e) => e.stopPropagation();

  async function run(action, fn) {
    setBusy(action);
    setError(null);
    try {
      const updated = await fn();
      onUpdate(updated);
      return updated;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleDraft() {
    const updated = await run('draft', () => draftEmail(email.id, instructions));
    if (updated) onOpenCompose(updated, updated.drafted_reply || '');
  }

  async function handleMark() {
    setBusy('mark');
    setError(null);
    try {
      const updated = await markEmailRead(email.id, !email.is_read);
      onUpdate(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy('delete');
    setError(null);
    try {
      await deleteEmail(email.id);
      onDelete(email);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  async function handleRename() {
    const name = window.prompt('Custom name for this sender:', email.custom_name || '');
    if (!name) return;
    setBusy('rename');
    setError(null);
    try {
      const updated = await nameSender(email.id, name);
      onUpdate(updated);
      onSent(); // sender names apply to every email from that address - refetch so other cards pick it up too
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleOriginal() {
    if (showOriginal) {
      setShowOriginal(false);
      return;
    }
    setShowOriginal(true);
    if (originalBody == null) {
      setLoadingOriginal(true);
      try {
        const detail = await getEmail(email.id);
        setOriginalBody(detail.body || '(empty)');
      } catch (err) {
        setOriginalBody(`Failed to load: ${err.message}`);
      } finally {
        setLoadingOriginal(false);
      }
    }
  }

  return (
    <div
      data-email-block
      onPointerDown={(e) => onCardPointerDown(e, email.id)}
      style={{
        left: pos.x,
        top: pos.y,
        width: CARD_W,
        maxHeight: CARD_MAX_H,
        // No transition while actually being dragged (must track the cursor 1:1) -
        // otherwise animate, so a snap-back into the category box after release
        // (or a jump to a new box on reclassify) eases into place instead of
        // teleporting.
        transition: isDragging ? 'none' : 'left 200ms ease-out, top 200ms ease-out',
      }}
      className={`absolute flex touch-none flex-col gap-2 overflow-y-auto rounded-xl border p-3 text-left shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${
        outgoing
          ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-500/40 dark:bg-emerald-500/10'
          : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
      }`}
    >
      <div className="flex cursor-default items-center justify-between" onPointerDown={stop}>
        {!email.is_read && !outgoing ? (
          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase text-blue-500 dark:text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Unread
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-0.5">
          {!outgoing && (
            <button
              onClick={handleMark}
              disabled={busy != null}
              title={email.is_read ? 'Mark as unread' : 'Mark as read'}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800"
            >
              {busy === 'mark' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : email.is_read ? (
                <MailOpen className="h-3 w-3" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
            </button>
          )}
          {!outgoing && (
            <button
              onClick={handleRename}
              disabled={busy != null}
              title="Rename sender"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy != null}
            title="Delete (moves to Gmail trash)"
            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-500/10"
          >
            {busy === 'delete' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <div onPointerDown={stop} className="flex cursor-default items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`line-clamp-2 text-[12.5px] leading-snug text-zinc-800 dark:text-zinc-200 ${
              !email.is_read && !outgoing ? 'font-bold' : 'font-semibold'
            }`}
          >
            {email.subject || '(no subject)'}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">From </span>
            {outgoing ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">You</span>
            ) : (
              email.custom_name || email.sender || 'Unknown'
            )}
          </p>
          <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">To </span>
            {email.recipient || (outgoing ? 'them' : 'Unknown')}
          </p>
        </div>
        {meta && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${meta.color}`}>{meta.label}</span>
        )}
      </div>

      {outgoing && (
        <span
          onPointerDown={stop}
          className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-300"
        >
          <Reply className="h-3 w-3" /> You replied
        </span>
      )}

      {email.summary && (
        <div
          onPointerDown={stop}
          className="cursor-text select-text rounded-lg border border-purple-100 bg-purple-50/60 p-2 text-[10.5px] leading-relaxed text-zinc-700 dark:border-purple-500/20 dark:bg-purple-500/5 dark:text-zinc-300"
        >
          <p className="mb-1 select-none text-[9px] font-semibold uppercase text-purple-400">AI Summary</p>
          <pre className="whitespace-pre-wrap font-sans">{email.summary}</pre>
        </div>
      )}

      {email.attachments?.length > 0 && (
        <div className="flex flex-col gap-1" onPointerDown={stop}>
          <p className="text-[9px] font-semibold uppercase text-zinc-400">
            Attachments ({email.attachments.length})
          </p>
          {email.attachments.map((att) => (
            <a
              key={att.id}
              href={attachmentUrl(email.id, att.id)}
              download={att.filename || 'attachment'}
              className="flex items-center gap-1.5 truncate rounded-md border border-zinc-200 px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">{att.filename || 'attachment'}</span>
            </a>
          ))}
        </div>
      )}

      {error && (
        <p
          onPointerDown={stop}
          className="rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[10px] text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {!outgoing && (
        <input
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onPointerDown={stop}
          placeholder="Optional instructions for the AI draft..."
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] text-zinc-600 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        />
      )}

      {!outgoing && (
        <div className="grid grid-cols-2 gap-1.5" onPointerDown={stop}>
          <button
            onClick={() => run('classify', () => classifyEmail(email.id))}
            disabled={busy != null}
            title="Classify"
            className="flex items-center justify-center gap-1 rounded-md border border-zinc-200 py-1.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {busy === 'classify' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Classify
          </button>
          <button
            onClick={() => run('summarize', () => summarizeEmail(email.id))}
            disabled={busy != null}
            title="Summarize"
            className="flex items-center justify-center gap-1 rounded-md border border-zinc-200 py-1.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {busy === 'summarize' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Summarize
          </button>
          <button
            onClick={handleDraft}
            disabled={busy != null}
            title={email.drafted_reply ? 'Regenerate the AI draft, then open it in Compose' : 'Draft a reply with AI, then open it in Compose'}
            className="flex items-center justify-center gap-1 rounded-md bg-zinc-900 py-1.5 text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy === 'draft' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
            {email.drafted_reply ? 'Regenerate' : 'Draft'}
          </button>
          <button
            onClick={() => onOpenCompose(email, '')}
            disabled={busy != null}
            title="Compose a reply yourself, no AI"
            className="flex items-center justify-center gap-1 rounded-md border border-zinc-200 py-1.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
        </div>
      )}

      {email.sent && !outgoing && (
        <span
          onPointerDown={stop}
          className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-3 w-3" /> Replied
        </span>
      )}

      <button
        onClick={toggleOriginal}
        onPointerDown={stop}
        className="flex items-center gap-1 text-[9px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        {showOriginal ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showOriginal ? 'Hide original email' : 'View original email'}
      </button>
      {showOriginal && (
        <div
          onPointerDown={stop}
          className="max-h-28 overflow-y-auto rounded-md bg-zinc-50 p-2 text-[10px] leading-relaxed text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {loadingOriginal ? 'Loading...' : <pre className="whitespace-pre-wrap font-sans">{originalBody}</pre>}
        </div>
      )}
    </div>
  );
}
