# Modelo de datos Firestore — 653 Gym & Fitness

## `users/{uid}`
```
role: 'client' | 'admin'
firstName, lastName
email
phone
dni
coachName        // solo clientes
planType: 'daily' | 'weekly'
weeklyDays: ['mon','tue','wed','thu','fri','sat']
sessionTime: '18:30'
feeStatus: 'ok' | 'overdue'
notifPrefs: { restEnd: bool, gymReminder: bool, feeReminder: bool }
createdAt
```

## `plans/{uid}/days/{dayId}`
```
label: 'Día 1'
order: 1
groups: {
  core:   [ { id, name, sets, reps, restSeconds, order } ],
  fuerza: [ { id, name, sets, reps, restSeconds, order } ]
}
updatedAt
```

## `sessions/{uid}/logs/{sessionId}`
```
dayId
date            // 'YYYY-MM-DD'
startedAt, completedAt
exercises: [
  {
    exerciseId, name,
    sets: [ { weight, reps, completedAt } ]
  }
]
percentComplete
durationMin
```

Rol admin fijo para el prototipo: email `admin@653gym.app` / password `admin#`
(se crea a mano una vez en Firebase Auth, con `role: 'admin'` en su doc de `users`).
