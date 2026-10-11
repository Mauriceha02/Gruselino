import { randomIndex, type GameState, type Random } from '../game/game.js';

export interface Reaction { playerId: string; timeMs: number }
export function botReactions(state: GameState, random: Random = Math.random): Reaction[] {
  return state.players.slice(1).map(player => {
    const [min, max] = player.difficulty === 'strong' ? [2000, 5000] : [4000, 8000];
    return { playerId: player.id, timeMs: min! + randomIndex(max! - min! + 1, random) };
  });
}
