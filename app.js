
function setupMobileUI(){
  const hamb = document.getElementById("hamburger");
  const overlay = document.getElementById("overlay");
  if(hamb && !hamb.dataset.bound){
    hamb.dataset.bound="1";
    hamb.addEventListener("click", ()=> document.body.classList.toggle("nav-open"));
  }
  if(overlay && !overlay.dataset.bound){
    overlay.dataset.bound="1";
    overlay.addEventListener("click", ()=> document.body.classList.remove("nav-open"));
  }

  const bottom = document.getElementById("bottomnav");
  if(bottom && !bottom.dataset.built){
    bottom.dataset.built="1";
    bottom.innerHTML = `
      <button class="tabbtn" data-go="/"><div class="ico">🏠</div>Hjem</button>
      <button class="tabbtn" data-go="/skifter"><div class="ico">🗺️</div>Skifter</button>
      <button class="tabbtn" data-go="/oppgaver"><div class="ico">✅</div>Oppg</button>
      <button class="tabbtn" data-go="/hurtig"><div class="ico">⚡</div>Hurtig</button>
      <button class="tabbtn" data-go="/min-gard"><div class="ico">⚙️</div>Min gård</button>
    `;
    bottom.querySelectorAll("button[data-go]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        document.body.classList.remove("nav-open");
        location.hash = "#"+btn.getAttribute("data-go");
      });
    });
  }
}

function updateBottomActive(path){
  const bottom = document.getElementById("bottomnav");
  if(!bottom) return;
  bottom.querySelectorAll(".tabbtn").forEach(b=>b.classList.remove("active"));
  const btn = bottom.querySelector(`.tabbtn[data-go="${path}"]`);
  if(btn) btn.classList.add("active");
}

function wrapTablesForMobile(){
  // Avoid crushed tables: wrap any table directly inside .card with a scroll container
  document.querySelectorAll(".card table").forEach(t=>{
    if(t.closest(".tableWrap")) return;
    const wrap = document.createElement("div");
    wrap.className="tableWrap";
    t.parentElement.insertBefore(wrap, t);
    wrap.appendChild(t);
  });
}


