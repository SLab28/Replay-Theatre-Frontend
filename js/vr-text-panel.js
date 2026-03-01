/**
 * vr-text-panel.js
 * Renders text onto a canvas-textured Three.js plane for in-VR display.
 * Used for voice transcript overlay below the sphere.
 */

import * as THREE from 'three';

// ─── Configuration ───────────────────────────────────────────────────────
const CANVAS_W = 1024;
const CANVAS_H = 256;
const PANEL_WORLD_W = 0.8;   // metres wide in world space
const PANEL_WORLD_H = PANEL_WORLD_W * (CANVAS_H / CANVAS_W);
const FONT_SIZE = 32;
const LINE_HEIGHT = 40;
const PADDING = 24;
const MAX_LINES = 5;
const BG_COLOR = 'rgba(5, 2, 18, 0.85)';
const TEXT_COLOR = '#ffffff';
const FONT_FAMILY = 'system-ui, -apple-system, sans-serif';

/**
 * Create a text panel mesh suitable for VR display.
 *
 * @param {object} [options]
 * @param {number} [options.width]  — world-space width in metres
 * @param {number} [options.height] — world-space height in metres
 * @returns {THREE.Mesh} — mesh with .userData.update(text) method
 */
export function createTextPanel(options = {}) {
  const worldW = options.width ?? PANEL_WORLD_W;
  const worldH = options.height ?? PANEL_WORLD_H;

  // Offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });

  const geometry = new THREE.PlaneGeometry(worldW, worldH);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'vr-text-panel';
  mesh.renderOrder = 9999;
  mesh.frustumCulled = false;

  // Store references for update
  mesh.userData._canvas = canvas;
  mesh.userData._ctx = ctx;
  mesh.userData._texture = texture;
  mesh.userData._lastText = '';

  /**
   * Update the displayed text. Only redraws if text changed.
   * @param {string} text
   */
  mesh.userData.update = (text) => {
    if (text === mesh.userData._lastText) return;
    mesh.userData._lastText = text;
    _drawText(ctx, canvas, text);
    texture.needsUpdate = true;
  };

  // Draw initial empty state
  _drawText(ctx, canvas, '');
  texture.needsUpdate = true;

  return mesh;
}

/**
 * Draw wrapped text on the canvas with a semi-transparent black background.
 */
function _drawText(ctx, canvas, text) {
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = BG_COLOR;
  _roundRect(ctx, 0, 0, w, h, 16);
  ctx.fill();

  if (!text || !text.trim()) return;

  // Text
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `400 ${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';

  const lines = _wordWrap(ctx, text.trim(), w - PADDING * 2);
  // Show only the last MAX_LINES lines (scroll effect)
  const visibleLines = lines.slice(-MAX_LINES);

  for (let i = 0; i < visibleLines.length; i++) {
    ctx.fillText(visibleLines[i], PADDING, PADDING + i * LINE_HEIGHT);
  }
}

/**
 * Word-wrap text to fit within maxWidth.
 */
function _wordWrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Draw a rounded rectangle path.
 */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
