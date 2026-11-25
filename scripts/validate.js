#!/usr/bin/env node
/*
 * Validates the question generators: node scripts/validate.js
 * Checks the default sets (the ones shown on every visit) and many random seeds.
 */
'use strict';
const path = require('path');
const G = require(path.join(__dirname, '..', 'generators.js'));

let failures = 0, checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { failures++; if (failures <= 40) console.error('  ✗ ' + msg); }
}
const count = (arr, f) => arr.filter(f).length;
const hist = (arr) => arr.reduce((m, v) => { m[v] = (m[v] || 0) + 1; return m; }, {});
const distinct = (arr) => new Set(arr.map(String)).size === arr.length;

function commonChecks(id, qs) {
  ok(qs.length === G.N, `${id}: ${qs.length} perguntas (esperado ${G.N})`);
  qs.forEach((q, i) => {
    ok(Array.isArray(q.options) && q.options.length >= 2, `${id} Q${i + 1}: opções em falta`);
    ok(distinct(q.options.map((o) => o.value)), `${id} Q${i + 1}: opções repetidas`);
    ok(count(q.options, (o) => o.value === q.correct) === 1, `${id} Q${i + 1}: a resposta certa não está exatamente uma vez nas opções`);
  });
}

/* ---------- per-test checks ---------- */
const CHECKS = {
  numerica(qs) {
    qs.forEach((q, i) => {
      const t = `numerica Q${i + 1}`;
      const s = q.nums.slice().sort((a, b) => a - b);
      ok(q.nums.every((n) => Number.isInteger(n) && n >= 100 && n <= 999), `${t}: número fora de 100–999`);
      ok(new Set(q.nums).size === 3, `${t}: números repetidos`);
      const dLow = s[1] - s[0], dHigh = s[2] - s[1];
      ok(dLow !== dHigh && Math.abs(dLow - dHigh) >= 5, `${t}: distâncias ${dLow} e ${dHigh} diferem menos de 5`);
      const expected = dLow < dHigh ? s[0] : s[2];
      ok(q.correct === expected, `${t}: resposta ${q.correct}, esperado ${expected}`);
      ok(q.correct === s[0] || q.correct === s[2], `${t}: a resposta não é o menor nem o maior`);
      ok(q.options.map((o) => o.value).join() === q.nums.join(), `${t}: opções não correspondem aos números`);
    });
    const kinds = qs.map((q) => (q.correct === Math.min(...q.nums) ? 'low' : 'high'));
    const low = count(kinds, (k) => k === 'low');
    ok(low >= 13 && low <= 17, `numerica: divisão menor/maior ${low}/${G.N - low}`);
    ok(G.maxRun(kinds) <= 3, `numerica: mais de 3 seguidas do mesmo tipo`);
    const hard = count(qs, (q) => { const s = q.nums.slice().sort((a, b) => a - b); return Math.abs((s[1] - s[0]) - (s[2] - s[1])) <= 20; });
    ok(hard >= 8 && hard <= 12, `numerica: ${hard} difíceis (esperado cerca de 10)`);
  },

  percetiva(qs) {
    qs.forEach((q, i) => {
      const t = `percetiva Q${i + 1}`;
      ok(q.pairs.length === 6, `${t}: ${q.pairs.length} pares`);
      let real = 0;
      const seen = {};
      q.pairs.forEach((p) => {
        ok(/^[A-Za-z]$/.test(p.top) && /^[A-Za-z]$/.test(p.bottom), `${t}: letra inválida`);
        const oneUpperOneLower = (p.top === p.top.toUpperCase()) !== (p.bottom === p.bottom.toUpperCase());
        ok(oneUpperOneLower, `${t}: o par ${p.top}/${p.bottom} não tem uma maiúscula e uma minúscula`);
        const m = p.top.toLowerCase() === p.bottom.toLowerCase();
        if (m) real++;
        ok(p.match === m, `${t}: flag match errada`);
        const letters = m ? [p.top.toUpperCase()] : [p.top.toUpperCase(), p.bottom.toUpperCase()];
        letters.forEach((l) => { seen[l] = (seen[l] || 0) + 1; });
      });
      ok(Object.values(seen).every((n) => n === 1), `${t}: letra repetida fora de um par igual`);
      ok(q.correct === real, `${t}: resposta ${q.correct}, contagem real ${real}`);
      ok(q.options.length === 7, `${t}: devem existir 7 botões (0–6)`);
    });
    const h = hist(qs.map((q) => q.correct));
    for (let v = 0; v <= 6; v++) ok(h[v] >= 3 && h[v] <= 6, `percetiva: resposta ${v} aparece ${h[v] || 0} vezes`);
  },

  espacial(qs) {
    qs.forEach((q, i) => {
      const t = `espacial Q${i + 1}`;
      ok(q.pairs.length === 4, `${t}: ${q.pairs.length} pares`);
      q.pairs.forEach((p) => {
        [p.top, p.bottom].forEach((g) => ok([0, 90, 180, 270].includes(g.rot) && typeof g.mirrored === 'boolean', `${t}: orientação inválida`));
      });
      const real = count(q.pairs, (p) => p.top.mirrored === p.bottom.mirrored);
      ok(q.correct === real, `${t}: resposta ${q.correct}, contagem real ${real}`);
      ok(q.options.length === 5, `${t}: devem existir 5 botões (0–4)`);
    });
    const h = hist(qs.map((q) => q.correct));
    for (let v = 0; v <= 4; v++) ok(h[v] >= 5 && h[v] <= 7, `espacial: resposta ${v} aparece ${h[v] || 0} vezes`);
  },

  series(qs) {
    const isArith = (s) => s.every((v, i) => i < 2 || v - s[i - 1] === s[1] - s[0]);
    qs.forEach((q, i) => {
      const t = `series Q${i + 1}`;
      ok(q.seq.length >= 5 && q.seq.length <= 7, `${t}: comprimento ${q.seq.length}`);
      ok(q.hidden >= 1 && q.hidden < q.seq.length, `${t}: termo escondido na primeira posição`);
      const rebuilt = G.SERIES_BUILD[q.type](q.params, q.seq.length);
      ok(rebuilt.join() === q.seq.join(), `${t}: a série não segue a regra guardada`);
      ok(q.correct === q.seq[q.hidden], `${t}: resposta não é o termo escondido`);
      ok(q.options.length === 5, `${t}: ${q.options.length} opções`);
      const vis = q.seq.map((v, j) => (j === q.hidden ? null : v));
      const cands = G.seriesCandidates(vis);
      ok(cands.size === 1 && cands.has(q.correct), `${t}: termo não é único (${[...cands].join(', ')})`);
      q.options.forEach((o) => { if (o.value !== q.correct) ok(!cands.has(o.value), `${t}: distrator ${o.value} também cumpre uma regra`); });
      if (q.level !== 'easy') ok(!isArith(q.seq), `${t}: série ${q.level} é aritmética simples`);
      ok(typeof q.rule === 'string' && q.rule.length > 5, `${t}: texto da regra em falta`);
    });
    const lv = hist(qs.map((q) => q.level));
    ok(lv.easy === 10 && lv.medium === 12 && lv.hard === 8, `series: níveis ${JSON.stringify(lv)}`);
    const pos = hist(qs.map((q) => G.correctIndex(q)));
    for (let p = 0; p < 5; p++) ok(pos[p] >= 5 && pos[p] <= 7, `series: posição ${p + 1} certa ${pos[p] || 0} vezes`);
  },

  codigos(qs) {
    const allowed = new Set(G.CODE_CHARS);
    qs.forEach((q, i) => {
      const t = `codigos Q${i + 1}`;
      ok(q.a.length === q.b.length && q.a.length >= 8 && q.a.length <= 10, `${t}: comprimento inválido`);
      ok([...q.a + q.b].every((c) => allowed.has(c)), `${t}: carácter ambíguo ou inválido`);
      ok(!/[ILO01]/.test(q.a + q.b), `${t}: contém I, L, O, 0 ou 1`);
      let real = 0;
      for (let k = 0; k < q.a.length; k++) if (q.a[k] !== q.b[k]) real++;
      ok(q.correct === real, `${t}: resposta ${q.correct}, diferenças reais ${real}`);
      ok(q.correct >= 0 && q.correct <= 5, `${t}: resposta fora de 0–5`);
      q.swaps.forEach((p) => {
        ok(q.a[p] === q.b[p + 1] && q.a[p + 1] === q.b[p] && q.a[p] !== q.a[p + 1], `${t}: troca na posição ${p + 1} inválida`);
      });
      ok(real === q.subs.length + 2 * q.swaps.length, `${t}: trocas não contam como 2`);
    });
    const h = hist(qs.map((q) => q.correct));
    for (let v = 0; v <= 5; v++) ok(h[v] >= 4 && h[v] <= 6, `codigos: resposta ${v} aparece ${h[v] || 0} vezes`);
    ok(qs.some((q) => q.swaps.length > 0), 'codigos: nenhuma troca de caracteres adjacentes');
    ok(qs.some((q) => q.hard && q.subs.length > 0), 'codigos: nenhum subconjunto difícil');
  },

  silogismos(qs) {
    const tpl = Object.fromEntries(G.SYL_TEMPLATES.map((t) => [t.id, t]));
    qs.forEach((q, i) => {
      const t = `silogismos Q${i + 1}`;
      const T = tpl[q.template];
      ok(!!T, `${t}: modelo desconhecido`);
      if (!T) return;
      ok(q.correct === T.answer, `${t}: resposta não corresponde ao modelo`);
      ok(q.correct === (q.cond ? evalConditional(q.template) : evalSyllogism(q.logic)), `${t}: a lógica não confirma a resposta ${q.correct}`);
      const text = q.premises.concat(q.conclusion).join(' ');
      ok(!/undefined|null/.test(text), `${t}: texto inválido`);
      if (!q.cond) {
        ok(q.premises.length === 2, `${t}: devem existir 2 premissas`);
        checkAgreement(t, q);
      } else ok(q.premises.length === 3, `${t}: devem existir 3 afirmações`);
    });
    const h = hist(qs.map((q) => q.correct));
    ['V', 'F', 'N'].forEach((v) => ok(h[v] >= 9 && h[v] <= 11, `silogismos: resposta ${v} aparece ${h[v] || 0} vezes`));
  },

  matrizes(qs) {
    qs.forEach((q, i) => {
      const t = `matrizes Q${i + 1}`;
      ok(q.seq.length === 4, `${t}: a sequência deve ter 4 figuras`);
      ok(q.options.length === 5, `${t}: ${q.options.length} opções`);
      q.seq.forEach((f, k) => ok(G.figKey(f) === G.figKey(G.figureAt(q.base, q.rules, k)), `${t}: figura ${k + 1} não segue a regra`));
      const expected = G.figureAt(q.base, q.rules, 4);
      const correctOpt = q.options.find((o) => o.value === q.correct);
      ok(G.figKey(correctOpt.fig) === G.figKey(expected), `${t}: a opção certa não segue a regra`);
      ok(new Set(q.options.map((o) => G.figKey(o.fig))).size === 5, `${t}: opções visualmente repetidas`);
      q.options.forEach((o) => { if (o.value !== q.correct) ok(G.figDiffCount(o.fig, expected) === 1, `${t}: distrator ${o.value} muda mais (ou menos) de um atributo`); });
      q.seq.concat([expected]).forEach((f) => ok(f.count >= 1 && f.count <= 6, `${t}: número de figuras fora de 1–6`));
      ok(q.rules.length === (q.level === 'easy' ? 1 : 2), `${t}: número de regras errado`);
      q.rules.forEach((r) => ok(q.rule.includes(G.ruleText(r)), `${t}: explicação não descreve a regra ${r.type}`));
      // a rule must actually change something between consecutive figures
      q.rules.forEach((r) => {
        const attr = r.type === 'rotation' ? 'rot' : r.type;
        ok(q.seq[0][attr] !== q.seq[1][attr], `${t}: a regra ${r.type} não muda nada`);
      });
    });
    const lv = hist(qs.map((q) => q.level));
    ok(lv.easy === 20 && lv.hard === 10, `matrizes: níveis ${JSON.stringify(lv)}`);
    const pos = hist(qs.map((q) => G.correctIndex(q)));
    for (let p = 0; p < 5; p++) ok(pos[p] >= 5 && pos[p] <= 7, `matrizes: posição ${p + 1} certa ${pos[p] || 0} vezes`);
  },

  analogias(qs) {
    ok(new Set(qs.map((q) => q.item)).size === G.N, 'analogias: itens repetidos no mesmo conjunto');
    qs.forEach((q, i) => {
      const t = `analogias Q${i + 1}`;
      const e = G.ANALOGIES[q.item];
      ok(q.correct === e[3], `${t}: resposta não corresponde ao banco`);
      ok(q.options.length === 5, `${t}: ${q.options.length} opções`);
      ok(![q.a, q.b, q.c].includes(q.correct), `${t}: a resposta repete uma palavra do enunciado`);
      ok(typeof q.rel === 'string' && q.rel.length > 5, `${t}: relação em falta`);
    });
    const pos = hist(qs.map((q) => G.correctIndex(q)));
    for (let p = 0; p < 5; p++) ok(pos[p] >= 5 && pos[p] <= 7, `analogias: posição ${p + 1} certa ${pos[p] || 0} vezes`);
  },

  sinonimos(qs) {
    const kinds = hist(qs.map((q) => q.kind));
    ok(kinds.sin === 15 && kinds.ant === 15, `sinonimos: ${JSON.stringify(kinds)}`);
    ok(new Set(qs.map((q) => q.kind + q.item)).size === G.N, 'sinonimos: itens repetidos');
    qs.forEach((q, i) => {
      const t = `sinonimos Q${i + 1}`;
      const e = (q.kind === 'sin' ? G.SYNONYMS : G.ANTONYMS)[q.item];
      ok(q.word === e[0] && q.correct === e[1], `${t}: não corresponde ao banco`);
      ok(q.options.length === 5 && !q.options.some((o) => o.value === q.word), `${t}: opções inválidas`);
    });
    [G.SYNONYMS, G.ANTONYMS].forEach((bank, b) => bank.forEach((e, k) => {
      ok(e[2].length === 4 && distinct(e[2].concat([e[1]])), `banco ${b ? 'antónimos' : 'sinónimos'} ${k}: distratores inválidos`);
    }));
    const pos = hist(qs.map((q) => G.correctIndex(q)));
    for (let p = 0; p < 5; p++) ok(pos[p] >= 5 && pos[p] <= 7, `sinonimos: posição ${p + 1} certa ${pos[p] || 0} vezes`);
  },

  textos(qs) {
    ok(new Set(qs.map((q) => q.textId + '.' + q.item)).size === G.N, 'textos: afirmações repetidas');
    qs.forEach((q, i) => {
      const t = `textos Q${i + 1}`;
      const e = G.TEXTS[q.textId].items[q.item];
      ok(q.statement === e[0] && q.correct === e[1] && ['V', 'F', 'N'].includes(q.correct), `${t}: não corresponde ao banco`);
      ok(q.text === G.TEXTS[q.textId].text && q.why.length > 5, `${t}: texto ou justificação em falta`);
    });
    // statements of the same text stay together
    const order = qs.map((q) => q.textId);
    ok(order.every((id, k) => k === 0 || id === order[k - 1] || !order.slice(0, k).includes(id)), 'textos: afirmações do mesmo texto separadas');
    const h = hist(qs.map((q) => q.correct));
    ['V', 'F', 'N'].forEach((v) => ok(h[v] >= 6, `textos: resposta ${v} aparece só ${h[v] || 0} vezes`));
  },

  numerico(qs) {
    const kinds = hist(qs.map((q) => q.kind));
    G.NUM_KINDS.forEach((k) => ok(kinds[k] === 5, `numerico: tipo ${k} aparece ${kinds[k] || 0} vezes`));
    qs.forEach((q, i) => {
      const t = `numerico Q${i + 1} (${q.kind})`;
      const real = G.numAnswer(q);
      ok(Number.isInteger(real) && real === q.correct, `${t}: resposta ${q.correct}, cálculo ${real}`);
      ok(q.options.length === 5, `${t}: ${q.options.length} opções`);
      ok(distinct(q.options.map((o) => o.label)), `${t}: etiquetas repetidas`);
      ok(q.options.every((o) => Number.isInteger(o.value)), `${t}: opção não inteira`);
      ok(q.table.rows.every((r) => r.length === q.table.head.length), `${t}: tabela mal formada`);
      if (q.kind !== 'cost') ok(q.raw.data.every((row) => row.every((v) => Number.isInteger(v) && v > 0)), `${t}: valores da tabela inválidos`);
      if (q.kind === 'share') ok(q.options.every((o) => o.value > 0 && o.value < 100), `${t}: percentagem fora de 1–99`);
      ok(q.steps.length >= 1 && !/NaN|undefined/.test(q.steps.join(' ')), `${t}: explicação inválida`);
    });
    const pos = hist(qs.map((q) => G.correctIndex(q)));
    for (let p = 0; p < 5; p++) ok(pos[p] >= 5 && pos[p] <= 7, `numerico: posição ${p + 1} certa ${pos[p] || 0} vezes`);
  },

  atencao(qs) {
    qs.forEach((q, i) => {
      const t = `atencao Q${i + 1}`;
      ok(q.items.length === G.ATT_LEN, `${t}: ${q.items.length} símbolos`);
      q.items.forEach((it) => {
        const n = it.up + it.down;
        ok(['d', 'p'].includes(it.l) && it.up >= 0 && it.up <= 2 && it.down >= 0 && it.down <= 2 && n >= 1 && n <= 4, `${t}: símbolo inválido`);
      });
      const real = count(q.items, (it) => it.l === 'd' && it.up + it.down === 2);
      ok(q.correct === real && q.targets.length === real, `${t}: resposta ${q.correct}, contagem real ${real}`);
      ok(q.options.length === 6, `${t}: devem existir 6 botões (0–5)`);
    });
    const h = hist(qs.map((q) => q.correct));
    for (let v = 0; v <= 5; v++) ok(h[v] === 5, `atencao: resposta ${v} aparece ${h[v] || 0} vezes`);
  }
};

