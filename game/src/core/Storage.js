const P = 'froggy.';

export const Storage = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem(P + key);
      return v == null ? def : JSON.parse(v);
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(P + key, JSON.stringify(val)); } catch { /* storage full or blocked */ }
  },
};
