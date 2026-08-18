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
  'quad', 'xword', 'dword', '8byte', 'octa', 'tbyte',
  'float', 'single', 'double', 'uleb128', 'sleb128', 'inst', 'inst.n', 'inst.w',
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
  'ltorg', 'pool', 'req', 'unreq', 'tlsdesccall', 'dcps1', 'dcps2', 'dcps3',
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
  /** What to write instead. Used verbatim as the quick-fix replacement. */
  gas: string;
  /** Extra context for the message, when the swap is not one-for-one. */
  note?: string;
}

export const FOREIGN_DIRECTIVES: ReadonlyMap<string, ForeignDirective> = new Map([
  // NASM data definition
  ['db',        { gas: '.byte' }],
  ['dw',        { gas: '.hword' }],
  ['dd',        { gas: '.word' }],
  ['dq',        { gas: '.quad' }],
  ['dt',        { gas: '.tbyte' }],
  ['do',        { gas: '.octa' }],
  // NASM reserved space
  ['resb',      { gas: '.skip', note: 'em GAS o tamanho vai como argumento: `.skip N`' }],
  ['resw',      { gas: '.skip', note: 'reserve 2×N bytes: `.skip N*2`' }],
  ['resd',      { gas: '.skip', note: 'reserve 4×N bytes: `.skip N*4`' }],
  ['resq',      { gas: '.skip', note: 'reserve 8×N bytes: `.skip N*8`' }],
  // NASM preprocessor
  ['%macro',    { gas: '.macro' }],
  ['%endmacro', { gas: '.endm' }],
  ['%define',   { gas: '.equ', note: 'GAS usa `.equ NOME, valor`' }],
  ['%include',  { gas: '.include' }],
  ['%if',       { gas: '.if' }],
  ['%endif',    { gas: '.endif' }],
  ['%ifdef',    { gas: '.ifdef' }],
  ['times',     { gas: '.rept', note: 'GAS repete com `.rept N` … `.endr`' }],
  // Missing dot — the most common slip when coming from NASM
  ['section',   { gas: '.section' }],
  ['global',    { gas: '.global' }],
  ['extern',    { gas: '.extern' }],
  ['equ',       { gas: '.equ', note: 'GAS usa `.equ NOME, valor`' }],
  ['org',       { gas: '.org' }],
  ['align',     { gas: '.align' }],
  ['bits',      { gas: '.arch', note: 'AArch64 não tem equivalente a `bits 64`' }],
  // MASM
  ['proc',      { gas: '.type', note: 'GAS marca funções com `.type nome, %function`' }],
  ['endp',      { gas: '.size', note: 'GAS fecha funções com `.size nome, . - nome`' }],
  ['ptr',       { gas: '', note: 'GAS não usa `PTR`; o tamanho vem do registrador (`x`/`w`)' }],
  ['byte',      { gas: '.byte' }],
  ['qword',     { gas: '.quad',  note: 'GAS não usa `QWORD PTR`; o tamanho vem do registrador' }],
  ['dword',     { gas: '.word',  note: 'GAS não usa `DWORD PTR`; o tamanho vem do registrador' }],
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
