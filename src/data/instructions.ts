/**
 * ARM64 / AArch64 instruction documentation.
 *
 * Used by the HoverProvider to display instruction descriptions when the user
 * hovers over a mnemonic in an assembly source file.
 *
 * All keys are lowercase. Conditional branch variants (b.eq, b.ne, …) are
 * stored individually so lookup works after normalising with toLowerCase().
 */

function buildInstructionDocs(): Map<string, string> {
  const m = new Map<string, string>();

  // ─── Data Movement ───────────────────────────────────────────────────────

  m.set("mov",
    `**MOV** — Move\n\n` +
    `Copy a value into a register.\n\n` +
    `\`\`\`asm\n` +
    `MOV Xd, Xn         // register → register\n` +
    `MOV Xd, #imm       // immediate (assembles to MOVZ)\n` +
    `\`\`\`\n` +
    `Register form is an alias for \`ORR Xd, XZR, Xn\`.`);

  m.set("movz",
    `**MOVZ** — Move with Zero\n\n` +
    `Load a 16-bit immediate, zeroing all other bits of the destination.\n\n` +
    `\`\`\`asm\n` +
    `MOVZ Xd, #imm16 {, LSL #shift}   // shift ∈ {0, 16, 32, 48}\n` +
    `\`\`\`\n` +
    `Use with \`MOVK\` to build arbitrary 64-bit constants.`);

  m.set("movk",
    `**MOVK** — Move with Keep\n\n` +
    `Insert a 16-bit immediate into a register, leaving other bits unchanged.\n\n` +
    `\`\`\`asm\n` +
    `MOVK Xd, #imm16 {, LSL #shift}   // shift ∈ {0, 16, 32, 48}\n` +
    `\`\`\`\n` +
    `Typically follows \`MOVZ\` to set remaining 16-bit chunks.`);

  m.set("movn",
    `**MOVN** — Move with NOT\n\n` +
    `Load the bitwise inverse of a 16-bit immediate into the destination.\n\n` +
    `\`\`\`asm\n` +
    `MOVN Xd, #imm16 {, LSL #shift}\n` +
    `\`\`\``);

  m.set("mvn",
    `**MVN** — Bitwise NOT (Move NOT)\n\n` +
    `Copy the bitwise inverse of a register value.\n\n` +
    `\`\`\`asm\n` +
    `MVN Xd, Xm {, shift #amount}\n` +
    `\`\`\`\n` +
    `Alias for \`ORN Xd, XZR, Xm\`.`);

  // ─── Memory ───────────────────────────────────────────────────────────────

  m.set("ldr",
    `**LDR** — Load Register\n\n` +
    `Load a 64-bit (X) or 32-bit (W) value from memory.\n\n` +
    `\`\`\`asm\n` +
    `LDR Xd, [Xn]               // base\n` +
    `LDR Xd, [Xn, #offset]     // base + offset\n` +
    `LDR Xd, [Xn, #off]!       // pre-index  → Xn += off before load\n` +
    `LDR Xd, [Xn], #off        // post-index → Xn += off after load\n` +
    `LDR Xd, =symbol           // pseudo: PC-relative load of address/value\n` +
    `\`\`\``);

  m.set("ldrb",
    `**LDRB** — Load Register Byte\n\n` +
    `Load 1 byte from memory, zero-extended to 32 bits in Wd.\n\n` +
    `\`\`\`asm\n` +
    `LDRB Wd, [Xn {, #offset}]\n` +
    `\`\`\``);

  m.set("ldrh",
    `**LDRH** — Load Register Halfword\n\n` +
    `Load 2 bytes from memory, zero-extended to 32 bits in Wd.\n\n` +
    `\`\`\`asm\n` +
    `LDRH Wd, [Xn {, #offset}]\n` +
    `\`\`\``);

  m.set("ldrsb",
    `**LDRSB** — Load Register Signed Byte\n\n` +
    `Load 1 byte and sign-extend to 32 or 64 bits.\n\n` +
    `\`\`\`asm\n` +
    `LDRSB Xd, [Xn {, #offset}]    // sign-extend to 64 bits\n` +
    `LDRSB Wd, [Xn {, #offset}]    // sign-extend to 32 bits\n` +
    `\`\`\``);

  m.set("ldrsh",
    `**LDRSH** — Load Register Signed Halfword\n\n` +
    `Load 2 bytes and sign-extend to 32 or 64 bits.\n\n` +
    `\`\`\`asm\n` +
    `LDRSH Xd, [Xn {, #offset}]\n` +
    `\`\`\``);

  m.set("ldrsw",
    `**LDRSW** — Load Register Signed Word\n\n` +
    `Load 4 bytes and sign-extend to 64 bits into Xd.\n\n` +
    `\`\`\`asm\n` +
    `LDRSW Xd, [Xn {, #offset}]\n` +
    `\`\`\``);

  m.set("ldp",
    `**LDP** — Load Pair of Registers\n\n` +
    `Load two registers from consecutive memory locations (8 or 16 bytes apart).\n\n` +
    `\`\`\`asm\n` +
    `LDP X0, X1, [Xn]             // base\n` +
    `LDP X0, X1, [Xn, #off]       // base + offset\n` +
    `LDP X29, X30, [sp], #16      // post-index (typical epilog)\n` +
    `LDP X29, X30, [sp, #-16]!    // pre-index\n` +
    `\`\`\``);

  m.set("str",
    `**STR** — Store Register\n\n` +
    `Store a 64-bit (X) or 32-bit (W) register to memory.\n\n` +
    `\`\`\`asm\n` +
    `STR Xd, [Xn]               // base\n` +
    `STR Xd, [Xn, #offset]     // base + offset\n` +
    `STR Xd, [Xn, #off]!       // pre-index\n` +
    `STR Xd, [Xn], #off        // post-index\n` +
    `\`\`\``);

  m.set("strb",
    `**STRB** — Store Register Byte\n\n` +
    `Store the lowest byte of Wd to memory.\n\n` +
    `\`\`\`asm\n` +
    `STRB Wd, [Xn {, #offset}]\n` +
    `\`\`\``);

  m.set("strh",
    `**STRH** — Store Register Halfword\n\n` +
    `Store the lowest 2 bytes of Wd to memory.\n\n` +
    `\`\`\`asm\n` +
    `STRH Wd, [Xn {, #offset}]\n` +
    `\`\`\``);

  m.set("stp",
    `**STP** — Store Pair of Registers\n\n` +
    `Store two registers to consecutive memory locations.\n\n` +
    `\`\`\`asm\n` +
    `STP X29, X30, [sp, #-16]!    // pre-index (typical prolog)\n` +
    `STP X0, X1, [Xn, #off]       // base + offset\n` +
    `\`\`\``);

  m.set("adr",
    `**ADR** — Address (PC-relative)\n\n` +
    `Load the PC-relative address of a label into a register. Range: ±1 MB.\n\n` +
    `\`\`\`asm\n` +
    `ADR Xd, label\n` +
    `\`\`\``);

  m.set("adrp",
    `**ADRP** — Address of Page (PC-relative, 4 KB granule)\n\n` +
    `Load the 4 KB-aligned page base address of a symbol. Range: ±4 GB.\n` +
    `Pair with \`ADD\` or \`LDR\` to reach the exact address.\n\n` +
    `\`\`\`asm\n` +
    `ADRP Xd, :pg_hi21:symbol     // page base → Xd\n` +
    `ADD  Xd, Xd, :lo12:symbol    // add 12-bit page offset\n` +
    `\`\`\``);

  // ─── Arithmetic ───────────────────────────────────────────────────────────

  m.set("add",
    `**ADD** — Add\n\n` +
    `Add two registers or a register and an immediate.\n\n` +
    `\`\`\`asm\n` +
    `ADD Xd, Xn, Xm {, shift #amount}\n` +
    `ADD Xd, Xn, #imm {, LSL #0|12}\n` +
    `\`\`\`\n` +
    `Does **not** set flags. Use \`ADDS\` / \`CMN\` if you need flags.`);

  m.set("adds",
    `**ADDS** — Add, setting flags\n\n` +
    `Same as \`ADD\` but updates NZCV condition flags.\n\n` +
    `\`\`\`asm\n` +
    `ADDS Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("sub",
    `**SUB** — Subtract\n\n` +
    `Subtract a register or immediate from a register.\n\n` +
    `\`\`\`asm\n` +
    `SUB Xd, Xn, Xm {, shift #amount}\n` +
    `SUB Xd, Xn, #imm {, LSL #0|12}\n` +
    `\`\`\`\n` +
    `Does **not** set flags. Use \`SUBS\` / \`CMP\` if you need flags.`);

  m.set("subs",
    `**SUBS** — Subtract, setting flags\n\n` +
    `Same as \`SUB\` but updates NZCV. This is what \`CMP\` assembles to.\n\n` +
    `\`\`\`asm\n` +
    `SUBS Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("mul",
    `**MUL** — Multiply (low 64 bits)\n\n` +
    `Multiply two registers; result is the lower 64 bits.\n\n` +
    `\`\`\`asm\n` +
    `MUL Xd, Xn, Xm\n` +
    `\`\`\`\n` +
    `Alias for \`MADD Xd, Xn, Xm, XZR\`. For the upper 64 bits use \`SMULH\` / \`UMULH\`.`);

  m.set("udiv",
    `**UDIV** — Unsigned Divide\n\n` +
    `Integer division (unsigned); result truncated toward zero.\n\n` +
    `\`\`\`asm\n` +
    `UDIV Xd, Xn, Xm    // Xd = Xn ÷ Xm  (unsigned)\n` +
    `\`\`\`\n` +
    `Division by zero yields 0 — no trap or exception.`);

  m.set("sdiv",
    `**SDIV** — Signed Divide\n\n` +
    `Integer division (signed); result truncated toward zero.\n\n` +
    `\`\`\`asm\n` +
    `SDIV Xd, Xn, Xm    // Xd = Xn ÷ Xm  (signed)\n` +
    `\`\`\`\n` +
    `Division by zero yields 0. INT_MIN ÷ −1 yields INT_MIN — no trap.`);

  m.set("neg",
    `**NEG** — Negate (two's complement)\n\n` +
    `\`\`\`asm\n` +
    `NEG Xd, Xm {, shift #amount}\n` +
    `\`\`\`\n` +
    `Alias for \`SUB Xd, XZR, Xm\`. Use \`NEGS\` to also set flags.`);

  m.set("negs",
    `**NEGS** — Negate, setting flags\n\n` +
    `Same as \`NEG\` but updates NZCV.\n\n` +
    `\`\`\`asm\n` +
    `NEGS Xd, Xm\n` +
    `\`\`\``);

  m.set("cmp",
    `**CMP** — Compare\n\n` +
    `Subtract and set NZCV flags, discarding the result.\n\n` +
    `\`\`\`asm\n` +
    `CMP Xn, Xm {, shift #amount}\n` +
    `CMP Xn, #imm\n` +
    `\`\`\`\n` +
    `Alias for \`SUBS XZR, Xn, Xm\`. Typically followed by a conditional branch.`);

  m.set("cmn",
    `**CMN** — Compare Negative\n\n` +
    `Add and set flags (equivalent to comparing Xn with −Xm).\n\n` +
    `\`\`\`asm\n` +
    `CMN Xn, Xm\n` +
    `CMN Xn, #imm\n` +
    `\`\`\`\n` +
    `Alias for \`ADDS XZR, Xn, Xm\`.`);

  m.set("adc",
    `**ADC** — Add with Carry\n\n` +
    `Add two registers and the Carry flag (C from NZCV). Used for multi-word arithmetic.\n\n` +
    `\`\`\`asm\n` +
    `ADC Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("adcs",
    `**ADCS** — Add with Carry, setting flags\n\n` +
    `Same as \`ADC\` but updates NZCV.\n\n` +
    `\`\`\`asm\n` +
    `ADCS Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("sbc",
    `**SBC** — Subtract with Carry\n\n` +
    `Compute \`Xd = Xn − Xm − (1 − C)\`. Used for multi-word subtraction.\n\n` +
    `\`\`\`asm\n` +
    `SBC Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("madd",
    `**MADD** — Multiply-Add\n\n` +
    `Multiply-accumulate: \`Xd = Xn × Xm + Xa\`.\n\n` +
    `\`\`\`asm\n` +
    `MADD Xd, Xn, Xm, Xa\n` +
    `\`\`\`\n` +
    `\`MUL\` is a convenient alias when Xa = XZR.`);

  m.set("msub",
    `**MSUB** — Multiply-Subtract\n\n` +
    `\`Xd = Xa − Xn × Xm\`.\n\n` +
    `\`\`\`asm\n` +
    `MSUB Xd, Xn, Xm, Xa\n` +
    `\`\`\`\n` +
    `\`MNEG\` is an alias when Xa = XZR.`);

  m.set("clz",
    `**CLZ** — Count Leading Zeros\n\n` +
    `Count leading zero bits; result is 0–64.\n\n` +
    `\`\`\`asm\n` +
    `CLZ Xd, Xn\n` +
    `\`\`\`\n` +
    `Result is 64 when Xn = 0. Useful for finding the position of the highest set bit.`);

  m.set("cls",
    `**CLS** — Count Leading Sign bits\n\n` +
    `Count consecutive bits equal to the MSB, excluding the MSB itself.\n\n` +
    `\`\`\`asm\n` +
    `CLS Xd, Xn\n` +
    `\`\`\``);

  m.set("rev",
    `**REV** — Reverse Bytes\n\n` +
    `Reverse byte order (endian swap).\n\n` +
    `\`\`\`asm\n` +
    `REV Xd, Xn    // 64-bit: swap bytes 0↔7, 1↔6, 2↔5, 3↔4\n` +
    `REV Wd, Wn    // 32-bit: swap bytes 0↔3, 1↔2\n` +
    `\`\`\``);

  m.set("rbit",
    `**RBIT** — Reverse Bits\n\n` +
    `Reverse the bit order of a register (bit 0 ↔ bit 63).\n\n` +
    `\`\`\`asm\n` +
    `RBIT Xd, Xn\n` +
    `\`\`\``);

  // ─── Logical / Shift ─────────────────────────────────────────────────────

  m.set("and",
    `**AND** — Bitwise AND\n\n` +
    `\`\`\`asm\n` +
    `AND Xd, Xn, Xm {, shift #amount}\n` +
    `AND Xd, Xn, #bitmask\n` +
    `\`\`\`\n` +
    `Does **not** set flags. Use \`ANDS\` / \`TST\` to set N and Z flags.`);

  m.set("ands",
    `**ANDS** — Bitwise AND, setting flags\n\n` +
    `Same as \`AND\` but sets N and Z (C and V cleared). This is what \`TST\` assembles to.`);

  m.set("orr",
    `**ORR** — Bitwise OR\n\n` +
    `\`\`\`asm\n` +
    `ORR Xd, Xn, Xm {, shift #amount}\n` +
    `ORR Xd, Xn, #bitmask\n` +
    `\`\`\`\n` +
    `\`MOV Xd, Xn\` is an alias for \`ORR Xd, XZR, Xn\`.`);

  m.set("eor",
    `**EOR** — Bitwise Exclusive OR (XOR)\n\n` +
    `\`\`\`asm\n` +
    `EOR Xd, Xn, Xm {, shift #amount}\n` +
    `EOR Xd, Xn, #bitmask\n` +
    `\`\`\`\n` +
    `Tip: \`EOR Xd, Xd, Xd\` is a (slow) way to zero a register; prefer \`MOV Xd, XZR\`.`);

  m.set("bic",
    `**BIC** — Bit Clear\n\n` +
    `AND Xn with the bitwise NOT of Xm — clears bits selected by Xm.\n\n` +
    `\`\`\`asm\n` +
    `BIC Xd, Xn, Xm {, shift #amount}\n` +
    `\`\`\``);

  m.set("bics",
    `**BICS** — Bit Clear, setting flags\n\n` +
    `Same as \`BIC\` but sets N and Z flags.\n\n` +
    `\`\`\`asm\n` +
    `BICS Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("orn",
    `**ORN** — Bitwise OR NOT\n\n` +
    `OR Xn with the bitwise NOT of Xm.\n\n` +
    `\`\`\`asm\n` +
    `ORN Xd, Xn, Xm {, shift #amount}\n` +
    `\`\`\`\n` +
    `\`MVN Xd, Xn\` is an alias for \`ORN Xd, XZR, Xn\`.`);

  m.set("eon",
    `**EON** — Bitwise Exclusive OR NOT\n\n` +
    `XOR Xn with the bitwise NOT of Xm.\n\n` +
    `\`\`\`asm\n` +
    `EON Xd, Xn, Xm {, shift #amount}\n` +
    `\`\`\``);

  m.set("tst",
    `**TST** — Test bits\n\n` +
    `AND and set N/Z flags, discarding the result.\n\n` +
    `\`\`\`asm\n` +
    `TST Xn, Xm\n` +
    `TST Xn, #bitmask\n` +
    `\`\`\`\n` +
    `Alias for \`ANDS XZR, Xn, Xm\`. Used to check individual bits.`);

  m.set("lsl",
    `**LSL** — Logical Shift Left\n\n` +
    `Shift left; fill vacated bits with 0.\n\n` +
    `\`\`\`asm\n` +
    `LSL Xd, Xn, #shift     // constant (0–63)\n` +
    `LSL Xd, Xn, Xm         // variable (Xm mod 64)\n` +
    `\`\`\`\n` +
    `Equivalent to multiplying by 2^shift (no overflow detection).`);

  m.set("lsr",
    `**LSR** — Logical Shift Right\n\n` +
    `Shift right; fill vacated bits with 0 (unsigned right shift).\n\n` +
    `\`\`\`asm\n` +
    `LSR Xd, Xn, #shift\n` +
    `LSR Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("asr",
    `**ASR** — Arithmetic Shift Right\n\n` +
    `Shift right; fill vacated bits with the sign bit (signed right shift).\n\n` +
    `\`\`\`asm\n` +
    `ASR Xd, Xn, #shift\n` +
    `ASR Xd, Xn, Xm\n` +
    `\`\`\``);

  m.set("ror",
    `**ROR** — Rotate Right\n\n` +
    `Rotate bits right; bits shifted out reappear on the left.\n\n` +
    `\`\`\`asm\n` +
    `ROR Xd, Xn, #shift\n` +
    `ROR Xd, Xn, Xm\n` +
    `\`\`\``);

  // ─── Bit-field ────────────────────────────────────────────────────────────

  m.set("ubfx",
    `**UBFX** — Unsigned Bit-Field Extract\n\n` +
    `Extract a bit-field and zero-extend it.\n\n` +
    `\`\`\`asm\n` +
    `UBFX Xd, Xn, #lsb, #width\n` +
    `\`\`\`\n` +
    `Extracts bits \\[lsb + width − 1 : lsb\\] from Xn, zero-extends to fill Xd.`);

  m.set("sbfx",
    `**SBFX** — Signed Bit-Field Extract\n\n` +
    `Extract a bit-field and sign-extend it.\n\n` +
    `\`\`\`asm\n` +
    `SBFX Xd, Xn, #lsb, #width\n` +
    `\`\`\``);

  m.set("bfi",
    `**BFI** — Bit-Field Insert\n\n` +
    `Insert the low \`width\` bits of Xn into Xd at position \`lsb\`.\n\n` +
    `\`\`\`asm\n` +
    `BFI Xd, Xn, #lsb, #width\n` +
    `\`\`\``);

  // ─── Sign/Zero Extend ─────────────────────────────────────────────────────

  m.set("sxtb",
    `**SXTB** — Sign-Extend Byte\n\n` +
    `Sign-extend bits\\[7:0\\] of Wn into Xd (or Wd).\n\n` +
    `\`\`\`asm\n` +
    `SXTB Xd, Wn\n` +
    `\`\`\``);

  m.set("sxth",
    `**SXTH** — Sign-Extend Halfword\n\n` +
    `Sign-extend bits\\[15:0\\] of Wn into Xd (or Wd).\n\n` +
    `\`\`\`asm\n` +
    `SXTH Xd, Wn\n` +
    `\`\`\``);

  m.set("sxtw",
    `**SXTW** — Sign-Extend Word\n\n` +
    `Sign-extend bits\\[31:0\\] of Wn into Xd.\n\n` +
    `\`\`\`asm\n` +
    `SXTW Xd, Wn\n` +
    `\`\`\``);

  m.set("uxtb",
    `**UXTB** — Zero-Extend Byte\n\n` +
    `Zero-extend bits\\[7:0\\] of Wn into Wd.\n\n` +
    `\`\`\`asm\n` +
    `UXTB Wd, Wn\n` +
    `\`\`\``);

  m.set("uxth",
    `**UXTH** — Zero-Extend Halfword\n\n` +
    `Zero-extend bits\\[15:0\\] of Wn into Wd.\n\n` +
    `\`\`\`asm\n` +
    `UXTH Wd, Wn\n` +
    `\`\`\``);

  // ─── Branch ───────────────────────────────────────────────────────────────

  m.set("b",
    `**B** — Branch (unconditional)\n\n` +
    `Jump to a label without saving a return address. Range: ±128 MB.\n\n` +
    `\`\`\`asm\n` +
    `B label\n` +
    `\`\`\`\n` +
    `For a function call (saves return address in LR), use \`BL\`.`);

  m.set("bl",
    `**BL** — Branch with Link\n\n` +
    `Call a function: branch to label and save return address in \`LR\` (X30). Range: ±128 MB.\n\n` +
    `\`\`\`asm\n` +
    `BL function_name\n` +
    `\`\`\`\n` +
    `The callee returns by executing \`RET\` (branches to LR).`);

  m.set("blr",
    `**BLR** — Branch with Link to Register\n\n` +
    `Call a function via a pointer: branch to address in Xn and save return address in LR.\n\n` +
    `\`\`\`asm\n` +
    `BLR Xn    // call function pointer stored in Xn\n` +
    `\`\`\``);

  m.set("br",
    `**BR** — Branch to Register\n\n` +
    `Unconditional jump to the address in a register. Does **not** modify LR.\n\n` +
    `\`\`\`asm\n` +
    `BR Xn\n` +
    `\`\`\`\n` +
    `Used for tail calls and computed jumps (jump tables).`);

  m.set("ret",
    `**RET** — Return from subroutine\n\n` +
    `Branch to the address in LR (default) or a specified register.\n\n` +
    `\`\`\`asm\n` +
    `RET        // return via LR (X30)\n` +
    `RET Xn     // return via Xn\n` +
    `\`\`\`\n` +
    `Provides a CPU hint that this is a subroutine return (branch predictor).`);

  m.set("cbz",
    `**CBZ** — Compare and Branch if Zero\n\n` +
    `Branch if register equals zero. Does **not** modify NZCV flags. Range: ±1 MB.\n\n` +
    `\`\`\`asm\n` +
    `CBZ Xn, label\n` +
    `\`\`\`\n` +
    `More compact than \`CMP Xn, #0\` + \`B.EQ\`.`);

  m.set("cbnz",
    `**CBNZ** — Compare and Branch if Not Zero\n\n` +
    `Branch if register is not zero. Does **not** modify NZCV flags. Range: ±1 MB.\n\n` +
    `\`\`\`asm\n` +
    `CBNZ Xn, label\n` +
    `\`\`\``);

  m.set("tbz",
    `**TBZ** — Test bit and Branch if Zero\n\n` +
    `Branch if a specific bit is zero. Range: ±32 KB.\n\n` +
    `\`\`\`asm\n` +
    `TBZ Xn, #bit, label    // bit ∈ 0–63\n` +
    `\`\`\``);

  m.set("tbnz",
    `**TBNZ** — Test bit and Branch if Not Zero\n\n` +
    `Branch if a specific bit is set. Range: ±32 KB.\n\n` +
    `\`\`\`asm\n` +
    `TBNZ Xn, #bit, label   // bit ∈ 0–63\n` +
    `\`\`\``);

  // Conditional branch variants
  const condBranches: [string, string, string][] = [
    ["b.eq",  "Equal",                      "Z = 1"],
    ["b.ne",  "Not Equal",                  "Z = 0"],
    ["b.cs",  "Carry Set / Unsigned ≥",     "C = 1"],
    ["b.hs",  "Unsigned Higher or Same",    "C = 1"],
    ["b.cc",  "Carry Clear / Unsigned <",   "C = 0"],
    ["b.lo",  "Unsigned Lower",             "C = 0"],
    ["b.mi",  "Minus / Negative",           "N = 1"],
    ["b.pl",  "Plus / Non-negative",        "N = 0"],
    ["b.vs",  "Overflow",                   "V = 1"],
    ["b.vc",  "No Overflow",                "V = 0"],
    ["b.hi",  "Unsigned Higher",            "C = 1 ∧ Z = 0"],
    ["b.ls",  "Unsigned Lower or Same",     "C = 0 ∨ Z = 1"],
    ["b.ge",  "Signed ≥",                   "N = V"],
    ["b.lt",  "Signed <",                   "N ≠ V"],
    ["b.gt",  "Signed >",                   "Z = 0 ∧ N = V"],
    ["b.le",  "Signed ≤",                   "Z = 1 ∨ N ≠ V"],
    ["b.al",  "Always",                     "true"],
    ["b.nv",  "Never (reserved, avoid)",    "false"],
  ];
  for (const [mnem, label, cond] of condBranches) {
    m.set(mnem,
      `**${mnem.toUpperCase()}** — Branch if ${label}\n\n` +
      `Branch when: \`${cond}\`  ·  Range: ±1 MB\n\n` +
      `\`\`\`asm\n${mnem.toUpperCase()} target_label\n\`\`\`\n\n` +
      `Condition flags are set by \`CMP\`, \`SUBS\`, \`ADDS\`, \`TST\`, \`ANDS\`, etc.`);
  }

  // ─── Conditional Select ───────────────────────────────────────────────────

  m.set("csel",
    `**CSEL** — Conditional Select\n\n` +
    `Branchless select between two registers.\n\n` +
    `\`\`\`asm\n` +
    `CSEL Xd, Xn, Xm, cond    // Xd = (cond) ? Xn : Xm\n` +
    `\`\`\``);

  m.set("cset",
    `**CSET** — Conditional Set\n\n` +
    `Set register to 1 if condition is true, 0 otherwise.\n\n` +
    `\`\`\`asm\n` +
    `CSET Xd, cond             // Xd = (cond) ? 1 : 0\n` +
    `\`\`\`\n` +
    `Alias for \`CSINC Xd, XZR, XZR, invert(cond)\`.`);

  m.set("csetm",
    `**CSETM** — Conditional Set Mask\n\n` +
    `Set all bits to 1 if condition true, all to 0 otherwise.\n\n` +
    `\`\`\`asm\n` +
    `CSETM Xd, cond            // Xd = (cond) ? −1 : 0\n` +
    `\`\`\``);

  m.set("cinc",
    `**CINC** — Conditional Increment\n\n` +
    `\`\`\`asm\n` +
    `CINC Xd, Xn, cond         // Xd = (cond) ? Xn+1 : Xn\n` +
    `\`\`\``);

  m.set("cinv",
    `**CINV** — Conditional Invert\n\n` +
    `\`\`\`asm\n` +
    `CINV Xd, Xn, cond         // Xd = (cond) ? ~Xn : Xn\n` +
    `\`\`\``);

  m.set("cneg",
    `**CNEG** — Conditional Negate\n\n` +
    `\`\`\`asm\n` +
    `CNEG Xd, Xn, cond         // Xd = (cond) ? −Xn : Xn\n` +
    `\`\`\``);

  m.set("csinc",
    `**CSINC** — Conditional Select Increment\n\n` +
    `\`\`\`asm\n` +
    `CSINC Xd, Xn, Xm, cond   // Xd = (cond) ? Xn : Xm+1\n` +
    `\`\`\``);

  m.set("csinv",
    `**CSINV** — Conditional Select Invert\n\n` +
    `\`\`\`asm\n` +
    `CSINV Xd, Xn, Xm, cond   // Xd = (cond) ? Xn : ~Xm\n` +
    `\`\`\``);

  m.set("csneg",
    `**CSNEG** — Conditional Select Negate\n\n` +
    `\`\`\`asm\n` +
    `CSNEG Xd, Xn, Xm, cond   // Xd = (cond) ? Xn : −Xm\n` +
    `\`\`\``);

  m.set("ccmp",
    `**CCMP** — Conditional Compare\n\n` +
    `If condition is true, set NZCV from \`Xn − Xm\`; otherwise load NZCV from the immediate.\n\n` +
    `\`\`\`asm\n` +
    `CCMP Xn, Xm, #nzcv, cond\n` +
    `CCMP Xn, #imm, #nzcv, cond\n` +
    `\`\`\`\n` +
    `Useful for chained comparisons without extra branches.`);

  m.set("ccmn",
    `**CCMN** — Conditional Compare Negative\n\n` +
    `If condition is true, set NZCV from \`Xn + Xm\`; otherwise load NZCV from the immediate.\n\n` +
    `\`\`\`asm\n` +
    `CCMN Xn, Xm, #nzcv, cond\n` +
    `\`\`\``);

  // ─── System ───────────────────────────────────────────────────────────────

  m.set("svc",
    `**SVC** — Supervisor Call\n\n` +
    `Generate a synchronous exception to EL1 (kernel). Used for **Linux system calls**.\n\n` +
    `\`\`\`asm\n` +
    `// Linux AArch64 syscall convention:\n` +
    `// x8      = syscall number\n` +
    `// x0–x5   = arguments (up to 6)\n` +
    `// x0      = return value (negative = errno)\n` +
    `MOV x8, #93     // __NR_exit\n` +
    `MOV x0, #0      // exit code\n` +
    `SVC #0\n` +
    `\`\`\``);

  m.set("nop",
    `**NOP** — No Operation\n\n` +
    `Does nothing; advances PC by 4 bytes.\n\n` +
    `Used for alignment, timing, pipeline padding, or as a patchable placeholder.`);

  m.set("mrs",
    `**MRS** — Move to Register from System register\n\n` +
    `Read a system/special-purpose register into a general-purpose register.\n\n` +
    `\`\`\`asm\n` +
    `MRS Xd, sysreg    // e.g. MRS X0, NZCV\n` +
    `\`\`\``);

  m.set("msr",
    `**MSR** — Move to System register from Register\n\n` +
    `Write a GPR or immediate to a system/special-purpose register.\n\n` +
    `\`\`\`asm\n` +
    `MSR sysreg, Xn       // e.g. MSR DAIFSET, #2\n` +
    `MSR sysreg, #imm\n` +
    `\`\`\``);

  m.set("isb",
    `**ISB** — Instruction Synchronization Barrier\n\n` +
    `Flush the pipeline; instructions after ISB are fetched fresh from memory/cache.\n\n` +
    `\`\`\`asm\n` +
    `ISB       // alias for ISB SY\n` +
    `ISB SY\n` +
    `\`\`\`\n` +
    `Required after writing system registers (e.g., enabling the MMU) to ensure the new state takes effect.`);

  m.set("dsb",
    `**DSB** — Data Synchronization Barrier\n\n` +
    `Ensure all prior memory accesses complete before any subsequent instructions execute.\n\n` +
    `\`\`\`asm\n` +
    `DSB SY     // full system\n` +
    `DSB ISH    // inner shareable domain\n` +
    `DSB NSH    // non-shareable\n` +
    `DSB OSH    // outer shareable\n` +
    `\`\`\``);

  m.set("dmb",
    `**DMB** — Data Memory Barrier\n\n` +
    `Enforce memory access ordering without waiting for completion.\n\n` +
    `\`\`\`asm\n` +
    `DMB SY     // full system ordering\n` +
    `DMB ISH    // inner shareable\n` +
    `\`\`\``);

  m.set("wfi",
    `**WFI** — Wait For Interrupt\n\n` +
    `Suspend the processor until an interrupt or event occurs. Saves power in idle loops.\n\n` +
    `\`\`\`asm\n` +
    `WFI\n` +
    `\`\`\``);

  m.set("wfe",
    `**WFE** — Wait For Event\n\n` +
    `Suspend until a \`SEV\` from another core or an external event is received.\n\n` +
    `\`\`\`asm\n` +
    `WFE\n` +
    `\`\`\``);

  m.set("sev",
    `**SEV** — Send Event\n\n` +
    `Signal an event to all cores in the shareability domain (wakes \`WFE\`-waiting cores).\n\n` +
    `\`\`\`asm\n` +
    `SEV\n` +
    `\`\`\``);

  m.set("sevl",
    `**SEVL** — Send Event Local\n\n` +
    `Signal a local event only to the current PE (wakes a local \`WFE\`).\n\n` +
    `\`\`\`asm\n` +
    `SEVL\n` +
    `\`\`\``);

  m.set("yield",
    `**YIELD** — Yield hint\n\n` +
    `Hint to the CPU that the current thread is in a spin-wait loop and can yield resources.\n\n` +
    `\`\`\`asm\n` +
    `YIELD\n` +
    `\`\`\``);

  m.set("brk",
    `**BRK** — Breakpoint\n\n` +
    `Generate a debug breakpoint exception. The immediate is passed to the debugger.\n\n` +
    `\`\`\`asm\n` +
    `BRK #imm16\n` +
    `\`\`\``);

  m.set("hlt",
    `**HLT** — Halt\n\n` +
    `Generate a debug halt exception (used by debuggers as a software breakpoint).\n\n` +
    `\`\`\`asm\n` +
    `HLT #imm16\n` +
    `\`\`\``);

  m.set("eret",
    `**ERET** — Exception Return\n\n` +
    `Return from an exception handler: restore PC from \`ELR_ELn\` and PSTATE from \`SPSR_ELn\`.\n\n` +
    `\`\`\`asm\n` +
    `ERET\n` +
    `\`\`\`\n` +
    `Used at the end of interrupt / exception handlers.`);

  m.set("hvc",
    `**HVC** — Hypervisor Call\n\n` +
    `Generate a synchronous exception to EL2 (hypervisor).\n\n` +
    `\`\`\`asm\n` +
    `HVC #imm16\n` +
    `\`\`\``);

  m.set("smc",
    `**SMC** — Secure Monitor Call\n\n` +
    `Generate a synchronous exception to EL3 (secure monitor / TrustZone).\n\n` +
    `\`\`\`asm\n` +
    `SMC #imm16\n` +
    `\`\`\``);

  // ─── Atomic (LSE) ─────────────────────────────────────────────────────────

  m.set("cas",
    `**CAS** — Compare and Swap (LSE atomic)\n\n` +
    `Atomically compare a register with a memory location; swap if equal.\n\n` +
    `\`\`\`asm\n` +
    `CAS Xs, Xt, [Xn]  // if mem[Xn] == Xs: mem[Xn] = Xt, else Xs = mem[Xn]\n` +
    `\`\`\`\n` +
    `Requires ARMv8.1 LSE extension (\`+lse\` in \`.arch\` directive).`);

  m.set("ldadd",
    `**LDADD** — Load and Add (LSE atomic)\n\n` +
    `Atomically add to a memory location and return the old value.\n\n` +
    `\`\`\`asm\n` +
    `LDADD Xs, Xt, [Xn]  // Xt = old mem[Xn];  mem[Xn] += Xs\n` +
    `\`\`\``);

  return m;
}

export const INSTRUCTION_DOCS = buildInstructionDocs();
