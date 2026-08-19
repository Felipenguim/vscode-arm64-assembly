/**
 * Machine-checkable operand forms, in the notation documented in
 * `src/parser/formSpec.ts`.
 *
 * ## The safety rule
 *
 * A mnemonic with **no entry here produces no operand diagnostic**. That is what
 * lets the table grow one group at a time without ever inventing a false
 * positive, and it is why the entries below aim to be *permissive where
 * unsure*: an extra accepted form costs a missed error, a missing one costs a
 * red squiggle on working code. The second is much worse.
 *
 * For the same reason, widening and narrowing SIMD instructions use the
 * non-binding `Vd.*` spec rather than pinning the exact arrangement pair —
 * `saddl v0.8h, v1.8b, v2.8b` is correct, and encoding every legal pair is a
 * lot of surface area for little gain.
 *
 * Forms were sanity-checked against `aarch64-linux-gnu-as` (binutils 2.38).
 */

import { compileForm, type Form } from '../parser/formSpec';

const table = new Map<string, Form[]>();

/** Registers the accepted forms of one mnemonic. */
function sig(mnemonic: string, ...forms: string[]): void {
  table.set(mnemonic, forms.map(compileForm));
}

/** Registers the same forms under several mnemonics. */
function alias(mnemonics: string[], ...forms: string[]): void {
  for (const m of mnemonics) { sig(m, ...forms); }
}

// ─── Data movement ───────────────────────────────────────────────────────────

sig('mov',
  'Rd, Rn',
  'Rd, #imm',
  'Rd|SP, Rn|SP',
  'Vd.T, Vn.T',
  'Vd[], Vn[]',
  'Vd[], Rn',
  'Rd, Vn[]',
  'fd, Vn[]');

alias(['movz', 'movn'], 'Rd, #imm, shift?');
sig('movk', 'Rd, #imm, shift?');
sig('mvn', 'Rd, Rm, shift?', 'Vd.T, Vn.T');

sig('mrs', 'Xd, sysreg');
sig('msr', 'sysreg, Xn', 'pstate, #imm');

// ─── Memory ──────────────────────────────────────────────────────────────────

// `mem` covers every `[...]` form; the optional trailing `#imm` covers
// post-index (`ldr x0, [x1], #8`), which is two operands, not one.
sig('ldr',
  'Rt, mem, #imm?',
  'ft, mem, #imm?',
  'Rt, =sym',
  'ft, =sym',
  'Rt, label',
  'ft, label');

sig('str', 'Rt, mem, #imm?', 'ft, mem, #imm?');

alias(['ldrb', 'ldrh'], 'Wt, mem, #imm?');
alias(['strb', 'strh'], 'Wt, mem, #imm?');
alias(['ldrsb', 'ldrsh'], 'Rt, mem, #imm?');
sig('ldrsw', 'Xt, mem, #imm?', 'Xt, label');

alias(['ldur', 'stur'], 'Rt, mem', 'ft, mem');
alias(['ldurb', 'ldurh', 'sturb', 'sturh'], 'Wt, mem');
alias(['ldursb', 'ldursh'], 'Rt, mem');
sig('ldursw', 'Xt, mem');

alias(['ldp', 'stp', 'ldnp', 'stnp'],
  'Rt1, Rt2, mem, #imm?',
  'ft1, ft2, mem, #imm?');
sig('ldpsw', 'Xt1, Xt2, mem, #imm?');

alias(['ldar', 'ldaxr', 'ldxr'], 'Rt, mem');
alias(['ldarb', 'ldarh', 'ldaxrb', 'ldaxrh', 'ldxrb', 'ldxrh'], 'Wt, mem');
alias(['stlr'], 'Rt, mem');
alias(['stlrb', 'stlrh'], 'Wt, mem');
alias(['stlxr', 'stxr'], 'Ws, Rt, mem');
alias(['stlxrb', 'stlxrh', 'stxrb', 'stxrh'], 'Ws, Wt, mem');
sig('clrex', '#imm?');

alias(['adr', 'adrp'], 'Xd, label', 'Xd, expr');
sig('prfm', 'expr, mem', 'expr, label');

// ─── Arithmetic ──────────────────────────────────────────────────────────────

// The extended-register form takes an unbound `rm`: in `add x0, x1, w2, uxtw #2`
// the extend operator sets the source width, so `w2` beside `x0` is correct.
alias(['add', 'sub', 'adds', 'subs'],
  'Rd|SP, Rn|SP, #imm, shift?',
  'Rd|SP, Rn|SP, Rm, shift?',
  'Rd|SP, Rn|SP, rm, extend',
  'Vd.T, Vn.T, Vm.T',
  'Dd, Dn, Dm');

alias(['cmp', 'cmn'],
  'Rn|SP, #imm, shift?',
  'Rn, Rm, shift?',
  'Rn|SP, rm, extend');

alias(['neg', 'negs'], 'Rd, Rm, shift?', 'Vd.T, Vn.T', 'Dd, Dn');
alias(['adc', 'adcs', 'sbc', 'sbcs'], 'Rd, Rn, Rm');
alias(['ngc', 'ngcs'], 'Rd, Rm');

sig('mul', 'Rd, Rn, Rm', 'Vd.T, Vn.T, Vm.T', 'Vd.T, Vn.T, Vm[]');
sig('mneg', 'Rd, Rn, Rm');
alias(['madd', 'msub'], 'Rd, Rn, Rm, Ra');
alias(['udiv', 'sdiv'], 'Rd, Rn, Rm');
alias(['smulh', 'umulh'], 'Xd, Xn, Xm');
alias(['smull', 'umull', 'smnegl', 'umnegl'], 'Xd, Wn, Wm', 'Vd.*, Vn.*, Vm.*');
alias(['smaddl', 'umaddl', 'smsubl', 'umsubl'], 'Xd, Wn, Wm, Xa');

// ─── Logical ─────────────────────────────────────────────────────────────────

alias(['and', 'orr', 'eor', 'bic', 'orn', 'eon', 'ands', 'bics'],
  'Rd|SP, Rn, #imm',
  'Rd, Rn, Rm, shift?',
  'Vd.T, Vn.T, Vm.T',
  'Vd.T, #imm, shift?');

sig('tst', 'Rn, #imm', 'Rn, Rm, shift?');

// ─── Shifts and bitfields ────────────────────────────────────────────────────

alias(['lsl', 'lsr', 'asr', 'ror'], 'Rd, Rn, #imm', 'Rd, Rn, Rm');
alias(['lslv', 'lsrv', 'asrv', 'rorv'], 'Rd, Rn, Rm');
sig('extr', 'Rd, Rn, Rm, #imm');

alias(['ubfx', 'sbfx', 'ubfiz', 'sbfiz', 'bfi', 'bfxil'], 'Rd, Rn, #imm, #imm');
alias(['bfm', 'sbfm', 'ubfm'], 'Rd, Rn, #imm, #imm');
sig('bfc', 'Rd, #imm, #imm');

alias(['sxtb', 'sxth'], 'Rd, Wn');
sig('sxtw', 'Xd, Wn');
alias(['uxtb', 'uxth'], 'Wd, Wn');

alias(['clz', 'cls'], 'Rd, Rn', 'Vd.T, Vn.T');
sig('rbit', 'Rd, Rn', 'Vd.T, Vn.T');
sig('rev', 'Rd, Rn');
alias(['rev16', 'rev32'], 'Rd, Rn', 'Vd.T, Vn.T');
sig('rev64', 'Vd.T, Vn.T');

// ─── Branches ────────────────────────────────────────────────────────────────

alias(['b', 'bl'], 'label', 'expr');
for (const cc of ['eq', 'ne', 'cs', 'hs', 'cc', 'lo', 'mi', 'pl',
                  'vs', 'vc', 'hi', 'ls', 'ge', 'lt', 'gt', 'le', 'al', 'nv']) {
  sig('b.' + cc, 'label', 'expr');
}
alias(['br', 'blr'], 'Xn');
sig('ret', 'Xn?');
alias(['cbz', 'cbnz'], 'Rt, label', 'Rt, expr');
alias(['tbz', 'tbnz'], 'Rt, #imm, label', 'Rt, #imm, expr');

// ─── Conditional select and compare ──────────────────────────────────────────

alias(['csel', 'csinc', 'csinv', 'csneg'], 'Rd, Rn, Rm, cond');
alias(['cset', 'csetm'], 'Rd, cond');
alias(['cinc', 'cinv', 'cneg'], 'Rd, Rn, cond');
alias(['ccmp', 'ccmn'], 'Rn, Rm, #imm, cond', 'Rn, #imm, #imm, cond');

// ─── System ──────────────────────────────────────────────────────────────────

alias(['svc', 'hvc', 'smc', 'brk', 'hlt'], '#imm');
alias(['nop', 'eret', 'wfi', 'wfe', 'sev', 'sevl', 'yield'], '');
alias(['isb', 'dsb', 'dmb'], 'expr?');
alias(['dc', 'ic', 'at', 'tlbi'], 'expr, Xt?');

// ─── Floating point, scalar ──────────────────────────────────────────────────

sig('fmov',
  'Fd, Fn',
  'Fd, #fpimm',
  'Xd, Dn',
  'Dd, Xn',
  'Wd, Sn',
  'Sd, Wn',
  'Vd.T, #fpimm',
  'Xd, Vn[]',
  'Vd[], Xn');

alias(['fadd', 'fsub', 'fdiv', 'fnmul'], 'Fd, Fn, Fm', 'Vd.T, Vn.T, Vm.T');
alias(['fmul', 'fmulx'], 'Fd, Fn, Fm', 'Vd.T, Vn.T, Vm.T', 'Vd.T, Vn.T, Vm[]', 'Fd, Fn, Vm[]');
alias(['fabs', 'fneg', 'fsqrt'], 'Fd, Fn', 'Vd.T, Vn.T');
alias(['fmadd', 'fmsub', 'fnmadd', 'fnmsub'], 'Fd, Fn, Fm, Fa');
alias(['fmla', 'fmls'], 'Vd.T, Vn.T, Vm.T', 'Vd.T, Vn.T, Vm[]', 'Fd, Fn, Vm[]');
alias(['fcmp', 'fcmpe'], 'Fn, Fm', 'Fn, #fpimm');
sig('fcsel', 'Fd, Fn, Fm, cond');
sig('fccmp', 'Fn, Fm, #imm, cond');
alias(['fmax', 'fmin', 'fmaxnm', 'fminnm', 'fabd', 'frecps', 'frsqrts'],
  'Fd, Fn, Fm', 'Vd.T, Vn.T, Vm.T');
alias(['fmaxv', 'fminv', 'fmaxnmv', 'fminnmv'], 'fd, Vn.*');
alias(['faddp', 'fmaxp', 'fminp'], 'fd, Vn.*', 'Vd.T, Vn.T, Vm.T');
alias(['frecpe', 'frsqrte', 'frecpx'], 'Fd, Fn', 'Vd.T, Vn.T');

// `fcvt` converts *between* sizes, so its operands must not be width-bound.
sig('fcvt', 'fd, fn');
alias(['fcvtl', 'fcvtl2', 'fcvtn', 'fcvtn2', 'fcvtxn', 'fcvtxn2'], 'Vd.*, Vn.*', 'fd, fn');

alias(['scvtf', 'ucvtf'], 'Fd, Rn', 'Fd, Rn, #imm', 'fd, fn', 'Vd.T, Vn.T', 'Vd.T, Vn.T, #imm');
alias(['fcvtzs', 'fcvtzu', 'fcvtas', 'fcvtau', 'fcvtms', 'fcvtmu',
       'fcvtns', 'fcvtnu', 'fcvtps', 'fcvtpu'],
  'Rd, fn', 'Rd, fn, #imm', 'fd, fn', 'Vd.T, Vn.T', 'Vd.T, Vn.T, #imm');
sig('fjcvtzs', 'Wd, Dn');

alias(['frinta', 'frinti', 'frintm', 'frintn', 'frintp', 'frintx', 'frintz',
       'frint32z', 'frint32x', 'frint64z', 'frint64x'],
  'Fd, Fn', 'Vd.T, Vn.T');

// ─── SIMD data movement ──────────────────────────────────────────────────────

