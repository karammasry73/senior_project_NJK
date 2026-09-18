// Draws YOLO region boxes onto a canvas overlaid on a <video> or <img>,
// mapping from the media's intrinsic pixel space to its displayed size
// (accounting for object-fit: contain letterboxing).

function colorForLabel(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}

// mediaEl: video or img element. intrinsicSize: {width, height} of the source
// pixel space the regions' boxes are expressed in (video.videoWidth/Height,
// or the image_width/height returned alongside the regions).
export function drawRegions(canvas, mediaEl, regions, intrinsicSize) {
  const displayWidth = mediaEl.clientWidth;
  const displayHeight = mediaEl.clientHeight;
  if (!displayWidth || !displayHeight || !intrinsicSize.width || !intrinsicSize.height) return;

  canvas.width = displayWidth;
  canvas.height = displayHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, displayWidth, displayHeight);
  if (!regions || regions.length === 0) return;

  const mediaAspect = intrinsicSize.width / intrinsicSize.height;
  const boxAspect = displayWidth / displayHeight;
  let renderedWidth, renderedHeight, offsetX, offsetY;
  if (mediaAspect > boxAspect) {
    renderedWidth = displayWidth;
    renderedHeight = displayWidth / mediaAspect;
    offsetX = 0;
    offsetY = (displayHeight - renderedHeight) / 2;
  } else {
    renderedHeight = displayHeight;
    renderedWidth = displayHeight * mediaAspect;
    offsetY = 0;
    offsetX = (displayWidth - renderedWidth) / 2;
  }
  const scaleX = renderedWidth / intrinsicSize.width;
  const scaleY = renderedHeight / intrinsicSize.height;

  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textBaseline = 'top';

  for (const region of regions) {
    const [x1, y1, x2, y2] = region.box;
    const sx = offsetX + x1 * scaleX;
    const sy = offsetY + y1 * scaleY;
    const sw = (x2 - x1) * scaleX;
    const sh = (y2 - y1) * scaleY;

    // OCR runs server-side purely to validate the detection, not to be read
    // live off the screen: a box whose content matches the field's expected
    // pattern (a real date in a date box, etc.) draws with a thicker, greener
    // outline - a quiet "this reading looks right" signal, no text shown.
    let color = colorForLabel(region.label);
    let lineWidth = 2;
    if (region.pattern_match === true) {
      color = '#4ade80';
      lineWidth = 3;
    } else if (region.pattern_match === false) {
      color = '#fb923c';
      lineWidth = 3;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(sx, sy, sw, sh);

    const text = `${region.label} ${Math.round(region.confidence * 100)}%`;
    const textWidth = ctx.measureText(text).width;
    const labelY = sy > 18 ? sy - 18 : sy;
    ctx.fillStyle = color;
    ctx.fillRect(sx, labelY, textWidth + 8, 18);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillText(text, sx + 4, labelY + 2);
  }
}
