// modules/minGard/module.js — settings: active user + geo selection + module toggles
// Mål: Full liste fylker + kommuner (kommunenummer som i jordbruksavtalen) uten manuell vedlikehold.
// Strategi:
// 1) Prøv cache (localStorage)
// 2) Prøv lokal fil (data/geo/municipalities.min.json)
// 3) Hvis ufullstendig: hent fra SSB KLASS (fylkesinndeling=104, kommuneinndeling=131) og bygg struktur
// 4) Lagre i cache slik at appen fungerer raskt etterpå

const GEO_CACHE_KEY = "farmapp_geo_cache_v1";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function isGeoComplete(geo) {
  const counties = geo?.counties || [];
  if (counties.length < 10) return false; // Norge har 11 fylker i dag
  let muniCount = 0;
  for (const c of counties) muniCount += (c.municipalities || []).length;
  return muniCount >= 300; // trygt minimum (normalt ~357)
}

async function loadGeoFromLocalFile() {
  const url = new URL("../../data/geo/municipalities.min.json", import.meta.url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Kunne ikke laste geo-data (lokal fil): " + res.status);
  return await res.json();
}

async function loadGeoFromKlass(dateISO) {
  // Offisielle koder:
  // 104 = Standard for fylkesinndeling
  // 131 = Standard for kommuneinndeling
  const date = dateISO || todayISO();
  const fylkerUrl = `https://data.ssb.no/api/klass/v1/classifications/104/codesAt.json?date=${encodeURIComponent(date)}&language=nb`;
  const kommunerUrl = `https://data.ssb.no/api/klass/v1/classifications/131/codesAt.json?date=${encodeURIComponent(date)}&language=nb`;

  const [fRes, kRes] = await Promise.all([
    fetch(fylkerUrl, { cache: "no-store" }),
    fetch(kommunerUrl, { cache: "no-store" })
  ]);
  if (!fRes.ok) throw new Error("Klarte ikke hente fylker fra SSB KLASS: " + fRes.status);
  if (!kRes.ok) throw new Error("Klarte ikke hente kommuner fra SSB KLASS: " + kRes.status);

  const fylker = await fRes.json();
  const kommuner = await kRes.json();

  const fylkeCodes = (fylker.codes || []).map(x => ({ code: String(x.code).padStart(2,"0"), name: x.name }));
  const kommuneCodes = (kommuner.codes || []).map(x => ({ code: String(x.code).padStart(4,"0"), name: x.name }));

  const countiesByCode = new Map();
  for (const f of fylkeCodes) {
    countiesByCode.set(f.code, { code: f.code, name: f.name, municipalities: [] });
  }

  for (const k of kommuneCodes) {
    const countyCode = k.code.slice(0,2);
    const county = countiesByCode.get(countyCode);
    if (!county) continue;
    county.municipalities.push({ code: k.code, name: k.name });
  }

  const counties = Array.from(countiesByCode.values())
    .map(c => ({ ...c, municipalities: (c.municipalities || []).sort((a,b)=>a.name.localeCompare(b.name, "nb")) }))
    .sort((a,b)=>a.name.localeCompare(b.name, "nb"));

  return {
    source: "SSB KLASS 104/131 codesAt",
    date,
    counties
  };
}

async function loadGeo() {
  // 1) cache
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (isGeoComplete(parsed)) return parsed;
    }
  } catch {}

  // 2) local file
  try {
    const geo = await loadGeoFromLocalFile();
    if (isGeoComplete(geo)) {
      try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo)); } catch {}
      return geo;
    }
  } catch {}

  // 3) fallback KLASS
  const geo = await loadGeoFromKlass();
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo)); } catch {}
  return geo;
}

