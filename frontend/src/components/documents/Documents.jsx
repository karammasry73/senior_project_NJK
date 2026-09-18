import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  FileImage,
  File,
  Camera,
  Search,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import CameraCapture from './CameraCapture';
import { listDocuments, uploadDocument, deleteDocument, getDocument, documentImageUrl } from '../../services/api';
import { drawRegions } from './regionOverlay';

const ACCEPTED_TYPES = ['pdf', 'png', 'jpg', 'jpeg'];

const STATUS_META = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', icon: Loader2 },
  processed: { label: 'Processed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: AlertTriangle },
};

const STATUS_FILTERS = ['All', 'Pending', 'Processing', 'Processed', 'Failed'];

function fileIcon(fileType) {
  if (fileType === 'pdf') return { Icon: FileText, color: 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300' };
  if (['png', 'jpg', 'jpeg'].includes(fileType)) return { Icon: FileImage, color: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-300' };
  return { Icon: File, color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
}

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const fileInputRef = useRef(null);
  const detailImgRef = useRef(null);
  const detailOverlayRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const hasActive = documents.some((d) => d.status === 'pending' || d.status === 'processing');
    if (!hasActive) return;
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [documents, refresh]);

  useEffect(() => {
    if (selectedId == null) {
      setSelectedDetail(null);
      return;
    }
    getDocument(selectedId).then(setSelectedDetail).catch((err) => setLoadError(err.message));
  }, [selectedId]);

  useEffect(() => {
    function redraw() {
      const img = detailImgRef.current;
      const canvas = detailOverlayRef.current;
      if (!img || !canvas || !img.complete || !selectedDetail?.structured_json?.regions) return;
      drawRegions(canvas, img, selectedDetail.structured_json.regions, {
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [selectedDetail]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ACCEPTED_TYPES.includes(ext);
    });
    if (files.length === 0) {
      setUploadError('Unsupported file type. Use PDF, JPG, or PNG.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        await uploadDocument(file);
      }
      await refresh();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCameraCapture(file) {
    setShowCamera(false);
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(file);
      await refresh();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await deleteDocument(id);
      if (selectedId === id) setSelectedId(null);
      await refresh();
    } catch (err) {
      setLoadError(err.message);
    }
  }

  const filtered = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || STATUS_META[doc.status]?.label === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = documents.filter((d) => d.status === 'pending' || d.status === 'processing').length;

  return (
    <div className="p-6">
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div
          className={`col-span-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <UploadCloud
            className={`mx-auto h-8 w-8 ${isDragging ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}
          />
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {isDragging ? 'Drop files to upload' : 'Upload Documents'}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">PDF, JPG, PNG</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              Browse Files
            </button>
            <button
              onClick={() => setShowCamera(true)}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Camera className="h-3.5 w-3.5" />
              Use Camera
            </button>
          </div>
          {uploading && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-indigo-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
            </p>
          )}
          {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}
        </div>

        <div className="col-span-2 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-200">Active Pipeline</p>
              <p className="mt-1 text-2xl font-bold">{activeCount} document{activeCount === 1 ? '' : 's'} processing</p>
              <div className="mt-3 flex items-center gap-4 text-sm text-indigo-100">
                <span className="flex items-center gap-1.5">
                  <FileImage className="h-4 w-4" />
                  YOLO: Layout Analysis
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  PaddleOCR: Text Extraction
                </span>
              </div>
            </div>
            <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">Queue: {activeCount}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === filter
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="relative border-b border-slate-100 p-4 dark:border-slate-800">
          <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
          />
        </div>

        {loadError && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
            {loadError} — is the backend running on :8000?
          </div>
        )}

        <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {filtered.length === 0 && !loadError && (
            <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No documents yet. Upload a file or use the camera to get started.
            </p>
          )}
          {filtered.map((doc) => {
            const { Icon, color } = fileIcon(doc.file_type);
            const meta = STATUS_META[doc.status] ?? STATUS_META.pending;
            const StatusIcon = meta.icon;
            const confidencePct = doc.confidence != null ? Math.round(doc.confidence * 100) : null;
            return (
              <div
                key={doc.id}
                className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                onClick={() => setSelectedId(doc.id)}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{doc.filename}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {doc.file_type.toUpperCase()} • {doc.upload_date}
                  </p>
                </div>
                <div className="w-32">
                  {confidencePct != null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            confidencePct >= 90 ? 'bg-emerald-500' : confidencePct >= 75 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${confidencePct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{confidencePct}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                  )}
                </div>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.color}`}>
                  <StatusIcon className={`h-3.5 w-3.5 ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                  {meta.label}
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedId(doc.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCamera && (
        <CameraCapture domain="exams" onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}

      {selectedId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {selectedDetail?.filename ?? 'Loading...'}
              </p>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {!selectedDetail ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>Status: {STATUS_META[selectedDetail.status]?.label ?? selectedDetail.status}</span>
                    {selectedDetail.confidence != null && (
                      <span>Confidence: {Math.round(selectedDetail.confidence * 100)}%</span>
                    )}
                    <span>Uploaded: {selectedDetail.upload_date}</span>
                  </div>

                  {selectedDetail.status === 'processed' && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Detected Regions</p>
                      <div className="relative overflow-hidden rounded-lg border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
                        <img
                          ref={detailImgRef}
                          src={documentImageUrl(selectedDetail.id)}
                          alt={selectedDetail.filename}
                          className="block w-full"
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            drawRegions(detailOverlayRef.current, img, selectedDetail.structured_json?.regions, {
                              width: img.naturalWidth,
                              height: img.naturalHeight,
                            });
                          }}
                        />
                        <canvas ref={detailOverlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                      </div>
                    </div>
                  )}

                  {selectedDetail.structured_json?.regions_text &&
                    Object.keys(selectedDetail.structured_json.regions_text).length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Text by Region</p>
                        <div className="space-y-2 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                          {Object.entries(selectedDetail.structured_json.regions_text).map(([label, texts]) => (
                            <div key={label}>
                              <p className="text-xs font-medium text-indigo-500">{label}</p>
                              {texts.map((t, i) => (
                                <p key={i} className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                                  {t}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {selectedDetail.structured_json?.fields && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Extracted Fields</p>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                        {Object.entries(selectedDetail.structured_json.fields).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-xs text-slate-400">{key}</p>
                            <p className="text-slate-700 dark:text-slate-200">{value ?? '—'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDetail.raw_text && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Raw OCR Text</p>
                      <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {selectedDetail.raw_text}
                      </pre>
                    </div>
                  )}

                  {selectedDetail.status === 'failed' && (
                    <p className="text-sm text-red-500">{selectedDetail.raw_text}</p>
                  )}
                  {(selectedDetail.status === 'pending' || selectedDetail.status === 'processing') && (
                    <p className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Still processing...
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
