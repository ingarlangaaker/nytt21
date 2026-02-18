// core/auth.js — RBAC-light + active user
export function getActiveUser(dbState) {
  const id = dbState.activeUserId;
  return dbState.users.find(u => u.id === id) || dbState.users[0];
}
