import {
  parsePlatinumPartyPokemon,
  writePlatinumPartyPokemonData,
  type PlatinumPartyPokemonData,
  type PlatinumStats,
} from './platinum-pokemon-data.ts';
import {
  PLATINUM_PARTY_DATA_SIZE,
  type DecodedPlatinumPartyPokemon,
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

const ZERO_STATS: PlatinumStats = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
  spAttack: 0,
  spDefense: 0,
};

export function parsePlatinumBoxPokemon(
  pokemon: DecodedPlatinumBoxPokemon,
): PlatinumBoxPokemonData {
  const parsed =
    parsePlatinumPartyPokemon({
      ...pokemon,
      partyData:
        new Uint8Array(
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

/**
 * Writes semantic boxed-Pokémon fields into cloned decrypted blocks.
 * Unknown bytes are preserved when an existing decoded record is
 * supplied.
 */
export function writePlatinumBoxPokemonData(
  data: PlatinumBoxPokemonData,
  pokemon?: DecodedPlatinumBoxPokemon,
): DecodedPlatinumBoxPokemon {
  const partyBase:
    DecodedPlatinumPartyPokemon |
    undefined =
    pokemon === undefined
      ? undefined
      : {
          ...pokemon,
          partyData:
            new Uint8Array(
              PLATINUM_PARTY_DATA_SIZE,
            ),
        };

  const written =
    writePlatinumPartyPokemonData(
      {
        ...data,
        status: 0,
        level: 1,
        capsuleId: 0,
        hp: 0,
        stats: {
          ...ZERO_STATS,
        },
      },
      partyBase,
    );

  return {
    personality:
      written.personality,
    sanity: written.sanity,
    checksum: written.checksum,
    blocks: written.blocks,
  };
}
