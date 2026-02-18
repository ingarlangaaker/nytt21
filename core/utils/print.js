// core/utils/print.js — print-friendly window (user can Save as PDF)
export function openPrintWindow({ title, subtitle, html }) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return alert("Pop-up blokkert. Tillat pop-ups for å eksportere PDF.");
  const doc = w.document;
  doc.open();
  doc.write(`<!doctype html>
<html lang="no"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title || "Export")}</title>
<style>
  :root{--text:#0b1220;--muted:#55657a;--line:#d7dee8}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:28px;color:var(--text)}
  h1{margin:0 0 4px 0;font-size:22px}
  .sub{color:var(--muted);margin-bottom:14px}
  .meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:12px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{border:1px solid var(--line);padding:8px;font-size:12px;vertical-align:top}
  th{background:#f4f7fb;text-align:left}
  .badge{display:inline-block;border:1px solid var(--line);padding:2px 6px;border-radius:999px;font-size:11px;color:var(--muted)}
  .hr{height:1px;background:var(--line);margin:14px 0}
  @media print{ body{margin:10mm} .noprint{display:none} }
</style>
</head><body>
<div class="noprint" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <div class="badge">Tips: Velg “Lagre som PDF” i utskriftsdialogen</div>
  <button onclick="window.print()" style="padding:8px 10px;border:1px solid #d7dee8;border-radius:10px;background:#fff;cursor:pointer">Skriv ut / PDF</button>
</div>
<h1>${escapeHtml(title || "")}</h1>
<div class="sub">${escapeHtml(subtitle || "")}</div>
<div class="meta"><div>Generert: ${escapeHtml(new Date().toLocaleString("no-NO"))}</div></div>
<div class="hr"></div>
${html || ""}
</body></html>`);
  doc.close();
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
