// modules/backup/module.js — export/import full DB (json)
import { downloadText, pickFile, readFileText } from "../../core/utils/files.js";

export async function renderBackup(ctx){
  const { db, ui } = ctx;
  const view = ui.viewEl;
  const dbState = await db.get("db");

  view.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Sikkerhetskopi</div>
        <h2 style="margin:8px 0 0 0">Eksport / import</h2>
        <div class="muted">Eksporter hele databasen til en .json-fil, eller importer tilbake.</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Eksport</h3>
          <div class="muted">Laster ned en JSON med alt innhold.</div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn primary" id="export">Last ned backup</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Import</h3>
          <div class="muted">Erstatter dagens data med filen du velger.</div>
          <div class="row" style="justify-content:flex-end;margin-top:10px">
            <button class="btn danger" id="import">Importer backup</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="muted">Sist lagret: ${dbState.updatedAt ? new Date(dbState.updatedAt).toLocaleString("no-NO") : "-"}</div>
      </div>
    </div>
  `;

  view.querySelector("#export").onclick = async () => {
    const s = await db.get("db");
    const name = "farmapp_backup_" + new Date().toISOString().slice(0,19).replace(/[:T]/g,"-") + ".json";
    downloadText(name, JSON.stringify(s, null, 2));
  };

  view.querySelector("#import").onclick = async () => {
    if (!confirm("Dette erstatter dagens data. Er du sikker?")) return;
    const file = await pickFile(".json");
    if (!file) return;
    const txt = await readFileText(file);
    let parsed;
    try { parsed = JSON.parse(txt); } catch(e){ return alert("Ugyldig JSON."); }
    await db.set("db", parsed);
    location.hash = "#/min-gard";
  };
}
