/*
 * app.js — page logic. Each test is a module { id, name, instructions, generate, body, explain, ... }
 * listed in TESTS. Remove or reorder entries in TESTS to hide or reorder tabs.
 */
(function () {
  'use strict';
  const G = window.Gen;
  const N = G.N;
  const KEY = 'psico_gia_v1';
  const MAX_ANSWER_MS = 120000; // one answer counts at most 2 minutes (idle time is not counted beyond that)

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
  const secs = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(1).replace('.', ',') + ' s');
  const mmss = (ms) => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ======================= Test modules ======================= */

  const numerica = {
    id: 'numerica', name: 'Rapidez Numérica', paceRef: 8,
    generate: G.numberSpeed,
    instructions: `<p>São apresentados três números. Identifique o maior, o menor e o número do meio. Depois, determine qual dos dois, o maior ou o menor, está mais perto do número do meio. Clique nesse número.</p>
      <p><strong>Exemplo:</strong> 100 - 300 - 25 → Menor: 25, Meio: 100, Maior: 300. Distância de 25 a 100 = 75. Distância de 300 a 100 = 200. Como 75 é menor do que 200, o 25 está mais perto do número do meio, 100.</p>`,
    body: () => '',
    optsClass: 'opts-num',
    optAria: (o) => 'Número ' + o.label,
    explain: (q) => {
      const closer = q.dLow < q.dHigh ? `${q.low} (o menor)` : `${q.high} (o maior)`;
      return `<p>Menor: <b>${q.low}</b> · Meio: <b>${q.mid}</b> · Maior: <b>${q.high}</b></p>
        <p>Distância de ${q.low} a ${q.mid} = ${q.dLow}. Distância de ${q.high} a ${q.mid} = ${q.dHigh}.</p>
        <p>Como ${Math.min(q.dLow, q.dHigh)} é menor do que ${Math.max(q.dLow, q.dHigh)}, o ${closer} está mais perto do número do meio.</p>`;
    }
  };

  const percetiva = {
    id: 'percetiva', name: 'Rapidez Percetiva', paceRef: 8,
    generate: G.perceptual,
    instructions: '<p>Cada par mostra uma letra maiúscula e uma minúscula. Conte quantos pares correspondem à mesma letra.</p>',
    body: (q) => `<div class="pairs">${q.pairs.map((p, j) =>
      `<span class="pair" role="img" aria-label="Par ${j + 1}: ${esc(p.top)} em cima, ${esc(p.bottom)} em baixo"><span>${esc(p.top)}</span><span>${esc(p.bottom)}</span></span>`).join('')}</div>`,
    optsClass: 'opts-count',
    optAria: (o) => o.label + (o.value === 1 ? ' par corresponde' : ' pares correspondem'),
    explain: (q) => `<ul class="x-list">${q.pairs.map((p, j) =>
      `<li><span class="mono">${esc(p.top)}/${esc(p.bottom)}</span> ${p.match ? '✓ mesma letra' : '✗ letras diferentes'}</li>`).join('')}</ul>
      <p>Total: ${q.correct} ${q.correct === 1 ? 'par corresponde' : 'pares correspondem'}.</p>`
  };

  const rGlyph = (g, label) =>
    `<svg class="rg" viewBox="0 0 60 60" role="img" aria-label="${esc(label)}"><text x="30" y="31" text-anchor="middle" dominant-baseline="central" transform="rotate(${g.rot} 30 30)${g.mirrored ? ' translate(60 0) scale(-1 1)' : ''}">R</text></svg>`;

  const espacial = {
    id: 'espacial', name: 'Visualização Espacial', paceRef: 10,
    generate: G.spatial,
    instructions: '<p>Abaixo vê quatro pares da letra R, rodados no sentido dos ponteiros do relógio para a esquerda ou para a direita uma ou mais vezes. Compare o R de cima com o R de baixo para determinar se a posição está correta depois da rotação, e assinale quantos pares estão corretamente rodados.</p>',
    body: (q) => `<div class="rpairs">${q.pairs.map((p, j) =>
      `<div class="rpair">${rGlyph(p.top, `Par ${j + 1}, letra de cima`)}${rGlyph(p.bottom, `Par ${j + 1}, letra de baixo`)}</div>`).join('')}</div>`,
    optsClass: 'opts-count',
    optAria: (o) => o.label + (o.value === 1 ? ' par correto' : ' pares corretos'),
    explain: (q) => `<ul class="x-list">${q.pairs.map((p, j) => {
      const txt = p.ok ? (p.top.rot === p.bottom.rot ? 'apenas rodado (sem rotação: igual)' : 'apenas rodado') : 'espelhado';
      return `<li>Par ${j + 1}: ${p.ok ? '✓' : '✗'} ${txt}</li>`;
    }).join('')}</ul><p>Total: ${q.correct} ${q.correct === 1 ? 'par correto' : 'pares corretos'}.</p>`
  };

  const seriesMod = {
    id: 'series', name: 'Séries Numéricas', paceRef: 20,
    generate: G.series,
    instructions: '<p>Cada série segue uma regra. Descubra o número que falta (?) e clique na opção certa.</p>',
    body: (q) => `<div class="series" role="list" aria-label="Série">${q.seq.map((v, j) => (j === q.hidden
      ? '<span class="term term-q" role="listitem" aria-label="número em falta">?</span>'
      : `<span class="term" role="listitem">${v}</span>`)).join('')}</div>`,
    optsClass: 'opts-wide',
    optAria: (o) => 'Opção ' + o.label,
    explain: (q) => `<p>Regra: ${esc(cap(q.rule))}.</p>
      <p class="mono">${q.seq.map((v, j) => (j === q.hidden ? `<b class="hl">${v}</b>` : v)).join(', ')}</p>`
  };

  const codeRow = (s, diffs) => s.split('').map((c, k) => (diffs.includes(k) ? `<span class="cd">${esc(c)}</span>` : `<span>${esc(c)}</span>`)).join('');
  const codigos = {
    id: 'codigos', name: 'Verificação de Códigos', paceRef: 10,
    generate: G.codes,
    instructions: '<p>Compare os dois códigos e indique quantos caracteres são diferentes (na mesma posição).</p>',
    body: (q) => `<div class="codes">
      <div class="code-box"><span class="code-lbl">Código 1</span><code class="code">${esc(q.a)}</code></div>
      <div class="code-box"><span class="code-lbl">Código 2</span><code class="code">${esc(q.b)}</code></div></div>`,
    optsClass: 'opts-count',
    optAria: (o) => o.label + (o.value === 1 ? ' carácter diferente' : ' caracteres diferentes'),
    explain: (q) => {
      const marks = q.a.split('').map((_, k) => `<span>${q.diffs.includes(k) ? '▲' : '&nbsp;'}</span>`).join('');
      let txt = q.diffs.length
        ? `<p>Posições diferentes: ${q.diffs.map((k) => k + 1).join(', ')} (total ${q.diffs.length}).</p>`
        : '<p>Os dois códigos são iguais (0 diferenças).</p>';
      q.swaps.forEach((p) => {
        txt += `<p>As posições ${p + 1} e ${p + 2} têm os caracteres trocados (${esc(q.a[p])}${esc(q.a[p + 1])} → ${esc(q.b[p])}${esc(q.b[p + 1])}): uma troca de caracteres vizinhos conta como 2 diferenças.</p>`;
      });
      return `<div class="code-x" aria-hidden="true"><div>${codeRow(q.a, q.diffs)}</div><div>${codeRow(q.b, q.diffs)}</div><div class="code-marks">${marks}</div></div>${txt}`;
    }
  };

  const silogismos = {
    id: 'silogismos', name: 'Silogismos', paceRef: 20,
    generate: G.syllogisms,
    instructions: '<p>Leia as afirmações como verdadeiras, mesmo que não correspondam à realidade. Depois diga se a conclusão é Verdadeira, Falsa ou Não se pode concluir.</p>',
    body: (q) => `<ol class="prem">${q.premises.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      <p class="concl"><strong>Conclusão:</strong> ${esc(q.conclusion)}</p>`,
    optsClass: 'opts-text',
    optAria: (o) => o.label,
    explain: (q) => {
      const legend = q.cond
        ? `P = “${esc(q.props.P)}”, Q = “${esc(q.props.Q)}”, R = “${esc(q.props.R)}”.`
        : `A = ${esc(q.terms.A.p)}, B = ${esc(q.terms.B.p)}, C = ${esc(q.terms.C.p)}.`;
      return `<p>${esc(q.explain)}</p><p class="muted">${legend} Resposta: ${esc(G.SYL_ANSWER_LABEL[q.correct])}.</p>`;
    }
  };

  /* Figures (inline SVG) */
  const LAYOUT = {
    1: [[50, 50]],
    2: [[33, 50], [67, 50]],
    3: [[50, 33], [33, 67], [67, 67]],
    4: [[34, 34], [66, 34], [34, 66], [66, 66]],
    5: [[31, 31], [69, 31], [50, 50], [31, 69], [69, 69]],
    6: [[28, 38], [50, 38], [72, 38], [28, 62], [50, 62], [72, 62]]
  };
  const RADIUS = { 1: { small: 14, large: 24 }, 2: { small: 9, large: 14 }, 3: { small: 8, large: 12.5 }, 4: { small: 8, large: 12.5 }, 5: { small: 6.5, large: 9.5 }, 6: { small: 5.5, large: 8.5 } };
  const CORNERS = [[13, 13], [87, 13], [87, 87], [13, 87]];
  function shapeSvg(f, x, y, r) {
    const fill = f.fill === 'filled' ? 'currentColor' : f.fill === 'striped' ? 'url(#psico-stripes)' : 'none';
    const a = `fill="${fill}" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"`;
    if (f.shape === 'circle') return `<circle cx="${x}" cy="${y}" r="${r}" ${a}/>`;
    if (f.shape === 'square') { const s = r * 0.88; return `<rect x="${x - s}" y="${y - s}" width="${2 * s}" height="${2 * s}" ${a}/>`; }
    if (f.shape === 'diamond') return `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" ${a}/>`;
    // triangle, pointing up at 0°, rotated around its centre
    const pts = [[0, -1.05 * r], [0.78 * r, 0.75 * r], [-0.78 * r, 0.75 * r]].map(([dx, dy]) => `${(x + dx).toFixed(2)},${(y + dy).toFixed(2)}`).join(' ');
    return `<polygon points="${pts}" transform="rotate(${f.rot} ${x} ${y})" ${a}/>`;
  }
  function figSvg(f, label) {
    const r = RADIUS[f.count][f.size];
    const items = LAYOUT[f.count].map(([x, y]) => shapeSvg(f, x, y, r)).join('');
    const [dx, dy] = CORNERS[f.dot];
    return `<svg class="fig" viewBox="0 0 100 100" role="img" aria-label="${esc(label)}"><rect class="fig-frame" x="2" y="2" width="96" height="96" rx="8"/>${items}<circle class="fig-dot" cx="${dx}" cy="${dy}" r="5.5"/></svg>`;
  }

  const matrizes = {
    id: 'matrizes', name: 'Matrizes de Figuras', paceRef: 20,
    generate: G.figures,
    instructions: '<p>Observe a sequência de figuras. Descubra a regra e escolha a figura que completa a sequência.</p>',
    body: (q) => `<div class="fig-seq">${q.seq.map((f, j) => figSvg(f, `Figura ${j + 1}: ${G.describeFigure(f)}`)).join('')}<div class="fig fig-q" role="img" aria-label="Figura em falta">?</div></div>`,
    optsClass: 'opts-fig',
    optHtml: (o) => `<span class="opt-letter">${o.label}</span>${figSvg(o.fig, '')}`,
    optAria: (o) => `Opção ${o.label}: ${G.describeFigure(o.fig)}`,
    explain: (q) => {
      const c = q.options.find((o) => o.value === q.correct);
      return `<p>Regra: ${esc(cap(q.rule))}.</p><p>Resposta: ${c.label} — ${esc(G.describeFigure(c.fig))}.</p>`;
    }
  };

  /* ---------- Verbal, numeric and attention tests ---------- */

  const analogias = {
    id: 'analogias', name: 'Analogias', paceRef: 15,
    generate: G.analogies,
    instructions: `<p>Descubra a relação entre as duas primeiras palavras e escolha a palavra que tem a mesma relação com a terceira.</p>
      <p><strong>Exemplo:</strong> <em>Dia</em> está para <em>noite</em> como <em>branco</em> está para … <strong>preto</strong> (são palavras de sentido contrário).</p>`,
    body: (q) => `<p class="analogy"><b>${esc(cap(q.a))}</b> está para <b>${esc(q.b)}</b> como <b>${esc(q.c)}</b> está para <span class="term-q">?</span></p>`,
    optsClass: 'opts-words',
    optAria: (o) => o.label,
    explain: (q) => `<p>Relação: ${esc(q.rel)}.</p><p><b>${esc(cap(q.a))}</b> → <b>${esc(q.b)}</b>, tal como <b>${esc(q.c)}</b> → <b>${esc(q.correct)}</b>.</p>`
  };

  const sinonimos = {
    id: 'sinonimos', name: 'Sinónimos e Antónimos', paceRef: 10,
    generate: G.synonyms,
    instructions: '<p>Leia com atenção se a pergunta pede um <strong>sinónimo</strong> (palavra com o mesmo significado) ou um <strong>antónimo</strong> (palavra com o significado contrário). Algumas opções são parecidas na forma, mas não no significado.</p>',
    body: (q) => `<p class="word-q">Qual é o <strong class="${q.kind === 'sin' ? 'k-sin' : 'k-ant'}">${q.kind === 'sin' ? 'sinónimo' : 'antónimo'}</strong> de <b class="word">${esc(q.word)}</b>?</p>`,
    optsClass: 'opts-words',
    optAria: (o) => o.label,
    explain: (q) => `<p>${q.kind === 'sin'
      ? `<b>${esc(cap(q.word))}</b> significa o mesmo que <b>${esc(q.correct)}</b>.`
      : `O contrário de <b>${esc(q.word)}</b> é <b>${esc(q.correct)}</b>.`}</p>${q.note ? `<p class="muted">${esc(q.note)}</p>` : ''}`
  };

  const textos = {
    id: 'textos', name: 'Compreensão de Textos', paceRef: 30,
    generate: G.texts,
    instructions: `<p>Leia o texto e diga se a afirmação é <strong>Verdadeira</strong>, <strong>Falsa</strong> ou se <strong>Não se pode dizer</strong>. Use só a informação do texto, mesmo que saiba outras coisas sobre o assunto.</p>
      <p><strong>Verdadeiro:</strong> o texto diz ou permite concluir isso. <strong>Falso:</strong> o texto diz o contrário. <strong>Não se pode dizer:</strong> o texto não dá informação suficiente.</p>`,
    body: (q) => `<div class="passage"><p class="passage-t">${esc(q.title)}</p><p>${esc(q.text)}</p></div>
      <p class="concl"><strong>Afirmação:</strong> ${esc(q.statement)}</p>`,
    optsClass: 'opts-text',
    optAria: (o) => o.label,
    explain: (q) => `<p>${esc(q.why)}</p><p class="muted">Resposta: ${esc(G.TF_LABEL[q.correct])}.</p>`
  };

  const dataTable = (t) => `<div class="table-wrap dt-wrap"><table class="dt"><caption>${esc(t.title)}</caption>
    <thead><tr>${t.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr>${r.map((c, j) => (j === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;

  const numerico = {
    id: 'numerico', name: 'Raciocínio Numérico', paceRef: 45,
    generate: G.numeric,
    instructions: `<p>Use os dados da tabela para responder. Pode usar papel e caneta, mas não calculadora.</p>
      <p><strong>Lembre-se:</strong> variação percentual = (valor final − valor inicial) ÷ valor inicial × 100.</p>`,
    body: (q) => `${dataTable(q.table)}<p class="concl">${esc(q.question)}</p>`,
    optsClass: 'opts-wide',
    optAria: (o) => 'Opção ' + o.label,
    explain: (q) => q.steps.map((s) => `<p class="mono">${esc(s)}</p>`).join('')
  };

  const D2_X = { 1: [15], 2: [10, 20] };
  function d2Svg(it, label) {
    const marks = (n, y1, y2) => (D2_X[n] || []).map((x) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`).join('');
    return `<svg class="d2" viewBox="0 0 30 64" role="img" aria-label="${esc(label)}">${marks(it.up, 3, 12)}<text x="15" y="33" text-anchor="middle" dominant-baseline="central">${it.l}</text>${marks(it.down, 52, 61)}</svg>`;
  }
  const d2Label = (it, j) => {
    const t = (n) => (n === 1 ? '1 traço' : n + ' traços');
    return `Símbolo ${j + 1}: ${it.l}, ${t(it.up)} em cima e ${t(it.down)} em baixo`;
  };

  const atencao = {
    id: 'atencao', name: 'Atenção', paceRef: 15,
    generate: G.attention,
    instructions: `<p>Conte quantas letras <strong>d</strong> têm <strong>exatamente 2 traços</strong> no total (2 em cima, 2 em baixo, ou 1 em cima e 1 em baixo). Não conte as letras <strong>p</strong>, nem os <strong>d</strong> com 1, 3 ou 4 traços.</p>`,
    body: (q) => `<div class="d2-row">${q.items.map((it, j) => d2Svg(it, d2Label(it, j))).join('')}</div>`,
    optsClass: 'opts-count',
    optAria: (o) => o.label + (o.value === 1 ? ' letra' : ' letras'),
    explain: (q) => {
      const row = q.items.map((it, j) => `<span class="d2-cell${G.isTarget(it) ? ' d2-hit' : ''}">${d2Svg(it, d2Label(it, j))}</span>`).join('');
      const traps = q.items.map((it, j) => (it.l === 'p' && it.up + it.down === 2 ? j + 1 : 0)).filter(Boolean);
      return `<div class="d2-row d2-x">${row}</div>
        <p>${q.targets.length ? `Contam as posições ${q.targets.map((j) => j + 1).join(', ')} (total ${q.targets.length}).` : 'Nenhuma letra d tem exatamente 2 traços (total 0).'}</p>
        ${traps.length ? `<p class="muted">Armadilhas: nas posições ${traps.join(', ')} há um p com 2 traços, que não conta.</p>` : ''}`;
    }
  };

  /* Edit this array to hide or reorder tests. */
  const TESTS = [numerica, percetiva, espacial, seriesMod, codigos, silogismos, matrizes, analogias, sinonimos, textos, numerico, atencao];

  /* ======================= State & storage ======================= */

  let storageOK = true;
  const defaultState = () => ({ v: 1, active: null, settings: { timer: false, minutes: 5, target: 90 }, tabs: {}, history: {} });
  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      const d = defaultState();
      return { v: 1, active: s.active || null, settings: Object.assign(d.settings, s.settings || {}), tabs: s.tabs || {}, history: s.history || {} };
    } catch (e) { storageOK = false; return defaultState(); }
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); storageOK = true; }
    catch (e) { storageOK = false; }
    const note = document.getElementById('storage-note');
    if (note) note.hidden = storageOK;
  }
  let state = load();

  const defaultSeed = (id) => G.DEFAULT_SEEDS[id] || 1;
  const freshTab = (seed) => ({ seed, answers: {}, skipped: {}, finished: false, reason: null, timer: { left: null, total: null, used: false } });
  function tabState(id) {
    let t = state.tabs[id];
    if (!t || typeof t.seed !== 'number') t = state.tabs[id] = freshTab(defaultSeed(id));
    t.answers = t.answers || {}; t.skipped = t.skipped || {}; t.timer = t.timer || { left: null, total: null, used: false };
    return t;
  }

  const qcache = {};
  function questions(m) {
    const ts = tabState(m.id);
    const c = qcache[m.id];
    if (c && c.seed === ts.seed) return c.qs;
    let qs;
    try { qs = m.generate(ts.seed); }
    catch (e) { ts.seed = defaultSeed(m.id); qs = m.generate(ts.seed); }
    qcache[m.id] = { seed: ts.seed, qs };
    // drop stored answers that no longer fit the data
    Object.keys(ts.answers).forEach((i) => { const a = ts.answers[i]; if (!qs[i] || !a || !qs[i].options[a.o]) delete ts.answers[i]; });
    return qs;
  }

  function stats(m) {
    const ts = tabState(m.id), qs = questions(m);
    let answered = 0, correct = 0, ms = 0;
    Object.keys(ts.answers).forEach((i) => {
      const a = ts.answers[i];
      answered++; ms += a.ms || 0;
      if (G.isCorrect(qs[i], a.o)) correct++;
    });
    const skipped = Object.keys(ts.skipped).filter((i) => !ts.answers[i]).length;
    return {
      answered, correct, wrong: answered - correct, skipped,
      unanswered: N - answered,
      acc: answered ? correct / answered : null,
      avg: answered ? ms / answered : null
    };
  }

  function goalInfo(st) {
    if (st.answered < 10) return null;
    const met = st.acc * 100 >= state.settings.target;
    return { met, text: met ? '✓ Meta de precisão atingida' : '! Abaixo da meta de precisão' };
  }

  /* ======================= DOM ======================= */

  const $ = (id) => document.getElementById(id);
  const tabsEl = $('tabs'), panel = $('panel');
  const mod = (id) => TESTS.find((t) => t.id === id);
  let active = mod(state.active) ? state.active : TESTS[0].id;

  // Time per answer: measured from the previous answer or skip, or from when the tab was shown.
  let mark = performance.now(), hiddenAt = null;

  function renderTabs() {
    tabsEl.innerHTML = TESTS.map((m) => {
      const sel = m.id === active;
      return `<button type="button" role="tab" class="tab" id="tab-${m.id}" data-tab="${m.id}" aria-controls="panel" aria-selected="${sel}" tabindex="${sel ? 0 : -1}">
        <span class="tab-name">${esc(m.name)}</span><span class="badge" id="badge-${m.id}"></span></button>`;
    }).join('');
    TESTS.forEach((m) => updateBadge(m));
  }

  function updateBadge(m) {
    const b = $('badge-' + m.id);
    if (!b) return;
    const st = stats(m);
    b.textContent = `${st.correct}/${st.answered}`;
    b.setAttribute('aria-label', `pontuação ${st.correct} de ${st.answered}`);
    b.classList.toggle('done', tabState(m.id).finished);
  }

  function cardHtml(m, q, i) {
    const opts = q.options.map((o, k) => `<button type="button" class="opt" data-k="${k}" aria-label="${esc(m.optAria ? m.optAria(o, q) : 'Opção ' + o.label)}">
        <span class="opt-c">${m.optHtml ? m.optHtml(o, q) : esc(o.label)}</span><span class="mark" aria-hidden="true"></span></button>`).join('');
    return `<article class="q" id="q${i}" data-i="${i}" aria-labelledby="q${i}-t">
      <div class="q-head"><h3 id="q${i}-t">Q${i + 1}</h3><span class="q-status" id="q${i}-s"></span></div>
      <div class="q-body">${m.body(q, i)}</div>
      <div class="opts ${m.optsClass || ''}" role="group" aria-label="Respostas da pergunta ${i + 1}">${opts}</div>
      <div class="q-actions">
        <button type="button" class="btn btn-small btn-skip" aria-label="Saltar a pergunta ${i + 1}"><span aria-hidden="true">⏭</span> Saltar</button>
        <button type="button" class="btn btn-small btn-explain" aria-expanded="false" aria-controls="q${i}-x" hidden>Ver explicação</button>
      </div>
      <div class="explain" id="q${i}-x" hidden></div>
    </article>`;
  }

  function paintCard(m, i) {
    const card = $('q' + i);
    if (!card) return;
    const ts = tabState(m.id), q = questions(m)[i];
    const a = ts.answers[i];
    const locked = !!a || ts.finished;
    const ck = G.correctIndex(q);
    card.classList.toggle('answered', !!a);
    card.classList.toggle('locked', locked);
    card.querySelectorAll('.opt').forEach((b) => {
      const k = Number(b.dataset.k);
      const base = m.optAria ? m.optAria(q.options[k], q) : 'Opção ' + q.options[k].label;
      let cls = '', sym = '', extra = '';
      if (locked) {
        if (a && a.o === k && k === ck) { cls = 'is-ok'; sym = '✓'; extra = ' — a sua resposta, certa'; }
        else if (a && a.o === k) { cls = 'is-bad'; sym = '✗'; extra = ' — a sua resposta, errada'; }
        else if (k === ck) { cls = 'is-ok is-reveal'; sym = '✓'; extra = ' — resposta correta'; }
      }
      b.classList.remove('is-ok', 'is-bad', 'is-reveal');
      if (cls) cls.split(' ').forEach((c) => b.classList.add(c));
      b.querySelector('.mark').textContent = sym;
      b.setAttribute('aria-label', base + extra);
      b.setAttribute('aria-disabled', locked ? 'true' : 'false');
    });
    const status = $('q' + i + '-s');
    const skipped = !!ts.skipped[i] && !a;
    if (a) status.innerHTML = G.isCorrect(q, a.o) ? '<span class="st st-ok">✓ Certa</span>' : '<span class="st st-bad">✗ Errada</span>';
    else if (ts.finished) status.innerHTML = '<span class="st st-skip">— Não respondida</span>';
    else if (skipped) status.innerHTML = '<span class="st st-skip"><span aria-hidden="true">⏭</span> saltada</span>';
    else status.innerHTML = '';
    card.classList.toggle('skipped', skipped);
    card.querySelector('.btn-skip').hidden = locked || skipped;
    card.querySelector('.btn-explain').hidden = !locked;
  }

  function setLine(m) {
    const ts = tabState(m.id);
    if (ts.seed === defaultSeed(m.id)) return '<p class="set-line">Conjunto original.</p>';
    return `<p class="set-line">Conjunto novo (semente ${ts.seed}). <button type="button" class="link" id="btn-original">Voltar ao conjunto original</button></p>`;
  }

  function renderPanel() {
    const m = mod(active);
    const qs = questions(m);
    panel.setAttribute('aria-labelledby', 'tab-' + m.id);
    panel.innerHTML = `
      <h2 class="panel-title">${esc(m.name)}</h2>
      <div class="info">${m.instructions}</div>
      ${setLine(m)}
      <div id="results"></div>
      <div class="qlist">${qs.map((q, i) => cardHtml(m, q, i)).join('')}</div>
      <details class="history" id="history"><summary>Histórico deste teste (últimas 10 tentativas)</summary><div id="history-body"></div></details>`;
    qs.forEach((_, i) => paintCard(m, i));
    renderResults(m);
    renderHistory(m);
    updateFooter();
    mark = performance.now();
    startTimer();
  }

  function hintFor(m, st) {
    if (!st.answered) return 'Não respondeu a nenhuma pergunta.';
    const fast = st.avg <= m.paceRef * 1000;
    const below = st.acc * 100 < state.settings.target;
    let h;
    if (below && fast) h = 'Muitas respostas erradas e rápidas: tente abrandar.';
    else if (below) h = 'Precisão abaixo da meta: leia cada pergunta com calma e reveja as explicações das erradas.';
    else if (!fast) h = 'Boa precisão: pode tentar acelerar.';
    else h = 'Boa precisão e bom ritmo: mantenha.';
    if (st.unanswered) h += ` Ficaram ${st.unanswered} perguntas por responder.`;
    return h;
  }

  function renderResults(m) {
    const box = $('results');
    const ts = tabState(m.id);
    if (!ts.finished) { box.innerHTML = ''; return; }
    const st = stats(m), g = goalInfo(st);
    const timed = ts.timer.used && ts.timer.total;
    box.innerHTML = `<section class="results" tabindex="-1" aria-labelledby="res-t">
      <h3 id="res-t">Resultado${ts.reason === 'time' ? ' — o tempo terminou' : ''}</h3>
      <p class="res-big">${st.correct} / ${N} <span>(${Math.round(st.correct / N * 100)}%)</span></p>
      <dl class="stats-grid">
        <div><dt>Precisão</dt><dd>${pct(st.acc)}</dd></div>
        <div><dt>Respondidas</dt><dd>${st.answered}</dd></div>
        <div><dt>Erradas</dt><dd>${st.wrong}</dd></div>
        <div><dt>Saltadas / por responder</dt><dd>${st.unanswered}</dd></div>
        <div><dt>Tempo médio por resposta</dt><dd>${secs(st.avg)}</dd></div>
        ${timed ? `<div><dt>Tempo usado</dt><dd>${mmss(ts.timer.total - ts.timer.left)}</dd></div>` : ''}
      </dl>
      ${g ? `<p class="goal ${g.met ? 'goal-ok' : 'goal-low'}">${g.text} (meta: ${state.settings.target}%)</p>` : ''}
      <p class="hint">${esc(hintFor(m, st))}</p>
      <p><button type="button" class="btn" id="btn-again">Recomeçar este teste</button></p>
    </section>`;
  }

  function renderHistory(m) {
    const list = state.history[m.id] || [];
    const body = $('history-body');
    if (!list.length) { body.innerHTML = '<p class="muted">Ainda não há tentativas terminadas neste teste.</p>'; return; }
    const fmt = (d) => { try { return new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return new Date(d).toISOString().slice(0, 16); } };
    body.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th scope="col">Data</th><th scope="col">Precisão</th><th scope="col">Tempo médio</th><th scope="col">Certas / respondidas</th></tr></thead>
      <tbody>${list.map((h) => `<tr><td>${esc(fmt(h.d))}</td><td>${pct(h.acc)}</td><td>${secs(h.avg)}</td><td>${h.c} / ${h.a}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function updateFooter() {
    const m = mod(active), st = stats(m), ts = tabState(m.id), g = goalInfo(st);
    $('bar-score').textContent = `Pontuação: ${st.correct} / ${st.answered}`;
    $('bar-progress').textContent = `Respondidas ${st.answered} de ${N}`;
    $('bar-acc').textContent = `Precisão ${pct(st.acc)}`;
    const goal = $('bar-goal');
    goal.textContent = g ? g.text : '';
    goal.className = 'bar-goal' + (g ? (g.met ? ' goal-ok' : ' goal-low') : '');
    $('stats-grid').innerHTML = [
      ['Precisão', pct(st.acc)], ['Respondidas', st.answered], ['Certas', st.correct],
      ['Erradas', st.wrong], ['Saltadas', st.skipped], ['Tempo médio por resposta', secs(st.avg)]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('stats-goal').textContent = g ? `${g.text} (meta: ${state.settings.target}%)` : `A mensagem da meta (${state.settings.target}%) aparece a partir de 10 respostas.`;
    $('btn-finish').disabled = ts.finished;
    updateTimerUI();
    updateBadge(m);
  }

  /* ======================= Actions ======================= */

  function answer(i, k) {
    const m = mod(active), ts = tabState(m.id);
    if (ts.finished || ts.answers[i]) return;
    const now = performance.now();
    const ms = Math.min(Math.max(0, now - mark), MAX_ANSWER_MS);
    mark = now;
    ts.answers[i] = { o: k, ms: Math.round(ms) };
    delete ts.skipped[i];
    save();
    paintCard(m, i);
    updateFooter();
    if (Object.keys(ts.answers).length === N) finish('all');
  }

  function skip(i) {
    const m = mod(active), ts = tabState(m.id);
    if (ts.finished || ts.answers[i]) return;
    ts.skipped[i] = true;
    mark = performance.now();
    save();
    paintCard(m, i);
    updateFooter();
    // move focus to the next open question
    for (let j = 1; j <= N; j++) {
      const n = (i + j) % N;
      if (!ts.answers[n] && !ts.skipped[n]) { const b = document.querySelector(`#q${n} .opt`); if (b) b.focus(); break; }
    }
  }

  function finish(reason) {
    const m = mod(active), ts = tabState(m.id);
    if (ts.finished) return;
    ts.finished = true; ts.reason = reason;
    stopTimer();
    const st = stats(m);
    if (st.answered > 0) {
      const list = state.history[m.id] = state.history[m.id] || [];
      list.unshift({ d: Date.now(), acc: st.acc, avg: st.avg, c: st.correct, a: st.answered, w: st.wrong });
      list.splice(10);
    }
    save();
    questions(m).forEach((_, i) => paintCard(m, i));
    renderResults(m);
    renderHistory(m);
    updateFooter();
    const res = panel.querySelector('.results');
    if (res) {
      res.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      res.focus({ preventScroll: true });
    }
  }

  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasAnswers = (ts) => Object.keys(ts.answers).length > 0 || Object.keys(ts.skipped).length > 0;

  function resetTab(newSeed, ask) {
    const m = mod(active), ts = tabState(m.id);
    if (ask && hasAnswers(ts) && !window.confirm(ask)) return;
    stopTimer();
    state.tabs[m.id] = freshTab(newSeed == null ? ts.seed : newSeed);
    save();
    renderPanel();
    panel.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function randomSeed() {
    try { const a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0] || 1; }
    catch (e) { return (Math.floor(Math.random() * 4294967295) >>> 0) || 1; }
  }

  function selectTab(id, focus) {
    if (!mod(id) || id === active) { if (focus) $('tab-' + id).focus(); return; }
    stopTimer();
    active = id; state.active = id;
    save();
    TESTS.forEach((m) => {
      const b = $('tab-' + m.id);
      const sel = m.id === active;
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
    });
    const tab = $('tab-' + id);
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    renderPanel();
  }

  /* ======================= Timer ======================= */

  let tickId = null, lastTick = 0, lastSave = 0;
  function startTimer() {
    stopTimer();
    const m = mod(active), ts = tabState(m.id);
    if (!state.settings.timer || ts.finished) { updateTimerUI(); return; }
    if (ts.timer.left == null) { ts.timer.total = ts.timer.left = state.settings.minutes * 60000; }
    ts.timer.used = true;
    lastTick = performance.now();
    tickId = setInterval(tick, 250);
    updateTimerUI();
  }
  function stopTimer() { if (tickId) { clearInterval(tickId); tickId = null; } }
  function tick() {
    const now = performance.now(), dt = now - lastTick;
    lastTick = now;
    if (document.hidden) return;
    const ts = tabState(active);
    ts.timer.left = Math.max(0, ts.timer.left - dt);
    updateTimerUI();
    if (ts.timer.left <= 0) { finish('time'); return; }
    if (now - lastSave > 3000) { lastSave = now; save(); }
  }
  function updateTimerUI() {
    const el = $('bar-timer'), ts = tabState(active);
    const show = state.settings.timer && ts.timer.left != null && !ts.finished;
    el.hidden = !show;
    if (show) {
      el.textContent = '⏱ ' + mmss(ts.timer.left);
      el.setAttribute('aria-label', 'Tempo restante ' + mmss(ts.timer.left));
      el.classList.toggle('low', ts.timer.left < 60000);
    }
  }

  /* ======================= Events ======================= */

  panel.addEventListener('click', (e) => {
    const t = e.target;
    const opt = t.closest('.opt');
    if (opt) { const card = opt.closest('.q'); answer(Number(card.dataset.i), Number(opt.dataset.k)); return; }
    const sk = t.closest('.btn-skip');
    if (sk) { skip(Number(sk.closest('.q').dataset.i)); return; }
    const ex = t.closest('.btn-explain');
    if (ex) {
      const card = ex.closest('.q'), i = Number(card.dataset.i), box = $('q' + i + '-x');
      const open = ex.getAttribute('aria-expanded') !== 'true';
      if (open && !box.innerHTML) box.innerHTML = mod(active).explain(questions(mod(active))[i]);
      box.hidden = !open;
      ex.setAttribute('aria-expanded', String(open));
      ex.textContent = open ? 'Esconder explicação' : 'Ver explicação';
      return;
    }
    if (t.closest('#btn-original')) {
      resetTab(defaultSeed(active), 'Voltar ao conjunto original? As respostas deste separador serão apagadas.');
      return;
    }
    if (t.closest('#btn-again')) { $('btn-reset').click(); }
  });

  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) selectTab(b.dataset.tab); });
  tabsEl.addEventListener('keydown', (e) => {
    const ids = TESTS.map((m) => m.id);
    let idx = ids.indexOf(active);
    if (e.key === 'ArrowRight') idx = (idx + 1) % ids.length;
    else if (e.key === 'ArrowLeft') idx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') idx = 0;
    else if (e.key === 'End') idx = ids.length - 1;
    else return;
    e.preventDefault();
    selectTab(ids[idx], true);
  });

  $('btn-reset').addEventListener('click', () => {
    if (!window.confirm('Recomeçar este teste? As respostas deste separador serão apagadas (os outros testes não mudam).')) return;
    resetTab(null, null);
  });
  $('btn-new').addEventListener('click', () => {
    let s; do { s = randomSeed(); } while (s === defaultSeed(active));
    resetTab(s, 'Gerar um novo conjunto de 30 perguntas? As respostas deste separador serão apagadas.');
  });
  $('btn-finish').addEventListener('click', () => {
    const ts = tabState(active), st = stats(mod(active));
    if (ts.finished) return;
    const msg = st.unanswered
      ? `Terminar esta tentativa? As ${st.unanswered} perguntas por responder não contam como erradas.`
      : 'Terminar esta tentativa?';
    if (window.confirm(msg)) finish('manual');
  });
  $('btn-stats').addEventListener('click', (e) => {
    const p = $('stats-panel'), open = p.hidden;
    p.hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', String(open));
    syncBodyPadding();
  });

  const timerOn = $('timer-on'), timerMin = $('timer-min'), target = $('target'), targetOut = $('target-out');
  timerOn.checked = !!state.settings.timer;
  timerMin.value = state.settings.minutes;
  target.value = state.settings.target;
  targetOut.textContent = state.settings.target + '%';
  timerOn.addEventListener('change', () => { state.settings.timer = timerOn.checked; save(); startTimer(); });
  timerMin.addEventListener('change', () => {
    const v = Math.min(120, Math.max(1, Math.round(Number(timerMin.value) || 5)));
    timerMin.value = v;
    state.settings.minutes = v;
    const ts = tabState(active);
    if (!hasAnswers(ts) && !ts.finished) ts.timer = { left: null, total: null, used: false };
    save();
    startTimer();
  });
  target.addEventListener('input', () => {
    state.settings.target = Number(target.value);
    targetOut.textContent = target.value + '%';
    updateFooter();
    if (tabState(active).finished) renderResults(mod(active));
  });
  target.addEventListener('change', save);

  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.hidden) hiddenAt = now;
    else if (hiddenAt != null) { mark += now - hiddenAt; hiddenAt = null; }
  });
  window.addEventListener('pagehide', save);

  // keep the last question visible above the fixed footer
  function syncBodyPadding() {
    const bar = document.querySelector('.bar');
    document.body.style.paddingBottom = (bar.offsetHeight + 16) + 'px';
  }
  window.addEventListener('resize', syncBodyPadding);

  /* ======================= Start ======================= */
  $('subtitle').textContent = `${N} perguntas por teste · foco na precisão e, depois, na rapidez`;
  renderTabs();
  renderPanel();
  syncBodyPadding();
  save();

  // small hook for automated checks (read-only helpers)
  window.PsicoApp = { TESTS, questions: (id) => questions(mod(id)), stats: (id) => stats(mod(id)) };
})();
