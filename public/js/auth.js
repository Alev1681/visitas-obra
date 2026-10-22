/* Login local por PIN: hash PBKDF2 (WebCrypto) guardado no IndexedDB, código de recuperação
 * e bloqueio progressivo após tentativas erradas. Protege o app contra acesso casual ao celular;
 * não é autenticação em servidor. */
window.Auth = (() => {
  const ITER = 150000;
  const MAX_FALHAS = 5;
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const newSalt = () => crypto.getRandomValues(new Uint8Array(16));

  async function derive(secret, salt, iter = ITER) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
  }

  // Comparação sem atalho (tempo constante para strings do mesmo tamanho).
  const same = (a, b) => {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  };

  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I para não confundir
  function recoveryCode() {
    const s = [...crypto.getRandomValues(new Uint8Array(12))].map(b => ALFABETO[b % 32]).join('');
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  }
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const get = () => DB.getMeta('auth');
  const waitOf = a => Math.max(0, (a.bloqueadoAte || 0) - Date.now());

  // Após 5 erros: espera de 30 s, dobrando a cada novo erro (máx. 32 min).
  async function fail(a) {
    a.falhas = (a.falhas || 0) + 1;
    if (a.falhas >= MAX_FALHAS) a.bloqueadoAte = Date.now() + 30000 * 2 ** Math.min(a.falhas - MAX_FALHAS, 6);
    await DB.putMeta(a);
    return { ok: false, restantes: Math.max(0, MAX_FALHAS - a.falhas), waitMs: waitOf(a) };
  }

  async function succeed(a) {
    a.falhas = 0;
    a.bloqueadoAte = 0;
    await DB.putMeta(a);
    return { ok: true };
  }

  return {
    get,

    async setup(nome, pin) {
      const salt = newSalt();
      const recSalt = newSalt();
      const code = recoveryCode();
      await DB.putMeta({
        key: 'auth', nome, iter: ITER,
        salt: b64(salt), hash: await derive(pin, salt),
        recSalt: b64(recSalt), recHash: await derive(normCode(code), recSalt),
        falhas: 0, bloqueadoAte: 0, criadoEm: new Date().toISOString(),
      });
      return code;
    },

    async check(pin) {
      const a = await get();
      if (waitOf(a)) return { ok: false, waitMs: waitOf(a) };
      return same(await derive(pin, unb64(a.salt), a.iter), a.hash) ? succeed(a) : fail(a);
    },

    async changePin(pin) {
      const a = await get();
      const salt = newSalt();
      a.salt = b64(salt);
      a.iter = ITER;
      a.hash = await derive(pin, salt, ITER);
      await DB.putMeta(a);
    },

    // Código certo: grava o PIN novo e gera um código de recuperação novo (o antigo deixa de valer).
    async resetWithRecovery(code, pin) {
      const a = await get();
      if (waitOf(a)) return { waitMs: waitOf(a) };
      if (!same(await derive(normCode(code), unb64(a.recSalt), a.iter), a.recHash)) return fail(a);
      const salt = newSalt();
      const recSalt = newSalt();
      const novo = recoveryCode();
      Object.assign(a, {
        iter: ITER, salt: b64(salt), hash: await derive(pin, salt),
        recSalt: b64(recSalt), recHash: await derive(normCode(novo), recSalt),
        falhas: 0, bloqueadoAte: 0,
      });
      await DB.putMeta(a);
      return { code: novo };
    },
  };
})();
