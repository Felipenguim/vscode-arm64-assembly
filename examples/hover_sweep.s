// ═══════════════════════════════════════════════════════════════════════════
// Hover sweep — passe o mouse em cada mnemônico e em cada operando vetorial.
// ═══════════════════════════════════════════════════════════════════════════

    .text
sweep:

// ── 1. Arranjos de lane: todos os 9 ────────────────────────────────────────
    movi    v0.16b, #0
    movi    v1.8b,  #0
    movi    v2.8h,  #0
    movi    v3.4h,  #0
    movi    v4.4s,  #0
    movi    v5.2s,  #0
    movi    v6.2d,  #0
    movi    v7.1d,  #0
    pmull   v8.1q,  v0.1d, v1.1d    // pmull ficou fora do escopo escolhido:
                                    // só v8.1q tem hover aqui, o mnemônico não

// ── 2. Índices de lane: cada tamanho + fora de faixa ───────────────────────
    ins     v10.b[15], w0
    ins     v10.h[7],  w0
    ins     v10.s[3],  w0
    ins     v10.d[1],  x0
    umov    w1, v10.s[0]
    smov    x2, v10.h[2]
    dup     v11.4s, v10.s[2]
    fmul    v12.4s, v11.4s, v10.s[1]
    ins     v10.s[9], w0            // fora de faixa → deve avisar

// ── 3. FP escalar: aritmética ──────────────────────────────────────────────
    fmov    d0, #1.0
    fmov    x3, d0
    fadd    d1, d0, d0
    fsub    d2, d1, d0
    fmul    d3, d1, d2
    fdiv    d4, d3, d1
    fneg    d5, d4
    fabs    d6, d5
    fsqrt   d7, d6
    fnmul   d8, d1, d2
    fmadd   d9,  d1, d2, d3
    fmsub   d10, d1, d2, d3
    fnmadd  d11, d1, d2, d3
    fnmsub  d12, d1, d2, d3

// ── 4. FP: min/max e arredondamento ────────────────────────────────────────
    fmax    d13, d1, d2
    fmin    d14, d1, d2
    fmaxnm  d15, d1, d2
    fminnm  d16, d1, d2
    fmaxv   s17, v4.4s
    fminv   s18, v4.4s
    frinta  d19, d1
    frinti  d20, d1
    frintm  d21, d1
    frintn  d22, d1
    frintp  d23, d1
    frintx  d24, d1
    frintz  d25, d1
    frecpe  d26, d1
    frsqrte d27, d1

// ── 5. FP: comparação e seleção ────────────────────────────────────────────
    fcmp    d0, d1
    fcmp    d0, #0.0
    fcmpe   d0, d1
    fccmp   d0, d1, #0, ne
    fcsel   d28, d0, d1, mi

// ── 6. Conversões ──────────────────────────────────────────────────────────
    fcvt    s0, d0
    fcvtl   v13.4s, v2.4h
    fcvtl2  v14.4s, v2.8h
    fcvtn   v15.4h, v13.4s
    fcvtn2  v16.8h, v13.4s
    fcvtas  w4, s0
    fcvtau  w5, s0
    fcvtms  w6, s0
    fcvtmu  w7, s0
    fcvtns  w8, s0
    fcvtnu  w9, s0
    fcvtps  w10, s0
    fcvtpu  w11, s0
    fcvtzs  w12, s0
    fcvtzu  w13, s0
    scvtf   s1, w12
    ucvtf   s2, w13

// ── 7. FP/SIMD: multiply-accumulate ────────────────────────────────────────
    fmla    v17.4s, v4.4s, v11.4s
    fmls    v18.4s, v4.4s, v11.4s
    fmulx   v19.4s, v4.4s, v11.4s
    faddp   v20.4s, v4.4s, v11.4s
    faddp   s21, v4.2s
    mla     v22.4s, v4.4s, v11.4s
    mls     v23.4s, v4.4s, v11.4s

// ── 8. SIMD: movimento de dados e permutação ───────────────────────────────
    mvni    v24.4s, #0
    ext     v25.16b, v0.16b, v1.16b, #4
    tbl     v26.16b, {v0.16b}, v10.16b
    tbx     v27.16b, {v0.16b, v1.16b}, v10.16b
    zip1    v28.4s, v4.4s, v11.4s
    zip2    v29.4s, v4.4s, v11.4s
    uzp1    v30.4s, v4.4s, v11.4s
    uzp2    v31.4s, v4.4s, v11.4s
    trn1    v0.4s,  v4.4s, v11.4s
    trn2    v1.4s,  v4.4s, v11.4s
    rev16   v2.16b, v0.16b
    rev32   v3.16b, v0.16b
    rev64   v4.4s,  v0.4s

