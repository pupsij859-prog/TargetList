const KEY = 'target-list:v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

const ICONS = [
  'target','book','rocket','run','bulb','dumbbell','wallet','music','code','palette',
  'pen','leaf','heart','star','trophy','flag','fire','bike','camera','film',
  'flask','globe','moon','clock','chart','coffee','apple','chat','wrench','cap',
  'mountain','droplet','sun','bell','headphones','compass','shield','box'
];
const COLORS = ['#e9b87a','#9ac9a8','#8fb3d9','#b3a6d6','#dd9b86','#d99aa4','#7fc0bb','#c9c184'];

const icon = (name, cls = 'ic') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

let state = load();
let view = 'goals', filter = 'all', query = '', sortBy = 'new';
let editingId = null, modalMode = 'goal';
let draftSteps = [], draftIcon = 'target', draftColor = COLORS[0], draftType = 'checklist', draftLinks = [];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && Array.isArray(raw.goals)) {
      const dreams = Array.isArray(raw.dreams) ? raw.dreams : [];
      raw.goals.forEach(g => {                       /* миграция со старых версий */
        if (!g.icon || !ICONS.includes(g.icon)) g.icon = 'target';
        if (!COLORS.includes(g.color)) g.color = COLORS[0];
        if (g.dreamId === undefined) g.dreamId = null;
        if (g.dreamId && !dreams.some(d => d.id === g.dreamId)) g.dreamId = null;
        delete g.emoji;
      });
      dreams.forEach(d => {
        if (!d.icon || !ICONS.includes(d.icon)) d.icon = 'star';
        if (!COLORS.includes(d.color)) d.color = COLORS[3];
      });
      return { goals: raw.goals, dreams, activity: raw.activity || {}, mood: raw.mood || 0 };
    }
  } catch (e) {
   }
  return { goals: [], dreams: [], activity: {}, mood: 0 };
}
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

function bump(n = 1) {
  const d = today();
  state.activity[d] = (state.activity[d] || 0) + n;
}

function progress(g) {
  if (g.type === 'counter') return g.target > 0 ? Math.min(1, g.current / g.target) : 0;
  if (!g.steps.length) return g.manualDone ? 1 : 0;
  return g.steps.filter(s => s.done).length / g.steps.length;
}
const isDone = g => progress(g) >= 1;

const dreamGoals = d => state.goals.filter(g => g.dreamId === d.id);

function dreamProgress(d) {
  if (d.manualDone) return 1;
  const gs = dreamGoals(d);
  if (!gs.length) return 0;
  return gs.reduce((s, g) => s + progress(g), 0) / gs.length;
}
const dreamDone = d => dreamProgress(d) >= 1;

function daysLeft(item) {
  if (!item.deadline) return null;
  const a = new Date(item.deadline + 'T00:00:00'), b = new Date(today() + 'T00:00:00');
  return Math.round((a - b) / 86400000);
}

function streak() {
  let n = 0;
  const d = new Date();
  if (!state.activity[today()]) d.setDate(d.getDate() - 1);   /* сегодня ещё можно наверстать */
  while (state.activity[d.toISOString().slice(0, 10)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b, c) => [a, b, c][(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][Math.min(n % 10, 5)]];

const intro = $('#intro'), app = $('#app');
let entered = false;

function enter() {
  if (entered) return;
  entered = true;
  intro.classList.add('is-gone');
  intro.style.pointerEvents = 'auto';
  setTimeout(() => { intro.style.pointerEvents = 'none'; }, 350);
  document.body.classList.add('entered');
  setTimeout(() => { intro.style.display = 'none'; }, 1000);
  app.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => app.classList.add('is-live'));
  setTimeout(render, 120);
}
addEventListener('keydown', e => {
  if (!entered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); enter(); }
});
intro.addEventListener('click', enter);

function visibleGoals() {
  let list = state.goals.slice();
  if (filter === 'active') list = list.filter(g => !isDone(g));
  if (filter === 'done')   list = list.filter(g => isDone(g));
  if (filter === 'soon')   list = list.filter(g => { const d = daysLeft(g); return !isDone(g) && d !== null && d <= 7; });
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(g => (g.title + ' ' + (g.note || '') + ' ' + g.steps.map(s => s.text).join(' ')).toLowerCase().includes(q));
  }
  return list.sort(sorters());
}

