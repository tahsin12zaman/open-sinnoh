export const PLATINUM_SAVE_SIZE = 0x80000;
export const PLATINUM_SAVE_SIGNATURE = 0x20060623;
export const PLATINUM_SAVE_FOOTER_SIZE = 0x14;

export interface PlatinumSaveFooter {
  saveCounter: number;
  blockCounter: number;
  size: number;
  signature: number;
  blockId: number;
  checksum: number;
}

export function crc16Ccitt(
  bytes: Uint8Array,
  start = 0,
  end = bytes.length,
): number {
  let crc = 0xffff;

  for (let i = start; i < end; i++) {
    crc ^= bytes[i]! << 8;

    for (let bit = 0; bit < 8; bit++) {
      crc =
        crc & 0x8000
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

export function readPlatinumSaveFooter(
  bytes: Uint8Array,
  footerOffset: number,
): PlatinumSaveFooter {
  if (
    footerOffset < 0 ||
    footerOffset + PLATINUM_SAVE_FOOTER_SIZE > bytes.length
  ) {
    throw new Error(
      `Platinum save footer at 0x${footerOffset.toString(16)} is outside the file`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  return {
    saveCounter: view.getUint32(footerOffset, true),
    blockCounter: view.getUint32(footerOffset + 4, true),
    size: view.getUint32(footerOffset + 8, true),
    signature: view.getUint32(footerOffset + 12, true),
    blockId: view.getUint8(footerOffset + 16),
    checksum: view.getUint16(footerOffset + 18, true),
  };
}

export function validatePlatinumSaveBlock(
  bytes: Uint8Array,
  blockOffset: number,
  blockSize: number,
  expectedBlockId: number,
): PlatinumSaveFooter {
  const blockEnd = blockOffset + blockSize;

  if (blockOffset < 0 || blockEnd > bytes.length) {
    throw new Error('Platinum save block is outside the file');
  }

  const footerOffset =
    blockEnd - PLATINUM_SAVE_FOOTER_SIZE;

  const footer = readPlatinumSaveFooter(
    bytes,
    footerOffset,
  );

  if (footer.signature !== PLATINUM_SAVE_SIGNATURE) {
    throw new Error(
      `Invalid Platinum save signature 0x${footer.signature.toString(16)}`,
    );
  }

  if (footer.size !== blockSize) {
    throw new Error(
      `Platinum save block says size 0x${footer.size.toString(16)}, expected 0x${blockSize.toString(16)}`,
    );
  }

  if (footer.blockId !== expectedBlockId) {
    throw new Error(
      `Platinum save block id ${footer.blockId}, expected ${expectedBlockId}`,
    );
  }

  const checksum = crc16Ccitt(
    bytes,
    blockOffset,
    footerOffset,
  );

  if (checksum !== footer.checksum) {
    throw new Error(
      `Invalid Platinum save checksum 0x${footer.checksum.toString(16)}, expected 0x${checksum.toString(16)}`,
    );
  }

  return footer;
}

export function validatePlatinumSaveSize(
  bytes: Uint8Array,
): void {
  if (bytes.length !== PLATINUM_SAVE_SIZE) {
    throw new Error(
      `Platinum save is ${bytes.length} bytes, expected ${PLATINUM_SAVE_SIZE}`,
    );
  }
}

export const PLATINUM_SAVE_COPY_OFFSETS = [
  0x00000,
  0x40000,
] as const;

export const PLATINUM_GENERAL_BLOCK = {
  offset: 0,
  size: 0xcf2c,
  blockId: 0,
} as const;

export const PLATINUM_STORAGE_BLOCK = {
  offset: 0xcf2c,
  size: 0x121e4,
  blockId: 1,
} as const;

export interface PlatinumSaveBlock {
  offset: number;
  footer: PlatinumSaveFooter;
}

export interface PlatinumSaveBlocks {
  general: PlatinumSaveBlock;
  storage: PlatinumSaveBlock;
}

function counterIsNewer(
  candidate: number,
  current: number,
): boolean {
  const difference = (candidate - current) >>> 0;

  return difference !== 0 && difference < 0x80000000;
}

function blockIsNewer(
  candidate: PlatinumSaveBlock,
  current: PlatinumSaveBlock,
): boolean {
  if (
    candidate.footer.saveCounter !==
    current.footer.saveCounter
  ) {
    return counterIsNewer(
      candidate.footer.saveCounter,
      current.footer.saveCounter,
    );
  }

  return counterIsNewer(
    candidate.footer.blockCounter,
    current.footer.blockCounter,
  );
}

function newestBlock(
  blocks: PlatinumSaveBlock[],
): PlatinumSaveBlock {
  if (blocks.length === 0) {
    throw new Error('No valid Platinum save block copies');
  }

  return blocks.slice(1).reduce(
    (current, candidate) =>
      blockIsNewer(candidate, current)
        ? candidate
        : current,
    blocks[0]!,
  );
}

function validBlockCopies(
  bytes: Uint8Array,
  specification: {
    offset: number;
    size: number;
    blockId: number;
  },
): PlatinumSaveBlock[] {
  const blocks: PlatinumSaveBlock[] = [];

  for (const copyOffset of PLATINUM_SAVE_COPY_OFFSETS) {
    const offset = copyOffset + specification.offset;

    try {
      blocks.push({
        offset,
        footer: validatePlatinumSaveBlock(
          bytes,
          offset,
          specification.size,
          specification.blockId,
        ),
      });
    } catch {
      // The other duplicated copy may still be valid.
    }
  }

  return blocks;
}

export function selectPlatinumSaveBlocks(
  bytes: Uint8Array,
): PlatinumSaveBlocks {
  validatePlatinumSaveSize(bytes);

  const general = newestBlock(
    validBlockCopies(bytes, PLATINUM_GENERAL_BLOCK),
  );

  const storage = newestBlock(
    validBlockCopies(bytes, PLATINUM_STORAGE_BLOCK),
  );

  if (
    general.footer.saveCounter !==
    storage.footer.saveCounter
  ) {
    throw new Error(
      `Platinum general/storage save counters disagree: ${general.footer.saveCounter} and ${storage.footer.saveCounter}`,
    );
  }

  return { general, storage };
}

export interface PlatinumWritableSave {
  general: Uint8Array;
  storage: Uint8Array;
}

/**
 * Clones a Platinum save, lets the caller modify the selected block
 * bodies, then refreshes and validates their checksums. Footers and
 * the older duplicate copies remain inaccessible to the writer.
 */
export function writePlatinumSave(
  bytes: Uint8Array,
  write: (save: PlatinumWritableSave) => void,
): Uint8Array {
  const blocks = selectPlatinumSaveBlocks(bytes);
  const output = bytes.slice();

  const body = (
    block: PlatinumSaveBlock,
    size: number,
  ) =>
    output.subarray(
      block.offset,
      block.offset +
        size -
        PLATINUM_SAVE_FOOTER_SIZE,
    );

  write({
    general: body(
      blocks.general,
      PLATINUM_GENERAL_BLOCK.size,
    ),
    storage: body(
      blocks.storage,
      PLATINUM_STORAGE_BLOCK.size,
    ),
  });

  const refresh = (
    block: PlatinumSaveBlock,
    size: number,
    blockId: number,
  ) => {
    const footerOffset =
      block.offset +
      size -
      PLATINUM_SAVE_FOOTER_SIZE;

    const view = new DataView(
      output.buffer,
      output.byteOffset,
      output.byteLength,
    );

    view.setUint16(
      footerOffset + 18,
      crc16Ccitt(
        output,
        block.offset,
        footerOffset,
      ),
      true,
    );

    validatePlatinumSaveBlock(
      output,
      block.offset,
      size,
      blockId,
    );
  };

  refresh(
    blocks.general,
    PLATINUM_GENERAL_BLOCK.size,
    PLATINUM_GENERAL_BLOCK.blockId,
  );

  refresh(
    blocks.storage,
    PLATINUM_STORAGE_BLOCK.size,
    PLATINUM_STORAGE_BLOCK.blockId,
  );

  return output;
}

export interface PlatinumTrainerData {
  nameCodes: number[];
  trainerId: number;
  secretId: number;
  money: number;
  gender: number;
  language: number;
  badges: number;
  appearance: number;
  gameCode: number;
  mainStoryCleared: boolean;
  hasNationalDex: boolean;
  coins: number;
  playTime: {
    hours: number;
    minutes: number;
    seconds: number;
  };
}

export function readPlatinumTrainerData(
  bytes: Uint8Array,
): PlatinumTrainerData {
  const { general } = selectPlatinumSaveBlocks(bytes);
  const base = general.offset;

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const nameCodes = Array.from(
    { length: 8 },
    (_, index) =>
      view.getUint16(base + 0x68 + index * 2, true),
  );

  const combinedId = view.getUint32(base + 0x78, true);
  const completionFlags = view.getUint8(
    base + 0x85,
  );

  return {
    nameCodes,
    trainerId: combinedId & 0xffff,
    secretId: combinedId >>> 16,
    money: view.getUint32(base + 0x7c, true),
    gender: view.getUint8(base + 0x80),
    language: view.getUint8(base + 0x81),
    badges: view.getUint8(base + 0x82),
    appearance: view.getUint8(base + 0x83),
    gameCode: view.getUint8(base + 0x84),
    mainStoryCleared:
      (completionFlags & 0x1) !== 0,
    hasNationalDex:
      (completionFlags & 0x2) !== 0,
    coins: view.getUint16(base + 0x88, true),
    playTime: {
      hours: view.getUint16(base + 0x8a, true),
      minutes: view.getUint8(base + 0x8c),
      seconds: view.getUint8(base + 0x8d),
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
      `Invalid Platinum ${name} value ${value}`,
    );
  }
}

/**
 * Writes every modeled trainer-card field while preserving all
 * unrelated and unknown Platinum save bytes.
 */
export function writePlatinumTrainerData(
  bytes: Uint8Array,
  trainer: PlatinumTrainerData,
): Uint8Array {
  if (trainer.nameCodes.length !== 8) {
    throw new Error(
      `Invalid Platinum trainer name length ${trainer.nameCodes.length}`,
    );
  }

  trainer.nameCodes.forEach((code, index) =>
    validateInteger(
      `trainer name code ${index}`,
      code,
      0,
      0xffff,
    ),
  );

  validateInteger(
    'trainer ID',
    trainer.trainerId,
    0,
    0xffff,
  );
  validateInteger(
    'secret ID',
    trainer.secretId,
    0,
    0xffff,
  );
  validateInteger(
    'money',
    trainer.money,
    0,
    999999,
  );
  validateInteger(
    'gender',
    trainer.gender,
    0,
    1,
  );
  validateInteger(
    'language',
    trainer.language,
    0,
    0xff,
  );
  validateInteger(
    'badges',
    trainer.badges,
    0,
    0xff,
  );
  validateInteger(
    'appearance',
    trainer.appearance,
    0,
    0xff,
  );
  validateInteger(
    'game code',
    trainer.gameCode,
    0,
    0xff,
  );
  validateInteger(
    'coins',
    trainer.coins,
    0,
    9999,
  );
  validateInteger(
    'play-time hours',
    trainer.playTime.hours,
    0,
    999,
  );
  validateInteger(
    'play-time minutes',
    trainer.playTime.minutes,
    0,
    59,
  );
  validateInteger(
    'play-time seconds',
    trainer.playTime.seconds,
    0,
    59,
  );

  if (
    typeof trainer.mainStoryCleared !==
      'boolean' ||
    typeof trainer.hasNationalDex !==
      'boolean'
  ) {
    throw new Error(
      'Invalid Platinum trainer completion flags',
    );
  }

  return writePlatinumSave(
    bytes,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      trainer.nameCodes.forEach(
        (code, index) => {
          view.setUint16(
            0x68 + index * 2,
            code,
            true,
          );
        },
      );

      view.setUint32(
        0x78,
        (
          trainer.trainerId |
          (trainer.secretId << 16)
        ) >>> 0,
        true,
      );

      view.setUint32(
        0x7c,
        trainer.money,
        true,
      );
      view.setUint8(0x80, trainer.gender);
      view.setUint8(0x81, trainer.language);
      view.setUint8(0x82, trainer.badges);
      view.setUint8(0x83, trainer.appearance);
      view.setUint8(0x84, trainer.gameCode);

      const oldFlags = view.getUint8(0x85);
      const completionFlags =
        (oldFlags & ~0x3) |
        (trainer.mainStoryCleared ? 0x1 : 0) |
        (trainer.hasNationalDex ? 0x2 : 0);

      view.setUint8(0x85, completionFlags);
      view.setUint16(
        0x88,
        trainer.coins,
        true,
      );
      view.setUint16(
        0x8a,
        trainer.playTime.hours,
        true,
      );
      view.setUint8(
        0x8c,
        trainer.playTime.minutes,
      );
      view.setUint8(
        0x8d,
        trainer.playTime.seconds,
      );
    },
  );
}

/**
 * Writes the player's carried money while preserving every other
 * byte of the original Platinum save.
 */
export function writePlatinumTrainerMoney(
  bytes: Uint8Array,
  money: number,
): Uint8Array {
  if (
    !Number.isInteger(money) ||
    money < 0 ||
    money > 999999
  ) {
    throw new Error(
      `Invalid Platinum money value ${money}`,
    );
  }

  return writePlatinumSave(
    bytes,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      view.setUint32(0x7c, money, true);
    },
  );
}

export const PLATINUM_FIELD_STATE_OFFSET = 0x1280;

export interface PlatinumLocation {
  mapHeaderId: number;
  warpId: number;
  x: number;
  z: number;
  faceDirection: number;
}

export function readPlatinumPlayerLocation(
  bytes: Uint8Array,
): PlatinumLocation {
  const { general } = selectPlatinumSaveBlocks(bytes);
  const offset =
    general.offset + PLATINUM_FIELD_STATE_OFFSET;

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const location: PlatinumLocation = {
    mapHeaderId: view.getInt32(offset, true),
    warpId: view.getInt32(offset + 4, true),
    x: view.getInt32(offset + 8, true),
    z: view.getInt32(offset + 12, true),
    faceDirection: view.getInt32(offset + 16, true),
  };

  if (location.mapHeaderId < 0) {
    throw new Error(
      `Invalid Platinum map header ${location.mapHeaderId}`,
    );
  }

  if (
    location.faceDirection < 0 ||
    location.faceDirection > 3
  ) {
    throw new Error(
      `Invalid Platinum facing direction ${location.faceDirection}`,
    );
  }

  return location;
}

export function writePlatinumPlayerLocation(
  bytes: Uint8Array,
  location: PlatinumLocation,
): Uint8Array {
  validateInteger(
    'map header',
    location.mapHeaderId,
    0,
    0x7fffffff,
  );
  validateInteger(
    'warp ID',
    location.warpId,
    -0x80000000,
    0x7fffffff,
  );
  validateInteger(
    'x coordinate',
    location.x,
    -0x80000000,
    0x7fffffff,
  );
  validateInteger(
    'z coordinate',
    location.z,
    -0x80000000,
    0x7fffffff,
  );
  validateInteger(
    'facing direction',
    location.faceDirection,
    0,
    3,
  );

  return writePlatinumSave(
    bytes,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      view.setInt32(
        PLATINUM_FIELD_STATE_OFFSET,
        location.mapHeaderId,
        true,
      );
      view.setInt32(
        PLATINUM_FIELD_STATE_OFFSET + 4,
        location.warpId,
        true,
      );
      view.setInt32(
        PLATINUM_FIELD_STATE_OFFSET + 8,
        location.x,
        true,
      );
      view.setInt32(
        PLATINUM_FIELD_STATE_OFFSET + 12,
        location.z,
        true,
      );
      view.setInt32(
        PLATINUM_FIELD_STATE_OFFSET + 16,
        location.faceDirection,
        true,
      );
    },
  );
}

/**
 * SAVE_TABLE_ENTRY_MISC starts at 0x1fc4 in Platinum's selected
 * general block. MiscSaveBlock.rivalName follows 128 padded
 * BerryPatch records and PersistedMapFeatures, placing it at 0x27e8.
 */
export const PLATINUM_MISC_BLOCK_OFFSET = 0x1fc4;
export const PLATINUM_RIVAL_NAME_OFFSET = 0x27e8;
export const PLATINUM_TRAINER_NAME_CODE_COUNT = 8;

export interface PlatinumRivalData {
  nameCodes: number[];
}

export function readPlatinumRivalData(
  bytes: Uint8Array,
): PlatinumRivalData {
  const { general } = selectPlatinumSaveBlocks(bytes);
  const offset =
    general.offset + PLATINUM_RIVAL_NAME_OFFSET;

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const nameCodes = Array.from(
    { length: PLATINUM_TRAINER_NAME_CODE_COUNT },
    (_, index) =>
      view.getUint16(offset + index * 2, true),
  );

  return { nameCodes };
}

export function writePlatinumRivalData(
  bytes: Uint8Array,
  rival: PlatinumRivalData,
): Uint8Array {
  if (
    rival.nameCodes.length !==
    PLATINUM_TRAINER_NAME_CODE_COUNT
  ) {
    throw new Error(
      `Invalid Platinum rival name length ${rival.nameCodes.length}`,
    );
  }

  rival.nameCodes.forEach((code, index) =>
    validateInteger(
      `rival name code ${index}`,
      code,
      0,
      0xffff,
    ),
  );

  return writePlatinumSave(
    bytes,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      rival.nameCodes.forEach(
        (code, index) => {
          view.setUint16(
            PLATINUM_RIVAL_NAME_OFFSET +
              index * 2,
            code,
            true,
          );
        },
      );
    },
  );
}
