// core/events.js — event helpers
export function newId(prefix="e") {
  return prefix + "_" + crypto.randomUUID();
}

export function makeEvent({ productionType, entityType, entityId, eventType, date, payload, notes, userId }) {
  const now = new Date().toISOString();
  return {
    id: newId("ev"),
    productionType,
    entityType,
    entityId,
    eventType,
    date: date || now,
    payload: payload || {},
    notes: notes || "",
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
    deletedAt: null
  };
}