alias(['movi', 'mvni'], 'Vd.T, #imm, shift?', 'Dd, #imm', 'Vd.T, #fpimm, shift?');
sig('dup', 'Vd.T, Rn', 'Vd.T, Vn[]', 'fd, Vn[]');
sig('ins', 'Vd[], Rn', 'Vd[], Vn[]');
alias(['umov', 'smov'], 'Rd, Vn[]');
sig('ext', 'Vd.T, Vn.T, Vm.T, #imm');
alias(['tbl', 'tbx'], 'Vd.*, list, Vm.*');
alias(['zip1', 'zip2', 'uzp1', 'uzp2', 'trn1', 'trn2'], 'Vd.T, Vn.T, Vm.T');
sig('not', 'Vd.T, Vn.T');
alias(['bsl', 'bit', 'bif'], 'Vd.T, Vn.T, Vm.T');

// ld1..ld4 / st1..st4 take a register list and an address, with an optional
// post-index that may be an immediate or a register.
for (const m of ['ld1', 'ld2', 'ld3', 'ld4', 'st1', 'st2', 'st3', 'st4',
                 'ld1r', 'ld2r', 'ld3r', 'ld4r']) {
  sig(m, 'list, mem, expr?');
}

// ─── SIMD arithmetic ─────────────────────────────────────────────────────────

sig('abs', 'Vd.T, Vn.T', 'Dd, Dn');
alias(['addp'], 'Vd.T, Vn.T, Vm.T', 'fd, Vn.*');
alias(['addv', 'smaxv', 'sminv', 'umaxv', 'uminv'], 'fd, Vn.*');
alias(['saddlv', 'uaddlv'], 'fd, Vn.*');
alias(['saddlp', 'uaddlp', 'sadalp', 'uadalp'], 'Vd.*, Vn.*');
alias(['smax', 'smin', 'umax', 'umin', 'smaxp', 'sminp', 'umaxp', 'uminp',
       'sabd', 'uabd', 'saba', 'uaba'], 'Vd.T, Vn.T, Vm.T');
alias(['mla', 'mls'], 'Vd.T, Vn.T, Vm.T', 'Vd.T, Vn.T, Vm[]');
alias(['cmeq', 'cmge', 'cmgt', 'cmhi', 'cmhs', 'cmtst'],
  'Vd.T, Vn.T, Vm.T', 'Vd.T, Vn.T, #imm', 'Dd, Dn, Dm', 'Dd, Dn, #imm');
alias(['cmle', 'cmlt'], 'Vd.T, Vn.T, #imm', 'Dd, Dn, #imm');
alias(['fcmeq', 'fcmge', 'fcmgt', 'fcmle', 'fcmlt'],
  'Vd.T, Vn.T, Vm.T', 'Vd.T, Vn.T, #fpimm', 'Fd, Fn, Fm', 'Fd, Fn, #fpimm');
alias(['facge', 'facgt'], 'Vd.T, Vn.T, Vm.T', 'Fd, Fn, Fm');
sig('cnt', 'Vd.T, Vn.T');

// ─── SIMD shifts ─────────────────────────────────────────────────────────────

alias(['shl', 'sshr', 'ushr', 'srshr', 'urshr', 'ssra', 'usra', 'srsra', 'ursra',
       'sli', 'sri'],
  'Vd.T, Vn.T, #imm', 'Dd, Dn, #imm');
alias(['sshll', 'sshll2', 'ushll', 'ushll2'], 'Vd.*, Vn.*, #imm');
alias(['shrn', 'shrn2', 'rshrn', 'rshrn2'], 'Vd.*, Vn.*, #imm');
alias(['sqshrn', 'sqshrn2', 'uqshrn', 'uqshrn2', 'sqshrun', 'sqshrun2'],
  'Vd.*, Vn.*, #imm', 'fd, fn, #imm');
alias(['sshl', 'ushl', 'srshl', 'urshl'], 'Vd.T, Vn.T, Vm.T', 'Dd, Dn, Dm');

// ─── SIMD widening, narrowing and saturating ─────────────────────────────────

