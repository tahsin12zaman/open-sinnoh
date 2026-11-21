import {
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_IMAGE_CLIPS_OFFSET =
  0x4644;
export const PLATINUM_IMAGE_CLIPS_SIZE = 0x834;
export const PLATINUM_IMAGE_CLIPS_ENTRY_SIZE =
  0x83c;

export const PLATINUM_DRESS_UP_PHOTO_COUNT =
  11;
export const PLATINUM_CONTEST_PHOTO_COUNT = 5;

const PHOTO_EMPTY_MAGIC = 0x1234;
const PHOTO_FULL_MAGIC = 0x2345;

const DRESS_UP_PHOTO_SIZE = 0x74;
const DRESS_UP_ACCESSORY_COUNT = 10;

const CONTEST_PHOTO_OFFSET = 0x4fc;
const CONTEST_PHOTO_SIZE = 0x98;
const CONTEST_ACCESSORY_COUNT = 20;

const PHOTO_MON_SIZE = 0x38;
const PHOTO_MON_NICKNAME_CODES = 11;
const PHOTO_MON_TRAINER_NAME_CODES = 8;

const ACCESSORY_SIZE = 4;
const ACCESSORY_COUNT = 100;
const BACKDROP_COUNT = 18;
const WORD_NONE = 0xffff;

export interface PlatinumPhotoPokemon {
  pid: number;
  otId: number;
  species: number;
  nicknameCodes: number[];
  trainerNameCodes: number[];
  priority: number;
  x: number;
  y: number;
  form: number;
  trainerGender: number;
}

export interface PlatinumPhotoAccessory {
  accessory: number;
  x: number;
  y: number;
  priority: number;
}

export interface PlatinumDressUpPhoto {
  mon: PlatinumPhotoPokemon;
  accessories: PlatinumPhotoAccessory[];
  backdrop: number;
  title: number | null;
  language: number;
}

export interface PlatinumContestPhoto {
  mon: PlatinumPhotoPokemon;
  rank: number;
  accessories: PlatinumPhotoAccessory[];
  backdrop: number;
}

export interface PlatinumImageClips {
  dressUpPhotos: (
    | PlatinumDressUpPhoto
    | null
  )[];
  contestPhotos: (
    | PlatinumContestPhoto
    | null
  )[];
}

function photoOccupied(
  view: DataView,
  offset: number,
  kind: string,
  slot: number,
): boolean {
  const integrity = view.getUint32(offset, true);

  if (integrity === PHOTO_EMPTY_MAGIC) {
    return false;
  }

  if (integrity === PHOTO_FULL_MAGIC) {
    return true;
  }

  throw new Error(
    `Invalid Platinum ${kind} photo integrity 0x${integrity
      .toString(16)
      .padStart(8, '0')} in slot ${slot}`,
  );
}

function codeArray(
  view: DataView,
  offset: number,
  length: number,
): number[] {
  return Array.from(
    { length },
    (_, index) =>
      view.getUint16(
        offset + index * 2,
        true,
      ),
  );
}

function decodePhotoPokemon(
  view: DataView,
  offset: number,
  kind: string,
  slot: number,
): PlatinumPhotoPokemon {
  if (PHOTO_MON_SIZE !== 0x38) {
    throw new Error(
      'Unexpected Platinum PhotoPokemon size',
    );
  }

  const trainerGender = view.getUint8(
    offset + 0x34,
  );

  if (trainerGender > 1) {
    throw new Error(
      `Invalid Platinum ${kind} photo trainer gender ${trainerGender} in slot ${slot}`,
    );
  }

  return {
    pid: view.getUint32(offset, true),
    otId: view.getUint32(offset + 4, true),
    species: view.getUint16(
      offset + 8,
      true,
    ),
    nicknameCodes: codeArray(
      view,
      offset + 0x0a,
      PHOTO_MON_NICKNAME_CODES,
    ),
    trainerNameCodes: codeArray(
      view,
      offset + 0x20,
      PHOTO_MON_TRAINER_NAME_CODES,
    ),
    priority: view.getInt8(offset + 0x30),
    x: view.getUint8(offset + 0x31),
    y: view.getUint8(offset + 0x32),
    form: view.getUint8(offset + 0x33),
    trainerGender,
  };
}

function decodeAccessories(
  view: DataView,
  offset: number,
  mask: number,
  count: number,
  kind: string,
  slot: number,
): PlatinumPhotoAccessory[] {
  const validMask =
    count === 20 ? 0x000fffff : 0x000003ff;

  if ((mask & ~validMask) !== 0) {
    throw new Error(
      `Invalid Platinum ${kind} photo accessory mask 0x${mask.toString(16)} in slot ${slot}`,
    );
  }

  const accessories: PlatinumPhotoAccessory[] =
    [];

  for (let index = 0; index < count; index++) {
    if ((mask & (1 << index)) === 0) {
      continue;
    }

    const accessoryOffset =
      offset + index * ACCESSORY_SIZE;

    const accessory = view.getUint8(
      accessoryOffset,
    );

    if (accessory >= ACCESSORY_COUNT) {
      throw new Error(
        `Invalid Platinum ${kind} photo accessory ${accessory} in slot ${slot}, accessory slot ${index}`,
      );
    }

    accessories.push({
      accessory,
      x: view.getUint8(accessoryOffset + 1),
      y: view.getUint8(accessoryOffset + 2),
      priority: view.getInt8(
        accessoryOffset + 3,
      ),
    });
  }

  return accessories;
}

function validateBackdrop(
  backdrop: number,
  kind: string,
  slot: number,
): void {
  if (backdrop >= BACKDROP_COUNT) {
    throw new Error(
      `Invalid Platinum ${kind} photo backdrop ${backdrop} in slot ${slot}`,
    );
  }
}

export function decodePlatinumImageClips(
  bytes: Uint8Array,
): PlatinumImageClips {
  if (
    bytes.byteLength <
    PLATINUM_IMAGE_CLIPS_ENTRY_SIZE
  ) {
    throw new Error(
      `Truncated Platinum ImageClips entry: ${bytes.byteLength} bytes, expected ${PLATINUM_IMAGE_CLIPS_ENTRY_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const dressUpPhotos = Array.from(
    {
      length:
        PLATINUM_DRESS_UP_PHOTO_COUNT,
    },
    (_, slot): PlatinumDressUpPhoto | null => {
      const offset =
        slot * DRESS_UP_PHOTO_SIZE;

      if (
        !photoOccupied(
          view,
          offset,
          'DressUp',
          slot,
        )
      ) {
        return null;
      }

      const backdrop = view.getUint8(
        offset + 0x70,
      );

      validateBackdrop(
        backdrop,
        'DressUp',
        slot,
      );

      const title = view.getUint16(
        offset + 0x44,
        true,
      );

      return {
        mon: decodePhotoPokemon(
          view,
          offset + 4,
          'DressUp',
          slot,
        ),
        accessories: decodeAccessories(
          view,
          offset + 0x48,
          view.getUint32(
            offset + 0x3c,
            true,
          ),
          DRESS_UP_ACCESSORY_COUNT,
          'DressUp',
          slot,
        ),
        backdrop,
        title:
          title === WORD_NONE ? null : title,
        language: view.getUint8(
          offset + 0x71,
        ),
      };
    },
  );

  const contestPhotos = Array.from(
    {
      length:
        PLATINUM_CONTEST_PHOTO_COUNT,
    },
    (_, slot): PlatinumContestPhoto | null => {
      const offset =
        CONTEST_PHOTO_OFFSET +
        slot * CONTEST_PHOTO_SIZE;

      if (
        !photoOccupied(
          view,
          offset,
          'Contest',
          slot,
        )
      ) {
        return null;
      }

      const rank = view.getUint32(
        offset + 4,
        true,
      );

      if (rank > 3) {
        throw new Error(
          `Invalid Platinum Contest photo rank ${rank} in slot ${slot}`,
        );
      }

      const backdrop = view.getUint8(
        offset + 0x94,
      );

      validateBackdrop(
        backdrop,
        'Contest',
        slot,
      );

      return {
        mon: decodePhotoPokemon(
          view,
          offset + 8,
          'Contest',
          slot,
        ),
        rank,
        accessories: decodeAccessories(
          view,
          offset + 0x44,
          view.getUint32(
            offset + 0x40,
            true,
          ),
          CONTEST_ACCESSORY_COUNT,
          'Contest',
          slot,
        ),
        backdrop,
      };
    },
  );

  return {
    dressUpPhotos,
    contestPhotos,
  };
}

export function readPlatinumImageClips(
  bytes: Uint8Array,
): PlatinumImageClips {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_IMAGE_CLIPS_OFFSET;

  return decodePlatinumImageClips(
    bytes.subarray(
      start,
      start +
        PLATINUM_IMAGE_CLIPS_ENTRY_SIZE,
    ),
  );
}
