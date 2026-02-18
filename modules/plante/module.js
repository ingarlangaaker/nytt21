// modules/plante/module.js — Skifter v1 (plante) with 3 area types per field
import { makeEvent } from "../../core/events.js";

const now = () => new Date().toISOString();
const id = (p="f") => p + "_" + crypto.randomUUID();

function toNum(v){
  const n = Number(String(v||"").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function fmt(n){ return (Math.round(n*10)/10).toLocaleString("no-NO"); }
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }
function sumAreas(a){ return toNum(a.fulldyrket)+toNum(a.overflatedyrket)+toNum(a.innmarksbeite); }
function fmtDT(iso){
  if(!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}

export async function renderSkifterList(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;

  const dbState = await db.get("db");
  const fields = Object.values(dbState.fields || {}).filter(f => !f.deletedAt);
  fields.sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));

  view.innerHTML = `
    <div class="grid">
      <div class="row">
        <div class="field" style="flex:1;min-width:220px">
          <label>Søk (skiftenavn)</label>
          <input id="q" placeholder="Søk…" />
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead>
            <tr>
              <th>Skifte</th>
              <th>Fulldyrket (daa)</th>
              <th>Overflatedyrket (daa)</th>
              <th>Innmarksbeite (daa)</th>
              <th>Sum (daa)</th>
              <th>Sist endret</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Legg til skifte</h3>
        <div class="grid two">
          <div class="field">
            <label>Navn</label>
            <input id="name" placeholder="f.eks. Skifte 1" />
          </div>
          <div class="field">
            <label>Fulldyrket (daa)</label>
            <input id="fulldyrket" inputmode="decimal" placeholder="0" />
          </div>
          <div class="field">
            <label>Overflatedyrket (daa)</label>
            <input id="overflatedyrket" inputmode="decimal" placeholder="0" />
          </div>
          <div class="field">
            <label>Innmarksbeite (daa)</label>
            <input id="innmarksbeite" inputmode="decimal" placeholder="0" />
          </div>
        </div>
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
          <div class="muted">Du kan bruke alle tre arealtypene på samme skifte. Sum regnes automatisk.</div>
          <button class="btn primary" id="add">Legg til</button>
        </div>
        <div class="muted" id="msg" style="margin-top:8px"></div>
      </div>
    </div>
  `;

  const rowsEl = view.querySelector("#rows");

  const renderRows = (list) => {
    rowsEl.innerHTML = list.map(f => {
      const s = sumAreas(f.areas||{});
      return `
        <tr style="cursor:pointer" data-id="${f.id}">
          <td><strong>${escapeHtml(f.name||f.id)}</strong></td>
          <td>${fmt(toNum(f.areas?.fulldyrket))}</td>
          <td>${fmt(toNum(f.areas?.overflatedyrket))}</td>
          <td>${fmt(toNum(f.areas?.innmarksbeite))}</td>
          <td><span class="badge">${fmt(s)}</span></td>
          <td class="muted">${fmtDT(f.updatedAt)}</td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="6" class="muted">Ingen skifter ennå.</td></tr>`;

    rowsEl.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.addEventListener("click", () => location.hash = "#/plante/skifte/" + tr.getAttribute("data-id"));
    });
  };

  const applyFilter = () => {
    const q = (view.querySelector("#q").value || "").trim().toLowerCase();
    const filtered = fields.filter(f => !q || String(f.name||"").toLowerCase().includes(q));
    renderRows(filtered);
  };

  view.querySelector("#q").addEventListener("input", applyFilter);
  renderRows(fields);

  const setMsg = (txt, err=false) => {
    const el = view.querySelector("#msg");
    el.textContent = txt || "";
    el.style.color = err ? "var(--danger)" : "var(--muted)";
  };

  view.querySelector("#add").addEventListener("click", async () => {
    const name = (view.querySelector("#name").value || "").trim();
    const fulldyrket = toNum(view.querySelector("#fulldyrket").value);
    const overflatedyrket = toNum(view.querySelector("#overflatedyrket").value);
    const innmarksbeite = toNum(view.querySelector("#innmarksbeite").value);

    if (!name) return setMsg("Mangler navn.", true);

    const user = state.activeUser;
    const fId = id("field");

    await db.transaction(async (draft) => {
      draft.fields[fId] = {
        id: fId,
        name,
        areas: { fulldyrket, overflatedyrket, innmarksbeite },
        active: true,
        createdAt: now(),
        updatedAt: now(),
        createdBy: user.id,
        updatedBy: user.id,
        deletedAt: null
      };
      draft.events.push(makeEvent({
        productionType: "plante",
        entityType: "field",
        entityId: fId,
        eventType: "skifte_opprettet",
        date: now(),
        payload: { name, areas: { fulldyrket, overflatedyrket, innmarksbeite } },
        notes: "",
        userId: user.id
      }));
    });

    setMsg("Skifte lagt til.");
    location.hash = "#/plante";
  });
}

