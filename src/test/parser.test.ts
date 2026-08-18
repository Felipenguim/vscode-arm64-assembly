/**
 * Unit tests for the pure analysis core. No extension host involved.
 *
 *   npm test
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { parseLine, parseLines } from '../parser/lineParser';
import { parseNumericLiteral } from '../parser/numbers';
import { analyze } from '../diagnostics/analyze';
import { buildSymbolIndex } from '../diagnostics/symbolIndex';

const BS = String.fromCharCode(92);

function codes(source: string): string[] {
  return analyze(source.split('\n')).map(f => f.code).sort();
}

/** Analyses with the symbol index built from the source itself. */
function findings(source: string) {
  const lines = source.split('\n');
  return analyze(lines, { symbols: buildSymbolIndex([lines]) });
}

function symbolCodes(source: string): string[] {
  return findings(source).map(f => f.code).sort();
}

// ── Tokenizing ────────────────────────────────────────────────────────────────

test('splits operands on top-level commas only', () => {
  const l = parseLine('  ldp x29, x30, [sp], #16');
  assert.equal(l.mnemonic?.text, 'ldp');
  assert.deepEqual(l.operands.map(o => o.text), ['x29', 'x30', '[sp]', '#16']);
  assert.deepEqual(l.missingCommas, []);
});

test('keeps a bracketed address as one operand', () => {
  const l = parseLine('  ldr x0, [x1, x2, lsl #3]');
  assert.deepEqual(l.operands.map(o => o.text), ['x0', '[x1, x2, lsl #3]']);
  assert.equal(l.operands[1].kind, 'mem');
  assert.equal(l.operands[1].memForm, 'baseReg');
});

test('pre-index write-back stays attached to the address', () => {
  const l = parseLine('  str x0, [sp, #-16]!');
  assert.deepEqual(l.operands.map(o => o.text), ['x0', '[sp, #-16]!']);
  assert.equal(l.operands[1].memForm, 'preIndex');
});

test('a shift suffix is a legitimate two-token operand', () => {
  const l = parseLine('  add x0, x1, x2, lsl #3');
  assert.equal(l.operands.length, 4);
  assert.equal(l.operands[3].kind, 'shift');
  assert.deepEqual(l.missingCommas, []);
});

test('parses an instruction with no operands', () => {
  const l = parseLine('  ret');
  assert.equal(l.mnemonic?.text, 'ret');
  assert.equal(l.operands.length, 0);
});

test('label and instruction on the same line', () => {
  const l = parseLine('loop:  mov x0, #1');
  assert.equal(l.label?.name, 'loop');
  assert.equal(l.mnemonic?.text, 'mov');
  assert.deepEqual(l.operands.map(o => o.text), ['x0', '#1']);
});

test('local and numeric labels', () => {
  assert.equal(parseLine('.Lloop:').label?.name, '.Lloop');
  assert.equal(parseLine('1:').label?.name, '1');
});

// ── Comments ──────────────────────────────────────────────────────────────────

test('a comment marker inside a string is not a comment', () => {
  const l = parseLine('  .asciz "http://x, y"');
  assert.equal(l.operands.length, 1);
  assert.equal(l.operands[0].kind, 'string');
  assert.equal(l.comment, undefined);
});

test('block comments span lines', () => {
  const ls = parseLines(['/* start', '   mov x0, #1', '   end */ ret']);
  assert.equal(ls[1].mnemonic, undefined);
  assert.equal(ls[2].mnemonic?.text, 'ret');
});

test('@ is a comment but not in .type foo,@function', () => {
  assert.notEqual(parseLine('  mov x0, #1  @ nota').comment, undefined);
  const l = parseLine('  .type print_string,@function');
  assert.equal(l.comment, undefined);
  assert.equal(l.operands.length, 2);
});

test('cpp lines in .S files are left alone', () => {
  assert.equal(parseLine('#include <foo.h>').isPreprocessor, true);
  assert.deepEqual(codes('#define WIDTH 8'), []);
});

// ── Syntax findings ───────────────────────────────────────────────────────────

test('missing comma between operands', () => {
  assert.deepEqual(codes('  add sp, sp #16'), ['arm64/missing-comma']);
});

test('stray comma after the mnemonic', () => {
  assert.ok(codes('  add, sp, sp, #16').includes('arm64/stray-comma'));
});

test('unbalanced bracket', () => {
  assert.ok(codes('  ldr x0, [x1, #8').includes('arm64/unbalanced-bracket'));
});

test('unterminated string', () => {
  assert.ok(codes('  .asciz "hello').includes('arm64/unterminated-string'));
});

test('empty operand from a doubled comma', () => {
  assert.ok(codes('  add x0,, x1').includes('arm64/empty-operand'));
});

test('constant without # on a real instruction', () => {
  assert.deepEqual(codes('  add sp, sp, 16'), ['arm64/missing-hash']);
});

test('macro arguments are not immediates', () => {
  // `_write` is not an instruction, so its plain numbers must stay quiet.
  assert.deepEqual(codes('  _write 1, msg, 13'), []);
});

test('branch targets are not immediates', () => {
  assert.deepEqual(codes('  b 1f'), []);
});

