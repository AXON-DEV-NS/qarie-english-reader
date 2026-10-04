window.DB = (function () {
  const NAME = 'qarieDB';
  const VERSION = 1;
  const STORES = ['files', 'words', 'cache', 'meta'];
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('words')) d.createObjectStore('words', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('cache')) d.createObjectStore('cache', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function p(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function store(name, mode) {
    const d = await open();
    return d.transaction(name, mode || 'readonly').objectStore(name);
  }

  async function get(name, key) { return p((await store(name)).get(key)); }
  async function all(name) { return p((await store(name)).getAll()); }
  async function put(name, value) { return p((await store(name, 'readwrite')).put(value)); }
  async function del(name, key) { return p((await store(name, 'readwrite')).delete(key)); }
  async function clear(name) { return p((await store(name, 'readwrite')).clear()); }
  async function count(name) { return p((await store(name)).count()); }
  async function bulkPut(name, values) {
    const st = await store(name, 'readwrite');
    await Promise.all((values || []).map((v) => p(st.put(v))));
  }
  async function bulkDelete(name, keys) {
    const st = await store(name, 'readwrite');
    await Promise.all((keys || []).map((k) => p(st.delete(k))));
  }

  async function getMeta(key, def) {
    const row = await get('meta', key);
    return row && row.value !== undefined ? row.value : def;
  }
  async function setMeta(key, value) {
    return put('meta', { key: key, value: value });
  }
  async function cacheGet(key) {
    const row = await get('cache', key);
    if (!row) return null;
    if (row.exp && row.exp < Date.now()) {
      del('cache', key).catch(() => {});
      return null;
    }
    return row.value;
  }
  async function cacheSet(key, value, ttlMs) {
    return put('cache', { key: key, value: value, exp: ttlMs ? Date.now() + ttlMs : 0 });
  }

  function changed() {
    try { document.dispatchEvent(new Event('data:changed')); } catch (e) {}
  }

  return {
    open, get, all, put, del, clear, count, bulkPut, bulkDelete,
    getMeta, setMeta, cacheGet, cacheSet, changed
  };
})();
