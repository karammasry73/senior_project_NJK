import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X, Check, ScanEye } from 'lucide-react';
import { detectPreview } from '../../services/api';
import { drawRegions } from './regionOverlay';

// Bumped up from the original 900ms: live preview now also OCRs a few boxes
// per tick (not just detection), which is real CPU cost on this machine -
// this leaves headroom so ticks don't stack up behind each other.
const LIVE_INTERVAL_MS = 1500;

export default function CameraCapture({ onCapture, onClose, domain = 'exams' }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [error, setError] = useState(null);
  const [liveMode, setLiveMode] = useState(false);
  const [liveRegionCount, setLiveRegionCount] = useState(0);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => setError(err.message || 'Could not access camera'));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!liveMode || photo || error) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || !video.videoWidth || requestInFlightRef.current) return;

      requestInFlightRef.current = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = video.videoWidth;
        frameCanvas.height = video.videoHeight;
        frameCanvas.getContext('2d').drawImage(video, 0, 0);
        const blob = await new Promise((resolve) => frameCanvas.toBlob(resolve, 'image/jpeg', 0.75));
        if (!blob) return;

        const result = await detectPreview(blob, domain, controller.signal);
        setLiveError(null);
        setLiveRegionCount(result.regions.length);
        drawRegions(overlay, video, result.regions, {
          width: result.image_width,
          height: result.image_height,
        });
      } catch (err) {
        setLiveError(err.name === 'AbortError' ? 'Detection timed out - retrying' : err.message);
      } finally {
        clearTimeout(timeout);
        requestInFlightRef.current = false;
      }
    }, LIVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [liveMode, photo, error]);

  useEffect(() => {
    if (photo && overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  }, [photo]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => setPhoto({ blob, url: URL.createObjectURL(blob) }),
      'image/jpeg',
      0.92,
    );
  }

  function handleRetake() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  }

  function handleUsePhoto() {
    const file = new File([photo.blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {photo ? 'Review photo' : 'Capture document'}
          </p>
          <div className="flex items-center gap-2">
            {!photo && !error && (
              <button
                onClick={() => {
                  setLiveMode((v) => !v);
                  setLiveError(null);
                  setLiveRegionCount(0);
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  liveMode
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                <ScanEye className="h-3.5 w-3.5" />
                Live recognition {liveMode ? 'on' : 'off'}
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

        <div className="relative aspect-[4/3] w-full bg-black">
          {error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">
              {error}. Check camera permissions and try again, or upload a file instead.
            </div>
          ) : photo ? (
            <img src={photo.url} alt="Captured document" className="h-full w-full object-contain" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
          )}
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {liveMode && !photo && !error && (
            <div
              className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-medium text-white ${
                liveError ? 'bg-red-600/80' : 'bg-black/60'
              }`}
            >
              {liveError ??
                (liveRegionCount > 0
                  ? `${liveRegionCount} region${liveRegionCount === 1 ? '' : 's'} detected`
                  : 'Scanning...')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 p-4">
          {error ? null : photo ? (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
              <button
                onClick={handleUsePhoto}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Check className="h-4 w-4" />
                Use photo
              </button>
            </>
          ) : (
            <button
              onClick={handleCapture}
              className="flex items-center gap-2 rounded-full bg-indigo-600 p-4 text-white shadow-lg hover:bg-indigo-700"
              aria-label="Capture photo"
            >
              <Camera className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
