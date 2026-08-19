/**
 * GNU AS directive tables.
 *
 * The known-directive list starts from the alternation in
 * `syntaxes/arm64-asm.tmLanguage.json` and fills in the gaps that would
 * otherwise be reported as unknown (`.org`, `.hword`, the `.ifc`/`.ifb`
 * family, `.pushsection`, and so on).
 *
 * Severities were checked against `aarch64-linux-gnu-as` (binutils 2.38):
 * a float in `.quad` is an *error*, while `.byte 300` is only a *warning*
 * about truncation. The tables below record that distinction.
 */

/** Every directive GAS accepts, without the leading dot, lowercase. */
export const KNOWN_DIRECTIVES: ReadonlySet<string> = new Set([
  // Symbol visibility and typing
  'global', 'globl', 'local', 'extern', 'weak', 'hidden', 'protected', 'internal',
  'type', 'size', 'symver', 'variant_pcs',
  // Sections
  'section', 'text', 'data', 'bss', 'rodata', 'pushsection', 'popsection', 'subsection',
  'previous', 'struct',
  // Alignment and space
  'align', 'balign', 'balignw', 'balignl', 'p2align', 'p2alignw', 'p2alignl',
  'skip', 'space', 'zero', 'org', 'fill',
  // Data emission
  'byte', 'hword', 'short', '2byte', 'word', 'long', 'int', '4byte',
  'quad', 'xword', 'dword', '8byte', 'octa',
  'float', 'single', 'double', 'uleb128', 'sleb128', 'inst',
  'ascii', 'asciz', 'string', 'string8', 'string16', 'string32', 'string64', 'incbin',
  // Storage allocation
  'comm', 'lcomm',
  // Macros and repetition
  'macro', 'endm', 'exitm', 'purgem', 'altmacro', 'noaltmacro',
  'rept', 'irp', 'irpc', 'endr',
  // Conditionals
  'if', 'ifdef', 'ifndef', 'ifnotdef', 'else', 'elseif', 'endif',
  'ifc', 'ifnc', 'ifb', 'ifnb', 'ifeq', 'ifne', 'ifgt', 'ifge', 'iflt', 'ifle',
  'ifeqs', 'ifnes',
  // Symbol assignment
  'equ', 'set', 'equiv', 'eqv',
  // Files, listings, diagnostics
  'file', 'ident', 'line', 'loc', 'loc_mark_labels', 'include', 'end', 'abort',
  'error', 'warning', 'print', 'fail', 'nolist', 'list', 'psize', 'title', 'sbttl',
  'eject', 'appline', 'version', 'gnu_attribute', 'attribute',
  // Functions
  'func', 'endfunc',
  // Target selection
  'arch', 'arch_extension', 'cpu', 'fpu', 'code', 'thumb', 'arm', 'syntax',
  'ltorg', 'pool', 'req', 'unreq', 'tlsdesccall',
  // Call-frame information
  'cfi_startproc', 'cfi_endproc', 'cfi_sections', 'cfi_def_cfa', 'cfi_def_cfa_offset',
  'cfi_def_cfa_register', 'cfi_offset', 'cfi_rel_offset', 'cfi_adjust_cfa_offset',
  'cfi_restore', 'cfi_remember_state', 'cfi_restore_state', 'cfi_escape',
  'cfi_signal_frame', 'cfi_undefined', 'cfi_register', 'cfi_window_save',
  'cfi_personality', 'cfi_personality_id', 'cfi_lsda', 'cfi_val_encoded_addr',
  'cfi_return_column', 'cfi_label', 'cfi_val_offset',
  // Exception handling
  'seh_proc', 'seh_endproc', 'seh_endprologue', 'seh_handler', 'seh_handlerdata',
  'seh_pushreg', 'seh_savereg', 'seh_stackalloc', 'seh_setframe', 'seh_endepilogue',
]);

/**
 * Directives from another assembler, with the GAS spelling that replaces them.
 *
 * These are reported as errors: `aarch64-linux-gnu-as` answers `dq 5` with
 * "unknown mnemonic `dq'", and the fix is unambiguous.
 */
export interface ForeignDirective {
  /** What to write instead. */
  gas: string;
  /**
   * True when swapping the name alone produces correct code, so a quick-fix is
   * safe to offer. `resw N` is *not* mechanical: `.skip N` would silently
   * reserve half the bytes.
   */
  mechanical: boolean;
  /** Extra context for the message, when the swap needs more than a rename. */
  note?: string;
}

