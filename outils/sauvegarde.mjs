// Sauvegarde chiffrée de toutes les données Firestore du projet (chaque semaine, GitHub Actions)
// Chiffrement : AES-256-GCM, clé protégée par RSA-OAEP. Seule la clé privée de D'jims permet de relire la sauvegarde.
// © D'jims ANDRÉ · Tous droits réservés
import { createSign, createCipheriv, randomBytes, publicEncrypt, constants } from "node:crypto";
import { gzipSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const PROJECT = process.env.PROJECT;
const NOW = Date.now();
const PUB = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtPIqldsHOOVXidYKWuv4
qLyvxf1l9mjYT3+RBCchr2MBHv51Jg70r1OtxhgzRmG3SnmFMeKMepBR95tDhjk4
cj+8W+8FAyDStgLPQEizKT6siF3Ar8bXHScV1bk7jCPH5xG3nAArFGNVYVxe3CwD
JRn6SNCFDrm0W78ds0O/cO+/zKUTt8eY9FHgJToqXt56vtxvIsUizvme5wRIhfDM
RjmGFWfAPAkRDz6TiIGhU4GixDBwzg6euG7oCtOcZPrDx7XevrcjZfw+CLSYQCpl
HON/fvpZqcpXVr8G7IfxDbhl+DlGDhB6C01En5ALjALNAJHmG5df46zPUwEOIj4x
TmBwS6i0rq9bKN02r+Ayq7lSUvonb8nmS2XVlmtwF5XkRCaPpUuuO8kGS8rBj2L3
Jqyhczdfj08sTtSRUzmt2LmaQX0bUIXTbLlPT1pxXYi4RW0kc4+cPrYe6NpbdGQk
d2gday9kCfQQCZjCg0l6zM0NMjVUdohTBdlYkM8yNrr36Ol5kenjH10vNJlhBlWP
jhMAFazicsH48pu6r5JBqzhoUgInSOh3b85RkUt+xVa7NSetwUxLLKUC3I/fOhAv
lDI30E+nhev2O0bQ/PJV92b/IjOKtvRBO3LjqF12CrrHbIiCd/gmRK/dBM8rJquo
V7pR+pQHmSUrH6Q1uZtLJXUCAwEAAQ==
-----END PUBLIC KEY-----`;

// 1. Jeton d'accès Google à partir du compte de service (sans dépendance)
async function token(){
  const sa = JSON.parse(process.env.SA || "{}"); if (!sa.private_key) throw new Error("Compte de service manquant");
  const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url"), iat = Math.floor(NOW / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
  const sig = createSign("RSA-SHA256").update(head).sign(sa.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + sig }) });
  const j = await r.json(); if (!j.access_token) throw new Error("Connexion Google refusée : " + JSON.stringify(j).slice(0, 200)); return j.access_token;
}

const BASE = () => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
async function api(tk, url, body){
  for (let essai = 0; essai < 5; essai++) {
    const r = await fetch(url, body ? { method: "POST", headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify(body) } : { headers: { Authorization: "Bearer " + tk } });
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 2000 * (essai + 1))); continue; }
    const j = await r.json(); if (j.error) throw new Error(j.error.message); return j;
  }
  throw new Error("Firestore ne répond pas");
}
// Sous-collections d'un document (ou de la racine)
async function sousCollections(tk, parent){
  const ids = []; let page = "";
  do { const j = await api(tk, `${parent}:listCollectionIds`, { pageSize: 300, ...(page ? { pageToken: page } : {}) }); (j.collectionIds || []).forEach(c => ids.push(c)); page = j.nextPageToken || ""; } while (page);
  return ids;
}
const DOCS = {}; let n = 0;
async function collection(tk, chemin){
  let page = "";
  do { const j = await api(tk, `${BASE()}/${chemin}?pageSize=300&showMissing=true${page ? "&pageToken=" + page : ""}`);
    for (const d of j.documents || []) {
      const rel = d.name.split("/documents/")[1];
      if (d.fields || d.createTime) { DOCS[rel] = d.fields || {}; n++; }
      for (const c of await sousCollections(tk, d.name)) await collection(tk, rel + "/" + c);
    }
    page = j.nextPageToken || ""; } while (page);
}
async function main(){
  const tk = await token();
  const racine = await sousCollections(tk, BASE());
  for (const c of racine) await collection(tk, c);
  const clair = gzipSync(Buffer.from(JSON.stringify({ projet: PROJECT, date: new Date(NOW).toISOString(), documents: DOCS })));
  const cle = randomBytes(32), iv = randomBytes(12), c = createCipheriv("aes-256-gcm", cle, iv);
  const chiffre = Buffer.concat([c.update(clair), c.final()]);
  const enveloppe = publicEncrypt({ key: PUB, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, cle);
  const tete = Buffer.from(JSON.stringify({ v: 1, projet: PROJECT, date: new Date(NOW).toISOString(), cle: enveloppe.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") }) + "\n");
  mkdirSync("sortie", { recursive: true });
  const nom = `sortie/sauvegarde-${new Date(NOW).toISOString().slice(0, 10)}.enc`;
  writeFileSync(nom, Buffer.concat([tete, chiffre]));
  console.log(`::notice::${n} documents dans ${racine.length} collection(s) principales (${racine.join(", ")}) · ${(chiffre.length / 1024).toFixed(0)} Ko chiffrés`);
}
main().catch(e => { console.log(`::error::${e.message || e}`); process.exit(1); });
