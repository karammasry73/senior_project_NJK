import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Bot,
  Send,
  Sparkles,
  FileText,
  Receipt,
  Mail,
  Cpu,
  Square,
  Volume2,
  VolumeX,
  History,
  Settings2,
  Loader2,
} from 'lucide-react';
import { getSystemStatus, runVoiceCommand } from '../../services/api';

const quickCommands = [
  { label: 'Check system status', icon: Cpu, cmd: 'What is the system status?' },
  { label: 'Document summary', icon: FileText, cmd: 'Summarize the documents' },
  { label: 'Invoice status', icon: Receipt, cmd: 'Invoice status' },
  { label: 'Unread emails', icon: Mail, cmd: 'Show unread emails' },
  { label: 'Categorize emails', icon: Sparkles, cmd: 'Categorize emails with Ollama' },
  { label: 'What can you do?', icon: Bot, cmd: 'help' },
];

const commandPalette = [
  { command: 'system status', module: 'System / Dashboard' },
  { command: 'documents', module: 'Document processing' },
  { command: 'invoices', module: 'Invoice processing' },
  { command: 'unread emails', module: 'Email manager' },
  { command: 'categorize emails', module: 'Email manager · Ollama' },
  { command: 'what can you do', module: 'Assistance' },
];

const STAT_TILES = [
  { key: 'documents', label: 'Documents' },
  { key: 'processed', label: 'Processed' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'needs_review', label: 'Need Review' },
  { key: 'emails', label: 'Emails' },
  { key: 'unread', label: 'Unread' },
];

const WELCOME = {
  id: 'welcome',
  type: 'assistant',
  text: "Hi, I'm your automation assistant. Talk or type to check system health, summarize documents, invoices, emails, or categorize email — for example: \"system status\", \"invoices\", or \"unread emails\".",
  time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
};

