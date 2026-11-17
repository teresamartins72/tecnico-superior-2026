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
    codigos: 5505, silogismos: 6606, matrizes: 7707
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

  const generators = {
    numerica: numberSpeed, percetiva: perceptual, espacial: spatial, series,
    codigos: codes, silogismos: syllogisms, matrizes: figures
  };

  const Gen = {
    N, mulberry32, makeRng, balanced, maxRun, DEFAULT_SEEDS, generators,
    numberSpeed, perceptual, spatial, series, codes, syllogisms, figures,
    LETTERS, CONFUSABLE, CODE_CHARS, SIMILAR, SERIES_BUILD, seriesCandidates, diffPositions,
    SYL_TEMPLATES, SYL_ANSWER_LABEL, SHAPES, FILLS, figureAt, figKey, figDiffCount, describeFigure, ruleText,
    isCorrect: (q, optionIndex) => !!q.options[optionIndex] && q.options[optionIndex].value === q.correct,
    correctIndex: (q) => q.options.findIndex((o) => o.value === q.correct)
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Gen;
  else root.Gen = Gen;
})(typeof window !== 'undefined' ? window : globalThis);
