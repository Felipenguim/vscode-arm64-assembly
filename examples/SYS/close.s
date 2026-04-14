.IFNDEF CLOSE
.EQU CLOSE, 1

///////////////////////////////////////////////////////////////////////////////

// int _close(int fd)
// Closes the file descriptor {fd}.
// Returns 0 on success, negative errno on failure.
// @param fd X0 — file descriptor to close
// @return X0 — 0 on success, negative errno on failure
.MACRO _close

	mov x8, #57    // SYS_CLOSE
	SVC #0

.ENDM

.ENDIF
