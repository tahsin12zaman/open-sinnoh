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

function validateInteger(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Invalid Platinum Pokémon ${name} ${value}`,
    );
  }
}

function validateBoolean(
  name: string,
  value: boolean,
): void {
  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Platinum Pokémon ${name}`,
    );
  }
}

function validateStats(
  name: string,
  stats: PlatinumStats,
  maximum: number,
): void {
  validateInteger(
    `${name} HP`,
    stats.hp,
    0,
    maximum,
  );
  validateInteger(
    `${name} Attack`,
    stats.attack,
    0,
    maximum,
  );
  validateInteger(
    `${name} Defense`,
    stats.defense,
    0,
    maximum,
  );
  validateInteger(
    `${name} Speed`,
    stats.speed,
    0,
    maximum,
  );
  validateInteger(
    `${name} Special Attack`,
    stats.spAttack,
    0,
    maximum,
  );
  validateInteger(
    `${name} Special Defense`,
    stats.spDefense,
    0,
    maximum,
  );
}

function validateCodes(
  name: string,
  codes: number[],
  length: number,
): void {
  if (codes.length !== length) {
    throw new Error(
      `Invalid Platinum Pokémon ${name} length ${codes.length}`,
    );
  }

  codes.forEach(
    (code, index) => {
      validateInteger(
        `${name} code ${index}`,
        code,
        0,
        0xffff,
      );
    },
  );
}

function validateDate(
  name: string,
  date: {
    year: number;
    month: number;
    day: number;
  },
): void {
  validateInteger(
    `${name} year`,
    date.year,
    0,
    0xff,
  );
  validateInteger(
    `${name} month`,
    date.month,
    0,
    12,
  );
  validateInteger(
    `${name} day`,
    date.day,
    0,
    31,
  );

  const empty =
    date.year === 0 &&
    date.month === 0 &&
    date.day === 0;

  if (
    !empty &&
    (
      date.month === 0 ||
      date.day === 0
    )
  ) {
    throw new Error(
      `Invalid Platinum Pokémon ${name} date`,
    );
  }
}

function validatePokemonData(
  data: PlatinumPartyPokemonData,
): void {
  validateInteger(
    'personality',
    data.personality,
    0,
    0xffffffff,
  );
  validateInteger(
    'species',
    data.species,
    1,
    493,
  );
  validateInteger(
    'held item',
    data.heldItem,
    0,
    0xffff,
  );
  validateInteger(
    'OT id',
    data.otId,
    0,
    0xffffffff,
  );
  validateInteger(
    'experience',
    data.exp,
    0,
    0xffffffff,
  );
  validateInteger(
    'friendship',
    data.friendship,
    0,
    0xff,
  );
  validateInteger(
    'ability',
    data.ability,
    0,
    0xff,
  );
  validateInteger(
    'markings',
    data.markings,
    0,
    0xff,
  );
  validateInteger(
    'language',
    data.language,
    0,
    0xff,
  );

  validateStats(
    'EV',
    data.evs,
    0xff,
  );

  for (
    const [name, value] of
      Object.entries(data.condition)
  ) {
    validateInteger(
      `condition ${name}`,
      value,
      0,
      0xff,
    );
  }

  if (data.moves.length > 4) {
    throw new Error(
      `Invalid Platinum Pokémon move count ${data.moves.length}`,
    );
  }

  if (
    data.pp.length !==
      data.moves.length ||
    data.ppUps.length !==
      data.moves.length
  ) {
    throw new Error(
      'Platinum Pokémon moves, PP and PP Ups lengths do not match',
    );
  }

  data.moves.forEach(
    (move, index) => {
      validateInteger(
        `move ${index}`,
        move,
        1,
        0xffff,
      );
      validateInteger(
        `PP ${index}`,
        data.pp[index]!,
        0,
        0xff,
      );
      validateInteger(
        `PP Up ${index}`,
        data.ppUps[index]!,
        0,
        3,
      );
    },
  );

  validateStats(
    'IV',
    data.ivs,
    31,
  );
  validateBoolean(
    'egg flag',
    data.isEgg,
  );
  validateBoolean(
    'nickname flag',
    data.hasNickname,
  );
  validateBoolean(
    'fateful-encounter flag',
    data.fatefulEncounter,
  );
  validateInteger(
    'gender',
    data.gender,
    0,
    3,
  );
  validateInteger(
    'form',
    data.form,
    0,
    31,
  );

  validateCodes(
    'nickname',
    data.nicknameCodes,
    11,
  );
  validateCodes(
    'OT name',
    data.otNameCodes,
    8,
  );

  validateInteger(
    'origin game',
    data.originGame,
    0,
    0xff,
  );
  validateInteger(
    'Pokérus',
    data.pokerus,
    0,
    0xff,
  );
  validateInteger(
    'Poké Ball',
    data.pokeball,
    0,
    0xff,
  );
  validateInteger(
    'met level',
    data.metLevel,
    0,
    0x7f,
  );
  validateInteger(
    'OT gender',
    data.otGender,
    0,
    1,
  );
  validateInteger(
    'egg location',
    data.eggLocation,
    0,
    0xffff,
  );
  validateInteger(
    'met location',
    data.metLocation,
    0,
    0xffff,
  );

  validateDate(
    'egg',
    data.eggDate,
  );
  validateDate(
    'met',
    data.metDate,
  );

  validateInteger(
    'status',
    data.status,
    0,
    0xffffffff,
  );
  validateInteger(
    'level',
    data.level,
    0,
    0xff,
  );
  validateInteger(
    'capsule id',
    data.capsuleId,
    0,
    0xff,
  );
  validateInteger(
    'current HP',
    data.hp,
    0,
    0xffff,
  );
  validateStats(
    'party stat',
    data.stats,
    0xffff,
  );

  validateInteger(
    'GBA ribbons',
    data.ribbons.gba,
    0,
    0xffffffff,
  );
  validateInteger(
    'DS ribbon word',
    data.ribbons.ds1,
    0,
    0xffffffff,
  );

  if (
    typeof data.ribbons.ds2 !==
      'bigint' ||
    data.ribbons.ds2 < 0n ||
    data.ribbons.ds2 >
      0xffffffffffffffffn
  ) {
    throw new Error(
      `Invalid Platinum Pokémon DS ribbon value ${String(data.ribbons.ds2)}`,
    );
  }
}

