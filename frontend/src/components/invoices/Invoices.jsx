import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  Receipt,
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  X,
  ScanLine,
  FileText,
} from 'lucide-react';
import CameraCapture from '../documents/CameraCapture';
import { drawRegions } from '../documents/regionOverlay';
import {
  listInvoices,
  processInvoice,
  flagInvoiceField,
  getDocument,
  documentImageUrl,
} from '../../services/api';

const REVIEW_FILTERS = ['All', 'Needs Review', 'Confirmed'];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('All');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [flagging, setFlagging] = useState(false);
  const [textMode, setTextMode] = useState('boxes'); // 'boxes' (per-region OCR) | 'all' (whole-page OCR)
  const fileInputRef = useRef(null);
  const detailImgRef = useRef(null);
  const detailOverlayRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await listInvoices();
      setInvoices(rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedInvoice = invoices.find((inv) => inv.id === selectedId) ?? null;

  useEffect(() => {
    setTextMode('boxes');
    if (!selectedInvoice) {
      setSelectedDocument(null);
      return;
    }
    getDocument(selectedInvoice.document_id).then(setSelectedDocument).catch((err) => setLoadError(err.message));
  }, [selectedInvoice]);

  useEffect(() => {
    function redraw() {
      const img = detailImgRef.current;
      const canvas = detailOverlayRef.current;
      if (!img || !canvas || !img.complete || !selectedDocument?.structured_json?.regions) return;
      drawRegions(canvas, img, selectedDocument.structured_json.regions, {
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [selectedDocument]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
    });
    if (files.length === 0) {
      setUploadError('Unsupported file type. Use PDF, JPG, or PNG.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        await processInvoice(file);
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
      await processInvoice(file);
      await refresh();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleToggleReview(invoice) {
    setFlagging(true);
    try {
      await flagInvoiceField(invoice.id, 'all', invoice.needs_review);
      await refresh();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setFlagging(false);
    }
  }

  const filtered = invoices.filter((inv) => {
    const haystack = `${inv.invoice_number ?? ''} ${inv.vendor ?? ''}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesReview =
      reviewFilter === 'All' ||
      (reviewFilter === 'Needs Review' && inv.needs_review) ||
      (reviewFilter === 'Confirmed' && !inv.needs_review);
    return matchesSearch && matchesReview;
  });

  const needsReviewCount = invoices.filter((inv) => inv.needs_review).length;

  return (
    <div className="p-6">
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div
          className={`col-span-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
            isDragging
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
              : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
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
            className={`mx-auto h-8 w-8 ${isDragging ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400 dark:text-zinc-500'}`}
          />
          <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {isDragging ? 'Drop invoice to process' : 'Upload Invoice'}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">PDF, JPG, PNG</p>
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
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Browse Files
            </button>
            <button
              onClick={() => setShowCamera(true)}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Camera className="h-3.5 w-3.5" />
              Use Camera
            </button>
          </div>
          {uploading && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing invoice...
            </p>
          )}
          {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}
        </div>

        <div className="col-span-2 rounded-xl bg-zinc-900 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-300">Review Queue</p>
              <p className="mt-1 text-2xl font-bold">
                {needsReviewCount} invoice{needsReviewCount === 1 ? '' : 's'} need review
              </p>
              <div className="mt-3 flex items-center gap-4 text-sm text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <ScanLine className="h-4 w-4" />
                  YOLO: Field Detection
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  PaddleOCR: Text Extraction
                </span>
              </div>
            </div>
            <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">Total: {invoices.length}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
          <div className="flex gap-2">
            {REVIEW_FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setReviewFilter(filter)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  reviewFilter === filter
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="relative border-b border-zinc-100 p-4 dark:border-zinc-800">
          <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number or vendor..."
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
          />
        </div>

        {loadError && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
            {loadError} — is the backend running on :8000?
          </div>
        )}

        <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
          {filtered.length === 0 && !loadError && (
            <p className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No invoices yet. Upload a file or use the camera to process one.
            </p>
          )}
          {filtered.map((inv) => {
            const confidencePct = inv.confidence_score != null ? Math.round(inv.confidence_score * 100) : null;
            return (
              <div
                key={inv.id}
                className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                onClick={() => setSelectedId(inv.id)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {inv.invoice_number || `Invoice #${inv.id}`}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {inv.vendor || 'Unknown vendor'} • {inv.date || 'no date detected'}
                  </p>
                </div>
                <div className="w-24 text-right">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {inv.total != null ? `${inv.currency ?? ''} ${inv.total}`.trim() : '—'}
                  </p>
                </div>
                <div className="w-32">
                  {confidencePct != null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${
                            confidencePct >= 90 ? 'bg-emerald-500' : confidencePct >= 75 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${confidencePct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{confidencePct}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                  )}
                </div>
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    inv.needs_review
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  }`}
                >
                  {inv.needs_review ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {inv.needs_review ? 'Needs Review' : 'Confirmed'}
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedId(inv.id)}
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCamera && (
        <CameraCapture domain="invoices" onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {selectedInvoice.invoice_number || `Invoice #${selectedInvoice.id}`}
              </p>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  Status:{' '}
                  {selectedInvoice.needs_review ? (
                    <span className="text-amber-600 dark:text-amber-400">Needs Review</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Confirmed</span>
                  )}
                </span>
                {selectedInvoice.confidence_score != null && (
                  <span>Confidence: {Math.round(selectedInvoice.confidence_score * 100)}%</span>
                )}
                <button
                  onClick={() => handleToggleReview(selectedInvoice)}
                  disabled={flagging}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {flagging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {selectedInvoice.needs_review ? 'Mark Reviewed' : 'Flag for Review'}
                </button>
              </div>

              {selectedDocument && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Detected Regions</p>
                  <div className="relative overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800">
                    <img
                      ref={detailImgRef}
                      src={documentImageUrl(selectedInvoice.document_id)}
                      alt={selectedInvoice.invoice_number ?? 'invoice'}
                      className="block w-full"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        drawRegions(detailOverlayRef.current, img, selectedDocument.structured_json?.regions, {
                          width: img.naturalWidth,
                          height: img.naturalHeight,
                        });
                      }}
                    />
                    <canvas ref={detailOverlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Extracted Fields</p>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-100 p-3 text-sm dark:border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-400">Invoice Number</p>
                    <p className="text-zinc-700 dark:text-zinc-200">{selectedInvoice.invoice_number ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Vendor</p>
                    <p className="text-zinc-700 dark:text-zinc-200">{selectedInvoice.vendor ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Date</p>
                    <p className="text-zinc-700 dark:text-zinc-200">{selectedInvoice.date ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Total</p>
                    <p className="text-zinc-700 dark:text-zinc-200">
                      {selectedInvoice.total != null ? `${selectedInvoice.currency ?? ''} ${selectedInvoice.total}`.trim() : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedInvoice.items?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Raw OCR Rows</p>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {selectedInvoice.items.map((row, i) => (
                      <p key={i}>{row.join('  ')}</p>
                    ))}
                  </div>
                </div>
              )}

              {selectedDocument && (selectedDocument.raw_text || selectedDocument.structured_json?.regions_text) && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-zinc-400">Extracted Text</p>
                    <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
                      <button
                        onClick={() => setTextMode('boxes')}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          textMode === 'boxes'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        Boxes Only
                      </button>
                      <button
                        onClick={() => setTextMode('all')}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          textMode === 'all'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        All Text
                      </button>
                    </div>
                  </div>

                  {textMode === 'boxes' ? (
                    Object.keys(selectedDocument.structured_json?.regions_text || {}).length > 0 ? (
                      <div className="space-y-2 rounded-lg border border-zinc-100 p-3 text-sm dark:border-zinc-800">
                        {Object.entries(selectedDocument.structured_json.regions_text).map(([label, texts]) => (
                          <div key={label}>
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-500">{label}</p>
                            {texts.map((t, i) => (
                              <p key={i} className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                                {t}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-zinc-100 p-3 text-sm text-zinc-400 dark:border-zinc-800">
                        No detected boxes had readable text.
                      </p>
                    )
                  ) : (
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {selectedDocument.raw_text || '(no text extracted)'}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
