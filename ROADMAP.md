# Roadmap

This document tracks the planned feature levels for **vscode-arm64-assembly**.
Each level builds on the previous one — contributions at any level are welcome.

Legend: ✅ done · 🚧 in progress · ⬜ not started

---

## Level 1 — Pure Config (No TypeScript) ✅ Done

- ✅ Language recognition for `.s` and `.S` files (`arm64-asm`)
- ✅ Comment toggles: `//`, `@`, `/* */`
- ✅ Auto-closing brackets, parentheses, and quotes
- ✅ TextMate grammar with full ARM64/AArch64 coverage:
  - All GPR registers: `x0–x30`, `w0–w30`, aliases (`sp`, `lr`, `fp`, `xzr`, `wzr`, `wsp`, `pc`)
  - All FP/SIMD registers: `v0–v31`, `q/d/s/h/b 0–31` with vector arrangement suffixes
    and lane indices (`v3.s[0]`)
  - Common system registers: `nzcv`, `daif`, `vbar_el1`, `tpidr_el0`, and more
  - Instruction groups: branch, memory, arithmetic, logical, SIMD/FP, system
  - GNU AS directives including the full `.cfi_*` set
  - Numeric literals: hex (`#0xFF`), binary (`#0b101`), octal (`#0644`), decimal
  - Macro parameter highlighting (`\param`)

---

## Level 2 — First TypeScript Providers ✅ Done

- ✅ **DocumentSymbolProvider** — labels and `.macro` definitions appear in the Outline panel and breadcrumb navigation
- ✅ **DefinitionProvider** — F12 / Ctrl+Click on a label jumps to its definition (within the same file); supports standard labels (`START:`) and local labels (`.Lloop:`, `.fail:`)
- ✅ **HoverProvider — registers** — hover any register for its ABI role, calling convention, and description (~250 entries: `x0–x30`, `w0–w30`, `v/q/d/s/h/b 0–31`, aliases, and system registers)
- ✅ **HoverProvider — instructions** — hover any mnemonic for its purpose, operand forms, and caveats (~260 entries)
  - General-purpose, branch, conditional-select, bit-field, and system instructions
  - Floating-point and SIMD/NEON: arithmetic, conversion, rounding, comparison
    (`fcmp` ships the full FP condition-code table), data movement (`movi`, `dup`,
    `ins`, `tbl`, `ext`, …), saturating and widening/narrowing forms, and the
    de-interleaving loads/stores `ld1`–`ld4` / `st1`–`st4`
  - Mnemonics shared between the scalar and vector worlds (`add`, `orr`, `ldr`, `mov`, …)
    show the scalar documentation followed by the vector form
- ✅ **HoverProvider — SIMD lanes** — hover a vector operand carrying an arrangement or
  lane index (`v1.4s`, `v0.2d`, `v3.s[0]`) for its lane count, element width, an ASCII
  map of every lane's bit range, and the other arrangements available on that register
- ✅ **HoverProvider — numeric literals** — hover any literal for its value in decimal, hex, binary, and octal

---

## Level 3 — Cross-File Providers (Almost Done)

- ⬜ **DefinitionProvider for `.include`** — Ctrl+Click on `.include "path"` should open the referenced file. Include *paths* are already resolved for macro and function lookup (current directory, then each entry of the `arm64asm.includePaths` setting, mirroring GAS's `-I` flag), but the quoted path itself is not yet a click target
- ✅ **DefinitionProvider for macros** — Ctrl+Click on a macro invocation jumps to its definition across `.include`d files
- ✅ **HoverProvider for macros** — hovering a macro call shows its documentation comment block: signature, description, `@param` / `@return` tags, and the implementation body
- ✅ **DefinitionProvider and HoverProvider for functions** — the same treatment for
  plain function labels (names that do not start with `_`), via `functionResolver.ts`
- ⬜ **Transitive includes** — only a single level of `.include` is followed today; an
  included file's own includes are not searched

---

## Level 4 — Productivity Features

- ✅ **InlayHintsProvider** — hex, binary, and octal literals show their decimal value inline (`#0xFF ‣ 255`), so syscall numbers, permission bits, and flag masks read at a glance
- ⬜ **CompletionProvider** — autocomplete for instructions, registers, and directives; autocomplete for macros defined in the workspace
- ⬜ **SignatureHelpProvider** — shows expected register arguments when typing a macro invocation
- ⬜ **ReferencesProvider** — "Find All References" for labels and macros across the workspace
- ⬜ **RenameProvider** — rename a label or macro across all files in the workspace

---

## Level 5 — Static Analysis and Toolchain Integration

- 🚧 **Register state tracking** — the `ARM64: Show Register State at Cursor` command runs
  forward constant-propagation from the enclosing function label down to the cursor and
  reports each GPR as a literal, a symbol address, or unknown-with-a-reason (`registerTracker.ts`).
  Currently GPR-only (`x`/`w` and aliases) and command-driven; not yet surfaced as hovers,
  inlay hints, or diagnostics
- ⬜ **FP/SIMD register tracking** — extend the tracker to `v`/`q`/`d`/`s` registers and
  their arrangements
- ✅ **Regex-based diagnostics** — problems are reported as you type, without invoking the
  assembler (`src/diagnostics/`, built on the new column-preserving tokenizer in `src/parser/`).
  Live today: syntax (missing/stray comma, unbalanced bracket, unterminated string), directives
  (`dq`/`resb`/`%macro`, `.quad 1.56`, `.byte 300`, unknown directive), symbols (a branch or
  `ldr =sym` to a name nothing defines, with a did-you-mean), and the optional `#`-prefix style
  rule. Each family has its own severity setting, and every finding with an unambiguous repair
  ships a quick-fix. Severities were verified against `aarch64-linux-gnu-as` rather than assumed.
  Operand forms are validated against `src/data/instructionSignatures.ts` (~300 mnemonics,
  compiled by `src/parser/formSpec.ts`), which catches `mov x3, [x4]`, `str x0, x1`,
  `add x0, w1, x2`, a wrong operand count, `v10.s[9]` out of range and
  `fadd v0.4s, v1.2d, v2.4s`. A mnemonic with no entry produces no operand diagnostic, so the
  table grows without ever introducing a false positive
- ⬜ **Immediate range checking** — an immediate outside what the encoding can hold
  (`add` accepts a 12-bit unsigned value, optionally shifted by 12; `movz` a 16-bit one), and
  `ldr`/`str` offsets that are not correctly scaled for the access width
- ⬜ **Assembler integration** — run `as`/`clang` on save and surface real diagnostics

---

## Level 6 — Language Server (Advanced Architecture)

- ⬜ **Migrate to a standalone LSP server** — reusable by Neovim, Emacs, and other editors; publishable as a standalone tool
- ⬜ **Semantic tokens** — semantic highlighting that distinguishes labels, macros, and constants even when regex falls short
- ⬜ **Call hierarchy** — visualize which macros call which, and navigate macro dependencies

---

## Contributing

If you want to help, picking up any item from Levels 3–6 is a great place to start.
See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and code conventions.
