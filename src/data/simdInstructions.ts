/**
 * AArch64 floating-point and SIMD/NEON instruction documentation.
 *
 * Kept separate from `instructions.ts` (scalar GPR / branch / system) purely
 * for file size; the two maps are merged into `INSTRUCTION_DOCS` there, so the
 * HoverProvider still has a single lookup point.
 *
 * Entries whose mnemonic also exists as a scalar instruction (`add`, `orr`,
 * `ldr`, …) are written as *continuations* — they are appended after a `---`
 * rule below the scalar documentation, so their headers say "(vector form)".
 *
 * All keys are lowercase.
 */

/**
 * Render one hover entry in the format shared with `instructions.ts`:
 * bold mnemonic, em-dash, title; description; `asm` code fence with the
 * operand forms; optional trailing note.
 */
function entry(
  mnem: string,
  title: string,
  description: string,
  forms: string[],
  note?: string
): string {
  let md = `**${mnem.toUpperCase()}** — ${title}\n\n`;
  md += `${description}\n\n`;
  md += '```asm\n' + forms.join('\n') + '\n```\n';
  if (note) { md += note; }
  return md;
}

function buildSimdInstructionDocs(): Map<string, string> {
  const m = new Map<string, string>();

  /** Shorthand for `m.set(mnem, entry(mnem, …))`. */
  const set = (
    mnem: string,
    title: string,
    description: string,
    forms: string[],
    note?: string
  ): void => {
    m.set(mnem, entry(mnem, title, description, forms, note));
  };

  // ─── Floating-point move ──────────────────────────────────────────────────

  set('fmov', 'Floating-point Move',
    'Move between FP registers, or copy raw bits between a GPR and an FP register, ' +
    'or load a small encodable immediate.',
    [
      'FMOV Sd, Sn            // FP → FP (same size)',
      'FMOV Dd, Dn',
      'FMOV Sd, Wn            // GPR bits → FP register (no conversion)',
      'FMOV Dd, Xn',
      'FMOV Wd, Sn            // FP bits → GPR (no conversion)',
      'FMOV Xd, Dn',
      'FMOV Dd, #1.0          // 8-bit encoded immediate',
      'FMOV Vd.4S, #2.0       // vector: broadcast immediate to every lane',
      'FMOV Xd, Vn.D[1]       // move the high 64 bits of a vector',
    ],
    'The GPR forms are a **bit-pattern copy**, not a conversion — use `SCVTF` / `FCVTZS` to convert values.\n\n' +
    'The immediate is restricted to ±*n*/16 × 2^*r* (e.g. `1.0`, `2.0`, `0.5`, `-3.25`). ' +
    'For arbitrary constants use `LDR Sd, =0x…` or `MOVZ`/`MOVK` into a GPR followed by `FMOV`.');

  set('fcvt', 'Floating-point Convert Precision',
    'Convert a scalar float between half (H), single (S), and double (D) precision.',
    [
      'FCVT Dd, Sn      // single → double (exact)',
      'FCVT Sd, Dn      // double → single (rounds, may overflow)',
      'FCVT Sd, Hn      // half   → single',
      'FCVT Hd, Sn      // single → half',
    ],
    'Rounding uses the mode in `FPCR`. For **vector** precision changes use `FCVTL`/`FCVTN`.');

  set('fcvtl', 'Floating-point Convert to Longer precision (vector)',
    'Widen the **lower** half of a vector: FP16 → FP32, or FP32 → FP64.',
    [
      'FCVTL Vd.4S, Vn.4H     // 4 × FP16 (low 64 bits) → 4 × FP32',
      'FCVTL Vd.2D, Vn.2S     // 2 × FP32 (low 64 bits) → 2 × FP64',
    ],
    'Use `FCVTL2` to widen the **upper** half instead.');

  set('fcvtl2', 'Floating-point Convert to Longer precision, upper half',
    'Same as `FCVTL`, but reads the **upper** 64 bits of the source vector.',
    [
      'FCVTL2 Vd.4S, Vn.8H    // elements 4–7 → 4 × FP32',
      'FCVTL2 Vd.2D, Vn.4S    // elements 2–3 → 2 × FP64',
    ]);

  set('fcvtn', 'Floating-point Convert to Narrower precision (vector)',
    'Narrow a vector into the **lower** half of the destination: FP32 → FP16, or FP64 → FP32.',
    [
      'FCVTN Vd.4H, Vn.4S    // 4 × FP32 → 4 × FP16 in bits [63:0]',
      'FCVTN Vd.2S, Vn.2D    // 2 × FP64 → 2 × FP32 in bits [63:0]',
    ],
    'The upper 64 bits of `Vd` are zeroed. Use `FCVTN2` to fill them instead.');

  set('fcvtn2', 'Floating-point Convert to Narrower precision, upper half',
    'Same as `FCVTN`, but writes into the **upper** 64 bits of the destination, ' +
    'leaving the lower half untouched.',
    [
      'FCVTN2 Vd.8H, Vn.4S',
      'FCVTN2 Vd.4S, Vn.2D',
    ],
    'The usual pattern is `FCVTN` then `FCVTN2` to pack two source vectors into one.');

  // ─── FP ↔ integer conversion (rounding-mode family) ───────────────────────

  const fpToInt: [string, string, string][] = [
    ['fcvtas', 'to Nearest with ties Away from zero', 'signed'],
    ['fcvtau', 'to Nearest with ties Away from zero', 'unsigned'],
    ['fcvtms', 'toward Minus infinity (floor)',       'signed'],
    ['fcvtmu', 'toward Minus infinity (floor)',       'unsigned'],
    ['fcvtns', 'to Nearest, ties to even',            'signed'],
    ['fcvtnu', 'to Nearest, ties to even',            'unsigned'],
    ['fcvtps', 'toward Plus infinity (ceil)',         'signed'],
    ['fcvtpu', 'toward Plus infinity (ceil)',         'unsigned'],
    ['fcvtzs', 'toward Zero (truncate)',              'signed'],
    ['fcvtzu', 'toward Zero (truncate)',              'unsigned'],
  ];

  for (const [mnem, rounding, sign] of fpToInt) {
    const upper   = mnem.toUpperCase();
    const signed  = sign === 'signed';
    const inverse = signed ? 'SCVTF' : 'UCVTF';
    set(mnem, `Floating-point Convert to ${signed ? 'Signed' : 'Unsigned'} integer`,
      `Convert a float to a **${sign}** integer, rounding **${rounding}** ` +
      `(this instruction ignores the \`FPCR\` rounding mode).`,
      [
        `${upper} Wd, Sn          // float  → 32-bit integer`,
        `${upper} Xd, Dn          // double → 64-bit integer`,
        `${upper} Vd.4S, Vn.4S    // vector, lane by lane`,
        `${upper} Wd, Sn, #4      // fixed-point: result scaled by 2^4`,
      ],
      'Out-of-range values **saturate** to the largest/smallest representable integer; ' +
      `NaN converts to 0. Inverse operation: \`${inverse}\`.`);
  }

  set('scvtf', 'Signed integer Convert to Floating-point',
    'Convert a signed integer to a float, rounding with the `FPCR` mode.',
    [
      'SCVTF Sd, Wn          // 32-bit signed int → float',
      'SCVTF Dd, Xn          // 64-bit signed int → double',
      'SCVTF Vd.4S, Vn.4S    // vector, lane by lane',
      'SCVTF Sd, Wn, #4      // fixed-point: divide by 2^4 while converting',
    ],
    'Inverse of `FCVTZS`. Use `UCVTF` for unsigned sources.');

  set('ucvtf', 'Unsigned integer Convert to Floating-point',
    'Convert an unsigned integer to a float, rounding with the `FPCR` mode.',
    [
      'UCVTF Sd, Wn',
      'UCVTF Dd, Xn',
      'UCVTF Vd.2D, Vn.2D',
      'UCVTF Dd, Xn, #8      // fixed-point: divide by 2^8 while converting',
    ],
    'Inverse of `FCVTZU`.');

  // ─── FP arithmetic ────────────────────────────────────────────────────────

  set('fadd', 'Floating-point Add',
    'Add two floats. Works on scalars and, with an arrangement, lane-by-lane on vectors.',
    [
      'FADD Sd, Sn, Sm         // scalar single-precision',
      'FADD Dd, Dn, Dm         // scalar double-precision',
      'FADD Vd.4S, Vn.4S, Vm.4S    // 4 lanes at once',
      'FADD Vd.2D, Vn.2D, Vm.2D',
    ],
    'Does **not** set the condition flags — use `FCMP` for comparisons.');

  set('fsub', 'Floating-point Subtract',
    'Compute `Sn − Sm`, scalar or lane-by-lane.',
    [
      'FSUB Sd, Sn, Sm',
      'FSUB Dd, Dn, Dm',
      'FSUB Vd.4S, Vn.4S, Vm.4S',
    ]);

  set('fmul', 'Floating-point Multiply',
    'Multiply two floats, scalar or lane-by-lane. The by-element form multiplies ' +
    'every lane by one broadcast lane of the second operand.',
    [
      'FMUL Sd, Sn, Sm',
      'FMUL Dd, Dn, Dm',
      'FMUL Vd.4S, Vn.4S, Vm.4S',
      'FMUL Vd.4S, Vn.4S, Vm.S[0]    // by element: all lanes × Vm lane 0',
    ]);

  set('fdiv', 'Floating-point Divide',
    'Compute `Sn ÷ Sm`, scalar or lane-by-lane.',
    [
      'FDIV Sd, Sn, Sm',
      'FDIV Dd, Dn, Dm',
      'FDIV Vd.4S, Vn.4S, Vm.4S',
    ],
    'Division is slow (≈10–20 cycles). For reciprocals in a loop, consider ' +
    '`FRECPE` + `FRECPS` Newton-Raphson refinement.');

  set('fneg', 'Floating-point Negate',
    'Flip the sign bit. Works on `−0.0` and NaN too (it is a pure bit operation).',
    [
      'FNEG Sd, Sn',
      'FNEG Dd, Dn',
      'FNEG Vd.4S, Vn.4S',
    ]);

  set('fabs', 'Floating-point Absolute value',
    'Clear the sign bit.',
    [
      'FABS Sd, Sn',
      'FABS Dd, Dn',
      'FABS Vd.2D, Vn.2D',
    ]);

  set('fsqrt', 'Floating-point Square Root',
    'Exact IEEE square root, correctly rounded.',
    [
      'FSQRT Sd, Sn',
      'FSQRT Dd, Dn',
      'FSQRT Vd.4S, Vn.4S',
    ],
    'Negative inputs produce NaN. `FRSQRTE` gives a fast approximate 1/√x instead.');

  set('fnmul', 'Floating-point Multiply and Negate',
    'Compute `−(Sn × Sm)` in one instruction (scalar only).',
    [
      'FNMUL Sd, Sn, Sm',
      'FNMUL Dd, Dn, Dm',
    ]);

  set('fmadd', 'Floating-point Fused Multiply-Add',
    'Compute `Sa + Sn × Sm` with a **single** rounding at the end (scalar only).',
    [
      'FMADD Sd, Sn, Sm, Sa    // Sd = Sa + Sn × Sm',
      'FMADD Dd, Dn, Dm, Da',
    ],
    'Fused: the product is not rounded before the add, so this is more accurate ' +
    'than separate `FMUL` + `FADD`. Vector equivalent: `FMLA`.');

  set('fmsub', 'Floating-point Fused Multiply-Subtract',
    'Compute `Sa − Sn × Sm` with a single rounding (scalar only).',
    [
      'FMSUB Sd, Sn, Sm, Sa    // Sd = Sa − Sn × Sm',
      'FMSUB Dd, Dn, Dm, Da',
    ],
    'Vector equivalent: `FMLS`.');

  set('fnmadd', 'Floating-point Negated Fused Multiply-Add',
    'Compute `−Sa − Sn × Sm` with a single rounding.',
    [
      'FNMADD Sd, Sn, Sm, Sa',
      'FNMADD Dd, Dn, Dm, Da',
    ]);

  set('fnmsub', 'Floating-point Negated Fused Multiply-Subtract',
    'Compute `−Sa + Sn × Sm` with a single rounding.',
    [
      'FNMSUB Sd, Sn, Sm, Sa',
      'FNMSUB Dd, Dn, Dm, Da',
    ]);

  set('fmla', 'Floating-point Fused Multiply-Add to accumulator (vector)',
    'Accumulate: `Vd += Vn × Vm`, lane by lane, with a single rounding per lane.',
    [
      'FMLA Vd.4S, Vn.4S, Vm.4S',
      'FMLA Vd.2D, Vn.2D, Vm.2D',
      'FMLA Vd.4S, Vn.4S, Vm.S[2]    // by element',
    ],
    '**Reads and writes `Vd`** — it is an accumulator, so initialise it first ' +
    '(e.g. `MOVI Vd.16B, #0`). This is the workhorse of dot products and matrix kernels.');

  set('fmls', 'Floating-point Fused Multiply-Subtract from accumulator (vector)',
    'Accumulate: `Vd −= Vn × Vm`, lane by lane, with a single rounding per lane.',
    [
      'FMLS Vd.4S, Vn.4S, Vm.4S',
      'FMLS Vd.4S, Vn.4S, Vm.S[0]    // by element',
    ],
    'Reads and writes `Vd`.');

  set('fmulx', 'Floating-point Multiply extended',
    'Like `FMUL`, but `0 × ∞` yields `±2.0` instead of NaN.',
    [
      'FMULX Sd, Sn, Sm',
      'FMULX Vd.4S, Vn.4S, Vm.4S',
    ],
    'Exists so that Newton-Raphson reciprocal refinement behaves correctly at the extremes.');

  set('faddp', 'Floating-point Add Pairwise',
    'Add **adjacent pairs** of lanes. The scalar form reduces a whole 2-lane vector.',
    [
      'FADDP Sd, Vn.2S           // scalar: Vn.S[0] + Vn.S[1]',
      'FADDP Dd, Vn.2D           // scalar: Vn.D[0] + Vn.D[1]',
      'FADDP Vd.4S, Vn.4S, Vm.4S // vector: pairwise across both sources',
    ],
    'Chain two `FADDP` to reduce a `.4S` vector to one scalar: ' +
    '`FADDP v0.4s, v0.4s, v0.4s` then `FADDP s0, v0.2s`.');

  // ─── FP min / max ─────────────────────────────────────────────────────────

  set('fmax', 'Floating-point Maximum',
    'Return the larger of two floats. If either input is NaN, the result is NaN.',
    [
      'FMAX Sd, Sn, Sm',
      'FMAX Vd.4S, Vn.4S, Vm.4S',
    ],
    'Use `FMAXNM` if you want NaN inputs to be ignored instead.');

  set('fmin', 'Floating-point Minimum',
    'Return the smaller of two floats. NaN propagates.',
    [
      'FMIN Sd, Sn, Sm',
      'FMIN Vd.4S, Vn.4S, Vm.4S',
    ]);

  set('fmaxnm', 'Floating-point Maximum, Number',
    'Return the larger value, but if exactly one input is NaN the **other** operand ' +
    'is returned (IEEE 754 `maxNum`).',
    [
      'FMAXNM Sd, Sn, Sm',
      'FMAXNM Vd.4S, Vn.4S, Vm.4S',
    ]);

  set('fminnm', 'Floating-point Minimum, Number',
    'Return the smaller value, ignoring a single NaN operand (IEEE 754 `minNum`).',
    [
      'FMINNM Sd, Sn, Sm',
      'FMINNM Vd.4S, Vn.4S, Vm.4S',
    ]);

  set('fmaxv', 'Floating-point Maximum across Vector',
    'Horizontal reduction: the largest lane of the whole vector, as a scalar.',
    [
      'FMAXV Sd, Vn.4S',
    ],
    'Only `.4S` is supported. Companion reductions: `FMINV`, `ADDV`, `SMAXV`.');

  set('fminv', 'Floating-point Minimum across Vector',
    'Horizontal reduction: the smallest lane of the whole vector, as a scalar.',
    [
      'FMINV Sd, Vn.4S',
    ]);

  // ─── FP rounding (frint family) ───────────────────────────────────────────

  const frint: [string, string][] = [
    ['frinta', 'to Nearest, ties **Away** from zero (like C `round()`)'],
    ['frinti', 'using the current `FPCR` rounding mode (**I**nexact signalling)'],
    ['frintm', 'toward **M**inus infinity (like C `floor()`)'],
    ['frintn', 'to **N**earest, ties to even (IEEE default)'],
    ['frintp', 'toward **P**lus infinity (like C `ceil()`)'],
    ['frintx', 'using the current `FPCR` mode, raising Inexact when it rounds (C `rint()`)'],
    ['frintz', 'toward **Z**ero (like C `trunc()`)'],
  ];

  for (const [mnem, mode] of frint) {
    set(mnem, 'Floating-point Round to Integral value',
      `Round a float to an integral **float** value, rounding ${mode}.`,
      [
        `${mnem.toUpperCase()} Sd, Sn`,
        `${mnem.toUpperCase()} Dd, Dn`,
        `${mnem.toUpperCase()} Vd.4S, Vn.4S`,
      ],
      'The result stays in a floating-point register — use `FCVT*` if you need an integer register.');
  }

  set('frecpe', 'Floating-point Reciprocal Estimate',
    'Fast approximation of `1/x` (about 8 bits of accuracy).',
    [
      'FRECPE Sd, Sn',
      'FRECPE Vd.4S, Vn.4S',
    ],
    'Refine with `FRECPS`: each `FMUL`+`FRECPS` step roughly doubles the accurate bits.');

  set('frsqrte', 'Floating-point Reciprocal Square Root Estimate',
    'Fast approximation of `1/√x` (about 8 bits of accuracy).',
    [
      'FRSQRTE Sd, Sn',
      'FRSQRTE Vd.4S, Vn.4S',
    ],
    'Refine with `FRSQRTS`.');

  // ─── FP compare / select ──────────────────────────────────────────────────

  const fcmpFlags =
    'Sets `NZCV`. Because FP comparisons can be **unordered** (NaN), the condition ' +
    'codes differ from integer ones:\n\n' +
    '| Condition | True when |\n| --- | --- |\n' +
    '| `EQ` | equal |\n' +
    '| `NE` | not equal **or unordered** |\n' +
    '| `MI` | less than |\n' +
    '| `GT` | greater than |\n' +
    '| `GE` | greater than or equal |\n' +
    '| `LS` | less than or equal |\n' +
    '| `LT` | less than **or unordered** |\n' +
    '| `LE` | less than, equal, **or unordered** |\n' +
    '| `HI` | greater than **or unordered** |\n' +
    '| `VS` | unordered (at least one NaN) |\n\n' +
    'Note `MI`/`GT`/`GE`/`LS` are the NaN-safe ones: they are false when unordered.';

  set('fcmp', 'Floating-point Compare',
    'Compare two floats and set the condition flags. Nothing is written to a register.',
    [
      'FCMP Sn, Sm       // single-precision',
      'FCMP Dn, Dm       // double-precision',
      'FCMP Sn, #0.0     // compare against zero (only #0.0 is encodable)',
    ],
    fcmpFlags);

  set('fcmpe', 'Floating-point Compare, signalling',
    'Same as `FCMP`, but raises the **Invalid Operation** exception for *quiet* NaNs too, ' +
    'not only signalling ones.',
    [
      'FCMPE Sn, Sm',
      'FCMPE Dn, #0.0',
    ],
    'Use when IEEE trapping behaviour matters; otherwise prefer `FCMP`.');

  set('fccmp', 'Floating-point Conditional Compare',
    'Compare only if a condition holds; otherwise write a literal flag value. ' +
    'Lets you build `&&` / `||` chains without branches.',
    [
      'FCCMP Sn, Sm, #nzcv, cond',
      'FCCMP D0, D1, #0, NE      // if NE: compare D0,D1 — else clear NZCV',
    ],
    'The `#nzcv` immediate is the 4-bit flag value used when `cond` is **false**.');

  set('fcsel', 'Floating-point Conditional Select',
    'Branchless select: `Sd = cond ? Sn : Sm`.',
    [
      'FCSEL Sd, Sn, Sm, cond',
      'FCSEL D0, D1, D2, MI      // D0 = (flags say "less than") ? D1 : D2',
    ],
    'Typically preceded by `FCMP`. FP analogue of `CSEL`.');

  // ─── SIMD compares (result is a lane mask) ────────────────────────────────

  const vecCompares: [string, string, string][] = [
    ['cmeq', 'Equal',                          'integer'],
    ['cmge', 'Greater than or Equal (signed)', 'integer'],
    ['cmgt', 'Greater Than (signed)',          'integer'],
    ['cmhs', 'Higher or Same (unsigned)',      'integer'],
    ['cmhi', 'Higher (unsigned)',              'integer'],
    ['cmle', 'Less than or Equal (signed)',    'integer'],
    ['cmlt', 'Less Than (signed)',             'integer'],
    ['fcmeq', 'Equal',                         'float'],
    ['fcmge', 'Greater than or Equal',         'float'],
    ['fcmgt', 'Greater Than',                  'float'],
    ['fcmle', 'Less than or Equal',            'float'],
    ['fcmlt', 'Less Than',                     'float'],
  ];

  /** `CMLE`/`CMLT` and their FP twins only exist in the compare-against-zero form. */
  const zeroOnly = ['cmle', 'cmlt', 'fcmle', 'fcmlt'];

  for (const [mnem, relation, kind] of vecCompares) {
    const upper = mnem.toUpperCase();
    const zero  = kind === 'float' ? '#0.0' : '#0';
    const forms = [`${upper} Vd.4S, Vn.4S, ${zero}     // compare every lane against zero`];

    if (zeroOnly.includes(mnem)) {
      const swapped = mnem.replace('le', 'ge').replace('lt', 'gt').toUpperCase();
      forms.push(`// no register form — use ${swapped} with the operands swapped`);
    } else {
      forms.unshift(`${upper} Vd.4S, Vn.4S, Vm.4S`);
    }

    set(mnem, `SIMD Compare ${relation}`,
      `Per-lane **${kind}** comparison producing a **mask**: all-ones (\`-1\`) in lanes ` +
      'where the comparison is true, all-zeros where it is false.',
      forms,
      'The all-ones mask is meant to be consumed by `AND`/`BSL`/`BIT` for branchless ' +
      'selection, or collapsed to a single flag with `UMAXV` / `ADDV`.');
  }

  set('cmtst', 'SIMD Compare bitwise Test',
    'Per-lane mask: all-ones where `Vn & Vm != 0` in that lane.',
    [
      'CMTST Vd.4S, Vn.4S, Vm.4S',
      'CMTST Vd.16B, Vn.16B, Vm.16B',
    ],
    'Vector analogue of `TST`.');

  // ─── SIMD data movement ───────────────────────────────────────────────────

  set('movi', 'SIMD Move Immediate',
    'Fill every lane of a vector with an immediate value. The immediate is an ' +
    '8-bit constant, optionally shifted into position.',
    [
      'MOVI Vd.16B, #0x0F                 // every byte = 0x0F',
      'MOVI Vd.8B,  #0xFF                 // lower 64 bits only',
      'MOVI Vd.8H,  #0x12 {, LSL #0|8}    // 16-bit lanes',
      'MOVI Vd.4S,  #0x34 {, LSL #0|8|16|24}',
      'MOVI Vd.4S,  #0x34, MSL #8         // shift in ones instead of zeros',
      'MOVI Vd.2D,  #0xFF00FF00FF00FF00   // each byte must be 0x00 or 0xFF',
      'MOVI Dd,     #0                    // scalar 64-bit form',
    ],
    '`MOVI Vd.16B, #0` is the idiomatic way to zero a whole vector (e.g. before `FMLA`).\n\n' +
    'Arbitrary 32-bit constants are **not** encodable — build them in a GPR and use `DUP`, ' +
    'or load them with `LDR Qd, =…`. Use `MVNI` for the bitwise-inverted immediate.');

  set('mvni', 'SIMD Move Inverted Immediate',
    'Fill every lane with the **bitwise NOT** of an encodable immediate.',
    [
      'MVNI Vd.4S, #0x00              // every lane = 0xFFFFFFFF',
      'MVNI Vd.8H, #0x12 {, LSL #8}',
      'MVNI Vd.4S, #0x34, MSL #16',
    ],
    'Extends the reach of `MOVI` to constants near all-ones.');

  set('dup', 'SIMD Duplicate (broadcast)',
    'Broadcast one value into every lane of a vector — either from a GPR or from ' +
    'a single lane of another vector.',
    [
      'DUP Vd.4S,  Wn        // broadcast a GPR to all 4 lanes',
      'DUP Vd.2D,  Xn',
      'DUP Vd.16B, Wn        // low byte of Wn to all 16 lanes',
      'DUP Vd.4S,  Vn.S[2]   // broadcast lane 2 of Vn',
      'DUP Sd,     Vn.S[1]   // scalar form: extract one lane',
    ],
    'The scalar form (`DUP Sd, Vn.S[1]`) is how you pull a single lane out into an FP register.');

  set('ins', 'SIMD Insert element',
    'Write a single lane, leaving all other lanes of the destination unchanged.',
    [
      'INS Vd.S[0], Wn         // from a GPR',
      'INS Vd.D[1], Xn',
      'INS Vd.S[3], Vn.S[0]    // lane → lane, possibly different indices',
    ],
    '**Read-modify-write** on `Vd`: the untouched lanes keep their old values. ' +
    'The alias `MOV Vd.S[0], Wn` assembles to the same instruction.');

  set('umov', 'SIMD Unsigned Move to general-purpose register',
    'Extract one lane into a GPR, **zero-extended**.',
    [
      'UMOV Wd, Vn.B[3]     // byte → W register, zero-extended',
      'UMOV Wd, Vn.H[1]',
      'UMOV Wd, Vn.S[2]     // 32-bit lane',
      'UMOV Xd, Vn.D[1]     // 64-bit lane',
    ],
    'The alias `MOV Wd, Vn.S[2]` assembles to `UMOV`. Use `SMOV` for sign extension.');

  set('smov', 'SIMD Signed Move to general-purpose register',
    'Extract one lane into a GPR, **sign-extended**.',
    [
      'SMOV Wd, Vn.B[0]     // byte → W register, sign-extended',
      'SMOV Wd, Vn.H[2]',
      'SMOV Xd, Vn.S[1]     // 32-bit lane → X register, sign-extended',
    ],
    'Only the narrowing cases exist (there is nothing to sign-extend for `X ← D`; use `UMOV`).');

  set('ext', 'SIMD Extract from a pair of vectors',
    'Concatenate `Vn:Vm` and extract a window starting at a byte offset — a byte-wise ' +
    'rotate/shift across two registers.',
    [
      'EXT Vd.16B, Vn.16B, Vm.16B, #4    // bytes 4..19 of the Vn:Vm concatenation',
      'EXT Vd.8B,  Vn.8B,  Vm.8B,  #3',
    ],
    'The index is always in **bytes**, regardless of the lane size. ' +
    '`EXT Vd.16B, Vn.16B, Vn.16B, #n` rotates a single vector.');

  set('tbl', 'SIMD Table lookup',
    'Byte-wise gather: each byte of the index vector selects a byte from a table of ' +
    '1–4 consecutive vector registers. Out-of-range indices produce `0`.',
    [
      'TBL Vd.16B, {V0.16B}, Vidx.16B                       // 16-byte table',
      'TBL Vd.16B, {V0.16B, V1.16B}, Vidx.16B               // 32-byte table',
      'TBL Vd.8B,  {V0.16B, V1.16B, V2.16B, V3.16B}, Vidx.8B',
    ],
    'The table registers must be **consecutive** (`v0, v1, v2, v3` — wrapping past `v31`). ' +
    'The general-purpose permute/shuffle primitive. Use `TBX` to keep the old byte instead of zero.');

  set('tbx', 'SIMD Table lookup extension',
    'Like `TBL`, but out-of-range indices leave the destination byte **unchanged** ' +
    'instead of zeroing it.',
    [
      'TBX Vd.16B, {V0.16B}, Vidx.16B',
      'TBX Vd.16B, {V0.16B, V1.16B}, Vidx.16B',
    ],
    'Lets you chain lookups across tables larger than 64 bytes.');

  const permutes: [string, string, string][] = [
    ['zip1', 'Zip (lower halves)',  'Interleave the **lower** halves of the two sources: `n0, m0, n1, m1, …`'],
    ['zip2', 'Zip (upper halves)',  'Interleave the **upper** halves of the two sources'],
    ['uzp1', 'Unzip (even lanes)',  'Collect the **even**-numbered lanes of both sources (de-interleave)'],
    ['uzp2', 'Unzip (odd lanes)',   'Collect the **odd**-numbered lanes of both sources'],
    ['trn1', 'Transpose (even)',    'Take even lanes from `Vn` and odd-position slots from `Vm` — one half of a matrix transpose'],
    ['trn2', 'Transpose (odd)',     'The complementary half of `TRN1`'],
  ];

  for (const [mnem, title, description] of permutes) {
    set(mnem, `SIMD ${title}`, `${description}.`,
      [
        `${mnem.toUpperCase()} Vd.4S, Vn.4S, Vm.4S`,
        `${mnem.toUpperCase()} Vd.16B, Vn.16B, Vm.16B`,
      ],
      '`ZIP1`/`ZIP2` interleave, `UZP1`/`UZP2` de-interleave, `TRN1`/`TRN2` transpose. ' +
      'A pair of them covers the whole 128-bit result.');
  }

  const revs: [string, string][] = [
    ['rev16', '16-bit'],
    ['rev32', '32-bit'],
    ['rev64', '64-bit'],
  ];

  for (const [mnem, container] of revs) {
    set(mnem, `SIMD Reverse elements in ${container} containers`,
      `Reverse the order of the elements inside each **${container}** chunk of the vector. ` +
      `Useful for endianness swaps and lane reversal.`,
      [
        `${mnem.toUpperCase()} Vd.16B, Vn.16B`,
        `${mnem.toUpperCase()} Vd.8H, Vn.8H`,
      ],
      'The element size comes from the arrangement; the container size comes from the mnemonic. ' +
      '`REV64 Vd.4S, Vn.4S` swaps the two 32-bit lanes inside each 64-bit half.');
  }

  // ─── SIMD integer arithmetic ──────────────────────────────────────────────

  set('mla', 'SIMD Multiply-Accumulate',
    'Integer accumulate: `Vd += Vn × Vm`, lane by lane.',
    [
      'MLA Vd.4S, Vn.4S, Vm.4S',
      'MLA Vd.8H, Vn.8H, Vm.H[0]    // by element',
    ],
    'Reads and writes `Vd`. Products are truncated to the lane width (no widening) — ' +
    'use `SMLAL`/`UMLAL` if you need the full-width product.');

  set('mls', 'SIMD Multiply-Subtract',
    'Integer accumulate: `Vd −= Vn × Vm`, lane by lane.',
    [
      'MLS Vd.4S, Vn.4S, Vm.4S',
      'MLS Vd.8H, Vn.8H, Vm.H[3]    // by element',
    ],
    'Reads and writes `Vd`.');

  set('abs', 'Absolute value',
    'Per-lane (or scalar) absolute value of a **signed** integer.',
    [
      'ABS Vd.4S, Vn.4S',
      'ABS Vd.16B, Vn.16B',
      'ABS Dd, Dn            // scalar 64-bit',
    ],
    'The most-negative value maps to itself (it has no positive counterpart). ' +
    'Use `SQABS` for saturating behaviour, or `FABS` for floats.');

  set('addp', 'SIMD Add Pairwise',
    'Add **adjacent pairs** of lanes drawn from the two sources.',
    [
      'ADDP Vd.4S, Vn.4S, Vm.4S    // [n0+n1, n2+n3, m0+m1, m2+m3]',
      'ADDP Dd, Vn.2D              // scalar: Vn.D[0] + Vn.D[1]',
    ],
    'Chaining `ADDP` halves the lane count each time — a log-step horizontal sum. ' +
    '`ADDV` does the whole reduction in one instruction.');

  set('addv', 'SIMD Add across Vector',
    'Horizontal reduction: sum of **all** lanes, written to a scalar register.',
    [
      'ADDV Sd, Vn.4S',
      'ADDV Bd, Vn.16B',
      'ADDV Hd, Vn.8H',
    ],
    'The result keeps the lane width, so it can **wrap around**. ' +
    'Use `SADDLV`/`UADDLV` to accumulate into a wider element instead. Not available for `.2D`.');

  set('saddlv', 'SIMD Signed Add Long across Vector',
    'Horizontal sum of all lanes, accumulated into an element **twice as wide** — ' +
    'so it cannot overflow.',
    [
      'SADDLV Hd, Vn.16B    // 16 signed bytes → one 16-bit sum',
      'SADDLV Sd, Vn.8H',
      'SADDLV Dd, Vn.4S',
    ],
    'Signed version. Use `UADDLV` for unsigned lanes.');

  set('uaddlv', 'SIMD Unsigned Add Long across Vector',
    'Horizontal sum of all lanes into a double-width element (unsigned).',
    [
      'UADDLV Hd, Vn.16B',
      'UADDLV Sd, Vn.8H',
      'UADDLV Dd, Vn.4S',
    ],
    'The usual way to count set bytes after a `CMEQ` mask + `CNT`.');

  const longArith: [string, string, string][] = [
    ['saddl',  'Signed Add Long',        'Add the **lower** halves of two vectors, widening each result to double the lane size'],
    ['saddl2', 'Signed Add Long (upper)', 'Same as `SADDL`, but reads the **upper** halves'],
    ['uaddl',  'Unsigned Add Long',      'Unsigned version of `SADDL`'],
    ['uaddl2', 'Unsigned Add Long (upper)', 'Unsigned version of `SADDL2`'],
    ['smull',  'Signed Multiply Long',   'Multiply the **lower** halves, keeping the full double-width product'],
    ['smull2', 'Signed Multiply Long (upper)', 'Same as `SMULL`, but reads the **upper** halves'],
    ['umull',  'Unsigned Multiply Long', 'Unsigned version of `SMULL`'],
    ['umull2', 'Unsigned Multiply Long (upper)', 'Unsigned version of `SMULL2`'],
  ];

  for (const [mnem, title, description] of longArith) {
    const upper = mnem.toUpperCase();
    const src   = mnem.endsWith('2') ? '8H' : '4H';
    set(mnem, `SIMD ${title}`,
      `${description}. This is how you avoid overflow when combining narrow lanes.`,
      [
        `${upper} Vd.4S, Vn.${src}, Vm.${src}`,
        `${upper} Vd.8H, Vn.${mnem.endsWith('2') ? '16B' : '8B'}, Vm.${mnem.endsWith('2') ? '16B' : '8B'}`,
      ],
      'The destination arrangement always has **half the lanes at double the width** of the source. ' +
      'The `2` suffix selects the upper half of the source registers, so `X` + `X2` process a full 128-bit input.');
  }

  set('sabd', 'SIMD Signed Absolute Difference',
    'Per-lane `|Vn − Vm|`, treating lanes as signed.',
    [
      'SABD Vd.16B, Vn.16B, Vm.16B',
      'SABD Vd.4S, Vn.4S, Vm.4S',
    ],
    'The building block of SAD (sum of absolute differences) in video codecs — ' +
    'follow with `UADDLV`.');

  set('uabd', 'SIMD Unsigned Absolute Difference',
    'Per-lane `|Vn − Vm|`, treating lanes as unsigned.',
    [
      'UABD Vd.16B, Vn.16B, Vm.16B',
      'UABD Vd.8H, Vn.8H, Vm.8H',
    ]);

  const minmax: [string, string][] = [
    ['smax', 'Signed Maximum'],
    ['smin', 'Signed Minimum'],
    ['umax', 'Unsigned Maximum'],
    ['umin', 'Unsigned Minimum'],
  ];

  for (const [mnem, title] of minmax) {
    const upper = mnem.toUpperCase();
    set(mnem, `SIMD ${title}`,
      `Per-lane ${title.toLowerCase()} of two vectors.`,
      [
        `${upper} Vd.16B, Vn.16B, Vm.16B`,
        `${upper} Vd.4S, Vn.4S, Vm.4S`,
      ],
      'Branchless clamping: `SMAX` against a floor then `SMIN` against a ceiling. ' +
      `Reduce a whole vector with \`${upper}V\`. Not available for \`.2D\` lanes.`);
  }

  const minmaxv: [string, string][] = [
    ['smaxv', 'Signed Maximum across Vector'],
    ['sminv', 'Signed Minimum across Vector'],
    ['umaxv', 'Unsigned Maximum across Vector'],
    ['uminv', 'Unsigned Minimum across Vector'],
  ];

  for (const [mnem, title] of minmaxv) {
    const upper = mnem.toUpperCase();
    set(mnem, `SIMD ${title}`,
      'Horizontal reduction: the extreme lane of the whole vector, as a scalar.',
      [
        `${upper} Bd, Vn.16B`,
        `${upper} Sd, Vn.4S`,
      ],
      '`UMAXV Bd, Vn.16B` + `FMOV`/`UMOV` is the standard "did any lane match?" test ' +
      'after a `CMEQ`. Not available for `.2D` lanes.');
  }

  const saturating: [string, string, string][] = [
    ['sqadd', 'Signed saturating Add',       'signed'],
    ['uqadd', 'Unsigned saturating Add',     'unsigned'],
    ['sqsub', 'Signed saturating Subtract',  'signed'],
    ['uqsub', 'Unsigned saturating Subtract', 'unsigned'],
  ];

  for (const [mnem, title, sign] of saturating) {
    const upper = mnem.toUpperCase();
    const limit = sign === 'signed'
      ? 'the largest/smallest signed value of the lane width'
      : 'the largest unsigned value, or zero';
    set(mnem, `SIMD ${title}`,
      `Per-lane ${title.includes('Add') ? 'addition' : 'subtraction'} that **clamps** ` +
      `instead of wrapping: results out of range become ${limit}.`,
      [
        `${upper} Vd.16B, Vn.16B, Vm.16B`,
        `${upper} Vd.4S, Vn.4S, Vm.4S`,
        `${upper} Sd, Sn, Sm         // scalar form`,
      ],
      'Saturation sets the `QC` (cumulative saturation) bit in `FPSR`. ' +
      'Essential for audio and pixel arithmetic, where wraparound is visible as a glitch.');
  }

  // ─── SIMD bitwise ─────────────────────────────────────────────────────────

  set('not', 'SIMD Bitwise NOT',
    'Invert every bit of the vector.',
    [
      'NOT Vd.16B, Vn.16B',
      'NOT Vd.8B, Vn.8B',
    ],
    'Only the `.8B` / `.16B` arrangements exist — the operation is bit-wise, so lane size ' +
    'is irrelevant. `MVN Vd.16B, Vn.16B` is an alias for this.');

  set('bsl', 'SIMD Bitwise Select',
    'Blend two vectors using `Vd` as the mask: `Vd = (Vd & Vn) | (~Vd & Vm)` — ' +
    'bits set in the mask take `Vn`, clear bits take `Vm`.',
    [
      'BSL Vd.16B, Vn.16B, Vm.16B',
    ],
    '**`Vd` is both the mask and the destination** — it is destroyed by the operation. ' +
    'Combined with a `CMEQ`/`FCMGT` mask this gives a branchless per-lane `?:`. ' +
    'Compare with `BIT`/`BIF`, where the mask is `Vm` instead.');

  set('bit', 'SIMD Bitwise Insert if True',
    'Copy bits from `Vn` into `Vd` where the mask `Vm` has 1 bits; leave `Vd` elsewhere.',
    [
      'BIT Vd.16B, Vn.16B, Vm.16B',
    ],
    'Unlike `BSL`, the mask (`Vm`) survives, so it can be reused across lanes/iterations.');

  set('bif', 'SIMD Bitwise Insert if False',
    'Copy bits from `Vn` into `Vd` where the mask `Vm` has 0 bits; leave `Vd` elsewhere.',
    [
      'BIF Vd.16B, Vn.16B, Vm.16B',
    ],
    'The complement of `BIT`.');

  // ─── SIMD shifts, widening and narrowing ──────────────────────────────────

  set('shl', 'SIMD Shift Left by immediate',
    'Shift every lane left by a fixed amount. Bits shifted out of the lane are discarded.',
    [
      'SHL Vd.4S, Vn.4S, #3',
      'SHL Vd.16B, Vn.16B, #1',
      'SHL Dd, Dn, #8            // scalar 64-bit',
    ],
    'The shift amount must be `0 … laneWidth-1`. Left shift is sign-agnostic; ' +
    'use `SSHR`/`USHR` for the right shifts, which are not.');

  set('sshr', 'SIMD Signed Shift Right by immediate',
    'Arithmetic right shift of every lane — the sign bit is replicated.',
    [
      'SSHR Vd.4S, Vn.4S, #2',
      'SSHR Vd.8H, Vn.8H, #15    // broadcast the sign bit as a mask',
    ],
    'Shift amount is `1 … laneWidth`. `SSHR Vd.4S, Vn.4S, #31` turns each lane ' +
    'into an all-ones/all-zeros sign mask.');

  set('ushr', 'SIMD Unsigned Shift Right by immediate',
    'Logical right shift of every lane — zeros are shifted in.',
    [
      'USHR Vd.4S, Vn.4S, #8',
      'USHR Vd.16B, Vn.16B, #4',
    ],
    'Shift amount is `1 … laneWidth`.');

  set('srshr', 'SIMD Signed Rounding Shift Right',
    'Arithmetic right shift that **rounds** (adds half an ULP before shifting) ' +
    'instead of truncating.',
    [
      'SRSHR Vd.4S, Vn.4S, #8',
    ],
    'Use when a right shift is standing in for a division and truncation bias matters.');

  set('urshr', 'SIMD Unsigned Rounding Shift Right',
    'Logical right shift with rounding.',
    [
      'URSHR Vd.8H, Vn.8H, #4',
    ]);

  set('sli', 'SIMD Shift Left and Insert',
    'Shift `Vn` left and insert into `Vd`, **keeping** the low bits of `Vd` that ' +
    'the shift would have vacated.',
    [
      'SLI Vd.4S, Vn.4S, #8',
      'SLI Vd.16B, Vn.16B, #4',
    ],
    'Reads and writes `Vd`. Used for bit-packing several fields into one lane.');

  set('sri', 'SIMD Shift Right and Insert',
    'Shift `Vn` right and insert into `Vd`, keeping the high bits of `Vd`.',
    [
      'SRI Vd.4S, Vn.4S, #8',
    ],
    'Reads and writes `Vd`. The mirror of `SLI`.');

  const widenShifts: [string, string, string][] = [
    ['sshll',  'Signed Shift Left Long',          'lower'],
    ['sshll2', 'Signed Shift Left Long (upper)',  'upper'],
    ['ushll',  'Unsigned Shift Left Long',        'lower'],
    ['ushll2', 'Unsigned Shift Left Long (upper)', 'upper'],
  ];

  for (const [mnem, title, half] of widenShifts) {
    const upper = mnem.toUpperCase();
    const signed = mnem.startsWith('s');
    set(mnem, `SIMD ${title}`,
      `Widen the **${half}** half of the source to double the lane width ` +
      `(${signed ? 'sign' : 'zero'}-extending), then shift left by an immediate.`,
      [
        `${upper} Vd.8H, Vn.${half === 'upper' ? '16B' : '8B'}, #0    // pure widening`,
        `${upper} Vd.4S, Vn.${half === 'upper' ? '8H' : '4H'}, #4`,
      ],
      'With `#0` this is the standard way to widen a vector. ' +
      `Companion narrowing: \`${signed ? 'SQXTN' : 'UQXTN'}\` / \`XTN\`.`);
  }

  set('xtn', 'SIMD Extract Narrow',
    'Truncate every lane to half its width, writing the result into the **lower** ' +
    '64 bits of the destination.',
    [
      'XTN Vd.8B, Vn.8H     // 8 × 16-bit → 8 × 8-bit (truncated)',
      'XTN Vd.4H, Vn.4S',
      'XTN Vd.2S, Vn.2D',
    ],
    'Plain truncation — values that do not fit **wrap around**. ' +
    'Use `SQXTN`/`UQXTN` to saturate instead. `XTN2` fills the upper half.');

  set('xtn2', 'SIMD Extract Narrow, upper half',
    'Like `XTN`, but writes into the **upper** 64 bits of the destination, ' +
    'preserving the lower half.',
    [
      'XTN2 Vd.16B, Vn.8H',
      'XTN2 Vd.8H, Vn.4S',
    ],
    'The `XTN` + `XTN2` pair packs two wide vectors into one narrow vector.');

  set('sqxtn', 'SIMD Signed saturating Extract Narrow',
    'Narrow each lane to half its width, **saturating** signed values that do not fit.',
    [
      'SQXTN Vd.4H, Vn.4S',
      'SQXTN Vd.8B, Vn.8H',
      'SQXTN Sd, Dn            // scalar form',
    ],
    'Saturation sets `FPSR.QC`. `SQXTN2` writes the upper half.');

  set('uqxtn', 'SIMD Unsigned saturating Extract Narrow',
    'Narrow each lane, saturating unsigned values to the maximum of the new width.',
    [
      'UQXTN Vd.4H, Vn.4S',
      'UQXTN Vd.8B, Vn.8H',
    ]);

  set('sqxtun', 'SIMD Signed saturating Extract Unsigned Narrow',
    'Narrow **signed** lanes into **unsigned** results, saturating: negatives become `0`, ' +
    'large values become the unsigned maximum.',
    [
      'SQXTUN Vd.8B, Vn.8H     // signed int16 → uint8, clamped to 0…255',
      'SQXTUN Vd.4H, Vn.4S',
    ],
    'Exactly the clamp needed when converting computed pixel values back to bytes.');

  set('shrn', 'SIMD Shift Right Narrow',
    'Shift each lane right by an immediate, then truncate to half the lane width, ' +
    'writing the **lower** 64 bits of the destination.',
    [
      'SHRN Vd.8B, Vn.8H, #8',
      'SHRN Vd.4H, Vn.4S, #16',
    ],
    'Combines a scaling shift and a narrow in one instruction. `SHRN2` fills the upper half.');

  set('shrn2', 'SIMD Shift Right Narrow, upper half',
    'Like `SHRN`, but writes the **upper** 64 bits of the destination.',
    [
      'SHRN2 Vd.16B, Vn.8H, #8',
    ]);

  // ─── SIMD load / store (de-interleaving) ──────────────────────────────────

  const structOps: [string, number][] = [
    ['ld', 1], ['ld', 2], ['ld', 3], ['ld', 4],
    ['st', 1], ['st', 2], ['st', 3], ['st', 4],
  ];

  for (const [kind, n] of structOps) {
    const mnem   = `${kind}${n}`;
    const upper  = mnem.toUpperCase();
    const isLoad = kind === 'ld';
    const verb   = isLoad ? 'Load' : 'Store';
    const dir    = isLoad ? 'from' : 'to';

    const interleave = n === 1
      ? `Move whole vectors ${dir} memory, with no de-interleaving.`
      : `${verb} ${n} vectors ${dir} memory, **${isLoad ? 'de-' : ''}interleaving** by ` +
        `${n} — consecutive elements in memory land in ${n} different registers ` +
        `(e.g. ${n === 2 ? 'stereo samples, XY pairs' : n === 3 ? 'RGB pixels' : 'RGBA pixels'}).`;

    const regs     = Array.from({ length: n }, (_, i) => `V${i}.4S`).join(', ');
    const laneRegs = Array.from({ length: n }, (_, i) => `V${i}.S`).join(', ');

    // Pad the operands so the trailing `//` comments line up in the code fence.
    const forms: [string, string][] = [
      [`${upper} {${regs}}, [Xn]`,                    ''],
      [`${upper} {${regs}}, [Xn], #${n * 16}`,        'post-index by the bytes moved'],
      [`${upper} {${regs}}, [Xn], Xm`,                'post-index by a register'],
      [`${upper} {${laneRegs}}[2], [Xn]`,             'single-lane form'],
    ];
    const codeWidth = Math.max(...forms.map(([code]) => code.length)) + 2;

    set(mnem, `SIMD ${verb} multiple ${n}-element structures`,
      interleave,
      forms.map(([code, comment]) =>
        comment ? `${code.padEnd(codeWidth)}// ${comment}` : code),
      (n === 1
        ? `\`${upper}\` also accepts 2–4 registers in the list, moving them back to back ` +
          'with no interleaving — the plain "load/store several vectors" form.'
        : 'The register list must be **consecutive** (`v0, v1, v2` — wrapping past `v31`). ' +
          'The arrangement sets the element size; all registers in the list share it.') +
      (isLoad ? '\n\n`LD1R` broadcasts a single element to every lane instead.' : ''));
  }

  set('ld1r', 'SIMD Load one single-element structure and Replicate',
    'Load one element from memory and broadcast it to every lane.',
    [
      'LD1R {V0.4S}, [Xn]        // load 4 bytes, broadcast to all 4 lanes',
      'LD1R {V0.16B}, [Xn], #1',
    ],
    'The memory-operand equivalent of `DUP` — handy for loading a scalar coefficient ' +
    'into a whole vector inside a loop.');

  // ─── Vector forms of mnemonics that also exist as scalar instructions ─────
  //
  // These are appended below the scalar documentation in `instructions.ts`,
  // after a horizontal rule, so their headers name the vector form explicitly.

  set('add', 'Add (vector form)',
    'Per-lane integer addition. Lanes wrap on overflow — no flags are set.',
    [
      'ADD Vd.4S, Vn.4S, Vm.4S',
      'ADD Vd.16B, Vn.16B, Vm.16B',
      'ADD Dd, Dn, Dm             // scalar 64-bit SIMD form',
    ],
    'Use `SQADD`/`UQADD` for saturation, `SADDL`/`UADDL` for widening, `FADD` for floats.');

  set('sub', 'Subtract (vector form)',
    'Per-lane integer subtraction, wrapping on overflow.',
    [
      'SUB Vd.4S, Vn.4S, Vm.4S',
      'SUB Vd.8H, Vn.8H, Vm.8H',
    ],
    'Saturating variants: `SQSUB` / `UQSUB`.');

  set('mul', 'Multiply (vector form)',
    'Per-lane integer multiplication, keeping only the **low** half of each product.',
    [
      'MUL Vd.4S, Vn.4S, Vm.4S',
      'MUL Vd.8H, Vn.8H, Vm.H[0]    // by element',
    ],
    'Not available for `.2D`. Use `SMULL`/`UMULL` to keep the full double-width product.');

  set('neg', 'Negate (vector form)',
    'Per-lane two’s-complement negation.',
    [
      'NEG Vd.4S, Vn.4S',
      'NEG Dd, Dn            // scalar 64-bit',
    ],
    'Use `FNEG` for floats (which only flips the sign bit).');

  set('mov', 'Move (vector form)',
    'Vector register copy, lane insert, or lane extract. Every form is an **alias** ' +
    'for another instruction.',
    [
      'MOV Vd.16B, Vn.16B    // alias for ORR Vd.16B, Vn.16B, Vn.16B',
      'MOV Vd.S[0], Wn       // alias for INS Vd.S[0], Wn',
      'MOV Vd.S[3], Vn.S[1]  // alias for INS (lane → lane)',
      'MOV Wd, Vn.S[2]       // alias for UMOV',
    ],
    'Note there is no `MOV Vd.4S, Vn.4S` — the register-copy form is always `.8B`/`.16B`.');

  set('and', 'Bitwise AND (vector form)',
    'Bit-wise AND of two whole vectors.',
    [
      'AND Vd.16B, Vn.16B, Vm.16B',
      'AND Vd.8B, Vn.8B, Vm.8B',
    ],
    'Only `.8B` / `.16B` exist — the operation is bit-wise, so lane size is irrelevant. ' +
    'This is how you apply a `CMEQ`/`FCMGT` mask.');

  set('orr', 'Bitwise OR (vector form)',
    'Bit-wise OR of two whole vectors, or OR with an encodable immediate.',
    [
      'ORR Vd.16B, Vn.16B, Vm.16B',
      'ORR Vd.4S, #0x80, LSL #24    // set a bit pattern in every lane',
    ],
    '`ORR Vd.16B, Vn.16B, Vn.16B` (same source twice) is the register-copy idiom ' +
    'that `MOV Vd.16B, Vn.16B` aliases.');

  set('eor', 'Bitwise Exclusive OR (vector form)',
    'Bit-wise XOR of two whole vectors.',
    [
      'EOR Vd.16B, Vn.16B, Vm.16B',
    ],
    '`EOR Vd.16B, Vd.16B, Vd.16B` zeroes a vector, though `MOVI Vd.16B, #0` is clearer.');

  set('bic', 'Bitwise Bit Clear (vector form)',
    'Compute `Vn & ~Vm`, or clear an encodable immediate pattern in every lane.',
    [
      'BIC Vd.16B, Vn.16B, Vm.16B',
      'BIC Vd.4S, #0xFF, LSL #24    // clear the top byte of every lane',
    ]);

  set('orn', 'Bitwise OR NOT (vector form)',
    'Compute `Vn | ~Vm`.',
    [
      'ORN Vd.16B, Vn.16B, Vm.16B',
    ]);

  set('ldr', 'Load Register (SIMD/FP)',
    'Load a floating-point or vector register from memory. The register letter ' +
    'chooses how many bytes are moved.',
    [
      'LDR Qd, [Xn {, #offset}]     // 16 bytes — full vector',
      'LDR Dd, [Xn {, #offset}]     // 8 bytes',
      'LDR Sd, [Xn {, #offset}]     // 4 bytes',
      'LDR Hd, [Xn]                 // 2 bytes',
      'LDR Sd, =0x3F800000          // literal pool: load the bits of 1.0f',
    ],
    'Pre/post-index and register-offset addressing work exactly as for GPRs. ' +
    'For de-interleaving loads use `LD1`–`LD4` instead.');

  set('str', 'Store Register (SIMD/FP)',
    'Store a floating-point or vector register to memory.',
    [
      'STR Qd, [Xn {, #offset}]     // 16 bytes',
      'STR Dd, [Xn {, #offset}]     // 8 bytes',
      'STR Sd, [Xn], #4             // post-index',
    ]);

  set('ldp', 'Load Pair (SIMD/FP)',
    'Load two consecutive FP/vector registers from memory.',
    [
      'LDP Q0, Q1, [Xn]             // 32 bytes',
      'LDP D8, D9, [sp], #16        // typical epilog for callee-saved d8–d15',
    ],
    'Remember that `d8`–`d15` are the callee-saved halves — save/restore them if you use them.');

  set('stp', 'Store Pair (SIMD/FP)',
    'Store two consecutive FP/vector registers to memory.',
    [
      'STP Q0, Q1, [Xn]',
      'STP D8, D9, [sp, #-16]!      // typical prolog for callee-saved d8–d15',
    ]);

  return m;
}

export const SIMD_INSTRUCTION_DOCS = buildSimdInstructionDocs();
