/* Visitas de Obra — telas e lógica (SPA com rotas por hash, sem dependências). */
(() => {
  'use strict';

  const C = window.CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $('#view');

  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const INTERESSE = { quente: 'Quente', morno: 'Morno', frio: 'Frio' };

  // ---------- utilidades ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digits = s => String(s ?? '').replace(/\D/g, '');
  const pad = n => String(n).padStart(2, '0');
  const localDT = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = () => localDT().slice(0, 10);
  const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00'); d.setDate(d.getDate() + n); return localDT(d).slice(0, 10); };
  const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const fmtDT = s => (s ? `${fmtDate(s)} ${s.slice(11, 16)}` : '');
  const fmtISO = iso => (iso ? fmtDT(localDT(new Date(iso))) : '');
  const setPath = (o, p, val) => { const ks = p.split('.'); let t = o; ks.slice(0, -1).forEach(k => { t = t[k] ??= {}; }); t[ks[ks.length - 1]] = val; };
  const initials = n => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || '?';

  const phoneMask = v => {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  const cepMask = v => { const d = digits(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

  const waNumber = tel => { const d = digits(tel); return d.length === 10 || d.length === 11 ? '55' + d : d; };
  const waHref = (tel, text = '') => `https://wa.me/${waNumber(tel)}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  const telHref = tel => 'tel:' + digits(tel);

  const fullAddress = e => {
    if (!e) return '';
    const l1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
    return [l1, e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join(' - '), e.cep].filter(Boolean).join(', ');
  };
  const hasCoords = v => v.local && typeof v.local.lat === 'number';
  const placeOf = v => (hasCoords(v) ? `${v.local.lat},${v.local.lng}` : fullAddress(v.endereco));
  const mapsHref = v => {
    const q = placeOf(v);
    if (hasCoords(v) || (!v.mapsLink && q)) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    return v.mapsLink || '';
  };
  const routeHref = v => {
    const q = placeOf(v);
    if (hasCoords(v) || (!v.mapsLink && q)) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`;
    return v.mapsLink || '';
  };
  const firstContact = v => (v.contatos || []).find(c => c.nome || c.telefone) || null;
  const firstPhone = v => (v.contatos || []).find(c => digits(c.telefone).length >= 10) || null;
  const isPendingReturn = v => !v.draft && v.retorno && !C.statusEncerrados.includes(v.status);

  const toast = (msg, ms = 2800) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), ms);
  };

  // Confirmação dentro do app: o confirm() nativo é bloqueado em alguns navegadores e apps
  // (devolve "cancelar" sem mostrar nada), o que impedia excluir visitas.
  function askConfirm(msg, okLabel = 'Confirmar') {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'dialog-bg';
      ov.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-msg">
        <p id="dlg-msg">${esc(msg)}</p>
        <div class="dialog-btns">
          <button type="button" class="btn btn-ghost" data-r="0">Cancelar</button>
          <button type="button" class="btn btn-dark" data-r="1">${esc(okLabel)}</button>
        </div>
      </div>`;
      const close = r => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(r); };
      const onKey = e => { if (e.key === 'Escape') close(false); };
      ov.addEventListener('click', e => {
        const b = e.target.closest('[data-r]');
        if (b) close(b.dataset.r === '1');
        else if (e.target === ov) close(false);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(ov);
      ov.querySelector('[data-r="0"]').focus();
    });
  }

  let objectUrls = [];
  const blobUrl = b => { const u = URL.createObjectURL(b); objectUrls.push(u); return u; };

  async function getSettings() {
    return (await DB.getMeta('config')) || { key: 'config', colaborador: '', telefone: '', empresa: '' };
  }

  // ---------- ícones (traço, 24x24) ----------
  const ICONS = {
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checksq: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    back: '<polyline points="15 18 9 12 15 6"/>',
    next: '<polyline points="9 18 15 12 9 6"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    msg: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    gps: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  };
  const icon = (name, size = 20) =>
    `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------- estrutura (cabeçalho, abas) ----------
  const TABS = [
    ['#/', 'list', 'Visitas'],
    ['#/retornos', 'calendar', 'Retornos'],
    ['#/nova', 'plus', 'Nova'],
    ['#/checklist', 'checksq', 'Checklist'],
    ['#/config', 'sliders', 'Ajustes'],
  ];
  $('#tabbar').innerHTML = TABS.map(([href, ic, label]) => href === '#/nova'
    ? `<a class="tab tab-new" href="${href}" data-tab="${href}"><span class="bubble">${icon(ic, 26)}</span>${label}</a>`
    : `<a class="tab" href="${href}" data-tab="${href}">${icon(ic, 22)}${label}</a>`).join('');
  $('#btn-back').innerHTML = icon('back', 22);

  let backTarget = null;
  $('#btn-back').addEventListener('click', () => { if (backTarget) location.hash = backTarget; });

  function setHeader(title, back = null) {
    $('#title').textContent = title;
    document.title = title === C.appNome ? C.appNome : `${title} · ${C.appNome}`;
    backTarget = back;
    $('#btn-back').hidden = !back;
    $('#brand-dot').hidden = !!back;
  }

  function setTab(hash) {
    const base = hash.startsWith('#/visita') || hash.startsWith('#/editar') ? '#/' : hash;
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === base));
  }

  function applyColors() {
    const r = document.documentElement.style;
    Object.entries(C.cores).forEach(([k, v]) => r.setProperty('--' + k, v));
  }

  // ---------- roteador ----------
  let flushPending = null;
  const routes = [
    [/^#\/?$/, renderList],
    [/^#\/nova$/, () => renderForm(null)],
    [/^#\/editar\/(.+)$/, id => renderForm(id)],
    [/^#\/visita\/(.+)$/, renderDetail],
    [/^#\/retornos$/, renderRetornos],
    [/^#\/checklist$/, renderChecklist],
    [/^#\/config$/, renderConfig],
  ];

  async function router() {
    if (locked) return;
    if (flushPending) {
      const f = flushPending;
      flushPending = null;
      try { await f(); } catch (e) { console.error(e); }
    }
    document.body.classList.remove('form-mode');
    $$('.viewer, .actionbar, .dialog-bg').forEach(e => e.remove());
    objectUrls.forEach(u => URL.revokeObjectURL(u));
    objectUrls = [];

    const h = location.hash || '#/';
    for (const [re, fn] of routes) {
      const m = h.match(re);
      if (m) {
        setTab(h);
        try {
          await fn(m[1] ? decodeURIComponent(m[1]) : undefined);
        } catch (e) {
          console.error(e);
          view.innerHTML = `<div class="empty"><h3>Algo deu errado</h3><p>${esc(e.message)}</p></div>`;
        }
        window.scrollTo(0, 0);
        return;
      }
    }
    location.replace('#/');
  }

  function notFound() {
    setHeader('Não encontrado', '#/');
    view.innerHTML = `<div class="empty">${icon('search', 40)}<h3>Visita não encontrada</h3><p>Ela pode ter sido excluída.</p><a class="btn btn-blue" href="#/">Voltar para a lista</a></div>`;
  }

  // ---------- lista de visitas ----------
  const PAGE = 40; // cartões desenhados por vez: a lista cresce conforme o usuário rola
  const listState = { q: '', f: 'todas' };
  const FILTROS = [['todas', 'Todas'], ['quente', 'Quentes'], ['retorno', 'Com retorno'], ['fechado', 'Fechadas'], ['rascunho', 'Rascunhos']];
  const chipInteresse = k => (INTERESSE[k] ? `<span class="chip chip-${k}">${INTERESSE[k]}</span>` : '');

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });

  async function renderList() {
    setHeader(C.appNome);
    const visits = await DB.allVisits();
    visits.sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
    // texto de busca montado uma única vez por visita (não a cada tecla)
    visits.forEach(v => {
      v._hay = [v.obra?.nome, v.obra?.construtora, v.endereco?.bairro, v.endereco?.cidade, v.endereco?.logradouro,
        ...(v.contatos || []).flatMap(c => [c.nome, c.telefone])].join(' ').toLowerCase();
    });

    const t = today();
    const hoje = visits.filter(v => !v.draft && (v.visitDate || '').startsWith(t)).length;
    const due = visits.filter(v => isPendingReturn(v) && v.retorno <= t).length;
    const total = visits.filter(v => !v.draft).length;
    let showInstall = false;
    try { showInstall = !!deferredPrompt && localStorage.getItem('hideInstall') !== '1'; } catch { showInstall = !!deferredPrompt; }

    view.innerHTML = `
      ${showInstall ? `<div class="banner">${icon('download', 22)}<p><b>Instale o app</b> na tela inicial para usar como aplicativo, mesmo sem internet.</p><button class="btn btn-primary sm" id="b-inst">Instalar</button><button class="icon-btn" id="b-inst-x" aria-label="Fechar">${icon('x', 18)}</button></div>` : ''}
      <div class="stats">
        <div class="stat"><b>${hoje}</b><span>Visitas hoje</span></div>
        <a class="stat ${due ? 'alert' : ''}" href="#/retornos"><b>${due}</b><span>Retornos p/ hoje</span></a>
        <div class="stat"><b>${total}</b><span>Obras registradas</span></div>
      </div>
      <div class="search">${icon('search', 18)}<input id="q" type="search" placeholder="Buscar obra, contato, bairro…" value="${esc(listState.q)}" aria-label="Buscar"></div>
      <div class="filters" role="tablist">${FILTROS.map(([k, l]) => `<button class="pill ${listState.f === k ? 'on' : ''}" data-f="${k}" type="button">${l}</button>`).join('')}</div>
      <div id="list"></div>`;

    const matches = (v, q) => {
      if (q && !v._hay.includes(q)) return false;
      switch (listState.f) {
        case 'quente': return !v.draft && v.interesse === 'quente';
        case 'retorno': return isPendingReturn(v);
        case 'fechado': return !v.draft && v.status === 'Fechado';
        case 'rascunho': return !!v.draft;
        default: return true;
      }
    };

    const card = v => {
      const where = [v.endereco?.bairro, v.endereco?.cidade].filter(Boolean).join(', ');
      const sub = [v.obra?.construtora, where].filter(Boolean).join(' · ') || firstContact(v)?.nome || 'Sem endereço';
      return `<a class="card visit" data-id="${esc(v.id)}" href="${v.draft ? '#/editar/' : '#/visita/'}${v.id}">
        <div class="vthumb">${icon('home', 28)}</div>
        <div class="vbody">
          <div class="vtitle">${esc(v.obra?.nome || 'Obra sem nome')}</div>
          <div class="vsub">${esc(sub)}</div>
          <div class="vmeta">
            ${v.draft ? '<span class="chip chip-draft">Rascunho</span>' : chipInteresse(v.interesse)}
            <span>${fmtDT(v.visitDate)}</span>
            <span class="vcam" hidden></span>
            ${hasCoords(v) ? `<span>${icon('pin', 14)} GPS</span>` : ''}
          </div>
        </div>
      </a>`;
    };

    // Miniatura e contagem de fotos só dos cartões que acabaram de aparecer.
    // Fotos antigas (sem miniatura) ganham uma na primeira vez e ela fica salva.
    const hydrate = async els => {
      for (const el of els) {
        if (!el.isConnected) return;
        const id = el.dataset.id;
        const [p, n] = await Promise.all([DB.firstPhoto(id), DB.countPhotos(id)]);
        if (!el.isConnected) return;
        if (n) {
          const cam = el.querySelector('.vcam');
          cam.innerHTML = `${icon('camera', 14)} ${n}`;
          cam.hidden = false;
        }
        if (!p) continue;
        let th = p.thumb;
        if (!th) {
          try { th = await Photos.thumbOf(p.blob); await DB.putPhoto({ ...p, thumb: th }); } catch (e) { console.warn('miniatura', e); }
        }
        if (th && el.isConnected) el.querySelector('.vthumb').innerHTML = `<img src="${blobUrl(th)}" alt="" decoding="async">`;
      }
    };

    let items = [];
    let shown = 0;
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) paint(false); }, { rootMargin: '600px' })
      : null;

    function paint(reset) {
      const list = $('#list');
      if (!list) return; // saiu da tela antes do atraso da busca terminar
      if (reset) {
        const q = listState.q.trim().toLowerCase();
        items = visits.filter(v => matches(v, q));
        shown = 0;
        list.innerHTML = '';
      }
      $('#more')?.remove();
      if (!items.length) {
        list.innerHTML = visits.length
          ? `<div class="empty">${icon('search', 40)}<h3>Nada encontrado</h3><p>Tente outra busca ou filtro.</p></div>`
          : `<div class="empty">${icon('home', 44)}<h3>Nenhuma visita ainda</h3><p>Registre a primeira obra visitada: contato, endereço, GPS e fotos.</p><a class="btn btn-primary" href="#/nova">${icon('plus')} Nova visita</a></div>`;
        return;
      }
      const next = items.slice(shown, shown + PAGE);
      list.insertAdjacentHTML('beforeend', next.map(card).join(''));
      shown += next.length;
      hydrate([...list.querySelectorAll('.visit:not([data-h])')].map(el => { el.dataset.h = '1'; return el; }));
      if (shown < items.length) {
        list.insertAdjacentHTML('beforeend', `<button id="more" class="btn btn-ghost wide" type="button">Mostrar mais (${items.length - shown})</button>`);
        io?.observe($('#more'));
        $('#more').onclick = () => paint(false);
      }
    }
    paint(true);

    let qTimer = null;
    $('#q').addEventListener('input', e => {
      listState.q = e.target.value;
      clearTimeout(qTimer);
      qTimer = setTimeout(() => paint(true), 180);
    });
    $$('.pill').forEach(b => b.addEventListener('click', () => {
      listState.f = b.dataset.f;
      $$('.pill').forEach(x => x.classList.toggle('on', x === b));
      paint(true);
    }));
    if (showInstall) {
      $('#b-inst').onclick = async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('.banner')?.remove(); };
      $('#b-inst-x').onclick = () => { try { localStorage.setItem('hideInstall', '1'); } catch { /* sem armazenamento */ } $('.banner')?.remove(); };
    }
  }

  // ---------- formulário de visita ----------
  const fInput = (label, k, val, type = 'text', extra = '') =>
    `<label class="fld"><span>${label}</span><input type="${type}" data-k="${k}" value="${esc(val)}" ${extra}></label>`;
  const fSelect = (label, k, opts, val) => {
    const list = val && !opts.includes(val) ? [...opts, val] : opts;
    return `<label class="fld"><span>${label}</span><select data-k="${k}"><option value="">Selecione…</option>${list.map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  };
  const fText = (label, k, val, ph = '') =>
    `<label class="fld"><span>${label}</span><textarea data-k="${k}" placeholder="${esc(ph)}">${esc(val)}</textarea></label>`;

  const contatoHTML = (c = {}, i = 0) => `
    <div class="contato">
      <div class="contato-head"><strong>Contato ${i + 1}</strong>${i > 0 ? `<button type="button" class="icon-btn rm-contato" aria-label="Remover contato">${icon('x', 18)}</button>` : ''}</div>
      <label class="fld"><span>Nome</span><input data-c="nome" value="${esc(c.nome)}" autocomplete="off" autocapitalize="words"></label>
      <label class="fld"><span>Cargo / função</span><select data-c="cargo"><option value="">Selecione…</option>${C.cargos.concat(c.cargo && !C.cargos.includes(c.cargo) ? [c.cargo] : []).map(o => `<option${o === c.cargo ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
      <div class="grid2">
        <label class="fld"><span>Telefone / WhatsApp</span><input type="tel" inputmode="tel" data-c="telefone" class="mask-phone" value="${esc(c.telefone)}" placeholder="(11) 98765-4321"></label>
        <label class="fld"><span>E-mail</span><input type="email" inputmode="email" data-c="email" value="${esc(c.email)}" autocapitalize="off"></label>
      </div>
    </div>`;

  const locHTML = v => {
    if (hasCoords(v)) {
      const origem = v.local.origem === 'link' ? 'Do link do Google Maps' : `GPS ±${v.local.accuracy} m`;
      return `<div class="locbox">${icon('pin', 24)}<div><b>${v.local.lat.toFixed(6)}, ${v.local.lng.toFixed(6)}</b><small>${origem} · ${fmtISO(v.local.capturedAt)}</small></div>
        <a class="icon-btn" href="${mapsHref(v)}" target="_blank" rel="noopener" aria-label="Ver no Google Maps">${icon('nav', 18)}</a>
        <button type="button" class="icon-btn" id="rm-loc" aria-label="Remover localização">${icon('x', 18)}</button></div>`;
    }
    if (v.mapsLink) {
      return `<div class="locbox">${icon('link', 24)}<div><b>Link do Google Maps salvo</b><small>${esc(v.mapsLink)}</small></div>
        <a class="icon-btn" href="${esc(v.mapsLink)}" target="_blank" rel="noopener" aria-label="Abrir link">${icon('nav', 18)}</a>
        <button type="button" class="icon-btn" id="rm-loc" aria-label="Remover link">${icon('x', 18)}</button></div>`;
    }
    return '<p class="muted small">Nenhuma localização salva. Na obra, toque em “Capturar localização GPS”.</p>';
  };

  function geoErr(err) {
    if (err.code === 1) return 'Permissão de localização negada. Libere a localização para este app nas configurações do navegador/celular.';
    if (err.code === 2) return 'Sinal de GPS indisponível. Ligue a localização do celular e tente em área aberta.';
    return 'O GPS demorou para responder. Tente novamente.';
  }

  // Acompanha o GPS por até 15 s e fica com a leitura mais precisa.
  function captureGPS(onUpdate) {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) { reject(new Error('Este aparelho/navegador não oferece GPS.')); return; }
      let best = null;
      let timer = null;
      let wid = null;
      const stop = () => { if (wid !== null) navigator.geolocation.clearWatch(wid); clearTimeout(timer); };
      const finish = () => { stop(); best ? resolve(best) : reject(new Error('Não foi possível obter a localização.')); };
      wid = navigator.geolocation.watchPosition(p => {
        const c = {
          lat: +p.coords.latitude.toFixed(6),
          lng: +p.coords.longitude.toFixed(6),
          accuracy: Math.round(p.coords.accuracy),
          capturedAt: new Date().toISOString(),
        };
        if (!best || c.accuracy < best.accuracy) { best = c; onUpdate?.(c); }
        if (c.accuracy <= 15) finish();
      }, err => {
        stop();
        best ? resolve(best) : reject(new Error(geoErr(err)));
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      timer = setTimeout(finish, 15000);
    });
  }

  function parseMapsLink(s) {
    let txt = String(s || '');
    try { txt = decodeURIComponent(txt); } catch { /* mantém original */ }
    const pats = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
    ];
    for (const p of pats) {
      const m = txt.match(p);
      if (m) {
        const lat = +m[1], lng = +m[2];
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
      }
    }
    return null;
  }

  async function renderForm(id) {
    let v = id ? await DB.getVisit(id) : null;
    if (id && !v) return notFound();
    const cfg = await getSettings();
    let exists = !!v;
    if (!v) {
      v = {
        id: DB.uid(), createdAt: new Date().toISOString(), visitDate: localDT(), draft: true,
        obra: {}, contatos: [{}], endereco: {}, local: null, mapsLink: '', materiais: [],
        interesse: 'morno', status: C.status[0], retorno: '', proximosPassos: '', observacoes: '', km: '',
        autor: cfg.colaborador || '',
      };
    }
    v.obra ??= {}; v.endereco ??= {};
    if (!v.contatos?.length) v.contatos = [{}];
    const photos = exists ? await DB.photosOf(v.id) : [];

    setHeader(v.draft ? 'Nova visita' : 'Editar visita', v.draft ? '#/' : `#/visita/${v.id}`);
    document.body.classList.add('form-mode');

    view.innerHTML = `
      <form id="f" novalidate autocomplete="off">
        <section class="sec">
          <h2>Obra</h2>
          ${fInput('Nome / identificação da obra *', 'obra.nome', v.obra.nome, 'text', 'placeholder="Ex.: Residencial Jardim das Flores" autocapitalize="words"')}
          ${fInput('Construtora / cliente', 'obra.construtora', v.obra.construtora, 'text', 'autocapitalize="words"')}
          <div class="grid2">${fSelect('Tipo', 'obra.tipo', C.tiposObra, v.obra.tipo)}${fSelect('Etapa atual', 'obra.etapa', C.etapas, v.obra.etapa)}</div>
          ${fInput('Data e hora da visita', 'visitDate', v.visitDate, 'datetime-local')}
        </section>

        <section class="sec">
          <h2>Contatos na obra</h2>
          <div id="contatos">${v.contatos.map(contatoHTML).join('')}</div>
          <button type="button" class="btn btn-ghost sm" id="add-contato">${icon('plus', 18)} Adicionar contato</button>
        </section>

        <section class="sec">
          <h2>Localização (GPS / Google Maps)</h2>
          <div id="loc">${locHTML(v)}</div>
          <button type="button" class="btn btn-blue wide" id="btn-gps">${icon('gps')} Capturar localização GPS</button>
          <p class="hint" id="gps-status"></p>
          <details class="sub">
            <summary>Colar link do Google Maps</summary>
            <div class="inline"><input id="maps-link" type="url" inputmode="url" placeholder="https://maps.google.com/…" value="${esc(v.mapsLink)}"><button type="button" class="btn btn-ghost sm" id="btn-link">Usar</button></div>
            <p class="hint">No Google Maps: toque no local → Compartilhar → Copiar link. Também aceita “-23.55, -46.63”.</p>
          </details>
        </section>

        <section class="sec">
          <h2>Endereço</h2>
          <div class="grid-cep">${fInput('CEP', 'endereco.cep', v.endereco.cep, 'text', 'inputmode="numeric" class="mask-cep" placeholder="00000-000"')}<button type="button" class="btn btn-ghost" id="btn-cep">Buscar</button></div>
          ${fInput('Rua / avenida', 'endereco.logradouro', v.endereco.logradouro)}
          <div class="grid2 grid-num">${fInput('Número', 'endereco.numero', v.endereco.numero, 'text', 'inputmode="numeric"')}${fInput('Complemento / lote', 'endereco.complemento', v.endereco.complemento)}</div>
          ${fInput('Bairro', 'endereco.bairro', v.endereco.bairro)}
          <div class="grid2 grid-uf">${fInput('Cidade', 'endereco.cidade', v.endereco.cidade)}${fSelect('UF', 'endereco.uf', UFS, v.endereco.uf)}</div>
          ${fInput('Ponto de referência', 'endereco.referencia', v.endereco.referencia, 'text', 'placeholder="Ex.: em frente à padaria"')}
          <button type="button" class="btn btn-ghost wide" id="btn-rev">${icon('pin', 18)} Preencher endereço pela localização</button>
        </section>

        <section class="sec">
          <h2>Fotos</h2>
          <div class="photo-actions">
            <label class="btn btn-primary">${icon('camera')} Tirar foto<input id="in-cam" class="vh" type="file" accept="image/*" capture="environment"></label>
            <label class="btn btn-ghost">${icon('image')} Galeria<input id="in-gal" class="vh" type="file" accept="image/*" multiple></label>
          </div>
          <label class="fld"><span>Categoria da próxima foto</span><select id="foto-cat">${C.categoriasFoto.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
          <div class="gallery" id="gallery"></div>
          ${C.foto.carimbo ? '<p class="hint">As fotos recebem carimbo de data/hora, GPS e nome da obra.</p>' : ''}
        </section>

        <section class="sec">
          <h2>Material de marketing entregue</h2>
          <div class="checks">${C.materiaisMkt.map(m => `<label><input type="checkbox" name="mat" value="${esc(m)}"${(v.materiais || []).includes(m) ? ' checked' : ''}><span>${esc(m)}</span></label>`).join('')}</div>
        </section>

        <section class="sec">
          <h2>Resultado da visita</h2>
          <div class="fld"><span>Interesse</span>
            <div class="seg">${Object.entries(INTERESSE).map(([k, l]) => `<label><input type="radio" name="interesse" value="${k}"${v.interesse === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
          </div>
          ${fSelect('Status', 'status', C.status, v.status)}
          ${fInput('Data de retorno (follow-up)', 'retorno', v.retorno, 'date')}
          ${fText('Próximos passos', 'proximosPassos', v.proximosPassos, 'Ex.: enviar orçamento de 200 m² até sexta')}
          ${fText('Observações', 'observacoes', v.observacoes, 'Concorrentes na obra, prazo de compra, necessidades…')}
          ${fInput('KM do veículo na chegada (opcional)', 'km', v.km, 'number', 'inputmode="numeric" min="0"')}
        </section>
      </form>`;

    const bar = document.createElement('div');
    bar.className = 'actionbar';
    bar.innerHTML = `<span class="saved" id="saved">${exists ? 'Salvamento automático' : ''}</span>
      ${v.draft ? `<button type="button" class="btn btn-ghost sm" id="btn-discard">${icon('trash', 18)} Descartar</button>` : ''}
      <button type="button" class="btn btn-primary" id="btn-ok">${icon('check')} ${v.draft ? 'Concluir' : 'Salvar'}</button>`;
    document.body.appendChild(bar);

    const form = $('#f');
    const field = k => form.querySelector(`[data-k="${k}"]`);
    const setField = (k, val, onlyEmpty = false) => {
      const el = field(k);
      if (el && val && (!onlyEmpty || !el.value)) el.value = val;
    };

    const collect = () => {
      $$('[data-k]', form).forEach(el => setPath(v, el.dataset.k, el.value.trim()));
      v.contatos = $$('.contato', form).map(b => ({
        nome: $('[data-c="nome"]', b).value.trim(),
        cargo: $('[data-c="cargo"]', b).value,
        telefone: $('[data-c="telefone"]', b).value.trim(),
        email: $('[data-c="email"]', b).value.trim(),
      }));
      v.materiais = $$('input[name="mat"]:checked', form).map(i => i.value);
      v.interesse = $('input[name="interesse"]:checked', form)?.value || '';
    };

    let timer = null;
    const markSaved = s => { const el = $('#saved'); if (el) el.textContent = s; };
    const persist = async () => {
      clearTimeout(timer);
      timer = null;
      collect();
      await DB.putVisit(v);
      exists = true;
      markSaved(`Salvo às ${localDT().slice(11)}`);
      // Nova visita já salva: a URL passa a apontar para ela, para retomar o mesmo rascunho
      // se o app for bloqueado ou recarregado (ex.: celular fecha o navegador ao abrir a câmera).
      if (location.hash === '#/nova') history.replaceState(null, '', `#/editar/${v.id}`);
    };
    const schedule = () => { markSaved('Salvando…'); clearTimeout(timer); timer = setTimeout(persist, 600); };
    flushPending = () => (timer ? persist() : Promise.resolve());

    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'maps-link' || t.type === 'file') return;
      if (t.classList.contains('mask-phone')) t.value = phoneMask(t.value);
      if (t.classList.contains('mask-cep')) {
        t.value = cepMask(t.value);
        if (digits(t.value).length === 8 && t.dataset.looked !== t.value) { t.dataset.looked = t.value; lookupCEP(); }
      }
      schedule();
    });
    form.addEventListener('change', e => {
      if (e.target.id === 'maps-link' || e.target.id === 'foto-cat' || e.target.type === 'file') return;
      schedule();
    });

    // Contatos
    const renumber = () => $$('.contato strong', form).forEach((s, i) => { s.textContent = `Contato ${i + 1}`; });
    $('#add-contato').onclick = () => {
      const n = $$('.contato', form).length;
      $('#contatos').insertAdjacentHTML('beforeend', contatoHTML({}, n));
      $$('.contato', form)[n].querySelector('[data-c="nome"]').focus();
    };
    $('#contatos').addEventListener('click', e => {
      const b = e.target.closest('.rm-contato');
      if (!b) return;
      b.closest('.contato').remove();
      renumber();
      schedule();
    });

    // Localização
    const redrawLoc = () => { $('#loc').innerHTML = locHTML(v); };
    $('#loc').addEventListener('click', async e => {
      if (!e.target.closest('#rm-loc')) return;
      if (!(await askConfirm('Remover a localização salva?', 'Remover'))) return;
      v.local = null;
      v.mapsLink = '';
      $('#maps-link').value = '';
      redrawLoc();
      await persist();
    });

    $('#btn-gps').onclick = async () => {
      const btn = $('#btn-gps');
      const st = $('#gps-status');
      btn.disabled = true;
      st.textContent = 'Buscando sinal de GPS… mantenha o celular parado, de preferência em área aberta.';
      try {
        const loc = await captureGPS(c => { st.textContent = `Precisão atual: ±${c.accuracy} m — melhorando…`; });
        v.local = { ...loc, origem: 'gps' };
        redrawLoc();
        st.textContent = loc.accuracy > 50
          ? `Localização salva com precisão baixa (±${loc.accuracy} m). Se puder, vá para área aberta e capture de novo.`
          : `Localização salva (±${loc.accuracy} m).`;
        await persist();
        if (!field('endereco.logradouro').value) reverseFill(true);
      } catch (err) {
        st.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    };

    $('#btn-link').onclick = async () => {
      const s = $('#maps-link').value.trim();
      if (!s) { toast('Cole o link do Google Maps'); return; }
      const c = parseMapsLink(s);
      if (c) {
        v.local = { ...c, accuracy: null, capturedAt: new Date().toISOString(), origem: 'link' };
        v.mapsLink = /^https?:/i.test(s) ? s : '';
        toast('Localização obtida do link ✓');
      } else if (/^https?:\/\//i.test(s)) {
        v.mapsLink = s;
        toast('Link salvo. Links curtos (maps.app.goo.gl) não trazem coordenadas — use o GPS para precisão.', 5000);
      } else {
        toast('Não reconheci esse link ou coordenada.');
        return;
      }
      redrawLoc();
      await persist();
    };

    // Endereço
    async function lookupCEP() {
      const d = digits(field('endereco.cep').value);
      if (d.length !== 8) { toast('Digite os 8 números do CEP'); return; }
      try {
        const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
        const j = await r.json();
        if (j.erro) { toast('CEP não encontrado'); return; }
        setField('endereco.logradouro', j.logradouro);
        setField('endereco.bairro', j.bairro);
        setField('endereco.cidade', j.localidade);
        setField('endereco.uf', j.uf);
        schedule();
        toast('Endereço preenchido pelo CEP');
        field('endereco.numero').focus();
      } catch {
        toast('Sem internet para buscar o CEP. Preencha manualmente.');
      }
    }
    $('#btn-cep').onclick = lookupCEP;

    async function reverseFill(silent) {
      if (!hasCoords(v)) { if (!silent) toast('Capture a localização GPS primeiro'); return; }
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR&lat=${v.local.lat}&lon=${v.local.lng}`);
        const a = (await r.json()).address || {};
        setField('endereco.logradouro', a.road, true);
        setField('endereco.numero', a.house_number, true);
        setField('endereco.bairro', a.suburb || a.neighbourhood || a.quarter || a.city_district, true);
        setField('endereco.cidade', a.city || a.town || a.village || a.municipality, true);
        setField('endereco.uf', (a['ISO3166-2-lvl4'] || '').split('-')[1], true);
        setField('endereco.cep', a.postcode ? cepMask(a.postcode) : '', true);
        schedule();
        toast('Endereço preenchido pela localização — confira os dados');
      } catch {
        if (!silent) toast('Sem internet para buscar o endereço.');
      }
    }
    $('#btn-rev').onclick = () => reverseFill(false);

    // Fotos
    const drawGallery = () => {
      $('#gallery').innerHTML = photos.length
        ? photos.map((p, i) => `<div class="ph"><img src="${blobUrl(p.thumb || p.blob)}" data-i="${i}" alt="${esc(p.categoria)}" decoding="async"><span>${esc(p.categoria)}</span><button type="button" class="ph-del" data-id="${p.id}" aria-label="Excluir foto">${icon('x', 16)}</button></div>`).join('')
        : '<p class="muted small" style="grid-column:1/-1;margin:0">Nenhuma foto ainda.</p>';
    };
    drawGallery();

    async function addFiles(files) {
      if (!files.length) return;
      await persist(); // garante que a visita existe antes de vincular fotos
      let ok = 0;
      for (const f of files) {
        toast(files.length > 1 ? `Processando foto ${ok + 1} de ${files.length}…` : 'Processando foto…', 10000);
        const now = new Date();
        const lines = C.foto.carimbo ? [
          `${fmtDT(localDT(now))}${hasCoords(v) ? `  ·  ${v.local.lat.toFixed(5)}, ${v.local.lng.toFixed(5)}` : ''}`,
          [field('obra.nome').value.trim(), cfg.colaborador].filter(Boolean).join('  ·  '),
        ].filter(Boolean) : [];
        try {
          const { blob, thumb } = await Photos.process(f, lines);
          const p = {
            id: DB.uid(), visitId: v.id, blob, thumb, categoria: $('#foto-cat').value, createdAt: now.toISOString(),
            lat: hasCoords(v) ? v.local.lat : null, lng: hasCoords(v) ? v.local.lng : null,
          };
          await DB.putPhoto(p);
          photos.push(p);
          ok++;
        } catch (err) {
          console.error(err);
          toast('Não foi possível ler uma das imagens.');
        }
      }
      drawGallery();
      if (ok) toast(ok > 1 ? `${ok} fotos salvas ✓` : 'Foto salva ✓');
      if (ok && !hasCoords(v)) setTimeout(() => toast('Dica: capture o GPS para registrar o local exato da obra.', 4000), 2900);
    }
    ['#in-cam', '#in-gal'].forEach(sel => {
      $(sel).addEventListener('change', e => { const files = [...e.target.files]; e.target.value = ''; addFiles(files); });
    });
    $('#gallery').addEventListener('click', async e => {
      const del = e.target.closest('.ph-del');
      if (del) {
        if (!(await askConfirm('Excluir esta foto?', 'Excluir'))) return;
        await DB.deletePhoto(del.dataset.id);
        photos.splice(photos.findIndex(p => p.id === del.dataset.id), 1);
        drawGallery();
        return;
      }
      const img = e.target.closest('img[data-i]');
      if (img) openViewer(photos, +img.dataset.i);
    });

    // Ações
    $('#btn-ok').onclick = async () => {
      collect();
      if (!v.obra.nome && !v.contatos.some(c => c.nome)) {
        toast('Informe pelo menos o nome da obra ou de um contato.');
        field('obra.nome').focus();
        return;
      }
      const wasDraft = v.draft;
      v.draft = false;
      await persist();
      flushPending = null;
      toast(wasDraft ? 'Visita registrada ✓' : 'Alterações salvas ✓');
      location.replace(`#/visita/${v.id}`);
    };
    $('#btn-discard')?.addEventListener('click', async () => {
      if (!(await askConfirm('Descartar este rascunho e as fotos dele?', 'Descartar'))) return;
      clearTimeout(timer);
      timer = null;
      flushPending = null;
      if (exists) await DB.deleteVisit(v.id);
      location.replace('#/');
    });
  }

  // ---------- visualizador de fotos ----------
  function openViewer(photos, start) {
    let i = start;
    const ov = document.createElement('div');
    ov.className = 'viewer';
    ov.setAttribute('role', 'dialog');
    const draw = () => {
      const p = photos[i];
      ov.innerHTML = `<button class="icon-btn vclose" aria-label="Fechar">${icon('x', 24)}</button>
        <img src="${blobUrl(p.blob)}" alt="${esc(p.categoria)}">
        <div class="vcap">${esc(p.categoria)} · ${fmtISO(p.createdAt)} · ${i + 1}/${photos.length}</div>
        ${photos.length > 1 ? `<button class="icon-btn vnav vprev" aria-label="Anterior">${icon('back', 24)}</button><button class="icon-btn vnav vnext" aria-label="Próxima">${icon('next', 24)}</button>` : ''}`;
    };
    const go = d => { i = (i + d + photos.length) % photos.length; draw(); };
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    ov.addEventListener('click', e => {
      if (e.target.closest('.vclose') || e.target === ov) close();
      else if (e.target.closest('.vprev')) go(-1);
      else if (e.target.closest('.vnext')) go(1);
    });
    let x0 = null;
    ov.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    ov.addEventListener('touchend', e => {
      if (x0 === null || photos.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      x0 = null;
    });
    document.addEventListener('keydown', onKey);
    draw();
    document.body.appendChild(ov);
  }

  // ---------- relatório ----------
  function reportText(v, cfg) {
    const L = [];
    const e = v.endereco || {};
    L.push(`*Relatório de visita — ${cfg.empresa || C.empresa}*`);
    L.push(`📅 ${fmtDT(v.visitDate)}`);
    L.push('');
    L.push(`🏗️ *Obra:* ${v.obra?.nome || '-'}`);
    if (v.obra?.construtora) L.push(`Construtora/cliente: ${v.obra.construtora}`);
    if (v.obra?.tipo || v.obra?.etapa) L.push(`Tipo/etapa: ${[v.obra.tipo, v.obra.etapa].filter(Boolean).join(' · ')}`);
    (v.contatos || []).filter(c => c.nome || c.telefone || c.email).forEach(c => {
      L.push(`👤 ${[c.nome, c.cargo && `(${c.cargo})`].filter(Boolean).join(' ')}${c.telefone ? ` — ${c.telefone}` : ''}${c.email ? ` — ${c.email}` : ''}`);
    });
    const addr = fullAddress(e);
    if (addr) L.push(`📍 ${addr}${e.referencia ? ` (ref.: ${e.referencia})` : ''}`);
    const m = mapsHref(v);
    if (m) L.push(`🗺️ ${m}`);
    L.push('');
    L.push(`Interesse: ${INTERESSE[v.interesse] || '-'} · Status: ${v.status || '-'}`);
    if (v.retorno) L.push(`Retorno: ${fmtDate(v.retorno)}`);
    if (v.materiais?.length) L.push(`Material entregue: ${v.materiais.join(', ')}`);
    if (v.proximosPassos) L.push(`Próximos passos: ${v.proximosPassos}`);
    if (v.observacoes) L.push(`Obs.: ${v.observacoes}`);
    if (cfg.colaborador || v.autor) L.push('', `Registrado por: ${cfg.colaborador || v.autor}${cfg.telefone ? ` — ${cfg.telefone}` : ''}`);
    return L.join('\n');
  }

  const slug = s => (s || 'obra').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'obra';

  async function shareVisit(v, photos) {
    const cfg = await getSettings();
    const text = reportText(v, cfg);
    const title = `Visita: ${v.obra?.nome || 'obra'}`;
    const files = photos.slice(0, 10).map((p, i) => new File([p.blob], `${slug(v.obra?.nome)}-${i + 1}.jpg`, { type: 'image/jpeg' }));
    try {
      if (files.length && navigator.canShare?.({ files })) { await navigator.share({ title, text, files }); return; }
      if (navigator.share) { await navigator.share({ title, text }); return; }
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  // ---------- detalhe da visita ----------
  async function renderDetail(id) {
    const v = await DB.getVisit(id);
    if (!v) return notFound();
    if (v.draft) { location.replace(`#/editar/${id}`); return; }
    const photos = await DB.photosOf(id);
    const cfg = await getSettings();
    setHeader('Visita', '#/');

    const fp = firstPhone(v);
    const mh = mapsHref(v);
    const contatos = (v.contatos || []).filter(c => c.nome || c.telefone || c.email);
    const e = v.endereco || {};
    const addr = fullAddress(e);
    const act = (href, ic, label, ext = false) =>
      `<a class="act" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${icon(ic, 22)}<span>${label}</span></a>`;

    view.innerHTML = `
      <div class="card hero">
        <div class="hero-top"><h2>${esc(v.obra?.nome || 'Obra sem nome')}</h2>${chipInteresse(v.interesse)}</div>
        ${v.obra?.construtora ? `<p class="muted">${esc(v.obra.construtora)}</p>` : ''}
        <div class="tags">${[v.obra?.tipo, v.obra?.etapa, v.status].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <p class="muted small">${icon('calendar', 14)} Visita em ${fmtDT(v.visitDate)}${v.retorno ? ` · <b>Retorno ${fmtDate(v.retorno)}</b>` : ''}</p>
      </div>

      <div class="actions">
        ${fp ? act(telHref(fp.telefone), 'phone', 'Ligar') + act(waHref(fp.telefone), 'msg', 'WhatsApp', true) : ''}
        ${mh ? act(mh, 'pin', 'Mapa', true) + act(routeHref(v), 'nav', 'Rota', true) : ''}
        <button class="act hl" id="btn-share" type="button">${icon('share', 22)}<span>Relatório</span></button>
      </div>

      ${contatos.length ? `<section class="sec"><h2>Contatos</h2>${contatos.map(c => `
        <div class="contact">
          <div class="avatar">${esc(initials(c.nome))}</div>
          <div class="cinfo"><b>${esc(c.nome || 'Sem nome')}</b><small>${esc([c.cargo, c.telefone].filter(Boolean).join(' · '))}</small>${c.email ? `<small>${esc(c.email)}</small>` : ''}</div>
          <div class="cact">
            ${digits(c.telefone).length >= 10 ? `<a class="icon-btn" href="${telHref(c.telefone)}" aria-label="Ligar">${icon('phone', 18)}</a><a class="icon-btn wa" href="${waHref(c.telefone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('msg', 18)}</a>` : ''}
            ${c.email ? `<a class="icon-btn" href="mailto:${esc(c.email)}" aria-label="E-mail">${icon('mail', 18)}</a>` : ''}
          </div>
        </div>`).join('')}</section>` : ''}

      <section class="sec">
        <h2>Endereço e localização</h2>
        <dl class="kv">
          <dt>Endereço</dt><dd>${esc(addr || 'Não informado')}</dd>
          ${e.referencia ? `<dt>Referência</dt><dd>${esc(e.referencia)}</dd>` : ''}
          <dt>Localização</dt><dd>${hasCoords(v)
            ? `${v.local.lat.toFixed(6)}, ${v.local.lng.toFixed(6)} <span class="muted small">(${v.local.origem === 'link' ? 'link do Maps' : `GPS ±${v.local.accuracy} m`})</span>`
            : v.mapsLink ? `<a href="${esc(v.mapsLink)}" target="_blank" rel="noopener">Link do Google Maps</a>` : 'Não capturada'}</dd>
        </dl>
        ${hasCoords(v) ? `<iframe class="map-embed" loading="lazy" title="Mapa da obra" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${v.local.lat},${v.local.lng}&z=16&output=embed"></iframe>` : ''}
      </section>

      <section class="sec">
        <h2>Fotos (${photos.length})</h2>
        <div class="gallery" id="gallery">${photos.length
          ? photos.map((p, i) => `<div class="ph"><img src="${blobUrl(p.thumb || p.blob)}" data-i="${i}" alt="${esc(p.categoria)}" loading="lazy" decoding="async"><span>${esc(p.categoria)}</span></div>`).join('')
          : '<p class="muted small" style="grid-column:1/-1;margin:0">Nenhuma foto.</p>'}</div>
      </section>

      <section class="sec">
        <h2>Resultado</h2>
        <dl class="kv">
          <dt>Material de marketing entregue</dt><dd>${esc(v.materiais?.length ? v.materiais.join(', ') : 'Nenhum')}</dd>
          ${v.proximosPassos ? `<dt>Próximos passos</dt><dd>${esc(v.proximosPassos)}</dd>` : ''}
          ${v.observacoes ? `<dt>Observações</dt><dd>${esc(v.observacoes)}</dd>` : ''}
          ${v.km ? `<dt>KM do veículo</dt><dd>${esc(v.km)}</dd>` : ''}
          ${(v.autor || cfg.colaborador) ? `<dt>Registrado por</dt><dd>${esc(v.autor || cfg.colaborador)}</dd>` : ''}
        </dl>
      </section>

      <div class="btn-row">
        <a class="btn btn-blue" href="#/editar/${v.id}">${icon('edit', 18)} Editar</a>
        <button class="btn btn-ghost" id="btn-copy" type="button">${icon('copy', 18)} Copiar texto</button>
      </div>
      <button class="btn btn-ghost wide" id="btn-del" type="button" style="margin-top:10px;color:var(--cinza)">${icon('trash', 18)} Excluir visita</button>`;

    $('#btn-share').onclick = () => shareVisit(v, photos);
    $('#btn-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(reportText(v, cfg)); toast('Relatório copiado ✓'); }
      catch { toast('Não foi possível copiar neste navegador.'); }
    };
    $('#btn-del').onclick = async () => {
      if (!(await askConfirm(`Excluir a visita "${v.obra?.nome || 'sem nome'}" e ${photos.length} foto(s)? Essa ação não pode ser desfeita.`, 'Excluir'))) return;
      await DB.deleteVisit(v.id);
      toast('Visita excluída');
      location.replace('#/');
    };
    $('#gallery').addEventListener('click', e => {
      const img = e.target.closest('img[data-i]');
      if (img) openViewer(photos, +img.dataset.i);
    });
  }

  // ---------- retornos (follow-up) ----------
  const calHref = v => {
    const c = firstContact(v);
    const details = [c && [c.nome, c.cargo, c.telefone].filter(Boolean).join(' · '), v.proximosPassos].filter(Boolean).join('\n');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + `&text=${encodeURIComponent('Retorno: ' + (v.obra?.nome || 'obra'))}`
      + `&dates=${v.retorno.replace(/-/g, '')}/${addDays(v.retorno, 1).replace(/-/g, '')}`
      + `&details=${encodeURIComponent(details)}`
      + `&location=${encodeURIComponent(fullAddress(v.endereco) || placeOf(v))}`;
  };

  async function renderRetornos() {
    setHeader('Retornos');
    const visits = (await DB.allVisits()).filter(isPendingReturn).sort((a, b) => a.retorno.localeCompare(b.retorno));
    const LIM = 30; // retornos desenhados por grupo; o resto aparece em "Mostrar mais"
    const t = today();
    const wk = addDays(t, 7);
    const groups = [
      ['Atrasados', visits.filter(v => v.retorno < t), true],
      ['Hoje', visits.filter(v => v.retorno === t), false],
      ['Próximos 7 dias', visits.filter(v => v.retorno > t && v.retorno <= wk), false],
      ['Mais adiante', visits.filter(v => v.retorno > wk), false],
    ].filter(g => g[1].length);

    const stops = visits.filter(v => v.retorno <= t).map(placeOf).filter(Boolean).slice(0, 10);
    let rota = '';
    if (stops.length) {
      const dest = stops[stops.length - 1];
      const wps = stops.slice(0, -1);
      rota = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${wps.length ? '&waypoints=' + encodeURIComponent(wps.join('|')) : ''}&travelmode=driving`;
    }

    const item = (v, late) => {
      const c = firstContact(v);
      const fp = firstPhone(v);
      const [y, m, d] = v.retorno.split('-');
      return `<div class="card ret">
        <a class="ret-top" href="#/visita/${v.id}">
          <div class="ret-date ${late ? 'late' : ''}">${d}/${m}<small>${y}</small></div>
          <div class="vbody">
            <div class="vtitle">${esc(v.obra?.nome || 'Obra sem nome')}</div>
            <div class="vsub">${esc([c?.nome, c?.cargo].filter(Boolean).join(' · ') || 'Sem contato')}</div>
            ${v.proximosPassos ? `<div class="vsub">${esc(v.proximosPassos)}</div>` : ''}
          </div>
        </a>
        <div class="mini">
          ${fp ? `<a class="icon-btn" href="${telHref(fp.telefone)}" aria-label="Ligar">${icon('phone', 18)}</a><a class="icon-btn wa" href="${waHref(fp.telefone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('msg', 18)}</a>` : ''}
          ${placeOf(v) || v.mapsLink ? `<a class="icon-btn" href="${esc(routeHref(v))}" target="_blank" rel="noopener" aria-label="Rota">${icon('nav', 18)}</a>` : ''}
          <a class="btn btn-ghost sm" href="${calHref(v)}" target="_blank" rel="noopener">${icon('calendar', 16)} Google Agenda</a>
        </div>
      </div>`;
    };

    view.innerHTML = visits.length ? `
      ${rota ? `<a class="btn btn-primary wide" href="${rota}" target="_blank" rel="noopener" style="margin-bottom:6px">${icon('nav')} Rota de hoje no Google Maps (${stops.length} ${stops.length > 1 ? 'paradas' : 'parada'})</a>` : ''}
      ${groups.map(([title, list, late], gi) => `<div class="group-title">${title} (${list.length})</div>
        <div data-grp="${gi}">${list.slice(0, LIM).map(v => item(v, late)).join('')}</div>
        ${list.length > LIM ? `<button class="btn btn-ghost wide" type="button" data-more="${gi}">Mostrar mais (${list.length - LIM})</button>` : ''}`).join('')}`
      : `<div class="empty">${icon('calendar', 44)}<h3>Nenhum retorno agendado</h3><p>Ao registrar uma visita, preencha a “Data de retorno” para ela aparecer aqui.</p></div>`;

    $$('[data-more]', view).forEach(b => {
      b.onclick = () => {
        const [, list, late] = groups[+b.dataset.more];
        $(`[data-grp="${b.dataset.more}"]`).insertAdjacentHTML('beforeend', list.slice(LIM).map(v => item(v, late)).join(''));
        b.remove();
      };
    });
  }

  // ---------- checklist diário ----------
  async function renderChecklist() {
    setHeader('Checklist de saída');
    const t = today();
    const dia = (await DB.getDia(t)) || { data: t, checks: {}, kmInicial: '', kmFinal: '' };
    const total = C.checklist.reduce((n, g) => n + g.itens.length, 0);
    const keyOf = (g, i) => `${g}|${i}`;

    view.innerHTML = `<div id="ck">
      <section class="sec">
        <h2>Antes de sair — ${fmtDate(t)}</h2>
        <div class="progress"><i id="prog"></i></div>
        <p class="hint" id="prog-txt"></p>
      </section>
      ${C.checklist.map(g => `<section class="sec"><h2>${esc(g.grupo)}</h2>${g.itens.map(it => {
        const k = keyOf(g.grupo, it);
        return `<label class="check-row${dia.checks[k] ? ' done' : ''}"><input type="checkbox" data-k="${esc(k)}"${dia.checks[k] ? ' checked' : ''}><span>${esc(it)}</span></label>`;
      }).join('')}</section>`).join('')}
      <section class="sec">
        <h2>Quilometragem do dia</h2>
        <div class="grid2">
          <label class="fld"><span>KM inicial</span><input type="number" inputmode="numeric" min="0" id="km-i" value="${esc(dia.kmInicial)}"></label>
          <label class="fld"><span>KM final</span><input type="number" inputmode="numeric" min="0" id="km-f" value="${esc(dia.kmFinal)}"></label>
        </div>
        <p class="hint" id="km-total"></p>
      </section>
      <button class="btn btn-ghost wide" id="ck-reset" type="button">Desmarcar tudo</button></div>`;

    const update = () => {
      const n = Object.values(dia.checks).filter(Boolean).length;
      $('#prog').style.width = `${Math.round((n / total) * 100)}%`;
      $('#prog-txt').textContent = n === total ? 'Tudo pronto! Boa rota. ✓' : `${n} de ${total} itens conferidos`;
      const ki = +dia.kmInicial, kf = +dia.kmFinal;
      $('#km-total').textContent = dia.kmInicial && dia.kmFinal && kf >= ki ? `Rodados hoje: ${kf - ki} km` : 'Anote o hodômetro na saída e na volta.';
    };
    update();

    $('#ck').addEventListener('change', async e => {
      const k = e.target.dataset?.k;
      if (k) {
        dia.checks[k] = e.target.checked;
        e.target.closest('.check-row').classList.toggle('done', e.target.checked);
      } else if (e.target.id === 'km-i') dia.kmInicial = e.target.value;
      else if (e.target.id === 'km-f') dia.kmFinal = e.target.value;
      else return;
      update();
      await DB.putDia(dia);
    });
    $('#ck-reset').onclick = async () => {
      dia.checks = {};
      $$('.check-row input', view).forEach(i => { i.checked = false; i.closest('.check-row').classList.remove('done'); });
      update();
      await DB.putDia(dia);
    };
  }

  // ---------- ajustes, exportação e backup ----------
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  async function saveFile(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    const mobile = matchMedia('(pointer: coarse)').matches;
    if (mobile && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
    }
    download(blob, name);
    return true;
  }

  // Monta cabeçalho e linhas uma vez; a mesma tabela vira Excel (.xlsx) ou CSV.
  // Números (latitude, KM, nº de fotos…) vão como número, o resto como texto.
  async function montarPlanilha() {
    const [visits, count] = await Promise.all([DB.allVisits(), DB.photoCounts()]);
    const head = ['Data da visita', 'Status', 'Interesse', 'Obra', 'Construtora/cliente', 'Tipo', 'Etapa', 'Contato', 'Cargo', 'Telefone', 'E-mail',
      'Outros contatos', 'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'Referência', 'Latitude', 'Longitude',
      'Precisão GPS (m)', 'Google Maps', 'Material entregue', 'Retorno', 'Próximos passos', 'Observações', 'KM', 'Fotos', 'Registrado por'];
    const rows = visits.filter(v => !v.draft).sort((a, b) => (a.visitDate || '').localeCompare(b.visitDate || '')).map(v => {
      const cs = (v.contatos || []).filter(c => c.nome || c.telefone || c.email);
      const c = cs[0] || {};
      const e = v.endereco || {};
      const km = String(v.km ?? '').trim();
      return [fmtDT(v.visitDate), v.status, INTERESSE[v.interesse] || '', v.obra?.nome, v.obra?.construtora, v.obra?.tipo, v.obra?.etapa,
        c.nome, c.cargo, c.telefone, c.email, cs.slice(1).map(x => [x.nome, x.cargo, x.telefone, x.email].filter(Boolean).join(' / ')).join(' | '),
        e.cep, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.referencia,
        hasCoords(v) ? v.local.lat : '', hasCoords(v) ? v.local.lng : '',
        v.local?.accuracy ?? '', mapsHref(v), (v.materiais || []).join(', '), fmtDate(v.retorno), v.proximosPassos, v.observacoes,
        km !== '' && Number.isFinite(+km) ? +km : km, count.get(v.id) || 0, v.autor];
    });
    return { head, rows };
  }

  // Planilha em Excel (.xlsx): a codificação vai dentro do arquivo, então os acentos saem certos em qualquer programa.
  async function exportXlsx() {
    const { head, rows } = await montarPlanilha();
    const blob = await Xlsx.build(head, rows, { nome: 'Visitas' });
    const entregue = await saveFile(blob, `visitas-obra-${today()}.xlsx`);
    if (entregue) toast(`${rows.length} visita(s) exportada(s) em Excel`);
  }

  // CSV para quem precisa dele em outros programas. Atenção: alguns visualizadores de celular não reconhecem
  // UTF-8 e mostram os acentos quebrados; prefira o Excel (.xlsx).
  async function exportCSV() {
    const { head, rows } = await montarPlanilha();
    const q = v => `"${String(typeof v === 'number' ? String(v).replace('.', ',') : v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\r\n');
    const entregue = await saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `visitas-obra-${today()}.csv`);
    if (entregue) toast(`${rows.length} visita(s) exportada(s) em CSV`);
  }

  // Backup em ZIP: dados.json + fotos/*.jpg. As fotos entram como Blob (sem copiar para a memória),
  // então o uso de memória fica baixo mesmo com milhares de fotos. "Só novidades" leva apenas o que
  // foi criado ou alterado desde o último backup.
  async function exportBackup(somenteNovidades) {
    const inicio = new Date().toISOString();
    const ultimo = (await DB.getMeta('backup'))?.ultimo || null;
    const desde = somenteNovidades ? ultimo : null;
    toast('Gerando backup…', 60000);
    const [todasVisitas, todasFotos, dias, config] = await Promise.all([DB.allVisits(), DB.allPhotos(), DB.allDias(), DB.getMeta('config')]);
    const visits = desde ? todasVisitas.filter(v => (v.updatedAt || v.createdAt || '') > desde) : todasVisitas;
    const photos = desde ? todasFotos.filter(p => p.createdAt > desde) : todasFotos;
    const dados = {
      app: 'visitas-obra', formato: 2, versao: C.versao, exportadoEm: inicio, incremental: !!desde, desde,
      visits, dias, config: config || null,
      photos: photos.map(({ blob, thumb, ...meta }) => ({ ...meta, arquivo: `fotos/${meta.id}.jpg` })),
    };
    const zip = await Zip.build([
      { name: 'dados.json', data: JSON.stringify(dados) },
      ...photos.map(p => ({ name: `fotos/${p.id}.jpg`, data: p.blob })),
    ]);
    const entregue = await saveFile(zip, `backup-${desde ? 'novidades' : 'visitas'}-${today()}.zip`);
    if (!entregue) { toast('Backup cancelado.'); return; }
    await DB.putMeta({ key: 'backup', ultimo: inicio });
    toast(`Backup ${desde ? 'das novidades' : 'completo'}: ${visits.length} visita(s), ${photos.length} foto(s), ${(zip.size / 1048576).toFixed(1)} MB ✓`, 5000);
    if (view.querySelector('#bk-info')) renderConfig();
  }

  async function importBackup(file) {
    const isZip = new Uint8Array(await file.slice(0, 2).arrayBuffer()).join() === '80,75'; // "PK"
    if (isZip) return importZip(file);
    return importJsonAntigo(file);
  }

  async function importZip(file) {
    const z = await Zip.read(file);
    if (!z.has('dados.json')) throw new Error('Este ZIP não é um backup do app.');
    const data = JSON.parse(await (await z.blob('dados.json')).text());
    if (data.app !== 'visitas-obra' || !Array.isArray(data.visits)) throw new Error('Este arquivo não é um backup do app.');
    for (const v of data.visits) await DB.putVisit(v, true);
    let fotos = 0;
    for (const p of data.photos || []) {
      const blob = await z.blob(p.arquivo, 'image/jpeg');
      if (!blob) continue;
      const { arquivo, ...meta } = p;
      await DB.putPhoto({ ...meta, blob });
      if (++fotos % 25 === 0) toast(`Restaurando fotos… ${fotos} de ${data.photos.length}`, 4000);
    }
    for (const d of data.dias || []) await DB.putDia(d);
    if (data.config) await DB.putMeta(data.config);
    return { visitas: data.visits.length, fotos };
  }

  // Formato anterior (JSON com fotos em base64): continua podendo ser restaurado.
  async function importJsonAntigo(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { throw new Error('Este arquivo não é um backup do app.'); }
    if (data.app !== 'visitas-obra' || !Array.isArray(data.visits)) throw new Error('Este arquivo não é um backup do app.');
    for (const v of data.visits) await DB.putVisit(v, true);
    let fotos = 0;
    for (const p of data.photos || []) {
      const { data: d, ...meta } = p;
      await DB.putPhoto({ ...meta, blob: await Photos.fromDataURL(d) });
      fotos++;
    }
    for (const d of data.dias || []) await DB.putDia(d);
    if (data.config) await DB.putMeta(data.config);
    return { visitas: data.visits.length, fotos };
  }

  async function renderConfig() {
    setHeader('Ajustes');
    const cfg = await getSettings();
    const auth = await Auth.get();
    const bk = await DB.getMeta('backup');
    let uso = '';
    try {
      const est = await navigator.storage?.estimate?.();
      if (est) uso = `Espaço usado pelo app: ${(est.usage / 1048576).toFixed(1)} MB`;
    } catch { /* indisponível */ }
    // Pronto para uso sem internet = service worker no controle + arquivos do app guardados no cache.
    let guardados = 0;
    try {
      const nomes = (await caches.keys()).filter(k => k.startsWith('visitas-obra-'));
      for (const n of nomes) guardados += (await (await caches.open(n)).keys()).length;
    } catch { /* cache indisponível (navegação privada, file://) */ }
    const offlineOk = !!navigator.serviceWorker?.controller && guardados > 0;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    view.innerHTML = `
      <section class="sec">
        <h2>Colaborador</h2>
        ${fInput('Seu nome (vai nos relatórios e fotos)', 'colaborador', cfg.colaborador, 'text', 'autocapitalize="words"')}
        ${fInput('Seu telefone', 'telefone', cfg.telefone, 'tel', 'inputmode="tel" class="mask-phone"')}
        ${fInput('Nome da empresa (cabeçalho do relatório)', 'empresa', cfg.empresa, 'text', `placeholder="${esc(C.empresa)}"`)}
        <p class="hint" id="cfg-saved"></p>
      </section>

      <section class="sec">
        <h2>Acesso</h2>
        <p class="small muted">Entrou como <b>${esc(auth?.email || '')}</b>. O app fica conectado neste celular até você tocar em <b>Sair</b>.</p>
        <div class="btn-row">
          <button class="btn btn-ghost" id="btn-pin" type="button">${icon('edit', 18)} E-mail / senha</button>
          <button class="btn btn-dark" id="btn-lock" type="button">${icon('lock', 18)} Sair</button>
        </div>
        <button class="btn btn-ghost wide" id="btn-rec" type="button" style="margin-top:10px">${icon('lock', 18)} ${Auth.hasRecovery(auth) ? 'Gerar novo código de recuperação' : 'Gerar código de recuperação'}</button>
        <p class="hint">${Auth.hasRecovery(auth)
          ? 'Já existe um código de recuperação guardado. Gerar outro invalida o anterior.'
          : 'Opcional: o código permite criar uma senha nova se você esquecer a atual. Sem ele, a recuperação é apagar os dados e restaurar um backup.'}</p>
      </section>

      <section class="sec">
        <h2>${standalone ? 'Uso sem internet' : 'Instalar no celular'}</h2>
        <p class="small" id="offline-st">${offlineOk
          ? `<b style="color:var(--azul)">✓ Pronto para usar sem internet</b> (${guardados} arquivos do app guardados neste celular). Só a busca de CEP, o endereço pelo GPS e os mapas precisam de sinal.`
          : '<b>Ainda não está pronto para usar sem internet.</b> Abra o app uma vez com internet e volte aqui.'}</p>
        ${standalone ? '' : deferredPrompt ? `<button class="btn btn-primary wide" id="btn-install" type="button">${icon('download')} Instalar app</button>`
          : ios ? '<p>No iPhone (Safari): toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.</p>'
            : '<p>No Android (Chrome): toque no menu <b>⋮</b> → <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>'}
      </section>

      <section class="sec">
        <h2>Dados e backup</h2>
        <p class="small muted">Os dados ficam guardados neste celular e funcionam sem internet. Faça backup toda semana e envie para o gestor ou para o Google Drive. O backup é um arquivo ZIP: as fotos ficam dentro e abrem em qualquer computador.</p>
        <div class="stack">
          <button class="btn btn-blue wide" id="btn-xlsx" type="button">${icon('download')} Exportar planilha (Excel)</button>
          <button class="btn btn-ghost wide" id="btn-csv" type="button">${icon('download')} Exportar CSV (outros programas)</button>
          <button class="btn btn-ghost wide" id="btn-bkp" type="button">${icon('download')} Backup completo (ZIP com fotos)</button>
          ${bk?.ultimo ? `<button class="btn btn-ghost wide" id="btn-bkp2" type="button">${icon('download')} Backup só das novidades (menor)</button>` : ''}
          <label class="btn btn-ghost wide">${icon('upload')} Restaurar backup<input id="in-bkp" class="vh" type="file" accept=".zip,application/zip,.json,application/json"></label>
        </div>
        <p class="hint" id="bk-info">${bk?.ultimo ? `Último backup: ${fmtISO(bk.ultimo)}. “Só das novidades” leva o que mudou depois disso; guarde os backups anteriores.` : 'Nenhum backup feito ainda neste celular.'}</p>
        ${uso ? `<p class="hint">${uso}</p>` : ''}
      </section>

      <section class="sec">
        <h2>Sobre</h2>
        <p class="small muted">${esc(C.appNome)} · versão ${esc(C.versao)}<br>Busca de CEP: ViaCEP · Endereço pelo GPS: OpenStreetMap · Mapas e rotas: Google Maps.</p>
        <button class="btn btn-ghost wide" id="btn-wipe" type="button" style="color:var(--cinza)">${icon('trash', 18)} Apagar todos os dados deste celular</button>
      </section>`;

    let t = null;
    $$('[data-k]', view).forEach(el => el.addEventListener('input', () => {
      if (el.classList.contains('mask-phone')) el.value = phoneMask(el.value);
      clearTimeout(t);
      t = setTimeout(async () => {
        $$('[data-k]', view).forEach(i => { cfg[i.dataset.k] = i.value.trim(); });
        await DB.putMeta(cfg);
        $('#cfg-saved').textContent = 'Salvo ✓';
      }, 500);
    }));

    $('#btn-install')?.addEventListener('click', async () => {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      renderConfig();
    });
    $('#btn-pin').onclick = () => showLock('change');
    $('#btn-lock').onclick = () => lock();
    $('#btn-rec').onclick = () => showLock('gerar');
    $('#btn-xlsx').onclick = () => exportXlsx().catch(e => toast('Erro ao exportar: ' + e.message));
    $('#btn-csv').onclick = () => exportCSV().catch(e => toast('Erro ao exportar: ' + e.message));
    $('#btn-bkp').onclick = () => exportBackup(false).catch(e => toast('Erro no backup: ' + e.message));
    $('#btn-bkp2')?.addEventListener('click', () => exportBackup(true).catch(e => toast('Erro no backup: ' + e.message)));
    $('#in-bkp').onchange = async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f || !(await askConfirm('Restaurar este backup? Visitas com o mesmo código serão substituídas.', 'Restaurar'))) return;
      try { const r = await importBackup(f); toast(`${r.visitas} visita(s) e ${r.fotos} foto(s) restauradas ✓`, 5000); }
      catch (err) { console.error(err); toast(err.message, 6000); }
    };
    $('#btn-wipe').onclick = async () => {
      if (!(await askConfirm('Apagar TODAS as visitas, fotos e ajustes deste celular?', 'Apagar tudo'))) return;
      if (!(await askConfirm('Tem certeza? Faça um backup antes. Essa ação não pode ser desfeita.', 'Sim, apagar'))) return;
      await DB.clearAll(); // inclui o acesso: o próximo uso volta ao primeiro acesso
      history.replaceState(null, '', '#/');
      lock();
    };
  }

  // ---------- login (e-mail e senha neste aparelho) ----------
  // Depois do primeiro login o app continua conectado neste celular até o colaborador tocar em "Sair".
  // Nenhuma tela de código aparece no cadastro nem no login: o código de recuperação é opcional e
  // só é gerado quando a pessoa pede, em Ajustes.
  let locked = true;
  const waitText = ms => (ms >= 60000 ? `${Math.ceil(ms / 60000)} min` : `${Math.ceil(ms / 1000)} s`);
  const nomeDoEmail = e => String(e).split('@')[0].split(/[._+-]+/).filter(Boolean).map(s => s[0].toUpperCase() + s.slice(1)).join(' ');
  const SENHAS_FRACAS = new Set(['123456', '1234567', '12345678', '123456789', '111111', '000000', 'senha1', 'senha123', 'password', 'qwerty', 'abcdef', 'abc123']);
  const getSession = () => { try { return localStorage.getItem('sessao'); } catch { return null; } };
  const setSession = v => {
    try { if (v) localStorage.setItem('sessao', v); else localStorage.removeItem('sessao'); } catch { /* sem armazenamento: pede login ao reabrir */ }
  };

  async function lock() {
    if (locked) return;
    locked = true;
    if (flushPending) {
      const f = flushPending;
      flushPending = null;
      try { await f(); } catch (e) { console.error(e); }
    }
    setSession(null);
    $$('.viewer, .actionbar, .dialog-bg').forEach(e => e.remove());
    document.body.classList.remove('form-mode');
    view.innerHTML = '';
    objectUrls.forEach(u => URL.revokeObjectURL(u));
    objectUrls = [];
    showLock();
  }

  async function unlock() {
    const a = await Auth.get();
    setSession(a?.email || null);
    $('#lock')?.remove();
    locked = false;
    router();
  }

  const lockCard = (title, sub, body) => `<div class="lock-card">
    <img class="lock-logo" src="icons/icon.svg" alt="">
    <h1>${esc(title)}</h1>
    <p class="lock-sub">${sub}</p>
    ${body}
  </div>`;

  const emailField = value =>
    `<label class="fld"><span>E-mail</span><input id="l-email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="nome@empresa.com" value="${esc(value || '')}"></label>`;
  const passField = (id, label, ac) =>
    `<label class="fld"><span>${label}</span><span class="pw"><input id="${id}" type="password" autocomplete="${ac}" autocapitalize="off" autocorrect="off" spellcheck="false"><button type="button" class="pw-toggle" data-for="${id}">Mostrar</button></span></label>`;

  async function showLock(mode) {
    const auth = await Auth.get();
    const cfg = await getSettings();
    const legacy = Auth.isLegacy(auth); // conta antiga, só com PIN
    const temCodigo = Auth.hasRecovery(auth);
    mode ??= !auth ? 'setup' : legacy ? 'migrate' : 'login';
    let el = $('#lock');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lock';
      el.className = 'lock';
      document.body.appendChild(el);
    }

    // links: lista de [destino, texto]
    const views = {
      setup: {
        sub: 'Primeiro acesso neste celular: informe seu e-mail e crie uma senha.',
        body: emailField('') + passField('l-pass', 'Crie uma senha (mínimo 6 caracteres)', 'new-password'),
        btn: 'Criar conta e entrar',
      },
      login: {
        sub: 'Entre com seu e-mail e senha.',
        body: emailField(auth?.email) + passField('l-pass', 'Senha', 'current-password'),
        btn: 'Entrar',
        links: [['recover', 'Esqueci a senha']],
      },
      recover: temCodigo ? {
        sub: 'Digite o código de recuperação que foi gerado em Ajustes e crie uma senha nova. As visitas não são apagadas.',
        body: '<label class="fld"><span>Código de recuperação</span><input id="l-code" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX"></label>'
          + (legacy ? emailField('') : '')
          + passField('l-pass', 'Nova senha (mínimo 6 caracteres)', 'new-password'),
        btn: 'Criar nova senha',
        links: [[legacy ? 'migrate' : 'login', 'Voltar']],
      } : {
        sub: 'Este celular não tem um código de recuperação. Sem ele, o único caminho é apagar os dados do app e restaurar um backup: as visitas e fotos só voltam se você tiver o arquivo de backup.',
        body: '<button type="button" class="btn btn-ghost wide" id="l-wipe">Apagar os dados deste celular</button>',
        links: [[legacy ? 'migrate' : 'login', 'Voltar']],
      },
      gerar: {
        sub: 'Gere um código de recuperação e guarde com o gestor. Ele permite criar uma senha nova se você esquecer a atual. Um código novo substitui o anterior e aparece uma única vez.',
        body: passField('l-old', 'Digite sua senha para continuar', 'current-password'),
        btn: 'Gerar código',
        links: [['cancel', 'Cancelar']],
      },
      change: {
        sub: 'Trocar o e-mail ou a senha deste celular.',
        body: emailField(auth?.email)
          + passField('l-old', 'Senha atual', 'current-password')
          + passField('l-pass', 'Nova senha (deixe em branco para manter)', 'new-password'),
        btn: 'Salvar',
        links: [['cancel', 'Cancelar']],
      },
      migrate: {
        sub: 'Atualização: o app agora usa e-mail e senha no lugar do PIN. Digite seu PIN atual e crie seu acesso.',
        body: passField('l-old', 'PIN atual', 'current-password')
          + emailField('')
          + passField('l-pass', 'Nova senha (mínimo 6 caracteres)', 'new-password'),
        btn: 'Atualizar e entrar',
        links: temCodigo ? [['recover', 'Esqueci o PIN']] : [],
      },
    };
    const vw = views[mode];
    el.innerHTML = lockCard(C.appNome, vw.sub, `
      <form id="lock-form" novalidate>
        ${vw.body}
        <p class="lock-err" id="lock-err" role="alert"></p>
        ${vw.btn ? `<button class="btn btn-primary wide" type="submit">${vw.btn}</button>` : ''}
      </form>
      ${(vw.links || []).map(([go, t]) => `<button type="button" class="lock-link" data-go="${go}">${t}</button>`).join('')}`);

    const val = id => $(`#${id}`, el)?.value.trim() || '';
    const raw = id => $(`#${id}`, el)?.value || ''; // senhas não são cortadas
    const err = m => { $('#lock-err', el).textContent = m; };
    const blockedMsg = ms => `Muitas tentativas erradas. Aguarde ${waitText(ms)} e tente de novo.`;
    const goodEmail = () => {
      const e = val('l-email');
      if (!Auth.validEmail(e)) { err('Digite um e-mail válido, como nome@empresa.com.'); return null; }
      return Auth.normEmail(e);
    };
    // opcional = true: campo vazio é aceito e devolve '' (mantém a senha atual)
    const goodPass = (opcional = false) => {
      const p = raw('l-pass');
      if (!p && opcional) return '';
      if (p.length < 6) { err('A senha deve ter pelo menos 6 caracteres.'); return null; }
      if (p.length > 64) { err('A senha pode ter no máximo 64 caracteres.'); return null; }
      if (/^(.)\1+$/s.test(p) || SENHAS_FRACAS.has(p.toLowerCase())) { err('Senha muito fácil. Escolha outra.'); return null; }
      return p;
    };
    // o nome que vai nos relatórios começa igual ao e-mail e pode ser mudado em Ajustes
    const nomePadrao = async email => {
      if (!cfg.colaborador) { cfg.colaborador = nomeDoEmail(email); await DB.putMeta(cfg); }
    };

    async function submit() {
      err('');
      if (mode === 'setup') {
        const email = goodEmail();
        if (!email) return;
        const p = goodPass();
        if (p === null) return;
        await Auth.setup(email, p);
        await nomePadrao(email);
        await unlock();
      } else if (mode === 'login') {
        const r = await Auth.check(val('l-email'), raw('l-pass'));
        if (r.ok) { await unlock(); return; }
        $('#l-pass', el).value = '';
        err(r.waitMs ? blockedMsg(r.waitMs) : `E-mail ou senha incorretos. Restam ${r.restantes} tentativa(s) antes de bloquear.`);
      } else if (mode === 'recover') {
        const email = legacy ? goodEmail() : null;
        if (legacy && !email) return;
        const p = goodPass();
        if (p === null) return;
        const r = await Auth.resetWithRecovery(val('l-code'), p, email);
        if (r.ok) {
          if (email) await nomePadrao(email);
          toast('Senha alterada ✓');
          await unlock();
          return;
        }
        err(r.waitMs ? blockedMsg(r.waitMs) : 'Código de recuperação incorreto.');
      } else if (mode === 'gerar') {
        const r = await Auth.newRecoveryCode(raw('l-old'));
        if (!r.ok) { err(r.waitMs ? blockedMsg(r.waitMs) : 'Senha incorreta.'); return; }
        showCode(r.code, auth.email);
      } else if (mode === 'change') {
        const email = goodEmail();
        if (!email) return;
        const nova = goodPass(true);
        if (nova === null) return;
        const r = await Auth.checkPassword(raw('l-old'));
        if (!r.ok) { err(r.waitMs ? blockedMsg(r.waitMs) : 'Senha atual incorreta.'); return; }
        setSession(await Auth.update({ email, senha: nova }));
        el.remove();
        toast('Acesso atualizado ✓');
        if (location.hash === '#/config') renderConfig();
      } else if (mode === 'migrate') {
        const email = goodEmail();
        if (!email) return;
        const p = goodPass();
        if (p === null) return;
        const r = await Auth.migrate(raw('l-old'), email, p);
        if (!r.ok) { err(r.waitMs ? blockedMsg(r.waitMs) : `PIN incorreto. Restam ${r.restantes} tentativa(s) antes de bloquear.`); return; }
        await nomePadrao(email);
        await unlock();
      }
    }

    $$('.pw-toggle', el).forEach(b => b.addEventListener('click', () => {
      const i = $(`#${b.dataset.for}`, el);
      const mostrar = i.type === 'password';
      i.type = mostrar ? 'text' : 'password';
      b.textContent = mostrar ? 'Ocultar' : 'Mostrar';
      i.focus();
    }));
    $$('[data-go]', el).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.go === 'cancel') el.remove(); else showLock(b.dataset.go);
    }));
    // sem senha e sem código: o único caminho é recomeçar (as visitas só voltam com um backup)
    $('#l-wipe', el)?.addEventListener('click', async () => {
      if (!(await askConfirm('Apagar TODAS as visitas, fotos e ajustes deste celular? As visitas só voltam se você tiver um arquivo de backup.', 'Apagar tudo'))) return;
      if (!(await askConfirm('Tem certeza? Essa ação não pode ser desfeita.', 'Sim, apagar'))) return;
      await DB.clearAll();
      setSession(null);
      history.replaceState(null, '', '#/');
      toast('Dados apagados');
      showLock('setup');
    });
    $('#lock-form', el).addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#lock-form button[type="submit"]', el);
      if (!btn) return;
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Verificando…';
      try { await submit(); } catch (ex) { console.error(ex); err('Erro: ' + ex.message); }
      finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
    });
    [...el.querySelectorAll('input')].find(i => !i.value)?.focus(); // com e-mail já preenchido, vai direto para a senha
  }

  // Mostra o código gerado em Ajustes (uma única vez) e fecha sem mexer na sessão.
  function showCode(code, email) {
    const el = $('#lock');
    const text = `Código de recuperação do app ${C.appNome} (${email}): ${code}`;
    el.innerHTML = lockCard('Código de recuperação',
      'Guarde este código com o gestor. Ele é a única forma de criar uma senha nova sem perder as visitas. Ele não aparece de novo.', `
      <div class="code-box">${esc(code)}</div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="c-copy" type="button">${icon('copy', 18)} Copiar</button>
        <button class="btn btn-ghost" id="c-share" type="button">${icon('share', 18)} Enviar</button>
      </div>
      <button class="btn btn-primary wide" id="c-go" type="button" style="margin-top:14px">Já guardei, fechar</button>`);
    $('#c-copy', el).onclick = async () => {
      try { await navigator.clipboard.writeText(code); $('#c-copy', el).textContent = 'Copiado ✓'; }
      catch { $('#c-copy', el).textContent = 'Anote à mão'; }
    };
    $('#c-share', el).onclick = async () => {
      try {
        if (navigator.share) { await navigator.share({ text }); return; }
      } catch (e) { if (e.name === 'AbortError') return; }
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    };
    $('#c-go', el).onclick = () => {
      el.remove();
      if (location.hash === '#/config') renderConfig();
    };
  }

  async function start() {
    const auth = await Auth.get();
    if (auth?.email && getSession() === auth.email) unlock(); // continua conectado
    else showLock();
  }

  // ---------- início ----------
  applyColors();
  window.addEventListener('hashchange', router);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW não registrado', err));
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  start();
})();