function cloneBlocks(
  pokemon:
    DecodedPlatinumPartyPokemon |
    undefined,
): [
  Uint8Array,
  Uint8Array,
  Uint8Array,
  Uint8Array,
] {
  if (!pokemon) {
    return [
      new Uint8Array(0x20),
      new Uint8Array(0x20),
      new Uint8Array(0x20),
      new Uint8Array(0x20),
    ];
  }

  return pokemon.blocks.map(
    (block) => block.slice(),
  ) as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];
}

function setWords(
  data: DataView,
  offset: number,
  values: number[],
  count: number,
): void {
  for (
    let index = 0;
    index < count;
    index++
  ) {
    data.setUint16(
      offset + index * 2,
      values[index] ?? 0,
      true,
    );
  }
}

function ivWord(
  data: PlatinumPartyPokemonData,
): number {
  return (
    data.ivs.hp |
    (data.ivs.attack << 5) |
    (data.ivs.defense << 10) |
    (data.ivs.speed << 15) |
    (data.ivs.spAttack << 20) |
    (data.ivs.spDefense << 25) |
    (data.isEgg ? 1 << 30 : 0) |
    (data.hasNickname
      ? 0x80000000
      : 0)
  ) >>> 0;
}

function writeLocation(
  modern: DataView,
  modernOffset: number,
  legacy: DataView,
  legacyOffset: number,
  value: number,
  hadBase: boolean,
): void {
  const usedLegacy =
    hadBase &&
    modern.getUint16(
      modernOffset,
      true,
    ) === 0 &&
    legacy.getUint16(
      legacyOffset,
      true,
    ) !== 0;

  if (usedLegacy) {
    modern.setUint16(
      modernOffset,
      0,
      true,
    );
    legacy.setUint16(
      legacyOffset,
      value,
      true,
    );
  } else {
    modern.setUint16(
      modernOffset,
      value,
      true,
    );

    if (!hadBase) {
      legacy.setUint16(
        legacyOffset,
        0,
        true,
      );
    }
  }
}

/**
 * Writes modeled Pokémon fields into cloned decrypted blocks.
 * Unknown block and party bytes are preserved when `pokemon` is
 * supplied; otherwise they begin as zero.
 */
