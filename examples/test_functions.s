//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;DEFINITIONS;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

.arch armv8-a
.equ LOAD_ADDRESS, 0x8000
.equ CODE_SIZE, (END-END_HEADER)
.equ PRINT_BUFFER_SIZE, 4096

//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;HEADER;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

ELF_HEADER:
	.byte 0x7F,'E','L','F'
	.byte 0x02
	.byte 0x01
	.byte 0x01
	.byte 0x00
	.byte 0x00
	.fill 7, 1, 0x00
	.short 0x0002
	.short 0x00B7
	.word 0x00000001
	.quad LOAD_ADDRESS+(START-ELF_HEADER)
	.quad 0x0000000000000040
	.quad 0x0000000000000000
	.word 0x00000000
	.short 0x0040
	.short 0x0038
	.short 0x0001
	.short 0x0000
	.short 0x0000
	.short 0x0000
PROGRAM_HEADER:
	.word 0x00000001
	.word 0x00000007
	.quad 0x0000000000000078
	.quad LOAD_ADDRESS+0x78
	.quad 0x0000000000000000
	.quad CODE_SIZE
	.quad CODE_SIZE + PRINT_BUFFER_SIZE
	.quad 0x0000000000000000
END_HEADER:

//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;INCLUDES;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

.INCLUDE "SYS/LINUX/SYSCALLS.S"
.INCLUDE "SYS/exit.s"

.INCLUDE "IO/print_chars.s"
.INCLUDE "IO/print_string.s"
.INCLUDE "IO/print_buffer_flush.s"

//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;INSTRUCTIONS;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

START:
	// hover sobre print_chars, print_string, print_buffer_flush → hover (function)
	// hover sobre _exit → hover (macro)

	mov x0, #1             // stdout
	adr x1, HELLO
	mov x2, #(HELLO_END-HELLO)
	bl print_chars          // <-- hover aqui mostra (function) print_chars

	mov x0, #1
	adr x1, GREETING
	bl print_string         // <-- hover aqui mostra (function) print_string

	bl print_buffer_flush   // <-- hover aqui mostra (function) print_buffer_flush

	mov x0, #0
	_exit                   // <-- hover aqui mostra (macro) _exit

HELLO:
	.ascii "Hello from functions!\n"
HELLO_END:

GREETING:
	.asciz "Greeting via print_string!\n"

END:

PRINT_BUFFER:
