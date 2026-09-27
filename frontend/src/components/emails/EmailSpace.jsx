import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import EmailBoardCard, { CARD_W, CARD_H, CARD_MAX_H } from './EmailBoardCard';
import ComposeModal from './ComposeModal';

// A big, pannable/zoomable 2D board: bordered regions partition emails by
// category, and inside each region, emails that share a Gmail thread_id are
// laid out as a branch - connected by smooth organic curves (git-graph
// style) instead of a straight line. Each card is the full classify /
// summarize / draft / send workspace itself (see EmailBoardCard) - nothing
// ever opens in a separate popup over the canvas. All layout math works in
// "world" units; a single CSS transform on the world div handles pan + zoom.
export const REGION_META = {
  urgent: {
    label: 'Urgent',
    border: 'border-red-300 dark:border-red-500/40',
    bg: 'bg-red-50/60 dark:bg-red-500/5',
    header: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    stroke: '#ef4444',
  },
  follow_up: {
    label: 'Follow-up',
    border: 'border-amber-300 dark:border-amber-500/40',
    bg: 'bg-amber-50/60 dark:bg-amber-500/5',
    header: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    stroke: '#f59e0b',
  },
  action: {
    label: 'Action',
    border: 'border-purple-300 dark:border-purple-500/40',
    bg: 'bg-purple-50/60 dark:bg-purple-500/5',
    header: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    stroke: '#a855f7',
  },
  informational: {
    label: 'Info',
    border: 'border-blue-300 dark:border-blue-500/40',
    bg: 'bg-blue-50/60 dark:bg-blue-500/5',
    header: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    stroke: '#3b82f6',
  },
  spam: {
    label: 'Spam',
    border: 'border-zinc-300 dark:border-zinc-700',
    bg: 'bg-zinc-50/60 dark:bg-zinc-800/20',
    header: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400',
    stroke: '#94a3b8',
  },
  _unclassified: {
    label: 'Unclassified',
    border: 'border-dashed border-zinc-300 dark:border-zinc-700',
    bg: 'bg-transparent',
    header: 'text-zinc-400 dark:text-zinc-500',
    dot: 'bg-zinc-300',
    stroke: '#cbd5e1',
  },
};

const REGION_ORDER = ['urgent', 'action', 'follow_up', 'informational', 'spam', '_unclassified'];

// World-space layout constants (unscaled px - the pan/zoom transform handles the rest)
const NODE_GAP_X = 140;
const THREAD_ROW_H = CARD_H + 110;
const REGION_W = 1500;
const REGION_HEADER_H = 64;
const REGION_PAD = 70;
const REGIONS_PER_ROW = 2;
const REGION_GAP = 130;
const WORLD_MARGIN = 1600; // extra blank space around content so the canvas actually feels "big"

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.2;

function regionKey(email) {
  return email.category && REGION_META[email.category] ? email.category : '_unclassified';
}

function groupIntoThreads(emails) {
  const byThread = {};
  for (const e of emails) {
    const key = e.thread_id || `solo-${e.id}`;
    (byThread[key] ??= []).push(e);
  }
  return Object.values(byThread)
    .map((list) => list.slice().sort((a, b) => (a.received_date || '').localeCompare(b.received_date || '')))
    .sort((a, b) => {
      const latestA = a[a.length - 1]?.received_date || '';
      const latestB = b[b.length - 1]?.received_date || '';
      return latestB.localeCompare(latestA);
    });
}

function computeLayout(emails) {
  const byRegion = {};
  for (const e of emails) (byRegion[regionKey(e)] ??= []).push(e);
  const order = REGION_ORDER.filter((k) => byRegion[k]?.length);

  const positions = {};
  const regions = [];
  let colX = 0;
  let rowY = 0;
  let rowMaxH = 0;
  let colIdx = 0;

  for (const key of order) {
    const threads = groupIntoThreads(byRegion[key]);
    const longest = Math.max(1, ...threads.map((t) => t.length));
    const width = Math.max(REGION_W, 60 + longest * (CARD_W + NODE_GAP_X));
    const height = REGION_HEADER_H + threads.length * THREAD_ROW_H + REGION_PAD;
    const rx = colX;
    const ry = rowY;
    regions.push({ key, x: rx, y: ry, w: width, h: height, count: byRegion[key].length });

    threads.forEach((thread, ti) => {
      thread.forEach((email, ni) => {
        positions[email.id] = {
          x: rx + 60 + ni * (CARD_W + NODE_GAP_X),
          y: ry + REGION_HEADER_H + 20 + ti * THREAD_ROW_H,
        };
      });
    });

    rowMaxH = Math.max(rowMaxH, height);
    colIdx += 1;
    colX += width + REGION_GAP;
    if (colIdx >= REGIONS_PER_ROW) {
      colIdx = 0;
      colX = 0;
      rowY += rowMaxH + REGION_GAP;
      rowMaxH = 0;
    }
  }

  const maxX = Math.max(...regions.map((r) => r.x + r.w), 900);
  const maxY = Math.max(...regions.map((r) => r.y + r.h), 700);
  return { positions, regions, worldSize: { w: maxX + WORLD_MARGIN, h: maxY + WORLD_MARGIN } };
}

// Keep a dragged card's box inside its own region's border - it can be
// rearranged within its category, but never pulled outside it. Moving a card
// between categories happens by reclassifying it (Classify button / Classify
// All), which snaps it into the new region automatically.
function clampToRegion(x, y, region) {
  if (!region) return { x, y };
  const pad = 40;
  const minX = region.x + pad;
  const maxX = Math.max(minX, region.x + region.w - CARD_W - pad);
  const minY = region.y + REGION_HEADER_H + 16;
  // Reserve the card's full possible height (not just its nominal one) so a
  // snapped-back card's whole body - not just its top edge - ends up inside
  // the box, even when it's showing its summary/attachments/draft expanded.
  const maxY = Math.max(minY, region.y + region.h - CARD_MAX_H - 16);
  return { x: Math.min(Math.max(x, minX), maxX), y: Math.min(Math.max(y, minY), maxY) };
}

