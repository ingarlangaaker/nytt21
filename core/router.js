// core/router.js — minimal hash router (stable)
export function createRouter() {
  const routes = new Map();

  function on(path, handler) { routes.set(path, handler); }

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const path = raw.startsWith("/") ? raw : "/" + raw;
    const [p, qs] = path.split("?");
    const query = Object.fromEntries(new URLSearchParams(qs || ""));
    const parts = p.split("/").filter(Boolean);
    return { raw, path: "/" + parts.join("/"), parts, query };
  }

  async function navigate() {
    const r = parseHash();
    const exact = routes.get(r.path);
    if (exact) return exact(r);

    for (const [key, handler] of routes.entries()) {
      if (!key.includes(":")) continue;
      const kParts = key.split("/").filter(Boolean);
      if (kParts.length !== r.parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < kParts.length; i++) {
        const kp = kParts[i], rp = r.parts[i];
        if (kp.startsWith(":")) params[kp.slice(1)] = decodeURIComponent(rp);
        else if (kp !== rp) { ok = false; break; }
      }
      if (ok) return handler({ ...r, params });
    }

    const fb = routes.get("/404");
    if (fb) return fb(r);
  }

  window.addEventListener("hashchange", navigate);
  window.addEventListener("DOMContentLoaded", navigate);

  return { on, navigate, parseHash };
}