alias(['xtn', 'xtn2', 'sqxtn', 'sqxtn2', 'uqxtn', 'uqxtn2', 'sqxtun', 'sqxtun2'],
  'Vd.*, Vn.*', 'fd, fn');
alias(['saddl', 'saddl2', 'uaddl', 'uaddl2', 'ssubl', 'ssubl2', 'usubl', 'usubl2',
       'saddw', 'saddw2', 'uaddw', 'uaddw2', 'ssubw', 'ssubw2', 'usubw', 'usubw2',
       'addhn', 'addhn2', 'subhn', 'subhn2', 'raddhn', 'raddhn2', 'rsubhn', 'rsubhn2',
       'smlal', 'smlal2', 'umlal', 'umlal2', 'smlsl', 'smlsl2', 'umlsl', 'umlsl2',
       'sabal', 'sabal2', 'uabal', 'uabal2', 'sabdl', 'sabdl2', 'uabdl', 'uabdl2',
       'pmull', 'pmull2'],
  'Vd.*, Vn.*, Vm.*', 'Vd.*, Vn.*, Vm[]');
alias(['sqadd', 'uqadd', 'sqsub', 'uqsub', 'suqadd', 'usqadd',
       'sqdmulh', 'sqrdmulh', 'sqshl', 'uqshl', 'sqrshl', 'uqrshl'],
  'Vd.T, Vn.T, Vm.T', 'Vd.T, Vn.T, #imm', 'fd, fn, fm', 'fd, fn, #imm');
sig('pmul', 'Vd.T, Vn.T, Vm.T');
alias(['sqabs', 'sqneg'], 'Vd.T, Vn.T', 'fd, fn');
alias(['urecpe', 'ursqrte'], 'Vd.T, Vn.T');

// ─── Atomics ─────────────────────────────────────────────────────────────────

alias(['cas', 'casa', 'casal', 'casl'], 'Rs, Rt, mem');
alias(['casb', 'casab', 'casalb', 'caslb', 'cash', 'casah', 'casalh', 'caslh'],
  'Ws, Wt, mem');
alias(['swp', 'swpa', 'swpal', 'swpl'], 'Rs, Rt, mem');
alias(['ldadd', 'ldadda', 'ldaddal', 'ldaddl',
       'ldclr', 'ldeor', 'ldset', 'ldsmax', 'ldsmin', 'ldumax', 'ldumin'],
  'Rs, Rt, mem');

// ─── Crypto and CRC ──────────────────────────────────────────────────────────

alias(['aese', 'aesd'], 'Vd.16b, Vn.16b');
alias(['aesmc', 'aesimc'], 'Vd.16b, Vn.16b');
alias(['crc32b', 'crc32h', 'crc32w', 'crc32cb', 'crc32ch', 'crc32cw'], 'Wd, Wn, Wm');
alias(['crc32x', 'crc32cx'], 'Wd, Wn, Xm');

/** Every mnemonic with a checkable operand table. */
export const INSTRUCTION_SIGNATURES: ReadonlyMap<string, readonly Form[]> = table;

/**
 * Frequent mistakes that deserve a better message than "no form matched".
 * The key is `mnemonic` plus the kind of the operand that broke the match.
 */
export const OPERAND_HINTS: ReadonlyMap<string, string> = new Map([
  ['mov:mem',        '`MOV` does not reach memory — use `LDR` to read from an address.'],
  ['mov:ldrLiteral', '`=symbol` is an `LDR` form, not a `MOV` one — use `LDR`.'],
  ['cmp:mem',        '`CMP` does not reach memory — load with `LDR` first, then compare.'],
  ['add:mem',        '`ADD` does not reach memory — load with `LDR` first, then add.'],
  ['sub:mem',        '`SUB` does not reach memory — load with `LDR` first, then subtract.'],
  ['str:xreg',       '`STR` needs a bracketed address, for example `[x1]`.'],
  ['str:wreg',       '`STR` needs a bracketed address, for example `[x1]`.'],
  ['ldr:xreg',       '`LDR` needs a bracketed address (`[x1]`), an `=symbol`, or a label.'],
  ['ldr:wreg',       '`LDR` needs a bracketed address (`[x1]`), an `=symbol`, or a label.'],
]);
