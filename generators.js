/*
 * generators.js — question generators and answer logic.
 * Works in the browser (window.Gen) and in Node (module.exports).
 * Every question is plain data: { options: [{value, label}], correct, ...test-specific fields }.
 * The correct answer always comes from this data, never from the DOM.
 */
(function (root) {
  'use strict';

  const N = 30; // questions per test

  /* ---------- Seeded random generator ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const r = mulberry32(seed);
    return {
      next: r,
      int: (a, b) => a + Math.floor(r() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      chance: (p) => r() < p,
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
    };
  }

  const range = (n) => Array.from({ length: n }, (_, i) => i);

  /** n values spread as evenly as possible over `values`, in random order. */
  function balanced(values, n, rng) {
    const out = [];
    const base = Math.floor(n / values.length);
    values.forEach((v) => { for (let i = 0; i < base; i++) out.push(v); });
    rng.shuffle(values).slice(0, n - out.length).forEach((v) => out.push(v));
    return rng.shuffle(out);
  }

  function maxRun(arr) {
    let best = 0, run = 0;
    arr.forEach((v, i) => { run = i > 0 && arr[i - 1] === v ? run + 1 : 1; best = Math.max(best, run); });
    return best;
  }

  const numOptions = (n) => range(n + 1).map((v) => ({ value: v, label: String(v) }));

  const DEFAULT_SEEDS = {
    numerica: 1101, percetiva: 2202, espacial: 3303, series: 4404,
    codigos: 5505, silogismos: 6606, matrizes: 7707,
    analogias: 8808, sinonimos: 9909, textos: 1212, numerico: 2323, atencao: 3434
  };

  /* ================= Test 1: Rapidez Numérica ================= */
  function numberSpeed(seed) {
    const rng = makeRng(seed);
    let kinds;
    do {
      kinds = rng.shuffle(range(N).map((i) => (i < N / 2 ? 'low' : 'high')));
    } while (maxRun(kinds) > 3);
    const hard = rng.shuffle(range(N).map((i) => i < 10));
    return kinds.map((kind, i) => {
      let dS, dL; // smaller and larger distance to the middle number
      if (hard[i]) { dS = rng.int(20, 420); dL = dS + rng.int(5, 20); }
      else { dS = rng.int(8, 250); dL = dS + rng.int(80, 899 - 2 * dS); }
      const span = dS + dL;
      const low = rng.int(100, 999 - span);
      const mid = kind === 'low' ? low + dS : low + dL;
      const high = low + span;
      const nums = rng.shuffle([low, mid, high]);
      return {
        low, mid, high, nums, kind, hard: hard[i],
        dLow: mid - low, dHigh: high - mid,
        correct: kind === 'low' ? low : high,
        options: nums.map((v) => ({ value: v, label: String(v) }))
      };
    });
  }

  /* ================= Test 2: Rapidez Percetiva ================= */
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const CONFUSABLE = [
    ['C', 'G'], ['O', 'Q'], ['I', 'L'], ['V', 'Y'], ['K', 'X'], ['S', 'Z'], ['U', 'V'], ['P', 'R'],
    ['E', 'F'], ['M', 'N'], ['B', 'D'], ['P', 'Q'], ['N', 'H'], ['J', 'I'], ['T', 'I']
  ];

  function casePair(x, y, rng) {
    const upperTop = rng.chance(0.5);
    const top = upperTop ? x.toUpperCase() : x.toLowerCase();
    const bottom = upperTop ? y.toLowerCase() : y.toUpperCase();
    return { top, bottom, match: top.toLowerCase() === bottom.toLowerCase() };
  }

  function perceptual(seed) {
    const rng = makeRng(seed);
    const counts = balanced(range(7), N, rng);
    return counts.map((k) => {
      const matchAt = new Set(rng.shuffle(range(6)).slice(0, k));
      const used = new Set();
      const free = (l) => !used.has(l);
      const pairs = new Array(6);
      range(6).filter((j) => !matchAt.has(j)).forEach((j) => {
        let x, y;
        const conf = CONFUSABLE.filter(([a, b]) => free(a) && free(b));
        if (conf.length && rng.chance(0.75)) {
          [x, y] = rng.pick(conf);
          if (rng.chance(0.5)) [x, y] = [y, x];
        } else {
          const pool = LETTERS.filter(free);
          x = rng.pick(pool);
          y = rng.pick(pool.filter((l) => l !== x));
        }
        used.add(x); used.add(y);
        pairs[j] = casePair(x, y, rng);
      });
      range(6).filter((j) => matchAt.has(j)).forEach((j) => {
        const x = rng.pick(LETTERS.filter(free));
        used.add(x);
        pairs[j] = casePair(x, x, rng);
      });
      return { pairs, correct: pairs.filter((p) => p.match).length, options: numOptions(6) };
    });
  }

  /* ================= Test 3: Visualização Espacial ================= */
  const ROTS = [0, 90, 180, 270];

  function spatial(seed) {
    const rng = makeRng(seed);
    const counts = balanced(range(5), N, rng);
    return counts.map((k) => {
      const okAt = new Set(rng.shuffle(range(4)).slice(0, k));
      const pairs = range(4).map((j) => {
        const top = { rot: rng.pick(ROTS), mirrored: rng.chance(0.5) };
        const same = okAt.has(j);
        const bottom = { rot: rng.pick(ROTS), mirrored: same ? top.mirrored : !top.mirrored };
        return { top, bottom, ok: top.mirrored === bottom.mirrored };
      });
      return { pairs, correct: pairs.filter((p) => p.ok).length, options: numOptions(4) };
    });
  }

  /* ================= Test 4: Séries Numéricas ================= */
  const SERIES_BUILD = {
    arith: (p, len) => range(len).map((i) => p.a + i * p.d),
    geo: (p, len) => range(len).map((i) => p.a * Math.pow(p.r, i)),
    alt: (p, len) => { const s = [p.a]; for (let i = 1; i < len; i++) s.push(s[i - 1] + (i % 2 ? p.d1 : p.d2)); return s; },
    grow: (p, len) => { const s = [p.a]; for (let i = 1; i < len; i++) s.push(s[i - 1] + p.d0 + (i - 1) * p.c); return s; },
    squares: (p, len) => range(len).map((i) => (p.s + i) * (p.s + i)),
    cubes: (p, len) => range(len).map((i) => Math.pow(p.s + i, 3)),
    muladd: (p, len) => { const s = [p.a]; for (let i = 1; i < len; i++) s.push(s[i - 1] * p.m + p.k); return s; },
    interleave: (p, len) => range(len).map((i) => (i % 2 === 0 ? p.a1 + (i / 2) * p.d1 : p.a2 + ((i - 1) / 2) * p.d2)),
    fib: (p, len) => { const s = [p.a, p.b]; for (let i = 2; i < len; i++) s.push(s[i - 1] + s[i - 2]); return s.slice(0, len); },
    double: (p, len) => { const s = [p.a]; for (let i = 1; i < len; i++) s.push(s[i - 1] + p.d * Math.pow(2, i - 1)); return s; }
  };

  const verb = (d) => (d >= 0 ? 'soma ' + d : 'subtrai ' + -d);

  const SERIES_KINDS = {
    add: (rng) => { const d = rng.int(2, 12); return { type: 'arith', len: rng.int(5, 7), p: { a: rng.int(1, 40), d }, text: `soma ${d} em cada passo` }; },
    sub: (rng) => {
      const d = rng.int(3, 12), len = rng.int(5, 7);
      return { type: 'arith', len, p: { a: rng.int(d * (len - 1) + 5, d * (len - 1) + 60), d: -d }, text: `subtrai ${d} em cada passo` };
    },
    mul: (rng) => {
      const r = rng.pick([2, 3]);
      return { type: 'geo', len: rng.int(5, 6), p: { a: r === 2 ? rng.int(1, 6) : rng.int(1, 3), r }, text: `multiplica por ${r} em cada passo` };
    },
    alt2: (rng) => {
      const d1 = rng.int(1, 12); let d2; do { d2 = rng.int(1, 12); } while (d2 === d1);
      return { type: 'alt', len: rng.int(6, 7), p: { a: rng.int(1, 30), d1, d2 }, text: `soma ${d1} e soma ${d2}, alternadamente` };
    },
    altpm: (rng) => {
      const d1 = rng.int(4, 12), b = rng.int(1, d1 - 1);
      return { type: 'alt', len: rng.int(6, 7), p: { a: rng.int(5, 40), d1, d2: -b }, text: `soma ${d1} e subtrai ${b}, alternadamente` };
    },
    grow: (rng) => {
      const d0 = rng.int(1, 5), c = rng.int(1, 3);
      return { type: 'grow', len: rng.int(5, 7), p: { a: rng.int(1, 20), d0, c }, text: `as diferenças aumentam ${c} a cada passo (+${d0}, +${d0 + c}, +${d0 + 2 * c}, …)` };
    },
    squares: (rng) => { const s = rng.int(1, 6); return { type: 'squares', len: rng.int(5, 7), p: { s }, text: `quadrados perfeitos: ${s}², ${s + 1}², ${s + 2}², …` }; },
    cubes: (rng) => { const s = rng.int(1, 3); return { type: 'cubes', len: rng.int(5, 6), p: { s }, text: `cubos: ${s}³, ${s + 1}³, ${s + 2}³, …` }; },
    muladd: (rng) => {
      const m = rng.pick([2, 2, 3]), k = rng.int(1, 5);
      return { type: 'muladd', len: m === 3 ? 5 : rng.int(5, 6), p: { a: rng.int(1, 5), m, k }, text: `multiplica por ${m} e soma ${k} em cada passo` };
    },
    interleave: (rng) => {
      const d1 = rng.int(2, 9); let d2; do { d2 = rng.pick([-1, 1]) * rng.int(1, 6); } while (d2 === d1);
      return {
        type: 'interleave', len: rng.int(6, 7), p: { a1: rng.int(1, 20), d1, a2: rng.int(30, 60), d2 },
        text: `duas séries intercaladas: nas posições ímpares (1.ª, 3.ª, 5.ª…) ${verb(d1)}; nas posições pares (2.ª, 4.ª, 6.ª…) ${verb(d2)}`
      };
    },
    fib: (rng) => { const a = rng.int(1, 6), b = rng.int(a, 9); return { type: 'fib', len: rng.int(6, 7), p: { a, b }, text: 'cada termo é a soma dos dois anteriores' }; },
    double: (rng) => { const d = rng.int(1, 4); return { type: 'double', len: 6, p: { a: rng.int(1, 20), d }, text: `as diferenças duplicam a cada passo (+${d}, +${2 * d}, +${4 * d}, …)` }; }
  };
  const SERIES_LEVELS = {
    easy: ['add', 'sub', 'mul'],
    medium: ['alt2', 'altpm', 'grow', 'squares', 'cubes', 'muladd'],
    hard: ['interleave', 'fib', 'double']
  };

  /**
   * All values for the hidden term that some rule of the catalogue (over wide parameter
   * ranges) accepts, given the visible terms. A good question has exactly one.
   * `vis` is the series with `null` at the hidden position.
   */
  function seriesCandidates(vis) {
    const len = vis.length, h = vis.indexOf(null), t0 = vis[0], out = new Set();
    const fits = (s) => s.every((v, i) => i === h || v === vis[i]);
    const tryP = (type, p) => { const s = SERIES_BUILD[type](p, len); if (fits(s)) out.add(s[h]); };
    for (let d = -60; d <= 60; d++) tryP('arith', { a: t0, d });
    for (let r = 2; r <= 5; r++) tryP('geo', { a: t0, r });
    for (let d1 = -40; d1 <= 40; d1++) for (let d2 = -40; d2 <= 40; d2++) tryP('alt', { a: t0, d1, d2 });
    for (let d0 = -30; d0 <= 30; d0++) for (let c = -10; c <= 10; c++) tryP('grow', { a: t0, d0, c });
    for (let s = 0; s <= 40; s++) tryP('squares', { s });
    for (let s = 0; s <= 20; s++) tryP('cubes', { s });
    for (let m = 2; m <= 4; m++) for (let k = -20; k <= 20; k++) tryP('muladd', { a: t0, m, k });
    // Interleaved series only count as a rule when the hidden term's sub-series keeps 2+ visible terms.
    if (range(len).filter((i) => i % 2 === h % 2).length >= 3) {
      for (let d1 = -40; d1 <= 40; d1++) for (let d2 = -40; d2 <= 40; d2++) {
        tryP('interleave', { a1: t0, d1, a2: h === 1 ? vis[3] - d2 : vis[1], d2 });
      }
    }
    tryP('fib', { a: t0, b: h === 1 ? vis[2] - t0 : vis[1] });
    for (let d = -30; d <= 30; d++) tryP('double', { a: t0, d });
    return out;
  }

  function seriesDistractors(seq, h, rng) {
    const c = seq[h];
    const nonneg = seq.every((v) => v >= 0);
    const tempt = [];
    if (h >= 2) tempt.push(seq[h - 1] + (seq[h - 1] - seq[h - 2])); // repeat the last step
    if (h <= seq.length - 3) tempt.push(seq[h + 1] - (seq[h + 2] - seq[h + 1])); // step taken from the right
    if (h >= 1 && h <= seq.length - 2) tempt.push(Math.round((seq[h - 1] + seq[h + 1]) / 2)); // average of neighbours
    let step = 1;
    for (let i = 1; i < seq.length; i++) if (i !== h && i - 1 !== h) { step = Math.abs(seq[i] - seq[i - 1]) || 1; break; }
    const near = rng.shuffle([1, -1, 2, -2, step, -step, step + 1, -(step + 1), 10, -10].map((k) => c + k));
    const pool = [];
    rng.shuffle(tempt).slice(0, 2).concat(near).forEach((v) => {
      if (Number.isInteger(v) && v !== c && (!nonneg || v >= 0) && !pool.includes(v)) pool.push(v);
    });
    return rng.shuffle(pool.slice(0, 4));
  }

  function series(seed) {
    const rng = makeRng(seed);
    const levels = rng.shuffle(
      range(10).map(() => 'easy').concat(range(12).map(() => 'medium'), range(8).map(() => 'hard'))
    );
    const queues = {
      easy: balanced(SERIES_LEVELS.easy, 10, rng),
      medium: balanced(SERIES_LEVELS.medium, 12, rng),
      hard: balanced(SERIES_LEVELS.hard, 8, rng)
    };
    const positions = balanced(range(5), N, rng);
    return levels.map((level, i) => {
      const kind = queues[level].pop();
      let q = null;
      for (let attempt = 0; attempt < 400 && !q; attempt++) {
        const r = SERIES_KINDS[kind](rng);
        const seq = SERIES_BUILD[r.type](r.p, r.len);
        const hidden = rng.int(1, r.len - 1);
        const vis = seq.map((v, j) => (j === hidden ? null : v));
        const cands = seriesCandidates(vis);
        if (cands.size !== 1 || !cands.has(seq[hidden])) continue;
        const dis = seriesDistractors(seq, hidden, rng);
        if (dis.length < 4) continue;
        const values = dis.slice();
        values.splice(positions[i], 0, seq[hidden]);
        q = {
          level, kind, type: r.type, params: r.p, seq, hidden, rule: r.text,
          correct: seq[hidden], options: values.map((v) => ({ value: v, label: String(v) }))
        };
      }
      if (!q) throw new Error('Não foi possível gerar a série ' + (i + 1));
      return q;
    });
  }

  /* ================= Test 5: Verificação de Códigos ================= */
  // No I, L, O, 0 or 1, so nothing is ambiguous in the font.
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');
  const SIMILAR = [['8', 'B'], ['5', 'S'], ['2', 'Z'], ['6', 'G'], ['M', 'N'], ['U', 'V'], ['E', 'F'], ['P', 'R'], ['C', 'G'], ['3', '8'], ['K', 'X'], ['V', 'W'], ['Q', 'D']];

  function diffPositions(a, b) {
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i);
    return out;
  }

  function buildCode(rng, n, hard) {
    const len = rng.int(8, 10);
    const A = range(len).map(() => rng.pick(CODE_CHARS));
    let nSwaps = 0;
    if (n >= 2 && rng.chance(0.4)) nSwaps = 1;
    if (n >= 4 && rng.chance(0.3)) nSwaps = 2;
    const nSubs = n - 2 * nSwaps;
    const used = new Array(len).fill(false);
    const swaps = [];
    for (let s = 0; s < nSwaps; s++) {
      const free = range(len - 1).filter((p) => !used[p] && !used[p + 1]);
      if (!free.length) return null;
      const p = rng.pick(free);
      used[p] = used[p + 1] = true;
      swaps.push(p);
    }
    const freeSub = range(len).filter((p) => !used[p]);
    if (freeSub.length < nSubs) return null;
    const subs = rng.shuffle(freeSub).slice(0, nSubs).sort((x, y) => x - y);
    const newChar = {};
    subs.forEach((p) => {
      if (hard) {
        const pr = rng.pick(SIMILAR);
        const [x, y] = rng.chance(0.5) ? pr : [pr[1], pr[0]];
        A[p] = x; newChar[p] = y;
      } else {
        let y; do { y = rng.pick(CODE_CHARS); } while (y === A[p]);
        newChar[p] = y;
      }
    });
    swaps.forEach((p) => { while (A[p] === A[p + 1]) A[p + 1] = rng.pick(CODE_CHARS); });
    const B = A.slice();
    swaps.forEach((p) => { B[p] = A[p + 1]; B[p + 1] = A[p]; });
    subs.forEach((p) => { B[p] = newChar[p]; });
    const a = A.join(''), b = B.join('');
    const diffs = diffPositions(a, b);
    if (diffs.length !== n) return null;
    return { a, b, hard, swaps: swaps.sort((x, y) => x - y), subs, diffs, correct: diffs.length, options: numOptions(5) };
  }

  function codes(seed) {
    const rng = makeRng(seed);
    const ns = balanced(range(6), N, rng);
    const hard = rng.shuffle(range(N).map((i) => i < 10));
    return ns.map((n, i) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const q = buildCode(rng, n, hard[i]);
        if (q) return q;
      }
      throw new Error('Não foi possível gerar o código ' + (i + 1));
    });
  }

  /* ================= Test 6: Silogismos ================= */
  const TERMS_INVENTED = [
    { s: 'zorb', p: 'zorbs', g: 'm' }, { s: 'klime', p: 'klimes', g: 'm' }, { s: 'pelo', p: 'pelos', g: 'm' },
    { s: 'gromo', p: 'gromos', g: 'm' }, { s: 'vilar', p: 'vilares', g: 'm' }, { s: 'taven', p: 'tavens', g: 'f' },
    { s: 'mupla', p: 'muplas', g: 'f' }, { s: 'zelva', p: 'zelvas', g: 'f' }, { s: 'quirma', p: 'quirmas', g: 'f' },
    { s: 'brima', p: 'brimas', g: 'f' }
  ];
  const TERMS_EVERYDAY = [
    { s: 'funcionário', p: 'funcionários', g: 'm' }, { s: 'dossiê', p: 'dossiês', g: 'm' },
    { s: 'atraso', p: 'atrasos', g: 'm' }, { s: 'reunião', p: 'reuniões', g: 'f' }, { s: 'fatura', p: 'faturas', g: 'f' }
  ];
  const PROPS = [
    'o alarme toca', 'a porta abre', 'a luz acende', 'o relatório é aprovado', 'o sistema reinicia',
    'a reunião é adiada', 'o prazo é alargado', 'o zorb brilha', 'a taven canta', 'o dossiê é arquivado'
  ];

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const art = (t) => (t.g === 'm' ? 'um' : 'uma');
  const SAY = {
    all: (x, y) => `${x.g === 'm' ? 'Todos os' : 'Todas as'} ${x.p} são ${y.p}.`,
    none: (x, y) => `${x.g === 'm' ? 'Nenhum' : 'Nenhuma'} ${x.s} é ${art(y)} ${y.s}.`,
    some: (x, y) => `${x.g === 'm' ? 'Alguns' : 'Algumas'} ${x.p} são ${y.p}.`,
    someOne: (x, y) => `${x.g === 'm' ? 'Algum' : 'Alguma'} ${x.s} é ${art(y)} ${y.s}.`
  };

  // p: premises, c: conclusion, as [quantifier, X, Y] over letters A, B, C.
  const SYL_TEMPLATES = [
    { id: 'T1', answer: 'V', p: [['all', 'A', 'B'], ['all', 'B', 'C']], c: ['all', 'A', 'C'],
      explain: 'Se todos os A são B e todos os B são C, então todos os A são C.' },
    { id: 'T2', answer: 'N', p: [['all', 'A', 'B'], ['all', 'B', 'C']], c: ['all', 'C', 'A'],
      explain: 'Todos os A estão dentro de C, mas pode haver C que não são A: a inversão não é garantida.' },
    { id: 'T3', answer: 'V', p: [['all', 'A', 'B'], ['none', 'B', 'C']], c: ['none', 'A', 'C'],
      explain: 'Se todos os A são B e nenhum B é C, então nenhum A pode ser C.' },
    { id: 'T4', answer: 'F', p: [['all', 'A', 'B'], ['none', 'B', 'C']], c: ['someOne', 'A', 'C'],
      explain: 'Todos os A são B e nenhum B é C, logo nenhum A é C: a conclusão contradiz as premissas.' },
    { id: 'T5', answer: 'V', p: [['some', 'A', 'B'], ['all', 'B', 'C']], c: ['some', 'A', 'C'],
      explain: 'Os A que são B também são C, logo alguns A são C.' },
    { id: 'T6', answer: 'N', p: [['some', 'A', 'B'], ['some', 'B', 'C']], c: ['some', 'A', 'C'],
      explain: 'Os B que são A podem não ser os mesmos B que são C: não se pode concluir.' },
    { id: 'T7', answer: 'V', p: [['none', 'A', 'B'], ['all', 'C', 'B']], c: ['none', 'C', 'A'],
      explain: 'Todos os C são B e nenhum B é A, logo nenhum C é A.' },
    { id: 'T8', answer: 'F', p: [['none', 'A', 'B'], ['some', 'C', 'A']], c: ['all', 'C', 'B'],
      explain: 'Os C que são A não são B, logo nem todos os C são B: a conclusão é falsa.' },
    { id: 'C1', answer: 'V', cond: true,
      explain: 'Se P leva a Q e Q leva a R, e P acontece, então R também acontece.' },
    { id: 'C2', answer: 'N', cond: true,
      explain: 'R pode acontecer por outra razão: saber que R aconteceu não garante P (é o erro de “afirmar o consequente”).' }
  ];
  const SYL_ANSWER_LABEL = { V: 'Verdadeira', F: 'Falsa', N: 'Não se pode concluir' };

  function syllogisms(seed) {
    const rng = makeRng(seed);
    const byId = Object.fromEntries(SYL_TEMPLATES.map((t) => [t.id, t]));
    const nForms = rng.shuffle(['T2', 'T6', 'C2']);
    const list = []
      .concat(...['T1', 'T3', 'T5', 'T7', 'C1'].map((id) => [id, id]))     // 10 × Verdadeira
      .concat(...['T4', 'T8'].map((id) => [id, id, id, id, id]))            // 10 × Falsa
      .concat(nForms.map((id, k) => Array(k === 0 ? 4 : 3).fill(id)).flat()); // 10 × Não se pode concluir
    const options = ['V', 'F', 'N'].map((v) => ({ value: v, label: SYL_ANSWER_LABEL[v] }));
    return rng.shuffle(list).map((id) => {
      const t = byId[id];
      if (t.cond) {
        const [P, Q, R] = rng.shuffle(PROPS).slice(0, 3);
        const premises = [`Se ${P}, então ${Q}.`, `Se ${Q}, então ${R}.`, cap(id === 'C1' ? P : R) + '.'];
        const conclusion = cap(id === 'C1' ? R : P) + '.';
        return { template: id, cond: true, props: { P, Q, R }, premises, conclusion, explain: t.explain, correct: t.answer, options };
      }
      let terms = rng.shuffle(TERMS_INVENTED).slice(0, 3);
      if (rng.chance(0.3)) terms[rng.int(0, 2)] = rng.pick(TERMS_EVERYDAY);
      const map = { A: terms[0], B: terms[1], C: terms[2] };
      const premises = t.p.map(([qf, x, y]) => SAY[qf](map[x], map[y]));
      const conclusion = SAY[t.c[0]](map[t.c[1]], map[t.c[2]]);
      return {
        template: id, logic: { p: t.p, c: t.c }, terms: map, premises, conclusion,
        explain: t.explain, correct: t.answer, options
      };
    });
  }

  /* ================= Test 7: Matrizes de Figuras ================= */
  const SHAPES = ['circle', 'square', 'triangle', 'diamond'];
  const FILLS = ['empty', 'striped', 'filled'];
  const FIG_RULES = ['rotation', 'count', 'fill', 'shape', 'dot'];
  const SHAPE_NAME = { circle: ['círculo', 'círculos'], square: ['quadrado', 'quadrados'], triangle: ['triângulo', 'triângulos'], diamond: ['losango', 'losangos'] };
  const FILL_NAME = { empty: ['vazio', 'vazios'], striped: ['riscado', 'riscados'], filled: ['cheio', 'cheios'] };
  const SIZE_NAME = { small: ['pequeno', 'pequenos'], large: ['grande', 'grandes'] };
  const POINTS = { 0: 'para cima', 90: 'para a direita', 180: 'para baixo', 270: 'para a esquerda' };
  const CORNER_NAME = ['superior esquerdo', 'superior direito', 'inferior direito', 'inferior esquerdo'];

  const mod = (a, m) => ((a % m) + m) % m;

  function figureAt(base, rules, i) {
    const f = Object.assign({}, base);
    rules.forEach((r) => {
      if (r.type === 'rotation') f.rot = mod(base.rot + r.step * i, 360);
      if (r.type === 'count') f.count = base.count + r.step * i;
      if (r.type === 'fill') f.fill = FILLS[(FILLS.indexOf(base.fill) + i) % FILLS.length];
      if (r.type === 'shape') f.shape = SHAPES[(SHAPES.indexOf(base.shape) + i) % SHAPES.length];
      if (r.type === 'dot') f.dot = (base.dot + i) % 4;
    });
    return f;
  }

  /** Visible attributes only: rotation matters for triangles only. */
  const figKey = (f) => [f.shape, f.fill, f.count, f.size, f.shape === 'triangle' ? f.rot : 0, f.dot].join('|');

  function figDiffCount(f, g) {
    let n = 0;
    ['shape', 'fill', 'count', 'size', 'dot'].forEach((k) => { if (f[k] !== g[k]) n++; });
    if (f.shape === 'triangle' && g.shape === 'triangle' && f.rot !== g.rot) n++;
    return n;
  }

  function describeFigure(f) {
    const pl = f.count > 1 ? 1 : 0;
    let s = `${f.count} ${SHAPE_NAME[f.shape][pl]} ${SIZE_NAME[f.size][pl]} ${FILL_NAME[f.fill][pl]}`;
    if (f.shape === 'triangle') s += ` a apontar ${POINTS[f.rot]}`;
    return s + `, ponto no canto ${CORNER_NAME[f.dot]}`;
  }

  function ruleText(r) {
    switch (r.type) {
      case 'rotation': return `a figura roda 90° ${r.step > 0 ? 'no sentido dos ponteiros do relógio' : 'no sentido contrário ao dos ponteiros do relógio'} de cada vez`;
      case 'count': return `o número de figuras ${r.step > 0 ? 'aumenta' : 'diminui'} 1 de cada vez`;
      case 'fill': return 'o preenchimento segue a ordem vazio → riscado → cheio';
      case 'shape': return 'a forma segue a ordem círculo → quadrado → triângulo → losango';
      case 'dot': return 'o ponto avança um canto no sentido dos ponteiros do relógio';
    }
    return '';
  }

  function figureVariants(c) {
    const v = { shape: [], fill: [], count: [], size: [], rotation: [], dot: [] };
    SHAPES.filter((s) => s !== c.shape).forEach((s) => v.shape.push(Object.assign({}, c, { shape: s })));
    FILLS.filter((s) => s !== c.fill).forEach((s) => v.fill.push(Object.assign({}, c, { fill: s })));
    [c.count - 1, c.count + 1].filter((n) => n >= 1 && n <= 6).forEach((n) => v.count.push(Object.assign({}, c, { count: n })));
    v.size.push(Object.assign({}, c, { size: c.size === 'small' ? 'large' : 'small' }));
    if (c.shape === 'triangle') ROTS.filter((r) => r !== c.rot).forEach((r) => v.rotation.push(Object.assign({}, c, { rot: r })));
    range(4).filter((d) => d !== c.dot).forEach((d) => v.dot.push(Object.assign({}, c, { dot: d })));
    return v;
  }

  function figures(seed) {
    const rng = makeRng(seed);
    const levels = rng.shuffle(range(N).map((i) => (i < 20 ? 1 : 2)));
    const easyRules = balanced(FIG_RULES, 20, rng);
    const combos = [];
    FIG_RULES.forEach((a, i) => FIG_RULES.slice(i + 1).forEach((b) => {
      if (!(a === 'rotation' && b === 'shape') && !(a === 'shape' && b === 'rotation')) combos.push([a, b]);
    }));
    const hardCombos = rng.shuffle(combos.concat([rng.pick(combos)]));
    const positions = balanced(range(5), N, rng);
    let e = 0, h = 0;
    return levels.map((lv, i) => {
      const types = lv === 1 ? [easyRules[e++]] : hardCombos[h++];
      const has = (t) => types.includes(t);
      const rules = types.map((t) => ({ type: t, step: t === 'rotation' ? rng.pick([90, -90]) : t === 'count' ? rng.pick([1, -1]) : 1 }));
      const countRule = rules.find((r) => r.type === 'count');
      const shape = has('rotation') ? 'triangle' : rng.pick(SHAPES);
      const base = {
        shape,
        fill: rng.pick(FILLS),
        count: countRule ? (countRule.step > 0 ? rng.int(1, 2) : rng.int(5, 6)) : rng.int(1, 3),
        size: rng.pick(['small', 'large']),
        rot: has('rotation') ? rng.pick(ROTS) : (!has('shape') && shape === 'triangle' ? rng.pick(ROTS) : 0),
        dot: rng.int(0, 3)
      };
      const seq = range(4).map((k) => figureAt(base, rules, k));
      const answer = figureAt(base, rules, 4);
      // Distractors: change exactly one attribute; first one per rule attribute, then the rest.
      const vars = figureVariants(answer);
      const chosen = [], keys = new Set([figKey(answer)]);
      const add = (f) => { const k = figKey(f); if (!keys.has(k) && chosen.length < 4) { keys.add(k); chosen.push(f); } };
      rng.shuffle(types).forEach((t) => { if (vars[t].length) add(rng.pick(vars[t])); });
      rng.shuffle([].concat(vars.shape, vars.fill, vars.count, vars.size, vars.rotation, vars.dot)).forEach(add);
      const figs = rng.shuffle(chosen);
      figs.splice(positions[i], 0, answer);
      const letters = ['A', 'B', 'C', 'D', 'E'];
      const options = figs.map((f, k) => ({ value: letters[k], label: letters[k], fig: f }));
      return {
        level: lv === 1 ? 'easy' : 'hard', rules, base, seq, answer,
        rule: rules.map(ruleText).join(' e '),
        correct: letters[positions[i]], options
      };
    });
  }

  /* ================= Test 8: Analogias ================= */
  // [a, b, c, answer, distractors, relation]
  const ANALOGIES = [
    ['médico', 'hospital', 'professor', 'escola', ['aluno', 'livro', 'aula', 'quadro'], 'local onde cada profissional trabalha'],
    ['pássaro', 'ninho', 'abelha', 'colmeia', ['mel', 'flor', 'ferrão', 'enxame'], 'sítio onde cada animal vive'],
    ['pé', 'sapato', 'mão', 'luva', ['dedo', 'anel', 'braço', 'unha'], 'o que se veste em cada parte do corpo'],
    ['quente', 'frio', 'alto', 'baixo', ['grande', 'largo', 'comprido', 'magro'], 'palavras de sentido contrário'],
    ['livro', 'capítulo', 'casa', 'divisão', ['rua', 'morada', 'vizinho', 'cidade'], 'o todo e uma das suas partes'],
    ['pintor', 'pincel', 'escritor', 'caneta', ['livro', 'leitor', 'romance', 'biblioteca'], 'instrumento de trabalho de cada um'],
    ['olho', 'ver', 'ouvido', 'ouvir', ['som', 'orelha', 'falar', 'música'], 'função de cada órgão'],
    ['água', 'sede', 'comida', 'fome', ['prato', 'cozinha', 'sabor', 'mesa'], 'aquilo que satisfaz cada necessidade (a água mata a sede, a comida mata a fome)'],
    ['carro', 'estrada', 'comboio', 'carril', ['estação', 'bilhete', 'passageiro', 'vagão'], 'por onde circula cada veículo'],
    ['Lisboa', 'Portugal', 'Madrid', 'Espanha', ['Europa', 'Barcelona', 'capital', 'Andaluzia'], 'capital e respetivo país'],
    ['lápis', 'escrever', 'tesoura', 'cortar', ['papel', 'colar', 'afiar', 'desenhar'], 'para que serve cada objeto'],
    ['lobo', 'alcateia', 'abelha', 'enxame', ['colmeia', 'mel', 'rebanho', 'cardume'], 'nome do grupo de cada animal'],
    ['ovelha', 'rebanho', 'peixe', 'cardume', ['aquário', 'mar', 'escama', 'rede'], 'nome do grupo de cada animal'],
    ['cão', 'ladrar', 'gato', 'miar', ['uivar', 'cacarejar', 'rugir', 'zurrar'], 'som que cada animal faz'],
    ['termómetro', 'temperatura', 'balança', 'peso', ['altura', 'tempo', 'volume', 'pressão'], 'o que cada instrumento mede'],
    ['relógio', 'tempo', 'régua', 'comprimento', ['peso', 'ângulo', 'temperatura', 'volume'], 'o que cada instrumento mede'],
    ['frio', 'inverno', 'calor', 'verão', ['sol', 'praia', 'chuva', 'estação'], 'característica e estação do ano em que se sente'],
    ['agulha', 'costureira', 'martelo', 'carpinteiro', ['prego', 'madeira', 'ferramenta', 'serrote'], 'instrumento e quem o usa no trabalho'],
    ['ler', 'livro', 'ouvir', 'música', ['ouvido', 'ver', 'cantar', 'filme'], 'ação e aquilo sobre que se faz'],
    ['raro', 'frequente', 'pouco', 'muito', ['escasso', 'único', 'menos', 'algum'], 'palavras de sentido contrário'],
    ['maquinista', 'comboio', 'piloto', 'avião', ['aeroporto', 'voo', 'hospedeira', 'asa'], 'quem conduz cada veículo'],
    ['ator', 'teatro', 'advogado', 'tribunal', ['juiz', 'lei', 'processo', 'cliente'], 'local onde cada profissional trabalha'],
    ['ferro', 'metal', 'rosa', 'flor', ['espinho', 'jardim', 'perfume', 'vermelho'], 'exemplo e categoria a que pertence'],
    ['triângulo', 'três', 'quadrado', 'quatro', ['cinco', 'seis', 'lado', 'área'], 'figura e número de lados'],
    ['rápido', 'lento', 'claro', 'escuro', ['luz', 'brilhante', 'transparente', 'branco'], 'palavras de sentido contrário'],
    ['queijo', 'leite', 'pão', 'farinha', ['padaria', 'forno', 'sanduíche', 'côdea'], 'produto e matéria-prima de que é feito'],
    ['vinho', 'uva', 'azeite', 'azeitona', ['garrafa', 'salada', 'óleo', 'lagar'], 'produto e fruto de que é feito'],
    ['escultor', 'estátua', 'compositor', 'sinfonia', ['maestro', 'piano', 'orquestra', 'nota'], 'autor e obra que cria'],
    ['capitão', 'equipa', 'maestro', 'orquestra', ['música', 'batuta', 'concerto', 'instrumento'], 'quem dirige cada grupo'],
    ['sol', 'dia', 'lua', 'noite', ['estrela', 'céu', 'mar', 'luz'], 'astro associado a cada período'],
    ['janeiro', 'mês', 'terça-feira', 'dia', ['semana', 'ano', 'calendário', 'feriado'], 'exemplo e categoria a que pertence (janeiro é um mês, terça-feira é um dia)'],
    ['faca', 'cortar', 'vassoura', 'varrer', ['chão', 'pó', 'lavar', 'apanhar'], 'para que serve cada objeto'],
    ['médico', 'doente', 'advogado', 'cliente', ['juiz', 'tribunal', 'lei', 'processo'], 'profissional e pessoa a quem presta serviço'],
    ['aluno', 'aprender', 'professor', 'ensinar', ['escola', 'estudar', 'aula', 'quadro'], 'atividade principal de cada um'],
    ['nascer', 'morrer', 'chegar', 'partir', ['vir', 'entrar', 'ficar', 'viajar'], 'palavras de sentido contrário'],
    ['bombeiro', 'incêndio', 'médico', 'doença', ['hospital', 'enfermeiro', 'receita', 'saúde'], 'o que cada profissional combate'],
    ['biblioteca', 'livros', 'arquivo', 'documentos', ['pasta', 'gaveta', 'secretaria', 'carimbo'], 'local e o que lá se guarda'],
    ['ágil', 'agilidade', 'belo', 'beleza', ['bonito', 'feio', 'belíssimo', 'belamente'], 'adjetivo e nome que dele deriva'],
    ['pintar', 'pintor', 'cantar', 'cantor', ['canção', 'cantoria', 'voz', 'palco'], 'ação e quem a faz'],
    ['pétala', 'flor', 'dedo', 'mão', ['unha', 'luva', 'braço', 'anel'], 'parte e o todo a que pertence'],
    ['tecla', 'teclado', 'página', 'livro', ['letra', 'capa', 'leitura', 'estante'], 'parte e o todo a que pertence']
  ];

  function analogies(seed) {
    const rng = makeRng(seed);
    const items = rng.shuffle(range(ANALOGIES.length)).slice(0, N);
    const positions = balanced(range(5), N, rng);
    return items.map((k, i) => {
      const [a, b, c, ans, dis, rel] = ANALOGIES[k];
      const vals = rng.shuffle(dis);
      vals.splice(positions[i], 0, ans);
      return { item: k, a, b, c, rel, correct: ans, options: vals.map((v) => ({ value: v, label: v })) };
    });
  }

  /* ================= Test 9: Sinónimos e Antónimos ================= */
  // [word, answer, distractors, note?]
  const SYNONYMS = [
    ['célere', 'rápido', ['lento', 'célebre', 'claro', 'cauteloso']],
    ['efémero', 'passageiro', ['eterno', 'estável', 'famoso', 'evidente']],
    ['exímio', 'excelente', ['exato', 'mediano', 'extremo', 'excluído']],
    ['ratificar', 'confirmar', ['corrigir', 'anular', 'rasurar', 'redigir'], 'Atenção: retificar (com e) é que significa corrigir.'],
    ['perene', 'duradouro', ['breve', 'anual', 'perigoso', 'perdido']],
    ['profícuo', 'proveitoso', ['prolixo', 'inútil', 'profundo', 'próximo']],
    ['dirimir', 'resolver', ['diminuir', 'agravar', 'redigir', 'dividir'], 'Dirimir um conflito é resolvê-lo.'],
    ['exíguo', 'escasso', ['abundante', 'exigente', 'extenso', 'exato']],
    ['obsoleto', 'ultrapassado', ['moderno', 'obscuro', 'absoluto', 'completo']],
    ['prolixo', 'palavroso', ['conciso', 'prolífico', 'preciso', 'ponderado'], 'Um texto prolixo usa palavras a mais.'],
    ['lacónico', 'breve', ['extenso', 'lento', 'laboral', 'lânguido']],
    ['sucinto', 'resumido', ['detalhado', 'sucessivo', 'súbito', 'sumptuoso']],
    ['diligente', 'zeloso', ['negligente', 'inteligente', 'dirigente', 'lento']],
    ['moroso', 'demorado', ['rápido', 'amoroso', 'moreno', 'mórbido']],
    ['vetusto', 'antigo', ['novo', 'robusto', 'vasto', 'vestido']],
    ['anuir', 'concordar', ['recusar', 'anular', 'aumentar', 'anunciar']],
    ['prescindir', 'dispensar', ['precisar', 'prescrever', 'presidir', 'preceder'], 'Prescindir de algo é passar sem ele.'],
    ['tácito', 'implícito', ['explícito', 'tático', 'tímido', 'total'], 'Um acordo tácito não é dito, mas subentende-se.'],
    ['deferir', 'aprovar', ['diferir', 'adiar', 'recusar', 'arquivar'], 'Deferir um pedido é aprová-lo; diferir (com i) é adiar.'],
    ['fulcral', 'essencial', ['secundário', 'fugaz', 'falso', 'final']],
    ['incólume', 'ileso', ['ferido', 'inculto', 'incolor', 'inquieto']],
    ['parco', 'escasso', ['abundante', 'parcial', 'pardo', 'lento']],
    ['probo', 'honesto', ['corrupto', 'provável', 'prévio', 'pronto']],
    ['pernicioso', 'prejudicial', ['benéfico', 'persistente', 'perspicaz', 'pequeno']],
    ['perspicaz', 'sagaz', ['ingénuo', 'persistente', 'perplexo', 'preguiçoso']],
    ['coibir', 'reprimir', ['incentivar', 'coabitar', 'cobrir', 'coincidir']],
    ['idóneo', 'adequado', ['idoso', 'inadequado', 'idêntico', 'irónico']],
    ['outorgar', 'conceder', ['recusar', 'adiar', 'ordenar', 'arrogar']],
    ['ímpeto', 'impulso', ['calma', 'impasse', 'ímpar', 'impacto']],
    ['zeloso', 'cuidadoso', ['descuidado', 'zangado', 'zombeteiro', 'vaidoso']]
  ];
  const ANTONYMS = [
    ['escasso', 'abundante', ['raro', 'parco', 'exíguo', 'pequeno']],
    ['efémero', 'duradouro', ['passageiro', 'breve', 'fugaz', 'momentâneo']],
    ['prolixo', 'conciso', ['extenso', 'verboso', 'palavroso', 'longo']],
    ['deferir', 'indeferir', ['aprovar', 'conceder', 'diferir', 'autorizar'], 'Deferir é aprovar; indeferir é recusar. Diferir (com i) é adiar.'],
    ['explícito', 'implícito', ['claro', 'evidente', 'expresso', 'manifesto']],
    ['ascensão', 'queda', ['subida', 'elevação', 'promoção', 'progresso']],
    ['generoso', 'avarento', ['altruísta', 'bondoso', 'pródigo', 'magnânimo']],
    ['dócil', 'rebelde', ['manso', 'obediente', 'meigo', 'submisso']],
    ['otimista', 'pessimista', ['confiante', 'esperançoso', 'positivo', 'animado']],
    ['transparente', 'opaco', ['límpido', 'translúcido', 'claro', 'cristalino']],
    ['benéfico', 'prejudicial', ['útil', 'favorável', 'proveitoso', 'salutar']],
    ['negligente', 'diligente', ['descuidado', 'desleixado', 'desatento', 'relapso']],
    ['moroso', 'célere', ['lento', 'demorado', 'vagaroso', 'arrastado']],
    ['ingénuo', 'astuto', ['inocente', 'crédulo', 'simples', 'cândido']],
    ['obsoleto', 'atual', ['antiquado', 'ultrapassado', 'arcaico', 'caduco']],
    ['passivo', 'ativo', ['inerte', 'parado', 'apático', 'submisso']],
    ['heterogéneo', 'homogéneo', ['variado', 'diverso', 'misto', 'desigual']],
    ['autorizar', 'proibir', ['permitir', 'consentir', 'aprovar', 'licenciar']],
    ['acréscimo', 'redução', ['aumento', 'adição', 'subida', 'reforço']],
    ['exonerar', 'nomear', ['demitir', 'destituir', 'dispensar', 'afastar'], 'Exonerar é afastar alguém de um cargo; nomear é designá-lo para o cargo.'],
    ['louvar', 'censurar', ['elogiar', 'aplaudir', 'enaltecer', 'exaltar']],
    ['concentrar', 'dispersar', ['reunir', 'juntar', 'agrupar', 'centralizar']],
    ['temporário', 'permanente', ['provisório', 'transitório', 'interino', 'passageiro']],
    ['rigoroso', 'impreciso', ['exato', 'preciso', 'minucioso', 'severo']],
    ['facultativo', 'obrigatório', ['opcional', 'voluntário', 'livre', 'dispensável']],
    ['admitir', 'excluir', ['aceitar', 'receber', 'acolher', 'incluir']],
    ['antecipar', 'adiar', ['avançar', 'prever', 'adiantar', 'precipitar']],
    ['consenso', 'desacordo', ['acordo', 'unanimidade', 'harmonia', 'concordância']],
    ['escrupuloso', 'desleixado', ['meticuloso', 'cuidadoso', 'rigoroso', 'zeloso']]
  ];

  function synonyms(seed) {
    const rng = makeRng(seed);
    const pick = (bank, kind) => rng.shuffle(range(bank.length)).slice(0, N / 2).map((k) => ({ kind, k, e: bank[k] }));
    const list = rng.shuffle(pick(SYNONYMS, 'sin').concat(pick(ANTONYMS, 'ant')));
    const positions = balanced(range(5), N, rng);
    return list.map(({ kind, k, e }, i) => {
      const [word, ans, dis, note] = e;
      const vals = rng.shuffle(dis);
      vals.splice(positions[i], 0, ans);
      return { kind, item: k, word, note: note || '', correct: ans, options: vals.map((v) => ({ value: v, label: v })) };
    });
  }

  /* ================= Test 10: Compreensão de Textos ================= */
  // Each statement: [text, 'V' | 'F' | 'N', why]
  const TEXTS = [
    { title: 'Horário dos Serviços Académicos', text: 'Os Serviços Académicos funcionam de segunda a sexta-feira, das 9h00 às 16h30, sem interrupção para almoço. Durante o mês de agosto, o atendimento presencial é suspenso e os pedidos são tratados apenas por correio eletrónico. As certidões são emitidas no prazo de cinco dias úteis após o pagamento do respetivo emolumento.',
      items: [
        ['Em agosto, é possível ser atendido presencialmente nos Serviços Académicos.', 'F', 'O texto diz que, em agosto, o atendimento presencial é suspenso.'],
        ['Os Serviços Académicos fecham à hora de almoço.', 'F', 'O texto diz que funcionam sem interrupção para almoço.'],
        ['Uma certidão paga numa segunda-feira (sem feriados nessa semana) fica pronta, o mais tardar, na segunda-feira seguinte.', 'V', 'Cinco dias úteis a contar de segunda-feira: terça, quarta, quinta, sexta e segunda.'],
        ['A maioria dos pedidos de certidão é feita por estudantes de Enfermagem.', 'N', 'O texto não diz quem faz mais pedidos.']
      ] },
    { title: 'Formação de trabalhadores', text: 'Em 2025, a escola organizou 18 ações de formação para trabalhadores não docentes, mais seis do que no ano anterior. Metade das ações decorreu em formato online e as restantes foram presenciais. A satisfação média dos participantes foi de 87%, ligeiramente abaixo da registada em 2024.',
      items: [
        ['Em 2024, realizaram-se 12 ações de formação para trabalhadores não docentes.', 'V', '18 ações em 2025 são mais seis do que em 2024: 18 − 6 = 12.'],
        ['Em 2025, houve nove ações de formação presenciais.', 'V', 'Metade de 18 foi online; as restantes 9 foram presenciais.'],
        ['A satisfação dos participantes subiu de 2024 para 2025.', 'F', 'O texto diz que a satisfação de 2025 ficou ligeiramente abaixo da de 2024.'],
        ['Todas as ações online tiveram uma satisfação acima de 87%.', 'N', 'O texto só dá a média de todas as ações, não a de cada formato.']
      ] },
    { title: 'Reembolso de deslocações', text: 'As despesas de deslocação em serviço só são reembolsadas quando a deslocação tiver sido autorizada previamente pelo dirigente. O pedido de reembolso deve ser apresentado no prazo de 30 dias após a deslocação, acompanhado dos comprovativos originais. Os pedidos apresentados fora de prazo não são aceites.',
      items: [
        ['Uma deslocação autorizada só depois de ter sido feita dá direito a reembolso.', 'F', 'A autorização tem de ser prévia, ou seja, antes da deslocação.'],
        ['Um pedido de reembolso entregue 40 dias após a deslocação é aceite.', 'F', 'O prazo é de 30 dias e os pedidos fora de prazo não são aceites.'],
        ['Basta entregar fotocópias dos comprovativos.', 'F', 'O texto exige os comprovativos originais.'],
        ['O dirigente costuma autorizar todas as deslocações que lhe são pedidas.', 'N', 'O texto não diz com que frequência o dirigente autoriza.']
      ] },
    { title: 'Regras da biblioteca', text: 'A biblioteca tem 40 lugares de estudo. Os estudantes podem requisitar até três livros por um período de 15 dias, renovável uma vez, desde que nenhum outro utilizador tenha reservado a obra. Os docentes podem requisitar até dez livros.',
      items: [
        ['Um estudante pode chegar a ficar com um livro durante 30 dias.', 'V', '15 dias, mais uma renovação de 15 dias, se ninguém tiver reservado a obra.'],
        ['Um docente pode requisitar mais livros do que um estudante.', 'V', 'Os docentes podem requisitar até dez livros; os estudantes até três.'],
        ['A biblioteca está quase sempre cheia.', 'N', 'O texto diz quantos lugares há, mas não quantos estão ocupados.'],
        ['Um estudante pode renovar um livro que outro utilizador reservou.', 'F', 'A renovação só é possível se ninguém tiver reservado a obra.']
      ] },
    { title: 'Ensino clínico', text: 'Antes de iniciarem o ensino clínico, todos os estudantes de Enfermagem têm de apresentar o boletim de vacinas atualizado e frequentar uma sessão sobre controlo de infeção. Os estudantes que não cumpram estes requisitos não podem iniciar o estágio na data prevista.',
      items: [
        ['Um estudante de Enfermagem que faltou à sessão sobre controlo de infeção pode iniciar o estágio na data prevista.', 'F', 'Quem não cumpre os requisitos não pode iniciar o estágio na data prevista.'],
        ['A sessão sobre controlo de infeção é obrigatória para os estudantes de Enfermagem.', 'V', 'O texto diz que todos têm de a frequentar antes do ensino clínico.'],
        ['Os estudantes de Fisioterapia também têm de apresentar o boletim de vacinas.', 'N', 'O texto só fala dos estudantes de Enfermagem.']
      ] },
    { title: 'Orçamento de material de escritório', text: 'O orçamento da escola para material de escritório foi de 12 000 euros em 2025. Até ao fim de junho, tinham sido gastos 7 200 euros. A direção decidiu que, no segundo semestre, todas as compras acima de 500 euros precisam de três orçamentos de fornecedores diferentes.',
      items: [
        ['Até ao fim de junho, foi gasto mais de metade do orçamento para material de escritório.', 'V', '7 200 é mais do que metade de 12 000 (6 000).'],
        ['No início do segundo semestre, restavam 4 800 euros para material de escritório.', 'V', '12 000 − 7 200 = 4 800.'],
        ['Uma compra de 800 euros em outubro precisa de três orçamentos.', 'V', 'Outubro é no segundo semestre e 800 euros é mais do que 500.'],
        ['Em 2026, o orçamento para material de escritório vai ser maior.', 'N', 'O texto não fala do orçamento de 2026.']
      ] },
    { title: 'Teletrabalho', text: 'Os trabalhadores podem pedir o regime de teletrabalho até dois dias por semana, desde que as funções sejam compatíveis e o pedido seja aprovado pelo superior hierárquico. Nos dias de teletrabalho, o trabalhador tem de estar contactável durante todo o horário de trabalho.',
      items: [
        ['Um trabalhador pode ficar em teletrabalho três dias por semana.', 'F', 'O máximo é de dois dias por semana.'],
        ['Nos dias de teletrabalho, o trabalhador não precisa de estar contactável.', 'F', 'Tem de estar contactável durante todo o horário de trabalho.'],
        ['Basta o trabalhador pedir para passar a ter teletrabalho.', 'F', 'O pedido tem de ser aprovado pelo superior e as funções têm de ser compatíveis.'],
        ['A maioria dos trabalhadores prefere o teletrabalho.', 'N', 'O texto não diz o que os trabalhadores preferem.']
      ] },
    { title: 'Inquérito aos estudantes', text: 'Num inquérito a 400 estudantes, 300 disseram estar satisfeitos com o atendimento dos serviços. Entre os insatisfeitos, a queixa mais referida foi o tempo de espera. Responderam ao inquérito estudantes de todos os cursos da escola.',
      items: [
        ['Um quarto dos estudantes inquiridos não disse estar satisfeito.', 'V', '400 − 300 = 100, e 100 é um quarto de 400.'],
        ['Entre os insatisfeitos, o tempo de espera foi a queixa mais referida.', 'V', 'É o que o texto diz.'],
        ['Todos os estudantes da escola responderam ao inquérito.', 'N', 'Responderam estudantes de todos os cursos, mas o texto não diz quantos estudantes tem a escola.']
      ] },
    { title: 'Reclamação da classificação', text: 'Os candidatos podem reclamar da classificação no prazo de dez dias úteis a contar da data de publicação da lista. A reclamação é apresentada por escrito e dirigida ao presidente do júri, que decide no prazo de cinco dias úteis.',
      items: [
        ['A reclamação pode ser apresentada oralmente.', 'F', 'Tem de ser apresentada por escrito.'],
        ['A reclamação é dirigida ao presidente do júri.', 'V', 'É o que o texto diz.'],
        ['Quem reclama vê a sua classificação subir.', 'N', 'O texto não diz qual é o resultado das reclamações.']
      ] },
    { title: 'Arquivo de processos', text: 'Os processos dos estudantes são conservados em arquivo durante dez anos após a conclusão do curso. Depois desse prazo, são digitalizados e os originais em papel são eliminados, com exceção dos diplomas, que são conservados para sempre.',
      items: [
        ['Os diplomas originais são eliminados ao fim de dez anos.', 'F', 'Os diplomas são a exceção: são conservados para sempre.'],
        ['Cinco anos após a conclusão do curso, o processo de um estudante ainda está em arquivo.', 'V', 'Os processos ficam em arquivo durante dez anos.'],
        ['A digitalização dos processos é feita por uma empresa externa.', 'N', 'O texto não diz quem faz a digitalização.']
      ] },
    { title: 'Reuniões do conselho', text: 'O conselho pedagógico reúne ordinariamente uma vez por mês e, extraordinariamente, sempre que o presidente o convoque. As deliberações só são válidas se estiver presente a maioria dos membros.',
      items: [
        ['Num conselho de 20 membros, com 8 presentes, as deliberações são válidas.', 'F', '8 não é a maioria de 20 (seriam precisos pelo menos 11).'],
        ['O conselho pedagógico pode reunir mais de uma vez no mesmo mês.', 'V', 'Além da reunião mensal, pode haver reuniões extraordinárias.'],
        ['O presidente convoca reuniões extraordinárias todos os meses.', 'N', 'O texto diz que pode convocar, mas não com que frequência o faz.']
      ] },
    { title: 'Cantina', text: 'A cantina serve refeições entre as 12h00 e as 14h30. A refeição social custa 3,25 euros para estudantes e 4,80 euros para trabalhadores. Quem chegar depois das 14h00 só tem garantida a refeição vegetariana.',
      items: [
        ['Um trabalhador paga mais do que um estudante pela refeição.', 'V', '4,80 euros é mais do que 3,25 euros.'],
        ['Às 14h15, a refeição de carne está garantida.', 'F', 'Depois das 14h00, só a refeição vegetariana está garantida.'],
        ['A refeição vegetariana é a mais escolhida.', 'N', 'O texto não diz qual é a refeição mais escolhida.']
      ] }
  ];
  const TF_LABEL = { V: 'Verdadeiro', F: 'Falso', N: 'Não se pode dizer' };

  function texts(seed) {
    const rng = makeRng(seed);
    const options = ['V', 'F', 'N'].map((v) => ({ value: v, label: TF_LABEL[v] }));
    const out = [];
    rng.shuffle(range(TEXTS.length)).forEach((t) => {
      rng.shuffle(range(TEXTS[t].items.length)).forEach((s) => {
        if (out.length >= N) return;
        const [statement, ans, why] = TEXTS[t].items[s];
        out.push({ textId: t, item: s, title: TEXTS[t].title, text: TEXTS[t].text, statement, why, correct: ans, options });
      });
    });
    return out;
  }

  /* ================= Test 11: Raciocínio Numérico (tabelas) ================= */
  const COURSES = ['Enfermagem', 'Fisioterapia', 'Análises Clínicas', 'Cardiopneumologia', 'Radiologia', 'Dietética e Nutrição'];
  const YEARS = [2023, 2024, 2025];
  const NUM_CONTEXTS = [
    { title: 'Candidaturas recebidas por curso', unit: 'candidaturas' },
    { title: 'Pedidos de certidão por curso', unit: 'pedidos de certidão' },
    { title: 'Estudantes inscritos em ensino clínico, por curso', unit: 'estudantes inscritos' }
  ];
  const SUPPLIES = [
    ['Resmas de papel A4', 450], ['Tinteiros', 1890], ['Pastas de arquivo', 120], ['Caixas de envelopes', 875],
    ['Caixas de canetas', 640], ['Agrafadores', 730], ['Blocos de notas', 85], ['Caixas de agrafos', 160]
  ];
  const NUM_KINDS = ['total', 'diff', 'pctchg', 'share', 'avg', 'cost'];

  const fmtInt = (n) => (n < 0 ? '−' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fmtEur = (c) => fmtInt(Math.floor(c / 100)) + ',' + String(c % 100).padStart(2, '0') + ' €';
  const fmtVar = (p) => (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '%';
  const fmtPct = (p) => p + '%';
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  function numDistractors(ans, cands, fill, valid, rng) {
    const out = [];
    const push = (v) => { if (Number.isInteger(v) && v !== ans && valid(v) && !out.includes(v)) out.push(v); };
    rng.shuffle(cands).slice(0, 3).forEach(push);
    rng.shuffle(fill).forEach(push);
    return out.slice(0, 4);
  }

  /** Recomputes the answer of a numeric question from its raw data (used by the validator too). */
  function numAnswer(q) {
    const d = q.raw.data;
    switch (q.kind) {
      case 'total': return sum(d.map((row) => row[q.raw.y]));
      case 'diff': return Math.abs(d[q.raw.r1][q.raw.y] - d[q.raw.r2][q.raw.y]);
      case 'pctchg': { const a = d[q.raw.r][q.raw.y1], b = d[q.raw.r][q.raw.y2]; return (b - a) * 100 / a; }
      case 'share': return d[q.raw.r][q.raw.y] * 100 / sum(d.map((row) => row[q.raw.y]));
      case 'avg': return sum(d[q.raw.r]) / d[q.raw.r].length;
      case 'cost': return sum(q.raw.items.map(([, p, n]) => p * n));
    }
    return NaN;
  }

  function numericQuestion(kind, rng) {
    if (kind === 'cost') {
      const items = rng.shuffle(SUPPLIES).slice(0, 3).map(([name, p]) => [name, p, rng.int(2, 12)]);
      const ans = numAnswer({ kind, raw: { items } });
      const costs = items.map(([, p, n]) => p * n);
      const cands = costs.map((c) => ans - c).concat(items.map(([, p]) => ans + p), items.map(([, p]) => ans - p));
      const fill = [100, -100, 200, -200, 500, -500, 1000, -1000, 50, -50].map((k) => ans + k);
      const dis = numDistractors(ans, cands, fill, (v) => v > 0, rng);
      return {
        kind, raw: { items }, correct: ans, values: dis, fmt: fmtEur,
        table: { title: 'Encomenda de material de escritório', head: ['Artigo', 'Preço unitário', 'Quantidade'], rows: items.map(([nm, p, n]) => [nm, fmtEur(p), String(n)]) },
        question: 'Qual é o custo total desta encomenda?',
        steps: items.map(([nm, p, n]) => `${nm}: ${n} × ${fmtEur(p)} = ${fmtEur(p * n)}`).concat([`Total: ${costs.map(fmtEur).join(' + ')} = ${fmtEur(ans)}`])
      };
    }
    const ctx = rng.pick(NUM_CONTEXTS);
    const rows = rng.shuffle(COURSES).slice(0, 4);
    const data = rows.map(() => YEARS.map(() => rng.int(4, 40) * 5));
    const base = { kind, ctx, rows };
    const table = () => ({ title: ctx.title, head: ['Curso'].concat(YEARS.map(String)), rows: rows.map((r, k) => [r].concat(data[k].map(fmtInt))) });
    const colSum = (y) => sum(data.map((row) => row[y]));
    if (kind === 'total') {
      const y = rng.int(0, 2);
      const raw = { data, y }, ans = numAnswer({ kind, raw });
      const cands = [0, 1, 2].filter((k) => k !== y).map(colSum).concat(data.map((row) => ans - row[y]));
      const dis = numDistractors(ans, cands, [5, -5, 10, -10, 15, -15, 20, -20, 50, -50].map((k) => ans + k), (v) => v > 0, rng);
      return Object.assign(base, { raw, correct: ans, values: dis, fmt: fmtInt, table: table(),
        question: `Qual foi o total de ${ctx.unit} em ${YEARS[y]}?`,
        steps: [`${data.map((row) => fmtInt(row[y])).join(' + ')} = ${fmtInt(ans)}`] });
    }
    if (kind === 'diff') {
      const y = rng.int(0, 2);
      let r1, r2;
      do { [r1, r2] = rng.shuffle(range(4)).slice(0, 2); } while (data[r1][y] === data[r2][y]);
      const raw = { data, y, r1, r2 }, ans = numAnswer({ kind, raw });
      const cands = [0, 1, 2].filter((k) => k !== y).map((k) => Math.abs(data[r1][k] - data[r2][k])).concat([data[r1][y] + data[r2][y]]);
      const dis = numDistractors(ans, cands, [5, -5, 10, -10, 15, -15, 20, -20].map((k) => ans + k), (v) => v > 0, rng);
      return Object.assign(base, { raw, correct: ans, values: dis, fmt: fmtInt, table: table(),
        question: `Em ${YEARS[y]}, qual foi a diferença entre o número de ${ctx.unit} de ${rows[r1]} e de ${rows[r2]}?`,
        steps: [`${rows[r1]}: ${fmtInt(data[r1][y])}; ${rows[r2]}: ${fmtInt(data[r2][y])}.`, `Diferença: ${fmtInt(Math.max(data[r1][y], data[r2][y]))} − ${fmtInt(Math.min(data[r1][y], data[r2][y]))} = ${fmtInt(ans)}`] });
    }
    if (kind === 'pctchg') {
      const r = rng.int(0, 3);
      const [y1, y2] = rng.pick([[0, 1], [1, 2], [0, 2]]);
      const v1 = 20 * rng.int(3, 10), p = rng.pick([-25, -20, -10, 10, 20, 25, 40, 50]);
      data[r][y1] = v1; data[r][y2] = v1 + v1 * p / 100;
      const raw = { data, r, y1, y2 }, ans = numAnswer({ kind, raw });
      const v2 = data[r][y2];
      const cands = [-ans, Math.round((v2 - v1) * 100 / v2), v2 - v1];
      const dis = numDistractors(ans, cands, [5, -5, 10, -10, 15, -15, 20, -20].map((k) => ans + k), (v) => v !== 0 && v > -100, rng);
      return Object.assign(base, { raw, correct: ans, values: dis, fmt: fmtVar, table: table(),
        question: `Qual foi a variação percentual do número de ${ctx.unit} de ${rows[r]} entre ${YEARS[y1]} e ${YEARS[y2]}?`,
        steps: [`Variação: ${fmtInt(v2)} − ${fmtInt(v1)} = ${fmtInt(v2 - v1)}.`, `Em percentagem do valor inicial: ${fmtInt(v2 - v1)} ÷ ${fmtInt(v1)} × 100 = ${fmtVar(ans)}`] });
    }
    if (kind === 'share') {
      const y = rng.int(0, 2), r = rng.int(0, 3);
      const T = rng.pick([200, 300, 400, 500, 600]), s = rng.pick([10, 15, 20, 25, 30, 35, 40]);
      const v = T * s / 100, rest = (T - v) / 5;
      const a = rng.int(2, rest - 4), b = rng.int(2, rest - a - 2), c = rest - a - b;
      const others = rng.shuffle([a * 5, b * 5, c * 5]);
      let o = 0;
      data.forEach((row, k) => { row[y] = k === r ? v : others[o++]; });
      const raw = { data, y, r }, ans = numAnswer({ kind, raw });
      const cands = data.filter((_, k) => k !== r).map((row) => Math.round(row[y] * 100 / T));
      const dis = numDistractors(ans, cands, [5, -5, 10, -10, 15, -15].map((k) => ans + k), (x) => x > 0 && x < 100, rng);
      return Object.assign(base, { raw, correct: ans, values: dis, fmt: fmtPct, table: table(),
        question: `Em ${YEARS[y]}, que percentagem do total de ${ctx.unit} corresponde a ${rows[r]}?`,
        steps: [`Total de ${YEARS[y]}: ${data.map((row) => fmtInt(row[y])).join(' + ')} = ${fmtInt(T)}.`, `${rows[r]}: ${fmtInt(v)} ÷ ${fmtInt(T)} × 100 = ${ans}%`] });
    }
    // avg
    const r = rng.int(0, 3);
    let vals;
    do {
      const m = 5 * rng.int(8, 40), d1 = 5 * rng.int(1, 6), d2 = 5 * rng.int(1, 6);
      vals = rng.shuffle([m + d1, m + d2, m - d1 - d2]);
    } while (Math.min(...vals) < 10);
    data[r] = vals;
    const raw = { data, r }, ans = numAnswer({ kind, raw });
    const sorted = vals.slice().sort((x, y) => x - y);
    const cands = [sorted[1], Math.round(sum(vals) / 2), Math.round((vals[0] + vals[2]) / 2)];
    const dis = numDistractors(ans, cands, [5, -5, 10, -10, 15, -15].map((k) => ans + k), (v) => v > 0, rng);
    return Object.assign(base, { raw, correct: ans, values: dis, fmt: fmtInt, table: table(),
      question: `Qual foi a média anual de ${ctx.unit} de ${rows[r]} entre ${YEARS[0]} e ${YEARS[2]}?`,
      steps: [`Soma: ${vals.map(fmtInt).join(' + ')} = ${fmtInt(sum(vals))}.`, `Média: ${fmtInt(sum(vals))} ÷ 3 = ${fmtInt(ans)}`] });
  }

  function numeric(seed) {
    const rng = makeRng(seed);
    const kinds = balanced(NUM_KINDS, N, rng);
    const positions = balanced(range(5), N, rng);
    return kinds.map((kind, i) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const q = numericQuestion(kind, rng);
        if (q.values.length < 4) continue;
        const vals = q.values.slice();
        vals.splice(positions[i], 0, q.correct);
        q.options = vals.map((v) => ({ value: v, label: q.fmt(v) }));
        delete q.values; delete q.fmt;
        return q;
      }
      throw new Error('Não foi possível gerar a pergunta numérica ' + (i + 1));
    });
  }

  /* ================= Test 12: Atenção (tipo d2) ================= */
  const ATT_LEN = 14;
  function attItem(letter, marks, rng) {
    const ups = range(3).filter((u) => marks - u >= 0 && marks - u <= 2);
    const up = rng.pick(ups);
    return { l: letter, up, down: marks - up };
  }
  const isTarget = (it) => it.l === 'd' && it.up + it.down === 2;

  function attention(seed) {
    const rng = makeRng(seed);
    const counts = balanced(range(6), N, rng);
    return counts.map((k) => {
      const at = new Set(rng.shuffle(range(ATT_LEN)).slice(0, k));
      const items = range(ATT_LEN).map((j) => {
        if (at.has(j)) return attItem('d', 2, rng);
        const r = rng.next();
        if (r < 0.35) return attItem('p', 2, rng);          // p with 2 marks: the main trap
        if (r < 0.55) return attItem('d', 1, rng);
        if (r < 0.75) return attItem('d', 3, rng);
        if (r < 0.80) return attItem('d', 4, rng);
        return attItem('p', rng.pick([1, 3, 4]), rng);
      });
      return { items, targets: items.map((it, j) => (isTarget(it) ? j : -1)).filter((j) => j >= 0), correct: k, options: numOptions(5) };
    });
  }

  const generators = {
    numerica: numberSpeed, percetiva: perceptual, espacial: spatial, series,
    codigos: codes, silogismos: syllogisms, matrizes: figures,
    analogias: analogies, sinonimos: synonyms, textos: texts, numerico: numeric, atencao: attention
  };

  const Gen = {
    N, mulberry32, makeRng, balanced, maxRun, DEFAULT_SEEDS, generators,
    numberSpeed, perceptual, spatial, series, codes, syllogisms, figures,
    analogies, synonyms, texts, numeric, attention, numAnswer, isTarget, ANALOGIES, SYNONYMS, ANTONYMS, TEXTS, TF_LABEL, NUM_KINDS, ATT_LEN,
    LETTERS, CONFUSABLE, CODE_CHARS, SIMILAR, SERIES_BUILD, seriesCandidates, diffPositions,
    SYL_TEMPLATES, SYL_ANSWER_LABEL, SHAPES, FILLS, figureAt, figKey, figDiffCount, describeFigure, ruleText,
    isCorrect: (q, optionIndex) => !!q.options[optionIndex] && q.options[optionIndex].value === q.correct,
    correctIndex: (q) => q.options.findIndex((o) => o.value === q.correct)
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Gen;
  else root.Gen = Gen;
})(typeof window !== 'undefined' ? window : globalThis);
