// Clés Firebase : n'accepter que les adresses des applis (sites web.app, firebaseapp.com et domaines autorisés)
// MODE=voir : affiche les clés et leurs restrictions · MODE=appliquer : limite la clé web de Firebase à ces adresses
// © D'jims ANDRÉ · Tous droits réservés
import { createSign } from "node:crypto";
const PROJECT = process.env.PROJECT, MODE = process.env.MODE || "voir", NOW = Date.now();
async function token(){
  const sa = JSON.parse(process.env.SA || "{}"); if (!sa.private_key) throw new Error("Compte de service manquant");
  const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url"), iat = Math.floor(NOW / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
  const sig = createSign("RSA-SHA256").update(head).sign(sa.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + sig }) });
  const j = await r.json(); if (!j.access_token) throw new Error("Connexion Google refusée : " + JSON.stringify(j).slice(0, 200)); return j.access_token;
}
const H = { Authorization: "Bearer " + await token(), "Content-Type": "application/json" };
const api = async (url, opt = {}) => { const r = await fetch(url, { headers: H, ...opt, body: opt.body && JSON.stringify(opt.body) }); let j = {}; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const note = m => console.log("::notice::" + m), err = m => console.log("::error::" + m);

// 1. Adresses de l'appli
const doms = new Set([`${PROJECT}.web.app`, `${PROJECT}.firebaseapp.com`]);
const sites = await api(`https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT}/sites`);
(sites.j.sites || []).forEach(s => doms.add(new URL(s.defaultUrl).host));
const cfg = await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`);
(cfg.j.authorizedDomains || []).filter(d => d !== "localhost").forEach(d => doms.add(d));
(process.env.EN_PLUS || "").split(",").filter(Boolean).forEach(d => doms.add(d));
const referents = [...doms].flatMap(d => [`https://${d}/*`]);
note(`Adresses : ${[...doms].join(", ")}`);

// 2. Clés du projet
const num = (await api(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`)).j.projectNumber || PROJECT;
const L = await api(`https://apikeys.googleapis.com/v2/projects/${num}/locations/global/keys`);
if (L.j.error) { err("Liste des clés : " + L.j.error.message); process.exit(1); }
const cles = L.j.keys || [];
for (const k of cles) {
  const r = k.restrictions || {};
  note(`Clé « ${k.displayName} » · référents : ${(r.browserKeyRestrictions?.allowedReferrers || []).join(" ") || "aucun"} · API : ${(r.apiTargets || []).map(a => a.service.replace(".googleapis.com", "")).join(" ") || "toutes"}`);
}
if (MODE !== "appliquer") process.exit(0);
let ko = 0;
for (const k of cles.filter(k => /auto created by Firebase/i.test(k.displayName))) {
  const r = { ...(k.restrictions || {}), browserKeyRestrictions: { allowedReferrers: referents } };
  const u = await api(`https://apikeys.googleapis.com/v2/${k.name}?updateMask=restrictions`, { method: "PATCH", body: { restrictions: r } });
  if (u.j.error) { ko++; err(`« ${k.displayName} » : ${u.j.error.message}`); } else note(`« ${k.displayName} » limitée à ${doms.size} adresses`);
}
if (ko) process.exit(1);
