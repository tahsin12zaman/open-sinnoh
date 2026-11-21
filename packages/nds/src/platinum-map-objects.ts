import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

export const PLATINUM_MAP_OBJECTS_OFFSET = 0x2858;
export const PLATINUM_MAP_OBJECT_COUNT = 64;
export const PLATINUM_MAP_OBJECT_SIZE = 0x50;
export const PLATINUM_MAP_OBJECT_TAIL_OFFSET = 0x30;
export const PLATINUM_MAP_OBJECT_TAIL_SIZE = 0x20;

export const PLATINUM_MAP_OBJECT_ACTIVE = 1 << 0;
export const PLATINUM_MAP_OBJECT_PASS_THROUGH =
  1 << 18;

export interface PlatinumMapObject {
  /** Native slot, retained by the reader for lossless rewriting. */
  slot?: number;
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
  /** Unmodeled bytes 0x30–0x4f, retained for lossless rewriting. */
  tail?: Uint8Array;
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
      `Invalid Platinum map-object ${name} ${value}`,
    );
  }
}

function validateObject(
  object: PlatinumMapObject,
  index: number,
): void {
  validateInteger(
    `status in object ${index}`,
    object.status,
    0,
    0xffffffff,
  );

  if (
    !(
      object.status &
      PLATINUM_MAP_OBJECT_ACTIVE
    )
  ) {
    throw new Error(
      `Invalid Platinum map-object ${index}: active flag is not set`,
    );
  }

  validateInteger(
    `unknown04 in object ${index}`,
    object.unknown04,
    0,
    0xffffffff,
  );
  validateInteger(
    `local id in object ${index}`,
    object.localId,
    0,
    0xff,
  );
  validateInteger(
    `movement type in object ${index}`,
    object.movementType,
    0,
    0xff,
  );
  validateInteger(
    `movement range X in object ${index}`,
    object.movementRangeX,
    -0x80,
    0x7f,
  );
  validateInteger(
    `movement range Z in object ${index}`,
    object.movementRangeZ,
    -0x80,
    0x7f,
  );
  validateInteger(
    `initial direction in object ${index}`,
    object.initialDirection,
    -0x80,
    0x7f,
  );
  validateInteger(
    `facing direction in object ${index}`,
    object.facingDirection,
    0,
    3,
  );
  validateInteger(
    `moving direction in object ${index}`,
    object.movingDirection,
    -0x80,
    0x7f,
  );
  validateInteger(
    `map header in object ${index}`,
    object.mapHeaderId,
    0,
    0xffff,
  );
  validateInteger(
    `graphics id in object ${index}`,
    object.graphicsId,
    0,
    0xffff,
  );
  validateInteger(
    `trainer type in object ${index}`,
    object.trainerType,
    0,
    0xffff,
  );
  validateInteger(
    `flag in object ${index}`,
    object.flag,
    0,
    0xffff,
  );
  validateInteger(
    `script in object ${index}`,
    object.script,
    0,
    0xffff,
  );

  if (object.data.length !== 3) {
    throw new Error(
      `Invalid Platinum map-object data length ${object.data.length}`,
    );
  }

  object.data.forEach(
    (value, dataIndex) => {
      validateInteger(
        `data ${dataIndex} in object ${index}`,
        value,
        -0x8000,
        0x7fff,
      );
    },
  );

  for (
    const [name, position] of [
      ['initial', object.initial],
      ['position', object.position],
    ] as const
  ) {
    validateInteger(
      `${name} X in object ${index}`,
      position.x,
      -0x8000,
      0x7fff,
    );
    validateInteger(
      `${name} Y in object ${index}`,
      position.y,
      -0x8000,
      0x7fff,
    );
    validateInteger(
      `${name} Z in object ${index}`,
      position.z,
      -0x8000,
      0x7fff,
    );
  }

  validateInteger(
    `world Y in object ${index}`,
    object.worldY,
    -0x80000000,
    0x7fffffff,
  );

  if (
    object.slot !== undefined
  ) {
    validateInteger(
      `slot in object ${index}`,
      object.slot,
      0,
      PLATINUM_MAP_OBJECT_COUNT - 1,
    );
  }

  if (
    object.tail !== undefined &&
    (
      !(object.tail instanceof Uint8Array) ||
      object.tail.length !==
        PLATINUM_MAP_OBJECT_TAIL_SIZE
    )
  ) {
    throw new Error(
      `Invalid Platinum map-object tail size ${object.tail.length}`,
    );
  }
}

