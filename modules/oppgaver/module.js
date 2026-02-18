// modules/oppgaver/module.js — To-do / oppgaver for bondens hverdag
import { openPrintWindow } from "../../core/utils/print.js";

const nowIso = () => new Date().toISOString();
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDate(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleDateString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit"}); }
function fmtDT(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function toIsoFromDate(v){ if(!v) return ""; return new Date(v+"T12:00:00").toISOString(); }

const CATS = ["Dyr","Skifte","Maskin","Økonomi","Dokument","Annet"];

export async function renderOppgaver(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");
  const user = state.activeUser;

  const tasks = (dbState.tasks||[]).slice().sort((a,b)=>{
    const ad = a.doneAt?1:0, bd=b.doneAt?1:0;
    if(ad!==bd) return ad-bd;
    return (a.dueAt||"").localeCompare(b.dueAt||"") || (b.createdAt||"").localeCompare(a.createdAt||"");
  });

  const open = tasks.filter(t=>!t.doneAt);
  const done = tasks.filter(t=>t.doneAt);

  const filter = (dbState.meta?.tasksFilter) || { mine:false, showDone:true, cat:"Alle" };
  const visible = tasks.filter(t=>{
    if(!filter.showDone && t.doneAt) return false;
    if(filter.mine && t.assignedTo && t.assignedTo!==user.id) return false;
    if(filter.cat!=="Alle" && (t.category||"Annet")!==filter.cat) return false;
    return true;
  });

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Oppgaver</div>
        <h2 style="margin:8px 0 0 0">Hverdagsliste</h2>
        <div class="muted">Oppgaver kan knyttes til dyr, skifter eller jobber (valgfritt).</div>
        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
          <span class="badge">Åpne: ${open.length}</span>
          <span class="badge">Fullført: ${done.length}</span>
          <span class="badge">Bruker: ${esc(user.name)}</span>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Ny oppgave</h3>
          <div class="grid">
            <div class="field">
              <label>Tittel</label>
              <input id="t_title" placeholder="f.eks. Sjekk vann, bestill gjødsel, service traktoren…" />
            </div>
            <div class="grid two">
              <div class="field">
                <label>Kategori</label>
                <select id="t_cat">${CATS.map(c=>`<option value="${c}">${c}</option>`).join("")}</select>
              </div>
              <div class="field">
                <label>Frist (valgfritt)</label>
                <input id="t_due" type="date" />
              </div>
            </div>

            <div class="grid two">
              <div class="field">
                <label>Tildel (valgfritt)</label>
                <select id="t_assignee">
                  <option value="">Ingen</option>
                  ${(dbState.users||[]).map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label>Knytning (valgfritt)</label>
                <select id="t_linkType">
                  <option value="">Ingen</option>
                  <option value="animal">Dyr</option>
                  <option value="field">Skifte</option>
                  <option value="work">Jobb</option>
                </select>
              </div>
            </div>

            <div class="field" id="linkPicker" style="display:none">
              <label>Velg</label>
              <select id="t_linkId"></select>
            </div>

            <div class="field">
              <label>Notat</label>
              <input id="t_note" placeholder="kort notat (valgfritt)" />
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="add">Legg til</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Filter</h3>
          <div class="grid">
            <label class="badge" style="cursor:pointer"><input type="checkbox" id="f_mine" ${filter.mine?"checked":""}/> Bare mine</label>
            <label class="badge" style="cursor:pointer"><input type="checkbox" id="f_done" ${filter.showDone?"checked":""}/> Vis fullførte</label>
            <div class="field">
              <label>Kategori</label>
              <select id="f_cat">
                <option value="Alle">Alle</option>
                ${CATS.map(c=>`<option value="${c}" ${filter.cat===c?"selected":""}>${c}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
            <button class="btn" id="export">Eksporter (PDF)</button>
          </div>
          <div class="muted" style="margin-top:8px">Eksport bruker utskrift → “Lagre som PDF”.</div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Status</th><th>Tittel</th><th>Kategori</th><th>Frist</th><th>Tildelt</th><th></th></tr></thead>
          <tbody>
            ${visible.map(t=>{
              const status = t.doneAt ? "✅" : (t.dueAt && new Date(t.dueAt) < new Date() ? "⚠️" : "🟩");
              const ass = t.assignedTo ? ((dbState.users||[]).find(u=>u.id===t.assignedTo)?.name || t.assignedTo) : "";
              const due = t.dueAt ? fmtDate(t.dueAt) : "";
              return `<tr>
                <td>${status}</td>
                <td>
                  <strong>${esc(t.title)}</strong>
                  ${t.note?`<div class="muted">${esc(t.note)}</div>`:""}
                  ${t.linkType && t.linkId ? `<div class="muted">Knyttet: ${esc(t.linkType)} / ${esc(t.linkId)}</div>`:""}
                  <div class="muted">Opprettet: ${fmtDT(t.createdAt)} av ${esc(t.createdBy||"")}</div>
                </td>
                <td><span class="badge">${esc(t.category||"Annet")}</span></td>
                <td>${esc(due)}</td>
                <td>${esc(ass)}</td>
                <td style="text-align:right">
                  ${t.doneAt ? `<button class="btn" data-undone="${t.id}">Angre</button>` : `<button class="btn primary" data-done="${t.id}">Fullfør</button>`}
                  <button class="btn danger" data-del="${t.id}">Slett</button>
                </td>
              </tr>`;
            }).join("") || `<tr><td colspan="6" class="muted">Ingen oppgaver enda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Link picker
  const linkTypeEl = view.querySelector("#t_linkType");
  const linkPicker = view.querySelector("#linkPicker");
  const linkIdEl = view.querySelector("#t_linkId");

  const rebuild = async (type) => {
    const s = await db.get("db");
    let items = [];
    if(type==="field") items = Object.values(s.fields||{}).filter(f=>!f.deletedAt).map(f=>({id:f.id,label:(f.name||f.id)}));
    if(type==="animal") items = Object.values(s.animals||{}).filter(a=>!a.deletedAt).slice(0,200).map(a=>({id:a.id,label:(a.externalId||a.earTag||a.id)}));
    if(type==="work") items = (s.workLogs||[]).map(w=>({id:w.id,label:(w.customer||w.id)}));
    linkIdEl.innerHTML = items.map(x=>`<option value="${x.id}">${esc(x.label)}</option>`).join("");
  };

  linkTypeEl.addEventListener("change", async (e)=>{
    const type = e.target.value;
    if(!type){ linkPicker.style.display="none"; linkIdEl.innerHTML=""; return; }
    linkPicker.style.display="";
    await rebuild(type);
  });

  const saveFilter = async () => {
    await db.transaction(async (draft)=>{
      draft.meta = draft.meta || {};
      draft.meta.tasksFilter = {
        mine: view.querySelector("#f_mine").checked,
        showDone: view.querySelector("#f_done").checked,
        cat: view.querySelector("#f_cat").value
      };
    });
    location.hash="#/oppgaver";
  };
  view.querySelector("#f_mine").onchange = saveFilter;
  view.querySelector("#f_done").onchange = saveFilter;
  view.querySelector("#f_cat").onchange = saveFilter;

  view.querySelector("#add").onclick = async () => {
    const title = (view.querySelector("#t_title").value||"").trim();
    if(!title) return alert("Mangler tittel.");
    const category = view.querySelector("#t_cat").value;
    const dueAt = toIsoFromDate(view.querySelector("#t_due").value);
    const assignedTo = view.querySelector("#t_assignee").value||"";
    const note = (view.querySelector("#t_note").value||"").trim();
    const linkType = view.querySelector("#t_linkType").value||"";
    const linkId = linkType ? (view.querySelector("#t_linkId").value||"") : "";
    const id = "t_"+crypto.randomUUID();
    await db.transaction(async (draft)=>{
      draft.tasks = draft.tasks || [];
      draft.tasks.push({ id, title, category, dueAt: dueAt||"", assignedTo, note, linkType, linkId,
        createdAt: nowIso(), createdBy: user.id, doneAt:"", doneBy:"" });
    });
    location.hash="#/oppgaver";
  };

  view.querySelectorAll("button[data-done]").forEach(b=>b.onclick=async()=>{
    const id=b.getAttribute("data-done");
    await db.transaction(async (draft)=>{
      const t=(draft.tasks||[]).find(x=>x.id===id); if(!t) return;
      t.doneAt=nowIso(); t.doneBy=user.id;
    });
    location.hash="#/oppgaver";
  });
  view.querySelectorAll("button[data-undone]").forEach(b=>b.onclick=async()=>{
    const id=b.getAttribute("data-undone");
    await db.transaction(async (draft)=>{
      const t=(draft.tasks||[]).find(x=>x.id===id); if(!t) return;
      t.doneAt=""; t.doneBy="";
    });
    location.hash="#/oppgaver";
  });
  view.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
    const id=b.getAttribute("data-del");
    if(!confirm("Slette oppgave?")) return;
    await db.transaction(async (draft)=>{ draft.tasks=(draft.tasks||[]).filter(x=>x.id!==id); });
    location.hash="#/oppgaver";
  });

  view.querySelector("#export").onclick = () => {
    const rows = visible.map(t=>`
      <tr>
        <td>${t.doneAt?"Fullført":"Åpen"}</td>
        <td>${esc(t.title)}</td>
        <td>${esc(t.category||"")}</td>
        <td>${esc(t.dueAt?fmtDate(t.dueAt):"")}</td>
        <td>${esc(t.assignedTo ? ((dbState.users||[]).find(u=>u.id===t.assignedTo)?.name||t.assignedTo) : "")}</td>
        <td>${esc(t.note||"")}</td>
      </tr>`).join("");
    openPrintWindow({
      title: "Oppgaveliste",
      subtitle: (dbState.meta?.farmName||"Min gård")+" • "+(dbState.meta?.geo?.municipalityName||""),
      html: `<table><thead><tr><th>Status</th><th>Tittel</th><th>Kategori</th><th>Frist</th><th>Tildelt</th><th>Notat</th></tr></thead><tbody>${rows||"<tr><td colspan='6'>Ingen data</td></tr>"}</tbody></table>`
    });
  };
}
