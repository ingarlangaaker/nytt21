// modules/jobb/module.js — start/stop job clock (leiekjøring/arbeid)
import { makeEvent } from "../../core/events.js";

const now = () => new Date().toISOString();
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDT(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function durMs(a,b){ return Math.max(0,(new Date(b).getTime())-(new Date(a).getTime())); }
function fmtDur(ms){ const m=Math.round(ms/60000); const h=Math.floor(m/60); const mm=m%60; return h?`${h}t ${mm}m`:`${mm}m`; }

export async function renderJobb(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");

  const logs = (dbState.workLogs || []).slice().sort((a,b)=>(b.startAt||"").localeCompare(a.startAt||""));
  const active = logs.find(l => !l.endAt);

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Jobbklokke</div>
        <h2 style="margin:8px 0 0 0">Start / stopp</h2>
        <div class="muted">For arbeid hos kunde, leiekjøring, osv.</div>
        <div class="grid" style="margin-top:12px">
          <div class="field">
            <label>Kunde / oppdrag</label>
            <input id="customer" placeholder="f.eks. Naboen, kommune, kunde X" value="${esc(active?.customer||"")}" ${active?'disabled':''} />
          </div>
          <div class="field">
            <label>Notat</label>
            <input id="note" placeholder="Kort notat…" value="${esc(active?.note||"")}" ${active?'disabled':''} />
          </div>
          <div class="row" style="justify-content:flex-end">
            ${active ? `<button class="btn danger" id="stop">Stopp</button>` : `<button class="btn primary" id="start">Start</button>`}
          </div>
          <div class="muted">${active ? `Pågår siden ${fmtDT(active.startAt)}` : "Ingen aktiv jobb nå."}</div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Start</th><th>Slutt</th><th>Kunde</th><th>Varighet</th><th>Notat</th></tr></thead>
          <tbody>
            ${logs.map(l => {
              const end = l.endAt || now();
              const ms = durMs(l.startAt, end);
              return `<tr>
                <td>${fmtDT(l.startAt)}</td>
                <td>${l.endAt ? fmtDT(l.endAt) : '<span class="badge">Pågår</span>'}</td>
                <td><strong>${esc(l.customer||"")}</strong></td>
                <td>${fmtDur(ms)}</td>
                <td class="muted">${esc(l.note||"")}</td>
              </tr>`;
            }).join("") || `<tr><td colspan="5" class="muted">Ingen jobber logget ennå.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (!active) {
    view.querySelector("#start").onclick = async () => {
      const customer = (view.querySelector("#customer").value || "").trim();
      const note = (view.querySelector("#note").value || "").trim();
      if (!customer) return alert("Mangler kunde/oppdrag.");
      const user = state.activeUser;
      const id = "wl_" + crypto.randomUUID();
      await db.transaction(async (draft) => {
        draft.workLogs = draft.workLogs || [];
        draft.workLogs.push({ id, customer, note, startAt: now(), endAt: null, createdBy: user.id });
        draft.events.push(makeEvent({ productionType:"core", entityType:"work", entityId:id, eventType:"jobb_start", date: now(), payload:{customer}, notes: note, userId:user.id }));
      });
      location.hash = "#/jobb";
    };
  } else {
    view.querySelector("#stop").onclick = async () => {
      const user = state.activeUser;
      await db.transaction(async (draft) => {
        const cur = (draft.workLogs||[]).find(x => x.id === active.id);
        if (!cur || cur.endAt) return;
        cur.endAt = now();
        draft.events.push(makeEvent({ productionType:"core", entityType:"work", entityId:active.id, eventType:"jobb_stopp", date: now(), payload:{customer:cur.customer}, notes: cur.note||"", userId:user.id }));
      });
      location.hash = "#/jobb";
    };
  }
}
