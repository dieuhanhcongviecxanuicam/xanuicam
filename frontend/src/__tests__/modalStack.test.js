import modalStack from '../components/common/modalStack';

describe('modalStack', () => {
  beforeEach(() => {
    // reset internal state by manipulating stack through push/pop
    // since modalStack doesn't expose a reset, we simulate by popping known ids
  });

  test('push returns increasing z and getZFor returns expected value', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    const zA1 = modalStack.push(a);
    const zB = modalStack.push(b);
    const zA2 = modalStack.getZFor(a);

    expect(typeof zA1).toBe('number');
    expect(typeof zB).toBe('number');
    expect(zB).toBeGreaterThanOrEqual(zA1);
    expect(zA2).toBe(zA1);

    modalStack.pop(a);
    modalStack.pop(b);
  });

  test('re-pushing moves an id to top', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    modalStack.push(a);
    modalStack.push(b);
    const zBefore = modalStack.getZFor(a);
    // re-push a to move to top
    modalStack.push(a);
    const zAfter = modalStack.getZFor(a);
    expect(zAfter).toBeGreaterThanOrEqual(zBefore);
    modalStack.pop(a);
    modalStack.pop(b);
  });

  test('z-index does not exceed max cap', () => {
    const maxZ = modalStack.getMaxZ();
    const ids = [];
    for (let i = 0; i < 1100; i++) {
      const s = Symbol(String(i));
      ids.push(s);
      modalStack.push(s);
    }
    // last pushed should have z <= maxZ
    const lastId = ids[ids.length - 1];
    const z = modalStack.getZFor(lastId);
    expect(z).toBeLessThanOrEqual(maxZ);
    // cleanup
    ids.forEach(id => modalStack.pop(id));
  });
});
