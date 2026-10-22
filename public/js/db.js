/* Armazenamento local (IndexedDB): visitas, fotos, checklist diário e ajustes. Funciona offline. */
window.DB = (() => {
  const NAME = 'visitas-obra';
  const VERSION = 1;
  let dbp = null;

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const r = indexedDB.open(NAME, VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('visits')) db.createObjectStore('visits', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('photos')) {
            db.createObjectStore('photos', { keyPath: 'id' }).createIndex('visitId', 'visitId');
          }
          if (!db.objectStoreNames.contains('dias')) db.createObjectStore('dias', { keyPath: 'data' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return dbp;
  }

  const req = r => new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

  const done = t => new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = t.onabort = () => reject(t.error);
  });

  async function store(name, mode = 'readonly') {
    const db = await open();
    return db.transaction(name, mode).objectStore(name);
  }

  const DB = {
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),

    async allVisits() { return req((await store('visits')).getAll()); },
    async getVisit(id) { return req((await store('visits')).get(id)); },
    async putVisit(v, keepTime = false) {
      if (!keepTime || !v.updatedAt) v.updatedAt = new Date().toISOString();
      await req((await store('visits', 'readwrite')).put(v));
      return v;
    },
    async deleteVisit(id) {
      const photos = await DB.photosOf(id);
      const db = await open();
      const t = db.transaction(['visits', 'photos'], 'readwrite');
      t.objectStore('visits').delete(id);
      photos.forEach(p => t.objectStore('photos').delete(p.id));
      return done(t);
    },

    async allPhotos() { return req((await store('photos')).getAll()); },
    async photosOf(visitId) {
      const list = await req((await store('photos')).index('visitId').getAll(visitId));
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async putPhoto(p) { return req((await store('photos', 'readwrite')).put(p)); },
    async deletePhoto(id) { return req((await store('photos', 'readwrite')).delete(id)); },

    async allDias() { return req((await store('dias')).getAll()); },
    async getDia(data) { return req((await store('dias')).get(data)); },
    async putDia(d) { return req((await store('dias', 'readwrite')).put(d)); },

    async getMeta(key) { return req((await store('meta')).get(key)); },
    async putMeta(m) { return req((await store('meta', 'readwrite')).put(m)); },

    async clearAll() {
      const db = await open();
      const names = ['visits', 'photos', 'dias', 'meta'];
      const t = db.transaction(names, 'readwrite');
      names.forEach(n => t.objectStore(n).clear());
      return done(t);
    },
  };
  return DB;
})();
