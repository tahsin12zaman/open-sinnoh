import type { DecodedPlatinumPartyPokemon } from './platinum-pokemon.ts';

export interface PlatinumStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spAttack: number;
  spDefense: number;
}

export interface PlatinumPartyPokemonData {
  personality: number;
  species: number;
  heldItem: number;
  otId: number;
  exp: number;
  friendship: number;
  ability: number;
  markings: number;
  language: number;
  evs: PlatinumStats;
  condition: {
    cool: number;
    beauty: number;
    cute: number;
    smart: number;
    tough: number;
    sheen: number;
  };
  moves: number[];
  pp: number[];
  ppUps: number[];
  ivs: PlatinumStats;
  isEgg: boolean;
  hasNickname: boolean;
  fatefulEncounter: boolean;
  gender: number;
  form: number;
  nicknameCodes: number[];
  otNameCodes: number[];
  originGame: number;
  pokerus: number;
  pokeball: number;
  metLevel: number;
  otGender: number;
  eggLocation: number;
  metLocation: number;
  eggDate: {
    year: number;
    month: number;
    day: number;
  };
  metDate: {
    year: number;
    month: number;
    day: number;
  };
  status: number;
  level: number;
  capsuleId: number;
  hp: number;
  stats: PlatinumStats;
  ribbons: {
    gba: number;
    ds1: number;
    ds2: bigint;
  };
}

function view(bytes: Uint8Array): DataView {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
}

function words(
  data: DataView,
  offset: number,
  count: number,
): number[] {
  return Array.from(
    { length: count },
    (_, index) =>
      data.getUint16(offset + index * 2, true),
  );
}

export function parsePlatinumPartyPokemon(
  pokemon: DecodedPlatinumPartyPokemon,
): PlatinumPartyPokemonData {
  const blockA = view(pokemon.blocks[0]);
  const blockB = view(pokemon.blocks[1]);
  const blockC = view(pokemon.blocks[2]);
  const blockD = view(pokemon.blocks[3]);
  const party = view(pokemon.partyData);

  const ivWord = blockB.getUint32(0x10, true);
  const formData = blockB.getUint8(0x18);
  const metData = blockD.getUint8(0x1c);

  const moves = words(blockB, 0, 4);
  const moveCount = moves.findIndex((move) => move === 0);
  const usedMoves =
    moveCount < 0 ? moves : moves.slice(0, moveCount);

  return {
    personality: pokemon.personality,
    species: blockA.getUint16(0, true),
    heldItem: blockA.getUint16(2, true),
    otId: blockA.getUint32(4, true),
    exp: blockA.getUint32(8, true),
    friendship: blockA.getUint8(0x0c),
    ability: blockA.getUint8(0x0d),
    markings: blockA.getUint8(0x0e),
    language: blockA.getUint8(0x0f),

    evs: {
      hp: blockA.getUint8(0x10),
      attack: blockA.getUint8(0x11),
      defense: blockA.getUint8(0x12),
      speed: blockA.getUint8(0x13),
      spAttack: blockA.getUint8(0x14),
      spDefense: blockA.getUint8(0x15),
    },

    condition: {
      cool: blockA.getUint8(0x16),
      beauty: blockA.getUint8(0x17),
      cute: blockA.getUint8(0x18),
      smart: blockA.getUint8(0x19),
      tough: blockA.getUint8(0x1a),
      sheen: blockA.getUint8(0x1b),
    },

    moves: usedMoves,
    pp: Array.from(
      { length: usedMoves.length },
      (_, index) => blockB.getUint8(8 + index),
    ),
    ppUps: Array.from(
      { length: usedMoves.length },
      (_, index) => blockB.getUint8(0x0c + index),
    ),

    ivs: {
      hp: ivWord & 0x1f,
      attack: (ivWord >>> 5) & 0x1f,
      defense: (ivWord >>> 10) & 0x1f,
      speed: (ivWord >>> 15) & 0x1f,
      spAttack: (ivWord >>> 20) & 0x1f,
      spDefense: (ivWord >>> 25) & 0x1f,
    },

    isEgg: Boolean((ivWord >>> 30) & 1),
    hasNickname: Boolean((ivWord >>> 31) & 1),
    fatefulEncounter: Boolean(formData & 1),
    gender: (formData >>> 1) & 3,
    form: formData >>> 3,

    nicknameCodes: words(blockC, 0, 11),
    originGame: blockC.getUint8(0x17),

    otNameCodes: words(blockD, 0, 8),
    pokerus: blockD.getUint8(0x1a),
    pokeball: blockD.getUint8(0x1b),
    metLevel: metData & 0x7f,
    otGender: metData >>> 7,

    eggLocation:
      blockB.getUint16(0x1c, true) ||
      blockD.getUint16(0x16, true),

    metLocation:
      blockB.getUint16(0x1e, true) ||
      blockD.getUint16(0x18, true),

    eggDate: {
      year: blockD.getUint8(0x10),
      month: blockD.getUint8(0x11),
      day: blockD.getUint8(0x12),
    },

    metDate: {
      year: blockD.getUint8(0x13),
      month: blockD.getUint8(0x14),
      day: blockD.getUint8(0x15),
    },

    status: party.getUint32(0, true),
    level: party.getUint8(4),
    capsuleId: party.getUint8(5),
    hp: party.getUint16(6, true),

    stats: {
      hp: party.getUint16(8, true),
      attack: party.getUint16(0x0a, true),
      defense: party.getUint16(0x0c, true),
      speed: party.getUint16(0x0e, true),
      spAttack: party.getUint16(0x10, true),
      spDefense: party.getUint16(0x12, true),
    },

    ribbons: {
      ds1: blockA.getUint32(0x1c, true),
      gba: blockB.getUint32(0x14, true),
      ds2: blockC.getBigUint64(0x18, true),
    },
  };
}