/* Login local por e-mail e senha: hash PBKDF2 (WebCrypto) guardado no IndexedDB, código de recuperação
 * opcional (gerado em Ajustes, só quando a pessoa quiser) e bloqueio progressivo após tentativas erradas.
 * Protege o app contra acesso casual ao celular; não é autenticação em servidor (o e-mail só identifica
 * o colaborador, não é verificado). */
window.Auth = (() => {
  const ITER = 150000;
  const MAX_FALHAS = 5;
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const newSalt = () => crypto.getRandomValues(new Uint8Array(16));
  const normEmail = s => String(s || '').trim().toLowerCase();

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
  const verify = async (a, secret) => same(await derive(secret, unb64(a.salt), a.iter), a.hash);

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

  async function newPassword(a, senha) {
    const salt = newSalt();
    a.salt = b64(salt);
    a.iter = ITER;
    a.hash = await derive(senha, salt, ITER);
  }

  return {
    get,
    normEmail,
    validEmail: s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(s)),
    // Conta criada antes do login por e-mail (só PIN): precisa migrar uma vez.
    isLegacy: a => !!a && !a.email,
    hasRecovery: a => !!a?.recHash,

    // Cria a conta. Nenhum código é gerado ou mostrado aqui: ele é opcional (veja newRecoveryCode).
    async setup(email, senha) {
      const a = { key: 'auth', email: normEmail(email), falhas: 0, bloqueadoAte: 0, criadoEm: new Date().toISOString() };
      await newPassword(a, senha);
      await DB.putMeta(a);
    },

    // Confere e-mail e senha juntos (a mensagem de erro não diz qual dos dois está errado).
    async check(email, senha) {
      const a = await get();
      if (waitOf(a)) return { ok: false, waitMs: waitOf(a) };
      const senhaOk = await verify(a, senha);
      return senhaOk && normEmail(email) === a.email ? succeed(a) : fail(a);
    },

    // Só a senha (telas em que o e-mail já é conhecido, como "Trocar senha").
    async checkPassword(senha) {
      const a = await get();
      return this.check(a.email, senha);
    },

    // Troca o e-mail e/ou a senha (senha vazia = mantém a atual).
    async update({ email, senha }) {
      const a = await get();
      if (email) a.email = normEmail(email);
      if (senha) await newPassword(a, senha);
      await DB.putMeta(a);
      return a.email;
    },

    // Migração de quem já usava PIN: confere o PIN antigo e define e-mail e senha.
    // O código de recuperação que a conta já tinha continua valendo.
    async migrate(pin, email, senha) {
      const a = await get();
      if (waitOf(a)) return { ok: false, waitMs: waitOf(a) };
      if (!(await verify(a, pin))) return fail(a);
      a.email = normEmail(email);
      delete a.nome;
      await newPassword(a, senha);
      return succeed(a);
    },

    // ---- código de recuperação (opcional) ----
    // Pede a senha atual e gera um código novo, que substitui o anterior. Só o hash fica guardado;
    // o código em claro é devolvido uma única vez para quem pediu guardá-lo.
    async newRecoveryCode(senha) {
      const r = await this.checkPassword(senha);
      if (!r.ok) return r;
      const a = await get();
      const recSalt = newSalt();
      const code = recoveryCode();
      a.recSalt = b64(recSalt);
      a.recHash = await derive(normCode(code), recSalt);
      a.recCriadoEm = new Date().toISOString();
      await DB.putMeta(a);
      return { ok: true, code };
    },

    // Código certo: grava a senha nova (e o e-mail, se a conta antiga não tinha). O código usado deixa de valer.
    async resetWithRecovery(code, senha, email) {
      const a = await get();
      if (waitOf(a)) return { waitMs: waitOf(a) };
      if (!a.recHash || !same(await derive(normCode(code), unb64(a.recSalt), a.iter), a.recHash)) return fail(a);
      if (email) a.email = normEmail(email);
      await newPassword(a, senha);
      delete a.recSalt;
      delete a.recHash;
      delete a.recCriadoEm;
      a.falhas = 0;
      a.bloqueadoAte = 0;
      await DB.putMeta(a);
      return { ok: true };
    },
  };
})();
