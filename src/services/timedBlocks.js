import { getExercisePref } from './exercisePrefs';

// Bloques por tiempo en bici fija que abren y cierran cada día de rutina.
// En la sesión se guardan como un ejercicio más de 1 "serie": así el
// progreso del día, el historial y el panel del profe los cuentan sin
// cambiar nada más.
export const WARMUP_ID = 'warmup';
export const COOLDOWN_ID = 'cooldown';
export const DEFAULT_WARMUP_MINUTES = 5;
export const DEFAULT_COOLDOWN_MINUTES = 5;

const BLOCKS = {
  [WARMUP_ID]: { name: 'Calentamiento', subtitle: 'Bici fija', group: 'warmup' },
  [COOLDOWN_ID]: { name: 'Elongación final', subtitle: 'Bici fija suave + elongación', group: 'cooldown' },
};

export function dayWarmupMinutes(day) {
  return day?.warmupMinutes ?? DEFAULT_WARMUP_MINUTES;
}

export function dayCooldownMinutes(day) {
  return day?.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
}

function buildBlock(id, minutes, prefs) {
  if (!minutes || minutes <= 0) return null;
  const meta = BLOCKS[id];
  const pref = getExercisePref(prefs, meta.name);
  return {
    exerciseId: id,
    kind: 'timed',
    name: meta.name,
    subtitle: meta.subtitle,
    group: meta.group,
    durationSeconds: pref?.durationSeconds ?? minutes * 60,
    targetSets: 1,
    reps: 0,
    restSeconds: 0,
    lastWeight: null,
    sets: [],
  };
}

export function buildWarmup(day, prefs) {
  return buildBlock(WARMUP_ID, dayWarmupMinutes(day), prefs);
}

export function buildCooldown(day, prefs) {
  return buildBlock(COOLDOWN_ID, dayCooldownMinutes(day), prefs);
}

export function isTimed(exercise) {
  return exercise?.kind === 'timed';
}
