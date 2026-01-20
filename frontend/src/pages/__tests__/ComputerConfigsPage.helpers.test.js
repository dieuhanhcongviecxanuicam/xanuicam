import { isIPv4, isMAC, isIntegerString, normalizeMac, normalizeIp } from '../ComputerConfigsPage';

describe('ComputerConfigsPage helpers', () => {
  test('isIPv4 accepts valid and rejects invalid', () => {
    expect(isIPv4('192.168.0.1')).toBe(true);
    expect(isIPv4('0.0.0.0')).toBe(true);
    expect(isIPv4('255.255.255.255')).toBe(true);
    expect(isIPv4('256.0.0.1')).toBe(false);
    expect(isIPv4('1.2.3')).toBe(false);
    expect(isIPv4('1.2.3.4.5')).toBe(false);
    expect(isIPv4('01.02.03.04')).toBe(false);
  });

  test('isMAC recognizes common formats', () => {
    expect(isMAC('aa:bb:cc:dd:ee:ff')).toBe(true);
    expect(isMAC('AA-BB-CC-DD-EE-FF')).toBe(true);
    expect(isMAC('aabb.ccdd.eeff')).toBe(true);
    expect(isMAC('invalid-mac')).toBe(false);
  });

  test('isIntegerString validation', () => {
    expect(isIntegerString('123')).toBe(true);
    expect(isIntegerString('0')).toBe(true);
    expect(isIntegerString('')).toBe(true);
    expect(isIntegerString('12a')).toBe(false);
  });

  test('normalizeMac formats correctly', () => {
    expect(normalizeMac('AABBCCDDEEFF')).toBe('aa:bb:cc:dd:ee:ff');
    expect(normalizeMac('aa-bb-cc-dd-ee-ff')).toBe('aa:bb:cc:dd:ee:ff');
    expect(normalizeMac('aa:bb:cc:dd:ee:ff')).toBe('aa:bb:cc:dd:ee:ff');
  });

  test('normalizeIp removes leading zeros and validates', () => {
    expect(normalizeIp('192.168.001.010')).toBe('192.168.1.10');
    expect(normalizeIp('010.000.000.001')).toBe('10.0.0.1');
    expect(normalizeIp('256.1.1.1')).toBe('256.1.1.1'); // invalid remains unchanged
  });
});
