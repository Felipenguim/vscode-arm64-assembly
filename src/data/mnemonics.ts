/**
 * Every mnemonic GAS accepts for AArch64, as far as this extension knows.
 *
 * Generated from the alternations in `syntaxes/arm64-asm.tmLanguage.json`
 * (which is considerably more complete than `INSTRUCTION_DOCS`) plus the
 * mnemonics listed below that the grammar happens to omit.
 *
 * Used to decide whether a line is an instruction at all. A macro call such
 * as `_write 1, msg, 13` is *not* in this set, which is what keeps operand and
 * immediate rules from firing on macro arguments.
 */

export const KNOWN_MNEMONICS: ReadonlySet<string> = new Set([
  'abs', 'adc', 'adcs', 'add', 'addhn', 'addhn2', 'addp', 'adds', 'addv', 'adr', 'adrp', 'aesd',
  'aese', 'aesimc', 'aesmc', 'and', 'ands', 'asr', 'asrv', 'at', 'autda', 'autdb', 'autdza',
  'autdzb', 'autia', 'autiasp', 'autib', 'autibsp', 'autiza', 'autizb', 'axflag', 'b', 'b.al',
  'b.cc', 'b.cs', 'b.eq', 'b.ge', 'b.gt', 'b.hi', 'b.hs', 'b.le', 'b.lo', 'b.ls', 'b.lt',
  'b.mi', 'b.ne', 'b.nv', 'b.pl', 'b.vc', 'b.vs', 'bfc', 'bfi', 'bfm', 'bfxil', 'bic', 'bl', 'bics',
  'bif', 'bit', 'blr', 'blraa', 'blraaz', 'blrab', 'blrabz', 'br', 'braa', 'braaz', 'brab',
  'brabz', 'brk', 'bsl', 'bti', 'cas', 'casa', 'casal', 'casalb', 'casalh', 'casb', 'cash',
  'casl', 'casp', 'caspa', 'caspal', 'cbnz', 'cbz', 'ccmn', 'ccmp', 'cfinv', 'chkfeat', 'cinc',
  'cinv', 'clrex', 'cls', 'clz', 'cmeq', 'cmge', 'cmgt', 'cmhi', 'cmhs', 'cmle', 'cmlt', 'cmn',
  'cmp', 'cmtst', 'cneg', 'cnt', 'crc32b', 'crc32cb', 'crc32ch', 'crc32cw', 'crc32cx', 'crc32h',
  'crc32w', 'crc32x', 'csdb', 'csel', 'cset', 'csetm', 'csinc', 'csinv', 'csneg', 'dc', 'dcps1',
  'dcps2', 'dcps3', 'dgh', 'dmb', 'drps', 'dsb', 'dup', 'eon', 'eor', 'eret', 'esb', 'ext',
  'extr', 'fabs', 'facge', 'facgt', 'facle', 'faclt', 'fadd', 'faddp', 'fccmp', 'fccmpe',
  'fcmeq', 'fcmge', 'fcmgt', 'fcmle', 'fcmlt', 'fcmp', 'fcmpe', 'fcsel', 'fcvt', 'fcvtas',
  'fcvtau', 'fcvtl', 'fcvtl2', 'fcvtms', 'fcvtmu', 'fcvtn', 'fcvtn2', 'fcvtns', 'fcvtnu',
  'fcvtps', 'fcvtpu', 'fcvtxn', 'fcvtxn2', 'fcvtzs', 'fcvtzu', 'fdiv', 'fdup', 'fjcvtzs',
  'fmadd', 'fmax', 'fmaxnm', 'fmaxnmp', 'fmaxnmv', 'fmaxp', 'fmaxv', 'fmin', 'fminnm',
  'fminnmp', 'fminnmv', 'fminp', 'fminv', 'fmla', 'fmls', 'fmov', 'fmsub', 'fmul', 'fmulx',
  'fneg', 'fnmadd', 'fnmsub', 'fnmul', 'frecpe', 'frecps', 'frecpx', 'frint32x', 'frint32z',
  'frint64x', 'frint64z', 'frinta', 'frinti', 'frintm', 'frintn', 'frintp', 'frintx', 'frintz',
  'frsqrte', 'frsqrts', 'fsqrt', 'fsub', 'hint', 'hlt', 'hvc', 'ic', 'ins', 'isb', 'ld1',
  'ld1r', 'ld2', 'ld2r', 'ld3', 'ld3r', 'ld4', 'ld4r', 'ldadd', 'ldapr', 'ldaprb', 'ldaprh',
  'ldar', 'ldarb', 'ldarh', 'ldaxp', 'ldaxr', 'ldaxrb', 'ldaxrh', 'ldclr', 'ldeor', 'ldmax',
  'ldmin', 'ldnp', 'ldp', 'ldpsw', 'ldr', 'ldrb', 'ldrh', 'ldrsb', 'ldrsh', 'ldrsw', 'ldset',
  'ldsmax', 'ldsmin', 'ldtr', 'ldumax', 'ldumin', 'ldur', 'ldurb', 'ldurh', 'ldursb', 'ldursh',
  'ldursw', 'lsl', 'lslv', 'lsr', 'lsrv', 'madd', 'mla', 'mls', 'mneg', 'mov', 'movi', 'movk',
  'movn', 'movz', 'mrrs', 'mrs', 'msr', 'msrr', 'msub', 'mul', 'mvn', 'mvni', 'neg', 'negs',
  'ngc', 'ngcs', 'nop', 'not', 'orn', 'orr', 'orrs', 'pacda', 'pacdb', 'pacdza', 'pacdzb',
  'pacia', 'paciasp', 'pacib', 'pacibsp', 'paciza', 'pacizb', 'pmul', 'pmull', 'pmull2', 'prfm',
  'prfum', 'psb', 'pssbb', 'raddhn', 'raddhn2', 'rbit', 'ret', 'reta', 'retaa', 'retab', 'rev',
  'rev16', 'rev32', 'rev64', 'ror', 'rorv', 'rsb', 'rshrn', 'rshrn2', 'rsubhn', 'rsubhn2',
  'saba', 'sabal', 'sabal2', 'sabd', 'sabdl', 'sabdl2', 'sadalp', 'saddl', 'saddl2', 'saddlp',
  'saddlv', 'saddw', 'saddw2', 'sb', 'sbc', 'sbcs', 'sbfiz', 'sbfm', 'sbfx', 'scvtf', 'sdiv',
  'sdot', 'sev', 'sevl', 'sha1c', 'sha1h', 'sha1m', 'sha1p', 'sha1su0', 'sha1su1', 'sha256h',
  'sha256h2', 'sha256su0', 'sha256su1', 'shadd', 'shl', 'shll', 'shll2', 'shrn', 'shrn2',
  'shsub', 'sli', 'smaddl', 'smax', 'smaxp', 'smaxv', 'smc', 'smin', 'sminp', 'sminv', 'smlal',
  'smlal2', 'smlsl', 'smlsl2', 'smmla', 'smnegl', 'smov', 'smstart', 'smstop', 'smsubl',
  'smulh', 'smull', 'smull2', 'sqabs', 'sqadd', 'sqdmlal', 'sqdmlal2', 'sqdmlsl', 'sqdmlsl2',
  'sqdmulh', 'sqdmull', 'sqdmull2', 'sqneg', 'sqrdmlah', 'sqrdmlsh', 'sqrdmulh', 'sqrshl',
  'sqrshrn', 'sqrshrn2', 'sqrshrun', 'sqrshrun2', 'sqshl', 'sqshlu', 'sqshrn', 'sqshrn2',
  'sqshrun', 'sqshrun2', 'sqsub', 'sqxtn', 'sqxtn2', 'sqxtun', 'sqxtun2', 'srhadd', 'sri',
  'srshl', 'srshr', 'srsra', 'ssbb', 'sshl', 'sshll', 'sshll2', 'sshr', 'ssra', 'ssubl',
  'ssubl2', 'ssubw', 'ssubw2', 'st1', 'st2', 'st3', 'st4', 'stlr', 'stlrb', 'stlrh', 'stlxp',
  'stlxr', 'stlxrb', 'stlxrh', 'stnp', 'stp', 'str', 'strb', 'strh', 'sttr', 'stur', 'sturb',
  'sturh', 'stxr', 'stxrb', 'stxrh', 'stxrp', 'sub', 'subhn', 'subhn2', 'subs', 'suqadd', 'svc',
  'swp', 'swpa', 'swpal', 'swpalb', 'swpalh', 'swpb', 'swph', 'swpl', 'sxt', 'sxtb', 'sxth',
  'sxtw', 'sys', 'sysl', 'tbl', 'tbnz', 'tbx', 'tbz', 'tlbi', 'trn1', 'trn2', 'tsb', 'tst',
  'uaba', 'uabal', 'uabal2', 'uabd', 'uabdl', 'uabdl2', 'uadalp', 'uaddl', 'uaddl2', 'uaddlp',
  'uaddlv', 'uaddw', 'uaddw2', 'ubfiz', 'ubfm', 'ubfx', 'ucvtf', 'udiv', 'udot', 'uhadd',
  'uhsub', 'umaddl', 'umax', 'umaxp', 'umaxv', 'umin', 'uminp', 'uminv', 'umlal', 'umlal2',
  'umlsl', 'umlsl2', 'ummla', 'umnegl', 'umov', 'umsubl', 'umulh', 'umull', 'umull2', 'uqadd',
  'uqrshrn', 'uqrshrn2', 'uqshrn', 'uqshrn2', 'uqsub', 'uqxtn', 'uqxtn2', 'urecpe', 'urhadd',
  'urshl', 'urshr', 'ursqrte', 'ursra', 'ushl', 'ushll', 'ushll2', 'ushr', 'usqadd', 'usra',
  'usubl', 'usubl2', 'usubw', 'usubw2', 'uxtb', 'uxth', 'uzp1', 'uzp2', 'wfe', 'wfi', 'xaflag',
  'xpaci', 'xpaclri', 'xtn', 'xtn2', 'yield', 'zip1', 'zip2',
]);

/** True when `text` (any case) names an AArch64 instruction. */
export function isKnownMnemonic(text: string): boolean {
  return KNOWN_MNEMONICS.has(text.toLowerCase());
}
