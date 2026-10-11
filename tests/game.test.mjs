import test from 'node:test';
import assert from 'node:assert/strict';
import { FIGURES } from '../public/app/game/figures.js';
import { createGame, reveal, resolveAnswers, nextCard, score, winners, assertGameState, shuffle } from '../public/app/game/game.js';
import { botReactions } from '../public/app/ai/reaction.js';

for (const cardCount of [10, 33]) {
  test(`${cardCount}-card games have seven distinct figures per card and balanced solutions`, () => {
    for (let run = 0; run < 100; run++) {
      const state = createGame(3, 'strong', Math.random, cardCount);
      assertGameState(state);
      assert.equal(state.deck.length, cardCount);
      assert.equal(new Set(state.deck.map(card => card.id)).size, cardCount);
      for (const card of state.deck) {
        assert.equal(new Set(card.figures.map(placement => placement.figure)).size, 7);
        assert(!card.figures.some(placement => placement.figure === card.missing));
      }
      const counts = FIGURES.map(figure => state.deck.filter(card => card.missing === figure.id).length);
      const minimum = Math.floor(cardCount / FIGURES.length);
      assert.equal(counts.filter(count => count === minimum + 1).length, cardCount % FIGURES.length);
      assert.equal(counts.filter(count => count === minimum).length, FIGURES.length - cardCount % FIGURES.length);
    }
  });

  test(`${cardCount}-card games finish exactly at the chosen length without awarding extra points`, () => {
    let state = createGame(1, 'easy', Math.random, cardCount);
    const humanWins = Math.floor(cardCount / 2) + 1;
    for (let index = 0; index < cardCount; index++) {
      state = reveal(state);
      const card = state.deck[state.index];
      const answers = [{ playerId: index < humanWins ? 'human' : 'bot-1', figure: card.missing, timeMs: 500 }];
      state = resolveAnswers(state, card.id, answers);
      assert.equal(resolveAnswers(state, card.id, answers), state);
      assertGameState(state);
      state = nextCard(state);
      assertGameState(state);
      assert.equal(state.status, index === cardCount - 1 ? 'finished' : 'ready');
    }
    assert.equal(state.index, cardCount);
    assert.equal(state.awards.length, cardCount);
    assert.equal(score(state, 'human'), humanWins);
    assert.equal(winners(state)[0].id, 'human');
    assert.equal(nextCard(state), state);
    assert.equal(resolveAnswers(state, state.deck.at(-1).id, [{ playerId: 'human', figure: state.deck.at(-1).missing, timeMs: 0 }]), state);
  });
}

test('normal games remain the default and unsupported lengths are rejected', () => {
  assert.equal(createGame(1, 'easy').deck.length, 33);
  for (const length of [0, 9, 11, 32, 34, NaN, '10']) assert.throws(() => createGame(1, 'easy', Math.random, length));
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

test('bot delays follow the chosen strength and are drawn after each reveal', () => {
  for (const difficulty of ['easy', 'strong']) {
    const state = createGame(3, difficulty);
    const min = difficulty === 'easy' ? 4000 : 2000;
    const max = difficulty === 'easy' ? 8000 : 5000;
    assert(botReactions(state, () => 0).every(reaction => reaction.timeMs === min));
    assert(botReactions(state, () => .999999).every(reaction => reaction.timeMs === max));
  }
});
