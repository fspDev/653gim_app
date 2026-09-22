// Picture-in-Picture "de verdad" para el ejercicio en curso: dibujamos el
// estado (serie, peso, descanso) en un <canvas> oculto, lo convertimos en un
// video en vivo (canvas.captureStream) y le pedimos al navegador que lo
// muestre en la ventanita flotante nativa de Android/Chrome — el mismo
// mecanismo que usa YouTube. Por eso sigue visible aunque cambies de app.
let canvas = null;
let ctx = null;
let video = null;
let stream = null;
let leaveCallback = null;

function ensureElements() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 360;
  ctx = canvas.getContext('2d');

  video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  // Tiene que existir en el DOM (no display:none) para que el navegador
  // permita pedir PiP, pero no hace falta que se vea en la pantalla normal.
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.top = '-9999px';
  video.style.width = '2px';
  video.style.height = '2px';
  document.body.appendChild(video);

  // El usuario también puede cerrar la ventanita flotante con la X del
  // navegador; avisamos para que la UI deje de mostrarla como activa.
  video.addEventListener('leavepictureinpicture', () => {
    if (leaveCallback) leaveCallback();
  });
}

// Se llama una sola vez desde el contexto de React para enterarse cuando el
// usuario cierra la ventana flotante desde el navegador (no desde la app).
export function onPiPLeave(callback) {
  leaveCallback = callback;
}

export function isPiPSupported() {
  return typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
}

// payload:
//  - exerciseName: nombre del ejercicio (siempre)
//  - resting: true mientras corre el descanso
//  - timeText: "mm:ss" restante (solo si resting)
//  - percent: 0..1 del descanso consumido (solo si resting)
//  - serieText: ej. "Serie 2 de 4" o "¡Listo!" (estado siempre visible)
//  - weightText: ej. "40 kg" (solo si NO resting y aplica peso)
export function drawExerciseFrame({ exerciseName, resting, timeText, percent, serieText, weightText }) {
  ensureElements();
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 - 16;

  if (resting) {
    const r = 118;
    const p = Math.max(0, Math.min(1, percent || 0));

    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 16;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.strokeStyle = '#e3202f';
    ctx.lineWidth = 16;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 56px system-ui, -apple-system, sans-serif';
    ctx.fillText(timeText || '', cx, cy - 4);

    ctx.fillStyle = '#8a8a8f';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('descanso restante', cx, cy + 40);

    ctx.fillStyle = '#e3202f';
    ctx.font = '700 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(serieText || '', cx, cy + 70);
  } else {
    ctx.fillStyle = '#e3202f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('EN CURSO', cx, cy - 90);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 46px system-ui, -apple-system, sans-serif';
    ctx.fillText(serieText || '', cx, cy - 20);

    if (weightText) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 34px system-ui, -apple-system, sans-serif';
      ctx.fillText(weightText, cx, cy + 40);
      ctx.fillStyle = '#8a8a8f';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('peso actual', cx, cy + 72);
    }
  }

  ctx.fillStyle = resting ? '#e3202f' : '#8a8a8f';
  ctx.textAlign = 'center';
  ctx.font = '800 18px system-ui, -apple-system, sans-serif';
  ctx.fillText((exerciseName || '').toUpperCase(), cx, h - 34);
}

export async function requestTimerPiP() {
  ensureElements();
  if (!isPiPSupported()) return false;
  try {
    if (!stream) {
      stream = canvas.captureStream(2);
      video.srcObject = stream;
      await video.play();
    }
    if (document.pictureInPictureElement !== video) {
      await video.requestPictureInPicture();
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function exitTimerPiP() {
  try {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
  } catch (e) {}
}

export function stopPiPStream() {
  exitTimerPiP();
  try {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
  } catch (e) {}
}
