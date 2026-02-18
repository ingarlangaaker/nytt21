// modules/plante/journal.js — gjødseljournal + sprøytejournal (plantevern) + export
import { openPrintWindow } from "../../core/utils/print.js";

const now = () => new Date().toISOString();
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDT(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function fieldName(dbState, fieldId){ const f=dbState.fields?.[fieldId]; return f ? (f.name || f.id) : fieldId; }

export async function renderPlanteJournal(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;

  const dbState = await db.get("db");
  const fields = Object.values(dbState.fields||{}).filter(f=>!f.deletedAt).sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  const fert = (dbState.fertilizerLog || []).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const pp = (dbState.plantProtectionLog || []).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  view.innerHTML = `
    <div class="grid">
      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Ny gjødsling</h3>
          <div class="grid">
            <div class="field">
              <label>Skifte</label>
              <select id="f_field">${fields.map(f=>`<option value="${f.id}">${esc(f.name||f.id)}</option>`).join("")}</select>
            </div>
            <div class="field"><label>Dato/tid</label><input id="f_date" type="datetime-local" /></div>
            <div class="field"><label>Produkt</label><input id="f_product" placeholder="f.eks. Fullgjødsel 22-3-10" /></div>
            <div class="grid two">
              <div class="field"><label>Mengde</label><input id="f_amount" inputmode="decimal" placeholder="f.eks. 20" /></div>
              <div class="field"><label>Enhet</label>
                <select id="f_unit"><option value="kg/daa">kg/daa</option><option value="kg">kg</option><option value="l/daa">l/daa</option><option value="l">l</option></select>
              </div>
            </div>
            <div class="field"><label>Notat</label><input id="f_note" placeholder="Kort notat…" /></div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="addF">Legg til</button></div>
          <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn" id="exportF">Eksporter gjødseljournal (PDF)</button></div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Ny sprøyting</h3>
          <div class="grid">
            <div class="field">
              <label>Skifte</label>
              <select id="p_field">${fields.map(f=>`<option value="${f.id}">${esc(f.name||f.id)}</option>`).join("")}</select>
            </div>
            <div class="field"><label>Dato/tid</label><input id="p_date" type="datetime-local" /></div>
            <div class="field"><label>Middel</label><input id="p_product" placeholder="f.eks. ugrasmiddel X" /></div>
            <div class="grid two">
              <div class="field"><label>Dosering</label><input id="p_dose" inputmode="decimal" placeholder="f.eks. 25" /></div>
              <div class="field"><label>Enhet</label>
                <select id="p_unit"><option value="ml/daa">ml/daa</option><option value="l/daa">l/daa</option><option value="ml">ml</option><option value="l">l</option></select>
              </div>
            </div>
            <div class="field"><label>Notat</label><input id="p_note" placeholder="Kort notat…" /></div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="addP">Legg til</button></div>
          <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn" id="exportP">Eksporter sprøytejournal (PDF)</button></div>
        </div>
      </div>

      <div class="grid two">
        <div class="card" style="padding:0">
          <table>
            <thead><tr><th colspan="5">Gjødseljournal</th></tr>
              <tr><th>Dato</th><th>Skifte</th><th>Produkt</th><th>Mengde</th><th>Notat</th></tr>
            </thead>
            <tbody>
              ${fert.map(x=>`<tr>
                <td>${fmtDT(x.date)}</td>
                <td><strong>${esc(fieldName(dbState,x.fieldId))}</strong></td>
                <td>${esc(x.product||"")}</td>
                <td>${esc(x.amount||"")} ${esc(x.unit||"")}</td>
                <td class="muted">${esc(x.note||"")}</td>
              </tr>`).join("") || `<tr><td colspan="5" class="muted">Ingen gjødslinger logget ennå.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th colspan="5">Sprøytejournal</th></tr>
              <tr><th>Dato</th><th>Skifte</th><th>Middel</th><th>Dosering</th><th>Notat</th></tr>
            </thead>
            <tbody>
              ${pp.map(x=>`<tr>
                <td>${fmtDT(x.date)}</td>
                <td><strong>${esc(fieldName(dbState,x.fieldId))}</strong></td>
                <td>${esc(x.product||"")}</td>
                <td>${esc(x.dose||"")} ${esc(x.unit||"")}</td>
                <td class="muted">${esc(x.note||"")}</td>
              </tr>`).join("") || `<tr><td colspan="5" class="muted">Ingen sprøyting logget ennå.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const parseDTLocal = (v) => v ? new Date(v).toISOString() : now();

  view.querySelector("#addF").onclick = async () => {
    const user = state.activeUser;
    const entry = {
      id: "fert_" + crypto.randomUUID(),
      fieldId: view.querySelector("#f_field").value,
      date: parseDTLocal(view.querySelector("#f_date").value),
      product: (view.querySelector("#f_product").value||"").trim(),
      amount: (view.querySelector("#f_amount").value||"").trim(),
      unit: view.querySelector("#f_unit").value,
      note: (view.querySelector("#f_note").value||"").trim(),
      createdBy: user.id,
      createdAt: now()
    };
    await db.transaction(async (draft) => { draft.fertilizerLog = draft.fertilizerLog || []; draft.fertilizerLog.push(entry); });
    location.hash = "#/plante/journal";
  };

  view.querySelector("#addP").onclick = async () => {
    const user = state.activeUser;
    const entry = {
      id: "pp_" + crypto.randomUUID(),
      fieldId: view.querySelector("#p_field").value,
      date: parseDTLocal(view.querySelector("#p_date").value),
      product: (view.querySelector("#p_product").value||"").trim(),
      dose: (view.querySelector("#p_dose").value||"").trim(),
      unit: view.querySelector("#p_unit").value,
      note: (view.querySelector("#p_note").value||"").trim(),
      createdBy: user.id,
      createdAt: now()
    };
    await db.transaction(async (draft) => { draft.plantProtectionLog = draft.plantProtectionLog || []; draft.plantProtectionLog.push(entry); });
    location.hash = "#/plante/journal";
  };

  const exportTable = (title, rowsHtml) => {
    openPrintWindow({
      title,
      subtitle: (dbState.meta?.farmName || "Min gård") + " • " + (dbState.meta?.geo?.municipalityName || "Kommune ikke valgt"),
      html: rowsHtml
    });
  };

  view.querySelector("#exportF").onclick = () => {
    const rows = fert.map(x=>`
      <tr>
        <td>${esc(fmtDT(x.date))}</td>
        <td>${esc(fieldName(dbState,x.fieldId))}</td>
        <td>${esc(x.product||"")}</td>
        <td>${esc((x.amount||"") + " " + (x.unit||""))}</td>
        <td>${esc(x.note||"")}</td>
      </tr>`).join("");
    exportTable("Gjødseljournal", `
      <table><thead><tr><th>Dato</th><th>Skifte</th><th>Produkt</th><th>Mengde</th><th>Notat</th></tr></thead>
      <tbody>${rows || "<tr><td colspan='5'>Ingen data</td></tr>"}</tbody></table>
    `);
  };

  view.querySelector("#exportP").onclick = () => {
    const rows = pp.map(x=>`
      <tr>
        <td>${esc(fmtDT(x.date))}</td>
        <td>${esc(fieldName(dbState,x.fieldId))}</td>
        <td>${esc(x.product||"")}</td>
        <td>${esc((x.dose||"") + " " + (x.unit||""))}</td>
        <td>${esc(x.note||"")}</td>
      </tr>`).join("");
    exportTable("Sprøytejournal (Plantevernjournal)", `
      <table><thead><tr><th>Dato</th><th>Skifte</th><th>Middel</th><th>Dosering</th><th>Notat</th></tr></thead>
      <tbody>${rows || "<tr><td colspan='5'>Ingen data</td></tr>"}</tbody></table>
    `);
  };
}
