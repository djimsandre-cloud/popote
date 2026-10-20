// Tableau de bord : autorise la page du tableau de bord à se connecter à ce projet, et affiche la configuration web publique
// © D'jims ANDRÉ · Tous droits réservés
import { createSign } from "node:crypto";
const PROJECT = process.env.PROJECT, DOMAINE = "salle-de-jeux-2026.web.app", NOW = Date.now();
// 1. Jeton d'accès Google à partir du compte de service (sans dépendance)
async function token(){
  const sa = JSON.parse(process.env.SA || "{}"); if (!sa.private_key) throw new Error("Compte de service manquant");
  const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url"), iat = Math.floor(NOW / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
  const sig = createSign("RSA-SHA256").update(head).sign(sa.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + sig }) });
  const j = await r.json(); if (!j.access_token) throw new Error("Connexion Google refusée : " + JSON.stringify(j).slice(0, 200)); return j.access_token;
}

async function main(){
  const tk = await token(), H = { Authorization: "Bearer " + tk, "Content-Type": "application/json" };
  const c = await (await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`, { headers: H })).json();
  if (c.error) throw new Error("config : " + c.error.message);
  const doms = c.authorizedDomains || [];
  if (!doms.includes(DOMAINE)) {
    const r = await (await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=authorizedDomains`, { method: "PATCH", headers: H, body: JSON.stringify({ authorizedDomains: [...doms, DOMAINE] }) })).json();
    if (r.error) throw new Error("domaine : " + r.error.message);
  }
  console.log(`::notice::Domaine ${DOMAINE} autorisé sur ${PROJECT}`);
  const apps = await (await fetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/webApps`, { headers: H })).json();
  if (apps.error) throw new Error("applis : " + apps.error.message);
  const a = (apps.apps || [])[0]; if (!a) throw new Error("aucune appli web");
  const cfg = await (await fetch(`https://firebase.googleapis.com/v1beta1/${a.name}/config`, { headers: H })).json();
  console.log("::notice::CONFIG " + JSON.stringify({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId }));
}
main().catch(e => { console.log(`::error::${e.message || e}`); process.exit(1); });
