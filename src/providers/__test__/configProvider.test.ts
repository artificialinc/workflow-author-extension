import { mergeArtificialConfig } from '../configProvider';

const c = (rawYaml: string) => rawYaml.trim() + '\n';

describe('mergeArtificialConfig', () => {
  const newConfig = { key: 'value' };

  test('should merge blank configs', () => {
    expect(mergeArtificialConfig('')).toBe('artificial: {}\n');
    expect(mergeArtificialConfig('', newConfig)).toBe('artificial:\n  key: value\n');
  });

  test('should throw if base config is not a map', () => {
    expect(() => mergeArtificialConfig('foo')).toThrow();
  });

  test('should insert artificial key if not present', () => {
    expect(mergeArtificialConfig('foo: bar', newConfig)).toBe('foo: bar\nartificial:\n  key: value\n');
  });

  test('should replace blank scalar artificial key', () => {
    const baseConfig = `
foo: bar
# comment before
artificial:
  # comment
`;

    const resultConfig = `
foo: bar
# comment before
artificial:
  # comment
  key: value
`;

    expect(mergeArtificialConfig(baseConfig, newConfig)).toBe(c(resultConfig));
  });

  test('should throw on non-blank scalar artificial key', () => {
    const baseConfig = `
foo: bar
artificial: key
`;

    expect(() => mergeArtificialConfig(baseConfig)).toThrow();
  });

  test('should merge artificial key if present', () => {
    const baseConfig = `
artificial:
  otherKey: otherValue
`;
    const resultConfig = `
artificial:
  otherKey: otherValue
  key: value
`;

    expect(mergeArtificialConfig(baseConfig, newConfig)).toBe(c(resultConfig));
  });

  test('should preserve comments', () => {
    const baseConfig = `
startKey: startValue
# comment
artificial:
  # other comment
  otherKey: otherValue # anotherComment
`;

    const resultConfig = `
startKey: startValue
# comment
artificial:
  # other comment
  otherKey: otherValue # anotherComment
  key: value
`;

    expect(mergeArtificialConfig(baseConfig, newConfig)).toBe(c(resultConfig));
  });

  test('should preserve space before', () => {
    const baseConfig = `
# comment
artificial:

  # other comment
  otherKey: otherValue # anotherComment
`;

    const resultConfig = `
# comment
artificial:

  # other comment
  otherKey: otherValue # anotherComment
  key: value
`;

    expect(mergeArtificialConfig(baseConfig, newConfig)).toBe(c(resultConfig));
  });
});
