// ─────────────────────────────────────────────────────────────────────────────
// Floating-point and SIMD/NEON hover showcase.
//
// Hover any mnemonic for its operand forms and caveats, and any vector operand
// (v1.4s, v0.2d, v3.s[0]) for its lane layout.
// ─────────────────────────────────────────────────────────────────────────────

    .arch armv8-a
    .text

// ── Scalar floating-point ────────────────────────────────────────────────────

// float scale(float x, float lo, float hi) — clamp x to [lo, hi]
    .global scale
    .type   scale, %function
scale:
    fmax    s0, s0, s1          // hover fmax  → NaN propagates
    fmin    s0, s0, s2          // hover fmin
    ret
    .size   scale, . - scale

// int compare(double a, double b) — -1 / 0 / 1, NaN-safe
    .global compare
    .type   compare, %function
compare:
    fcmp    d0, d1              // hover fcmp → NZCV + FP condition-code table
    b.mi    .Lless              // MI is the NaN-safe "less than"
    b.gt    .Lgreater
    mov     w0, #0
    ret
.Lless:
    mov     w0, #-1
    ret
.Lgreater:
    mov     w0, #1
    ret
    .size   compare, . - compare

// long trunc_to_int(double x)
    .global trunc_to_int
    .type   trunc_to_int, %function
trunc_to_int:
    fcvtzs  x0, d0              // hover fcvtzs → rounds toward zero, saturates
    ret
    .size   trunc_to_int, . - trunc_to_int

// double from_int(long n)
    .global from_int
    .type   from_int, %function
from_int:
    scvtf   d0, x0              // hover scvtf → inverse of fcvtzs
    fsqrt   d0, d0
    frintm  d0, d0              // hover frintm → floor()
    ret
    .size   from_int, . - from_int

// ── Vector: dot product of 4 floats ──────────────────────────────────────────

// float dot4(const float *a, const float *b)
    .global dot4
    .type   dot4, %function
dot4:
    movi    v0.16b, #0          // hover movi   → the idiom for zeroing a vector
    ldr     q1, [x0]            // hover ldr    → SIMD/FP form, 16 bytes
    ldr     q2, [x1]
    fmla    v0.4s, v1.4s, v2.4s // hover v0.4s  → 4 lanes × 32 bits, bit ranges
                                // hover fmla   → warns v0 is read-modify-write
    faddp   v0.4s, v0.4s, v0.4s // hover faddp  → pairwise horizontal add
    faddp   s0, v0.2s           // hover v0.2s  → lower 64 bits only
    ret
    .size   dot4, . - dot4

// ── Vector: lane addressing ──────────────────────────────────────────────────

// void build(long *out, int a, int b)
    .global build
    .type   build, %function
build:
    dup     v1.4s, w1           // hover dup      → broadcast a GPR
    ins     v3.s[0], w1         // hover v3.s[0]  → one 32-bit lane, bits 31:0
    ins     v3.s[3], w2         // hover v3.s[3]  → bits 127:96
    umov    w3, v3.s[3]         // hover umov     → zero-extending lane extract
    smov    x4, v3.s[0]         // hover smov     → sign-extending lane extract
    mov     v4.16b, v3.16b      // hover mov      → scalar doc, then vector form
    str     q4, [x0]
    ret
    .size   build, . - build

// ── Vector: de-interleaving load, widening, comparison masks ─────────────────

// void rgb_to_gray(const unsigned char *rgb, unsigned char *out)
    .global rgb_to_gray
    .type   rgb_to_gray, %function
rgb_to_gray:
    ld3     {v0.16b, v1.16b, v2.16b}, [x0]  // hover ld3   → 3-way de-interleave
                                            // hover v0.16b → 16 lanes × 8 bits
    ushll   v3.8h, v0.8b, #0    // hover ushll  → widen the lower half
    ushll2  v4.8h, v0.16b, #0   // hover ushll2 → widen the upper half
    uaddlv  h5, v0.16b          // hover uaddlv → horizontal sum, no overflow
    cmeq    v6.16b, v1.16b, v2.16b   // hover cmeq → all-ones / all-zeros mask
    and     v7.16b, v0.16b, v6.16b   // hover and  → apply the mask
    bsl     v6.16b, v1.16b, v2.16b   // hover bsl  → mask register is destroyed
    uqxtn   v8.8b, v3.8h        // hover uqxtn  → saturating narrow
    st1     {v8.8b}, [x1]       // hover st1
    ret
    .size   rgb_to_gray, . - rgb_to_gray

// ── Edge cases the hover should handle gracefully ────────────────────────────

    .global edge_cases
    .type   edge_cases, %function
edge_cases:
    fmov    d0, #1.0            // hover #1.0 stays a numeric hover
    mov     x1, #0x2A           // hover #0x2A → decimal/hex/binary/octal table
    movi    v0.2d, #0           // hover v0.2d → 2 lanes × 64 bits
    add     v1.2d, v1.2d, v0.2d // hover add   → scalar doc + vector form
    ret
    .size   edge_cases, . - edge_cases
