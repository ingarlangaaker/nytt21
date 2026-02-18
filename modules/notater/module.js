// modules/notater/module.js — dagbok/notater + bildevedlegg (offline)
import { openPrintWindow } from "../../core/utils/print.js";

const nowIso = () => new Date().toISOString();
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDT(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function fmtDate(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleDateString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit"}); }

async function fileToDataUrl(file){
  return await new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result||""));
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}

export async function renderNotater(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");
  const user = state.activeUser;

  const notes = (dbState.notes||[]).slice().sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Notater</div>
        <h2 style="margin:8px 0 0 0">Dagbok / logg</h2>
        <div class="muted">Skriv notater og legg ved bilde (lagres lokalt i nettleseren).</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Nytt notat</h3>
          <div class="grid">
            <div class="field"><label>Dato (valgfritt)</label><input id="n_date" type="date"/></div>
            <div class="field"><label>Tittel</label><input id="n_title" placeholder="f.eks. Lammetid, vær, avvik…"/></div>
            <div class="field"><label>Tekst</label><textarea id="n_text" rows="4" placeholder="Skriv her…"></textarea></div>
            <div class="field">
              <label>Bilde (valgfritt)</label>
              <input id="n_file" type="file" accept="image/*"/>
              <div class="muted">Bilder gjør backup større. Bruk ved behov.</div>
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
            <button class="btn primary" id="save">Lagre</button>
            <button class="btn" id="export">Eksporter (PDF)</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Søk</h3>
          <div class="field"><label>Tekst</label><input id="q" placeholder="søk…"/></div>
          <div class="muted" style="margin-top:8px">Filtrer listen under mens du skriver.</div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Dato</th><th>Tittel</th><th>Tekst</th><th>Bilde</th><th></th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </div>
  `;

  const rowsEl = view.querySelector("#rows");
  const qEl = view.querySelector("#q");

  const renderRows = (q="") => {
    const qq=(q||"").toLowerCase().trim();
    const visible = notes.filter(n=>!qq || (n.title||"").toLowerCase().includes(qq) || (n.text||"").toLowerCase().includes(qq));
    rowsEl.innerHTML = visible.map(n=>`
      <tr>
        <td>${esc(n.date?fmtDate(n.date):fmtDT(n.createdAt))}</td>
        <td><strong>${esc(n.title||"")}</strong><div class="muted">Av ${esc(n.createdBy||"")}</div></td>
        <td class="muted" style="max-width:420px">${esc((n.text||"").slice(0,220))}${(n.text||"").length>220?"…":""}</td>
        <td>${n.imageDataUrl?`<img src="${n.imageDataUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid var(--line)"/>`:""}</td>
        <td style="text-align:right">
          <button class="btn" data-open="${n.id}">Åpne</button>
          <button class="btn danger" data-del="${n.id}">Slett</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="muted">Ingen notater.</td></tr>`;

    rowsEl.querySelectorAll("button[data-open]").forEach(b=>b.onclick=()=>openNote(b.getAttribute("data-open")));
    rowsEl.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
      const id=b.getAttribute("data-del");
      if(!confirm("Slette notat?")) return;
      await db.transaction(async (draft)=>{ draft.notes=(draft.notes||[]).filter(x=>x.id!==id); });
      location.hash="#/notater";
    });
  };

  const openNote = (id) => {
    const n=notes.find(x=>x.id===id); if(!n) return;
    openPrintWindow({
      title: "Notat",
      subtitle: (dbState.meta?.farmName||"Min gård"),
      html: `
        <div class="badge">${esc(n.date?fmtDate(n.date):fmtDT(n.createdAt))}</div>
        <h2 style="margin:8px 0 0 0">${esc(n.title||"")}</h2>
        <div class="muted" style="margin-top:6px">Av ${esc(n.createdBy||"")} • ${esc(fmtDT(n.createdAt))}</div>
        <div style="margin-top:12px;white-space:pre-wrap">${esc(n.text||"")}</div>
        ${n.imageDataUrl?`<div style="margin-top:12px"><img src="${n.imageDataUrl}" style="max-width:100%;border-radius:18px;border:1px solid var(--line)"/></div>`:""}
      `
    });
  };

  renderRows("");
  qEl.addEventListener("input",(e)=>renderRows(e.target.value));

  view.querySelector("#save").onclick = async () => {
    const title=(view.querySelector("#n_title").value||"").trim();
    const text=(view.querySelector("#n_text").value||"").trim();
    const date = view.querySelector("#n_date").value ? new Date(view.querySelector("#n_date").value+"T12:00:00").toISOString() : "";
    if(!title && !text) return alert("Skriv tittel eller tekst.");
    const file = view.querySelector("#n_file").files?.[0] || null;
    let imageDataUrl="";
    if(file) imageDataUrl = await fileToDataUrl(file);
    const id="n_"+crypto.randomUUID();
    await db.transaction(async (draft)=>{
      draft.notes=draft.notes||[];
      draft.notes.push({ id, title, text, date, imageDataUrl, createdAt: nowIso(), createdBy: user.id });
    });
    location.hash="#/notater";
  };

  view.querySelector("#export").onclick = () => {
    const rows = notes.slice(0,200).map(n=>`
      <tr><td>${esc(n.date?fmtDate(n.date):fmtDT(n.createdAt))}</td><td>${esc(n.title||"")}</td><td>${esc((n.text||"").slice(0,500))}</td></tr>
    `).join("");
    openPrintWindow({
      title: "Notater (utdrag)",
      subtitle: (dbState.meta?.farmName||"Min gård")+" • "+(dbState.meta?.geo?.municipalityName||""),
      html: `<table><thead><tr><th>Dato</th><th>Tittel</th><th>Tekst</th></tr></thead><tbody>${rows||"<tr><td colspan='3'>Ingen data</td></tr>"}</tbody></table>`
    });
  };
}
