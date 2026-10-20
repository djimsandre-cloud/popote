// Firebase (modulaire) simulé pour les tests de Popote & Co : base en mémoire window.__DB, utilisateur window.__USER
window.__DB = window.__DB || {}; window.__W = [];
window.__FAKE_FB = async () => {
  const DB = window.__DB, subs = [];
  const fire = () => subs.forEach(f => f());
  const snap = p => ({ exists: () => !!DB[p], data: () => DB[p] && { ...DB[p] }, id: p.split('/').pop() });
  const qs = p => { const docs = Object.keys(DB).filter(k => k.startsWith(p + '/') && k.split('/').length === p.split('/').length + 1).map(k => ({ id: k.split('/').pop(), data: () => ({ ...DB[k] }), exists: () => true })); return { docs, forEach: f => docs.forEach(f), empty: !docs.length, size: docs.length, docChanges: () => [] }; };
  const known = {
    doc: (db, ...seg) => ({ path: seg.join('/'), kind: 'doc' }),
    collection: (db, ...seg) => ({ path: seg.join('/'), kind: 'col' }),
    getDoc: async r => snap(r.path),
    getDocs: async r => qs(r.path || ''),
    setDoc: async (r, d, o) => { DB[r.path] = o && o.merge ? { ...(DB[r.path] || {}), ...d } : { ...d }; window.__W.push(['set', r.path, d]); setTimeout(fire); },
    updateDoc: async (r, d) => { if (!DB[r.path]) throw { code: 'not-found' }; Object.assign(DB[r.path], d); window.__W.push(['update', r.path, d]); setTimeout(fire); },
    deleteDoc: async r => { delete DB[r.path]; setTimeout(fire); },
    onSnapshot: (r, a, b) => { const cb = typeof a === 'function' ? a : b; const f = () => cb(r && r.kind === 'doc' ? snap(r.path) : qs((r && r.path) || '')); subs.push(f); setTimeout(f); return () => {}; },
    writeBatch: () => { const ops = []; return { set: (r, d) => ops.push(() => known.setDoc(r, d)), update: (r, d) => ops.push(() => known.updateDoc(r, d)), delete: r => ops.push(() => known.deleteDoc(r)), commit: async () => { for (const o of ops) await o(); } }; },
    query: r => r, serverTimestamp: () => Date.now()
  };
  const fs = new Proxy(known, { get: (t, k) => t[k] || ((...a) => a[0]) });
  window.__fire = fire;
  let cb = null;
  const auth = { currentUser: null };
  const au = { getRedirectResult: async () => null, onAuthStateChanged: (a, f) => { cb = f; setTimeout(() => { auth.currentUser = window.__USER || null; f(auth.currentUser); }); return () => {}; },
    signOut: async () => { auth.currentUser = null; cb && cb(null); }, GoogleAuthProvider: function () { this.setCustomParameters = () => {}; },
    signInWithPopup: async () => { auth.currentUser = window.__NEXT; cb && cb(auth.currentUser); } };
  return { app: {}, db: {}, fs, au, auth };
};
