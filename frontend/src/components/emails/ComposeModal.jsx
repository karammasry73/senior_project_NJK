import { useState } from 'react';
import { Send, X, Loader2 } from 'lucide-react';
import { sendEmail } from '../../services/api';

// Gmail-style compose window: fixed to the corner of the screen (not part of
// the pannable/zoomable board world), From/To/Subject shown as context,
// body is the only editable field. Sending goes through the same
// /emails/{id}/send endpoint the rest of the app uses, which is what
// actually links the reply into the thread (thread_id + direction='out') -
// this modal is just a better front door onto that, not a new send path.
export default function ComposeModal({ email, accountEmail, initialBody = '', onClose, onSent }) {
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const subject = (email.subject || '').toLowerCase().startsWith('re:') ? email.subject : `Re: ${email.subject || ''}`;

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const updated = await sendEmail(email.id, body);
      onSent(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5 dark:bg-slate-950">
        <p className="truncate text-sm font-medium text-white">{subject || 'New Message'}</p>
        <button onClick={onClose} className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 border-b border-slate-100 px-4 py-2.5 text-xs dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-slate-400 dark:text-slate-500">From</span>
          <span className="truncate text-slate-700 dark:text-slate-300">{accountEmail || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 dark:border-slate-800">
          <span className="w-14 shrink-0 text-slate-400 dark:text-slate-500">To</span>
          <span className="truncate text-slate-700 dark:text-slate-300">{email.sender || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 dark:border-slate-800">
          <span className="w-14 shrink-0 text-slate-400 dark:text-slate-500">Subject</span>
          <span className="truncate text-slate-700 dark:text-slate-300">{subject}</span>
        </div>
      </div>

      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        className="h-56 w-full resize-none bg-white p-4 text-sm leading-relaxed text-slate-700 outline-none dark:bg-slate-900 dark:text-slate-200"
      />

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
        <button
          onClick={onClose}
          className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
