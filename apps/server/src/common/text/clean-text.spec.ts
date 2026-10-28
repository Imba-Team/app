import { cleanText, cleanTextDeep } from './clean-text';
import { CleanTextPipe } from './clean-text.pipe';

describe('cleanText', () => {
  it('keeps angle brackets and HTML-looking text verbatim', () => {
    for (const s of ['List<String>', 'a < b && c > d', '<p>paragraph</p>']) {
      expect(cleanText(s)).toBe(s);
    }
  });

  it('removes control characters but keeps tabs and newlines', () => {
    expect(cleanText('a\u0000b\u001Bc\u007Fd\u0085e')).toBe('abcde');
    expect(cleanText('col1\tcol2\nline2')).toBe('col1\tcol2\nline2');
  });

  it('normalises CRLF and CR line endings to LF', () => {
    expect(cleanText('one\r\ntwo\rthree')).toBe('one\ntwo\nthree');
  });

  it('strips bidi override/isolate controls and the BOM', () => {
    // "Trojan Source"-style: RLO makes "txt.exe" render as "exe.txt".
    expect(cleanText('\uFEFFinvoice\u202Etxt.exe\u202C')).toBe(
      'invoicetxt.exe',
    );
    expect(cleanText('a\u2066b\u2069c')).toBe('abc');
  });

  it('keeps legitimate Unicode (RTL text, emoji ZWJ sequences, marks)', () => {
    const samples = [
      'שלום עולם',
      'مرحبا',
      '👩\u200D💻',
      'naïve',
      '\u200Fمرحبا',
    ];
    for (const s of samples) expect(cleanText(s)).toBe(s.normalize('NFC'));
  });

  it('NFC-normalises so composed and decomposed forms compare equal', () => {
    const decomposed = 'cafe\u0301';
    expect(cleanText(decomposed)).toBe('café');
    expect(cleanText(decomposed)).toBe(cleanText('café'));
  });

  it('does not trim (fields decide that themselves)', () => {
    expect(cleanText('  padded  ')).toBe('  padded  ');
  });
});

describe('cleanTextDeep', () => {
  it('cleans nested strings in objects and arrays', () => {
    expect(
      cleanTextDeep({
        term: 'a\u0000b',
        alternateAnswers: ['x\u202Ey', 'ok'],
        nested: { deep: ['\uFEFFz'] },
        count: 3,
        flag: true,
        empty: null,
      }),
    ).toEqual({
      term: 'ab',
      alternateAnswers: ['xy', 'ok'],
      nested: { deep: ['z'] },
      count: 3,
      flag: true,
      empty: null,
    });
  });

  it('leaves password, token and secret values byte-for-byte', () => {
    const raw = 'p\u0000ss\u202Eword\r\n';
    expect(
      cleanTextDeep({
        password: raw,
        newPassword: raw,
        refreshToken: raw,
        clientSecret: raw,
        name: raw,
      }),
    ).toEqual({
      password: raw,
      newPassword: raw,
      refreshToken: raw,
      clientSecret: raw,
      name: 'pssword\n',
    });
  });

  it('returns non-plain objects untouched', () => {
    const buf = Buffer.from('a\u0000b');
    const date = new Date(0);
    const out = cleanTextDeep({ buf, date });
    expect(out.buf).toBe(buf);
    expect(out.date).toBe(date);
  });

  it('does not mutate its input', () => {
    const input = { title: 'a\u0000b' };
    cleanTextDeep(input);
    expect(input.title).toBe('a\u0000b');
  });
});

describe('CleanTextPipe', () => {
  const pipe = new CleanTextPipe();

  it('cleans bodies and query strings', () => {
    expect(pipe.transform({ title: 'a\u0000b' }, { type: 'body' })).toEqual({
      title: 'ab',
    });
    expect(pipe.transform({ q: 'x\u202Ey' }, { type: 'query' })).toEqual({
      q: 'xy',
    });
  });

  it('leaves route params and custom params alone', () => {
    expect(pipe.transform('a\u0000b', { type: 'param' })).toBe('a\u0000b');
    expect(pipe.transform('a\u0000b', { type: 'custom' })).toBe('a\u0000b');
  });
});
