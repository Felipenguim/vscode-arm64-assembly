.IFNDEF OPEN
.EQU OPEN, 1

///////////////////////////////////////////////////////////////////////////////

.MACRO _open
// int _open(int dirfd, char* path, int flags, int mode)
//
//   Opens the file at {path} relative to the directory {dirfd}.
//   Use AT_FDCWD (-100) in {dirfd} to resolve relative to current directory.
//   {flags} controls access mode: O_RDONLY=0, O_RDWR=2, O_CREAT=0100, etc.
//   {mode} sets permissions when O_CREAT is used, otherwise ignored.
//   Returns file descriptor in X0 on success, negative errno on failure.
//
//   X0 = dirfd
//   X1 = path (pointer to null-terminated string)
//   X2 = flags
//   X3 = mode

	mov x8, #56    // SYS_OPEN (openat)
	SVC #0

.ENDM

.ENDIF
