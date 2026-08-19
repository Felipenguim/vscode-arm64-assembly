# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] — 2026-08-18

### Added
- **Diagnostics** — the extension now reports problems as you type, after a
  300 ms debounce (`arm64asm.diagnostics.delay`). Findings land in the
  Problems panel, so `F8` / `Shift+F8` walk through them and `Ctrl+Shift+M`
  opens the list. A status-bar counter shows the active file's error and
  warning totals and opens the panel on click.

  Severities were checked against `aarch64-linux-gnu-as` (binutils 2.38)
  rather than assumed, and each rule family carries the severity the
  assembler itself uses:

  | Family | Setting | Default | Catches |
  |---|---|---|---|
  | Syntax | `diagnostics.syntax` | `error` | `add sp, sp #16`, `add, sp, ...`, unbalanced `[`, unterminated string, empty operand |
  | Directives | `diagnostics.directives` | `error` | `dq`/`dd`/`resb`/`%macro`, `.quad 1.56`, `.ascii hello` |
  | Unknown directive | `diagnostics.unknownDirective` | `warning` | `.elif` → did you mean `.elseif`? |
  | Data truncation | `diagnostics.dataTruncation` | `warning` | `.byte 300` → truncated to `0x2C` |
  | Operands | `diagnostics.operands` | `error` | `mov x3, [x4]`, `str x0, x1`, `add x0, w1, x2`, wrong operand count |
  | Vectors | `diagnostics.vectors` | `error` | `v10.s[9]` out of range, `fadd v0.4s, v1.2d, v2.4s` |
  | Symbols | `diagnostics.symbols` | `warning` | `b ret_x` when the label is `.ret_x` |
  | Immediate `#` | `diagnostics.immediateHash` | `warning` | `add sp, sp, 16` — style only, GAS accepts it |

- **Quick-fixes** (`Ctrl+.`) for every finding with an unambiguous repair:
  insert the missing comma or `#`, swap in the suggested symbol or directive,
  quote a bare string. Suggestions rank candidates by edit distance, then by
  whether the written name abbreviates the candidate — which is why `.elif`
  proposes `.elseif` rather than the equally-close `.else`.
- **`src/parser/`** — a line tokenizer that preserves column offsets, so a
  finding can underline the exact character. Handles `//`, `@` and multi-line
  `/* */` comments without being fooled by a marker inside a string, keeps
  `[x1, #8]!` and `{v0.16b, v1.16b}` as single operands, and recognises GAS
  symbol assignment (`len = . - msg`).
- **`src/diagnostics/symbolIndex.ts`** — indexes labels, `.macro` names and
  their parameters, `.equ`/`.set`, `.global`/`.extern` declarations, `.req`
  aliases and `name = expr` assignments, across the file and one level of
  `.include`.
- **`src/parser/formSpec.ts` + `src/data/instructionSignatures.ts`** — operand
  forms written in nearly the notation the hover docs already used
  (`LDP Rt1, Rt2, mem, #imm?`), compiled into matchers at load. Width, vector
  arrangement and FP size are *bound across a form*, which is what catches
  `add x0, w1, x2` and `fadd v0.4s, v1.2d, v2.4s` without listing every
  combination by hand.

  The table covers roughly 300 mnemonics. **A mnemonic with no entry produces no
  operand diagnostic**, so it can keep growing without ever introducing a false
  positive.

  Messages are specific rather than generic: mixed widths, mismatched
  arrangements and a wrong operand count each get their own wording, and classic
  slips get a direct instruction — `mov x3, [x4]` answers "`MOV` não acessa
  memória — para ler de um endereço use `LDR`".
- **`src/data/mnemonics.ts`** — 566 known AArch64 mnemonics, generated from the
  TextMate grammar. Used to tell an instruction from a macro call, which is what
  keeps operand rules from firing on `_write 1, msg, 13`.
- **`src/data/directives.ts`** — the GAS directive list with the gaps the
  grammar was missing (`.org`, `.hword`, the `.ifc`/`.ifb` family,
  `.pushsection`, …), plus a table of NASM/MASM directives and their GAS
  equivalents.
