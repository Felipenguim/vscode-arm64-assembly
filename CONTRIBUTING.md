# Contributing

Thanks for your interest in **vscode-arm64-assembly**!
This is a small open-source project and contributions of any size are welcome —
from fixing a typo to implementing a full provider.

---

## Table of Contents

- [Dev Setup](#dev-setup)
- [Project Structure](#project-structure)
- [Types of Contributions](#types-of-contributions)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)

---

## Dev Setup

**Prerequisites:**

- [Node.js](https://nodejs.org/) 18 or later
- [VS Code](https://code.visualstudio.com/) 1.95 or later
- TypeScript (installed locally via `npm install` — no global install needed)

**Steps:**

```bash
git clone https://github.com/YOUR_GITHUB/vscode-arm64-assembly
cd vscode-arm64-assembly
npm install
```

To test the extension live:

1. Open the project folder in VS Code
2. Press **F5** — this launches a second VS Code window called the **Extension Development Host**
3. In that window, open any `.s` or `.S` file, you can find some in the examples folder
4. Your changes to TypeScript source take effect after `npm run compile` (or leave `npm run watch` running in the background for automatic recompilation)

> There is no automated test suite yet. All testing is done manually in the Extension Development Host.

---

## Project Structure

```
src/
  extension.ts              # activation entry point — registers all providers
  providers/
    documentSymbolProvider.ts   # labels + macros in the Outline panel
    definitionProvider.ts       # F12 / Ctrl+Click go-to-definition for labels
    hoverProvider.ts            # register/instruction hover docs
    inlayHintProvider.ts        # inline decimal for hex/binary/octal literals
    macroResolver.ts            # shared logic for finding macro definitions
  data/
    registers.ts                # ABI descriptions for all ~200 AArch64 registers
    instructions.ts             # instruction documentation data

syntaxes/
  arm64-asm.tmLanguage.json # TextMate grammar — syntax highlighting rules

examples/
  test.s and some macros called in /SYS/LINUX      # bare-metal ARM64 example (touch command, no libc)

language-configuration.json # comment styles, bracket auto-close
package.json                # extension manifest
```

---

## Types of Contributions

### Adding, reviewing or complementing info about: register, instruction, or directive

Most of these are pure data changes — no complex logic involved.

- **register:** edit entry to `src/data/registers.ts`. Each entry has a name, ABI role, and description string.
- **instruction:** edit an entry to `src/data/instructions.ts` with the mnemonic and a short description.
- **directive or keyword in highlighting:** edit the relevant rule in `syntaxes/arm64-asm.tmLanguage.json`. ARM64 has a large ISA — gaps here are expected and very welcome fixes.

### Implementing a planned feature

Check the [Roadmap](ROADMAP.md) for what's planned. Level 3 (cross-file providers) is the logical next step. If you want to work on something, open an issue first so we can align on the approach before you invest time.
Tou don't have to follow the roadmap, you can suggest or work in any new improvment. 

### Fixing a bug

Open an issue describing the behavior and the expected behavior, then submit a PR referencing it.

---

## Code Style

- **TypeScript** — strict mode is enabled (`tsconfig.json`). No `any` unless truly unavoidable.
- **No runtime dependencies** — `package.json` has only `devDependencies`. Keep it that way: the extension ships with zero external packages.
- **Provider pattern** — each language feature lives in its own file under `src/providers/`. Follow the same class-per-file structure.
- **JSDoc on public APIs** — add a JSDoc comment to exported classes and non-obvious functions. Internal helpers don't need one.
- **Regex** — ARM64 parsing relies heavily on regular expressions. Add a comment explaining what a non-obvious pattern matches.

---

## Submitting a Pull Request

1. Fork the repository and create a branch from `main`
2. Make your changes
3. Run `npm run compile` and confirm there are no TypeScript errors
4. Test manually in the Extension Development Host (F5)
5. Open a pull request with a short description of what changed and why

PRs don't need to be perfect.

---

## Reporting Issues

Use GitHub Issues.

A good bug report includes:
- VS Code version
- The `.s` snippet that triggered the problem (if applicable)
- What you expected vs. what happened
