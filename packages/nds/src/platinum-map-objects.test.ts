import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_MAP_OBJECT_ACTIVE,
  PLATINUM_MAP_OBJECT_COUNT,
  PLATINUM_MAP_OBJECT_PASS_THROUGH,
  PLATINUM_MAP_OBJECT_SIZE,
  PLATINUM_MAP_OBJECT_TAIL_OFFSET,
  PLATINUM_MAP_OBJECT_TAIL_SIZE,
  PLATINUM_MAP_OBJECTS_OFFSET,
  readPlatinumMapObjects,
  writePlatinumMapObjects,
  type PlatinumMapObject,
} from './platinum-map-objects.ts';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function makeBlock(
  size: number,
  blockId: number,
  saveCounter: number,
  blockCounter: number,
): Uint8Array {
  const bytes = new Uint8Array(size);
  const footerOffset =
    size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(
    bytes.buffer,
  );

  view.setUint32(
    footerOffset,
    saveCounter,
    true,
  );
  view.setUint32(
    footerOffset + 4,
    blockCounter,
    true,
  );
  view.setUint32(
    footerOffset + 8,
    size,
    true,
  );
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(
    footerOffset + 16,
    blockId,
  );
  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(
      bytes,
      0,
      footerOffset,
    ),
    true,
  );

  return bytes;
}

function writeBlock(
  save: Uint8Array,
  copyOffset: number,
  specification: {
    offset: number;
    size: number;
    blockId: number;
  },
  saveCounter: number,
  blockCounter: number,
): void {
  save.set(
    makeBlock(
      specification.size,
      specification.blockId,
      saveCounter,
      blockCounter,
    ),
    copyOffset +
      specification.offset,
  );
}

function makeSave(): Uint8Array {
  const save = new Uint8Array(
    PLATINUM_SAVE_SIZE,
  );
  const [primary, backup] =
    PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(
    save,
    primary,
    PLATINUM_GENERAL_BLOCK,
    110,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    110,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    110,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    110,
    2,
  );

  return save;
}

function makeObject(
  slot: number | undefined,
  localId: number,
  start: number,
): PlatinumMapObject {
  return {
    slot,
    status:
      PLATINUM_MAP_OBJECT_ACTIVE |
      PLATINUM_MAP_OBJECT_PASS_THROUGH,
    unknown04:
      0x12340000 + localId,
    localId,
    movementType: 7,
    movementRangeX: -3,
    movementRangeZ: 4,
    initialDirection: 2,
    facingDirection: 3,
    movingDirection: -1,
    mapHeaderId: 200 + localId,
    graphicsId: 300 + localId,
    trainerType: 4,
    flag: 500 + localId,
    script: 600 + localId,
    data: [
      -100,
      200,
      300,
    ],
    initial: {
      x: -20,
      y: 5,
      z: 30,
    },
    position: {
      x: -19,
      y: 6,
      z: 31,
    },
    worldY: -1234567,
    tail: Uint8Array.from(
      {
        length:
          PLATINUM_MAP_OBJECT_TAIL_SIZE,
      },
      (_, index) =>
        (start + index * 9) & 0xff,
    ),
  };
}

