import { Player } from './types';

// A rating-vs-rating combat model. Both the player and enemies carry an
// Attack rating and a Defense rating; a hit is mitigated by how the
// defender's Defense rating compares to the attacker's Attack rating.
export const BASE_ATTACK_RATING = 6;
export const BASE_DEFENSE_RATING = 12;

// Player Attack rating: base 6 scaled by equipped-gear attack percentages.
export function playerAttackRating(player: Player): number {
  return Math.round(BASE_ATTACK_RATING * (1 + player.attackPercent / 100));
}

// Player Defense rating: base 12 scaled by equipped-gear defense percentages,
// plus any temporary defense (shield) built up this turn from cards.
export function playerDefenseRating(player: Player, tempDefense: number = 0): number {
  return Math.round(BASE_DEFENSE_RATING * (1 + player.defensePercent / 100)) + tempDefense;
}

// Fraction of an incoming hit removed. Reaching parity (defense == attack)
// halves the hit; doubling the attacker's rating negates it entirely. Below
// parity it scales down proportionally, so defense is never wholly useless.
export function mitigationFraction(defenseRating: number, attackRating: number): number {
  if (attackRating <= 0) return 1;
  return Math.min(1, Math.max(0, 0.5 * (defenseRating / attackRating)));
}

// Applies mitigation to a raw damage number. `floor` is the minimum damage
// that always lands (0 for enemy hits so a fully-defended turn takes nothing;
// 1 for the player's own cards so an attack always chips something).
export function applyMitigation(
  rawDamage: number,
  defenseRating: number,
  attackRating: number,
  floor: number = 0
): number {
  const reduced = rawDamage * (1 - mitigationFraction(defenseRating, attackRating));
  return Math.max(floor, Math.round(reduced));
}
