# Treino de Avaliação Psicológica

A small static site for practising short aptitude tests: 12 tests × 30 questions (360 per set). It needs no backend, no login, no build step and no npm packages. All user-facing text is in European Portuguese.

| Tab | What it trains |
| --- | --- |
| Rapidez Numérica | Which of the lowest/highest of three numbers is closer to the middle one |
| Rapidez Percetiva | Count the upper/lower-case letter pairs that are the same letter |
| Visualização Espacial | Count the R pairs that are only rotated (not mirrored) |
| Séries Numéricas | Find the missing term of a number series |
| Verificação de Códigos | Count the positions where two codes differ |
| Silogismos | Verdadeira / Falsa / Não se pode concluir |
| Matrizes de Figuras | Pick the figure that continues a sequence |
| Analogias | A está para B como C está para ? (41-item bank) |
| Sinónimos e Antónimos | Pick the synonym or antonym; distractors include look-alike words (59-item bank) |
| Compreensão de Textos | Short administrative texts: Verdadeiro / Falso / Não se pode dizer (12 texts, 42 statements) |
| Raciocínio Numérico | Tables: totals, differences, percentage change, share of total, averages, order costs |
| Atenção | d2-style: count the letters d with exactly two marks |

## Open it locally

Double-click `index.html`. It works straight from the file system (`file://`), offline, on desktop and mobile. There is no `fetch` and there are no ES modules, so you don't need a local server.

## Deploy it for free

**Netlify Drop:** go to <https://app.netlify.com/drop> and drag the project folder onto the page. You get a public URL in a few seconds.

**GitHub Pages:**
1. Create a repository and push these files to it, with `index.html` at the root.
2. In the repository, go to **Settings → Pages**, set **Source** to "Deploy from a branch", pick `main` and `/ (root)`, then save.
3. The site appears at `https://<user>.github.io/<repo>/` after a minute or two.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell: header, tab bar, settings, footer bar |
| `styles.css` | Styles, light and dark theme (`prefers-color-scheme`), reduced motion |
| `generators.js` | Seeded generators and answer data for all tests. Works in the browser (`window.Gen`) and in Node (`module.exports`) |
| `app.js` | UI. Each test is a module (`generate` + `body`/`explain` renderers) listed in the `TESTS` array |
| `scripts/validate.js` | Dev check of every generator rule |

### Hide or reorder tests

Edit the `TESTS` array near the middle of `app.js`:

```js
const TESTS = [numerica, percetiva, espacial, seriesMod, codigos, silogismos, matrizes, analogias, sinonimos, textos, numerico, atencao];
```

If you remove an entry, its tab disappears. If you change the order, the tabs are reordered.

## Validate the generators

```bash
node scripts/validate.js
```

The script generates the default sets, plus 40 random seeds per test (pass a number to change this, e.g. `node scripts/validate.js 200`). It asserts every rule: exactly 30 questions; the same seed always gives the same set; balanced answers; distinct options; the correct option spread over positions; series with a unique hidden term (checked by brute force against the whole rule catalogue); code differences equal to the real count; syllogism answers confirmed by an independent Venn-model check plus Portuguese agreement; figure options that differ from the answer in exactly one attribute; verbal items match their bank with no repeats in a set; numeric answers recomputed from the table data; attention counts recomputed from the symbols. It exits with code 1 if anything fails.

## How it behaves

- **Answering:** one click answers and locks the question. A right answer shows green + ✓. A wrong answer shows red + ✗ and reveals the correct option in green + ✓. Symbols and screen-reader text are always shown, so the result never depends on colour alone. Correctness is always computed from the question data, never read from the page.
- **Saltar:** skips a question (grey ⏭ "saltada"). A skipped question doesn't count as answered or wrong, so it never lowers accuracy. You can still answer it later until the attempt ends.
- **Terminar:** ends the attempt early. Questions left unanswered are not counted as wrong. An attempt also ends when all 30 are answered or when the timer runs out.
- **Statistics:** the footer shows the score `X / Y` (correct / answered), progress, accuracy and, from 10 answers on, the target-accuracy message. **Estatísticas** expands Precisão, Respondidas, Certas, Erradas, Saltadas and Tempo médio por resposta.
- **Average time per answer:** each answer is timed from the **previous answer or skip in the same tab**, or from when the tab was opened if there was none. Time while the browser tab is hidden doesn't count, and a single answer counts for at most 2 minutes, so a break doesn't distort the average.
- **Target accuracy:** default 90%, adjustable from 50 to 100%. This is only your own training target. The site shows no official pass mark and no Apto / Não Apto label.
- **Hints at the end:** these compare accuracy with your target, and the average time with a per-test reference pace (8 s for number/perceptual speed, 10 s for spatial, codes and synonyms, 15 s for analogies and attention, 20 s for series, syllogisms and figures, 30 s for texts, 45 s for numeric tables). The reference paces are arbitrary training values, not exam timings.
- **History:** the last 10 finished attempts per test (date, accuracy, average time, correct/answered) are kept.
- **Timer (optional):** "Modo cronometrado" with a minutes field (default 5). The countdown runs only while that test's tab is open. When it reaches zero, the remaining questions lock and the result appears.
- **Sets:** each test's 30 questions come from a seeded generator (mulberry32) with a fixed default seed, so you see the same questions on every visit. **Novo conjunto** picks a new random seed for the current tab only and resets its answers. **Voltar ao conjunto original** restores the default seed.
- **Recomeçar** asks for confirmation and clears the current tab only (history is kept).
- **Storage:** progress, settings and history are saved in `localStorage` under the key `psico_gia_v1`. Every access is wrapped in `try/catch`. If storage is blocked, the site still works and shows a warning that progress won't survive a reload.

## Notes on the test designs

- **Matrizes de Figuras:** a 5-figure sequence where the number of items goes up or down by 1 needs 5 different counts, so counts range from 1 to 6 instead of 1 to 4.
- **Verificação de Códigos:** I, L, O, 0 and 1 are never used. A swap of two adjacent characters counts as 2 differences, and the explanation says so.
- **Séries Numéricas:** a series is kept only if exactly one value for the hidden term fits any rule in the catalogue, so the distractors can never be a valid alternative answer.
- **Verbal tests:** the word and text banks live in `generators.js` (`ANALOGIES`, `SYNONYMS`, `ANTONYMS`, `TEXTS`). Each set draws 30 items without repetition; add items to the banks to get more variety from **Novo conjunto**. In Compreensão de Textos, statements about the same text stay together.
- **Raciocínio Numérico:** tables are generated, and values are built so every answer is a whole number (percentages included), so no calculator is needed.
