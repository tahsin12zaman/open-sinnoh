import {
  parsePlatinumPartyPokemon,
  type PlatinumPartyPokemonData,
} from './platinum-pokemon-data.ts';
import {
  PLATINUM_PARTY_DATA_SIZE,
} from './platinum-pokemon.ts';
import type {
  DecodedPlatinumBoxPokemon,
} from './platinum-pc-boxes.ts';

export type PlatinumBoxPokemonData = Omit<
  PlatinumPartyPokemonData,
  | 'status'
  | 'level'
  | 'capsuleId'
  | 'hp'
  | 'stats'
>;

export function parsePlatinumBoxPokemon(
  pokemon: DecodedPlatinumBoxPokemon,
): PlatinumBoxPokemonData {
  const parsed = parsePlatinumPartyPokemon({
    ...pokemon,
    partyData: new Uint8Array(
      PLATINUM_PARTY_DATA_SIZE,
    ),
  });

  const {
    status: _status,
    level: _level,
    capsuleId: _capsuleId,
    hp: _hp,
    stats: _stats,
    ...boxed
  } = parsed;

  void _status;
  void _level;
  void _capsuleId;
  void _hp;
  void _stats;

  return boxed;
}