function transformTablesToCards(){
  // On mobile: convert data tables to readable cards (keeps buttons)
  try{
    const isMobile = window.matchMedia("(max-width: 820px)").matches;
    const view = document.getElementById("view") || document.querySelector(".content");
    if(!view) return;

    // remove old card lists and reset markers
    view.querySelectorAll(".cardsFromTable").forEach(x=>x.remove());
    view.querySelectorAll(".card.hasCards").forEach(c=>c.classList.remove("hasCards"));
    if(!isMobile) return;

    view.querySelectorAll(".card").forEach(card=>{
      const table = card.querySelector("table");
      if(!table) return;

      const headers = Array.from(table.querySelectorAll("thead th")).map(th=>th.textContent.trim());
      const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
      if(!bodyRows.length) return;

      const wrap = document.createElement("div");
      wrap.className = "cardsFromTable";

      bodyRows.forEach(tr=>{
        const tds = Array.from(tr.querySelectorAll("td"));
        if(!tds.length) return;

        // Prefer strong text as title (common in our app), else first cell text
        const strong = tr.querySelector("strong");
        let titleText = (strong?.textContent || tds[0].textContent || "").trim().replace(/\s+/g," ");
        if(!titleText) titleText = (headers[0]||"");

        // Optional meta line: first .muted inside row (createdAt etc.)
        const muted = tr.querySelector(".muted");
        const metaText = (muted?.textContent||"").trim().replace(/\s+/g," ");

        // Badge: if first cell is an icon/status (✅ ⚠️ 🟩 etc), show it
        const firstCellRaw = (tds[0].textContent||"").trim();
        const badgeText = (firstCellRaw.length<=3 && firstCellRaw !== titleText) ? firstCellRaw : "";

        const tcard = document.createElement("div");
        tcard.className = "tcard";

        const titleRow = document.createElement("div");
        titleRow.className = "tcardTitleRow";
        titleRow.innerHTML = `<div class="tcardTitle">${escapeHtml(titleText)}</div>${badgeText?`<span class="tbadge">${escapeHtml(badgeText)}</span>`:""}`;
        tcard.appendChild(titleRow);

        if(metaText && metaText !== titleText){
          const meta = document.createElement("div");
          meta.className="tcardMeta";
          meta.textContent = metaText;
          tcard.appendChild(meta);
        }

        // Key/Value: take remaining cells (skip last if it contains buttons only)
        const lastCell = tds[tds.length-1];
        const lastHasButtons = !!lastCell?.querySelector("button");
        const limit = lastHasButtons ? tds.length-1 : tds.length;

        for(let i=0;i<limit;i++){
          if(i===0) continue; // first cell used for title/badge
          const k = headers[i] || ("Felt "+(i+1));
          const v = (tds[i].textContent||"").trim().replace(/\s+/g," ");
          if(!v) continue;
          const row = document.createElement("div");
          row.className="kv";
          row.innerHTML = `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div>`;
          tcard.appendChild(row);
        }

        // Actions (buttons) from last cell
        const btns = lastHasButtons ? Array.from(lastCell.querySelectorAll("button")) : [];
        if(btns.length){
          const actions = document.createElement("div");
          actions.className="tactions";
          btns.forEach(b=>{
            const clone = b.cloneNode(true);
            clone.addEventListener("click", ()=> b.click());
            actions.appendChild(clone);
          });
          tcard.appendChild(actions);
        }

        wrap.appendChild(tcard);
      });

      table.insertAdjacentElement("afterend", wrap);
      card.classList.add("hasCards"); // scope table hiding
    });
  }catch(e){}
}
function escapeHtml(s){
}
}
function escapeHtml(s){
  return String(s||"").replace(/[&<>'"]/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[m]));
}
// app.js — bootstrap Core v1.5.0
import { DB } from "./core/db/index.js";
import { createRouter } from "./core/router.js";
import { renderTopNav, renderSidebar, setHeader, setActions } from "./core/ui/layout.js";
import { getActiveUser } from "./core/auth.js";

import { renderMinGard } from "./modules/minGard/module.js";
import { renderSauList, renderSauAnimal } from "./modules/sau/module.js";
import { renderSkifterList, renderSkifte } from "./modules/plante/module.js";
import { renderSkiftePlan } from "./modules/plante/plan.js";
import { renderPlanteJournal } from "./modules/plante/journal.js";
import { renderJobb } from "./modules/jobb/module.js";
import { renderTrash } from "./modules/trash/module.js";
import { renderBackup } from "./modules/backup/module.js";
import { renderOppgaver } from "./modules/oppgaver/module.js";
import { renderNotater } from "./modules/notater/module.js";
import { renderRapport } from "./modules/rapport/module.js";
import { renderMaskiner } from "./modules/maskiner/module.js";
import { renderLager } from "./modules/lager/module.js";
import { renderKalender } from "./modules/kalender/module.js";
import { renderHurtig } from "./modules/hurtig/module.js";

const ui = {
  topnavEl: document.getElementById("topnav"),
  sidebarEl: document.getElementById("sidebar"),
  userchipEl: document.getElementById("userchip"),
  titleEl: document.getElementById("viewTitle"),
  subEl: document.getElementById("viewSub"),
  actionsEl: document.getElementById("viewActions"),
  viewEl: document.getElementById("view"),
  footerStatusEl: document.getElementById("footerStatus"),
  brandSubEl: document.getElementById("brandSub")
};

const db = new DB();

// BOOTSTRAP_GUARD
async function boot(){
  try {

await db.init();

const state = {
  dbState: await db.get("db"),
  activeUser: null
};

async function refreshState() {
  const s = await db.get("db");
  state.dbState = s;
  state.activeUser = getActiveUser(s);
  ui.userchipEl.textContent = "👤 " + state.activeUser.name;
  ui.footerStatusEl.textContent = s.updatedAt ? ("Sist lagret: " + new Date(s.updatedAt).toLocaleString("no-NO")) : "";
}
await refreshState();

const router = createRouter();

function appShell(currentPath) {
  const top = [
    { label: "Hjem", path: "/"},
    { label: "Min gård", path: "/min-gard" },
    { label: "Jobb", path: "/jobb" },
  ];
  if (state.dbState.features.productionModules.plante) top.push({ label: "Plante", path: "/plante" });
  if (state.dbState.features.productionModules.sau) top.push({ label: "Sau", path: "/sau" });
  renderTopNav(ui.topnavEl, top, currentPath);

  const side = [
    { label: "Hjem", path: "/", icon:"🏠" },
    { label: "Min gård", path: "/min-gard", icon:"⚙️" },
    { label: "Jobb", path: "/jobb", icon:"⏱️" },
    { label: "Hurtig", path: "/hurtig", icon:"⚡" },
    { label: "Kalender", path: "/kalender", icon:"🗓️" },
    { label: "Maskiner", path: "/maskiner", icon:"🛠️" },
    { label: "Lager", path: "/lager", icon:"📦" },
    { label: "Oppgaver", path: "/oppgaver", icon:"✅" },
    { label: "Notater", path: "/notater", icon:"📝" },
    { label: "Rapport", path: "/rapport", icon:"📄" },
    { label: "Papirkurv", path: "/papirkurv", icon:"🗑️" },
    { label: "Backup", path: "/backup", icon:"💾" },
  ];
  if (state.dbState.features.productionModules.plante) side.push({ label: "Plante", path: "/plante", icon:"🌾" });
  if (state.dbState.features.productionModules.sau) side.push({ label: "Sau", path: "/sau", icon:"🐑" });
  renderSidebar(ui.sidebarEl, side, currentPath);
}

function ctx() { return { db, state, ui }; }

router.on("/", async () => {
  await refreshState();
  appShell("/");
  setHeader(ui, "Hjem", "Stabil kjerne (Core v1.5.0)");
  setActions(ui.actionsEl, [
    { label: "Min gård", primary: true, onClick: () => location.hash = "#/min-gard" },
    { label: "Jobbklokke", onClick: () => location.hash = "#/jobb" },
    { label: "Skifter", onClick: () => location.hash = "#/plante" },
    { label: "Journal", onClick: () => location.hash = "#/plante/journal" },
    { label: "Oppgaver", onClick: () => location.hash = "#/oppgaver" },
    { label: "Notater", onClick: () => location.hash = "#/notater" },
    { label: "Rapport", onClick: () => location.hash = "#/rapport" },
    { label: "Hurtig", onClick: () => location.hash = "#/hurtig" },
    { label: "Kalender", onClick: () => location.hash = "#/kalender" },
    { label: "Maskiner", onClick: () => location.hash = "#/maskiner" },
    { label: "Lager", onClick: () => location.hash = "#/lager" },
    { label: "yr.no", onClick: () => window.open("https://www.yr.no", "_blank", "noopener,noreferrer") }
  ]);
  ui.viewEl.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="badge">Status</div>
        <h2 style="margin:8px 0 0 0">Core v1.5.0 er oppe</h2>
        <div class="muted">DB wrapper • Brukere • Skifter • Sau • Events</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Neste lag</h3>
          <ul class="muted" style="margin:8px 0 0 16px">
            <li>Journal: sprøyting/gjødsel (logg)</li>
            <li>PDF: sprøytejournal/gjødseljournal (proff)</li>
            <li>Regelmotor: varsler/blokkering</li>
          </ul>
        </div>
        <div class="card">
          <h3 style="margin-top:0">Aktiv bruker</h3>
          <div class="muted">Du er logget som <strong>${state.activeUser.name}</strong> (${state.activeUser.role}).</div>
          <div class="muted" style="margin-top:8px">Bytt bruker i <strong>Min gård</strong>.</div>
        </div>
      </div>
    </div>
  `;
});

router.on("/min-gard", async () => {
  await refreshState();
  appShell("/min-gard");
  setHeader(ui, "Min gård", "Bruker, kommune og aktive produksjoner");
  setActions(ui.actionsEl, []);
  await renderMinGard(ctx());
});

router.on("/plante", async () => {
  await refreshState();
  appShell("/plante");
  setHeader(ui, "Plante — skifter", "Skifter med fulldyrket, overflatedyrket og innmarksbeite");
  setActions(ui.actionsEl, [
    { label: "Skifteplan", onClick: () => location.hash = "#/plante/plan" },
    { label: "Journal", onClick: () => location.hash = "#/plante/journal" }
  ]);
  await renderSkifterList(ctx());
});

router.on("/plante/skifte/:id", async ({ params }) => {
  await refreshState();
  appShell("/plante");
  setHeader(ui, "Skifte", "Rediger arealer og logg hendelser");
  setActions(ui.actionsEl, []);
  await renderSkifte(ctx(), params.id);
});

router.on("/jobb", async () => {
  await refreshState();
  appShell("/jobb");
  setHeader(ui, "Jobb", "Start/stopp jobbeklokke og historikk");
  setActions(ui.actionsEl, [
    { label: "Åpne yr.no", onClick: () => window.open("https://www.yr.no", "_blank", "noopener,noreferrer") }
  ]);
  await renderJobb(ctx());
});

router.on("/papirkurv", async () => {
  await refreshState();
  appShell("/papirkurv");
  setHeader(ui, "Papirkurv", "Gjenopprett slettede elementer");
  setActions(ui.actionsEl, []);
  await renderTrash(ctx());
});

router.on("/backup", async () => {
  await refreshState();
  appShell("/backup");
  setHeader(ui, "Backup", "Eksport / import av data");
  setActions(ui.actionsEl, []);
  await renderBackup(ctx());
});

router.on("/plante/plan", async () => {
  await refreshState();
  appShell("/plante");
  setHeader(ui, "Skifteplan", "Årshjul og plan for skifter");
  setActions(ui.actionsEl, []);
  await renderSkiftePlan(ctx());
});

router.on("/plante/journal", async () => {
  await refreshState();
  appShell("/plante");
  setHeader(ui, "Journal", "Gjødseljournal og sprøytejournal + PDF");
  setActions(ui.actionsEl, []);
  await renderPlanteJournal(ctx());
});

router.on("/oppgaver", async () => {
  await refreshState();
  const mods = (state.dbState?.features?.appModules) || {};
  if (mods.oppgaver === false) { location.hash = "#/"; return; }
  appShell("/oppgaver");
  setHeader(ui, "Oppgaver", "To-do / huskeliste");
  setActions(ui.actionsEl, []);
  await renderOppgaver(ctx());
});

router.on("/notater", async () => {
  await refreshState();
  const mods = (state.dbState?.features?.appModules) || {};
  if (mods.notater === false) { location.hash = "#/"; return; }
  appShell("/notater");
  setHeader(ui, "Notater", "Dagbok / logg");
  setActions(ui.actionsEl, []);
  await renderNotater(ctx());
});

router.on("/rapport", async () => {
  await refreshState();
  const mods = (state.dbState?.features?.appModules) || {};
  if (mods.rapport === false) { location.hash = "#/"; return; }
  appShell("/rapport");
  setHeader(ui, "Rapport", "Eksport / utskrift");
  setActions(ui.actionsEl, []);
  await renderRapport(ctx());
});

router.on("/hurtig", async () => {
  await refreshState();
  const mods = (state.dbState?.features?.appModules) || {};
  if (mods.hurtig === false) { location.hash = "#/"; return; }
  appShell("/hurtig");
  setHeader(ui, "Hurtig", "10-sekunders registrering");
  setActions(ui.actionsEl, []);
  await renderHurtig(ctx());
});

router.on("/kalender", async () => {
  await refreshState();
  const mods = (state.dbState?.features?.appModules) || {};
  if (mods.kalender === false) { location.hash = "#/"; return; }
  appShell("/kalender");
  setHeader(ui, "Kalender", "Årshjul og frister");
  setActions(ui.actionsEl, []);
  await renderKalender(ctx());
});

router.on("/maskiner", async () => {
  await refreshState();
  const mods = (state.dbState?.features?.appModules) || {};
  if (mods.maskiner === false) { location.hash = "#/"; return; }
  appShell("/maskiner");
  setHeader(ui, "Maskiner", "Service og vedlikehold");
  setActions(ui.actionsEl, []);
  await renderMaskiner(ctx());
});

router.on("/lager", async () => {
  await refreshState();
  const mods = (state.dbState?.features?.appModules) || {};
  if (mods.lager === false) { location.hash = "#/"; return; }
  appShell("/lager");
  setHeader(ui, "Lager", "Varer og beholdning");
  setActions(ui.actionsEl, []);
  await renderLager(ctx());
});

router.on("/sau", async () => {
  await refreshState();
  appShell("/sau");
  setHeader(ui, "Sau", "Liste, søk og legg til dyr");
  setActions(ui.actionsEl, []);
  await renderSauList(ctx());
});

router.on("/sau/animal/:id", async ({ params }) => {
  await refreshState();
  appShell("/sau");
  setHeader(ui, "Sau — individ", "Vis og rediger, legg til hendelser");
  setActions(ui.actionsEl, []);
  await renderSauAnimal(ctx(), params.id);
});

router.on("/404", async () => {
  await refreshState();
  appShell("/");
  setHeader(ui, "Fant ikke siden", "Fallback");
  setActions(ui.actionsEl, [{ label:"Til Hjem", primary:true, onClick:()=>location.hash="#/" }]);
  ui.viewEl.innerHTML = `<div class="muted">Siden finnes ikke. Bruk menyen.</div>`;
});

router.navigate();
  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? err.message : String(err);
    ui.topnavEl.innerHTML = '';
    ui.sidebarEl.innerHTML = '';
    ui.titleEl.textContent = 'Feil ved oppstart';
    ui.subEl.textContent = 'Sjekk Console for detaljer';
    ui.actionsEl.innerHTML = '';
    ui.viewEl.innerHTML = `<div class="grid"><div class="card"><div class="badge">Crash</div><h2 style="margin:8px 0 0 0">Appen stoppet</h2><div class="muted" style="margin-top:8px">${msg}</div><div class="muted" style="margin-top:10px">Send meg teksten over, så fikser jeg på første forsøk.</div></div></div>`;
  }
}
boot();

setupMobileUI();

// Mobile: ensure tables are wrapped even when views re-render
const __mobObserver = new MutationObserver(()=>{ try{ wrapTablesForMobile(); }catch(e){}
  try{ transformTablesToCards(); }catch(e){}
  try{ transformTablesToCards(); }catch(e){} });
window.addEventListener("load", ()=>{
  const view = document.getElementById("view");
  if(view) __mobObserver.observe(view, { childList:true, subtree:true });
  try{ wrapTablesForMobile(); }catch(e){}
  try{ transformTablesToCards(); }catch(e){}
  try{ transformTablesToCards(); }catch(e){}
});

window.addEventListener('resize', ()=>{ try{ transformTablesToCards(); }catch(e){} });
