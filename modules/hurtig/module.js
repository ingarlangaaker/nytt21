// modules/hurtig/module.js — 10-sekunders registrering for hverdagen (hurtiglogg)
import { fmtDT } from "../../core/utils/date.js";

function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

const CATS = [
  {k:"vann", label:"Vann sjekket", icon:"💧"},
  {k:"fôr", label:"Fôret", icon:"🌾"},
  {k:"helse", label:"Helse/tilsyn", icon:"🩺"},
  {k:"gjerdet", label:"Gjerde", icon:"🧱"},
  {k:"maskin", label:"Maskin", icon:"🛠️"},
  {k:"annet", label:"Annet", icon:"📝"}
];

export async function renderHurtig(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");
  const user = state.activeUser;

  const logs = (dbState.events||[]).slice().filter(e=>e.type==="quick")
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))
    .slice(0,120);

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Hurtig</div>
        <h2 style="margin:8px 0 0 0">10-sekunders registrering</h2>
        <div class="muted">Trykk en knapp, legg til kort notat om ønskelig. Lagrer i hendelser (events).</div>
      </div>

      <div class="card">
        <div class="row" style="gap:10px;flex-wrap:wrap">
          ${CATS.map(c=>`<button class="btn primary" data-cat="${c.k}">${c.icon} ${c.label}</button>`).join("")}
        </div>
        <div class="field" style="margin-top:10px">
          <label>Notat (valgfritt)</label>
          <input id="note" placeholder="f.eks. alt ok, byttet netting, lekkasje…"/>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Tid</th><th>Hva</th><th>Notat</th><th>Bruker</th></tr></thead>
          <tbody>
            ${logs.map(l=>`
              <tr>
                <td>${esc(fmtDT(l.createdAt))}</td>
                <td><span class="badge">${esc(l.key||"")}</span></td>
                <td class="muted">${esc(l.note||"")}</td>
                <td>${esc(l.by||"")}</td>
              </tr>
            `).join("") || `<tr><td colspan="4" class="muted">Ingen hurtig-logger.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const add = async (key)=>{
    const note = (view.querySelector("#note").value||"").trim();
    await db.transaction(async (d)=>{
      d.events = d.events || [];
      d.events.push({ id:"ev_"+crypto.randomUUID(), type:"quick", key, note, by:user.id, createdAt:new Date().toISOString() });
    });
    location.hash="#/hurtig";
  };

  view.querySelectorAll("button[data-cat]").forEach(b=>b.onclick=()=>add(b.getAttribute("data-cat")));
}