function visibleDreams() {
  let list = state.dreams.slice();
  if (filter === 'active') list = list.filter(d => !dreamDone(d));
  if (filter === 'done')   list = list.filter(dreamDone);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(d => (d.title + ' ' + (d.note || '')).toLowerCase().includes(q));
  }
  return list.sort(sorters(true));
}

function sorters(dream = false) {
  const prog = dream ? dreamProgress : progress;
  return {
    new:      (a, b) => b.createdAt - a.createdAt,
    progress: (a, b) => prog(b) - prog(a),
    az:       (a, b) => a.title.localeCompare(b.title, 'ru'),
    deadline: (a, b) => {
      const x = daysLeft(a), y = daysLeft(b);
      if (x === null && y === null) return b.createdAt - a.createdAt;
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y;
    }
  }[sortBy];
}

function glide(glider, btn, instant) {
  if (!glider || !btn || !btn.offsetWidth) return;
  glider.classList.toggle('no-anim', !!instant);
  glider.style.width = btn.offsetWidth + 'px';
  glider.style.transform = `translateX(${btn.offsetLeft}px)`;
  if (instant) requestAnimationFrame(() => glider.classList.remove('no-anim'));
}
const moveTabGlider = instant => glide($('#tabGlider'), $('.tab.is-active'), instant);
const moveSegGlider = instant => glide($('#segGlider'), $('.seg-btn.is-active'), instant);

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

addEventListener('resize', () => { moveTabGlider(true); moveSegGlider(true); });
document.fonts?.ready.then(() => moveTabGlider(true));

function render() {
  const dreams = view === 'dreams';

  $('#tabNGoals').textContent  = state.goals.length;
  $('#tabNDreams').textContent = state.dreams.length;
  $$('.tab').forEach(t => t.classList.toggle('is-active', (t.dataset.view === 'dreams') === dreams));
  moveTabGlider();
  setText($('#btnNewLabel'), dreams ? 'Новая мечта' : 'Новая цель');

  const chips = $$('.chip');
  chips[1].textContent = dreams ? 'В пути' : 'Активные';
  chips[2].textContent = dreams ? 'Сбылись' : 'Выполненные';
  chips[3].hidden = dreams;
  if (dreams && filter === 'soon') {
    filter = 'all';
    chips.forEach(c => c.classList.toggle('is-active', c.dataset.filter === 'all'));
  }
  $('#search').placeholder = dreams ? 'поиск по мечтам…' : 'поиск по целям…';

  renderStats();

  const list = dreams ? visibleDreams() : visibleGoals();
  const box = $('#goals');
  box.innerHTML = list.map((x, i) => dreams ? dreamCard(x, i) : card(x, i)).join('');
  $('#empty').hidden = list.length > 0;

  const total = dreams ? state.dreams.length : state.goals.length;
  $('#empty .empty-art').innerHTML = `<use href="#i-${total ? 'search' : (dreams ? 'sparkle' : 'target')}"/>`;
  $('#emptyTitle').textContent = total
    ? 'Ничего не нашлось'
    : (dreams ? 'Мечты пока не записаны' : 'Тут пока пусто');
  $('#emptyText').textContent = total
    ? 'Попробуй другой фильтр или запрос.'
    : (dreams ? 'Запиши, чего хочешь на самом деле — а цели подтянутся.'
              : 'Создай первую цель — и посмотрим, чего ты стоишь.');
  $('#btnNewEmpty').hidden = total > 0;
  $('#btnNewEmpty').lastChild.textContent = dreams ? ' Записать мечту' : ' Создать цель';

  requestAnimationFrame(() => $$('.bar i', box).forEach(el => el.style.width = el.dataset.w + '%'));
}

function deadlineTag(item, done, kind = 'goal') {
  if (done) return `<span class="tag is-ok">${icon('check')} ${kind === 'dream' ? 'сбылась' : 'выполнено'}</span>`;
  const d = daysLeft(item);
  if (d === null) return `<span class="tag is-quiet">${icon('clock')} ${kind === 'dream' ? 'когда-нибудь' : 'без срока'}</span>`;
  if (d < 0)   return `<span class="tag is-over">${icon('alert')} просрочено на ${Math.abs(d)} ${plural(Math.abs(d), 'день', 'дня', 'дней')}</span>`;
  if (d === 0) return `<span class="tag is-hot">${icon('fire')} ${kind === 'dream' ? 'срок сегодня' : 'сегодня дедлайн'}</span>`;
  if (d <= 7)  return `<span class="tag is-hot">${icon('fire')} ${d} ${plural(d, 'день', 'дня', 'дней')} осталось</span>`;
  return `<span class="tag">${icon('calendar')} ${d} ${plural(d, 'день', 'дня', 'дней')} осталось</span>`;
}

function card(g, i) {
  const p = progress(g), pct = Math.round(p * 100), done = p >= 1;
  const dream = g.dreamId ? state.dreams.find(d => d.id === g.dreamId) : null;

  let body, meta;
  if (g.type === 'counter') {
    meta = `${g.current} из ${g.target}${g.unit ? ' ' + esc(g.unit) : ''}`;
    body = `
      <div class="counter-box">
        <button class="cbtn" data-act="dec" title="минус один" aria-label="минус один" ${g.current <= 0 ? 'disabled' : ''}>${icon('minus')}</button>
        <span class="counter-val">${g.current} <span>/ ${g.target} ${esc(g.unit || '')}</span></span>
        <button class="cbtn" data-act="inc" title="плюс один" aria-label="плюс один" ${g.current >= g.target ? 'disabled' : ''}>${icon('plus')}</button>
      </div>`;
  } else {
    const shown = g.steps.slice(0, 4);
    meta = g.steps.length ? `${g.steps.filter(s => s.done).length} из ${g.steps.length} ${plural(g.steps.length, 'шага', 'шагов', 'шагов')}` : 'без шагов';
    body = `<div class="steps-mini">
      ${shown.map(s => `
        <div class="step-row ${s.done ? 'done' : ''}" data-act="step" data-step="${s.id}">
          <span class="tick">${icon('check')}</span><span class="step-text">${esc(s.text)}</span>
        </div>`).join('')}
      ${g.steps.length > 4 ? `<div class="steps-more">и ещё ${g.steps.length - 4}…</div>` : ''}
      ${!g.steps.length ? '<div class="steps-more">шагов нет — закрой цель галочкой сверху</div>' : ''}
    </div>`;
  }

  return `
  <article class="card ${done ? 'is-done' : ''}" style="--c:${g.color}; --d:${i * 55}ms" data-id="${g.id}">
    <div class="card-head">
      <div class="card-icon">${icon(g.icon)}</div>
      <div class="card-titles">
        <h3 class="card-title">${esc(g.title)}</h3>
        ${g.note ? `<p class="card-note">${esc(g.note)}</p>` : ''}
        ${dream ? `<span class="dream-line">${icon('sparkle')}<span>к мечте «${esc(dream.title)}»</span></span>` : ''}
      </div>
      <div class="card-menu">
        <button class="icon-btn" data-act="toggle" title="${done ? 'Вернуть в работу' : 'Отметить выполненной'}">${icon(done ? 'undo' : 'check')}</button>
        <button class="icon-btn" data-act="edit" title="Редактировать">${icon('pen')}</button>
        <button class="icon-btn" data-act="del" title="Удалить">${icon('trash')}</button>
      </div>
    </div>
    <div class="bar"><i data-w="${pct}"></i></div>
    <div class="bar-meta"><b>${pct}%</b><span>${meta}</span></div>
    ${body}
    <div class="card-foot">
      ${deadlineTag(g, done)}
      <span class="tag is-quiet">${icon(g.type === 'counter' ? 'hash' : 'list')} ${g.type === 'counter' ? 'счётчик' : 'шаги'}</span>
    </div>
  </article>`;
}

function dreamCard(d, i) {
  const gs = dreamGoals(d);
  const p = dreamProgress(d), pct = Math.round(p * 100), done = p >= 1;
  const closed = gs.filter(isDone).length;

  const body = gs.length
    ? `<div class="dream-goals">
        ${gs.slice(0, 4).map(g => `
          <div class="dream-goal ${isDone(g) ? 'done' : ''}" data-act="open-goal" data-goal="${g.id}" title="Открыть цель">
            ${icon(g.icon, 'ic dg-ic')}
            <span class="dg-name">${esc(g.title)}</span>
            <span class="dg-pct">${Math.round(progress(g) * 100)}%</span>
          </div>`).join('')}
        ${gs.length > 4 ? `<div class="dream-empty">и ещё ${gs.length - 4}…</div>` : ''}
      </div>`
    : `<div class="dream-empty">Ни одна цель пока не ведёт сюда. Открой мечту и отметь цели — или поставь галочку, если сбылась сама.</div>`;

  return `
  <article class="card card-dream ${done ? 'is-done' : ''}" style="--c:${d.color}; --d:${i * 55}ms" data-id="${d.id}">
    <div class="card-head">
      <div class="card-icon">${icon(d.icon)}</div>
      <div class="card-titles">
        <h3 class="card-title">${esc(d.title)}</h3>
        ${d.note ? `<p class="card-note">${esc(d.note)}</p>` : ''}
      </div>
      <div class="card-menu">
        <button class="icon-btn" data-act="toggle" title="${done ? 'Вернуть в мечты' : 'Мечта сбылась'}">${icon(done ? 'undo' : 'check')}</button>
        <button class="icon-btn" data-act="edit" title="Редактировать">${icon('pen')}</button>
        <button class="icon-btn" data-act="del" title="Удалить">${icon('trash')}</button>
      </div>
    </div>
    <div class="bar"><i data-w="${pct}"></i></div>
    <div class="bar-meta">
      <b>${pct}%</b>
      <span>${gs.length ? `${closed} из ${gs.length} ${plural(gs.length, 'цели', 'целей', 'целей')} закрыто` : 'целей пока нет'}</span>
    </div>
    ${body}
    <div class="card-foot">
      ${deadlineTag(d, done, 'dream')}
      <span class="tag is-quiet">${icon('sparkle')} мечта</span>
    </div>
  </article>`;
}

function renderStats() {
  const gs = state.goals;

  if (view === 'dreams') {
    const ds = state.dreams;
    const doneN = ds.filter(dreamDone).length;
    const total = ds.length ? ds.reduce((s, d) => s + dreamProgress(d), 0) / ds.length : 0;
    const linked = gs.filter(g => g.dreamId).length;

    setText($('#ringCaption'), 'мечты сбываются');
    setRing(total);
    setStat('#icActive', 'sparkle', '#statActive', ds.length - doneN, '#lblActive', 'в пути');
    setStat('#icSteps', 'target', '#statSteps', linked, '#lblSteps',
            plural(linked, 'цель ведёт к мечте', 'цели ведут к мечте', 'целей ведут к мечтам'));
    countTo($('#statDone'), doneN);
    setText($('#lblDone'), 'сбылось');
  } else {
    const doneN = gs.filter(isDone).length;
    const total = gs.length ? gs.reduce((s, g) => s + progress(g), 0) / gs.length : 0;
    const wins = gs.reduce((s, g) => s + (g.type === 'counter' ? Math.min(g.current, g.target) : g.steps.filter(x => x.done).length), 0);

    setText($('#ringCaption'), 'общий прогресс');
    setRing(total);
    setStat('#icActive', 'target', '#statActive', gs.length - doneN, '#lblActive', 'в работе');
    setStat('#icSteps', 'sparkle', '#statSteps', wins, '#lblSteps', 'маленьких побед');
    countTo($('#statDone'), doneN);
    setText($('#lblDone'), 'закрыто');
  }

  countTo($('#statStreak'), streak());
  renderActivity();
}

function setRing(p) {
  countTo($('#ringValue'), Math.round(p * 100));
  $('#ringFg').style.strokeDashoffset = 540.35 * (1 - p);
}

function setStat(icSel, icName, valSel, val, lblSel, lblText) {
  $(icSel).setAttribute('href', '#i-' + icName);
  countTo($(valSel), val);
  setText($(lblSel), lblText);
}

function renderActivity() {
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const max = Math.max(1, ...days.map(d => state.activity[d] || 0));
  $('#activity').innerHTML = days.map(d => {
    const v = state.activity[d] || 0;
    const label = new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return `<div class="act-cell ${v ? '' : 'is-empty'}" title="${label}: ${v || 'ничего'}">
      <i style="height:${v ? 20 + (v / max) * 80 : 0}%"></i></div>`;
  }).join('');
}

function countTo(el, target) {
  const from = parseInt(el.textContent, 10) || 0;
  cancelAnimationFrame(el._raf);
  clearTimeout(el._to);
  if (from === target) { el.textContent = target; return; }

  const t0 = performance.now(), dur = 600;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = k < 1 ? Math.round(from + (target - from) * e) : target;
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
  el._to = setTimeout(() => { cancelAnimationFrame(el._raf); el.textContent = target; }, dur + 120);
}

$('#goals').addEventListener('click', e => {
  const cardEl = e.target.closest('.card'); if (!cardEl) return;
  const hit = e.target.closest('[data-act]'); if (!hit) return;
  return view === 'dreams' ? dreamAction(cardEl, hit) : goalAction(cardEl, hit);
});

