# ARM64 Assembly (GNU AS) — VS Code Extension

> Full-featured ARM64/AArch64 support for GNU Assembler (GAS) in Visual Studio Code.
> Built for bare-metal, syscall-level, and embedded ARM64 programming.

---

## Features

### Syntax Highlighting

Complete TextMate grammar with standard scope names — works with all VS Code themes.

| Token | Example |
|---|---|
| Registers (GPR 64-bit) | `x0` `x8` `x29` `x30` |
| Registers (GPR 32-bit) | `w0` `w8` `wzr` `wsp` |
| Registers (FP/SIMD) | `v3.8b` `q0` `d15` `s0` `h1` |
| Registers (system) | `nzcv` `daif` `vbar_el1` `tpidr_el0` |
| Instructions — branch | `b.eq` `bl` `cbz` `ret` |
| Instructions — memory | `ldr` `str` `ldp` `stp` `ldar` `stlr` |
| Instructions — arithmetic | `add` `sub` `mul` `udiv` `madd` |
| Instructions — logical | `and` `orr` `eor` `lsl` `ror` |
| Instructions — SIMD/FP | `fmul` `fadd` `dup` `tbl` `zip1` |
| Instructions — system | `svc` `mrs` `msr` `isb` `dsb` |
| GNU AS directives | `.macro` `.include` `.equ` `.section` `.cfi_startproc` |
| Numeric literals | `#0xFF` `#0b101` `#0644` `#42` |
| Labels | `START:` `.Lloop:` `.fail:` |
| Macro parameters | `\param` |
| Comments | `// line` `@ line` `/* block */` |

### Outline Panel (DocumentSymbolProvider)

Labels and macro definitions appear in the VS Code Explorer **Outline** panel and in the **breadcrumb** navigation bar at the top of the editor.

```
OUTLINE
├── ELF_HEADER       (label)
├── PROGRAM_HEADER   (label)
├── START            (label)
│   ├── .fail        (label)
│   └── .leave       (label)
└── _open            (.macro)
```

### Go-to-Definition (DefinitionProvider)

Press **F12** or **Ctrl+Click** on any label reference to jump to its definition in the same file.

Supports standard labels (`START`, `ELF_HEADER`) and local labels (`.Lloop`, `.fail`, `.L_done`).

### Register Hover Documentation (HoverProvider)

Hover over any register to see its ABI role and description.

| Register | Hover tooltip |
|---|---|
| `x0` | Argument 1 / return value (AArch64 ABI). Caller-saved. |
| `x8` | Indirect result location / **Linux syscall number**. Caller-saved. |
| `x29` | Frame pointer (FP). Callee-saved. |
| `sp` | Stack pointer. Must be 16-byte aligned at all public interfaces. |
| `v3.8b` | 128-bit vector register. Arrangements: .8b .16b .4h .8h .2s .4s .1d .2d. |
| `nzcv` | Condition flags: N (Negative), Z (Zero), C (Carry), V (Overflow). |
| `vbar_el1` | Vector base address register EL1 — base of the EL1 exception vector table. |

Covers all ~200 AArch64 registers: `x0–x30`, `w0–w30`, `v0–v31`, `q/d/s/h/b 0–31`, `sp`, `lr`, `fp`, `xzr`, `wzr`, and a comprehensive set of system registers.

---

## Requirements

- VS Code **1.95.0** or later (November 2024)
- Files with `.s` or `.S` extension are automatically detected as `arm64-asm`

---

## Quick Start

1. Install from the VS Code Marketplace (search **"ARM64 Assembly"**)
2. Open any `.s` or `.S` file — syntax highlighting activates automatically
3. Open the Explorer **Outline** panel to navigate labels and macros
4. Hover over a register name to see its ABI description
5. Ctrl+Click a label to jump to its definition

---

## Example

The `examples/` directory contains a complete bare-metal ARM64 implementation of the `touch` command, assembled directly to an ELF binary without libc:

```asm
START:
    ldr x1, [sp, 0]       // load argc
    cmp x1, 2
    b.ne .fail

    ldr x1, [sp, 16]      // x1 = argv[1] (path)
    mov x0, #-100          // AT_FDCWD
    mov x2, #0102          // O_CREAT | O_RDWR
    mov x3, #0644          // permissions

    _open
    cmp x0, #0
    b.lt .fail

    _close
    cmp x0, #0
    b.eq .leave

.fail:
    mov x0, #1
    b .leave

.leave:
    _exit
```

To assemble and run (on Linux/WSL2 with AArch64 cross-tools):

```bash
aarch64-linux-gnu-as examples/test.s -I examples -o test.o
aarch64-linux-gnu-ld test.o -o touch_arm64
qemu-aarch64 ./touch_arm64 myfile.txt
```

---

## Why Not vscode-arm?

| Feature | vscode-arm | **vscode-arm64-assembly** |
|---|---|---|
| ARM64 register coverage | Partial | **All** x/w/v/q/d/s/h/b 0–31 + system regs |
| TextMate scope names | Non-standard | Standard — works with all themes |
| CFI directives | Missing | Full `.cfi_startproc` / `.cfi_endproc` etc. |
| TypeScript providers | None | DocumentSymbol + Definition + Hover |
| Register hover docs | None | ~200 registers with ABI roles |
| VS Code engine | `^0.10.1` (2015) | `^1.75.0` (modern) |
| Comment style (`//`) | Not primary | First-class — Ctrl+/ toggles `//` |

---

## Roadmap

| Level | Status | Features |
|---|---|---|
| 1 | ✅ Done | Language recognition, syntax highlighting, comments, auto-close |
| 2 | ✅ Done | Document symbols, go-to-definition (labels), hover (registers) |
| 3 | Planned | `.INCLUDE` go-to-definition, cross-file macro definitions and hover |
| 4 | Planned | Autocomplete (instructions, registers, directives, macros), signature help, rename |
| 5 | Planned | Diagnostics via `aarch64-linux-gnu-as`, real-time error underlines, Task Provider |
| 6 | Planned | Full LSP server (reusable by Neovim/Emacs), semantic tokens, call hierarchy |

---

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/YOUR_GITHUB/vscode-arm64-assembly).

If you find missing instructions, registers, or directives, please open an issue — ARM64 has a large ISA and contributions are very much appreciated.

### Development setup

```bash
git clone https://github.com/YOUR_GITHUB/vscode-arm64-assembly
cd vscode-arm64-assembly
npm install
npm run watch    # compile in watch mode
# Press F5 in VS Code to launch Extension Development Host
```

---

## License

MIT — see [LICENSE](LICENSE).
