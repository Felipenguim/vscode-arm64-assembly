.ifndef EXIT
.set EXIT, 1

.macro _exit
    // Returns whatever is currently in x0 as the exit code.
    // Note: exit code is only 8 bits (0-255).
    mov x8, #93    // SYS_EXIT
    svc #0
.endm

.endif