function goalAction(cardEl, hit) {
  const act = hit.dataset.act;
  const g = state.goals.find(x => x.id === cardEl.dataset.id); if (!g) return;
  const was = isDone(g);
  const dream = g.dreamId ? state.dreams.find(d => d.id === g.dreamId) : null;
  const dreamWas = dream ? dreamDone(dream) : false;

  if (act === 'del') {
    cardEl.classList.add('is-removing');
    setTimeout(() => { state.goals = state.goals.filter(x => x.id !== g.id); save(); render(); }, 320);
    toast('trash', 'Цель удалена');
    return;
  }
  if (act === 'edit') return openModal(g);
  if (act === 'toggle') {
    if (was) {
      g.manualDone = false; g.completedAt = null;
      g.steps.forEach(s => s.done = false);
      if (g.type === 'counter') g.current = 0;
    } else {
      g.manualDone = true; g.steps.forEach(s => s.done = true);
      if (g.type === 'counter') g.current = g.target;
      bump(2);
    }
  }
  if (act === 'step') {
    const s = g.steps.find(x => x.id === hit.dataset.step);
    s.done = !s.done; if (s.done) bump();
  }
  if (act === 'inc') { g.current = Math.min(g.target, g.current + 1); bump(); }
  if (act === 'dec') { g.current = Math.max(0, g.current - 1); }

  if (!was && isDone(g)) {
    g.completedAt = Date.now();
    const r = cardEl.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
    toast('trophy', `«${g.title}» — цель закрыта!`, 'is-ok');

    if (dream && !dreamWas && dreamDone(dream)) {        /* последняя цель добила мечту */
      dream.fulfilledAt = Date.now();
      setTimeout(() => {
        confetti(innerWidth / 2, innerHeight / 2.6);
        confetti(innerWidth / 3, innerHeight / 2.2);
        toast('sparkle', `Мечта «${dream.title}» сбылась!`, 'is-ok');
      }, 1000);
    }
  }
  save(); render();
}

function dreamAction(cardEl, hit) {
  const act = hit.dataset.act;
  const d = state.dreams.find(x => x.id === cardEl.dataset.id); if (!d) return;

  if (act === 'del') {
    cardEl.classList.add('is-removing');
    setTimeout(() => {
      state.goals.forEach(g => { if (g.dreamId === d.id) g.dreamId = null; });
      state.dreams = state.dreams.filter(x => x.id !== d.id);
      save(); render();
    }, 320);
    toast('trash', 'Мечта удалена');
    return;
  }
  if (act === 'edit') return openDreamModal(d);
  if (act === 'open-goal') {
    const g = state.goals.find(x => x.id === hit.dataset.goal);
    if (g) openModal(g);
    return;
  }
  if (act === 'toggle') {
    if (dreamDone(d)) { d.manualDone = false; d.fulfilledAt = null; }
    else {
      d.manualDone = true; d.fulfilledAt = Date.now(); bump(3);
      const r = cardEl.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2);
      toast('sparkle', `Мечта «${d.title}» сбылась!`, 'is-ok');
    }
  }
  save(); render();
}

$('#goals').addEventListener('pointermove', e => {
  const c = e.target.closest('.card'); if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  c.style.setProperty('--my', (e.clientY - r.top) + 'px');
});

$('#tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab'); if (!t) return;
  switchView(t.dataset.view);
});

function switchView(v) {
  if (v === view || switchView.busy) return;
  switchView.busy = true;

  const parts = [$('#goals'), $('#empty'), $('.toolbar'), $('.hero')];
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === v));
  moveTabGlider();                                   /* подчёркивание едет сразу */
  parts.forEach(el => el.classList.add('is-switching'));   /* старое уходит в размытие */

  setTimeout(() => {
    view = v;
    parts.forEach(el => el.classList.add('from-blur'));    /* ничего не выезжает — проявляется блок */
    render();
    parts.forEach(el => el.classList.remove('is-switching'));  /* новое наводится на резкость */
    setTimeout(() => parts.forEach(el => el.classList.remove('from-blur')), 340);
    switchView.busy = false;
  }, 230);
}

const modal = $('#modalRoot');