- **Test suite** — `npm test`, using Node's built-in runner, no new
  dependencies. 60 tests over the pure analysis core, including two fixtures:
  `examples/lint_errors.s` (every rule, each line tagged with the code it must
  produce) and `examples/lint_clean.s` (correct code covering every known
  false-positive trap, which must stay silent — it assembles with no messages
  under `aarch64-linux-gnu-as`).

  On top of that, a differential check: of the 105 real `.s` files used during
  development, the 55 that `aarch64-linux-gnu-as` accepts **with no message at
  all** produce zero error-severity findings. Every false positive found this
  way was a genuine gap in the tables — the extended-register form
  (`add x0, x1, w2, uxtw #2`), `add x3, sp, x3`, a `.equ` constant used as an
  immediate, and the by-element `fmul v12.4s, v11.4s, v10.s[1]`.
- Inline suppression: `// arm64asm-ignore-line` and
  `// arm64asm-ignore: symbols, operands`.
- Command **ARM64: Analyze File Now** (`arm64asm.runDiagnostics`).

### Changed
- `.include` resolution moved to `src/providers/includeResolver.ts`. It was
  duplicated verbatim in `macroResolver.ts` and `functionResolver.ts`, and the
  diagnostics needed it a third time.

### Notes
- The `#` before an immediate is **optional** in AArch64 — `add sp, sp, 16`
  assembles cleanly. The rule is therefore a style warning, not an error, and
  `"arm64asm.diagnostics.immediateHash": "off"` turns it off entirely.
- Symbol findings are warnings because `b some_label` assembles fine when the
  label is resolved at link time. Only a near miss against a known name, or an
  undefined *local* label, is reported.

## [0.2.0] — 2026-08-01

### Added
- Hover documentation for ~120 floating-point and SIMD/NEON instructions
  (`src/data/simdInstructions.ts`): FP arithmetic, conversion and rounding
  (`fadd`, `fcvtzs`, `frintm`, `scvtf`, …), comparison and select (`fcmp` — with
  the full FP condition-code table — `fccmp`, `fcsel`, `cmeq`, `fcmgt`, …), data
  movement (`movi`, `dup`, `ins`, `umov`, `ext`, `tbl`, `zip1`, …), integer SIMD
  arithmetic, saturating and widening/narrowing forms, and the de-interleaving
  loads/stores `ld1`–`ld4` / `st1`–`st4`
- Vector-form documentation for mnemonics shared with the scalar set (`add`,
  `mul`, `orr`, `mov`, `ldr`, `stp`, …); these hovers now show the scalar
  description followed by the vector one
- Hover for vector operands with an arrangement or lane index (`v1.4s`, `v0.2d`,
  `v3.s[0]`): lane count, element width, an ASCII map of every lane's bit range,
  and a table of the other arrangements available on the same register
  (`src/data/vectorArrangements.ts`)
- Syntax highlighting for lane-index operands (`v3.s[0]`), plus the missing
  `fmla`, `fmls`, `mla`, `mls` mnemonics

### Fixed
- Vector operands with an arrangement (`v3.8b`, `v1.4s`) produced **no** register
  hover and instead fell through to the numeric-literal hover, showing a decimal
  conversion table for the digits. `Arm64HoverProvider.IDENT_RE` matched the whole
  `v3.8b` string, which is not a key in `REGISTER_DOCS`; a dedicated vector regex
  is now tried first

## [0.1.0] — 2026-04-13

### Added
- Language recognition for `.s` and `.S` files (`arm64-asm`)
- TextMate grammar with full ARM64/AArch64 coverage:
  - All general-purpose registers: `x0–x30`, `w0–w30`, and aliases (`sp`, `lr`, `fp`, `xzr`, `wzr`, `wsp`, `pc`)
  - All FP/SIMD registers: `v0–v31`, `q0–q31`, `d0–d31`, `s0–s31`, `h0–h31`, `b0–b31` with vector arrangement suffixes
  - Common system registers: `NZCV`, `DAIF`, `FPSR`, `FPCR`, `ELR_EL1`, `SCTLR_EL1`, `VBAR_EL1`, and many more
  - Instruction groups: branch, memory (load/store), arithmetic, logical, SIMD/FP, system
  - GNU AS directives including full `.cfi_*` set
  - Numeric literals: hex (`#0xFF`), binary (`#0b101`), octal (`#0644`), decimal
  - String literals with escape sequence highlighting
  - Macro parameter highlighting (`\param`)
- `language-configuration.json`: `//` and `/* */` comments, bracket auto-close
- `DocumentSymbolProvider`: labels and `.macro` definitions in the outline panel
- `DefinitionProvider`: F12 / Ctrl+Click on a label jumps to its definition (same file)
- `HoverProvider`: hover over any register shows its ABI role and description
- Example project: bare-metal ARM64 `touch` implementation in `examples/`
