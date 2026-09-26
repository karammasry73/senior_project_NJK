import { useState } from 'react';
import {
  Bot,
  ScanLine,
  FileText,
  Mic,
  Server,
  Database,
  Bell,
  Shield,
  Save,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  HardDrive,
  Cpu,
} from 'lucide-react';

const ollamaModels = [
  { name: 'llama3.1:8b', size: '4.9 GB', quality: 'Excellent', speed: 'Medium', selected: true },
  { name: 'mistral:7b', size: '4.1 GB', quality: 'Great', speed: 'Fast', selected: false },
  { name: 'phi3:mini', size: '2.2 GB', quality: 'Good', speed: 'Very Fast', selected: false },
  { name: 'gemma2:9b', size: '5.5 GB', quality: 'Excellent', speed: 'Slow', selected: false },
];

const yoloModels = [
  { name: 'yolov8n-doclayout.pt', size: '6.2 MB', description: 'Nano - document layout', quality: 'Fast', selected: true },
  { name: 'yolov8s-invoice.pt', size: '22 MB', description: 'Small - invoice fields', quality: 'Accurate', selected: false },
  { name: 'yolov8m-doclaynet.pt', size: '49 MB', description: 'Medium - DocLayNet trained', quality: 'Very Accurate', selected: false },
];

const voxTypeOptions = [
  { id: 'dictation', label: 'Dictation Mode', desc: 'Free-form voice-to-text transcription' },
  { id: 'commands', label: 'Command Mode', desc: 'Execute predefined automation commands' },
  { id: 'hybrid', label: 'Hybrid Mode', desc: 'Auto-detect dictation vs. commands', selected: true },
];

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('sk-ollama-local-••••••••••••••');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Settings
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure AI models and system preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all ${
            saved
              ? 'bg-emerald-600'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90'
          }`}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    Ollama LLM
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Local large language model
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Connected
              </span>
            </div>

            <div className="p-5">
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Available Models
              </label>
              <div className="space-y-2">
                {ollamaModels.map((model) => (
                  <div
                    key={model.name}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      model.selected
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5'
                        : 'border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                          model.selected
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {model.selected && <Check className="h-3 w-3 text-white" />}
                      </button>
                      <div>
                        <p className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">
                          {model.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {model.size} · {model.quality} quality · {model.speed}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      RAM: {(parseFloat(model.size) * 1.5).toFixed(1)}GB
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Model Temperature
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue="0.2"
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    0.2
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Lower = more deterministic output, better for data extraction
                </p>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Max Token Length
                </label>
                <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option>2048 (balanced)</option>
                  <option>4096 (long documents)</option>
                  <option>8192 (max)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-500/10">
                  <ScanLine className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    YOLO Model
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Document detection model
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                v8
              </span>
            </div>

            <div className="p-5">
              <div className="space-y-2">
                {yoloModels.map((model) => (
                  <div
                    key={model.name}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      model.selected
                        ? 'border-purple-300 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-500/5'
                        : 'border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                          model.selected
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {model.selected && <Check className="h-3 w-3 text-white" />}
                      </button>
                      <div>
                        <p className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">
                          {model.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {model.description} · {model.quality}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {model.size}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Confidence Threshold
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="25"
                    className="flex-1 accent-purple-600"
                  />
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    25%
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Detections below this threshold are ignored
                </p>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  IoU Threshold (NMS)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="45"
                    className="flex-1 accent-purple-600"
                  />
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    45%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                  <Mic className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    VoxType Voice
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Voice input configuration
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                Installed
              </span>
            </div>

            <div className="p-5">
              <div className="space-y-3">
                {voxTypeOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:border-indigo-200 dark:border-slate-800 dark:hover:border-indigo-500/30"
                  >
                    <input
                      type="radio"
                      name="voxmode"
                      defaultChecked={opt.selected}
                      className="mt-0.5 h-4 w-4 accent-indigo-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Wake Word
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      defaultValue="Hey Assistant"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      Test
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Voice feedback responses
                    </span>
                  </div>
                  <button className="relative h-6 w-11 rounded-full bg-emerald-500 transition-colors">
                    <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Auto-transcribe dictation to documents
                    </span>
                  </div>
                  <button className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors dark:bg-slate-600">
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <Server className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    System
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Runtime configuration
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Database
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                    SQLite
                  </p>
                  <button className="mt-2 flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    <ChevronDown className="h-3 w-3" />
                    Change
                  </button>
                </div>

                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Storage Used
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                    2.4 GB
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    Of 3.5 GB allocated
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Ollama API Endpoint
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue="http://localhost:11434"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <button className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    Test
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Backend API Endpoint
                </label>
                <input
                  type="text"
                  defaultValue="http://localhost:8000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    Privacy & Security
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    All processing is offline
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Shield className="h-3.5 w-3.5" />
                Protected
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Uploaded documents stored locally only
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Enabled
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  No external API calls for AI tasks
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Cpu className="h-3.5 w-3.5" />
                  Ollama local
                </span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Optional: Cloud fallback key (uses external API)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  Leave empty to force full offline mode
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}