function prepModal(mode) {
  modalMode = mode;
  const dream = mode === 'dream';
  $('#fldType').hidden = dream;
  $('#paneChecklist').hidden = dream || draftType !== 'checklist';
  $('#paneCounter').hidden = dream || draftType !== 'counter';
  $('#paneDream').hidden = !dream;
  $('#fldDream').hidden = dream || !state.dreams.length;
  $('#capDeadline').textContent = dream ? 'Когда хочу' : 'Дедлайн';
  $('#iconPick').hidden = true;
}

function openModal(g = null) {
  editingId = g ? g.id : null;
  draftSteps = g ? g.steps.map(s => ({ ...s })) : [];
  draftIcon  = g ? g.icon : ICONS[Math.floor(Math.random() * ICONS.length)];
  draftColor = g ? g.color : COLORS[Math.floor(Math.random() * COLORS.length)];
  draftType  = g ? g.type : 'checklist';

  $('#modalTitle').textContent = g ? 'Редактируем цель' : 'Новая цель';
  $('#fTitle').value = g ? g.title : '';
  $('#fTitle').placeholder = 'Название цели';
  $('#fNote').value = g ? (g.note || '') : '';
  $('#fDeadline').value = g ? (g.deadline || '') : '';
  $('#fTarget').value = g && g.type === 'counter' ? g.target : 10;
  $('#fUnit').value = g ? (g.unit || '') : '';
  $('#fCurrent').value = g && g.type === 'counter' ? g.current : 0;
  $('#btnDelete').hidden = !g;

  renderDreamSelect(g ? g.dreamId : null);
  setIcon(draftIcon);
  setType(draftType);
  prepModal('goal');
  renderSwatches();
  renderDraftSteps();

  modal.hidden = false;
  requestAnimationFrame(() => moveSegGlider(true));
  setTimeout(() => $('#fTitle').focus(), 60);
}

function openDreamModal(d = null) {
  editingId = d ? d.id : null;
  draftIcon  = d ? d.icon : 'star';
  draftColor = d ? d.color : COLORS[3];
  draftLinks = d ? dreamGoals(d).map(g => g.id) : [];

  $('#modalTitle').textContent = d ? 'Редактируем мечту' : 'Новая мечта';
  $('#fTitle').value = d ? d.title : '';
  $('#fTitle').placeholder = 'О чём мечтаешь?';
  $('#fNote').value = d ? (d.note || '') : '';
  $('#fDeadline').value = d ? (d.deadline || '') : '';
  $('#btnDelete').hidden = !d;

  setIcon(draftIcon);
  prepModal('dream');
  renderSwatches();
  renderLinkGoals();

  modal.hidden = false;
  setTimeout(() => $('#fTitle').focus(), 60);
}

function closeModal() {
  const m = $('.modal');
  m.classList.add('is-closing');
  setTimeout(() => { m.classList.remove('is-closing'); modal.hidden = true; }, 250);
}

function setIcon(name) {
  draftIcon = name;
  $('#iconBtn').innerHTML = icon(name);
  $$('#iconPick button').forEach(b => b.classList.toggle('is-active', b.dataset.icon === name));
}

function setType(t, instant) {
  draftType = t;
  $$('.seg-btn').forEach(b => b.classList.toggle('is-active', b.dataset.type === t));
  moveSegGlider(instant);
  if (modalMode !== 'dream') {
    $('#paneChecklist').hidden = t !== 'checklist';
    $('#paneCounter').hidden = t !== 'counter';
  }
}

function renderDraftSteps() {
  $('#stepsList').innerHTML = draftSteps.map(s =>
    `<div class="step-edit"><span class="tick"></span><span class="txt">${esc(s.text)}</span>
       <button data-rm="${s.id}" title="Убрать шаг" aria-label="Убрать шаг">${icon('x')}</button></div>`).join('');
}

function renderSwatches() {
  $('#colors').innerHTML = COLORS.map(c =>
    `<button class="swatch ${c === draftColor ? 'is-active' : ''}" data-color="${c}"
       style="background:${c}" title="Цвет" aria-label="Цвет">${icon('check')}</button>`).join('');
}

function renderDreamSelect(current) {
  $('#fDream').innerHTML = '<option value="">— сама по себе —</option>' +
    state.dreams.map(d => `<option value="${d.id}" ${d.id === current ? 'selected' : ''}>${esc(d.title)}</option>`).join('');
}

