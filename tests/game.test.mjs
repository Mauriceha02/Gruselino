import test from 'node:test';
import assert from 'node:assert/strict';
import { FIGURES } from '../public/app/game/figures.js';
import { createGame, reveal, resolveAnswers, nextCard, score, winners, assertGameState, shuffle } from '../public/app/game/game.js';
import { botReactions } from '../public/app/ai/reaction.js';

test('every deck has 33 valid cards, seven distinct figures and balanced solutions', () => {
  for (let run = 0; run < 100; run++) {
    const state = createGame(3, 'strong');
    assertGameState(state);
    assert.equal(new Set(state.deck.map(card => card.id)).size, 33);
    for (const card of state.deck) {
      assert.equal(card.figures.length, 7);
      assert(!card.figures.some(placement => placement.figure === card.missing));
    }
    const counts = FIGURES.map(figure => state.deck.filter(card => card.missing === figure.id).length);
    assert.equal(counts.filter(count => count === 5).length, 1);
    assert.equal(counts.filter(count => count === 4).length, 7);
  }
});

test('shuffle preserves input and can produce both permutations of two cards', () => {
  const input = ['a', 'b'];
  assert.deepEqual(shuffle(input, () => 0), ['b', 'a']);
  assert.deepEqual(shuffle(input, () => .9999), ['a', 'b']);
  assert.deepEqual(input, ['a', 'b']);
  for (const invalid of [NaN, -1, 1, Infinity]) assert.throws(() => createGame(1, 'easy', () => invalid));
});

test('the first correct valid answer wins; wrong, stale and duplicate answers cannot score', () => {
  const state = reveal(createGame(2, 'easy'));
  const card = state.deck[0];
  const wrong = FIGURES.find(figure => figure.id !== card.missing).id;
  assert.equal(resolveAnswers(state, card.id, [{ playerId: 'human', figure: wrong, timeMs: 1 }]), state);
  assert.equal(resolveAnswers(state, 'stale', [{ playerId: 'human', figure: card.missing, timeMs: 1 }]), state);
  const answers = [{ playerId: 'human', figure: wrong, timeMs: 1 }, { playerId: 'bot-1', figure: card.missing, timeMs: 3000 }, { playerId: 'human', figure: card.missing, timeMs: 2500 }, { playerId: 'unknown', figure: card.missing, timeMs: 0 }];
  const won = resolveAnswers(state, card.id, answers);
  assert.equal(score(won, 'human'), 1);
  assert.equal(resolveAnswers(won, card.id, answers), won);
  const next = reveal(nextCard(won));
  assert.equal(resolveAnswers(next, card.id, answers), next);
  assertGameState(next);
});

test('an exact tie is resolved only among the distinct fastest correct players', () => {
  const state = reveal(createGame(2, 'easy'));
  const card = state.deck[0];
  const answers = ['human', 'human', 'bot-1'].map(playerId => ({ playerId, figure: card.missing, timeMs: 20 }));
  answers.push({ playerId: 'bot-2', figure: card.missing, timeMs: 21 });
  assert.equal(resolveAnswers(state, card.id, answers, () => 0).awards[0].playerId, 'human');
  assert.equal(resolveAnswers(state, card.id, answers, () => .999).awards[0].playerId, 'bot-1');
});

test('all 33 cards award once and the game finishes with the correct winner', () => {
  let state = createGame(1, 'easy');
  for (let index = 0; index < 33; index++) {
    state = reveal(state);
    const card = state.deck[state.index];
    state = resolveAnswers(state, card.id, [{ playerId: index < 17 ? 'human' : 'bot-1', figure: card.missing, timeMs: 500 }]);
    assertGameState(state);
    state = nextCard(state);
    assertGameState(state);
  }
  assert.equal(state.status, 'finished');
  assert.equal(state.awards.length, 33);
  assert.equal(score(state, 'human'), 17);
  assert.equal(winners(state)[0].id, 'human');
  assert.equal(nextCard(state), state);
});

test('bot delays follow the chosen strength and are drawn after each reveal', () => {
  for (const difficulty of ['easy', 'strong']) {
    const state = createGame(3, difficulty);
    const min = difficulty === 'easy' ? 4000 : 2000;
    const max = difficulty === 'easy' ? 8000 : 5000;
    assert(botReactions(state, () => 0).every(reaction => reaction.timeMs === min));
    assert(botReactions(state, () => .999999).every(reaction => reaction.timeMs === max));
  }
});
