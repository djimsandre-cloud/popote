// Outils communs aux applis de D'jims : 1) annonce des mises à jour (bandeau + « Quoi de neuf »)
// 2) « Signaler un problème » : texte, captures d'écran, message vocal, envoyés à D'jims (ntfy + tableau de bord).
// Chaque appli décrit ses réglages dans window.PAM = { maj: {...}, retour: {...} } (voir plus bas).
// © D'jims ANDRÉ · Tous droits réservés
(function () {
  "use strict";
  const PAM = (window.PAM = window.PAM || {});
  const $ = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lire = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const couleur = () => (PAM.maj && PAM.maj.couleur) || (PAM.retour && PAM.retour.couleur) || "#4f46e5";

  // ---------- Styles (indépendants de l'appli, gros caractères, clair et sombre) ----------
  const css = `
  .pam-voile{position:fixed;inset:0;z-index:2147483000;background:rgba(10,8,25,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px}
  @media(min-width:600px){.pam-voile{align-items:center}}
  .pam-boite{width:100%;max-width:480px;max-height:calc(100dvh - 24px);overflow:auto;background:#fff;color:#17132e;border-radius:22px;padding:20px 18px 18px;font:500 17px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.35)}
  @media(prefers-color-scheme:dark){.pam-boite{background:#1a1636;color:#f2f0ff}.pam-boite textarea{background:#0e0b1f;color:#f2f0ff;border-color:#2b2650}.pam-sous{color:#a19dc4!important}}
  .pam-boite h2{margin:0 0 6px;font-size:22px;line-height:1.2}
  .pam-sous{margin:0 0 14px;color:#6b6785;font-size:15px}
  .pam-boite ul{margin:0 0 16px;padding-left:22px}.pam-boite li{margin:6px 0}
  .pam-ver{font-size:14px;font-weight:800;color:var(--pam-c);margin:14px 0 4px;text-transform:uppercase;letter-spacing:.03em}
  .pam-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 18px;border-radius:14px;border:0;font:800 17px/1 inherit;cursor:pointer;background:var(--pam-c);color:#fff;width:100%}
  .pam-btn.doux{background:rgba(127,127,160,.16);color:inherit}
  .pam-btn:disabled{opacity:.5}
  .pam-ligne{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
  .pam-boite textarea{width:100%;min-height:120px;box-sizing:border-box;border:1.5px solid #d9d6ea;border-radius:14px;padding:12px;font:inherit;resize:vertical}
  .pam-vignettes{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}
  .pam-v{position:relative}.pam-v img{width:84px;height:84px;object-fit:cover;border-radius:12px;display:block}
  .pam-v button{position:absolute;top:-8px;right:-8px;width:28px;height:28px;border-radius:50%;border:0;background:#e5484d;color:#fff;font-weight:900;cursor:pointer}
  .pam-audio{display:flex;align-items:center;gap:10px;margin:6px 0}.pam-audio audio{flex:1;min-width:0;height:40px}
  .pam-err{color:#e5484d;font-weight:700;margin:8px 0 0}
  .pam-info{font-size:13.5px;color:#6b6785;margin:10px 0 0}
  .pam-bandeau{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147482999;max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px;background:#17132e;color:#fff;border-radius:18px;padding:12px 12px 12px 16px;font:600 16px/1.3 system-ui,-apple-system,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.35)}
  .pam-bandeau span{flex:1}.pam-bandeau .pam-btn{width:auto;min-height:44px;font-size:15.5px}
  .pam-x{background:none;border:0;color:inherit;font-size:22px;cursor:pointer;padding:4px 8px}
  .pam-rec{animation:pamrec 1s infinite}@keyframes pamrec{50%{opacity:.55}}`;
  function styles() { if (document.getElementById("pam-css")) return; const s = document.createElement("style"); s.id = "pam-css"; s.textContent = css; document.head.appendChild(s); }
  function fenetre(html) {
    styles(); const v = $(`<div class="pam-voile" role="dialog" aria-modal="true"><div class="pam-boite" style="--pam-c:${couleur()}">${html}</div></div>`);
    v.addEventListener("click", (e) => { if (e.target === v) v.remove(); }); document.body.appendChild(v); return v;
  }

  // ================= 1. Mises à jour =================
  // PAM.maj = { app: "PinIQ", cle: "piniq", couleur: "#...", nouveautes: [{ v: "2026-10-22", points: ["…", "…"] }, …], pret: () => true }
  function quoiDeNeuf(force) {
    const M = PAM.maj; if (!M || !M.nouveautes || !M.nouveautes.length) return;
    const cle = "pam-vu-" + M.cle, vu = lire(cle), der = M.nouveautes[0].v;
    if (!force) {
      if (vu === der) return;
      if (vu == null) {   // jamais vu : nouvel utilisateur (rien d'autre sur ce téléphone) → on n'annonce rien
        let autres = 0; try { autres = localStorage.length; } catch (e) {}
        if (!autres) { ecrire(cle, der); return; }
      }
    }
    const liste = M.nouveautes.filter((n) => force || vu == null || n.v > vu).slice(0, force ? 3 : 4);
    const date = (v) => { const d = new Date(v + "T12:00:00"); return isNaN(d) ? v : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); };
    const f = fenetre(`<h2>🎉 Quoi de neuf dans ${esc(M.app)} ?</h2><p class="pam-sous">Les dernières améliorations de l'appli.</p>
      ${liste.map((n) => `<p class="pam-ver">Mise à jour du ${esc(date(n.v))}</p><ul>${n.points.map((p) => `<li>${p}</li>`).join("")}</ul>`).join("")}
      <button class="pam-btn" type="button">Compris</button>`);
    f.querySelector(".pam-btn").onclick = () => f.remove();
    ecrire(cle, der);
  }
  PAM.quoiDeNeuf = () => quoiDeNeuf(true);
  function bandeau() {
    if (document.querySelector(".pam-bandeau")) return; styles();
    const M = PAM.maj || {}, b = $(`<div class="pam-bandeau" role="status"><span>🎉 Nouvelle version de ${esc(M.app || "l'appli")} disponible</span><button class="pam-btn" type="button" style="--pam-c:${couleur()}">Mettre à jour</button><button class="pam-x" type="button" aria-label="Plus tard">×</button></div>`);
    b.querySelector(".pam-btn").onclick = () => location.reload();
    b.querySelector(".pam-x").onclick = () => b.remove();
    document.body.appendChild(b);
  }
  PAM.bandeauMaj = bandeau;
  function demarrerMaj() {
    // nouvelle version : le service worker a changé pendant que l'appli est ouverte
    if ("serviceWorker" in navigator) {
      let avait = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (avait) bandeau(); avait = true; });
      const verifier = () => navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
      setInterval(verifier, 30 * 60e3);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) verifier(); });
    }
    // « Quoi de neuf » une fois l'appli ouverte (pas par-dessus la connexion ou l'attente de validation)
    let n = 0; const t = setInterval(() => {
      n++; const M = PAM.maj; if (!M) { if (n > 60) clearInterval(t); return; }
      let pret = true; try { pret = M.pret ? !!M.pret() : true; } catch (e) { pret = false; }
      if (pret || n > 120) { clearInterval(t); if (pret) quoiDeNeuf(false); }
    }, 3000);
  }

  // ================= 2. Signaler un problème =================
  // PAM.retour = { app, couleur, ntfy (sujet), version, page: () => "écran", utilisateur: () => ({ uid, nom, email }) | null,
  //                enregistrer: async (fiche, pieces) => "identifiant" }   pieces : [{ type: "image" | "audio", mime, data (base64) }]
  const appareil = () => { const u = navigator.userAgent; return (/iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac/.test(u) ? "Mac" : "appareil")
    + ((matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone ? ", appli installée" : ", navigateur") + `, écran ${screen.width}×${screen.height}`; };
  const enB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const deB64 = (b64, mime) => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new Blob([a], { type: mime }); };
  // capture réduite (1280 px, JPEG) pour rester sous la limite de 1 Mo par document Firebase
  function reduire(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        let k = Math.min(1, 1280 / Math.max(img.width, img.height)), q = 0.62, out;
        for (let essai = 0; essai < 6; essai++) {
          const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL("image/jpeg", q); if (out.length < 850000) break; k *= 0.75; q = Math.max(0.4, q - 0.08);
        }
        URL.revokeObjectURL(img.src); res({ type: "image", mime: "image/jpeg", data: out.split(",")[1], apercu: out });
      };
      img.onerror = rej; img.src = URL.createObjectURL(file);
    });
  }

  PAM.signaler = function () {
    const R = PAM.retour;
    if (!R) return;
    const u = R.utilisateur && R.utilisateur();
    if (!u || !u.uid) { alert("Connecte-toi d'abord pour pouvoir envoyer un message."); return; }
    const etat = { captures: [], audio: null, rec: null, morceaux: [], fin: 0 };
    const f = fenetre(`<h2>🐞 Signaler un problème</h2>
      <p class="pam-sous">Décris ce qui ne va pas ou ce que tu aimerais. Ton message part directement à D'jims.</p>
      <textarea id="pamTexte" maxlength="4000" placeholder="Exemple : quand je touche « Enregistrer », rien ne se passe…"></textarea>
      <div class="pam-vignettes" id="pamVign"></div>
      <div class="pam-audio" id="pamAudio" hidden></div>
      <div class="pam-ligne">
        <label class="pam-btn doux">📷 Captures<input id="pamFich" type="file" accept="image/*" multiple hidden></label>
        <button class="pam-btn doux" type="button" id="pamRec">🎙️ Message vocal</button>
      </div>
      <p class="pam-err" id="pamErr" hidden></p>
      <div class="pam-ligne"><button class="pam-btn doux" type="button" id="pamAnnul">Annuler</button><button class="pam-btn" type="button" id="pamEnv">Envoyer</button></div>
      <p class="pam-info">Jusqu'à 3 captures et 1 minute de message vocal. Sont joints aussi : ton nom, ton téléphone, l'écran où tu étais et la version de l'appli.</p>`);
    const q = (s) => f.querySelector(s), erreur = (m) => { const e = q("#pamErr"); e.textContent = m; e.hidden = !m; };
    const vign = () => { q("#pamVign").replaceChildren(...etat.captures.map((c, i) => { const d = $(`<div class="pam-v"><img alt="Capture ${i + 1}" src="${c.apercu}"><button type="button" aria-label="Retirer">×</button></div>`);
      d.querySelector("button").onclick = () => { etat.captures.splice(i, 1); vign(); }; return d; })); };
    q("#pamFich").onchange = async (e) => {
      erreur(""); const fl = [...e.target.files]; e.target.value = "";
      for (const x of fl) { if (etat.captures.length >= 3) { erreur("3 captures au maximum."); break; } try { etat.captures.push(await reduire(x)); } catch (er) { erreur("Une image n'a pas pu être lue."); } }
      vign();
    };
    const peindreAudio = () => { const a = q("#pamAudio");
      if (!etat.audio) { a.hidden = true; a.replaceChildren(); return; }
      a.hidden = false; a.replaceChildren($(`<audio controls src="data:${etat.audio.mime};base64,${etat.audio.data}"></audio>`), Object.assign($(`<button class="pam-x" type="button" aria-label="Retirer le message vocal">×</button>`), { onclick: () => { etat.audio = null; peindreAudio(); } })); };
    const arreter = () => { if (etat.rec && etat.rec.state === "recording") etat.rec.stop(); };
    q("#pamRec").onclick = async () => {
      erreur("");
      if (etat.rec && etat.rec.state === "recording") return arreter();
      if (!navigator.mediaDevices || !window.MediaRecorder) return erreur("L'enregistrement vocal n'est pas possible sur ce téléphone.");
      try {
        const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
        etat.morceaux = []; etat.rec = new MediaRecorder(flux, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
        etat.rec.ondataavailable = (e) => e.data.size && etat.morceaux.push(e.data);
        etat.rec.onstop = async () => {
          flux.getTracks().forEach((t) => t.stop()); clearTimeout(etat.fin); const b = q("#pamRec"); b.textContent = "🎙️ Message vocal"; b.classList.remove("pam-rec");
          const blob = new Blob(etat.morceaux, { type: (etat.rec.mimeType || "audio/webm").split(";")[0] });
          if (blob.size > 700000) return erreur("Message vocal trop long.");
          etat.audio = { type: "audio", mime: blob.type, data: await enB64(blob) }; peindreAudio();
        };
        etat.rec.start(); const b = q("#pamRec"); b.textContent = "⏹ Arrêter (60 s max)"; b.classList.add("pam-rec");
        etat.fin = setTimeout(arreter, 60000);
      } catch (e) { erreur("Micro refusé : autorise le micro pour cette appli, ou écris ton message."); }
    };
    q("#pamAnnul").onclick = () => { arreter(); f.remove(); };
    q("#pamEnv").onclick = async () => {
      const texte = q("#pamTexte").value.trim();
      if (!texte && !etat.audio && !etat.captures.length) return erreur("Écris quelques mots, ajoute une capture ou un message vocal.");
      if (etat.rec && etat.rec.state === "recording") return erreur("Arrête d'abord l'enregistrement.");
      const b = q("#pamEnv"); b.disabled = true; b.textContent = "Envoi…"; erreur("");
      const page = (() => { try { return R.page ? String(R.page()).slice(0, 80) : ""; } catch (e) { return ""; } })();
      const fiche = { app: R.app, uid: u.uid, nom: String(u.nom || "").slice(0, 90), email: String(u.email || "").slice(0, 120), texte: texte.slice(0, 4000), page,
        version: String(R.version || "").slice(0, 30), appareil: appareil().slice(0, 120), captures: etat.captures.length, audio: !!etat.audio, statut: "nouveau", t: Date.now() };
      const pieces = [...etat.captures.map(({ type, mime, data }) => ({ type, mime, data })), ...(etat.audio ? [etat.audio] : [])];
      let id = "";
      try { id = await R.enregistrer(fiche, pieces); }
      catch (e) { b.disabled = false; b.textContent = "Envoyer"; return erreur("Envoi impossible pour le moment (" + ((e && e.code) || "réseau") + "). Réessaie dans un instant."); }
      // notification immédiate à D'jims, puis captures et message vocal en pièces jointes ntfy
      if (R.ntfy) {
        const corps = [`${fiche.nom || "Un utilisateur"}${fiche.email ? " (" + fiche.email + ")" : ""}`, texte || "(message vocal)", "",
          `📱 ${fiche.appareil}`, page ? `🧭 Écran : ${page}` : "", fiche.version ? `🔖 Version ${fiche.version}` : "",
          pieces.length ? `📎 ${[etat.captures.length ? etat.captures.length + " capture" + (etat.captures.length > 1 ? "s" : "") : "", etat.audio ? "1 message vocal" : ""].filter(Boolean).join(" + ")} (ci-dessous et dans le tableau de bord)` : ""].filter((x, i) => x || i === 2).join("\n");
        try { await fetch("https://ntfy.sh/", { method: "POST", body: JSON.stringify({ topic: R.ntfy, title: `🐞 ${R.app} : problème signalé`, message: corps, tags: ["bug"], priority: 4, click: "https://djims-tableau.web.app/" }) }); } catch (e) {}
        for (let i = 0; i < pieces.length; i++) {
          const p = pieces[i], ext = p.type === "image" ? "jpg" : p.mime.includes("mp4") ? "m4a" : "webm";
          // titre et nom du fichier passés dans l'adresse (les en-têtes HTTP n'acceptent pas les accents ni les émojis)
          const qs = new URLSearchParams({ filename: `${p.type === "image" ? "capture-" + (i + 1) : "message-vocal"}.${ext}`, title: `🐞 ${R.app} · ${fiche.nom || "utilisateur"} · ${p.type === "image" ? "capture " + (i + 1) : "message vocal"}`, tags: "paperclip" });
          try { await fetch("https://ntfy.sh/" + encodeURIComponent(R.ntfy) + "?" + qs, { method: "PUT", body: deB64(p.data, p.mime) }); } catch (e) {}
        }
      }
      f.querySelector(".pam-boite").innerHTML = `<h2>✅ Merci !</h2><p class="pam-sous" style="font-size:17px">Ton message est bien arrivé chez D'jims${id ? ` (réf. ${esc(String(id).slice(0, 6))})` : ""}. Il s'en occupe dès que possible.</p><button class="pam-btn" type="button">Fermer</button>`;
      f.querySelector(".pam-btn").onclick = () => f.remove();
    };
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrerMaj); else demarrerMaj();
})();
