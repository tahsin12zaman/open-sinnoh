import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_MAP_OBJECTS_OFFSET = 0x2858;
export const PLATINUM_MAP_OBJECT_COUNT = 64;
export const PLATINUM_MAP_OBJECT_SIZE = 0x50;

export const PLATINUM_MAP_OBJECT_ACTIVE = 1 << 0;
export const PLATINUM_MAP_OBJECT_PASS_THROUGH =
  1 << 18;

export interface PlatinumMapObject {
  status: number;
  unknown04: number;
  localId: number;
  movementType: number;
  movementRangeX: number;
  movementRangeZ: number;
  initialDirection: number;
  facingDirection: number;
  movingDirection: number;
  mapHeaderId: number;
  graphicsId: number;
  trainerType: number;
  flag: number;
  script: number;
  data: [number, number, number];
  initial: {
    x: number;
    y: number;
    z: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
  worldY: number;
}

export function readPlatinumMapObjects(
  save: Uint8Array,
): PlatinumMapObject[] {
  const { general } = selectPlatinumSaveBlocks(save);
  const base =
    general.offset + PLATINUM_MAP_OBJECTS_OFFSET;

  const end =
    base +
    PLATINUM_MAP_OBJECT_COUNT *
      PLATINUM_MAP_OBJECT_SIZE;

  if (end > save.length) {
    throw new Error(
      'Platinum saved map-object data is truncated',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const objects: PlatinumMapObject[] = [];

  for (
    let index = 0;
    index < PLATINUM_MAP_OBJECT_COUNT;
    index++
  ) {
    const offset =
      base + index * PLATINUM_MAP_OBJECT_SIZE;

    const status = view.getUint32(offset, true);

    if (!(status & PLATINUM_MAP_OBJECT_ACTIVE)) {
      continue;
    }

    const facingDirection = view.getInt8(
      offset + 0x0d,
    );

    if (
      facingDirection < 0 ||
      facingDirection > 3
    ) {
      throw new Error(
        `Invalid Platinum map-object facing direction ${facingDirection} in slot ${index}`,
      );
    }

    objects.push({
      status,
      unknown04: view.getUint32(
        offset + 0x04,
        true,
      ),
      localId: view.getUint8(offset + 0x08),
      movementType: view.getUint8(
        offset + 0x09,
      ),
      movementRangeX: view.getInt8(
        offset + 0x0a,
      ),
      movementRangeZ: view.getInt8(
        offset + 0x0b,
      ),
      initialDirection: view.getInt8(
        offset + 0x0c,
      ),
      facingDirection,
      movingDirection: view.getInt8(
        offset + 0x0e,
      ),
      mapHeaderId: view.getUint16(
        offset + 0x10,
        true,
      ),
      graphicsId: view.getUint16(
        offset + 0x12,
        true,
      ),
      trainerType: view.getUint16(
        offset + 0x14,
        true,
      ),
      flag: view.getUint16(
        offset + 0x16,
        true,
      ),
      script: view.getUint16(
        offset + 0x18,
        true,
      ),
      data: [
        view.getInt16(offset + 0x1a, true),
        view.getInt16(offset + 0x1c, true),
        view.getInt16(offset + 0x1e, true),
      ],
      initial: {
        x: view.getInt16(offset + 0x20, true),
        y: view.getInt16(offset + 0x22, true),
        z: view.getInt16(offset + 0x24, true),
      },
      position: {
        x: view.getInt16(offset + 0x26, true),
        y: view.getInt16(offset + 0x28, true),
        z: view.getInt16(offset + 0x2a, true),
      },
      worldY: view.getInt32(offset + 0x2c, true),
    });
  }

  return objects;
}