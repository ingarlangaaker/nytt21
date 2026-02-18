// modules/rapport/module.js — samlet rapport/eksport (MVP)
import { openPrintWindow } from "../../core/utils/print.js";
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDT(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function fmtDate(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleDateString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit"}); }

export async function renderRapport(ctx){
  const { db, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Rapport</div>
        <h2 style="margin:8px 0 0 0">Eksport</h2>
        <div class="muted">Samleutskrift av nøkkeldata. Senere: proff PDF + KSL/Mattilsynet pakker.</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Hva vil du eksportere?</h3>
          <div class="grid">
            <label class="badge" style="cursor:pointer"><input type="checkbox" id="c_fields" checked/> Skifter</label>
            <label class="badge" style="cursor:pointer"><input type="checkbox" id="c_tasks" checked/> Oppgaver</label>
            <label class="badge" style="cursor:pointer"><input type="checkbox" id="c_notes" checked/> Notater</label>
            <label class="badge" style="cursor:pointer"><input type="checkbox" id="c_fert" checked/> Gjødsling</label>
            <label class="badge" style="cursor:pointer"><input type="checkbox" id="c_pp" checked/> Sprøyting</label>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Periode (valgfritt)</h3>
          <div class="grid two">
            <div class="field"><label>Fra</label><input id="from" type="date"/></div>
            <div class="field"><label>Til</label><input id="to" type="date"/></div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="go">Generer (PDF)</button>
          </div>
          <div class="muted" style="margin-top:8px">Eksport bruker utskrift → “Lagre som PDF”.</div>
        </div>
      </div>
    </div>
  `;

  const within=(iso,fromIso,toIso)=>{
    if(!iso) return true;
    const t=new Date(iso).getTime();
    if(fromIso && t<new Date(fromIso).getTime()) return false;
    if(toIso && t>new Date(toIso).getTime()) return false;
    return true;
  };

  view.querySelector("#go").onclick=()=>{
    const from = view.querySelector("#from").value ? new Date(view.querySelector("#from").value+"T00:00:00").toISOString() : "";
    const to = view.querySelector("#to").value ? new Date(view.querySelector("#to").value+"T23:59:59").toISOString() : "";
    const sections=[];

    if(view.querySelector("#c_fields").checked){
      const fields=Object.values(dbState.fields||{}).filter(f=>!f.deletedAt);
      const rows=fields.map(f=>{
        const a=f.areas||{};
        const sum=Number(a.fulldyrket||0)+Number(a.overflatedyrket||0)+Number(a.innmarksbeite||0);
        return `<tr><td>${esc(f.name||f.id)}</td><td>${esc(String(sum))}</td><td>${esc(String(a.fulldyrket||0))}</td><td>${esc(String(a.overflatedyrket||0))}</td><td>${esc(String(a.innmarksbeite||0))}</td></tr>`;
      }).join("");
      sections.push(`<h3>Skifter</h3><table><thead><tr><th>Navn</th><th>Sum daa</th><th>Fulld.</th><th>Overfl.</th><th>Innmarks</th></tr></thead><tbody>${rows||"<tr><td colspan='5'>Ingen</td></tr>"}</tbody></table>`);
    }

    if(view.querySelector("#c_tasks").checked){
      const tasks=(dbState.tasks||[]).filter(t=>within(t.createdAt,from,to));
      const rows=tasks.map(t=>`<tr><td>${t.doneAt?"Fullført":"Åpen"}</td><td>${esc(t.title)}</td><td>${esc(t.category||"")}</td><td>${esc(t.dueAt?fmtDate(t.dueAt):"")}</td></tr>`).join("");
      sections.push(`<h3>Oppgaver</h3><table><thead><tr><th>Status</th><th>Tittel</th><th>Kategori</th><th>Frist</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Ingen</td></tr>"}</tbody></table>`);
    }

    if(view.querySelector("#c_notes").checked){
      const notes=(dbState.notes||[]).filter(n=>within(n.createdAt,from,to)).slice(0,200);
      const rows=notes.map(n=>`<tr><td>${esc(n.date?fmtDate(n.date):fmtDT(n.createdAt))}</td><td>${esc(n.title||"")}</td><td>${esc((n.text||"").slice(0,250))}</td></tr>`).join("");
      sections.push(`<h3>Notater</h3><table><thead><tr><th>Dato</th><th>Tittel</th><th>Tekst</th></tr></thead><tbody>${rows||"<tr><td colspan='3'>Ingen</td></tr>"}</tbody></table>`);
    }

    if(view.querySelector("#c_fert").checked){
      const fert=(dbState.fertilizerLog||[]).filter(x=>within(x.date,from,to));
      const rows=fert.map(x=>`<tr><td>${esc(fmtDT(x.date))}</td><td>${esc(dbState.fields?.[x.fieldId]?.name||x.fieldId)}</td><td>${esc(x.product||"")}</td><td>${esc((x.amount||"")+" "+(x.unit||""))}</td></tr>`).join("");
      sections.push(`<h3>Gjødsling</h3><table><thead><tr><th>Dato</th><th>Skifte</th><th>Produkt</th><th>Mengde</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Ingen</td></tr>"}</tbody></table>`);
    }

    if(view.querySelector("#c_pp").checked){
      const pp=(dbState.plantProtectionLog||[]).filter(x=>within(x.date,from,to));
      const rows=pp.map(x=>`<tr><td>${esc(fmtDT(x.date))}</td><td>${esc(dbState.fields?.[x.fieldId]?.name||x.fieldId)}</td><td>${esc(x.product||"")}</td><td>${esc((x.dose||"")+" "+(x.unit||""))}</td></tr>`).join("");
      sections.push(`<h3>Sprøyting</h3><table><thead><tr><th>Dato</th><th>Skifte</th><th>Middel</th><th>Dosering</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Ingen</td></tr>"}</tbody></table>`);
    }

    openPrintWindow({
      title:"FarmApp Rapport",
      subtitle:(dbState.meta?.farmName||"Min gård")+" • "+(dbState.meta?.geo?.municipalityName||"")+(from||to?` • Periode: ${view.querySelector("#from").value||""} – ${view.querySelector("#to").value||""}`:""),
      html: sections.join("<div class='hr'></div>")
    });
  };
}
