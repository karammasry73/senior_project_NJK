import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Bot,
  Send,
  Sparkles,
  FileText,
  Receipt,
  Mail,
  ClipboardList,
  Square,
  Volume2,
  History,
  Settings2,
} from 'lucide-react';

const suggestedCommands = [
  { label: 'Process the latest invoice', icon: Receipt },
  { label: 'Summarize document', icon: FileText },
  { label: 'Draft a reply to Sarah', icon: Mail },
  { label: 'List unread emails', icon: ClipboardList },
];

const chatHistory = [
  {
    type: 'user',
    text: 'Process the latest invoice from Acme',
    time: '10:42 AM',
  },
  {
    type: 'assistant',
    text: 'Processing invoice_acme_corp_march.pdf — YOLO detected 4 regions (header, vendor info, line items, total). PaddleOCR extracted 128 text blocks. Ollama structured 12 fields. Total detected: $1,284.50 with 98% confidence.',
    time: '10:42 AM',
    response: {
      confidence: 98,
      fields: 12,
      regions: 4,
      status: 'Processed',
    },
  },
  {
    type: 'user',
    text: 'Summarize the supplier contract',
    time: '10:38 AM',
  },
  {
    type: 'assistant',
    text: 'Summarized supplier_contract_v2.pdf: A 24-month supply agreement with LogisticsPro covering monthly shipping services at $567.80/month. Auto-renewal clause present. Key terms include 30-day termination notice and volume discount at 5%+.',
    time: '10:38 AM',
  },
];

const commandPalette = [
  { command: 'process invoice', module: 'Website invoice' },
  { command: 'draft email', module: 'Email manager' },
  { command: 'summarize document', module: 'Document processing' },
  { command: 'categorize emails', module: 'Email manager' },
  { command: 'status report', module: 'Dashboard' },
  { command: 'open settings', module: 'Settings' },
];

export default function Voice() {
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [messages, setMessages] = useState(chatHistory);
  const [activeCommand, setActiveCommand] = useState(null);

  const waveRef = useRef(null);

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

  const handleMicToggle = () => {
    if (isListening) {
      setIsListening(false);
      if (currentTranscript) {
        const newMsg = {
          type: 'user',
          text: currentTranscript,
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, newMsg]);
        setCurrentTranscript('');
      }
    } else {
      setIsListening(true);
      setTimeout(() => {
        if (isListening) {
          setCurrentTranscript("Hmm, I didn't catch that. Try speaking again...");
        }
      }, 3000);
    }
  };

  const handleCommandClick = (label) => {
    setMessages((prev) => [
      ...prev,
      { type: 'user', text: label, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) },
    ]);
    setActiveCommand(label);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          text: `Great! I'm ${
            label.toLowerCase().includes('process')
              ? 'processing the invoice now — YOLO layout analysis complete, PaddleOCR extraction in progress, Ollama structuring the data...'
              : label.toLowerCase().includes('summar')
                ? 'summarizing the document — extracting key sections, generating concise summary via Ollama...'
                : label.toLowerCase().includes('draft')
                  ? 'drafting a professional response based on context from the email thread...'
                  : 'fetching your inbox and categorizing emails with Ollama...'
          }`,
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
      setActiveCommand(null);
    }, 1800);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Voice Assistant
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Powered by VoxType — hands-free control for your automation workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Volume2 className="h-3.5 w-3.5" />
            VoxType Ready
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
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Assistant
                </h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  llama3.1:8b via Ollama · offline
                </p>
              </div>
            </div>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${isListening ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isListening ? 'bg-red-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isListening ? 'bg-red-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
              </span>
              {isListening ? 'Listening...' : 'Ready'}
            </span>
          </div>

          <div className="h-96 overflow-y-auto p-5">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
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
                    {msg.response && (
                      <div className={`mt-3 grid grid-cols-4 gap-2 ${msg.type === 'user' ? 'text-white' : ''}`}>
                        <div className={`rounded-lg p-2 text-center ${msg.type === 'user' ? 'bg-white/20' : 'bg-white dark:bg-slate-900'}`}>
                          <p className="text-lg font-bold">{msg.response.regions}</p>
                          <p className="text-[10px] opacity-80">YOLO Regions</p>
                        </div>
                        <div className={`rounded-lg p-2 text-center ${msg.type === 'user' ? 'bg-white/20' : 'bg-white dark:bg-slate-900'}`}>
                          <p className="text-lg font-bold">{msg.response.fields}</p>
                          <p className="text-[10px] opacity-80">Fields Extracted</p>
                        </div>
                        <div className={`rounded-lg p-2 text-center ${msg.type === 'user' ? 'bg-white/20' : 'bg-white dark:bg-slate-900'}`}>
                          <p className="text-lg font-bold">{msg.response.confidence}%</p>
                          <p className="text-[10px] opacity-80">Confidence</p>
                        </div>
                        <div className={`rounded-lg p-2 text-center ${msg.type === 'user' ? 'bg-white/20' : 'bg-white dark:bg-slate-900'}`}>
                          <p className="text-lg font-bold">✓</p>
                          <p className="text-[10px] opacity-80">{msg.response.status}</p>
                        </div>
                      </div>
                    )}
                    <p
                      className={`mt-1.5 text-[10px] ${
                        msg.type === 'user' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <input
                  type="text"
                  value={currentTranscript}
                  onChange={(e) => setCurrentTranscript(e.target.value)}
                  placeholder={
                    isListening
                      ? 'Listening... speak now'
                      : 'Type a command or press the mic...'
                  }
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
                />
                {isListening && (
                  <span className="animate-pulse text-xs font-medium text-red-500">
                    ● LIVE
                  </span>
                )}
              </div>

              <button
                onClick={handleMicToggle}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                  isListening
                    ? 'bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:opacity-90'
                }`}
              >
                {isListening ? (
                  <Square className="h-5 w-5 fill-current" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              <button className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md transition-opacity hover:opacity-90">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <History className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Recent threads appear here. Commands execute via API route.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Quick Commands
                </h4>
              </div>
              <Settings2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="space-y-2">
              {suggestedCommands.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleCommandClick(cmd.label)}
                    disabled={activeCommand !== null}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 dark:border-slate-800 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {cmd.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Command Palette
            </h4>
            <div className="space-y-1.5">
              {commandPalette.map((cmd) => (
                <div
                  key={cmd.command}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                      "{cmd.command}"
                    </span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                    {cmd.module}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
              Trigger these commands hands-free with "Hey Assistant" wake word.
            </p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white dark:from-slate-800 dark:to-slate-700">
            <h4 className="text-sm font-semibold">Privacy First</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 dark:text-slate-200">
              All voice processing runs locally through VoxType. Audio never
              leaves your machine — ideal for handling sensitive business data.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <MicOff className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">
                No cloud audio processing
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}