export function writePlatinumPartyPokemonData(
  data: PlatinumPartyPokemonData,
  pokemon?: DecodedPlatinumPartyPokemon,
): DecodedPlatinumPartyPokemon {
  validatePokemonData(data);

  const blocks =
    cloneBlocks(pokemon);

  const partyData =
    pokemon?.partyData.slice() ??
    new Uint8Array(0x64);

  const blockA = view(blocks[0]);
  const blockB = view(blocks[1]);
  const blockC = view(blocks[2]);
  const blockD = view(blocks[3]);
  const party = view(partyData);

  blockA.setUint16(
    0,
    data.species,
    true,
  );
  blockA.setUint16(
    2,
    data.heldItem,
    true,
  );
  blockA.setUint32(
    4,
    data.otId,
    true,
  );
  blockA.setUint32(
    8,
    data.exp,
    true,
  );
  blockA.setUint8(
    0x0c,
    data.friendship,
  );
  blockA.setUint8(
    0x0d,
    data.ability,
  );
  blockA.setUint8(
    0x0e,
    data.markings,
  );
  blockA.setUint8(
    0x0f,
    data.language,
  );

  [
    data.evs.hp,
    data.evs.attack,
    data.evs.defense,
    data.evs.speed,
    data.evs.spAttack,
    data.evs.spDefense,
  ].forEach(
    (value, index) => {
      blockA.setUint8(
        0x10 + index,
        value,
      );
    },
  );

  [
    data.condition.cool,
    data.condition.beauty,
    data.condition.cute,
    data.condition.smart,
    data.condition.tough,
    data.condition.sheen,
  ].forEach(
    (value, index) => {
      blockA.setUint8(
        0x16 + index,
        value,
      );
    },
  );

  blockA.setUint32(
    0x1c,
    data.ribbons.ds1,
    true,
  );

  setWords(
    blockB,
    0,
    data.moves,
    4,
  );

  for (
    let index = 0;
    index < 4;
    index++
  ) {
    blockB.setUint8(
      8 + index,
      data.pp[index] ?? 0,
    );
    blockB.setUint8(
      0x0c + index,
      data.ppUps[index] ?? 0,
    );
  }

  blockB.setUint32(
    0x10,
    ivWord(data),
    true,
  );
  blockB.setUint32(
    0x14,
    data.ribbons.gba,
    true,
  );
  blockB.setUint8(
    0x18,
    (
      (data.fatefulEncounter
        ? 1
        : 0) |
      (data.gender << 1) |
      (data.form << 3)
    ) &
      0xff,
  );

  setWords(
    blockC,
    0,
    data.nicknameCodes,
    11,
  );
  blockC.setUint8(
    0x17,
    data.originGame,
  );
  blockC.setBigUint64(
    0x18,
    data.ribbons.ds2,
    true,
  );

  setWords(
    blockD,
    0,
    data.otNameCodes,
    8,
  );

  blockD.setUint8(
    0x10,
    data.eggDate.year,
  );
  blockD.setUint8(
    0x11,
    data.eggDate.month,
  );
  blockD.setUint8(
    0x12,
    data.eggDate.day,
  );
  blockD.setUint8(
    0x13,
    data.metDate.year,
  );
  blockD.setUint8(
    0x14,
    data.metDate.month,
  );
  blockD.setUint8(
    0x15,
    data.metDate.day,
  );

  writeLocation(
    blockB,
    0x1c,
    blockD,
    0x16,
    data.eggLocation,
    pokemon !== undefined,
  );
  writeLocation(
    blockB,
    0x1e,
    blockD,
    0x18,
    data.metLocation,
    pokemon !== undefined,
  );

  blockD.setUint8(
    0x1a,
    data.pokerus,
  );
  blockD.setUint8(
    0x1b,
    data.pokeball,
  );
  blockD.setUint8(
    0x1c,
    data.metLevel |
      (data.otGender << 7),
  );

  party.setUint32(
    0,
    data.status,
    true,
  );
  party.setUint8(
    4,
    data.level,
  );
  party.setUint8(
    5,
    data.capsuleId,
  );
  party.setUint16(
    6,
    data.hp,
    true,
  );
  party.setUint16(
    8,
    data.stats.hp,
    true,
  );
  party.setUint16(
    0x0a,
    data.stats.attack,
    true,
  );
  party.setUint16(
    0x0c,
    data.stats.defense,
    true,
  );
  party.setUint16(
    0x0e,
    data.stats.speed,
    true,
  );
  party.setUint16(
    0x10,
    data.stats.spAttack,
    true,
  );
  party.setUint16(
    0x12,
    data.stats.spDefense,
    true,
  );

  return {
    personality:
      data.personality,
    sanity:
      pokemon?.sanity ?? 0,
    checksum: 0,
    blocks,
    partyData,
  };
}
