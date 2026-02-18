export function isoFromDateInput(value, endOfDay=false){
  if(!value) return "";
  const t = endOfDay ? "T23:59:59" : "T12:00:00";
  return new Date(value + t).toISOString();
}
export function fmtDate(iso){
  if(!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit"});
}
export function fmtDT(iso){
  if(!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
