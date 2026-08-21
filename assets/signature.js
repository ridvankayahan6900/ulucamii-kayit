(function () {
  'use strict';

  const app = window.KayitApp = window.KayitApp || {};
  const signature = app.signature = {
    strokes: [],
    activeStroke: null,
    canvas: null,
    context: null,
    dialog: null,
    darkQuery: null,
    lastPoint: null,
    lastTime: 0
  };

  function pointFromEvent(event) {
    const rect = signature.canvas.getBoundingClientRect();
    const now = performance.now();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
    const last = signature.lastPoint;
    const distance = last ? Math.hypot((x - last.x) * rect.width, (y - last.y) * rect.height) : 0;
    const elapsed = Math.max(1, now - signature.lastTime);
    const speed = distance / elapsed;
    const pressure = event.pressure && event.pressure > 0 ? event.pressure : Math.max(.2, Math.min(.7, .7 - speed * .16));
    const weight = Math.max(.12, Math.min(1, pressure * .82 + Math.max(0, .28 - speed * .07)));
    signature.lastPoint = { x, y };
    signature.lastTime = now;
    return { x, y, weight };
  }

  function currentInk() {
    return signature.darkQuery && signature.darkQuery.matches ? '#f4ead7' : '#1f2926';
  }

  function drawStrokes(context, width, height, color, scaleFactor) {
    const baseScale = scaleFactor || Math.max(.85, Math.min(1.8, Math.min(width, height) / 500));
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;

    signature.strokes.forEach((stroke) => {
      if (!stroke.length) return;
      if (stroke.length === 1) {
        const point = stroke[0];
        context.beginPath();
        context.fillStyle = color;
        context.arc(point.x * width, point.y * height, (1.3 + point.weight * 1.9) * baseScale, 0, Math.PI * 2);
        context.fill();
        return;
      }

      context.beginPath();
      context.moveTo(stroke[0].x * width, stroke[0].y * height);
      for (let index = 1; index < stroke.length; index += 1) {
        const previous = stroke[index - 1];
        const point = stroke[index];
        const midpointX = ((previous.x + point.x) / 2) * width;
        const midpointY = ((previous.y + point.y) / 2) * height;
        context.lineWidth = (1.25 + ((previous.weight + point.weight) / 2) * 3.1) * baseScale;
        context.quadraticCurveTo(previous.x * width, previous.y * height, midpointX, midpointY);
        context.stroke();
        context.beginPath();
        context.moveTo(midpointX, midpointY);
      }
      const last = stroke[stroke.length - 1];
      context.lineTo(last.x * width, last.y * height);
      context.stroke();
    });
  }

  function render() {
    if (!signature.canvas || !signature.context) return;
    const rect = signature.canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (signature.canvas.width !== width || signature.canvas.height !== height) {
      signature.canvas.width = width;
      signature.canvas.height = height;
    }
    const context = signature.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.scale(dpr, dpr);
    drawStrokes(context, rect.width, rect.height, currentInk());
    updateToolbar();
  }

  function updateToolbar() {
    const undo = document.getElementById('undoSignatureButton');
    const clear = document.getElementById('clearSignatureButton');
    const empty = signature.strokes.length === 0;
    if (undo) undo.disabled = empty;
    if (clear) clear.disabled = empty;
  }

  function exportDataUrl() {
    if (!signature.strokes.length) return '';
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    drawStrokes(context, canvas.width, canvas.height, '#121a17', 2.8);
    return canvas.toDataURL('image/png');
  }

  function updatePreview() {
    const preview = document.getElementById('signaturePreview');
    const placeholder = document.getElementById('signaturePlaceholder');
    const clearInline = document.getElementById('clearSignatureInline');
    const trigger = document.getElementById('signatureTrigger');
    const dataUrl = app.state && app.state.signatureData;
    if (!preview || !placeholder || !trigger) return;
    preview.hidden = !dataUrl;
    placeholder.hidden = Boolean(dataUrl);
    clearInline.hidden = !dataUrl;
    trigger.classList.toggle('has-signature', Boolean(dataUrl));
    if (dataUrl) preview.src = dataUrl;
    else preview.removeAttribute('src');
  }

  function pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    signature.canvas.setPointerCapture(event.pointerId);
    signature.activeStroke = [];
    signature.lastPoint = null;
    signature.lastTime = performance.now();
    signature.strokes.push(signature.activeStroke);
    signature.activeStroke.push(pointFromEvent(event));
    render();
  }

  function pointerMove(event) {
    if (!signature.activeStroke || !signature.canvas.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const next = pointFromEvent(event);
    const previous = signature.activeStroke[signature.activeStroke.length - 1];
    if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) > .0014) {
      signature.activeStroke.push(next);
      render();
    }
  }

  function pointerUp(event) {
    if (!signature.activeStroke) return;
    event.preventDefault();
    if (signature.canvas.hasPointerCapture(event.pointerId)) signature.canvas.releasePointerCapture(event.pointerId);
    signature.activeStroke = null;
    signature.lastPoint = null;
    render();
  }

  signature.open = function () {
    document.getElementById('signatureDialogError').textContent = '';
    if (typeof signature.dialog.showModal === 'function') signature.dialog.showModal();
    else signature.dialog.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      render();
      signature.canvas.focus({ preventScroll: true });
    });
  };

  signature.undo = function () {
    signature.strokes.pop();
    render();
  };

  signature.clear = function () {
    signature.strokes = [];
    if (app.state) {
      app.state.signatureData = '';
      app.state.signatureStrokes = [];
    }
    updatePreview();
    render();
    if (typeof app.saveDraft === 'function') app.saveDraft();
  };

  signature.finish = function () {
    if (!signature.strokes.length) {
      document.getElementById('signatureDialogError').textContent = app.t('signatureEmpty');
      return false;
    }
    const dataUrl = exportDataUrl();
    app.state.signatureData = dataUrl;
    app.state.signatureStrokes = signature.strokes.map((stroke) => stroke.map((point) => ({ ...point })));
    updatePreview();
    signature.dialog.close();
    document.body.style.overflow = '';
    document.getElementById('signatureError').textContent = '';
    if (typeof app.saveDraft === 'function') app.saveDraft();
    document.getElementById('signatureTrigger').focus({ preventScroll: true });
    return true;
  };

  signature.dataUrl = function () {
    return app.state ? app.state.signatureData || '' : '';
  };

  signature.isEmpty = function () {
    return !signature.strokes.length && !(app.state && app.state.signatureData);
  };

  signature.refreshLanguage = function () {
    const error = document.getElementById('signatureDialogError');
    if (error && error.textContent) error.textContent = app.t('signatureEmpty');
  };

  signature.init = function () {
    signature.canvas = document.getElementById('signatureCanvas');
    signature.context = signature.canvas.getContext('2d', { alpha: true });
    signature.dialog = document.getElementById('signatureDialog');
    signature.darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    signature.canvas.tabIndex = 0;
    signature.strokes = Array.isArray(app.state.signatureStrokes)
      ? app.state.signatureStrokes.map((stroke) => stroke.map((point) => ({ ...point })))
      : [];

    signature.canvas.addEventListener('pointerdown', pointerDown);
    signature.canvas.addEventListener('pointermove', pointerMove);
    signature.canvas.addEventListener('pointerup', pointerUp);
    signature.canvas.addEventListener('pointercancel', pointerUp);
    document.getElementById('signatureTrigger').addEventListener('click', signature.open);
    document.getElementById('finishSignatureButton').addEventListener('click', signature.finish);
    document.getElementById('undoSignatureButton').addEventListener('click', signature.undo);
    document.getElementById('clearSignatureButton').addEventListener('click', signature.clear);
    document.getElementById('clearSignatureInline').addEventListener('click', signature.clear);
    signature.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      signature.dialog.close();
      document.body.style.overflow = '';
      document.getElementById('signatureTrigger').focus({ preventScroll: true });
    });
    window.addEventListener('resize', () => {
      if (signature.dialog.open) requestAnimationFrame(render);
    }, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(render, 120), { passive: true });
    if (typeof signature.darkQuery.addEventListener === 'function') signature.darkQuery.addEventListener('change', render);
    updatePreview();
    updateToolbar();
  };
}());
