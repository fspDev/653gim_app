// Implementación no-op para nativo (iOS/Android build). La real está en
// pipTimer.web.js y Metro la usa automáticamente en el bundle web.
export function isPiPSupported() {
  return false;
}
export function drawExerciseFrame() {}
export async function requestTimerPiP() {
  return false;
}
export function exitTimerPiP() {}
export function stopPiPStream() {}
export function onPiPLeave() {}
