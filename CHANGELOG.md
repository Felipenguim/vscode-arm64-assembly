# Changelog

All notable changes to this project will be documented in this file.

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
