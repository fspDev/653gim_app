import { savePlanDay } from './plans';
import { updateUserProfile } from './users';

// Carga el plan real de la planilla en PDF (Franco Pereyra / Profe Agus)
export async function seedDemoPlan(uid) {
  await savePlanDay(uid, 'day1', {
    label: 'Día 1',
    order: 1,
    groups: {
      core: [
        { id: 'd1c1', name: 'Plancha con toque de hombros', sets: 3, reps: 30, restSeconds: 30, order: 1 },
        { id: 'd1c2', name: 'Bicho muerto con mancuernas', sets: 3, reps: 20, restSeconds: 30, order: 2 },
      ],
      fuerza: [
        { id: 'd1f1', name: 'Press banca con barra', sets: 4, reps: 12, restSeconds: 180, order: 1 },
        { id: 'd1f2', name: 'Press militar con mancuernas', sets: 4, reps: 10, restSeconds: 180, order: 2 },
        { id: 'd1f3', name: 'Vuelos laterales', sets: 4, reps: 10, restSeconds: 180, order: 3 },
        { id: 'd1f4', name: 'Sentadilla en máquina', sets: 4, reps: 12, restSeconds: 180, order: 4 },
        { id: 'd1f5', name: 'Prensa 45', sets: 3, reps: 12, restSeconds: 180, order: 5 },
        { id: 'd1f6', name: 'Extensión de tríceps en polea', sets: 4, reps: 12, restSeconds: 180, order: 6 },
        { id: 'd1f7', name: 'Press francés con mancuernas', sets: 4, reps: 12, restSeconds: 180, order: 7 },
      ],
    },
  });

  await savePlanDay(uid, 'day2', {
    label: 'Día 2',
    order: 2,
    groups: {
      core: [
        { id: 'd2c1', name: 'Mano a pies', sets: 3, reps: 30, restSeconds: 30, order: 1 },
        { id: 'd2c2', name: 'Plancha con toque', sets: 3, reps: 30, restSeconds: 30, order: 2 },
      ],
      fuerza: [
        { id: 'd2f1', name: 'Jalón al pecho', sets: 4, reps: 12, restSeconds: 180, order: 1 },
        { id: 'd2f2', name: 'Remo sentado en polea', sets: 4, reps: 10, restSeconds: 180, order: 2 },
        { id: 'd2f3', name: 'Remo T', sets: 4, reps: 12, restSeconds: 180, order: 3 },
        { id: 'd2f4', name: 'Posteriores en máquina', sets: 4, reps: 12, restSeconds: 180, order: 4 },
        { id: 'd2f5', name: 'Curl con barra', sets: 4, reps: 12, restSeconds: 180, order: 5 },
        { id: 'd2f6', name: 'Curl martillo con soga en polea', sets: 4, reps: 10, restSeconds: 180, order: 6 },
      ],
    },
  });

  await updateUserProfile(uid, {
    coachName: 'Agus',
    planType: 'weekly',
    weeklyDays: ['mon', 'tue', 'thu', 'fri'],
    sessionTime: '18:30',
  });
}
