import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalMatch, readLocalSnapshot, missingFigure } from '../public/app/game/local-match.js';
import { FIGURES } from '../public/app/game/figures.js';

const id = 'ab'.repeat(16);
function reveal(match) {
  const round = match.snapshot().round;
  assert.equal(match.ready('host', round), false);
  assert.equal(match.ready('host', round), false);
  assert.equal(match.ready('guest', round), true);
  assert(match.reveal(round));
  readLocalSnapshot(match.snapshot());
  return round;
}
test('both devices must be ready and the host awards each card once', () => {
  const match = new LocalMatch(id, 10);
  const initial = match.snapshot();
  assert.equal(match.ready('unknown', initial.round), false);
  assert.equal(match.reveal(initial.round), false);
  assert.equal(match.ready('guest', 'old'), false);
  const round = reveal(match);
  const figure = missingFigure(match.snapshot());
  assert.equal(match.answer('unknown', { round, figure }, 1), 'ignored');
  assert.equal(match.answer('guest', { round, figure }, 1), 'won');
  assert.equal(match.answer('host', { round, figure }, 2), 'ignored');
  assert.deepEqual(match.snapshot().scores, { host: 0, guest: 1 });
  assert(!JSON.stringify(match.snapshot()).includes('missing'));
  assert(!JSON.stringify(match.snapshot()).includes('deck'));
});
test('wrong answers are blocked on the host even when a guest bypasses its buttons', () => {
  const match = new LocalMatch(id, 10);
  const round = reveal(match);
  const figure = missingFigure(match.snapshot());
  const wrong = FIGURES.find(item => item.id !== figure).id;
  assert.equal(match.answer('guest', { round, figure: wrong }, 100), 'wrong');
  assert.equal(match.answer('guest', { round, figure }, 1599), 'blocked');
  assert.equal(match.answer('guest', { round, figure }, 1600), 'won');
});
test('pause and resume keep the card and points but invalidate old attempts and acknowledgements', () => {
  const match = new LocalMatch(id, 10);
  const round = reveal(match);
  const card = match.snapshot().card;
  assert(match.pause()); assert(!match.pause()); readLocalSnapshot(match.snapshot());
  assert.equal(match.answer('guest', { round, figure: missingFigure(match.snapshot()) }, 2000), 'ignored');
  assert(match.resume());
  assert.equal(match.snapshot().card, null);
  assert.notEqual(match.snapshot().round, round);
  assert.equal(match.ready('guest', round), false);
  const resumed = reveal(match);
  assert.deepEqual(match.snapshot().card, card);
  assert.equal(match.answer('guest', { round, figure: missingFigure(match.snapshot()) }, 3000), 'ignored');
  assert.equal(match.answer('host', { round: resumed, figure: missingFigure(match.snapshot()) }, 3000), 'won');
  assert(match.pause()); assert(match.resume());
  assert.equal(match.snapshot().stage, 'result');
  assert.deepEqual(match.snapshot().scores, { host: 1, guest: 0 });
  readLocalSnapshot(match.snapshot());
});
for (const total of [10, 33]) test(`a ${total}-card multiplayer game ends with exactly ${total} points`, () => {
  const match = new LocalMatch(id, total);
  for (let index = 0; index < total; index++) {
    const round = reveal(match);
    const role = index % 2 ? 'guest' : 'host';
    assert.equal(match.answer(role, { round, figure: missingFigure(match.snapshot()) }, index * 10000), 'won');
    readLocalSnapshot(match.snapshot());
    assert(match.advance(round));
    readLocalSnapshot(match.snapshot());
    assert.equal(match.answer(role, { round, figure: 'ghost' }, 999999), 'ignored');
  }
  assert.equal(match.snapshot().stage, 'finished');
  assert.equal(match.snapshot().card, null);
  assert.equal(match.snapshot().scores.host + match.snapshot().scores.guest, total);
  assert.equal(match.advance(match.snapshot().round), false);
});
test('guest snapshots reject injected layouts, scores and invalid progress', () => {
  const match = new LocalMatch(id, 10);
  reveal(match);
  for (const mutate of [
    state => state.total = 11,
    state => state.scores.guest = 100,
    state => state.stage = 'finished',
    state => state.card.figures[0].figure = '<img onerror=alert(1)>',
    state => state.card.figures[0].rotation = '0; background:url(x)',
    state => state.card.figures[0].slot = state.card.figures[1].slot,
    state => state.card.id = 'card-33',
    state => state.round = id + ':9:0',
  ]) {
    const state = JSON.parse(JSON.stringify(match.snapshot())); mutate(state);
    assert.throws(() => readLocalSnapshot(state));
  }
});


test('covered cards stay private until reveal, including the next card and resumed attempts', () => {
  const match = new LocalMatch(id, 10);
  const round = match.snapshot().round;
  assert.equal(match.snapshot().card, null); assert.equal(missingFigure(match.snapshot()), null);
  readLocalSnapshot(match.snapshot());
  match.ready('host', round); match.ready('guest', round);
  assert.equal(match.snapshot().stage, 'countdown'); assert.equal(match.snapshot().card, null);
  readLocalSnapshot(match.snapshot());
  assert.equal(match.answer('guest', { round, figure: 'ghost' }, 1), 'ignored');
  match.reveal(round); const visible = match.snapshot();
  assert(visible.card); readLocalSnapshot(visible);
  match.pause(); assert.equal(match.snapshot().card, null); readLocalSnapshot(match.snapshot());
  match.resume(); assert.equal(match.snapshot().card, null);
  const resumed = reveal(match); assert.deepEqual(match.snapshot().card, visible.card);
  match.answer('host', { round: resumed, figure: missingFigure(match.snapshot()) }, 2000);
  match.advance(resumed); assert.equal(match.snapshot().card, null); readLocalSnapshot(match.snapshot());
  const leaked = { ...match.snapshot(), card: visible.card };
  assert.throws(() => readLocalSnapshot(leaked));
  assert.throws(() => readLocalSnapshot({ ...visible, card: null }));
  assert.throws(() => readLocalSnapshot({ ...visible, version: 1 }));
});
