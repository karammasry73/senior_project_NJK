import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Bot,
  Send,
  Sparkles,
  FileText,
  Receipt,
  Mail,
  ClipboardList,
  Loader2,
  MicOff,
  Eraser,
} from 'lucide-react';
import { chatWithAssistant, getStats, getSystemStatus } from '../../services/api';

const suggestedPrompts = [
  { label: 'How many documents are pending?', icon: FileText },
  { label: 'Any invoices need review?', icon: Receipt },
  { label: 'Do I have unread emails?', icon: Mail },
  { label: "What's my current system status?", icon: ClipboardList },
];

const STORAGE_KEY = 'sme-ai-assistant-chat';

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function greeting() {
  return {
    type: 'assistant',
    text: "Hi, I'm your AI Assistant. Ask me about your documents, invoices, or emails - I can see real counts from the system. Voice input isn't wired up yet, so type your question below.",
    time: timeNow(),
  };
}

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // localStorage unavailable (private mode, etc.) or corrupt JSON - fall through to a fresh greeting
  }
  return [greeting()];
}

export default function Voice() {
  // Lazy-initialized from localStorage, not a fresh greeting every time - this is what
  // makes the conversation survive navigating away to another page and back, since this
  // component fully unmounts/remounts on route change (its own state alone can't persist that).
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaAvailable, setOllamaAvailable] = useState(null);
  const [modelName, setModelName] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    getSystemStatus()
      .then((s) => setOllamaAvailable(s.ollama.available))
      .catch(() => setOllamaAvailable(false));
    getStats()
      .then((s) => setModelName(s.ollama_model))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // private-browsing / storage-full - conversation just won't persist this time
    }
  }, [messages]);

  function handleClear() {
    const fresh = [greeting()];
    setMessages(fresh);
    setError(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore - same as above
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { type: 'user', text: trimmed, time: timeNow() }]);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const { reply } = await chatWithAssistant(trimmed);
      setMessages((prev) => [...prev, { type: 'assistant', text: reply, time: timeNow() }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">AI Assistant</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask questions about your documents, invoices, and emails - answered from real system data via Ollama
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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Assistant</h4>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {modelName || '...'} via Ollama · offline
                </p>
              </div>
            </div>
            <button
              onClick={handleClear}
              title="Clear conversation"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          <div ref={scrollRef} className="h-96 overflow-y-auto p-5">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.type === 'user'
                        ? 'rounded-br-md bg-amber-600 text-white'
                        : 'rounded-bl-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                    }`}
                  >
                    <p
                      className={`whitespace-pre-line text-sm leading-relaxed ${
                        msg.type === 'user' ? 'text-white' : 'text-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      {msg.text}
                    </p>
                    <p className={`mt-1.5 text-[10px] ${msg.type === 'user' ? 'text-amber-100' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your documents, invoices, or emails..."
                  disabled={sending}
                  className="flex-1 bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                />
              </div>

              <button
                type="button"
                disabled
                title="Voice input isn't wired up yet - type your question instead"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              >
                <MicOff className="h-5 w-5" />
              </button>

              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Try Asking</h4>
            </div>
            <div className="space-y-2">
              {suggestedPrompts.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={i}
                    onClick={() => sendMessage(cmd.label)}
                    disabled={sending}
                    className="flex w-full items-center gap-3 rounded-lg border border-zinc-100 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-white dark:from-zinc-800 dark:to-zinc-700">
            <h4 className="text-sm font-semibold">Privacy First</h4>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300 dark:text-zinc-200">
              Every reply is generated locally through Ollama - your questions and the system
              data used to answer them never leave this machine.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Mic className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-300">
                Voice input (mic → VoxType) is on the roadmap, not active yet
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
