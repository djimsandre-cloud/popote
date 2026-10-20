// Outils communs des tests automatiques (navigateur sans écran + Firebase simulé, aucun accès réseau)
// © D'jims ANDRÉ · Tous droits réservés
import { chromium } from "playwright";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
let navigateur = null; const echecs = []; let nb = 0;

export function verifier(ok, message){ nb++; if (ok) console.log("  ✓ " + message); else { console.log("  ✗ " + message); echecs.push(message); } }

// dossier : fichiers du site · hote : adresse réelle du site · faux : { "morceau d'URL": "code JS servi à la place" } · avant : script lancé avant la page
export async function ouvrir({ dossier, hote, faux = {}, avant = "", stockage = "" }){
  navigateur ??= await chromium.launch();
  const ctx = await navigateur.newContext({ serviceWorkers: "block", viewport: { width: 412, height: 900 } });
  const ntfy = [], erreurs = [];
  await ctx.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("ntfy.sh")) { ntfy.push({ url: u, corps: r.request().postData() || "", titre: r.request().headers()["title"] || "" }); return r.fulfill({ status: 200, body: "{}" }); }
    for (const [cle, code] of Object.entries(faux)) if (u.includes(cle)) return r.fulfill({ status: 200, contentType: "text/javascript", body: code });
    if (u.startsWith(hote)) {
      let p = decodeURIComponent(new URL(u).pathname); if (p.endsWith("/")) p += "index.html";
      const f = join(dossier, p);
      if (existsSync(f) && statSync(f).isFile()) return r.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: readFileSync(f) });
      return r.fulfill({ status: 404, body: "" });
    }
    return r.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => erreurs.push(String(e && e.message || e)));
  page.on("dialog", d => d.accept());
  if (stockage) await page.addInitScript(stockage);
  if (avant) await page.addInitScript(avant);
  await page.goto(hote + "/"); await page.waitForTimeout(2000);
  return { page, ntfy, erreurs, fermer: () => ctx.close() };
}

export async function fin(){
  if (navigateur) await navigateur.close();
  console.log(`\n${nb - echecs.length}/${nb} vérifications réussies`);
  if (echecs.length) { console.log("::error::Tests échoués : " + echecs.join(" · ")); process.exit(1); }
}
