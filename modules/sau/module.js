// modules/sau/module.js — Sau (utvidet) for Drengen
// Fokus: bondens hverdag, oversikt + individ med raske registreringer.
// Alt lagres offline i db.animals (grunn) + db.sheepDetails (sau-spesifikt) + db.events (logg).

import { makeEvent } from "../../core/events.js";
import { openPrintWindow } from "../../core/utils/print.js";
import { fmtDT } from "../../core/utils/date.js";

const now = () => new Date().toISOString();
const id = (p="x") => p + "_" + crypto.randomUUID();

function esc(s){ return String(s??"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escA(s){ return esc(s).replace(/"/g,"&quot;"); }

const SEX = [
  {v:"female", t:"Hunn"},
  {v:"male", t:"Hann"},
  {v:"unknown", t:"Ukjent"}
];
const STATUS = [
  {v:"alive", t:"I live"},
  {v:"sold", t:"Solgt"},
  {v:"slaughtered", t:"Slaktet"},
  {v:"dead", t:"Død"}
];
const CAT = [
  {v:"ewe", t:"Søye"},
  {v:"ram", t:"Vær"},
  {v:"lamb", t:"Lam"},
  {v:"unknown", t:"Ukjent"}
];
const EVENT_TYPES = [
  {v:"merking", t:"Merking"},
  {v:"parring", t:"Parring"},
  {v:"lamming", t:"Lamming"},
  {v:"flytting", t:"Flytting"},
  {v:"behandling", t:"Behandling"},
  {v:"veiing", t:"Veiing"},
  {v:"klauv", t:"Klauv"},
  {v:"klipping", t:"Klipping"},
  {v:"vaksine", t:"Vaksine"},
  {v:"ormekur", t:"Ormekur"},
  {v:"annet", t:"Annet"}
];

function sexLabel(v){ return (SEX.find(x=>x.v===v)||{}).t || v; }
function statusLabel(v){ return (STATUS.find(x=>x.v===v)||{}).t || v; }
function catLabel(v){ return (CAT.find(x=>x.v===v)||{}).t || v; }

