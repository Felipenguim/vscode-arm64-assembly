//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;DEFINITIONS;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

// ARM64 bare-metal implementation of `touch` — creates/updates a file's timestamp.
// Assembled with: aarch64-linux-gnu-as test.s -I . -o test.o
//                 aarch64-linux-gnu-ld test.o -o touch_arm64
//
// Usage: ./touch_arm64 <filename>

.arch armv8-a
.equ LOAD_ADDRESS, 0x8000
.equ CODE_SIZE, (END-END_HEADER) // everything beyond the HEADER is code

//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;HEADER;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

//.org LOAD_ADDRESS
ELF_HEADER:
	.byte 0x7F,'E','L','F'  // magic number to indicate ELF file
	.byte 0x02               // 0x1 for 32-bit, 0x2 for 64-bit
	.byte 0x01               // 0x1 for little endian, 0x2 for big endian
	.byte 0x01               // 0x1 for current version of ELF
	.byte 0x00               // 0x9 for FreeBSD, 0x3 for Linux (doesn't seem to matter)
	.byte 0x00               // ABI version (ignored?)
	.fill 7, 1, 0x00         // 7 padding bytes
	.short 0x0002            // executable file
	.short 0x00B7            // ARMv8a machine type
	.word 0x00000001         // version 1
	.quad LOAD_ADDRESS+(START-ELF_HEADER) // entry point for our program
	.quad 0x0000000000000040 // 0x40 offset from ELF_HEADER to PROGRAM_HEADER
	.quad 0x0000000000000000 // section header offset (we don't have this)
	.word 0x00000000         // unused flags
	.short 0x0040            // 64-byte size of ELF_HEADER
	.short 0x0038            // 56-byte size of each program header entry
	.short 0x0001            // number of program header entries (we have one)
	.short 0x0000            // size of each section header entry (none)
	.short 0x0000            // number of section header entries (none)
	.short 0x0000            // index in section header table for section names (waste)
PROGRAM_HEADER:
	.word 0x00000001         // 0x1 for loadable program segment
	.word 0x00000007         // read/write/execute flags
	.quad 0x0000000000000078 // offset of code start in file image (0x40+0x38)
	.quad LOAD_ADDRESS+0x78  // virtual address of segment in memory
	.quad 0x0000000000000000 // physical address of segment in memory (ignored?)
	.quad CODE_SIZE          // size (bytes) of segment in file image
	.quad CODE_SIZE          // size (bytes) of segment in memory
	.quad 0x0000000000000000 // alignment (doesn't matter, only 1 segment)
END_HEADER:

//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;INCLUDES;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

//.EQU VERBOSE_LOGS, 1

.INCLUDE "SYS/LINUX/SYSCALLS.S"
.INCLUDE "SYS/exit.s"
.INCLUDE "SYS/OPEN.S"
.INCLUDE "SYS/close.s"

//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;INSTRUCTIONS;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

START:
	// SP points to argc, SP+8 to argv[0] (program name), SP+16 to argv[1] (file path)
	// Check that exactly one argument was provided (argc == 2)
	ldr x1, [sp, 0]       // load argc
	cmp x1, 2
	b.ne .fail

	// openat(AT_FDCWD, path, O_CREAT|O_RDWR, 0644)
	ldr x1, [sp, 16]      // x1 = argv[1] (path to file)
	mov x0, #-100          // x0 = AT_FDCWD
	mov x2, #0102          // x2 = O_CREAT | O_RDWR
	mov x3, #0644          // x3 = permissions rw-r--r--

	_open
	cmp x0, #0
	b.lt .fail             // negative fd = error

	_close
	cmp x0, #0
	b.eq .leave            // closed successfully, exit with code 0

.fail:
	mov x0, #1             // exit code 1 = failure
	b .leave

.leave:
	_exit

END:
