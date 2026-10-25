import { expect, it } from 'vitest';
import { DisplayLayoutGuard } from '../src/main/display-layout';
const builtIn = { id: 1, bounds: { x: 0, y: 0, width: 1512, height: 982 }, scaleFactor: 2, rotation: 0, workArea: { x: 0, y: 33, width: 1512, height: 949 } };
const external = { id: 2, bounds: { x: -1920, y: -200, width: 1920, height: 1080 }, scaleFactor: 1, rotation: 0 };
it('ignores equivalent snapshots, key ordering, display ordering and fullscreen/Spaces work-area animation', () => {
  const guard = new DisplayLayoutGuard([builtIn, external]);
  for (let index = 0; index < 20; index++) {
    const snapshot = [external, { ...builtIn, workArea: { x: 0, y: index % 2 ? 0 : 33, width: 1512, height: index % 2 ? 982 : 949 } }];
    expect(guard.changed(snapshot)).toBe(false);
  }
});
it('detects actual origin/size/scale/rotation/topology changes once and retains negative-origin layouts', () => {
  const changes = [
    [{ ...builtIn, bounds: { ...builtIn.bounds, x: -1512 } }, external],
    [{ ...builtIn, bounds: { ...builtIn.bounds, width: 1800 } }, external],
    [{ ...builtIn, scaleFactor: 1 }, external],
    [{ ...builtIn, rotation: 90 }, external],
    [builtIn],
    [builtIn, external, { ...external, id: 3 }],
  ];
  for (const displays of changes) {
    const guard = new DisplayLayoutGuard([builtIn, external]);
    expect(guard.changed(displays)).toBe(true); expect(guard.changed(displays)).toBe(false);
  }
});
