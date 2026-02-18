// modules/trash/module.js — restore soft-deleted animals/fields
const now = () => new Date().toISOString();
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDT(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleString("no-NO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }

export async function renderTrash(ctx){
  const { db, state, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");

  const animals = Object.values(dbState.animals||{}).filter(a=>a.deletedAt).sort((a,b)=>(b.deletedAt||"").localeCompare(a.deletedAt||""));
  const fields = Object.values(dbState.fields||{}).filter(f=>f.deletedAt).sort((a,b)=>(b.deletedAt||"").localeCompare(a.deletedAt||""));

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Papirkurv</div>
        <h2 style="margin:8px 0 0 0">Gjenopprett</h2>
        <div class="muted">Soft-slettede elementer kan gjenopprettes her.</div>
      </div>

      <div class="grid two">
        <div class="card" style="padding:0">
          <table>
            <thead><tr><th colspan="4">Dyr</th></tr>
              <tr><th>ID</th><th>Type</th><th>Slettet</th><th></th></tr>
            </thead>
            <tbody>
              ${animals.map(a=>`
                <tr>
                  <td><strong>${esc(a.externalId||a.earTag||a.id)}</strong></td>
                  <td><span class="badge">${esc(a.productionType)}</span></td>
                  <td class="muted">${fmtDT(a.deletedAt)}</td>
                  <td style="text-align:right"><button class="btn" data-restore-animal="${a.id}">Gjenopprett</button></td>
                </tr>
              `).join("") || `<tr><td colspan="4" class="muted">Ingen dyr i papirkurven.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="card" style="padding:0">
          <table>
            <thead><tr><th colspan="4">Skifter</th></tr>
              <tr><th>Navn</th><th>Sum daa</th><th>Slettet</th><th></th></tr>
            </thead>
            <tbody>
              ${fields.map(f=>{
                const a = f.areas||{};
                const sum = Number(a.fulldyrket||0)+Number(a.overflatedyrket||0)+Number(a.innmarksbeite||0);
                return `
                  <tr>
                    <td><strong>${esc(f.name||f.id)}</strong></td>
                    <td class="muted">${sum.toLocaleString("no-NO")}</td>
                    <td class="muted">${fmtDT(f.deletedAt)}</td>
                    <td style="text-align:right"><button class="btn" data-restore-field="${f.id}">Gjenopprett</button></td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="4" class="muted">Ingen skifter i papirkurven.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  view.querySelectorAll("button[data-restore-animal]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-restore-animal");
      const user = state.activeUser;
      await db.transaction(async (draft) => {
        const a = draft.animals[id];
        if (!a) return;
        a.deletedAt = null;
        a.updatedAt = now();
        a.updatedBy = user.id;
      });
      location.hash = "#/papirkurv";
    };
  });

  view.querySelectorAll("button[data-restore-field]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-restore-field");
      const user = state.activeUser;
      await db.transaction(async (draft) => {
        const f = draft.fields[id];
        if (!f) return;
        f.deletedAt = null;
        f.updatedAt = now();
        f.updatedBy = user.id;
      });
      location.hash = "#/papirkurv";
    };
  });
}
