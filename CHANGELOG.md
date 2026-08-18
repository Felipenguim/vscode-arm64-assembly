# Changelog

All notable changes to this project will be documented in this file.

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