function parseDateInput(v){
  if(!v) return "";
  // input type=date => YYYY-MM-DD, store as same string
  return String(v);
}
function dateToISODate(dstr){
  if(!dstr) return "";
  // YYYY-MM-DD -> ISO at noon (avoid TZ issues)
  return new Date(dstr+"T12:00:00").toISOString();
}
function isoToDateInput(iso){
  if(!iso) return "";
  // if already YYYY-MM-DD
  if(/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function sortByUpdatedDesc(list){
  return list.sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
}

function getSheepDetail(dbState, animalId){
  const det = Object.values(dbState.sheepDetails||{}).find(x=>x.animalId===animalId && !x.deletedAt);
  return det || null;
}
function ensureSheepDetail(draft, animalId, userId){
  draft.sheepDetails = draft.sheepDetails || {};
  const det = Object.values(draft.sheepDetails).find(x=>x.animalId===animalId && !x.deletedAt);
  if(det) return det;
  const dId = id("sheep");
  draft.sheepDetails[dId] = {
    id: dId,
    animalId,
    category: "unknown", // ewe/ram/lamb
    breed: "NKS",
    color: "",
    motherId: "",
    fatherId: "",
    flockGroupId: "",
    pastureId: "",
    notes: "",
    tags: [],
    weights: [],        // {id,date,kg,method,notes}
    treatments: [],     // {id,date,type,product,dose,withdrawal,notes}
    mating: [],         // {id,start,end,ramId,method,notes}
    lambing: [],        // {id,date,ramId,born,alive,dead,assist,notes,lambIds:[]}
    createdAt: now(),
    updatedAt: now(),
    createdBy: userId,
    updatedBy: userId,
    deletedAt: null
  };
  return draft.sheepDetails[dId];
}

function statCounts(animals){
  const res = { total: animals.length, alive:0, sold:0, dead:0, slaughtered:0, ewes:0, rams:0, lambs:0 };
  for(const a of animals){
    if(a.status==="alive") res.alive++;
    if(a.status==="sold") res.sold++;
    if(a.status==="dead") res.dead++;
    if(a.status==="slaughtered") res.slaughtered++;
  }
  return res;
}

function makeAnimalDisplayId(a){
  return a.earTag || a.externalId || a.id;
}

function makeBadge(text){
  return `<span class="badge">${esc(text)}</span>`;
}

export async function renderSauList(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");

  const animalsAll = Object.values(dbState.animals||{}).filter(a => !a.deletedAt && a.productionType==="sau");
  sortByUpdatedDesc(animalsAll);

  // Build lookup for quick category/status display
  const detByAnimal = {};
  for(const d of Object.values(dbState.sheepDetails||{})){
    if(d && !d.deletedAt) detByAnimal[d.animalId]=d;
  }

  const counts = statCounts(animalsAll);

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <div class="badge">Sau</div>
            <h2 style="margin:8px 0 0 0">Oversikt</h2>
            <div class="muted">Liste, søk, filtrer og åpne individ. Rask registrering i individvisning.</div>
          </div>
          <div class="row" style="gap:10px;flex-wrap:wrap;justify-content:flex-end">
            <span class="badge">Totalt: ${counts.total}</span>
            <span class="badge">I live: ${counts.alive}</span>
            <span class="badge">Lam: ${animalsAll.filter(a=>detByAnimal[a.id]?.category==="lamb").length}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="grid two">
          <div class="field">
            <label>Søk (øremark / ID)</label>
            <input id="q" placeholder="Søk…" />
          </div>
          <div class="field">
            <label>Status</label>
            <select id="fStatus">
              <option value="">Alle</option>
              ${STATUS.map(s=>`<option value="${s.v}">${esc(s.t)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Kategori</label>
            <select id="fCat">
              <option value="">Alle</option>
              ${CAT.map(c=>`<option value="${c.v}">${esc(c.t)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Kjønn</label>
            <select id="fSex">
              <option value="">Alle</option>
              ${SEX.map(s=>`<option value="${s.v}">${esc(s.t)}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>

      <div class="card" id="listCard" style="padding:0">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Kategori</th>
              <th>Kjønn</th>
              <th>Status</th>
              <th>Sist endret</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Legg til sau</h3>
        <div class="grid two">
          <div class="field">
            <label>Øremerke (anbefalt)</label>
            <input id="earTag" placeholder="f.eks. NO12345 / 2026-001" />
          </div>
          <div class="field">
            <label>Kategori</label>
            <select id="cat">
              ${CAT.map(c=>`<option value="${c.v}">${esc(c.t)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Kjønn</label>
            <select id="sex">
              ${SEX.map(s=>`<option value="${s.v}">${esc(s.t)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Status</label>
            <select id="status">
              ${STATUS.map(s=>`<option value="${s.v}" ${s.v==="alive"?"selected":""}>${esc(s.t)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Fødselsdato (valgfritt)</label>
            <input id="birthDate" type="date" />
          </div>
          <div class="field">
            <label>Rase</label>
            <input id="breed" value="NKS" />
          </div>
        </div>
        <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
          <button class="btn" id="printList">Skriv ut (PDF)</button>
          <button class="btn primary" id="add">Legg til</button>
        </div>
        <div class="muted" id="msg" style="margin-top:8px"></div>
      </div>
    </div>
  `;

  const rowsEl = view.querySelector("#rows");

  const renderRows = (list) => {
    rowsEl.innerHTML = list.map(a => {
      const det = detByAnimal[a.id] || {};
      const cat = det.category || "unknown";
      return `
        <tr>
          <td><strong>${esc(makeAnimalDisplayId(a))}</strong><div class="muted">${esc(a.id)}</div></td>
          <td>${makeBadge(catLabel(cat))}</td>
          <td class="muted">${esc(sexLabel(a.sex))}</td>
          <td>${makeBadge(statusLabel(a.status))}</td>
          <td class="muted">${esc(fmtDT(a.updatedAt))}</td>
          <td style="text-align:right"><button class="btn" data-open="${a.id}">Åpne</button></td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="6" class="muted">Ingen sau ennå.</td></tr>`;

    rowsEl.querySelectorAll("button[data-open]").forEach(btn => {
      btn.onclick = () => location.hash = "#/sau/animal/" + btn.getAttribute("data-open");
    });
  };

  const applyFilter = () => {
    const q = (view.querySelector("#q").value || "").trim().toLowerCase();
    const fStatus = view.querySelector("#fStatus").value;
    const fCat = view.querySelector("#fCat").value;
    const fSex = view.querySelector("#fSex").value;

    const filtered = animalsAll.filter(a => {
      const det = detByAnimal[a.id] || {};
      const okQ = !q || String(makeAnimalDisplayId(a)).toLowerCase().includes(q) || String(a.id).toLowerCase().includes(q);
      const okS = !fStatus || a.status===fStatus;
      const okX = !fSex || a.sex===fSex;
      const okC = !fCat || (det.category||"unknown")===fCat;
      return okQ && okS && okX && okC;
    });
    renderRows(filtered);
  };

  view.querySelector("#q").addEventListener("input", applyFilter);
  view.querySelector("#fStatus").addEventListener("change", applyFilter);
  view.querySelector("#fCat").addEventListener("change", applyFilter);
  view.querySelector("#fSex").addEventListener("change", applyFilter);
  renderRows(animalsAll);

  const setMsg = (t, err=false) => {
    const el = view.querySelector("#msg");
    el.textContent = t || "";
    el.style.color = err ? "var(--danger)" : "var(--muted)";
  };

  view.querySelector("#add").onclick = async () => {
    const user = state.activeUser;

    const earTag = (view.querySelector("#earTag").value || "").trim();
    const sex = view.querySelector("#sex").value;
    const status = view.querySelector("#status").value;
    const birthDate = view.querySelector("#birthDate").value || "";
    const category = view.querySelector("#cat").value;
    const breed = (view.querySelector("#breed").value || "NKS").trim() || "NKS";

    const aId = id("animal");

    await db.transaction(async (draft) => {
      draft.animals = draft.animals || {};
      draft.sheepDetails = draft.sheepDetails || {};
      draft.events = draft.events || [];

      draft.animals[aId] = {
        id: aId,
        productionType: "sau",
        externalId: earTag || aId,
        earTag,
        sex,
        birthDate,
        status,
        groupId: null,
        pastureId: null,
        active: true,
        createdAt: now(),
        updatedAt: now(),
        createdBy: user.id,
        updatedBy: user.id,
        deletedAt: null
      };

      const det = ensureSheepDetail(draft, aId, user.id);
      det.category = category;
      det.breed = breed;
      det.updatedAt = now();
      det.updatedBy = user.id;

      draft.events.push(makeEvent({
        productionType: "sau",
        entityType: "animal",
        entityId: aId,
        eventType: "opprettet",
        date: now(),
        payload: { earTag, sex, status, birthDate, category, breed },
        notes: "",
        userId: user.id
      }));
    });

    setMsg("Sau lagt til.");
    location.hash = "#/sau/animal/" + aId;
  };

  view.querySelector("#printList").onclick = () => {
    const rows = animalsAll.map(a=>{
      const det = detByAnimal[a.id] || {};
      return `<tr>
        <td>${esc(makeAnimalDisplayId(a))}</td>
        <td>${esc(catLabel(det.category||"unknown"))}</td>
        <td>${esc(sexLabel(a.sex))}</td>
        <td>${esc(statusLabel(a.status))}</td>
        <td>${esc(a.birthDate||"")}</td>
      </tr>`;
    }).join("");
    openPrintWindow({
      title: "Saueoversikt",
      subtitle: (dbState.meta?.farmName||"Min gård"),
      html: `<table><thead><tr><th>ID</th><th>Kategori</th><th>Kjønn</th><th>Status</th><th>Født</th></tr></thead><tbody>${rows||"<tr><td colspan='5'>Ingen</td></tr>"}</tbody></table>`
    });
  };
}

export async function renderSauAnimal(ctx, animalId){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;

  const dbState = await db.get("db");
  const a = dbState.animals?.[animalId];
  if (!a || a.deletedAt) {
    view.innerHTML = `<div class="muted">Fant ikke dyret (kan være slettet).</div>`;
    return;
  }
  const detail = getSheepDetail(dbState, animalId);
  const det = detail || { category:"unknown", breed:"NKS", notes:"", tags:[], weights:[], treatments:[], mating:[], lambing:[] };

  const usersById = Object.fromEntries((dbState.users||[]).map(u => [u.id, u]));

  const events = (dbState.events||[]).filter(ev => !ev.deletedAt && ev.entityType==="animal" && ev.entityId===animalId);
  events.sort((x,y)=>(y.date||"").localeCompare(x.date||""));

  // helpers for lists
  const weights = (det.weights||[]).slice().sort((x,y)=>(y.date||"").localeCompare(x.date||""));
  const treatments = (det.treatments||[]).slice().sort((x,y)=>(y.date||"").localeCompare(x.date||""));
  const mating = (det.mating||[]).slice().sort((x,y)=>(y.start||"").localeCompare(x.start||""));
  const lambing = (det.lambing||[]).slice().sort((x,y)=>(y.date||"").localeCompare(x.date||""));

  const topId = makeAnimalDisplayId(a);
  const subtitle = `${catLabel(det.category||"unknown")} • ${sexLabel(a.sex)} • ${statusLabel(a.status)}`;

  const tab = (location.hash.split("?tab=")[1] || "").split("&")[0] || "oversikt";

  const tabs = [
    {k:"oversikt", t:"Oversikt"},
    {k:"helse", t:"Helse"},
    {k:"repro", t:"Repro"},
    {k:"vekt", t:"Vekt"},
    {k:"logg", t:"Logg"}
  ];

  const tabNav = `
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
      ${tabs.map(x=>`<button class="btn ${tab===x.k?"primary":""}" data-tab="${x.k}">${esc(x.t)}</button>`).join("")}
    </div>
  `;

  const quickActions = `
    <div class="row" style="gap:10px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn" id="qaWeight">+ Vekt</button>
      <button class="btn" id="qaTreat">+ Behandling</button>
      <button class="btn" id="qaMove">+ Flytting</button>
      <button class="btn danger" id="qaStatus">Endre status</button>
    </div>
  `;

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="min-width:240px">
            <div class="badge">Sau • ${esc(a.id)}</div>
            <h2 style="margin:8px 0 0 0">${esc(topId)}</h2>
            <div class="muted">${esc(subtitle)}</div>
            ${tabNav}
          </div>
          <div style="min-width:240px">
            <div class="row" style="justify-content:flex-end;gap:10px;flex-wrap:wrap">
              <button class="btn" id="back">Til liste</button>
              <button class="btn" id="print">Skriv ut (PDF)</button>
              <button class="btn danger" id="trash">Til papirkurv</button>
            </div>
            <div style="margin-top:10px">${quickActions}</div>
          </div>
        </div>
      </div>

      <div id="tabContent"></div>
    </div>
  `;

  // tab renderers
  const tabEl = view.querySelector("#tabContent");

  const renderOversikt = () => {
    tabEl.innerHTML = `
      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Grunninfo</h3>
          <div class="grid two">
            <div class="field"><label>Øremerke</label><input id="earTag" value="${escA(a.earTag||"")}" /></div>
            <div class="field"><label>Rase</label><input id="breed" value="${escA(det.breed||"NKS")}" /></div>
            <div class="field"><label>Kategori</label>
              <select id="category">${CAT.map(c=>`<option value="${c.v}" ${det.category===c.v?"selected":""}>${esc(c.t)}</option>`).join("")}</select>
            </div>
            <div class="field"><label>Kjønn</label>
              <select id="sex">${SEX.map(s=>`<option value="${s.v}" ${a.sex===s.v?"selected":""}>${esc(s.t)}</option>`).join("")}</select>
            </div>
            <div class="field"><label>Status</label>
              <select id="status">${STATUS.map(s=>`<option value="${s.v}" ${a.status===s.v?"selected":""}>${esc(s.t)}</option>`).join("")}</select>
            </div>
            <div class="field"><label>Født</label><input id="birthDate" type="date" value="${escA(isoToDateInput(a.birthDate||""))}" /></div>
            <div class="field"><label>Mor (dyre-ID)</label><input id="motherId" value="${escA(det.motherId||"")}" placeholder="valgfritt" /></div>
            <div class="field"><label>Far (dyre-ID)</label><input id="fatherId" value="${escA(det.fatherId||"")}" placeholder="valgfritt" /></div>
          </div>
          <div class="field"><label>Notat</label><input id="notes" value="${escA(det.notes||"")}" placeholder="Kort notat…" /></div>
          <div class="row" style="justify-content:flex-end;margin-top:10px;gap:10px">
            <button class="btn primary" id="save">Lagre</button>
          </div>
          <div class="muted" id="saveMsg" style="margin-top:8px"></div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Siste registreringer</h3>
          <div class="grid">
            <div class="row" style="justify-content:space-between"><div class="muted">Siste vekt</div><div><strong>${weights[0]?esc(weights[0].kg+" kg"):"—"}</strong></div></div>
            <div class="row" style="justify-content:space-between"><div class="muted">Siste behandling</div><div><strong>${treatments[0]?esc((treatments[0].type||"")+(treatments[0].product?(" • "+treatments[0].product):"")):"—"}</strong></div></div>
            <div class="row" style="justify-content:space-between"><div class="muted">Siste parring</div><div><strong>${mating[0]?esc(isoToDateInput(mating[0].start||"")):"—"}</strong></div></div>
            <div class="row" style="justify-content:space-between"><div class="muted">Siste lamming</div><div><strong>${lambing[0]?esc(isoToDateInput(lambing[0].date||"")):"—"}</strong></div></div>
          </div>
        </div>
      </div>
    `;

    const setSaveMsg = (t, err=false) => {
      const el = view.querySelector("#saveMsg");
      el.textContent = t || "";
      el.style.color = err ? "var(--danger)" : "var(--muted)";
    };

    view.querySelector("#save").onclick = async () => {
      const user = state.activeUser;
      const earTag = (view.querySelector("#earTag").value || "").trim();
      const sex = view.querySelector("#sex").value;
      const status = view.querySelector("#status").value;
      const birthDate = view.querySelector("#birthDate").value || "";
      const category = view.querySelector("#category").value;
      const breed = (view.querySelector("#breed").value || "NKS").trim() || "NKS";
      const notes = (view.querySelector("#notes").value || "").trim();
      const motherId = (view.querySelector("#motherId").value || "").trim();
      const fatherId = (view.querySelector("#fatherId").value || "").trim();

      await db.transaction(async (draft) => {
        const cur = draft.animals?.[animalId]; if(!cur) return;
        cur.earTag = earTag;
        cur.externalId = earTag || cur.externalId || cur.id;
        cur.sex = sex;
        cur.status = status;
        cur.birthDate = birthDate;
        cur.updatedAt = now();
        cur.updatedBy = user.id;

        const d = ensureSheepDetail(draft, animalId, user.id);
        d.category = category;
        d.breed = breed;
        d.notes = notes;
        d.motherId = motherId;
        d.fatherId = fatherId;
        d.updatedAt = now();
        d.updatedBy = user.id;

        draft.events = draft.events || [];
        draft.events.push(makeEvent({
          productionType: "sau",
          entityType: "animal",
          entityId: animalId,
          eventType: "endret",
          date: now(),
          payload: { earTag, sex, status, birthDate, category, breed, motherId, fatherId },
          notes: "",
          userId: user.id
        }));
      });

      setSaveMsg("Lagret.");
      location.hash = "#/sau/animal/" + animalId + "?tab=oversikt";
    };
  };

  const renderVekt = () => {
    tabEl.innerHTML = `
      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Ny veiing</h3>
          <div class="grid two">
            <div class="field"><label>Dato</label><input id="w_date" type="date" /></div>
            <div class="field"><label>Vekt (kg)</label><input id="w_kg" type="number" step="0.1" /></div>
            <div class="field"><label>Metode</label><input id="w_method" placeholder="vekt, estimat…" /></div>
            <div class="field"><label>Notat</label><input id="w_note" placeholder="valgfritt" /></div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="w_add">Legg til</button>
          </div>
          <div class="muted" id="w_msg" style="margin-top:8px"></div>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Dato</th><th>Kg</th><th>Metode</th><th>Notat</th><th></th></tr></thead>
            <tbody id="w_rows"></tbody>
          </table>
        </div>
      </div>
    `;

    const rowsEl = view.querySelector("#w_rows");
    const render = () => {
      rowsEl.innerHTML = weights.map(w=>`
        <tr>
          <td>${esc(w.date?isoToDateInput(w.date):"")}</td>
          <td><strong>${esc(w.kg)}</strong></td>
          <td class="muted">${esc(w.method||"")}</td>
          <td class="muted">${esc(w.notes||"")}</td>
          <td style="text-align:right"><button class="btn danger" data-del="${w.id}">Slett</button></td>
        </tr>
      `).join("") || `<tr><td colspan="5" class="muted">Ingen veiinger.</td></tr>`;

      rowsEl.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
        if(!confirm("Slette veiing?")) return;
        const wid=b.getAttribute("data-del");
        await db.transaction(async (draft)=>{
          const d = ensureSheepDetail(draft, animalId, state.activeUser.id);
          d.weights = (d.weights||[]).filter(x=>x.id!==wid);
          d.updatedAt = now(); d.updatedBy = state.activeUser.id;
        });
        location.hash = "#/sau/animal/" + animalId + "?tab=vekt";
      });
    };
    render();

    const setMsg=(t,err=false)=>{
      const el=view.querySelector("#w_msg"); el.textContent=t||""; el.style.color=err?"var(--danger)":"var(--muted)";
    };

    view.querySelector("#w_add").onclick = async ()=>{
      const date = parseDateInput(view.querySelector("#w_date").value) || isoToDateInput(now());
      const kgStr = view.querySelector("#w_kg").value;
      if(!kgStr) return setMsg("Mangler kg.", true);
      const kg = Number(kgStr);
      const method = (view.querySelector("#w_method").value||"").trim();
      const notes = (view.querySelector("#w_note").value||"").trim();
      const user = state.activeUser;

      await db.transaction(async (draft)=>{
        const d = ensureSheepDetail(draft, animalId, user.id);
        d.weights = d.weights || [];
        d.weights.push({ id:id("w"), date, kg, method, notes, createdAt: now(), createdBy:user.id });
        d.updatedAt = now(); d.updatedBy = user.id;

        draft.events = draft.events || [];
        draft.events.push(makeEvent({
          productionType:"sau", entityType:"animal", entityId: animalId,
          eventType:"veiing", date: now(),
          payload:{ kg, method, date }, notes, userId:user.id
        }));
      });

      setMsg("Veiing lagret.");
      location.hash = "#/sau/animal/" + animalId + "?tab=vekt";
    };
  };

  const renderHelse = () => {
    tabEl.innerHTML = `
      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Ny behandling</h3>
          <div class="grid">
            <div class="grid two">
              <div class="field"><label>Dato</label><input id="t_date" type="date" /></div>
              <div class="field"><label>Type</label>
                <select id="t_type">
                  ${EVENT_TYPES.filter(x=>["behandling","klauv","klipping","vaksine","ormekur","annet"].includes(x.v)).map(x=>`<option value="${x.v}">${esc(x.t)}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="grid two">
              <div class="field"><label>Produkt (valgfritt)</label><input id="t_prod" placeholder="f.eks. Ivomec…" /></div>
              <div class="field"><label>Dose (valgfritt)</label><input id="t_dose" placeholder="ml, mg/kg…" /></div>
            </div>
            <div class="grid two">
              <div class="field"><label>Tilbakehold (slakt) (valgfritt)</label><input id="t_with" placeholder="dager / dato" /></div>
              <div class="field"><label>Notat</label><input id="t_note" placeholder="valgfritt" /></div>
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="t_add">Legg til</button>
          </div>
          <div class="muted" id="t_msg" style="margin-top:8px"></div>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Dato</th><th>Type</th><th>Produkt</th><th>Dose</th><th>Notat</th><th></th></tr></thead>
            <tbody id="t_rows"></tbody>
          </table>
        </div>
      </div>
    `;

    const rowsEl = view.querySelector("#t_rows");
    const render = () => {
      rowsEl.innerHTML = treatments.map(t=>`
        <tr>
          <td>${esc(t.date?isoToDateInput(t.date):"")}</td>
          <td>${makeBadge(t.type||"")}</td>
          <td>${esc(t.product||"")}</td>
          <td class="muted">${esc(t.dose||"")}</td>
          <td class="muted">${esc(t.notes||"")}</td>
          <td style="text-align:right"><button class="btn danger" data-del="${t.id}">Slett</button></td>
        </tr>
      `).join("") || `<tr><td colspan="6" class="muted">Ingen behandlinger.</td></tr>`;

      rowsEl.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
        if(!confirm("Slette behandling?")) return;
        const tid=b.getAttribute("data-del");
        await db.transaction(async (draft)=>{
          const d = ensureSheepDetail(draft, animalId, state.activeUser.id);
          d.treatments = (d.treatments||[]).filter(x=>x.id!==tid);
          d.updatedAt = now(); d.updatedBy = state.activeUser.id;
        });
        location.hash = "#/sau/animal/" + animalId + "?tab=helse";
      });
    };
    render();

    const setMsg=(t,err=false)=>{
      const el=view.querySelector("#t_msg"); el.textContent=t||""; el.style.color=err?"var(--danger)":"var(--muted)";
    };

    view.querySelector("#t_add").onclick = async ()=>{
      const date = parseDateInput(view.querySelector("#t_date").value) || isoToDateInput(now());
      const type = view.querySelector("#t_type").value;
      const product = (view.querySelector("#t_prod").value||"").trim();
      const dose = (view.querySelector("#t_dose").value||"").trim();
      const withdrawal = (view.querySelector("#t_with").value||"").trim();
      const notes = (view.querySelector("#t_note").value||"").trim();
      const user = state.activeUser;

      await db.transaction(async (draft)=>{
        const d = ensureSheepDetail(draft, animalId, user.id);
        d.treatments = d.treatments || [];
        d.treatments.push({ id:id("t"), date, type, product, dose, withdrawal, notes, createdAt: now(), createdBy:user.id });
        d.updatedAt = now(); d.updatedBy = user.id;

        draft.events = draft.events || [];
        draft.events.push(makeEvent({
          productionType:"sau", entityType:"animal", entityId: animalId,
          eventType: type, date: now(),
          payload:{ type, product, dose, withdrawal, date }, notes, userId:user.id
        }));
      });

      setMsg("Behandling lagret.");
      location.hash = "#/sau/animal/" + animalId + "?tab=helse";
    };
  };

  const renderRepro = () => {
    tabEl.innerHTML = `
      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Parring</h3>
          <div class="grid two">
            <div class="field"><label>Start</label><input id="m_start" type="date" /></div>
            <div class="field"><label>Slutt (valgfritt)</label><input id="m_end" type="date" /></div>
            <div class="field"><label>Vær-ID (valgfritt)</label><input id="m_ram" placeholder="dyre-ID / øremerke" /></div>
            <div class="field"><label>Metode</label><input id="m_method" placeholder="naturlig, AI…" /></div>
          </div>
          <div class="field"><label>Notat</label><input id="m_note" placeholder="valgfritt" /></div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="m_add">Legg til parring</button>
          </div>
          <div class="muted" id="m_msg" style="margin-top:8px"></div>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Start</th><th>Slutt</th><th>Vær</th><th>Metode</th><th>Notat</th><th></th></tr></thead>
            <tbody id="m_rows"></tbody>
          </table>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Lamming</h3>
          <div class="grid two">
            <div class="field"><label>Dato</label><input id="l_date" type="date" /></div>
            <div class="field"><label>Vær-ID (valgfritt)</label><input id="l_ram" placeholder="dyre-ID / øremerke" /></div>
            <div class="field"><label>Født</label><input id="l_born" type="number" min="0" step="1" /></div>
            <div class="field"><label>Levende</label><input id="l_alive" type="number" min="0" step="1" /></div>
            <div class="field"><label>Døde</label><input id="l_dead" type="number" min="0" step="1" /></div>
            <div class="field"><label>Hjelp</label><input id="l_assist" placeholder="ja/nei/kommentar" /></div>
          </div>
          <div class="field"><label>Notat</label><input id="l_note" placeholder="valgfritt" /></div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="l_add">Legg til lamming</button>
          </div>
          <div class="muted" id="l_msg" style="margin-top:8px"></div>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Dato</th><th>Vær</th><th>Født</th><th>Lev</th><th>Død</th><th>Notat</th><th></th></tr></thead>
            <tbody id="l_rows"></tbody>
          </table>
        </div>
      </div>
    `;

    // Parring table
    const mRows = view.querySelector("#m_rows");
    const renderM = () => {
      mRows.innerHTML = mating.map(m=>`
        <tr>
          <td>${esc(m.start?isoToDateInput(m.start):"")}</td>
          <td class="muted">${esc(m.end?isoToDateInput(m.end):"")}</td>
          <td>${esc(m.ramId||"")}</td>
          <td class="muted">${esc(m.method||"")}</td>
          <td class="muted">${esc(m.notes||"")}</td>
          <td style="text-align:right"><button class="btn danger" data-del="${m.id}">Slett</button></td>
        </tr>
      `).join("") || `<tr><td colspan="6" class="muted">Ingen parringer.</td></tr>`;

      mRows.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
        if(!confirm("Slette parring?")) return;
        const mid=b.getAttribute("data-del");
        await db.transaction(async (draft)=>{
          const d = ensureSheepDetail(draft, animalId, state.activeUser.id);
          d.mating = (d.mating||[]).filter(x=>x.id!==mid);
          d.updatedAt=now(); d.updatedBy=state.activeUser.id;
        });
        location.hash = "#/sau/animal/" + animalId + "?tab=repro";
      });
    };
    renderM();

    const setMMsg=(t,err=false)=>{
      const el=view.querySelector("#m_msg"); el.textContent=t||""; el.style.color=err?"var(--danger)":"var(--muted)";
    };

    view.querySelector("#m_add").onclick = async ()=>{
      const start = parseDateInput(view.querySelector("#m_start").value);
      if(!start) return setMMsg("Mangler startdato.", true);
      const end = parseDateInput(view.querySelector("#m_end").value) || "";
      const ramId = (view.querySelector("#m_ram").value||"").trim();
      const method = (view.querySelector("#m_method").value||"").trim();
      const notes = (view.querySelector("#m_note").value||"").trim();
      const user = state.activeUser;

      await db.transaction(async (draft)=>{
        const d=ensureSheepDetail(draft, animalId, user.id);
        d.mating=d.mating||[];
        d.mating.push({ id:id("m"), start, end, ramId, method, notes, createdAt:now(), createdBy:user.id });
        d.updatedAt=now(); d.updatedBy=user.id;

        draft.events = draft.events || [];
        draft.events.push(makeEvent({
          productionType:"sau", entityType:"animal", entityId: animalId,
          eventType:"parring", date: now(),
          payload:{ start, end, ramId, method }, notes, userId:user.id
        }));
      });

      setMMsg("Parring lagret.");
      location.hash = "#/sau/animal/" + animalId + "?tab=repro";
    };

    // Lamming table
    const lRows = view.querySelector("#l_rows");
    const renderL = () => {
      lRows.innerHTML = lambing.map(l=>`
        <tr>
          <td>${esc(l.date?isoToDateInput(l.date):"")}</td>
          <td class="muted">${esc(l.ramId||"")}</td>
          <td>${esc(l.born??"")}</td>
          <td>${esc(l.alive??"")}</td>
          <td>${esc(l.dead??"")}</td>
          <td class="muted">${esc(l.notes||"")}</td>
          <td style="text-align:right"><button class="btn danger" data-del="${l.id}">Slett</button></td>
        </tr>
      `).join("") || `<tr><td colspan="7" class="muted">Ingen lamminger.</td></tr>`;

      lRows.querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{
        if(!confirm("Slette lamming?")) return;
        const lid=b.getAttribute("data-del");
        await db.transaction(async (draft)=>{
          const d=ensureSheepDetail(draft, animalId, state.activeUser.id);
          d.lambing = (d.lambing||[]).filter(x=>x.id!==lid);
          d.updatedAt=now(); d.updatedBy=state.activeUser.id;
        });
        location.hash = "#/sau/animal/" + animalId + "?tab=repro";
      });
    };
    renderL();

    const setLMsg=(t,err=false)=>{
      const el=view.querySelector("#l_msg"); el.textContent=t||""; el.style.color=err?"var(--danger)":"var(--muted)";
    };

    view.querySelector("#l_add").onclick = async ()=>{
      const date = parseDateInput(view.querySelector("#l_date").value);
      if(!date) return setLMsg("Mangler dato.", true);
      const ramId = (view.querySelector("#l_ram").value||"").trim();
      const born = Number(view.querySelector("#l_born").value||0);
      const alive = Number(view.querySelector("#l_alive").value||0);
      const dead = Number(view.querySelector("#l_dead").value||0);
      const assist = (view.querySelector("#l_assist").value||"").trim();
      const notes = (view.querySelector("#l_note").value||"").trim();
      const user = state.activeUser;

      await db.transaction(async (draft)=>{
        const d=ensureSheepDetail(draft, animalId, user.id);
        d.lambing=d.lambing||[];
        d.lambing.push({ id:id("l"), date, ramId, born, alive, dead, assist, notes, createdAt:now(), createdBy:user.id, lambIds:[] });
        d.updatedAt=now(); d.updatedBy=user.id;

        draft.events = draft.events || [];
        draft.events.push(makeEvent({
          productionType:"sau", entityType:"animal", entityId: animalId,
          eventType:"lamming", date: now(),
          payload:{ date, ramId, born, alive, dead, assist }, notes, userId:user.id
        }));
      });

      setLMsg("Lamming lagret.");
      location.hash = "#/sau/animal/" + animalId + "?tab=repro";
    };
  };

  const renderLogg = () => {
    tabEl.innerHTML = `
      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Dato</th><th>Type</th><th>Notat</th><th>Av</th></tr></thead>
          <tbody id="e_rows"></tbody>
        </table>
      </div>
    `;
    const eRows = view.querySelector("#e_rows");
    eRows.innerHTML = events.map(ev=>`
      <tr>
        <td>${esc(fmtDT(ev.date))}</td>
        <td>${makeBadge(ev.eventType||"")}</td>
        <td class="muted">${esc(ev.notes||"")}</td>
        <td class="muted">${esc(usersById[ev.userId||ev.updatedBy]?.name || ev.userId || ev.updatedBy || "")}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="muted">Ingen logg enda.</td></tr>`;
  };

  // wire tab buttons
  view.querySelectorAll("button[data-tab]").forEach(b=>{
    b.onclick = ()=>{
      const k=b.getAttribute("data-tab");
      location.hash = "#/sau/animal/" + animalId + "?tab=" + k;
    };
  });

  // header buttons
  view.querySelector("#back").onclick = ()=> location.hash = "#/sau";

  view.querySelector("#trash").onclick = async () => {
    const user = state.activeUser;
    if(!confirm("Flytte dyret til papirkurv?")) return;
    await db.transaction(async (draft) => {
      const cur = draft.animals?.[animalId];
      if (!cur) return;
      cur.deletedAt = now();
      cur.updatedAt = now();
      cur.updatedBy = user.id;
      draft.trash = draft.trash || { animals:[], events:[], fields:[] };
      draft.trash.animals = draft.trash.animals || [];
      draft.trash.animals.push({ id: animalId, deletedAt: cur.deletedAt });
      draft.events = draft.events || [];
      draft.events.push(makeEvent({
        productionType:"sau", entityType:"animal", entityId: animalId,
        eventType:"slettet", date: now(), payload:{}, notes:"", userId:user.id
      }));
    });
    location.hash = "#/sau";
  };

  view.querySelector("#print").onclick = () => {
    const w = weights[0] ? `${weights[0].kg} kg (${isoToDateInput(weights[0].date)})` : "—";
    const t = treatments[0] ? `${treatments[0].type}${treatments[0].product?(" • "+treatments[0].product):""} (${isoToDateInput(treatments[0].date)})` : "—";
    openPrintWindow({
      title: "Sau — individkort",
      subtitle: `${esc(topId)} • ${esc(subtitle)}`,
      html: `
        <div class="grid">
          <div><strong>Øremerke</strong>: ${esc(a.earTag||"")}</div>
          <div><strong>Rase</strong>: ${esc(det.breed||"")}</div>
          <div><strong>Født</strong>: ${esc(a.birthDate||"")}</div>
          <div><strong>Mor</strong>: ${esc(det.motherId||"")}</div>
          <div><strong>Far</strong>: ${esc(det.fatherId||"")}</div>
          <div><strong>Siste vekt</strong>: ${esc(w)}</div>
          <div><strong>Siste behandling</strong>: ${esc(t)}</div>
          <div><strong>Notat</strong>: ${esc(det.notes||"")}</div>
        </div>
      `
    });
  };

  // quick actions
  view.querySelector("#qaWeight").onclick = ()=> location.hash = "#/sau/animal/" + animalId + "?tab=vekt";
  view.querySelector("#qaTreat").onclick = ()=> location.hash = "#/sau/animal/" + animalId + "?tab=helse";
  view.querySelector("#qaMove").onclick = async ()=>{
    const note = prompt("Flytting (notat):", "");
    if(note===null) return;
    const user=state.activeUser;
    await db.transaction(async (draft)=>{
      draft.events = draft.events || [];
      draft.events.push(makeEvent({
        productionType:"sau", entityType:"animal", entityId: animalId,
        eventType:"flytting", date: now(), payload:{}, notes: note, userId:user.id
      }));
    });
    location.hash = "#/sau/animal/" + animalId + "?tab=logg";
  };
  view.querySelector("#qaStatus").onclick = async ()=>{
    const cur = a.status || "alive";
    const next = prompt("Ny status (alive/sold/slaughtered/dead):", cur);
    if(next===null) return;
    const user=state.activeUser;
    await db.transaction(async (draft)=>{
      const curA=draft.animals?.[animalId]; if(!curA) return;
      curA.status = next;
      curA.updatedAt=now(); curA.updatedBy=user.id;
      draft.events = draft.events || [];
      draft.events.push(makeEvent({
        productionType:"sau", entityType:"animal", entityId: animalId,
        eventType:"status", date: now(), payload:{ from:cur, to: next }, notes:"", userId:user.id
      }));
    });
    location.hash = "#/sau/animal/" + animalId + "?tab=oversikt";
  };

  // render selected tab
  if(tab==="helse") renderHelse();
  else if(tab==="repro") renderRepro();
  else if(tab==="vekt") renderVekt();
  else if(tab==="logg") renderLogg();
  else renderOversikt();
}