test('macro parameters never produce findings', () => {
  const src = [
    '.macro _open path, flags',
    '  mov x0, ' + BS + 'path',
    '  mov x1, ' + BS + 'flags',
    '.endm',
  ].join('\n');
  assert.deepEqual(codes(src), []);
});

test('inline suppression', () => {
  assert.deepEqual(codes('  add sp, sp #16   // arm64asm-ignore-line'), []);
  assert.deepEqual(codes('  add sp, sp, 16   // arm64asm-ignore: immediateHash'), []);
  assert.deepEqual(codes('  add sp, sp #16   // arm64asm-ignore: immediateHash'),
    ['arm64/missing-comma']);
});

// ── Numeric literals ──────────────────────────────────────────────────────────

test('octal follows the GAS rule', () => {
  assert.equal(parseNumericLiteral('0644')?.value, 420n);
  assert.equal(parseNumericLiteral('0x1F')?.value, 31n);
  assert.equal(parseNumericLiteral('0b1010')?.value, 10n);
  assert.equal(parseNumericLiteral('#-100')?.value, -100n);
  assert.equal(parseNumericLiteral('#42')?.hasHash, true);
  assert.equal(parseNumericLiteral('42')?.hasHash, false);
});

test('floats are recognised as floats', () => {
  const f = parseNumericLiteral('1.56');
  assert.equal(f?.isFloat, true);
  assert.equal(f?.floatValue, 1.56);
});

test('symbols and expressions are not literals', () => {
  assert.equal(parseNumericLiteral('SYS_write'), undefined);
  assert.equal(parseNumericLiteral('msg_end - msg'), undefined);
});

// ── Operand classification ────────────────────────────────────────────────────

test('register widths', () => {
  const l = parseLine('  add x0, w1, sp');
  assert.deepEqual(l.operands.map(o => o.kind), ['xreg', 'wreg', 'sp']);
  assert.deepEqual(l.operands.map(o => o.width), [64, 32, 64]);
});

test('vector arrangements and lanes', () => {
  const l = parseLine('  ins v10.s[3], w0');
  assert.equal(l.operands[0].kind, 'vlane');
  assert.equal(l.operands[0].arrangement, 's');
  assert.equal(l.operands[0].laneIndex, 3);

  const v = parseLine('  fadd v0.4s, v1.4s, v2.4s');
  assert.deepEqual(v.operands.map(o => o.kind), ['vreg', 'vreg', 'vreg']);
  assert.equal(v.operands[0].arrangement, '4s');
});

test('ldr literal and register list', () => {
  assert.equal(parseLine('  ldr x0, =msg').operands[1].kind, 'ldrLiteral');
  const l = parseLine('  ld1 {v0.16b, v1.16b}, [x0]');
  assert.equal(l.operands[0].kind, 'reglist');
  assert.equal(l.operands.length, 2);
});

// ── Symbols ───────────────────────────────────────────────────────────────────

test('branch to a near-miss label suggests the real one', () => {
  const src = [
    'start:',
    '  b ret_x',
    '.ret_x:',
    '  ret',
  ].join('\n');

  const found = findings(src).filter(f => f.code === 'arm64/unknown-symbol');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /\.ret_x/);
  assert.equal(found[0].fix?.newText, '.ret_x');
});

test('a resolved label is silent', () => {
  assert.deepEqual(symbolCodes('.ret_x:\n  b .ret_x'), []);
});

test('bl to an external function stays quiet even with a near miss', () => {
  // print_uint lives here; print_int is in a sibling object file.
  assert.deepEqual(symbolCodes('print_uint:\n  ret\nmain:\n  bl print_int'), []);
});

test('an undefined local label is reported without a suggestion', () => {
  const found = findings('main:\n  b .nowhere').filter(f => f.code === 'arm64/unknown-symbol');
  assert.equal(found.length, 1);
  assert.equal(found[0].fix, undefined);
});

test('.equ, .global and symbol assignment count as definitions', () => {
  const src = [
    '.equ SYS_write, 64',
    '.global helper',
    'msg: .asciz "hi"',
    'len = . - msg',
    'main:',
    '  mov x8, #SYS_write',
    '  bl helper',
    '  ldr x1, =len',
    '  adr x0, msg',
  ].join('\n');
  assert.deepEqual(symbolCodes(src), []);
});

test('ldr =symbol is checked', () => {
  const found = findings('msg: .asciz "x"\nmain:\n  ldr x0, =msgg')
    .filter(f => f.code === 'arm64/unknown-symbol');
  assert.equal(found.length, 1);
  assert.equal(found[0].fix?.newText, 'msg');
});

test('macro calls are not unknown mnemonics', () => {
  const src = [
    '.macro _exit code',
    '  mov x8, #93',
    '.endm',
    'main:',
    '  _exit 0',
  ].join('\n');
  assert.deepEqual(symbolCodes(src), []);
});

test('symbol assignment is not read as an instruction', () => {
  const l = parseLine('len = . - msg');
  assert.equal(l.isAssignment, true);
  assert.deepEqual(symbolCodes('msg: .asciz "x"\nlen= . -msg'), []);
});