export async function renderMinGard(ctx) {
  const { db, state, ui } = ctx;
  const view = ui.viewEl;

  const dbState = await db.get("db");
  const user = state.activeUser;

  const geo = await loadGeo();
  const counties = geo.counties || [];

  // Pre-select if missing
  let countyCode = dbState.meta.geo.countyCode || "";
  let muniCode = dbState.meta.geo.municipalityCode || "";

  if (!countyCode && counties[0]) countyCode = counties[0].code;
  let selectedCounty = counties.find(c => c.code === countyCode) || counties[0] || { municipalities: [] };
  const munis = selectedCounty?.municipalities || [];

  if (!muniCode && munis[0]) muniCode = munis[0].code;

  const countyOptions = counties.map(c => `<option value="${c.code}" ${countyCode===c.code?"selected":""}>${c.name} (${c.code})</option>`).join("");
  const muniOptions = munis.map(m => `<option value="${m.code}" ${muniCode===m.code?"selected":""}>${m.name} (${m.code})</option>`).join("");

  view.innerHTML = `
    <div class="grid">
      <div class="card" style="background:linear-gradient(180deg,#121a22,#0e1620)">
        <div class="badge">Min gård</div>
        <h2 style="margin:8px 0 0 0">Innstillinger</h2>
        <div class="muted">Velg aktiv bruker, kommune og aktive produksjoner. Kommunenummer vises (brukes i jordbruksavtale/soner senere).</div>
        <div class="muted" style="margin-top:6px">Geo-kilde: ${geo.source || "lokal fil"} (${geo.date || ""})</div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3 style="margin-top:0">Aktiv bruker</h3>
          <div class="field">
            <label>Velg bruker</label>
            <select id="activeUser">
              ${dbState.users.map(u => `<option value="${u.id}" ${dbState.activeUserId===u.id?"selected":""}>${u.name} (${u.role})</option>`).join("")}
            </select>
          </div>
          <div class="muted" style="margin-top:8px">Owner kan endre innstillinger og eksportere. Avløser kan ikke.</div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">Geografi</h3>
          <div class="grid">
            <div class="field">
              <label>Fylke</label>
              <select id="county">
                ${countyOptions}
              </select>
            </div>
            <div class="field">
              <label>Kommune</label>
              <select id="municipality">
                ${muniOptions}
              </select>
            </div>
          </div>
          <div class="muted" style="margin-top:8px">Sone-tabeller (jordbruksavtale) kobles på kommunenummer.</div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Aktive produksjoner</h3>
        <div class="row">
          ${Object.entries(dbState.features.productionModules).map(([k,v]) => `
            <label class="badge" style="cursor:${user.role==='owner'?'pointer':'not-allowed'}">
              <input type="checkbox" data-mod="${k}" ${v?"checked":""} ${user.role!=='owner'?'disabled':''} />
              ${k}
            </label>
          `).join("")}
        </div>
        <div class="muted" style="margin-top:10px">Deaktivering skjuler modulen, men data beholdes.</div>
      </div>

      <div class="card">
        <h3 style="margin-top:0">App-moduler</h3>
        <div class="row">
          ${Object.entries(dbState.features.appModules||{}).map(([k,v]) => `
            <label class="badge" style="cursor:${user.role==='owner'?'pointer':'not-allowed'}">
              <input type="checkbox" data-appmod="${k}" ${v?"checked":""} ${user.role!=='owner'?'disabled':''} />
              ${k}
            </label>
          `).join("")}
        </div>
        <div class="muted" style="margin-top:10px">Deaktivering skjuler modulen, men data beholdes.</div>
      </div>
    </div>
  `;

  // Save pre-select if needed
  if (countyCode !== dbState.meta.geo.countyCode || muniCode !== dbState.meta.geo.municipalityCode) {
    const c = counties.find(x => x.code === countyCode);
    const m = (c?.municipalities || []).find(x => x.code === muniCode);
    await db.transaction(async (draft) => {
      draft.meta.geo.countyCode = countyCode || "";
      draft.meta.geo.countyName = c?.name || "";
      draft.meta.geo.municipalityCode = muniCode || "";
      draft.meta.geo.municipalityName = m?.name || "";
    });
  }

  view.querySelector("#activeUser")?.addEventListener("change", async (e) => {
    const nextId = e.target.value;
    await db.transaction(async (draft) => { draft.activeUserId = nextId; });
    location.hash = "#/min-gard";
  });

  view.querySelector("#county")?.addEventListener("change", async (e) => {
    const code = e.target.value;
    const c = counties.find(x => x.code === code);
    await db.transaction(async (draft) => {
      draft.meta.geo.countyCode = code || "";
      draft.meta.geo.countyName = c?.name || "";
      draft.meta.geo.municipalityCode = "";
      draft.meta.geo.municipalityName = "";
    });
    location.hash = "#/min-gard";
  });

  view.querySelector("#municipality")?.addEventListener("change", async (e) => {
    const code = e.target.value;
    const c = counties.find(x => x.code === (view.querySelector("#county")?.value || countyCode));
    const muni = (c?.municipalities || []).find(m => m.code === code);
    await db.transaction(async (draft) => {
      draft.meta.geo.municipalityCode = code || "";
      draft.meta.geo.municipalityName = muni?.name || "";
    });
  });

  view.querySelectorAll("input[type=checkbox][data-mod]")?.forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const mod = e.target.getAttribute("data-mod");
      if (user.role !== "owner") return;
      await db.transaction(async (draft) => {
        draft.features.productionModules[mod] = !!e.target.checked;
      });
    });
  });

  view.querySelectorAll("input[type=checkbox][data-appmod]")?.forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const mod = e.target.getAttribute("data-appmod");
      if (user.role !== "owner") return;
      await db.transaction(async (draft) => {
        draft.features.appModules = draft.features.appModules || {};
        draft.features.appModules[mod] = !!e.target.checked;
      });
    });
  });

}
