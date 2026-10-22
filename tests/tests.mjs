// Popote & Co · tests automatiques (lancés avant chaque mise en ligne)
// © D'jims ANDRÉ · Tous droits réservés
import { ouvrir, verifier, fin } from "./outil.mjs";
import { readFileSync } from "node:fs";
const FAUX = readFileSync(new URL("./fauxfirebase.js", import.meta.url), "utf8");
const site = avant => ({ dossier: new URL("../public", import.meta.url).pathname, hote: "https://popote-2026.web.app", avant: FAUX + "\n" + avant });

console.log("Nouveau venu : prénom et nom obligatoires, puis demande d'accès");
{
  const { page, ntfy, erreurs, fermer } = await ouvrir(site("window.__USER={uid:'n1',email:'luc@x.fr',displayName:'Luc',photoURL:''}"));
  await page.waitForTimeout(800);
  verifier((await page.innerText("#gateTitle")).includes("prénom"), "formulaire prénom + nom avant toute demande");
  verifier(!(await page.evaluate("window.__DB['membres/n1']")), "aucune fiche créée sans prénom ni nom");
  await page.click("[data-act=idSend]"); await page.waitForTimeout(200);
  verifier(!(await page.isHidden("#idErr")), "envoi vide refusé avec un message");
  await page.fill("#idNom", "Bernard"); await page.click("[data-act=idSend]"); await page.waitForTimeout(1600);
  const d = await page.evaluate("window.__DB['membres/n1']");
  verifier(d && d.prenom === "Luc" && d.nom === "Bernard" && d.status === "pending", "demande enregistrée en attente avec prénom et nom");
  verifier((await page.innerText("#gateTitle")).includes("Demande envoyée"), "écran « Demande envoyée »");
  verifier(ntfy.some(n => n.corps.includes("Luc Bernard")), "alerte ntfy avec le prénom et le nom");
  verifier(erreurs.length === 0, "aucune erreur JavaScript" + (erreurs.length ? " : " + erreurs.join(" | ") : ""));
  await fermer();
}
console.log("Membre validé sans prénom ni nom");
{
  const { page, fermer } = await ouvrir(site("window.__DB={'membres/o1':{name:'Ancien',email:'old@x.fr',status:'ok',blocked:false,lastSeen:1},'approuves/o1':{at:1}};window.__USER={uid:'o1',email:'old@x.fr',displayName:'Ancien',photoURL:''}"));
  await page.waitForTimeout(800);
  verifier(await page.isVisible("#idPrenom"), "doit compléter avant d'entrer");
  await page.fill("#idPrenom", "Paul"); await page.fill("#idNom", "Ancien"); await page.click("[data-act=idSend]"); await page.waitForTimeout(2000);
  verifier(!(await page.isVisible("#login")), "une fois complété, l'appli s'ouvre");
  await fermer();
}
console.log("Membre validé complet");
{
  const { page, erreurs, fermer } = await ouvrir(site("window.__DB={'membres/m1':{name:'Eva Joseph',prenom:'Eva',nom:'Joseph',email:'eva@x.fr',status:'ok',blocked:false,lastSeen:Date.now()},'approuves/m1':{at:1}};window.__USER={uid:'m1',email:'eva@x.fr',displayName:'Eva Joseph',photoURL:''}"));
  await page.waitForTimeout(1500);
  verifier(!(await page.isVisible("#login")), "l'appli s'ouvre directement");
  verifier(erreurs.length === 0, "aucune erreur JavaScript" + (erreurs.length ? " : " + erreurs.join(" | ") : ""));
  await fermer();
}
console.log("Signaler un problème, nouveautés");
{
  const { page, ntfy, erreurs, fermer } = await ouvrir(site("localStorage.setItem('popote-x','1');window.__DB={'membres/m2':{name:'Eva Joseph',prenom:'Eva',nom:'Joseph',email:'eva@x.fr',status:'ok',blocked:false,lastSeen:Date.now()},'approuves/m2':{at:1}};window.__USER={uid:'m2',email:'eva@x.fr',displayName:'Eva Joseph',photoURL:''}"));
  await page.waitForTimeout(5000);
  verifier(/Quoi de neuf dans Popote/.test(await page.innerText("body")), "membre existant : « Quoi de neuf » après la mise à jour");
  await page.click(".pam-boite .pam-btn"); await page.waitForTimeout(300);
  await page.evaluate("PAM.signaler()"); await page.waitForTimeout(300);
  await page.fill("#pamTexte", "La liste de courses ne se met pas à jour");
  await page.setInputFiles("#pamFich", new URL("./capture-essai.png", import.meta.url).pathname).catch(() => {});
  await page.waitForTimeout(800); await page.click("#pamEnv"); await page.waitForTimeout(1500);
  const r = await page.evaluate("Object.entries(window.__DB).filter(([k]) => k.startsWith('retours/'))");
  const fiche = r.find(([k]) => k.split("/").length === 2);
  verifier(fiche && fiche[1].texte.includes("courses") && fiche[1].nom === "Eva Joseph" && fiche[1].app === "Popote & Co", "problème enregistré pour le tableau de bord");
  verifier(ntfy.some(n => n.corps.includes("problème signalé")), "D'jims prévenu sur ntfy");
  verifier(erreurs.length === 0, "aucune erreur JavaScript" + (erreurs.length ? " : " + erreurs.join(" | ") : ""));
  await fermer();
}
await fin();
