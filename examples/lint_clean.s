// ============================================================================
// Fixture: correct code that exercises every known false-positive trap.
//
// The analyser must report NOTHING here. This is the more important of the two
// lint fixtures — a linter that misses a bug is annoying, one that cries wolf
// on working code gets turned off.
//
// Verified with: aarch64-linux-gnu-as -o /dev/null examples/lint_clean.s
// ============================================================================

        .arch armv8-a
        .text
        .global lint_clean
        .type   lint_clean, %function

/* A block comment
   spanning several lines, containing  mov x0, #999  which must be ignored,
   and closing here. */

// ── Macros: `\param` substitutes arbitrary text, so nothing can be asserted ──
// Note the parameter list is space-separated after the name — not a missing comma.

        .macro  _write fd, buf, len
        mov     x0, \fd
        mov     x1, \buf
        mov     x2, \len
        mov     x8, #64
        svc     #0
        .endm

// ── Directives in upper case, as GAS allows ─────────────────────────────────

        .EQU    SYS_EXIT, 93
        .EQU    PERM, 0644

lint_clean:
        stp     x29, x30, [sp, #-16]!   // pre-index write-back
        mov     x29, sp

        // Shift and extend suffixes are separate operands, not missing commas
        add     x0, x1, x2, lsl #3
        add     x0, x1, w2, uxtw #2
        sub     x3, x4, x5, asr #1

        // Post-index is two operands; the bracketed part stays whole
        ldr     x6, [x7], #8
        ldr     x8, [x9, x10, lsl #3]
        str     xzr, [sp, #8]

        // Register list, arrangement and lane index all within range
        ld1     {v0.16b, v1.16b}, [x11]
        fadd    v2.4s, v3.4s, v4.4s
        ins     v5.s[3], w12
        umov    w13, v5.s[3]


        // Extended-register form: the extend operator sets the source width,
        // so a `w` register beside an `x` destination is correct here
        add     x0, x1, w2, uxtw #2
        add     x3, sp, x3
        sub     sp, sp, #16
        add     sp, sp, #16

        // An assemble-time constant is a perfectly good immediate
        mov     w8, #SYS_EXIT
        mov     w9, SYS_EXIT
        mov     x10, PERM

        // FCVT converts between sizes, so its operands differ on purpose
        fcvt    s16, d17
        scvtf   d18, x19

        // By-element SIMD, and a lane index at the top of its range
        fmul    v6.4s, v7.4s, v8.s[1]
        movi    v9.16b, #0
        umov    w20, v5.s[3]

        // RET takes an optional register
        ret     x30

        // Instructions with no operands at all
        nop
        ret

// ── Local labels and a numeric local label ──────────────────────────────────

.Lloop:
        subs    x14, x14, #1
        b.ne    .Lloop
1:
        cbz     x15, 1b

        .size   lint_clean, . - lint_clean

// ── Symbol assignment and expressions ───────────────────────────────────────

        .data
msg:    .asciz  "um // que nao e comentario, e um @ tambem nao"
msg_end:
len     = msg_end - msg
        .word   msg_end - msg
        .quad   msg

// ── Data values that are legal ──────────────────────────────────────────────

        .byte   0x7f, 0x45, 0x4c, 0x46
        .byte   -128
        .hword  65535
        .word   0xFFFFFFFF
        .quad   0x1122334455667788
        .double 5                       // an integer in a float directive is fine
        .float  2.5
        .octa   0