export function readPlatinumMapObjects(
  save: Uint8Array,
): PlatinumMapObject[] {
  const { general } =
    selectPlatinumSaveBlocks(save);
  const base =
    general.offset +
    PLATINUM_MAP_OBJECTS_OFFSET;

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
    index <
    PLATINUM_MAP_OBJECT_COUNT;
    index++
  ) {
    const offset =
      base +
      index *
        PLATINUM_MAP_OBJECT_SIZE;

    const status =
      view.getUint32(
        offset,
        true,
      );

    if (
      !(
        status &
        PLATINUM_MAP_OBJECT_ACTIVE
      )
    ) {
      continue;
    }

    const facingDirection =
      view.getInt8(
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
      slot: index,
      status,
      unknown04:
        view.getUint32(
          offset + 0x04,
          true,
        ),
      localId:
        view.getUint8(
          offset + 0x08,
        ),
      movementType:
        view.getUint8(
          offset + 0x09,
        ),
      movementRangeX:
        view.getInt8(
          offset + 0x0a,
        ),
      movementRangeZ:
        view.getInt8(
          offset + 0x0b,
        ),
      initialDirection:
        view.getInt8(
          offset + 0x0c,
        ),
      facingDirection,
      movingDirection:
        view.getInt8(
          offset + 0x0e,
        ),
      mapHeaderId:
        view.getUint16(
          offset + 0x10,
          true,
        ),
      graphicsId:
        view.getUint16(
          offset + 0x12,
          true,
        ),
      trainerType:
        view.getUint16(
          offset + 0x14,
          true,
        ),
      flag: view.getUint16(
        offset + 0x16,
        true,
      ),
      script:
        view.getUint16(
          offset + 0x18,
          true,
        ),
      data: [
        view.getInt16(
          offset + 0x1a,
          true,
        ),
        view.getInt16(
          offset + 0x1c,
          true,
        ),
        view.getInt16(
          offset + 0x1e,
          true,
        ),
      ],
      initial: {
        x: view.getInt16(
          offset + 0x20,
          true,
        ),
        y: view.getInt16(
          offset + 0x22,
          true,
        ),
        z: view.getInt16(
          offset + 0x24,
          true,
        ),
      },
      position: {
        x: view.getInt16(
          offset + 0x26,
          true,
        ),
        y: view.getInt16(
          offset + 0x28,
          true,
        ),
        z: view.getInt16(
          offset + 0x2a,
          true,
        ),
      },
      worldY:
        view.getInt32(
          offset + 0x2c,
          true,
        ),
      tail: save.slice(
        offset +
          PLATINUM_MAP_OBJECT_TAIL_OFFSET,
        offset +
          PLATINUM_MAP_OBJECT_TAIL_OFFSET +
          PLATINUM_MAP_OBJECT_TAIL_SIZE,
      ),
    });
  }

  return objects;
}

