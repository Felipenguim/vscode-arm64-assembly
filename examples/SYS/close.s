.IFNDEF CLOSE
.EQU CLOSE, 1

///////////////////////////////////////////////////////////////////////////////

.MACRO _close
// int _close(int fd)
//
//   Closes the file descriptor {fd}.
//   Returns 0 on success, negative errno on failure.
//   Return value is in x0.
//
//   X0 = fd

	mov x8, #57    // SYS_CLOSE
	SVC #0

.ENDM

.ENDIF
