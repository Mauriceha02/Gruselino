import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, reveal, resolveAnswers, nextCard } from '../public/app/game/game.js';
import { loadGame, saveGame, getSavedSummary, STORAGE_KEY } from '../public/app/storage/local-game.js';

test('saving retains card layouts, results and uses only the Gruselino key', () => {
  const items = new Map([['phase10.game.v1', 'existing Phase10 save']]);
  const storage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
  const initial = reveal(createGame(1, 'easy'));
  const state = resolveAnswers(initial, initial.deck[0].id, [{ playerId: 'human', figure: initial.deck[0].missing, timeMs: 1500 }]);
  assert.equal(saveGame(storage, state), null);
  assert.deepEqual(loadGame(storage).state, state);
  assert.equal(items.get('phase10.game.v1'), 'existing Phase10 save');
  assert.deepEqual(getSavedSummary(storage), { card: 1, total: 33, score: 1, finished: false });
  assert(items.has(STORAGE_KEY));
});

test('forged state, duplicate figures, invalid layouts and injected names are rejected', () => {
  const original = createGame(1, 'easy');
  const mutations = [
    state => state.players[1].name = '<img src=x onerror=alert(1)>',
    state => state.deck[0].figures[0].figure = state.deck[0].missing,
    state => state.deck[0].figures[0].slot = state.deck[0].figures[1].slot,
    state => state.deck[0].figures[0].rotation = '0; background:url(https://bad.invalid)',
    state => state.awards.push({ cardId: state.deck[0].id, playerId: 'human', timeMs: 10 }),
    state => state.index = 33,
    state => state.deck[0] = null,
  ];
  for (const mutate of mutations) {
    const forged = JSON.parse(JSON.stringify(original)); mutate(forged);
    const loaded = loadGame({ getItem: () => JSON.stringify(forged) });
    assert.equal(loaded.state, null); assert(loaded.error);
  }
});

test('unavailable storage is reported without interrupting the game', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert(loadGame(storage).error);
  assert(saveGame(storage, createGame(1, 'easy')));
});

test('quick games retain their length, saved result and final summary across reloads', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  let state = reveal(createGame(1, 'easy', Math.random, 10));
  state = resolveAnswers(state, state.deck[0].id, [{ playerId: 'human', figure: state.deck[0].missing, timeMs: 1500 }]);
  assert.equal(saveGame(storage, state), null);
  assert.deepEqual(loadGame(storage).state, state);
  assert.deepEqual(getSavedSummary(storage), { card: 1, total: 10, score: 1, finished: false });
  state = nextCard(loadGame(storage).state);
  for (let index = 1; index < 10; index++) {
    state = reveal(state);
    state = nextCard(resolveAnswers(state, state.deck[index].id, [{ playerId: 'human', figure: state.deck[index].missing, timeMs: 1500 }]));
  }
  assert.equal(saveGame(storage, state), null);
  assert.deepEqual(loadGame(storage).state, state);
  assert.deepEqual(getSavedSummary(storage), { card: 10, total: 10, score: 10, finished: true });
});

test('shortened normal decks and invalid quick-game boundaries cannot load', () => {
  const normal = createGame(1, 'easy');
  const quick = createGame(1, 'easy', Math.random, 10);
  for (const mutation of [
    state => state.deck.pop(),
    state => state.index = 11,
    state => { state.status = 'finished'; state.index = 10; },
    state => state.deck[0].id = 'card-33',
    state => { for (let index = 1; index < state.deck.length; index++) { state.deck[index].missing = state.deck[0].missing; state.deck[index].figures = state.deck[0].figures; } },
  ]) {
    const forged = JSON.parse(JSON.stringify(quick));
    mutation(forged);
    assert.equal(loadGame({ getItem: () => JSON.stringify(forged) }).state, null);
  }
  normal.deck = normal.deck.slice(0, 11);
  assert.equal(loadGame({ getItem: () => JSON.stringify(normal) }).state, null);
});
