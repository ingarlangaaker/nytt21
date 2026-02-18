// modules/plante/plan.js — Skifteplan (år + kultur + planlagte operasjoner)
const now = () => new Date().toISOString();
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escA(s){ return esc(s).replace(/"/g,"&quot;"); }
function fmtDT(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleDateString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit"}); }
function planKey(fieldId, year){ return `${year}__${fieldId}`; }

export async function renderSkiftePlan(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");
  const year = String(new Date().getFullYear());
  const fields = Object.values(dbState.fields||{}).filter(f=>!f.deletedAt).sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  const defaultFieldId = fields[0]?.id || "";
  const currentFieldId = (dbState.meta?.selectedFieldId && fields.find(f=>f.id===dbState.meta.selectedFieldId)) ? dbState.meta.selectedFieldId : defaultFieldId;

  const pk = planKey(currentFieldId, year);
  const plan = dbState.fieldPlans?.[pk] || { id: pk, year, fieldId: currentFieldId, crop: "", notes: "", ops: [], createdAt: now(), updatedAt: now(), updatedBy: state.activeUser.id };

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Skifteplan</div>
        <h2 style="margin:8px 0 0 0">År ${esc(year)}</h2>
        <div class="muted">Planlegg kultur og operasjoner (grunnlag for journal og senere beregninger).</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Velg skifte</h3>
          <div class="field">
            <label>Skifte</label>
            <select id="fieldSel">
              ${fields.map(f=>`<option value="${f.id}" ${f.id===currentFieldId?"selected":""}>${esc(f.name||f.id)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Kultur</label>
            <input id="crop" placeholder="f.eks. gras, potet, rabarbra, bygg…" value="${escA(plan.crop||"")}" />
          </div>
          <div class="field">
            <label>Plan-notat</label>
            <input id="pnote" placeholder="Kort notat…" value="${escA(plan.notes||"")}" />
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="savePlan">Lagre plan</button>
          </div>
          <div class="muted" id="msg" style="margin-top:8px"></div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Legg til operasjon</h3>
          <div class="grid">
            <div class="field">
              <label>Type</label>
              <select id="otype">
                <option value="jordarbeid">Jordarbeid</option>
                <option value="såing">Såing</option>
                <option value="gjødsling">Gjødsling</option>
                <option value="sprøyting">Sprøyting</option>
                <option value="høsting">Høsting</option>
                <option value="annet">Annet</option>
              </select>
            </div>
            <div class="field">
              <label>Dato (plan)</label>
              <input id="odate" type="date" />
            </div>
            <div class="field">
              <label>Notat</label>
              <input id="onote" placeholder="Kort notat…" />
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn" id="addOp">Legg til</button>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <table>
          <thead><tr><th>Dato</th><th>Type</th><th>Notat</th><th></th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </div>
  `;

  const setMsg = (t, err=false) => {
    const el = view.querySelector("#msg");
    el.textContent = t || "";
    el.style.color = err ? "var(--danger)" : "var(--muted)";
  };

  const renderRows = (p) => {
    const rows = view.querySelector("#rows");
    const ops = (p.ops||[]).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    rows.innerHTML = ops.map(op => `
      <tr data-id="${op.id}">
        <td>${esc(fmtDT(op.date))}</td>
        <td><span class="badge">${esc(op.type)}</span></td>
        <td class="muted">${esc(op.note||"")}</td>
        <td style="text-align:right"><button class="btn" data-del="${op.id}">Slett</button></td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="muted">Ingen operasjoner planlagt ennå.</td></tr>`;

    rows.querySelectorAll("button[data-del]").forEach(btn => {
      btn.onclick = async () => {
        const opId = btn.getAttribute("data-del");
        await db.transaction(async (draft) => {
          const k = planKey(currentFieldId, year);
          const cur = draft.fieldPlans?.[k];
          if (!cur) return;
          cur.ops = (cur.ops||[]).filter(x => x.id !== opId);
          cur.updatedAt = now();
          cur.updatedBy = state.activeUser.id;
        });
        location.hash = "#/plante/plan";
      };
    });
  };

  renderRows(plan);

  view.querySelector("#fieldSel").onchange = async (e) => {
    await db.transaction(async (draft) => {
      draft.meta = draft.meta || {};
      draft.meta.selectedFieldId = e.target.value;
    });
    location.hash = "#/plante/plan";
  };

  view.querySelector("#savePlan").onclick = async () => {
    const crop = (view.querySelector("#crop").value||"").trim();
    const notes = (view.querySelector("#pnote").value||"").trim();
    const user = state.activeUser;
    await db.transaction(async (draft) => {
      draft.fieldPlans = draft.fieldPlans || {};
      const k = planKey(currentFieldId, year);
      const existing = draft.fieldPlans[k] || { id:k, year, fieldId:currentFieldId, ops:[], createdAt: now() };
      existing.crop = crop;
      existing.notes = notes;
      existing.updatedAt = now();
      existing.updatedBy = user.id;
      draft.fieldPlans[k] = existing;
    });
    setMsg("Plan lagret.");
  };

  view.querySelector("#addOp").onclick = async () => {
    const type = view.querySelector("#otype").value;
    const date = view.querySelector("#odate").value || "";
    const note = (view.querySelector("#onote").value||"").trim();
    if (!date) return alert("Mangler dato.");
    const user = state.activeUser;
    const op = { id: "op_" + crypto.randomUUID(), type, date, note, createdAt: now(), createdBy: user.id };
    await db.transaction(async (draft) => {
      draft.fieldPlans = draft.fieldPlans || {};
      const k = planKey(currentFieldId, year);
      const existing = draft.fieldPlans[k] || { id:k, year, fieldId:currentFieldId, crop:"", notes:"", ops:[], createdAt: now() };
      existing.ops = [...(existing.ops||[]), op];
      existing.updatedAt = now();
      existing.updatedBy = user.id;
      draft.fieldPlans[k] = existing;
    });
    location.hash = "#/plante/plan";
  };
}