describe('Platinum saved map objects', () => {
  it('round-trips sparse native slots and every modeled field', () => {
    const objects = [
      makeObject(3, 1, 0x10),
      makeObject(61, 2, 0x40),
    ];

    const written =
      writePlatinumMapObjects(
        makeSave(),
        objects,
      );

    expect(
      readPlatinumMapObjects(
        written,
      ),
    ).toEqual(objects);
  });

  it('assigns unspecified objects to free slots', () => {
    const explicit =
      makeObject(3, 1, 0x10);
    const automatic =
      makeObject(
        undefined,
        2,
        0x20,
      );

    const written =
      writePlatinumMapObjects(
        makeSave(),
        [
          explicit,
          automatic,
        ],
      );

    const decoded =
      readPlatinumMapObjects(
        written,
      );

    expect(
      decoded.map(
        (object) => object.slot,
      ),
    ).toEqual([0, 3]);

    expect(
      decoded[0]!.localId,
    ).toBe(2);

    expect(
      decoded[1]!.localId,
    ).toBe(1);
  });

  it('deactivates removed objects while preserving their bytes', () => {
    const marked =
      writePlatinumSave(
        makeSave(),
        ({ general }) => {
          const offset =
            PLATINUM_MAP_OBJECTS_OFFSET +
            10 *
              PLATINUM_MAP_OBJECT_SIZE;

          const view = new DataView(
            general.buffer,
            general.byteOffset,
            general.byteLength,
          );

          view.setUint32(
            offset,
            PLATINUM_MAP_OBJECT_ACTIVE |
              PLATINUM_MAP_OBJECT_PASS_THROUGH,
            true,
          );

          general.fill(
            0x5a,
            offset +
              PLATINUM_MAP_OBJECT_TAIL_OFFSET,
            offset +
              PLATINUM_MAP_OBJECT_TAIL_OFFSET +
              PLATINUM_MAP_OBJECT_TAIL_SIZE,
          );
        },
      );

    const written =
      writePlatinumMapObjects(
        marked,
        [],
      );

    expect(
      readPlatinumMapObjects(
        written,
      ),
    ).toEqual([]);

    const { general } =
      selectPlatinumSaveBlocks(
        written,
      );

    const offset =
      general.offset +
      PLATINUM_MAP_OBJECTS_OFFSET +
      10 *
        PLATINUM_MAP_OBJECT_SIZE;

    const view = new DataView(
      written.buffer,
      written.byteOffset,
      written.byteLength,
    );

    expect(
      view.getUint32(
        offset,
        true,
      ),
    ).toBe(
      PLATINUM_MAP_OBJECT_PASS_THROUGH,
    );

    expect(
      written.slice(
        offset +
          PLATINUM_MAP_OBJECT_TAIL_OFFSET,
        offset +
          PLATINUM_MAP_OBJECT_TAIL_OFFSET +
          PLATINUM_MAP_OBJECT_TAIL_SIZE,
      ),
    ).toEqual(
      new Uint8Array(
        PLATINUM_MAP_OBJECT_TAIL_SIZE,
      ).fill(0x5a),
    );
  });

  it('zeros an unprovided tail for a newly written object', () => {
    const object =
      makeObject(5, 4, 0x10);

    delete object.tail;

    const written =
      writePlatinumMapObjects(
        makeSave(),
        [object],
      );

    const decoded =
      readPlatinumMapObjects(
        written,
      );

    expect(
      decoded[0]!.tail,
    ).toEqual(
      new Uint8Array(
        PLATINUM_MAP_OBJECT_TAIL_SIZE,
      ),
    );
  });

  it('rejects duplicate slots and invalid fields', () => {
    const first =
      makeObject(2, 1, 0x10);
    const second =
      makeObject(2, 2, 0x20);

    expect(() =>
      writePlatinumMapObjects(
        makeSave(),
        [first, second],
      ),
    ).toThrow(/duplicate/i);

    expect(() =>
      writePlatinumMapObjects(
        makeSave(),
        [
          {
            ...first,
            facingDirection: 4,
          },
        ],
      ),
    ).toThrow(/facing direction/i);

    expect(() =>
      writePlatinumMapObjects(
        makeSave(),
        [
          {
            ...first,
            status:
              PLATINUM_MAP_OBJECT_PASS_THROUGH,
          },
        ],
      ),
    ).toThrow(/active flag/i);

    expect(() =>
      writePlatinumMapObjects(
        makeSave(),
        [
          {
            ...first,
            tail:
              new Uint8Array(1),
          },
        ],
      ),
    ).toThrow(/tail size/i);
  });

  it('rejects more than 64 objects', () => {
    expect(() =>
      writePlatinumMapObjects(
        makeSave(),
        Array.from(
          {
            length:
              PLATINUM_MAP_OBJECT_COUNT +
              1,
          },
          (_, index) =>
            makeObject(
              undefined,
              index & 0xff,
              index,
            ),
        ),
      ),
    ).toThrow(/object count/i);
  });

  it.skipIf(!savePath)(
    'reads active objects from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const objects =
        readPlatinumMapObjects(
          save,
        );

      expect(
        objects.length,
      ).toBeLessThanOrEqual(64);

      for (
        const object of objects
      ) {
        expect(
          object.facingDirection,
        ).toBeGreaterThanOrEqual(0);

        expect(
          object.facingDirection,
        ).toBeLessThanOrEqual(3);
      }

      console.log(
        'saved map objects:',
        objects.map(
          (object) => ({
            slot: object.slot,
            mapHeaderId:
              object.mapHeaderId,
            localId:
              object.localId,
            graphicsId:
              object.graphicsId,
            movementType:
              object.movementType,
            initial:
              object.initial,
            position:
              object.position,
            facingDirection:
              object.facingDirection,
            passThrough: Boolean(
              object.status &
                PLATINUM_MAP_OBJECT_PASS_THROUGH,
            ),
            flag: object.flag,
            script:
              object.script,
            data: object.data,
          }),
        ),
      );
    },
  );
});
