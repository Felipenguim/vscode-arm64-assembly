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

// ── Directives ────────────────────────────────────────────────────────────────

test('a directive from another assembler is reported with its GAS name', () => {
  const found = findings('.data\nvalue: dq 5').filter(f => f.code === 'arm64/foreign-directive');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /\.quad/);
  assert.equal(found[0].fix?.newText, '.quad');
});

test('resw is reported but not auto-fixed, since .skip would halve the size', () => {
  const found = findings('.bss\nb: resw 8').filter(f => f.code === 'arm64/foreign-directive');
  assert.equal(found.length, 1);
  assert.equal(found[0].fix, undefined);
});

test('an unknown directive suggests the closest real one', () => {
  // `.elif` does not exist in GAS; `.elseif` does.
  const found = findings('.if 1\n.elif 2\n.endif').filter(f => f.code === 'arm64/unknown-directive');
  assert.equal(found.length, 1);
  assert.equal(found[0].fix?.newText, '.elseif');
});

test('a float in an integer directive is an error with the right replacement', () => {
  const q = findings('.data\n.quad 1.56').filter(f => f.code === 'arm64/directive-float-in-int');
  assert.equal(q.length, 1);
  assert.equal(q[0].fix?.newText, '.double');

  const w = findings('.data\n.word 3.14').filter(f => f.code === 'arm64/directive-float-in-int');
  assert.equal(w[0].fix?.newText, '.float');
});

test('an integer in a float directive is fine', () => {
  assert.deepEqual(symbolCodes('.data\n.double 5\n.float 2'), []);
});

test('a value too wide for its field reports the truncation', () => {
  const found = findings('.data\n.byte 300').filter(f => f.code === 'arm64/data-truncated');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /0x2C/);
  // GAS accepts `.byte -200` silently, so we must too.
  assert.deepEqual(symbolCodes('.data\n.byte -200\n.byte 0x7f\n.hword 65535'), []);
});

test('string directives require quotes', () => {
  const found = findings('.data\n.ascii hello').filter(f => f.code === 'arm64/directive-needs-string');
  assert.equal(found.length, 1);
  assert.equal(found[0].fix?.newText, '"hello"');
});

test('data directives accept symbols and expressions untouched', () => {
  const src = 'msg: .asciz "x"\nmsg_end:\n.word msg_end - msg\n.quad msg';
  assert.deepEqual(symbolCodes(src), []);
});

test('%macro reaches the directive rules', () => {
  const found = findings('%macro foo 1').filter(f => f.code === 'arm64/foreign-directive');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /\.macro/);
});

// ── Operand forms ─────────────────────────────────────────────────────────────

function operandCodes(source: string): string[] {
  return analyze(source.split('\n')).map(f => f.code);
}

test('MOV does not reach memory', () => {
  const found = analyze(['mov x3, [x4]']);
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'arm64/invalid-operand');
  assert.match(found[0].message, /does not reach memory/);
});

test('=symbol belongs to LDR, not MOV', () => {
  assert.match(analyze(['mov x0, =msg'])[0].message, /LDR/);
});

test('STR needs an address', () => {
  assert.deepEqual(operandCodes('str x0, x1'), ['arm64/invalid-operand']);
});

test('mixed register widths', () => {
  assert.deepEqual(operandCodes('add x0, w1, x2'), ['arm64/register-width-mismatch']);
  assert.deepEqual(operandCodes('cmp x0, w1'), ['arm64/register-width-mismatch']);
});

test('the extended-register form takes a W source beside an X destination', () => {
  // `add x0, x1, w2, uxtw #2` assembles: the extend operator sets the width.
  assert.deepEqual(operandCodes('add x0, x1, w2, uxtw #2'), []);
  assert.deepEqual(operandCodes('add x3, sp, x3'), []);
});

test('too few operands is reported as a count, not a bad operand', () => {
  const found = analyze(['add x0, x1']);
  assert.equal(found[0].code, 'arm64/operand-count');
  assert.match(found[0].message, /it expects 3/);
});

test('mismatched vector arrangements', () => {
  const found = analyze(['fadd v0.4s, v1.2d, v2.4s']);
  assert.equal(found[0].code, 'arm64/vector-arrangement-mismatch');
  assert.equal(found[0].category, 'vectors');
});

test('lane index out of range', () => {
  const found = analyze(['ins v10.s[9], w0']);
  assert.equal(found[0].code, 'arm64/lane-out-of-range');
  assert.match(found[0].message, /0 to 3/);
  assert.deepEqual(operandCodes('ins v10.s[3], w0'), []);
  assert.deepEqual(operandCodes('umov w0, v5.b[15]'), []);
});

test('an assemble-time constant is a valid immediate', () => {
  // `.equ SYS_READ, 63` then `mov w8, SYS_READ` is ordinary code.
  assert.deepEqual(operandCodes('mov w8, SYS_READ'), []);
  assert.deepEqual(operandCodes('add x1, x1, LOAD_ADDRESS'), []);
});

test('FCVT converts between sizes, so its operands differ on purpose', () => {
  assert.deepEqual(operandCodes('fcvt s0, d1'), []);
  assert.deepEqual(operandCodes('scvtf d0, x1'), []);
});

test('by-element SIMD forms', () => {
  assert.deepEqual(operandCodes('fmul v12.4s, v11.4s, v10.s[1]'), []);
  assert.deepEqual(operandCodes('fmla v0.4s, v1.4s, v2.s[0]'), []);
});

test('post-index and pre-index addressing', () => {
  assert.deepEqual(operandCodes('ldr x0, [x1], #8'), []);
  assert.deepEqual(operandCodes('stp x29, x30, [sp, #-16]!'), []);
  assert.deepEqual(operandCodes('ldp x29, x30, [sp], #16'), []);
});

test('a mnemonic with no signature is never reported', () => {
  // `sha256su0` is a known mnemonic with no entry in the table.
  assert.deepEqual(operandCodes('sha256su0 v0.4s, v1.4s'), []);
});

test('macro parameters disable operand checking on the line', () => {
  const src = ['.macro m a, b', '  add ' + BS + 'a', '.endm'].join('\n');
  assert.deepEqual(codes(src), []);
});