// Smooth git-graph-style branch curve between two card edges.
function branchPath(a, b) {
  const x1 = a.x + CARD_W;
  const y1 = a.y + 40;
  const x2 = b.x;
  const y2 = b.y + 40;
  const dx = Math.max(40, (x2 - x1) / 2);
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

export default function EmailSpace({ emails, onUpdate, onSent, onPositionChange, onDelete }) {
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [positions, setPositions] = useState({});
  const [regions, setRegions] = useState([]);
  const [worldSize, setWorldSize] = useState({ w: 2000, h: 1400 });
  const [isPanning, setIsPanning] = useState(false);
  const [compose, setCompose] = useState(null); // {email, initialBody} | null
  const [draggingId, setDraggingId] = useState(null); // card mid-drag - moves 1:1 with the cursor, unclamped

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  // id -> the region it was manually dragged within. A position is only ever
  // kept across a re-layout while the card's region key still matches this -
  // reclassifying (or Classify All) changes the region key, so the card
  // automatically falls back to a fresh, in-the-new-box position instead of
  // staying wherever it was dragged in its old category.
  const draggedIdsRef = useRef(new Map());
  // Guards against a stray drag from ever fighting a new one - if a previous
  // drag's pointerup somehow never fired (pointercancel, devtools stealing
  // focus, etc.), starting a new drag force-ends it first instead of leaving
  // two sets of listeners racing each other, which read as "dragging is flaky".
  const activeDragCleanupRef = useRef(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Grouped once per render (not once per card - this used to be recomputed by
  // re-filtering and re-sorting the whole email list for every single card, which
  // on top of running on every render also reran on every mousemove while dragging).
  const threadsByRegion = useMemo(() => {
    const byRegion = {};
    for (const e of emails) (byRegion[regionKey(e)] ??= []).push(e);
    const result = {};
    for (const key of Object.keys(byRegion)) result[key] = groupIntoThreads(byRegion[key]);
    return result;
  }, [emails]);

  const threadStartIds = useMemo(() => {
    const set = new Set();
    for (const threads of Object.values(threadsByRegion)) {
      for (const thread of threads) {
        if (thread.length > 1) set.add(thread[0].id);
      }
    }
    return set;
  }, [threadsByRegion]);

  const layoutKey = useMemo(
    () =>
      emails
        .map((e) => `${e.id}:${regionKey(e)}`)
        .sort()
        .join(','),
    [emails]
  );

  useEffect(() => {
    const layout = computeLayout(emails);
    setPositions((prev) => {
      const next = {};
      for (const email of emails) {
        const key = regionKey(email);
        const fresh = layout.positions[email.id];
        const draggedInRegion = draggedIdsRef.current.get(email.id);
        if (draggedInRegion != null && draggedInRegion === key && prev[email.id]) {
          // manually placed (by drag, or seeded from a saved server position
          // below) and still in the same category box - keep it where it is.
          next[email.id] = prev[email.id];
        } else if (draggedInRegion == null && prev[email.id] == null && email.pos_x != null && email.pos_y != null) {
          // first time this card has ever been positioned client-side, and
          // the server remembers a spot for it - restore it, then treat it
          // exactly like a manual placement from here on (see branch above),
          // so a later reclassify still correctly snaps it into a new box.
          const region = layout.regions.find((r) => r.key === key);
          next[email.id] = clampToRegion(email.pos_x, email.pos_y, region);
          draggedIdsRef.current.set(email.id, key);
        } else {
          next[email.id] = fresh;
          draggedIdsRef.current.delete(email.id);
        }
      }
      return next;
    });
    setRegions(layout.regions);
    setWorldSize(layout.worldSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  // Native (non-passive) wheel listener so preventDefault actually stops page scroll.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    function onWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const z = zoomRef.current;
      const p = panRef.current;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor));
      const ratio = newZoom / z;
      setPan({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio });
      setZoom(newZoom);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const panDragRef = useRef(null);
  const handlePanMove = useCallback((e) => {
    const d = panDragRef.current;
    if (!d) return;
    setPan({ x: d.startPan.x + (e.clientX - d.startX), y: d.startPan.y + (e.clientY - d.startY) });
  }, []);
  const handlePanUp = useCallback(() => {
    panDragRef.current = null;
    setIsPanning(false);
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleViewportMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('[data-email-block]')) return;
    panDragRef.current = { startX: e.clientX, startY: e.clientY, startPan: panRef.current };
    setIsPanning(true);
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanUp);
  }

  function handleCardPointerDown(e, id) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    // If an earlier drag's pointerup never fired for some reason, its
    // listeners would otherwise stay attached forever and race this new
    // drag - always clear any stray one before starting.
    activeDragCleanupRef.current?.();

    const email = emails.find((em) => em.id === id);
    const region = regions.find((r) => r.key === regionKey(email));
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPos = positions[id] || { x: 0, y: 0 };
    const pointerId = e.pointerId;
    // Real DOM node, captured now - e.currentTarget is nulled by React once
    // this handler returns, so it can't be read later from onUp.
    const target = e.currentTarget;

    setDraggingId(id);
    let lastPos = startPos;

    function onMove(ev) {
      if (ev.pointerId !== pointerId) return;
      const dx = (ev.clientX - startClientX) / zoomRef.current;
      const dy = (ev.clientY - startClientY) / zoomRef.current;
      // Free-follow the cursor while actually dragging - clamping in real time
      // made the card stop responding the moment it hit its box's edge, which
      // read as "broken", not "constrained". The constraint is enforced once,
      // on release, below - a card is never allowed to be left outside its
      // category's box, it just isn't fought with mid-drag.
      lastPos = { x: startPos.x + dx, y: startPos.y + dy };
      draggedIdsRef.current.set(id, regionKey(email));
      setPositions((prev) => ({ ...prev, [id]: lastPos }));
    }
    function finish() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // already released (e.g. element unmounted mid-drag) - fine to ignore
      }
      activeDragCleanupRef.current = null;
    }
    function onUp(ev) {
      if (ev.pointerId !== pointerId) return;
      finish();
      setDraggingId(null);
      const snapped = clampToRegion(lastPos.x, lastPos.y, region);
      setPositions((prev) => ({ ...prev, [id]: snapped }));
      if (snapped.x !== startPos.x || snapped.y !== startPos.y) onPositionChange?.(id, snapped.x, snapped.y);
    }

    // Pointer capture is the actual fix for "dragging is flaky": once
    // captured, this pointer's move/up events keep targeting (and bubbling
    // from) `target` even if the cursor leaves the card, the viewport, or
    // the browser window entirely - a plain window mousemove/mouseup listener
    // can silently miss events in exactly those cases, leaving a drag stuck.
    target.setPointerCapture(pointerId);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    activeDragCleanupRef.current = finish;
  }

  function zoomBy(factor) {
    const el = viewportRef.current;
    const rect = el?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    const z = zoomRef.current;
    const p = panRef.current;
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor));
    const ratio = newZoom / z;
    setPan({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio });
    setZoom(newZoom);
  }

  function resetView() {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fitZoom = Math.min(rect.width / worldSize.w, rect.height / worldSize.h) * 3.2;
    const z = Math.min(0.8, Math.max(ZOOM_MIN, fitZoom || 0.5));
    setZoom(z);
    setPan({ x: 60, y: 40 });
  }

  if (emails.length === 0) {
    return (
      <p className="px-5 py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
        No emails to place on the board yet.
      </p>
    );
  }

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        className={`relative h-[78vh] overflow-hidden rounded-xl border border-zinc-200 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-[length:22px_22px] dark:border-zinc-800 dark:bg-zinc-950 dark:bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          style={{
            width: worldSize.w,
            height: worldSize.h,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="relative"
        >
          {regions.map((r) => {
            const meta = REGION_META[r.key];
            return (
              <div
                key={r.key}
                style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                className={`absolute rounded-2xl border-2 ${meta.border} ${meta.bg}`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${meta.header}`}>
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {r.count} email{r.count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            );
          })}

          <svg width={worldSize.w} height={worldSize.h} className="pointer-events-none absolute left-0 top-0">
            {regions.map((r) => {
              const meta = REGION_META[r.key];
              const threads = threadsByRegion[r.key] || [];
              return threads.map((thread) =>
                thread.slice(1).map((email, i) => {
                  const prev = thread[i];
                  const a = positions[prev.id];
                  const b = positions[email.id];
                  if (!a || !b) return null;
                  return (
                    <path
                      key={`${prev.id}-${email.id}`}
                      d={branchPath(a, b)}
                      fill="none"
                      stroke={meta.stroke}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      opacity={0.75}
                    />
                  );
                })
              );
            })}
          </svg>

          {emails.map((email) => {
            const pos = positions[email.id];
            if (!pos) return null;
            return (
              <div key={email.id}>
                {threadStartIds.has(email.id) && (
                  <GitBranch
                    style={{ left: pos.x - 24, top: pos.y + 34 }}
                    className="pointer-events-none absolute h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600"
                  />
                )}
                <EmailBoardCard
                  email={email}
                  pos={pos}
                  isDragging={draggingId === email.id}
                  onCardPointerDown={handleCardPointerDown}
                  onUpdate={onUpdate}
                  onSent={onSent}
                  onDelete={onDelete}
                  onOpenCompose={(target, initialBody) => setCompose({ email: target, initialBody })}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute right-3 top-3 flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90">
        <button
          onClick={() => zoomBy(1.25)}
          title="Zoom in"
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => zoomBy(0.8)}
          title="Zoom out"
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={resetView}
          title="Reset view"
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <p className="absolute bottom-3 left-3 rounded-md bg-white/80 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-500">
        Scroll to zoom · drag the canvas to pan · drag a card's header to move it
      </p>

      {compose && (
        <ComposeModal
          email={compose.email}
          initialBody={compose.initialBody}
          onClose={() => setCompose(null)}
          onSent={(updated) => {
            onUpdate(updated);
            onSent(); // the send also inserted a new "out" row in the thread - refetch so its branch node shows up
          }}
        />
      )}
    </div>
  );
}
