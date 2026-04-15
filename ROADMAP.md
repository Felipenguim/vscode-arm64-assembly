# Roadmap

This document tracks the planned feature levels for **vscode-arm64-assembly**.
Each level builds on the previous one — contributions at any level are welcome.

---

## Level 1 — Pure Config (No TypeScript) ✅ Done

- Language recognition for `.s` and `.S` files (`arm64-asm`)
- Comment toggles: `//`, `@`, `/* */`
- Auto-closing brackets, parentheses, and quotes
- TextMate grammar with full ARM64/AArch64 coverage:
  - All GPR registers: `x0–x30`, `w0–w30`, aliases (`sp`, `lr`, `fp`, `xzr`, `wzr`, `wsp`, `pc`)
  - All FP/SIMD registers: `v0–v31`, `q/d/s/h/b 0–31` with vector arrangement suffixes
  - Common system registers: `nzcv`, `daif`, `vbar_el1`, `tpidr_el0`, and more
  - Instruction groups: branch, memory, arithmetic, logical, SIMD/FP, system
  - GNU AS directives including the full `.cfi_*` set
  - Numeric literals: hex (`#0xFF`), binary (`#0b101`), octal (`#0644`), decimal
  - Macro parameter highlighting (`\param`)

---

## Level 2 — First TypeScript Providers ✅ Done

- **DocumentSymbolProvider** — labels and `.macro` definitions appear in the Outline panel and breadcrumb navigation
- **DefinitionProvider** — F12 / Ctrl+Click on a label jumps to its definition (within the same file); supports standard labels (`START:`) and local labels (`.Lloop:`, `.fail:`)
- **HoverProvider** — hover over any register shows its ABI role, calling convention, and description (~200 registers covered)

---

## Level 3 — Cross-File Providers (Almost Done)

- **DefinitionProvider for `.include`** — Ctrl+Click on `.include "path"` opens the referenced file; resolves configurable `-I` include paths
- **DefinitionProvider for macros** — Ctrl+Click on a macro invocation jumps to its definition across workspace files ✅
- **HoverProvider for macros** — hovering a macro call shows its documentation comment block ✅

---

## Level 4 — Productivity Features

- **CompletionProvider** — autocomplete for instructions, registers, and directives; autocomplete for macros defined in the workspace
- **SignatureHelpProvider** — shows expected register arguments when typing a macro invocation
- **ReferencesProvider** — "Find All References" for labels and macros across the workspace
- **RenameProvider** — rename a label or macro across all files in the workspace

---

## Level 5 — Diagnostics and Toolchain Integration

- **Regex-based diagnostics** — detect common error patterns without invoking the assembler

---

## Level 6 — Language Server (Advanced Architecture)

- **Migrate to a standalone LSP server** — reusable by Neovim, Emacs, and other editors; publishable as a standalone tool
- **Semantic tokens** — semantic highlighting that distinguishes labels, macros, and constants even when regex falls short
- **Call hierarchy** — visualize which macros call which, and navigate macro dependencies

---

## Contributing

If you want to help, picking up any item from Levels 3–6 is a great place to start.
See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and code conventions.