function renderLinkGoals() {
  const box = $('#dreamGoals');
  if (!state.goals.length) {
    box.innerHTML = '<p class="link-empty">Целей пока нет. Создай цель и выбери в ней эту мечту — она появится здесь.</p>';
    return;
  }
  box.innerHTML = state.goals.map(g => {
    const busy = g.dreamId && g.dreamId !== editingId;
    return `<div class="link-goal ${draftLinks.includes(g.id) ? 'on' : ''}" data-link="${g.id}">
      <span class="tick">${icon('check')}</span>
      <span class="lg-name">${esc(g.title)}</span>
      <span class="lg-pct">${busy ? 'у другой мечты' : Math.round(progress(g) * 100) + '%'}</span>
    </div>`;
  }).join('');
}

function addStep() {
  const inp = $('#stepInput'), text = inp.value.trim();
  if (!text) return;
  draftSteps.push({ id: uid(), text, done: false });
  inp.value = ''; renderDraftSteps(); inp.focus();
  $('#stepsList').scrollTop = $('#stepsList').scrollHeight;
}

const saveItem = () => modalMode === 'dream' ? saveDream() : saveGoal();

function saveGoal() {
  const title = $('#fTitle').value.trim();
  if (!title) { $('#fTitle').focus(); toast('alert', 'Дай цели название', 'is-bad'); return; }

  const target = Math.max(1, parseInt($('#fTarget').value, 10) || 1);
  const data = {
    title,
    note: $('#fNote').value.trim(),
    icon: draftIcon,
    color: draftColor,
    type: draftType,
    steps: draftType === 'checklist' ? draftSteps : [],
    target: draftType === 'counter' ? target : 0,
    current: draftType === 'counter' ? Math.max(0, Math.min(target, parseInt($('#fCurrent').value, 10) || 0)) : 0,
    unit: $('#fUnit').value.trim(),
    deadline: $('#fDeadline').value || null,
    dreamId: $('#fDream').value || null
  };

  if (editingId) {
    Object.assign(state.goals.find(x => x.id === editingId), data);
    toast('check', 'Изменения сохранены', 'is-ok');
  } else {
    state.goals.unshift({ id: uid(), createdAt: Date.now(), completedAt: null, manualDone: false, ...data });
    bump(); toast('sparkle', 'Новая цель в списке. Погнали!');
  }
  save(); closeModal(); render();
}

function saveDream() {
  const title = $('#fTitle').value.trim();
  if (!title) { $('#fTitle').focus(); toast('alert', 'Назови мечту', 'is-bad'); return; }

  const data = {
    title,
    note: $('#fNote').value.trim(),
    icon: draftIcon,
    color: draftColor,
    deadline: $('#fDeadline').value || null
  };

  let id = editingId;
  if (id) {
    Object.assign(state.dreams.find(x => x.id === id), data);
    toast('check', 'Изменения сохранены', 'is-ok');
  } else {
    id = uid();
    state.dreams.unshift({ id, createdAt: Date.now(), fulfilledAt: null, manualDone: false, ...data });
    bump(); toast('sparkle', 'Мечта записана. Теперь к ней нужны цели.');
  }
  state.goals.forEach(g => {                       /* привязываем отмеченные цели */
    if (draftLinks.includes(g.id)) g.dreamId = id;
    else if (g.dreamId === id) g.dreamId = null;
  });

  save(); closeModal(); render();
}

