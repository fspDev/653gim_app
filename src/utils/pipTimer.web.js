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
let enterCallback = null;
let autoOnLeave = false;
let openedByLeave = false;

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
  // Safari: pasa solo a flotante al salir de la app si el video está andando.
  video.autoPictureInPicture = true;
  video.setAttribute('autopictureinpicture', '');
  // Tiene que existir en el DOM (no display:none) para que el navegador
  // permita pedir PiP, pero no hace falta que se vea en la pantalla normal.
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.top = '-9999px';
  video.style.width = '2px';
  video.style.height = '2px';
  document.body.appendChild(video);

  video.addEventListener('leavepictureinpicture', () => {
    openedByLeave = false;
    if (leaveCallback) leaveCallback();
  });
  video.addEventListener('enterpictureinpicture', () => {
    if (enterCallback) enterCallback();
  });

  // Chrome llama a este handler cuando el usuario sale de la pestaña/app
  // mientras hay un video andando, y ahí SÍ deja abrir la ventana flotante
  // sin un toque (es el "PiP automático" que usan las videollamadas).
  try {
    navigator.mediaSession?.setActionHandler('enterpictureinpicture', () => {
      if (!autoOnLeave || !stream) return;
      openedByLeave = true;
      video.requestPictureInPicture().catch(() => {
        openedByLeave = false;
      });
    });
  } catch (e) {}

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Por si el navegador no usa el handler de arriba pero igual lo permite.
      if (autoOnLeave && stream && document.pictureInPictureElement !== video) {
        openedByLeave = true;
        video.requestPictureInPicture().catch(() => {
          openedByLeave = false;
        });
      }
    } else if (openedByLeave && document.pictureInPictureElement === video) {
      // Se abrió sola al salir: al volver a la app se cierra sola.
      document.exitPictureInPicture().catch(() => {});
    }
  });
}

export function onPiPLeave(callback) {
  leaveCallback = callback;
}

export function onPiPEnter(callback) {
  enterCallback = callback;
}

export function isPiPSupported() {
  return typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
}

async function ensureStream() {
  ensureElements();
  if (!stream) {
    stream = canvas.captureStream(2);
    video.srcObject = stream;
  }
  if (video.paused) await video.play();
}

// Deja el video andando (oculto) para que, si el usuario cambia de app, el
// navegador pueda pasarlo a ventana flotante. Un video mudo puede arrancar
// sin toque del usuario.
export async function armAutoPiP() {
  if (!isPiPSupported()) return;
  autoOnLeave = true;
  try {
    await ensureStream();
  } catch (e) {}
}

export function disarmAutoPiP() {
  autoOnLeave = false;
}

// payload:
//  - exerciseName: nombre del ejercicio (siempre)
//  - resting: true mientras corre un cronómetro (descanso o bici)
//  - timeText: "mm:ss" restante (solo si resting)
//  - percent: 0..1 restante (solo si resting)
//  - ringLabel: texto bajo el tiempo, ej. "descanso restante"
//  - serieText: ej. "Serie 2 de 4" o "¡Listo!"
//  - weightText: ej. "40 kg" (solo si NO resting y aplica peso)
export function drawExerciseFrame({ exerciseName, resting, timeText, percent, ringLabel, serieText, weightText }) {
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
    ctx.fillText(ringLabel || 'descanso restante', cx, cy + 40);

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
    await ensureStream();
    if (document.pictureInPictureElement !== video) {
      openedByLeave = false;
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
