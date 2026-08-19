/**
 * Numeric literal parsing for ARM64 / GNU AS operands.
 *
 * Unlike `parseImm()` in `registerTracker.ts`, this one is strict (the whole
 * string must be a literal, with nothing left over) and honours GAS's octal
 * rule: a leading `0` followed by octal digits is base 8, so the `0644` in
 * `examples/SYS/LINUX/SYSCALLS.S` is 420, not 644.
 */

export interface NumericLiteral {
  /** The literal was written with the canonical `#` prefix. */
  hasHash: boolean;
  /** The literal carries a fractional or exponent part. */
  isFloat: boolean;
  /** Integer value, present only when `isFloat` is false. */
  value?: bigint;
  /** Floating-point value, present only when `isFloat` is true. */
  floatValue?: number;
  base: 'hex' | 'binary' | 'octal' | 'decimal' | 'float' | 'char';
}

const HEX_RE     = /^(0[xX])([0-9a-fA-F]+)$/;
const BIN_RE     = /^(0[bB])([01]+)$/;
const OCT_RE     = /^0([0-7]+)$/;
const DEC_RE     = /^([0-9]+)$/;
const FLOAT_RE   = /^(?:[0-9]+\.[0-9]*|\.[0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?$/;
const HASFRAC_RE = /[.eE]/;
const CHAR_RE    = /^'(\\.|[^'])'?$/;

const BACKSLASH = String.fromCharCode(92);

/**
 * Parses `text` as a complete numeric literal.
 * Returns `undefined` when the text is anything else — a symbol, an
 * expression like `msg_end - msg`, a register, and so on.
 */
export function parseNumericLiteral(text: string): NumericLiteral | undefined {
  let s = text.trim();
  if (s.length === 0) { return undefined; }

  const hasHash = s.startsWith('#');
  if (hasHash) { s = s.slice(1).trim(); }

  let negative = false;
  if (s.startsWith('-')) { negative = true; s = s.slice(1).trim(); }
  else if (s.startsWith('+')) { s = s.slice(1).trim(); }

  if (s.length === 0) { return undefined; }

  const chr = CHAR_RE.exec(s);
  if (chr) {
    const raw  = chr[1];
    const code = raw.startsWith(BACKSLASH) ? escapeValue(raw[1]) : raw.charCodeAt(0);
    if (code === undefined) { return undefined; }
    return { hasHash, isFloat: false, value: BigInt(negative ? -code : code), base: 'char' };
  }

  const hex = HEX_RE.exec(s);
  if (hex) { return intResult(hasHash, BigInt('0x' + hex[2]), negative, 'hex'); }

  const bin = BIN_RE.exec(s);
  if (bin) { return intResult(hasHash, BigInt('0b' + bin[2]), negative, 'binary'); }

  // Octal must be checked before decimal: `0644` is 420, not 644.
  const oct = OCT_RE.exec(s);
  if (oct) { return intResult(hasHash, BigInt('0o' + oct[1]), negative, 'octal'); }

  const dec = DEC_RE.exec(s);
  if (dec) { return intResult(hasHash, BigInt(dec[1]), negative, 'decimal'); }

  if (FLOAT_RE.test(s) && HASFRAC_RE.test(s)) {
    const f = parseFloat(s);
    if (Number.isNaN(f)) { return undefined; }
    return { hasHash, isFloat: true, floatValue: negative ? -f : f, base: 'float' };
  }

  return undefined;
}

function intResult(
  hasHash: boolean,
  magnitude: bigint,
  negative: boolean,
  base: NumericLiteral['base']
): NumericLiteral {
  return { hasHash, isFloat: false, value: negative ? -magnitude : magnitude, base };
}

function escapeValue(c: string): number | undefined {
  switch (c) {
    case 'n':  return 10;
    case 't':  return 9;
    case 'r':  return 13;
    case '0':  return 0;
    case 'b':  return 8;
    case 'f':  return 12;
    case 'v':  return 11;
    case 'a':  return 7;
    case "'":  return 39;
    case '"':  return 34;
    default:   return c === BACKSLASH ? 92 : undefined;
  }
}
