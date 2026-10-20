// Popote & Co · bilan de la semaine envoyé par ntfy chaque lundi (GitHub Actions)
// Lit les fiches des membres, les recettes et les vins de la communauté.
// © D'jims ANDRÉ · Tous droits réservés
import { createSign } from "node:crypto";

const PROJECT = "popote-2026";
const NTFY = process.env.NTFY_TOPIC || "popote-co-acece3a890b5";
const DAY = 864e5, NOW = Date.now();


// 1. Jeton d'accès Google à partir du compte de service (sans dépendance)
async function token(){
  const sa = JSON.parse(process.env.SA || "{}"); if (!sa.private_key) throw new Error("Compte de service manquant");
  const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url"), iat = Math.floor(NOW / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
  const sig = createSign("RSA-SHA256").update(head).sign(sa.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + sig }) });
  const j = await r.json(); if (!j.access_token) throw new Error("Connexion Google refusée : " + JSON.stringify(j).slice(0, 200)); return j.access_token;
}

// 2. Lecture d'une collection Firestore (format REST → objets ordinaires)
const val = v => v == null ? null : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue : "stringValue" in v ? v.stringValue : "booleanValue" in v ? v.booleanValue
  : "timestampValue" in v ? Date.parse(v.timestampValue) : "mapValue" in v ? obj(v.mapValue.fields) : "arrayValue" in v ? (v.arrayValue.values || []).map(val) : null;
const obj = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, val(v)]));
async function coll(tk, name){
  const out = []; let page = "";
  do { const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${name}?pageSize=300${page ? "&pageToken=" + page : ""}`, { headers: { Authorization: "Bearer " + tk } });
    const j = await r.json(); if (j.error) throw new Error(`${name} : ${j.error.message}`);
    (j.documents || []).forEach(d => out.push(obj(d.fields))); page = j.nextPageToken || ""; } while (page);
  return out;
}

async function main(){
  const tk = await token();
  const [M, R, V] = await Promise.all(["membres", "recettes", "vins"].map(c => coll(tk, c).catch(e => { console.log(`::warning::${e.message}`); return []; })));
  const inWeek = t => t && NOW - t < 7 * DAY, pl = (n, s, p) => n > 1 ? (p || s + "s") : s;
  const actifs = M.filter(m => !m.blocked && !m.gone && m.status !== "pending");
  const attente = M.filter(m => m.status === "pending" && !m.blocked);
  const nouveaux = actifs.filter(m => inWeek(m.firstSeen)), vus = actifs.filter(m => inWeek(m.lastSeen)).length;
  const rec = R.filter(r => inWeek(r.createdAt)), vins = V.filter(v => inWeek(v.updatedAt));
  const L = [
    attente.length ? `🙋 ${attente.length} ${pl(attente.length, "demande")} d'accès à valider : ${attente.slice(0, 5).map(m => m.name || m.email || "?").join(", ")}` : "",
    `👥 ${actifs.length} ${pl(actifs.length, "membre")} · ${nouveaux.length} ${pl(nouveaux.length, "nouveau", "nouveaux")}${nouveaux.length ? " : " + nouveaux.slice(0, 5).map(m => m.name || "?").join(", ") : ""}`,
    `📱 ${vus} ${pl(vus, "membre")} ${pl(vus, "actif")} cette semaine`,
    `🍲 ${rec.length} ${pl(rec.length, "recette")} ${pl(rec.length, "ajoutée")}${rec.length ? " : " + rec.slice(0, 5).map(r => r.name).join(", ") : ""} · ${R.length} au total`,
    vins.length ? `🍷 ${vins.length} ${pl(vins.length, "vin")} ${pl(vins.length, "ajouté")} ou ${pl(vins.length, "modifié")}` : ""
  ].filter(Boolean);
  const msg = L.join("\n"); console.log(msg);
  if (process.env.NO_NTFY) return;
  await fetch("https://ntfy.sh/", { method: "POST", body: JSON.stringify({ topic: NTFY, title: "Popote & Co · bilan de la semaine", message: msg, tags: ["stew"] }) });
}
main().catch(e => { console.log(`::error::${e.message || e}`); process.exit(1); });