/* Independent check of categorical syllogisms: enumerate every Venn model of A, B, C. */
function evalSyllogism(logic) {
  const regions = [];
  for (let m = 0; m < 8; m++) regions.push({ A: !!(m & 1), B: !!(m & 2), C: !!(m & 4) });
  const holds = (st, occupied) => {
    const [qf, x, y] = st;
    const occ = regions.filter((_, k) => occupied[k]);
    if (qf === 'all') return occ.every((r) => !r[x] || r[y]);
    if (qf === 'none') return occ.every((r) => !(r[x] && r[y]));
    if (qf === 'some' || qf === 'someOne') return occ.some((r) => r[x] && r[y]);
    throw new Error('quantificador ' + qf);
  };
  let alwaysTrue = true, alwaysFalse = true;
  for (let model = 0; model < 256; model++) {
    const occupied = regions.map((_, k) => !!(model & (1 << k)));
    if (!logic.p.every((st) => holds(st, occupied))) continue;
    if (holds(logic.c, occupied)) alwaysFalse = false; else alwaysTrue = false;
  }
  return alwaysTrue ? 'V' : alwaysFalse ? 'F' : 'N';
}
function evalConditional(id) {
  let alwaysTrue = true, alwaysFalse = true;
  for (let m = 0; m < 8; m++) {
    const P = !!(m & 1), Q = !!(m & 2), R = !!(m & 4);
    const imp = (a, b) => !a || b;
    const fact = id === 'C1' ? P : R;
    if (!(imp(P, Q) && imp(Q, R) && fact)) continue;
    const concl = id === 'C1' ? R : P;
    if (concl) alwaysFalse = false; else alwaysTrue = false;
  }
  return alwaysTrue ? 'V' : alwaysFalse ? 'F' : 'N';
}
function checkAgreement(t, q) {
  const sentences = q.premises.concat(q.conclusion);
  const terms = Object.values(q.terms);
  const gender = {};
  terms.forEach((x) => { gender[x.s] = x.g; gender[x.p] = x.g; });
  sentences.forEach((s) => {
    let m;
    if ((m = s.match(/^(Todos os|Todas as|Alguns|Algumas) (\S+) são (\S+)\.$/))) {
      const g = gender[m[2]];
      ok(!!g && gender[m[3]] !== undefined, `${t}: termo desconhecido em "${s}"`);
      ok((g === 'm') === /^(Todos os|Alguns)$/.test(m[1]), `${t}: concordância em "${s}"`);
      ok(terms.some((x) => x.p === m[2]) && terms.some((x) => x.p === m[3]), `${t}: plural em "${s}"`);
    } else if ((m = s.match(/^(Nenhum|Nenhuma|Algum|Alguma) (\S+) é (um|uma) (\S+)\.$/))) {
      ok((gender[m[2]] === 'm') === /^(Nenhum|Algum)$/.test(m[1]), `${t}: concordância em "${s}"`);
      ok((gender[m[4]] === 'm') === (m[3] === 'um'), `${t}: artigo em "${s}"`);
      ok(terms.some((x) => x.s === m[2]) && terms.some((x) => x.s === m[4]), `${t}: singular em "${s}"`);
    } else ok(false, `${t}: frase fora dos modelos: "${s}"`);
  });
}