export async function renderSkifte(ctx, fieldId){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;

  const dbState = await db.get("db");
  const f = dbState.fields?.[fieldId];
  if (!f || f.deletedAt) {
    view.innerHTML = `<div class="muted">Fant ikke skiftet (kan være slettet).</div>`;
    return;
  }

  const events = (dbState.events || []).filter(ev => !ev.deletedAt && ev.entityType==="field" && ev.entityId===fieldId);
  events.sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const s = sumAreas(f.areas||{});

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div>
            <div class="badge">Skifte • ${escapeHtml(f.id)}</div>
            <h2 style="margin:8px 0 0 0">${escapeHtml(f.name || f.id)}</h2>
            <div class="muted">Sum areal: <strong>${fmt(s)} daa</strong></div>
          </div>
          <div class="row">
            <button class="btn" id="back">Til skifter</button>
            <button class="btn danger" id="trash">Til papirkurv</button>
          </div>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Rediger skifte</h3>
          <div class="grid">
            <div class="field">
              <label>Navn</label>
              <input id="name" value="${escapeAttr(f.name||"")}" />
            </div>
            <div class="field">
              <label>Fulldyrket (daa)</label>
              <input id="fulldyrket" inputmode="decimal" value="${escapeAttr(f.areas?.fulldyrket ?? 0)}" />
            </div>
            <div class="field">
              <label>Overflatedyrket (daa)</label>
              <input id="overflatedyrket" inputmode="decimal" value="${escapeAttr(f.areas?.overflatedyrket ?? 0)}" />
            </div>
            <div class="field">
              <label>Innmarksbeite (daa)</label>
              <input id="innmarksbeite" inputmode="decimal" value="${escapeAttr(f.areas?.innmarksbeite ?? 0)}" />
            </div>
            <div class="muted">Sum (auto): <strong id="sum">${fmt(s)}</strong> daa</div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="save">Lagre</button>
          </div>
          <div class="muted" id="saveMsg" style="margin-top:8px"></div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Ny hendelse</h3>
          <div class="grid">
            <div class="field">
              <label>Type</label>
              <select id="eventType">
                <option value="jordarbeid">Jordarbeid</option>
                <option value="såing">Såing</option>
                <option value="gjødsling">Gjødsling</option>
                <option value="sprøyting">Sprøyting</option>
                <option value="høsting">Høsting</option>
                <option value="annet">Annet</option>
              </select>
            </div>
            <div class="field">
              <label>Dato/tid</label>
              <input id="eventDate" type="datetime-local" />
            </div>
            <div class="field">
              <label>Notat</label>
              <input id="eventNote" placeholder="Kort notat…" />
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="addEvent">Legg til hendelse</button>
          </div>
          <div class="muted" id="eventMsg" style="margin-top:8px"></div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead>
            <tr>
              <th>Dato</th><th>Type</th><th>Notat</th><th>Endret av</th><th></th>
            </tr>
          </thead>
          <tbody id="eventRows"></tbody>
        </table>
      </div>
    </div>
  `;

  view.querySelector("#back").onclick = () => location.hash = "#/plante";

  view.querySelector("#trash").onclick = async () => {
    const user = state.activeUser;
    await db.transaction(async (draft) => {
      const cur = draft.fields[fieldId];
      if (!cur) return;
      cur.deletedAt = now();
      cur.updatedAt = now();
      cur.updatedBy = user.id;
      draft.trash.fields.push({ id: fieldId, deletedAt: cur.deletedAt });
    });
    location.hash = "#/plante";
  };

  const updateSum = () => {
    const a = {
      fulldyrket: toNum(view.querySelector("#fulldyrket").value),
      overflatedyrket: toNum(view.querySelector("#overflatedyrket").value),
      innmarksbeite: toNum(view.querySelector("#innmarksbeite").value),
    };
    view.querySelector("#sum").textContent = fmt(sumAreas(a));
  };
  ["#fulldyrket","#overflatedyrket","#innmarksbeite"].forEach(sel=>{
    view.querySelector(sel).addEventListener("input", updateSum);
  });

  const setSaveMsg = (txt, err=false) => {
    const el = view.querySelector("#saveMsg");
    el.textContent = txt || "";
    el.style.color = err ? "var(--danger)" : "var(--muted)";
  };

  view.querySelector("#save").onclick = async () => {
    const name = (view.querySelector("#name").value || "").trim();
    if (!name) return setSaveMsg("Mangler navn.", true);

    const areas = {
      fulldyrket: toNum(view.querySelector("#fulldyrket").value),
      overflatedyrket: toNum(view.querySelector("#overflatedyrket").value),
      innmarksbeite: toNum(view.querySelector("#innmarksbeite").value),
    };

    const user = state.activeUser;
    await db.transaction(async (draft) => {
      const cur = draft.fields[fieldId];
      if (!cur) return;
      cur.name = name;
      cur.areas = areas;
      cur.updatedAt = now();
      cur.updatedBy = user.id;

      draft.events.push(makeEvent({
        productionType: "plante",
        entityType: "field",
        entityId: fieldId,
        eventType: "skifte_endret",
        date: now(),
        payload: { name, areas },
        notes: "",
        userId: user.id
      }));
    });

    setSaveMsg("Lagret.");
  };

  const setEventMsg = (txt, err=false) => {
    const el = view.querySelector("#eventMsg");
    el.textContent = txt || "";
    el.style.color = err ? "var(--danger)" : "var(--muted)";
  };

  view.querySelector("#addEvent").onclick = async () => {
    const user = state.activeUser;
    const eventType = view.querySelector("#eventType").value;
    const dt = view.querySelector("#eventDate").value;
    const note = view.querySelector("#eventNote").value || "";
    const date = dt ? new Date(dt).toISOString() : now();

    await db.transaction(async (draft) => {
      draft.events.push(makeEvent({
        productionType: "plante",
        entityType: "field",
        entityId: fieldId,
        eventType,
        date,
        payload: {},
        notes: note,
        userId: user.id
      }));
    });

    setEventMsg("Hendelse lagt til.");
    location.hash = "#/plante/skifte/" + fieldId;
  };

  const userById = Object.fromEntries(dbState.users.map(u => [u.id, u]));
  const eventRows = view.querySelector("#eventRows");

  const renderEventRows = () => {
    eventRows.innerHTML = events.map(ev => `
      <tr data-eid="${ev.id}">
        <td>${fmtDT(ev.date)}</td>
        <td><span class="badge">${escapeHtml(ev.eventType)}</span></td>
        <td>${escapeHtml(ev.notes || "")}</td>
        <td class="muted">${escapeHtml(userById[ev.updatedBy]?.name || ev.updatedBy || "")}</td>
        <td style="text-align:right"><button class="btn" data-edit="${ev.id}">Rediger</button></td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="muted">Ingen hendelser ennå.</td></tr>`;

    eventRows.querySelectorAll("button[data-edit]").forEach(btn => {
      btn.onclick = () => openEdit(btn.getAttribute("data-edit"));
    });
  };

  const openEdit = (eventId) => {
    const ev = events.find(x => x.id === eventId);
    if (!ev) return;
    const note = prompt("Rediger notat:", ev.notes || "");
    if (note === null) return;
    ctx.db.transaction(async (draft) => {
      const idx = draft.events.findIndex(x => x.id === eventId);
      if (idx < 0) return;
      draft.events[idx].notes = note;
      draft.events[idx].updatedAt = now();
      draft.events[idx].updatedBy = ctx.state.activeUser.id;
    }).then(() => location.hash = "#/plante/skifte/" + fieldId);
  };

  renderEventRows();
}