// ── 9. SIMD: aritmética inteira e reduções ─────────────────────────────────
    abs     v5.4s, v0.4s
    addp    v6.4s, v0.4s, v1.4s
    addv    s7, v0.4s
    saddlv  h8, v0.16b
    uaddlv  h9, v0.16b
    saddl   v10.4s, v0.4h, v1.4h
    saddl2  v11.4s, v0.8h, v1.8h
    uaddl   v12.4s, v0.4h, v1.4h
    uaddl2  v13.4s, v0.8h, v1.8h
    smull   v14.4s, v0.4h, v1.4h
    smull2  v15.4s, v0.8h, v1.8h
    umull   v16.4s, v0.4h, v1.4h
    umull2  v17.4s, v0.8h, v1.8h
    sabd    v18.16b, v0.16b, v1.16b
    uabd    v19.16b, v0.16b, v1.16b
    smax    v20.4s, v0.4s, v1.4s
    smin    v21.4s, v0.4s, v1.4s
    umax    v22.4s, v0.4s, v1.4s
    umin    v23.4s, v0.4s, v1.4s
    smaxv   s24, v0.4s
    sminv   s25, v0.4s
    umaxv   b26, v0.16b
    uminv   b27, v0.16b
    sqadd   v28.16b, v0.16b, v1.16b
    uqadd   v29.16b, v0.16b, v1.16b
    sqsub   v30.16b, v0.16b, v1.16b
    uqsub   v31.16b, v0.16b, v1.16b

// ── 10. SIMD: comparação (máscaras) ────────────────────────────────────────
    cmeq    v0.4s, v1.4s, v2.4s
    cmge    v1.4s, v1.4s, v2.4s
    cmgt    v2.4s, v1.4s, v2.4s
    cmhi    v3.4s, v1.4s, v2.4s
    cmhs    v4.4s, v1.4s, v2.4s
    cmle    v5.4s, v1.4s, #0
    cmlt    v6.4s, v1.4s, #0
    cmtst   v7.4s, v1.4s, v2.4s
    fcmeq   v8.4s,  v1.4s, v2.4s
    fcmge   v9.4s,  v1.4s, v2.4s
    fcmgt   v10.4s, v1.4s, v2.4s
    fcmle   v11.4s, v1.4s, #0.0
    fcmlt   v12.4s, v1.4s, #0.0

// ── 11. SIMD: lógica ───────────────────────────────────────────────────────
    not     v13.16b, v0.16b
    bsl     v14.16b, v0.16b, v1.16b
    bit     v15.16b, v0.16b, v1.16b
    bif     v16.16b, v0.16b, v1.16b

// ── 12. SIMD: shifts, alargamento e estreitamento ──────────────────────────
    shl     v17.4s, v0.4s, #3
    sshr    v18.4s, v0.4s, #2
    ushr    v19.4s, v0.4s, #8
    srshr   v20.4s, v0.4s, #8
    urshr   v21.8h, v0.8h, #4
    sli     v22.4s, v0.4s, #8
    sri     v23.4s, v0.4s, #8
    sshll   v24.8h, v0.8b,  #0
    sshll2  v25.8h, v0.16b, #0
    ushll   v26.8h, v0.8b,  #0
    ushll2  v27.8h, v0.16b, #0
    xtn     v28.8b,  v2.8h
    xtn2    v29.16b, v2.8h
    sqxtn   v30.8b,  v2.8h
    uqxtn   v31.8b,  v2.8h
    sqxtun  v0.8b,   v2.8h
    shrn    v1.8b,   v2.8h, #8
    shrn2   v2.16b,  v3.8h, #8

// ── 13. SIMD: load/store com de-interleaving ───────────────────────────────
    ld1     {v0.4s}, [x0]
    ld2     {v0.4s, v1.4s}, [x0]
    ld3     {v0.16b, v1.16b, v2.16b}, [x0]
    ld4     {v0.4s, v1.4s, v2.4s, v3.4s}, [x0]
    ld1r    {v4.4s}, [x0]
    st1     {v0.4s}, [x1]
    st2     {v0.4s, v1.4s}, [x1]
    st3     {v0.16b, v1.16b, v2.16b}, [x1]
    st4     {v0.4s, v1.4s, v2.4s, v3.4s}, [x1]

// ── 14. Mnemônicos compartilhados: escalar + forma vetorial ────────────────
    add     v0.4s, v1.4s, v2.4s
    sub     v1.4s, v1.4s, v2.4s
    mul     v2.4s, v1.4s, v2.4s
    neg     v3.4s, v1.4s
    mov     v4.16b, v0.16b
    and     v5.16b, v0.16b, v1.16b
    orr     v6.16b, v0.16b, v1.16b
    eor     v7.16b, v0.16b, v1.16b
    bic     v8.16b, v0.16b, v1.16b
    orn     v9.16b, v0.16b, v1.16b
    ldr     q10, [x0]
    str     q10, [x1]
    ldp     q11, q12, [x0]
    stp     q11, q12, [x1]

// ── 15. Regressão: o que já funcionava não pode ter quebrado ───────────────
    mov     x0, #0x2A               // literal → tabela dec/hex/bin/oct
    mov     x1, #0644
    mov     x2, #0b1010
    ldr     x3, [sp, #16]           // sp, x3 → hover de registrador
    b.eq    sweep                   // branch condicional
    mrs     x4, nzcv                // registrador de sistema
    svc     #0
    ret
