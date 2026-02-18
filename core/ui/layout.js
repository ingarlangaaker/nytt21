// core/ui/layout.js — render nav + sidebar + header bits
export function setHeader({ titleEl, subEl }, title, sub) {
  titleEl.textContent = title || "";
  subEl.textContent = sub || "";
}

export function setActions(actionsEl, buttons=[]) {
  actionsEl.innerHTML = "";
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.className = "btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : "");
    btn.textContent = b.label;
    btn.onclick = b.onClick;
    actionsEl.appendChild(btn);
  }
}

export function renderTopNav(topnavEl, items, currentPath) {
  topnavEl.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.className = "navbtn" + (currentPath === it.path ? " active" : "");
    b.textContent = it.label;
    b.onclick = () => location.hash = "#" + it.path;
    topnavEl.appendChild(b);
  }
}

export function renderSidebar(sidebarEl, items, currentPath) {
  sidebarEl.innerHTML = "";
  for (const it of items) {
    const a = document.createElement("a");
    a.className = "sideitem" + (currentPath === it.path ? " active" : "");
    a.href = "#" + it.path;
    a.innerHTML = `<span class="sideicon">${it.icon||"•"}</span><span>${it.label}</span>`;
    sidebarEl.appendChild(a);
  }
}
