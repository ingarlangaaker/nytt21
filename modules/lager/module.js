// modules/lager/module.js — lagerstyring (enkelt): varer + beholdning + bevegelser
import { openPrintWindow } from "../../core/utils/print.js";
import { isoFromDateInput, fmtDate, fmtDT } from "../../core/utils/date.js";

function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
const CATS = ["Fôr","Gjødsel","Plantevern","Reservedeler","Emballasje","Annet"];

export async function renderLager(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");
  const user = state.activeUser;

  const items = (dbState.inventory||[]).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"", "nb"));

  const totalCount = items.length;

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Lager</div>
        <h2 style="margin:8px 0 0 0">Varer og beholdning</h2>
        <div class="muted">Hold oversikt over fôr, gjødsel, plantevern, deler og emballasje. Alle endringer logges.</div>
        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
          <span class="badge">Varer: ${totalCount}</span>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Ny vare</h3>
          <div class="grid">
            <div class="field"><label>Navn</label><input id="i_name" placeholder="f.eks. Kraftfôr, Kalksalpeter, Roundup, Flaskekartong…"/></div>
            <div class="grid two">
              <div class="field"><label>Kategori</label><select id="i_cat">${CATS.map(c=>`<option value="${c}">${c}</option>`).join("")}</select></div>
              <div class="field"><label>Enhet</label><input id="i_unit" placeholder="kg, liter, stk, sekk…"/></div>
            </div>
            <div class="grid two">
              <div class="field"><label>Startbeholdning</label><input id="i_qty" type="number" step="0.01" /></div>
              <div class="field"><label>Min-nivå (valgfritt)</label><input id="i_min" type="number" step="0.01" /></div>
            </div>
            <div class="field"><label>Notat</label><input id="i_note" placeholder="batch, leverandør, pris, sikkerhet…"/></div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="add">Legg til</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Eksport</h3>
          <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
            <button class="btn" id="print">Lagerliste (PDF)</button>
          </div>
          <div class="muted" style="margin-top:8px">Tips: min-nivå gir ⚠️ i listen.</div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Vare</th><th>Kategori</th><th>Beholdning</th><th>Min</th><th></th></tr></thead>
          <tbody>
            ${items.map(it=>{
              const warn = (it.minLevel!=="" && it.minLevel!=null && Number(it.qty||0) <= Number(it.minLevel||0)) ? "⚠️" : "";
              return `<tr>
                <td><strong>${esc(it.name)}</strong><div class="muted">${esc(it.note||"")}</div></td>
                <td><span class="badge">${esc(it.category||"")}</span></td>
                <td>${warn} ${esc(String(it.qty||0))} ${esc(it.unit||"")}</td>
                <td>${esc(it.minLevel??"")}</td>
                <td style="text-align:right">
                  <button class="btn" data-open="${it.id}">Åpne</button>
                  <button class="btn danger" data-del="${it.id}">Slett</button>
                </td>
              </tr>`;
            }).join("") || `<tr><td colspan="5" class="muted">Ingen varer enda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  view.querySelector("#add").onclick = async ()=>{
    const name=(view.querySelector("#i_name").value||"").trim();
    if(!name) return alert("Mangler navn.");
    const category=view.querySelector("#i_cat").value;
    const unit=(view.querySelector("#i_unit").value||"").trim();
    const qty = Number(view.querySelector("#i_qty").value||0) || 0;
    const minLevel = view.querySelector("#i_min").value==="" ? "" : (Number(view.querySelector("#i_min").value)||0);
    const note=(view.querySelector("#i_note").value||"").trim();
    const id="inv_"+crypto.randomUUID();
    await db.transaction(async (d)=>{
      d.inventory=d.inventory||[];
      d.inventory.push({
        id, name, category, unit, qty, minLevel, note,
        movements: qty? [{id:"mv_"+crypto.randomUUID(), date:new Date().toISOString(), delta: qty, reason:"Start", by:user.id}] : [],
        createdAt:new Date().toISOString(), createdBy:user.id
      });
    });
    location.hash="#/lager";
  };

  view.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
    const id=b.getAttribute("data-del");
    if(!confirm("Slette vare?")) return;
    await db.transaction(async (d)=>{
      d.inventory=(d.inventory||[]).filter(x=>x.id!==id);
    });
    location.hash="#/lager";
  });

  const openItem = async (id)=>{
    const s=await db.get("db");
    const it=(s.inventory||[]).find(x=>x.id===id);
    if(!it) return;
    const moves=(it.movements||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    ui.viewEl.innerHTML = `
      <div class="grid">
        <div class="card">
          <div class="badge">Vare</div>
          <h2 style="margin:8px 0 0 0">${esc(it.name)}</h2>
          <div class="muted">${esc(it.category||"")} • Enhet: ${esc(it.unit||"")}</div>
        </div>

        <div class="grid two">
          <div class="card">
            <h3 style="margin-top:0">Status</h3>
            <div class="grid two">
              <div class="field"><label>Beholdning</label><input id="qty" type="number" step="0.01" value="${esc(String(it.qty||0))}"/></div>
              <div class="field"><label>Min-nivå</label><input id="min" type="number" step="0.01" value="${esc(it.minLevel===""?"":String(it.minLevel))}"/></div>
            </div>
            <div class="field"><label>Notat</label><input id="note" value="${esc(it.note||"")}"/></div>
            <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
              <button class="btn" id="save">Lagre</button>
              <button class="btn" id="back">Tilbake</button>
            </div>
          </div>

          <div class="card">
            <h3 style="margin-top:0">Bevegelse</h3>
            <div class="grid">
              <div class="grid two">
                <div class="field"><label>Dato</label><input id="d" type="date"/></div>
                <div class="field"><label>Delta (+/-)</label><input id="delta" type="number" step="0.01" placeholder="f.eks -2"/></div>
              </div>
              <div class="field"><label>Årsak</label><input id="reason" placeholder="forbruk, kjøp, svinn, flytting…"/></div>
            </div>
            <div class="row" style="justify-content:flex-end;margin-top:10px">
              <button class="btn primary" id="addMv">Legg til</button>
            </div>
          </div>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Dato</th><th>Delta</th><th>Årsak</th><th>Av</th><th></th></tr></thead>
            <tbody>
              ${moves.map(m=>`
                <tr>
                  <td>${esc(fmtDT(m.date))}</td>
                  <td>${esc(String(m.delta))}</td>
                  <td>${esc(m.reason||"")}</td>
                  <td>${esc(m.by||"")}</td>
                  <td style="text-align:right"><button class="btn danger" data-delMv="${m.id}">Slett</button></td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="muted">Ingen bevegelser.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="row" style="justify-content:flex-end;gap:10px">
            <button class="btn" id="printItem">Skriv ut (PDF)</button>
          </div>
        </div>
      </div>
    `;

    ui.viewEl.querySelector("#back").onclick=()=>location.hash="#/lager";
    ui.viewEl.querySelector("#save").onclick=async()=>{
      const qty = Number(ui.viewEl.querySelector("#qty").value||0) || 0;
      const min = ui.viewEl.querySelector("#min").value==="" ? "" : (Number(ui.viewEl.querySelector("#min").value)||0);
      const note = (ui.viewEl.querySelector("#note").value||"").trim();
      await db.transaction(async (d)=>{
        const item=(d.inventory||[]).find(x=>x.id===id); if(!item) return;
        item.qty = qty;
        item.minLevel = min;
        item.note = note;
      });
      openItem(id);
    };

    ui.viewEl.querySelector("#addMv").onclick=async()=>{
      const date = isoFromDateInput(ui.viewEl.querySelector("#d").value) || new Date().toISOString();
      const deltaStr = ui.viewEl.querySelector("#delta").value;
      if(deltaStr==="") return alert("Mangler delta.");
      const delta = Number(deltaStr);
      const reason=(ui.viewEl.querySelector("#reason").value||"").trim() || "Bevegelse";
      const mvId="mv_"+crypto.randomUUID();
      await db.transaction(async (d)=>{
        const item=(d.inventory||[]).find(x=>x.id===id); if(!item) return;
        item.movements = item.movements || [];
        item.movements.push({ id: mvId, date, delta, reason, by: user.id });
        item.qty = Number(item.qty||0) + delta;
      });
      openItem(id);
    };

    ui.viewEl.querySelectorAll("button[data-delMv]").forEach(btn=>btn.onclick=async()=>{
      const mvId=btn.getAttribute("data-delMv");
      if(!confirm("Slette bevegelse?")) return;
      await db.transaction(async (d)=>{
        const item=(d.inventory||[]).find(x=>x.id===id); if(!item) return;
        const mv = (item.movements||[]).find(x=>x.id===mvId);
        if(mv) item.qty = Number(item.qty||0) - Number(mv.delta||0); // revert
        item.movements = (item.movements||[]).filter(x=>x.id!==mvId);
      });
      openItem(id);
    });

    ui.viewEl.querySelector("#printItem").onclick=async()=>{
      const s2=await db.get("db");
      const item=(s2.inventory||[]).find(x=>x.id===id);
      const mv2=(item.movements||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      const rows=mv2.map(m=>`<tr><td>${esc(fmtDT(m.date))}</td><td>${esc(String(m.delta))}</td><td>${esc(m.reason||"")}</td><td>${esc(m.by||"")}</td></tr>`).join("");
      openPrintWindow({
        title:"Lagerrapport",
        subtitle:`${esc(item.name)} • ${esc(item.category||"")} • Beholdning: ${esc(String(item.qty||0))} ${esc(item.unit||"")}`,
        html:`<div class="muted">Min: ${esc(item.minLevel===""?"—":String(item.minLevel))} • Notat: ${esc(item.note||"")}</div>
        <table><thead><tr><th>Dato</th><th>Delta</th><th>Årsak</th><th>Av</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Ingen</td></tr>"}</tbody></table>`
      });
    };
  };

  view.querySelectorAll("button[data-open]").forEach(b=>b.onclick=()=>openItem(b.getAttribute("data-open")));

  view.querySelector("#print").onclick=()=>{
    const rows=items.map(it=>{
      const warn = (it.minLevel!=="" && it.minLevel!=null && Number(it.qty||0) <= Number(it.minLevel||0)) ? "⚠️" : "";
      return `<tr><td>${esc(it.name)}</td><td>${esc(it.category||"")}</td><td>${warn} ${esc(String(it.qty||0))} ${esc(it.unit||"")}</td><td>${esc(it.minLevel===""?"":String(it.minLevel))}</td><td>${esc(it.note||"")}</td></tr>`;
    }).join("");
    openPrintWindow({
      title:"Lagerliste",
      subtitle:(dbState.meta?.farmName||"Min gård"),
      html:`<table><thead><tr><th>Navn</th><th>Kategori</th><th>Beholdning</th><th>Min</th><th>Notat</th></tr></thead><tbody>${rows||"<tr><td colspan='5'>Ingen</td></tr>"}</tbody></table>`
    });
  };
}
