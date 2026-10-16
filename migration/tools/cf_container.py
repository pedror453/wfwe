#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""cf_container.py - stdlib-only reader/writer for 1C:Enterprise 8.x container files (.cf .epf .erf .cfu).

CLI (python -X utf8 cf_container.py ...):
  index <file> <out_csv>    list entries recursively
  cat <file> <path> [max]   print one inflated entry
  unpack <file> <outdir>    write the whole tree
  modules <file> <outdir>   write only module sources
Library: parse_container, parse_entries, build_container, entry_name, inflate, deflate, walk, decode.
"""
import csv, os, re, struct, sys, zlib
from collections import Counter, defaultdict

LAST = 0x7FFFFFFF
HDR_LEN = 31


def _hdr(buf, a):
    if buf[a:a + 2] != b'\r\n' or buf[a + 10:a + 11] != b' ':
        raise ValueError('bad block header at %d' % a)
    return int(buf[a + 2:a + 10], 16), int(buf[a + 11:a + 19], 16), int(buf[a + 20:a + 28], 16)


def read_block(buf, a):
    size, page, nxt = _hdr(buf, a)
    pos, left, out = a + HDR_LEN, size, bytearray()
    while True:
        n = min(page, left)
        out += buf[pos:pos + n]
        left -= n
        if left <= 0 or nxt == LAST:
            break
        _, page, nxt2 = _hdr(buf, nxt)
        pos, nxt = nxt + HDR_LEN, nxt2
    return bytes(out)


def is_container(b):
    return len(b) >= 47 and b[0:4] == b'\xff\xff\xff\x7f' and b[16:18] == b'\r\n' and b[26:27] == b' '


def entry_name(hdr):
    return hdr[20:].decode('utf-16le', 'replace').split('\x00')[0]


def parse_entries(buf):
    """-> list of [header_bytes, data_bytes_or_None] in TOC order."""
    toc = read_block(buf, 16)
    out = []
    for i in range(len(toc) // 12):
        ha, da, _ = struct.unpack_from('<III', toc, i * 12)
        if ha == LAST:
            break
        out.append([read_block(buf, ha), read_block(buf, da) if da != LAST else None])
    return out


def parse_container(buf):
    return [(entry_name(h), d if d is not None else b'') for h, d in parse_entries(buf)]


def inflate(b):
    try:
        return zlib.decompress(b, -15), True
    except zlib.error:
        return b, False


def deflate(b):
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    return c.compress(b) + c.flush()


def _block(data, page):
    return b'\r\n%08x %08x %08x \r\n' % (len(data), page, LAST) + data + b'\x00' * (page - len(data))


def build_container(entries, file_header):
    """Fresh single-page layout: header, TOC, then (header block, data block) per entry."""
    toc_len = len(entries) * 12
    pos = 16 + HDR_LEN + toc_len
    toc, parts = bytearray(), []
    for hdr, data in entries:
        ha = pos
        parts.append(_block(hdr, len(hdr)))
        pos += HDR_LEN + len(hdr)
        if data is None:
            da = LAST
        else:
            page = max(len(data), 512)
            da = pos
            parts.append(_block(data, page))
            pos += HDR_LEN + page
        toc += struct.pack('<III', ha, da, LAST)
    return bytes(file_header[:16]) + _block(bytes(toc), toc_len) + b''.join(parts)


def walk(buf, prefix=''):
    for name, raw in parse_container(buf):
        data, comp = inflate(raw)
        nested = is_container(data)
        path = prefix + name
        yield path, name, raw, data, comp, nested
        if nested:
            yield from walk(data, path + '/')


def decode(b):
    for enc in ('utf-8-sig', 'cp1251'):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode('latin-1')


def safe(p):
    return re.sub(r'[<>:"|?*]', '_', p)


def cmd_index(src, out_csv):
    buf = open(src, 'rb').read()
    rows = []
    for path, name, raw, data, comp, nested in walk(buf):
        head = '' if nested else re.sub(r'\s+', ' ', decode(data[:60]))
        rows.append((path, len(raw), len(data), int(comp), int(nested), head))
    with open(out_csv, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['path', 'raw', 'size', 'deflated', 'container', 'head'])
        w.writerows(rows)
    print('entries=%d nested_containers=%d' % (len(rows), sum(r[4] for r in rows)))


def cmd_cat(src, path, maxb=4000):
    buf = open(src, 'rb').read()
    for p, name, raw, data, comp, nested in walk(buf):
        if p == path:
            sys.stdout.write(decode(data[:maxb]))
            return
    print('not found: ' + path)


def cmd_unpack(src, outdir, only_text=False):
    buf = open(src, 'rb').read()
    n = 0
    for path, name, raw, data, comp, nested in walk(buf):
        if only_text:
            if name.lower() != 'text' or nested or '/' not in path:
                continue
            target = os.path.join(outdir, *[safe(x) for x in path.split('/')[:-1]]) + '.bsl'
        elif nested:
            os.makedirs(os.path.join(outdir, *[safe(x) for x in path.split('/')]), exist_ok=True)
            continue
        else:
            target = os.path.join(outdir, *[safe(x) for x in path.split('/')])
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'wb') as f:
            f.write(data)
        n += 1
    print('written files:', n)


if __name__ == '__main__':
    a = sys.argv
    if len(a) >= 4 and a[1] == 'index':
        cmd_index(a[2], a[3])
    elif len(a) >= 4 and a[1] == 'cat':
        cmd_cat(a[2], a[3], int(a[4]) if len(a) > 4 else 4000)
    elif len(a) >= 4 and a[1] == 'unpack':
        cmd_unpack(a[2], a[3])
    elif len(a) >= 4 and a[1] == 'modules':
        cmd_unpack(a[2], a[3], True)
    else:
        print(__doc__)