export const FOREIGN_DIRECTIVES: ReadonlyMap<string, ForeignDirective> = new Map([
  // NASM data definition
  ['db',        { gas: '.byte',  mechanical: true }],
  ['dw',        { gas: '.hword', mechanical: true }],
  ['dd',        { gas: '.word',  mechanical: true }],
  ['dq',        { gas: '.quad',  mechanical: true }],
  ['dt',        { gas: '.octa', mechanical: false, note: 'the x87 80-bit format does not exist on AArch64' }],
  // NASM reserved space
  ['resb',      { gas: '.skip', mechanical: true }],
  ['resw',      { gas: '.skip', mechanical: false, note: 'reserve 2×N bytes: `.skip N*2`' }],
  ['resd',      { gas: '.skip', mechanical: false, note: 'reserve 4×N bytes: `.skip N*4`' }],
  ['resq',      { gas: '.skip', mechanical: false, note: 'reserve 8×N bytes: `.skip N*8`' }],
  // NASM preprocessor
  ['%macro',    { gas: '.macro', mechanical: false, note: 'and close it with `.endm` instead of `%endmacro`' }],
  ['%endmacro', { gas: '.endm',   mechanical: true }],
  ['%define',   { gas: '.equ',    mechanical: false, note: 'GAS spells it `.equ NAME, value`' }],
  ['%include',  { gas: '.include', mechanical: true }],
  ['%if',       { gas: '.if',     mechanical: true }],
  ['%endif',    { gas: '.endif',  mechanical: true }],
  ['%ifdef',    { gas: '.ifdef',  mechanical: true }],
  ['times',     { gas: '.rept',   mechanical: false, note: 'GAS repeats with `.rept N` … `.endr`' }],
  // Missing dot — the most common slip when coming from NASM
  ['section',   { gas: '.section', mechanical: true }],
  ['global',    { gas: '.global',  mechanical: true }],
  ['extern',    { gas: '.extern',  mechanical: true }],
  ['org',       { gas: '.org',     mechanical: true }],
  ['align',     { gas: '.align',   mechanical: true }],
  ['equ',       { gas: '.equ',     mechanical: false, note: 'GAS spells it `.equ NAME, value`' }],
  ['bits',      { gas: '.arch',    mechanical: false, note: 'AArch64 has no equivalent of `bits 64`' }],
  // MASM
  ['proc',      { gas: '.type', mechanical: false, note: 'GAS marks functions with `.type name, %function`' }],
  ['endp',      { gas: '.size', mechanical: false, note: 'GAS closes functions with `.size name, . - name`' }],
  ['qword',     { gas: '.quad', mechanical: false, note: 'GAS has no `QWORD PTR`; the width comes from the register (`x` vs `w`)' }],
  ['dword',     { gas: '.word', mechanical: false, note: 'GAS has no `DWORD PTR`; the width comes from the register (`x` vs `w`)' }],
]);

/** A directive that emits data, and what kind of value it accepts. */
export interface DataDirective {
  /** Width of one element, in bytes. */
  bytes: number;
  /** True when the directive encodes a floating-point value. */
  float: boolean;
}

export const DATA_DIRECTIVES: ReadonlyMap<string, DataDirective> = new Map([
  ['.byte',   { bytes: 1,  float: false }],
  ['.hword',  { bytes: 2,  float: false }],
  ['.short',  { bytes: 2,  float: false }],
  ['.2byte',  { bytes: 2,  float: false }],
  ['.word',   { bytes: 4,  float: false }],
  ['.long',   { bytes: 4,  float: false }],
  ['.int',    { bytes: 4,  float: false }],
  ['.4byte',  { bytes: 4,  float: false }],
  ['.quad',   { bytes: 8,  float: false }],
  ['.xword',  { bytes: 8,  float: false }],
  ['.dword',  { bytes: 8,  float: false }],
  ['.8byte',  { bytes: 8,  float: false }],
  ['.octa',   { bytes: 16, float: false }],
  ['.float',  { bytes: 4,  float: true }],
  ['.single', { bytes: 4,  float: true }],
  ['.double', { bytes: 8,  float: true }],
]);

/** Directives whose argument must be a quoted string. */
export const STRING_DIRECTIVES: ReadonlySet<string> =
  new Set(['.ascii', '.asciz', '.string', '.string8', '.string16', '.incbin']);

/** The integer directive of the same width, used to suggest a fix. */
export function integerDirectiveFor(bytes: number): string | undefined {
  switch (bytes) {
    case 1:  return '.byte';
    case 2:  return '.hword';
    case 4:  return '.word';
    case 8:  return '.quad';
    case 16: return '.octa';
    default: return undefined;
  }
}

/** The float directive that can hold a value of this width. */
export function floatDirectiveFor(bytes: number): string {
  return bytes <= 4 ? '.float' : '.double';
}
