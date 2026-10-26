// The brain games (website/assets/games/engine.js): every level and daily puzzle has exactly one
// answer, is the same puzzle every time it is made, is made quickly, and the checks the play
// screen uses accept the answer and catch mistakes.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const G = require(path.join(__dirname, '..', 'website', 'assets', 'games', 'engine.js'));

const GAMES = ['stars', 'duo', 'trail', 'six'];
// The ramp in full, then a spread over the rest of the 10,000.
const LEVELS = Array.from({ length: 180 }, (_, i) => i + 1).concat(Array.from({ length: 40 }, (_, i) => 181 + i * 245), [G.LEVELS]);
const DAYS = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10));

const answer = {
  stars: (p) => p.solution.map((c, row) => row * p.size + c),
  duo: (p) => p.solution,
  trail: (p) => p.solution,
  six: (p) => p.solution,
};

for (const game of GAMES) {
  test(`${game}: every level and daily puzzle has exactly one answer, and the check accepts it`, () => {
    let slowest = 0;
    for (const puzzle of LEVELS.map((n) => () => G.level(game, n)).concat(DAYS.map((d) => () => G.daily(game, d)))) {
      const t = Date.now(), p = puzzle();
      slowest = Math.max(slowest, Date.now() - t);
      assert.equal(G.solve[game](p), 1, `${game} ${p.level || p.day} has one answer`);
      assert.equal(G.check[game](p, answer[game](p)).solved, true, `${game} ${p.level || p.day}: the answer counts as solved`);
      assert.ok(['Easy', 'Medium', 'Hard', 'Expert'].includes(p.difficulty));
    }
    assert.ok(slowest < 2000, `${game}: the slowest puzzle took ${slowest} ms to make`);
  });

  test(`${game}: the same level is the same puzzle every time`, () => {
    for (const n of [1, 77, 4321]) assert.deepEqual(JSON.stringify(G.level(game, n)), JSON.stringify(G.level(game, n)));
    assert.notDeepEqual(JSON.stringify(G.level(game, 2)), JSON.stringify(G.level(game, 3)));
    assert.equal(JSON.stringify(G.daily(game, '2026-11-02')), JSON.stringify(G.daily(game, '2026-11-02')));
  });
}

test('levels get harder: bigger boards later on', () => {
  assert.equal(G.level('stars', 1).size, 5);
  assert.ok(G.level('stars', 500).size >= 7);
  assert.equal(G.level('duo', 1).size, 4);
  assert.equal(G.level('trail', 1).size, 4);
  assert.ok(G.level('trail', 900).size >= 6);
  const early = G.level('six', 1).givens.filter(Boolean).length, late = G.level('six', 900).givens.filter(Boolean).length;
  assert.ok(early > late, 'fewer numbers given later on');
  assert.throws(() => G.level('stars', 0));
  assert.throws(() => G.level('stars', G.LEVELS + 1));
});

test('the checks catch mistakes the way a player makes them', () => {
  const s = G.level('stars', 40), stars = answer.stars(s);
  const moved = stars.slice(); moved[0] = moved[1] - s.size; // straight above the next row's star
  assert.equal(G.check.stars(s, moved).solved, false);
  assert.ok(G.check.stars(s, moved).bad.length >= 2);
  assert.equal(G.check.stars(s, stars.slice(0, -1)).solved, false, 'one star short');

  const d = G.level('duo', 40), grid = d.solution.slice();
  grid[0] = 1 - grid[0];
  assert.equal(G.check.duo(d, grid).solved, false);
  assert.ok(G.check.duo(d, grid).bad.length > 0);

  const x = G.level('six', 40), six = x.solution.slice();
  const j = six.findIndex((v, i) => i % 6 === 1); six[0] = six[j];
  assert.ok(G.check.six(x, six).bad.includes(0));

  const t = G.level('trail', 40);
  assert.equal(G.check.trail(t, t.solution.slice(0, -1)).solved, false, 'not every cell yet');
  const jump = [t.solution[0], t.solution[2]];
  assert.equal(G.check.trail(t, jump).solved, false);
});

test('daily puzzles are numbered from the first day and change every day', () => {
  assert.equal(G.dayNumber('2026-10-26'), 1);
  assert.equal(G.dayNumber('2026-11-25'), 31);
  assert.notEqual(JSON.stringify(G.daily('six', '2026-11-01')), JSON.stringify(G.daily('six', '2026-11-02')));
});