/* ---------- run ---------- */
const ids = Object.keys(G.generators);
console.log('Conjuntos originais (sementes fixas):');
ids.forEach((id) => {
  const before = failures;
  const a = G.generators[id](G.DEFAULT_SEEDS[id]);
  const b = G.generators[id](G.DEFAULT_SEEDS[id]);
  ok(JSON.stringify(a) === JSON.stringify(b), `${id}: a mesma semente não dá o mesmo conjunto`);
  commonChecks(id, a);
  CHECKS[id](a);
  console.log(`  ${failures === before ? '✓' : '✗'} ${id}`);
});

const RANDOM_SEEDS = Number(process.argv[2]) || 40;
console.log(`Sementes aleatórias (${RANDOM_SEEDS} por teste):`);
ids.forEach((id) => {
  const before = failures;
  for (let s = 1; s <= RANDOM_SEEDS; s++) {
    const seed = (s * 2654435761) >>> 0;
    const qs = G.generators[id](seed);
    commonChecks(id, qs);
    CHECKS[id](qs);
  }
  console.log(`  ${failures === before ? '✓' : '✗'} ${id}`);
});

// mulberry32 sanity: deterministic and different seeds differ
const r1 = G.mulberry32(42), r2 = G.mulberry32(42), r3 = G.mulberry32(43);
const s1 = [r1(), r1(), r1()].join(), s2 = [r2(), r2(), r2()].join(), s3 = [r3(), r3(), r3()].join();
ok(s1 === s2 && s1 !== s3, 'mulberry32 não é determinístico');

console.log(`\n${checks} verificações, ${failures} falhas.`);
process.exit(failures ? 1 : 0);
