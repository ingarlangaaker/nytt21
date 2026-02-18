// modules/kalender/module.js — kalender/årshjul (enkelt): hendelser + kobling til oppgaver/skifter
import { openPrintWindow } from "../../core/utils/print.js";
import { isoFromDateInput, fmtDate, fmtDT } from "../../core/utils/date.js";

function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
const TYPES = ["Frist","Plan","Beite","Helse","Maskin","Annet"];

export async function renderKalender(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");
  const user = state.activeUser;

  const events = (dbState.calendarEvents||[]).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Kalender</div>
        <h2 style="margin:8px 0 0 0">Årshjul</h2>
        <div class="muted">Legg inn frister, planer, beiteperioder og hendelser. Kan senere kobles til regelverk og varsler.</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Ny hendelse</h3>
          <div class="grid">
            <div class="grid two">
              <div class="field"><label>Dato</label><input id="e_date" type="date"/></div>
              <div class="field"><label>Type</label><select id="e_type">${TYPES.map(t=>`<option value="${t}">${t}</option>`).join("")}</select></div>
            </div>
            <div class="field"><label>Tittel</label><input id="e_title" placeholder="f.eks. søke PT, slått, lammetid, service…"/></div>
            <div class="grid two">
              <div class="field"><label>Skifte (valgfritt)</label>
                <select id="e_field"><option value="">Ingen</option>
                  ${Object.values(dbState.fields||{}).filter(f=>!f.deletedAt).map(f=>`<option value="${f.id}">${esc(f.name||f.id)}</option>`).join("")}
                </select>
              </div>
              <div class="field"><label>Notat</label><input id="e_note" placeholder="valgfritt"/></div>
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="add">Legg til</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Eksport</h3>
          <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
            <button class="btn" id="print">Kalender (PDF)</button>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Dato</th><th>Type</th><th>Tittel</th><th>Skifte</th><th></th></tr></thead>
          <tbody>
            ${events.map(e=>`
              <tr>
                <td>${esc(e.date?fmtDate(e.date):"")}</td>
                <td><span class="badge">${esc(e.type||"")}</span></td>
                <td><strong>${esc(e.title||"")}</strong>${e.note?`<div class="muted">${esc(e.note)}</div>`:""}</td>
                <td>${esc(e.fieldId ? (dbState.fields?.[e.fieldId]?.name||e.fieldId) : "")}</td>
                <td style="text-align:right"><button class="btn danger" data-del="${e.id}">Slett</button></td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="muted">Ingen hendelser.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  view.querySelector("#add").onclick = async ()=>{
    const date = isoFromDateInput(view.querySelector("#e_date").value);
    if(!date) return alert("Mangler dato.");
    const type = view.querySelector("#e_type").value;
    const title = (view.querySelector("#e_title").value||"").trim();
    if(!title) return alert("Mangler tittel.");
    const fieldId = view.querySelector("#e_field").value || "";
    const note = (view.querySelector("#e_note").value||"").trim();
    const id = "cal_" + crypto.randomUUID();
    await db.transaction(async (d)=>{
      d.calendarEvents = d.calendarEvents || [];
      d.calendarEvents.push({ id, date, type, title, fieldId, note, createdAt:new Date().toISOString(), createdBy:user.id });
    });
    location.hash="#/kalender";
  };

  view.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
    const id=b.getAttribute("data-del");
    if(!confirm("Slette hendelse?")) return;
    await db.transaction(async (d)=>{ d.calendarEvents = (d.calendarEvents||[]).filter(x=>x.id!==id); });
    location.hash="#/kalender";
  });

  view.querySelector("#print").onclick = ()=>{
    const rows = events.map(e=>`<tr><td>${esc(e.date?fmtDate(e.date):"")}</td><td>${esc(e.type||"")}</td><td>${esc(e.title||"")}</td><td>${esc(e.fieldId ? (dbState.fields?.[e.fieldId]?.name||e.fieldId) : "")}</td><td>${esc(e.note||"")}</td></tr>`).join("");
    openPrintWindow({
      title:"Kalender / årshjul",
      subtitle:(dbState.meta?.farmName||"Min gård")+" • "+(dbState.meta?.geo?.municipalityName||""),
      html:`<table><thead><tr><th>Dato</th><th>Type</th><th>Tittel</th><th>Skifte</th><th>Notat</th></tr></thead><tbody>${rows||"<tr><td colspan='5'>Ingen</td></tr>"}</tbody></table>`
    });
  };
}
