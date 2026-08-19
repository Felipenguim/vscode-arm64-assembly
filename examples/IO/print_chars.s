.IFNDEF PRINT_CHARS
.EQU PRINT_CHARS,1

.INCLUDE "IO/print_buffer_flush.s"

// void print_chars(int fd, char* str, uint len)
// Writes {len} chars of char array at {str} to file descriptor {fd}.
// Buffers output internally; call print_buffer_flush to drain remaining bytes.
// @param fd X0 — file descriptor to write to (e.g. 1 for stdout, 2 for stderr)
// @param str X1 — pointer to char array to write
// @param len X2 — number of chars to write
print_chars:
   str x30, [sp, #-16]!   // save LR (keeps stack 16-byte aligned)

   adr x7, PRINT_BUFFER
   adr x9, PRINT_BUFFER_LEN
   ldr x3, [x9]           // current length of the buffer
   add x7, x7, x3         // points to the next free byte in the buffer
   adr x10, PRINT_BUFFER
   add x10, x10, #PRINT_BUFFER_SIZE // points to the end of the buffer
   add x2, x1, x2         // points past the last address

.buffer_load_loop:
   ldrb w3, [x1], #1      // load byte from str and post-increment pointer
   strb w3, [x7], #1      // store byte in buffer and post-increment pointer
   cmp x10, x7
   b.hi .no_flush
   mov x3, #PRINT_BUFFER_SIZE
   str x3, [x9]           // update buffer length
   bl print_buffer_flush
   adr x7, PRINT_BUFFER
   adr x9, PRINT_BUFFER_LEN

.no_flush:
   cmp x1, x2             // continue until hit the end of the string
   b.lo .buffer_load_loop
   adr x14, PRINT_BUFFER
   sub x7, x7, x14
   adr x9, PRINT_BUFFER_LEN
   str x7, [x9]           // update buffer length

   ldr x30, [sp], #16     // restore LR
   ret

.ENDIF
