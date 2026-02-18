// modules/maskiner/module.js — maskiner + vedlikehold + serviceintervaller (MVP men nyttig)
import { openPrintWindow } from "../../core/utils/print.js";
import { isoFromDateInput, fmtDate, fmtDT } from "../../core/utils/date.js";

function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

const TYPES = ["Traktor","Redskap","Bil/ATV","Verktøy","Annet"];

export async function renderMaskiner(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");
  const user = state.activeUser;

  const machines = Object.values(dbState.machines||{}).filter(m=>!m.deletedAt)
    .sort((a,b)=>(a.name||"").localeCompare(b.name||"", "nb"));

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Maskiner</div>
        <h2 style="margin:8px 0 0 0">Service og vedlikehold</h2>
        <div class="muted">Logg service, bytter, timer og neste frist. Praktisk for avløser og dokumentasjon.</div>
        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
          <span class="badge">Antall: ${machines.length}</span>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Ny maskin</h3>
          <div class="grid">
            <div class="field"><label>Navn</label><input id="m_name" placeholder="MF 135, CityCat 2020, Berlingo…"/></div>
            <div class="grid two">
              <div class="field"><label>Type</label><select id="m_type">${TYPES.map(t=>`<option value="${t}">${t}</option>`).join("")}</select></div>
              <div class="field"><label>Serienr / regnr (valgfritt)</label><input id="m_id" placeholder="valgfritt"/></div>
            </div>
            <div class="grid two">
              <div class="field"><label>Timer nå (valgfritt)</label><input id="m_hours" type="number" min="0" step="0.1" /></div>
              <div class="field"><label>Serviceintervall timer (valgfritt)</label><input id="m_int" type="number" min="0" step="1" placeholder="f.eks 250"/></div>
            </div>
            <div class="field"><label>Notat</label><input id="m_note" placeholder="f.eks olje 15W-40, filtertype…"/></div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="add">Legg til</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Eksport</h3>
          <div class="muted">Skriv ut maskinliste og servicelogger.</div>
          <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
            <button class="btn" id="printList">Maskinliste (PDF)</button>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Maskin</th><th>Type</th><th>Timer</th><th>Neste service</th><th></th></tr></thead>
          <tbody>
            ${machines.map(m=>{
              const next = m.serviceIntervalHours && m.hours
                ? (Number(m.lastServiceHours||0) + Number(m.serviceIntervalHours||0))
                : "";
              const due = (next!=="" && Number(m.hours||0) >= Number(next)) ? "⚠️" : "";
              return `<tr>
                <td><strong>${esc(m.name||"")}</strong><div class="muted">${esc(m.ident||"")}</div></td>
                <td><span class="badge">${esc(m.type||"")}</span></td>
                <td>${esc(m.hours??"")}</td>
                <td>${due} ${next!=="" ? esc(String(next))+" t" : "<span class='muted'>—</span>"}</td>
                <td style="text-align:right">
                  <button class="btn" data-open="${m.id}">Åpne</button>
                  <button class="btn danger" data-del="${m.id}">Slett</button>
                </td>
              </tr>`;
            }).join("") || `<tr><td colspan="5" class="muted">Ingen maskiner enda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  view.querySelector("#add").onclick = async () => {
    const name = (view.querySelector("#m_name").value||"").trim();
    if(!name) return alert("Mangler navn.");
    const type = view.querySelector("#m_type").value;
    const ident = (view.querySelector("#m_id").value||"").trim();
    const hours = Number(view.querySelector("#m_hours").value||0) || 0;
    const serviceIntervalHours = Number(view.querySelector("#m_int").value||0) || 0;
    const note = (view.querySelector("#m_note").value||"").trim();
    const id = "mach_" + crypto.randomUUID();

    await db.transaction(async (draft)=>{
      draft.machines = draft.machines || {};
      draft.machines[id] = {
        id, name, type, ident, hours,
        serviceIntervalHours: serviceIntervalHours||0,
        lastServiceAt: "",
        lastServiceHours: hours||0,
        logs: [],
        note,
        createdAt: new Date().toISOString(),
        createdBy: user.id
      };
    });
    location.hash="#/maskiner";
  };

  view.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
    const id=b.getAttribute("data-del");
    if(!confirm("Slette maskin?")) return;
    await db.transaction(async (draft)=>{
      if(draft.machines?.[id]) draft.machines[id].deletedAt = new Date().toISOString();
    });
    location.hash="#/maskiner";
  });

  const openMachine = async (id) => {
    const s = await db.get("db");
    const m = s.machines?.[id];
    if(!m) return;
    const logs = (m.logs||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    ui.viewEl.innerHTML = `
      <div class="grid">
        <div class="card">
          <div class="badge">Maskin</div>
          <h2 style="margin:8px 0 0 0">${esc(m.name)}</h2>
          <div class="muted">${esc(m.type||"")} • ${esc(m.ident||"")}</div>
        </div>

        <div class="grid two">
          <div class="card">
            <h3 style="margin-top:0">Status</h3>
            <div class="grid two">
              <div class="field"><label>Timer nå</label><input id="hours" type="number" min="0" step="0.1" value="${esc(m.hours)}"/></div>
              <div class="field"><label>Serviceintervall (timer)</label><input id="int" type="number" min="0" step="1" value="${esc(m.serviceIntervalHours||0)}"/></div>
            </div>
            <div class="muted">Sist service: ${m.lastServiceAt?esc(fmtDT(m.lastServiceAt)):"—"} (t: ${esc(m.lastServiceHours||0)})</div>
            <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
              <button class="btn" id="save">Lagre</button>
              <button class="btn" id="back">Tilbake</button>
            </div>
          </div>

          <div class="card">
            <h3 style="margin-top:0">Ny logg</h3>
            <div class="grid">
              <div class="grid two">
                <div class="field"><label>Dato</label><input id="l_date" type="date"/></div>
                <div class="field"><label>Timer (valgfritt)</label><input id="l_hours" type="number" min="0" step="0.1" placeholder="f.eks 1234.5"/></div>
              </div>
              <div class="field"><label>Hva ble gjort?</label><input id="l_action" placeholder="oljeskift, filter, smøring, reparasjon…"/></div>
              <div class="field"><label>Deler/kost (valgfritt)</label><input id="l_parts" placeholder="filter, olje, kr…"/></div>
            </div>
            <div class="row" style="justify-content:flex-end;margin-top:10px">
              <button class="btn primary" id="addLog">Legg til logg</button>
            </div>
          </div>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Dato</th><th>T</th><th>Handling</th><th>Deler/kost</th><th></th></tr></thead>
            <tbody>
              ${logs.map(l=>`
                <tr>
                  <td>${esc(l.date?fmtDate(l.date):"")}</td>
                  <td>${esc(l.hours??"")}</td>
                  <td><strong>${esc(l.action||"")}</strong></td>
                  <td class="muted">${esc(l.parts||"")}</td>
                  <td style="text-align:right"><button class="btn danger" data-delLog="${l.id}">Slett</button></td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="muted">Ingen logger.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="row" style="justify-content:flex-end;gap:10px">
            <button class="btn" id="print">Skriv ut (PDF)</button>
          </div>
        </div>
      </div>
    `;

    ui.viewEl.querySelector("#back").onclick = ()=> location.hash="#/maskiner";
    ui.viewEl.querySelector("#save").onclick = async ()=>{
      const hours = Number(ui.viewEl.querySelector("#hours").value||0) || 0;
      const interval = Number(ui.viewEl.querySelector("#int").value||0) || 0;
      await db.transaction(async (d)=>{
        const mm=d.machines?.[id]; if(!mm) return;
        mm.hours = hours;
        mm.serviceIntervalHours = interval;
      });
      openMachine(id);
    };

    ui.viewEl.querySelector("#addLog").onclick = async ()=>{
      const date = isoFromDateInput(ui.viewEl.querySelector("#l_date").value);
      const hours = ui.viewEl.querySelector("#l_hours").value ? Number(ui.viewEl.querySelector("#l_hours").value) : "";
      const action = (ui.viewEl.querySelector("#l_action").value||"").trim();
      if(!action) return alert("Mangler handling.");
      const parts = (ui.viewEl.querySelector("#l_parts").value||"").trim();
      const logId = "ml_" + crypto.randomUUID();
      await db.transaction(async (d)=>{
        const mm=d.machines?.[id]; if(!mm) return;
        mm.logs = mm.logs || [];
        mm.logs.push({ id: logId, date, hours, action, parts, createdAt: new Date().toISOString(), createdBy: user.id });
        // If looks like a service, update lastService
        mm.lastServiceAt = date || new Date().toISOString();
        mm.lastServiceHours = (hours!=="" ? hours : mm.hours);
      });
      openMachine(id);
    };

    ui.viewEl.querySelectorAll("button[data-delLog]").forEach(btn=>btn.onclick=async()=>{
      const logId = btn.getAttribute("data-delLog");
      await db.transaction(async (d)=>{
        const mm=d.machines?.[id]; if(!mm) return;
        mm.logs = (mm.logs||[]).filter(x=>x.id!==logId);
      });
      openMachine(id);
    });

    ui.viewEl.querySelector("#print").onclick = async ()=>{
      const s2 = await db.get("db");
      const mm = s2.machines?.[id];
      const logs2 = (mm.logs||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      const rows = logs2.map(l=>`<tr><td>${esc(l.date?fmtDate(l.date):"")}</td><td>${esc(l.hours??"")}</td><td>${esc(l.action||"")}</td><td>${esc(l.parts||"")}</td></tr>`).join("");
      openPrintWindow({
        title: "Maskinlogg",
        subtitle: `${esc(mm.name)} • ${esc(mm.type||"")} • ${esc(mm.ident||"")}`,
        html: `<div class="muted">Timer nå: ${esc(mm.hours)} • Intervall: ${esc(mm.serviceIntervalHours||0)} • Sist service: ${esc(mm.lastServiceAt?fmtDT(mm.lastServiceAt):"—")}</div>
        <table><thead><tr><th>Dato</th><th>T</th><th>Handling</th><th>Deler/kost</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Ingen</td></tr>"}</tbody></table>`
      });
    };
  };

  view.querySelectorAll("button[data-open]").forEach(b=>b.onclick=()=>openMachine(b.getAttribute("data-open")));

  view.querySelector("#printList").onclick = ()=>{
    const rows = machines.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.type||"")}</td><td>${esc(m.ident||"")}</td><td>${esc(m.hours??"")}</td><td>${esc(m.serviceIntervalHours||0)}</td></tr>`).join("");
    openPrintWindow({
      title: "Maskinliste",
      subtitle: (dbState.meta?.farmName||"Min gård"),
      html: `<table><thead><tr><th>Navn</th><th>Type</th><th>ID</th><th>Timer</th><th>Intervall</th></tr></thead><tbody>${rows||"<tr><td colspan='5'>Ingen</td></tr>"}</tbody></table>`
    });
  };
}