$('#btnNew').addEventListener('click', () => view === 'dreams' ? openDreamModal() : openModal());
$('#btnNewEmpty').addEventListener('click', () => view === 'dreams' ? openDreamModal() : openModal());
$('#btnSave').addEventListener('click', saveItem);
$('#stepAdd').addEventListener('click', addStep);
$('#stepInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } });
$('#stepsList').addEventListener('click', e => {
  const id = e.target.closest('[data-rm]')?.dataset.rm; if (!id) return;
  draftSteps = draftSteps.filter(s => s.id !== id); renderDraftSteps();
});
$('#dreamGoals').addEventListener('click', e => {
  const row = e.target.closest('[data-link]'); if (!row) return;
  const id = row.dataset.link;
  draftLinks = draftLinks.includes(id) ? draftLinks.filter(x => x !== id) : [...draftLinks, id];
  row.classList.toggle('on', draftLinks.includes(id));
});
$('#typeSeg').addEventListener('click', e => { const b = e.target.closest('.seg-btn'); if (b) setType(b.dataset.type); });
$('#colors').addEventListener('click', e => {
  const b = e.target.closest('.swatch'); if (!b) return;
  draftColor = b.dataset.color; renderSwatches();
});
$('#iconBtn').addEventListener('click', () => {
  const pick = $('#iconPick');
  if (pick.hidden) {
    pick.innerHTML = ICONS.map(n => `<button data-icon="${n}" title="${n}">${icon(n)}</button>`).join('');
    $$('#iconPick button').forEach(b => b.classList.toggle('is-active', b.dataset.icon === draftIcon));
  }
  pick.hidden = !pick.hidden;
});
$('#iconPick').addEventListener('click', e => {
  const b = e.target.closest('[data-icon]'); if (!b) return;
  setIcon(b.dataset.icon); $('#iconPick').hidden = true;
});
$$('[data-close]').forEach(b => b.addEventListener('click', closeModal));
$('#btnDelete').addEventListener('click', () => {
  if (modalMode === 'dream') {
    state.goals.forEach(g => { if (g.dreamId === editingId) g.dreamId = null; });
    state.dreams = state.dreams.filter(d => d.id !== editingId);
    toast('trash', 'Мечта удалена');
  } else {
    state.goals = state.goals.filter(g => g.id !== editingId);
    toast('trash', 'Цель удалена');
  }
  save(); closeModal(); render();
});

$('#filters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('.chip').forEach(x => x.classList.toggle('is-active', x === b));
  filter = b.dataset.filter; render();
});
$('#search').addEventListener('input', e => { query = e.target.value.trim(); render(); });
$('#sort').addEventListener('change', e => { sortBy = e.target.value; render(); });

const MOODS = [
  { sat: '.82', bright: '.72', blur: '16px', scale: '1.05', label: 'мягкий фон' },
  { sat: '.95', bright: '.85', blur: '3px',  scale: '1.02', label: 'чёткий фон' },
  { sat: '.55', bright: '.55', blur: '34px', scale: '1.12', label: 'тихий фон' }
];
$('#btnTheme').addEventListener('click', () => {
  state.mood = (state.mood + 1) % MOODS.length;
  applyMood(); save(); toast('contrast', MOODS[state.mood].label);
});
function applyMood() {
  const m = MOODS[state.mood], s = document.documentElement.style;
  s.setProperty('--blur', m.blur);
  s.setProperty('--bg-scale', m.scale);
  s.setProperty('--sat', m.sat);
  s.setProperty('--bright', m.bright);
}

$('#btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `target-list-${today()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('download', 'Файл с целями и мечтами скачан');
});
$('#btnImport').addEventListener('click', () => $('#fileImport').click());
$('#fileImport').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.goals)) throw 0;
      localStorage.setItem(KEY, JSON.stringify(data));
      state = load();
      save(); applyMood(); render(); toast('upload', 'Загружено', 'is-ok');
    } catch { toast('alert', 'Не получилось прочитать файл', 'is-bad'); }
  };
  r.readAsText(f); e.target.value = '';
});

function toast(ic, text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = icon(ic) + `<span>${esc(text)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
}

const CONFETTI = ['#f0be7c', '#e4917f', '#9ac9a8', '#cfc3ff', '#ffd6a3', '#8fb3d9'];
const cv = $('#confetti'), ctx = cv.getContext('2d');
let parts = [], raf = null;
const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
fit(); addEventListener('resize', fit);

function confetti(x = innerWidth / 2, y = innerHeight / 2) {
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8;
    parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
      w: 4 + Math.random() * 6, h: 3 + Math.random() * 5,
      rot: Math.random() * 6, vr: (Math.random() - .5) * .35,
      c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)], life: 1
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter(p => p.life > 0);
  parts.forEach(p => {
    p.vy += .22; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    p.life -= p.y > cv.height ? .08 : .006;
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  });
  raf = parts.length ? requestAnimationFrame(tick) : (ctx.clearRect(0, 0, cv.width, cv.height), null);
}

addEventListener('keydown', e => {
  const typing = /input|textarea|select/i.test(document.activeElement.tagName);
  if (e.key === 'Escape' && !modal.hidden) return closeModal();
  if (!modal.hidden && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) return saveItem();
  if (typing || !entered || !modal.hidden) return;
  if (e.key === 'n' || e.key === 'т') { e.preventDefault(); view === 'dreams' ? openDreamModal() : openModal(); }
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  if (e.key === 'Tab') { e.preventDefault(); switchView(view === 'goals' ? 'dreams' : 'goals'); }
});

$('#today').textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
applyMood();
renderStats();
