// ============================================================================
// Fixture: one instance of every diagnostic the extension reports.
//
// Each offending line is tagged `// expects: <code>` so `npm test` can compare
// what the analyser found against what the line advertises.
//
// This file is NOT meant to assemble. Every line marked as an error was
// confirmed against aarch64-linux-gnu-as (binutils 2.38) — the assembler
// really does reject it.
// ============================================================================

        .text
        .global lint_errors

// ── Syntax: things GAS refuses outright ─────────────────────────────────────

lint_errors:
        add     sp, sp #16              // expects: arm64/missing-comma
        add,    sp, sp, #16             // expects: arm64/stray-comma
        add     x0,, x1                 // expects: arm64/empty-operand
        ldr     x0, [x1, #8             // expects: arm64/unbalanced-bracket

// ── Style: GAS accepts these, the `#` is optional in AArch64 ────────────────

        add     sp, sp, 16              // expects: arm64/missing-hash
        mov     x0, 1                   // expects: arm64/missing-hash

// ── Symbols: a near miss against a label that does exist ────────────────────

        b       ret_x                   // expects: arm64/unknown-symbol
        ldr     x0, =msgg               // expects: arm64/unknown-symbol
        b       .nowhere                // expects: arm64/unknown-symbol
        mvo     x0, x1                  // expects: arm64/unknown-mnemonic

.ret_x:
        ret

// ── Operand forms: shapes no encoding accepts ───────────────────────────────

        mov     x3, [x4]                // expects: arm64/invalid-operand
        mov     x0, =msg                // expects: arm64/invalid-operand
        str     x0, x1                  // expects: arm64/invalid-operand
        add     x0, w1, x2              // expects: arm64/register-width-mismatch
        cmp     x0, w1                  // expects: arm64/register-width-mismatch
        add     x0, x1                  // expects: arm64/operand-count
        fadd    v0.4s, v1.2d, v2.4s     // expects: arm64/vector-arrangement-mismatch
        ins     v10.s[9], w0            // expects: arm64/lane-out-of-range

// ── Directives from another assembler ───────────────────────────────────────

        .data
value:  dq      5                       // expects: arm64/foreign-directive
count:  dd      1                       // expects: arm64/foreign-directive
buffer: resb    64                      // expects: arm64/foreign-directive
        .quda   0                       // expects: arm64/unknown-directive

// ── Data values of the wrong type or size ───────────────────────────────────

ratio:  .quad   1.56                    // expects: arm64/directive-float-in-int
pi:     .word   3.14                    // expects: arm64/directive-float-in-int
big:    .byte   300                     // expects: arm64/data-truncated
wide:   .hword  70000                   // expects: arm64/data-truncated
        .ascii  hello                   // expects: arm64/directive-needs-string
        .asciz  "sem fechar             // expects: arm64/unterminated-string

msg:    .asciz  "ok"
