/**
 * ARM64 / AArch64 register documentation.
 *
 * Used by the HoverProvider to display register descriptions when the user
 * hovers over a register name in an assembly source file.
 *
 * All keys are lowercase so lookup is case-insensitive after calling
 * `word.toLowerCase()`.
 */

function buildRegisterDocs(): Map<string, string> {
  const m = new Map<string, string>();

  // ─── 64-bit general-purpose registers (x0–x30) ───────────────────────────

  m.set("x0",  "**64-bit GPR** | Argument 1 / return value (AArch64 ABI). Caller-saved.");
  m.set("x1",  "**64-bit GPR** | Argument 2 / secondary return value. Caller-saved.");
  m.set("x2",  "**64-bit GPR** | Argument 3. Caller-saved.");
  m.set("x3",  "**64-bit GPR** | Argument 4. Caller-saved.");
  m.set("x4",  "**64-bit GPR** | Argument 5. Caller-saved.");
  m.set("x5",  "**64-bit GPR** | Argument 6. Caller-saved.");
  m.set("x6",  "**64-bit GPR** | Argument 7. Caller-saved.");
  m.set("x7",  "**64-bit GPR** | Argument 8. Caller-saved.");
  m.set("x8",  "**64-bit GPR** | Indirect result location / **Linux syscall number**. Caller-saved.");
  m.set("x9",  "**64-bit GPR** | Temporary. Caller-saved.");
  m.set("x10", "**64-bit GPR** | Temporary. Caller-saved.");
  m.set("x11", "**64-bit GPR** | Temporary. Caller-saved.");
  m.set("x12", "**64-bit GPR** | Temporary. Caller-saved.");
  m.set("x13", "**64-bit GPR** | Temporary. Caller-saved.");
  m.set("x14", "**64-bit GPR** | Temporary. Caller-saved.");
  m.set("x15", "**64-bit GPR** | Temporary. Caller-saved.");
  m.set("x16", "**64-bit GPR** | IP0 — intra-procedure-call scratch register. Used by PLT/veneers. Caller-saved.");
  m.set("x17", "**64-bit GPR** | IP1 — intra-procedure-call scratch register. Used by PLT/veneers. Caller-saved.");
  m.set("x18", "**64-bit GPR** | Platform register (reserved by OS on some platforms, e.g. shadow stack on Windows). Caller-saved.");
  m.set("x19", "**64-bit GPR** | Callee-saved. Must be preserved across function calls.");
  m.set("x20", "**64-bit GPR** | Callee-saved.");
  m.set("x21", "**64-bit GPR** | Callee-saved.");
  m.set("x22", "**64-bit GPR** | Callee-saved.");
  m.set("x23", "**64-bit GPR** | Callee-saved.");
  m.set("x24", "**64-bit GPR** | Callee-saved.");
  m.set("x25", "**64-bit GPR** | Callee-saved.");
  m.set("x26", "**64-bit GPR** | Callee-saved.");
  m.set("x27", "**64-bit GPR** | Callee-saved.");
  m.set("x28", "**64-bit GPR** | Callee-saved.");
  m.set("x29", "**64-bit GPR** | Frame pointer (FP). Callee-saved. Alias: `fp`.");
  m.set("x30", "**64-bit GPR** | Link register (LR). Holds return address set by `BL`/`BLR`. Alias: `lr`.");

  // ─── 32-bit views (w0–w30) ───────────────────────────────────────────────
  // Writing a Wn register zeroes the upper 32 bits of the corresponding Xn.

  const w32_abi: Record<number, string> = {
    0: "Argument 1 / return value.",
    1: "Argument 2 / secondary return value.",
    2: "Argument 3.",
    3: "Argument 4.",
    4: "Argument 5.",
    5: "Argument 6.",
    6: "Argument 7.",
    7: "Argument 8.",
    8: "Indirect result / Linux syscall number.",
    16: "IP0 (intra-procedure-call scratch).",
    17: "IP1 (intra-procedure-call scratch).",
    29: "Frame pointer (FP).",
    30: "Link register (LR).",
  };
  for (let i = 0; i <= 30; i++) {
    const abi = w32_abi[i] ?? (i >= 19 ? "Callee-saved." : "Caller-saved.");
    m.set(`w${i}`, `**32-bit view of x${i}**. Writing zeroes the upper 32 bits of x${i}. ${abi}`);
  }

  // ─── Special / aliased registers ─────────────────────────────────────────

  m.set("sp",  "**Stack pointer**. Must be 16-byte aligned at all public interfaces (AArch64 ABI).");
  m.set("lr",  "**Link register** — alias for `x30`. Holds the return address after `BL`/`BLR`.");
  m.set("fp",  "**Frame pointer** — alias for `x29`. Callee-saved.");
  m.set("xzr", "**64-bit zero register**. Reads always return 0; writes are silently discarded.");
  m.set("wzr", "**32-bit zero register**. Reads always return 0; writes are silently discarded.");
  m.set("wsp", "**32-bit stack pointer view**. Used in 32-bit addressing contexts.");
  m.set("pc",  "**Program counter**. Not directly accessible as a GPR in AArch64 (unlike AArch32).");

  // ─── FP/SIMD numbered registers (q, v, d, s, h, b — 0..31) ──────────────
  //
  // ABI: q0–q7 caller-saved (full 128 bits).
  //      q8–q15 callee-saved (only the lower 64 bits d8–d15 need preservation).
  //      q16–q31 caller-saved (full 128 bits).

  for (let i = 0; i <= 31; i++) {
    let abiNote: string;
    if (i <= 7) {
      abiNote = `Argument/return register (AAPCS64 SIMD). Caller-saved (full 128 bits).`;
    } else if (i <= 15) {
      abiNote = `Callee-saved — only the lower 64 bits (d${i}) must be preserved across calls.`;
    } else {
      abiNote = `Caller-saved (full 128 bits).`;
    }

    m.set(`q${i}`, `**128-bit SIMD/FP register** (same physical register as v${i}). ${abiNote}`);
    m.set(`v${i}`, `**128-bit vector register** (same physical register as q${i}). ` +
      `Element arrangements: \`.8b\` \`.16b\` \`.4h\` \`.8h\` \`.2s\` \`.4s\` \`.1d\` \`.2d\`. ${abiNote}`);
    m.set(`d${i}`, `**64-bit FP scalar** — lower 64 bits of v${i}/q${i}. Double-precision. ${abiNote}`);
    m.set(`s${i}`, `**32-bit FP scalar** — bits\\[31:0\\] of v${i}/q${i}. Single-precision. ${abiNote}`);
    m.set(`h${i}`, `**16-bit FP scalar** — bits\\[15:0\\] of v${i}/q${i}. Half-precision (FP16). ${abiNote}`);
    m.set(`b${i}`, `**8-bit scalar** — bits\\[7:0\\] of v${i}/q${i}. ${abiNote}`);
  }

  // ─── System / special-purpose registers ──────────────────────────────────

  m.set("nzcv",        "**Condition flags**: N (Negative), Z (Zero), C (Carry), V (Overflow). Read/write via `MRS`/`MSR`.");
  m.set("daif",        "**Interrupt mask bits**: D (Debug), A (SError), I (IRQ), F (FIQ). Set with `MSR DAIFSET/DAIFCLR`.");
  m.set("fpsr",        "**FP status register** — cumulative FP exception flags (IOC, DZC, OFC, UFC, IXC, IDC).");
  m.set("fpcr",        "**FP control register** — rounding mode (RMode), FP exception enable bits, flush-to-zero.");
  m.set("spsel",       "**Stack pointer selector**: 0 = use SP_EL0, 1 = use SP_ELn (current EL's stack pointer).");
  m.set("currentel",   "**Current exception level** — EL0–EL3 encoded in bits\\[3:2\\]. Read-only.");
  m.set("elr_el1",     "**Exception link register EL1** — return address after an exception taken to EL1.");
  m.set("elr_el2",     "**Exception link register EL2** — return address after an exception taken to EL2.");
  m.set("elr_el3",     "**Exception link register EL3** — return address after an exception taken to EL3.");
  m.set("spsr_el1",    "**Saved PSTATE EL1** — processor state saved when an exception is taken to EL1.");
  m.set("spsr_el2",    "**Saved PSTATE EL2** — processor state saved when an exception is taken to EL2.");
  m.set("spsr_el3",    "**Saved PSTATE EL3** — processor state saved when an exception is taken to EL3.");
  m.set("sp_el0",      "**Stack pointer EL0** — accessible from higher ELs via `MSR`/`MRS`.");
  m.set("sp_el1",      "**Stack pointer EL1**.");
  m.set("sp_el2",      "**Stack pointer EL2**.");
  m.set("sctlr_el1",   "**System control register EL1** — controls MMU enable, caches, alignment checking, endianness.");
  m.set("ttbr0_el1",   "**Translation table base register 0 EL1** — base of page tables for user address space (VA < TTBR0).");
  m.set("ttbr1_el1",   "**Translation table base register 1 EL1** — base of page tables for kernel address space (VA >= TTBR1).");
  m.set("tcr_el1",     "**Translation control register EL1** — VA size, TTBR0/TTBR1 granule, shareability.");
  m.set("vbar_el1",    "**Vector base address register EL1** — base address of the EL1 exception vector table.");
  m.set("mair_el1",    "**Memory attribute indirection register EL1** — encodes up to 8 memory types (AttrIndx 0–7).");
  m.set("esr_el1",     "**Exception syndrome register EL1** — describes why the exception was taken (EC field, ISS field).");
  m.set("far_el1",     "**Fault address register EL1** — virtual address that caused the data/instruction abort.");
  m.set("cpacr_el1",   "**Architectural feature access control EL1** — enables/disables FP/SIMD at EL0/EL1 (FPEN field).");
  m.set("tpidr_el0",   "**Thread ID register EL0** — user-space thread pointer, used for TLS (e.g. `pthread_self()`).");
  m.set("tpidr_el1",   "**Thread ID register EL1** — kernel per-CPU or per-thread pointer.");
  m.set("tpidrro_el0", "**Thread ID register EL0 (read-only from EL0)** — set by the kernel, read-only from user space.");
  m.set("midr_el1",    "**Main ID register** — CPU implementer, variant, architecture, part number, and revision. Read-only.");
  m.set("mpidr_el1",   "**Multiprocessor affinity register** — encodes CPU and cluster topology. Read-only.");
  m.set("cntfrq_el0",  "**Counter-timer frequency register** — frequency of the system counter in Hz.");
  m.set("cntvct_el0",  "**Counter-timer virtual count** — current value of the virtual 64-bit monotonic counter.");
  m.set("cntpct_el0",  "**Counter-timer physical count** — current value of the physical 64-bit counter.");
  m.set("par_el1",     "**Physical address register EL1** — result of an address translation instruction (`AT`).");
  m.set("isr_el1",     "**Interrupt status register** — pending IRQ, FIQ, SError interrupts. Read-only.");
  m.set("hcr_el2",     "**Hypervisor configuration register EL2** — controls virtualization behavior.");
  m.set("scr_el3",     "**Secure configuration register EL3** — controls security state and exception routing.");
  m.set("contextidr_el1", "**Context ID register EL1** — ASID and process ID for VMID-unaware software.");
  m.set("mdscr_el1",   "**Monitor debug system control register EL1** — controls debug, single-step, and BRPs.");

  return m;
}

export const REGISTER_DOCS = buildRegisterDocs();