export default function Voice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([WELCOME]);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(null);
  const [sttSupported, setSttSupported] = useState(true);

  const recRef = useRef(null);
  const waveRef = useRef(null);
  const threadRef = useRef(null);

  useEffect(() => {
    getSystemStatus()
      .then((s) => setOllamaOnline(s.ollama.available))
      .catch(() => setOllamaOnline(false));
  }, []);

  useEffect(() => {
    if (!waveRef.current) return;
    const bars = waveRef.current.children;
    const interval = setInterval(() => {
      for (let i = 0; i < bars.length; i++) {
        const amplitude = isListening ? 0.5 + Math.random() * 0.5 : 0.12;
        bars[i].style.height = `${amplitude * 100}%`;
      }
    }, 120);
    return () => clearInterval(interval);
  }, [isListening]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const speak = useCallback(
    (text) => {
      if (muted || !('speechSynthesis' in window) || !text) return;
      window.speechSynthesis.cancel();
      const clean = text.replace(/[^a-zA-Z0-9 .,:;'!?\-]/g, ' ').slice(0, 320);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    },
    [muted]
  );

  const pushUser = (text) =>
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), type: 'user', text, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) },
    ]);

  const pushAssistant = (text, stats) =>
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: 'assistant',
        text,
        stats,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      },
    ]);

  async function runCommand(raw) {
    const text = (raw || '').trim();
    if (!text || busy) return;
    pushUser(text);
    setTranscript('');
    setBusy(true);
    try {
      const res = await runVoiceCommand(text);
      const reply = res.result?.text || `Done (${res.action_taken}).`;
      pushAssistant(reply, res.result?.stats || null);
      speak(reply);
    } catch (err) {
      const msg = `Command failed: ${err.message}`;
      pushAssistant(msg);
      speak(msg);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSttSupported(false);
      pushAssistant("Speech recognition isn't supported in this browser — use Chrome or Edge, or just type below.");
      return;
    }
    if (isListening) {
      recRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim();
      setIsListening(false);
      runCommand(t);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = (e) => {
      setIsListening(false);
      pushAssistant(`Microphone error: ${e.error}. You can type your command instead.`);
    };
    recRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">AI Assistant</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Talk or type to control your automation workflows — documents, invoices, emails, and system health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              sttSupported
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            {sttSupported ? 'Mic ready' : 'Type to use'}
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              ollamaOnline
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            Ollama {ollamaOnline ? 'online' : 'offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Assistant</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Commands run on your backend · email AI via Ollama (qwen3.5:4b)
                </p>
              </div>
            </div>
            <span
              className={`flex items-center gap-1.5 text-xs font-medium ${
                isListening ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    isListening ? 'bg-red-400' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isListening ? 'bg-red-500' : 'bg-slate-400 dark:bg-slate-500'
                  }`}
                />
              </span>
              {isListening ? 'Listening...' : busy ? 'Working...' : 'Ready'}
            </span>
          </div>

          <div ref={threadRef} className="h-96 overflow-y-auto p-5">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.type === 'user'
                        ? 'rounded-br-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                        : 'rounded-bl-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <p
                      className={`whitespace-pre-line text-sm leading-relaxed ${
                        msg.type === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {msg.text}
                    </p>
                    {msg.stats && (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {STAT_TILES.filter((t) => msg.stats[t.key] != null).map((t) => (
                          <div
                            key={t.key}
                            className={`rounded-lg p-2 text-center ${
                              msg.type === 'user' ? 'bg-white/20' : 'bg-white dark:bg-slate-900'
                            }`}
                          >
                            <p className="text-lg font-bold">{Number(msg.stats[t.key]).toLocaleString()}</p>
                            <p className="text-[10px] opacity-80">{t.label}</p>
                          </div>
                        ))}
                        {msg.stats.system && (
                          <div
                            className={`rounded-lg p-2 text-center ${
                              msg.type === 'user' ? 'bg-white/20' : 'bg-white dark:bg-slate-900'
                            }`}
                          >
                            <p className="text-lg font-bold">✓</p>
                            <p className="text-[10px] opacity-80">Services</p>
                          </div>
                        )}
                      </div>
                    )}
                    <p className={`mt-1.5 text-[10px] ${msg.type === 'user' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">Running command...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <input
                  type="text"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runCommand(transcript);
                  }}
                  placeholder={isListening ? 'Listening... speak now' : 'Type a command or press the mic...'}
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
                />
                {isListening && (
                  <span className="animate-pulse text-xs font-medium text-red-500">● LIVE</span>
                )}
              </div>

              <button
                onClick={toggleMic}
                title={isListening ? 'Stop listening' : 'Speak a command'}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                  isListening
                    ? 'bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:opacity-90'
                }`}
              >
                {isListening ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
              </button>

              <button
                onClick={() => runCommand(transcript)}
                disabled={busy || !transcript.trim()}
                title="Send command"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-5 w-5" />
              </button>

              <button
                onClick={() => setMuted((m) => !m)}
                title={muted ? 'Unmute spoken replies' : 'Mute spoken replies'}
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                  muted
                    ? 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                }`}
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <History className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Re-run suggested phrases below, or just type anything — the assistant replies with real data from your backend.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Commands</h4>
              </div>
              <Settings2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="space-y-2">
              {quickCommands.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={i}
                    onClick={() => runCommand(cmd.cmd)}
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 dark:border-slate-800 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Command Palette</h4>
            <div className="space-y-1.5">
              {commandPalette.map((cmd) => (
                <div
                  key={cmd.command}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">"{cmd.command}"</span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                    {cmd.module}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
              Tap the mic and say one of these phrases — the command runs for real on your backend.
            </p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white dark:from-slate-800 dark:to-slate-700">
            <h4 className="text-sm font-semibold">Private by design</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 dark:text-slate-200">
              Speech is transcribed in your browser (Chrome/Edge) and the command runs against your local FastAPI
              backend. AI email classification runs on Ollama, fully local on this machine.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <MicOff className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">No cloud processing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}