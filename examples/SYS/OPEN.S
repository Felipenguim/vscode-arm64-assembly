.IFNDEF OPEN
.EQU OPEN, 1

///////////////////////////////////////////////////////////////////////////////

// int _open(int dirfd, char* path, int flags, int mode)
// Opens the file at {path} relative to the directory {dirfd}.
// Returns file descriptor in X0 on success, negative errno on failure.
// @param dirfd X0 — directory file descriptor (-100 for current working directory)
// @param path X1 — pointer to null-terminated string
// @param flags X2 — access flags
// @param mode X3 — permissions (when O_CREAT is specified)
// @return X0 — file descriptor on success, negative errno on failure
.MACRO _open

	mov x8, #56    // SYS_OPEN (openat)
	SVC #0

.ENDM

.ENDIF
