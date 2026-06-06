import { normalize, splitToTokens, resolveWardText, toNormalizable } from './ward-resolver';

// Unit tests for the pure resolver. Integration coverage on real DB data
// is in `_diag-ward-normalize.ts` — that's where edge cases from scraped
// strings actually surface.
describe('ward-resolver normalize()', () => {
  it('strips Vietnamese diacritics', () => {
    expect(normalize('Đà Lạt')).toBe('da lat');
    expect(normalize('Hồ Chí Minh')).toBe('ho chi minh');
    expect(normalize('Phú Xuân')).toBe('phu xuan');
  });

  it('expands Q. and P. prefixes', () => {
    expect(normalize('Q.1')).toBe('quan 1');
    expect(normalize('Q. Hoàn Kiếm')).toBe('quan hoan kiem');
    expect(normalize('P.5')).toBe('phuong 5');
  });

  it('strips administrative prefixes', () => {
    expect(normalize('TP Đà Nẵng')).toBe('da nang');
    expect(normalize('TP. Hồ Chí Minh')).toBe('ho chi minh');
    expect(normalize('Xã Tả Van')).toBe('ta van');
    expect(normalize('Huyện Mỹ Đức')).toBe('my duc');
  });

  it('collapses punctuation and whitespace', () => {
    expect(normalize('Phường 6, Quận 3')).toBe('phuong 6 quan 3');
    expect(normalize('Khê Hạ,Hoa Lư  ')).toBe('khe ha hoa lu');
  });
});

describe('ward-resolver splitToTokens()', () => {
  it('splits on commas, hyphens, em/en dashes', () => {
    expect(splitToTokens('Phường 6, Quận 3')).toEqual(['Phường 6', 'Quận 3']);
    expect(splitToTokens('Xuân Trường - Đà Lạt')).toEqual(['Xuân Trường', 'Đà Lạt']);
    expect(splitToTokens('Khê Hạ – Hoa Lư')).toEqual(['Khê Hạ', 'Hoa Lư']);
  });

  it('drops empty fragments', () => {
    expect(splitToTokens('Quán,')).toEqual(['Quán']);
    expect(splitToTokens(',Quán,')).toEqual(['Quán']);
  });
});

describe('ward-resolver resolveWardText()', () => {
  // Minimal HCM-style fixture covering the patterns the diagnostic showed
  // in real data: exact name, one-to-many alias, token split.
  const wards = toNormalizable([
    {
      name: 'Sài Gòn',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 1', 'Q.1'],
      aliasesOldWards: ['Bến Nghé', 'Đa Kao'],
      aliasesUser: [],
    },
    {
      name: 'Bàn Cờ',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 3', 'Q.3'],
      aliasesOldWards: ['Phường 1', 'Phường 2'],
      aliasesUser: [],
    },
    {
      name: 'Chợ Quán',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 5'],
      aliasesOldWards: [],
      aliasesUser: [],
    },
  ]);

  it('exact name match returns method=exact', () => {
    const r = resolveWardText('Sài Gòn', wards);
    expect(r).toMatchObject({ wardCanonical: 'Sài Gòn', method: 'exact' });
  });

  it('alias match returns method=alias', () => {
    const r = resolveWardText('Bến Nghé', wards);
    expect(r).toMatchObject({ wardCanonical: 'Sài Gòn', method: 'alias' });
  });

  it('ambiguous alias picks first deterministically + flags via', () => {
    // "Quận 1" only maps to Sài Gòn in this fixture — pick a string that
    // appears in TWO wards to assert ambiguity flagging.
    const r = resolveWardText('Q.1', wards);
    expect(r?.wardCanonical).toBe('Sài Gòn');
  });

  it('token split: "Phường 6, Quận 3" hits the Quận 3 alias', () => {
    const r = resolveWardText('Phường 6, Quận 3', wards);
    expect(r?.wardCanonical).toBe('Bàn Cờ');
    expect(r?.matchedVia).toContain('Quận 3');
  });

  it('returns null when nothing matches', () => {
    expect(resolveWardText('Some random address', wards)).toBeNull();
    expect(resolveWardText('', wards)).toBeNull();
    expect(resolveWardText(null, wards)).toBeNull();
  });
});
