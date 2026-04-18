.IFNDEF PRINT_BUFFER_FLUSH
.EQU PRINT_BUFFER_FLUSH,1

///////////////////////////////////////////////////////////////////////////////

// void print_buffer_flush(int fd)
// Flushes the PRINT_BUFFER to file descriptor {fd}.
// @param fd X0 — file descriptor to flush (e.g. 1 for stdout, 2 for stderr)
print_buffer_flush:
	adr x1, PRINT_BUFFER
	.b:
	adr x9, PRINT_BUFFER_LEN
	ldr x2, [x9]
	.a:
	mov x8, #64 //SYS_WRITE
	SVC #0

	mov x15, #0
	str x15, [x9] // reset buffer length to 0

	ret

PRINT_BUFFER_LEN:
    .quad 0

.ENDIF