function assignSlots(
  objects: PlatinumMapObject[],
): {
  object: PlatinumMapObject;
  slot: number;
}[] {
  if (
    objects.length >
    PLATINUM_MAP_OBJECT_COUNT
  ) {
    throw new Error(
      `Invalid Platinum map-object count ${objects.length}`,
    );
  }

  const used = new Set<number>();

  objects.forEach(
    (object, index) => {
      validateObject(object, index);

      if (object.slot === undefined) {
        return;
      }

      if (used.has(object.slot)) {
        throw new Error(
          `Duplicate Platinum map-object slot ${object.slot}`,
        );
      }

      used.add(object.slot);
    },
  );

  let nextSlot = 0;

  return objects.map(
    (object) => {
      if (object.slot !== undefined) {
        return {
          object,
          slot: object.slot,
        };
      }

      while (used.has(nextSlot)) {
        nextSlot++;
      }

      const slot = nextSlot;
      used.add(slot);
      nextSlot++;

      return {
        object,
        slot,
      };
    },
  );
}

export function writePlatinumMapObjects(
  save: Uint8Array,
  objects: PlatinumMapObject[],
): Uint8Array {
  const assigned =
    assignSlots(objects);

  return writePlatinumSave(
    save,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      for (
        let slot = 0;
        slot <
        PLATINUM_MAP_OBJECT_COUNT;
        slot++
      ) {
        const offset =
          PLATINUM_MAP_OBJECTS_OFFSET +
          slot *
            PLATINUM_MAP_OBJECT_SIZE;

        const status =
          view.getUint32(
            offset,
            true,
          );

        view.setUint32(
          offset,
          (
            status &
            ~PLATINUM_MAP_OBJECT_ACTIVE
          ) >>> 0,
          true,
        );
      }

      assigned.forEach(
        ({ object, slot }) => {
          const offset =
            PLATINUM_MAP_OBJECTS_OFFSET +
            slot *
              PLATINUM_MAP_OBJECT_SIZE;

          view.setUint32(
            offset,
            object.status,
            true,
          );
          view.setUint32(
            offset + 0x04,
            object.unknown04,
            true,
          );
          view.setUint8(
            offset + 0x08,
            object.localId,
          );
          view.setUint8(
            offset + 0x09,
            object.movementType,
          );
          view.setInt8(
            offset + 0x0a,
            object.movementRangeX,
          );
          view.setInt8(
            offset + 0x0b,
            object.movementRangeZ,
          );
          view.setInt8(
            offset + 0x0c,
            object.initialDirection,
          );
          view.setInt8(
            offset + 0x0d,
            object.facingDirection,
          );
          view.setInt8(
            offset + 0x0e,
            object.movingDirection,
          );
          view.setUint16(
            offset + 0x10,
            object.mapHeaderId,
            true,
          );
          view.setUint16(
            offset + 0x12,
            object.graphicsId,
            true,
          );
          view.setUint16(
            offset + 0x14,
            object.trainerType,
            true,
          );
          view.setUint16(
            offset + 0x16,
            object.flag,
            true,
          );
          view.setUint16(
            offset + 0x18,
            object.script,
            true,
          );

          object.data.forEach(
            (value, index) => {
              view.setInt16(
                offset +
                  0x1a +
                  index * 2,
                value,
                true,
              );
            },
          );

          view.setInt16(
            offset + 0x20,
            object.initial.x,
            true,
          );
          view.setInt16(
            offset + 0x22,
            object.initial.y,
            true,
          );
          view.setInt16(
            offset + 0x24,
            object.initial.z,
            true,
          );
          view.setInt16(
            offset + 0x26,
            object.position.x,
            true,
          );
          view.setInt16(
            offset + 0x28,
            object.position.y,
            true,
          );
          view.setInt16(
            offset + 0x2a,
            object.position.z,
            true,
          );
          view.setInt32(
            offset + 0x2c,
            object.worldY,
            true,
          );

          const tailOffset =
            offset +
            PLATINUM_MAP_OBJECT_TAIL_OFFSET;

          if (object.tail) {
            general.set(
              object.tail,
              tailOffset,
            );
          } else {
            general.fill(
              0,
              tailOffset,
              tailOffset +
                PLATINUM_MAP_OBJECT_TAIL_SIZE,
            );
          }
        },
      );
    },
  );
}
