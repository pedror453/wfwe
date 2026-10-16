# -*- coding: utf-8 -*-
"""cf_patch.py <in.cf> <out.cf> <shim.bsl>   - insert the Kermo compatibility block into the external connection module
cf_patch.py <in.cf> <out.cf> --revert      - remove the block again

The shim file has two parts separated by the line '//----CODE----': variable declarations (inserted before the first
procedure/function) and procedures/functions (appended). No other part of the configuration is changed.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cf_container import parse_entries, build_container, entry_name, inflate, deflate, is_container, decode

VB, VE = '//<<KERMO-VARS-BEGIN>>', '//<<KERMO-VARS-END>>'
CB, CE = '//<<KERMO-CODE-BEGIN>>', '//<<KERMO-CODE-END>>'
SPLIT = '//----CODE----'
MARKER = '\u041c\u043e\u0434\u0443\u043b\u044c \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f'
FIRST_PROC = re.compile(r'(?im)^[ \t]*(\u041f\u0440\u043e\u0446\u0435\u0434\u0443\u0440\u0430|\u0424\u0443\u043d\u043a\u0446\u0438\u044f|Procedure|Function)\b')


def strip_blocks(text):
    for b, e in ((VB, VE), (CB, CE)):
        while b in text:
            i = text.index(b)
            j = text.index(e, i) + len(e)
            text = text[:i] + text[j:].lstrip('\r\n')
    return text


def apply(text, shim, nl):
    text = strip_blocks(text)
    parts = shim.split(SPLIT, 1)
    vars_part = parts[0].strip('\r\n')
    code_part = (parts[1] if len(parts) > 1 else '').strip('\r\n')
    norm = lambda s: s.replace('\r\n', '\n').replace('\n', nl)
    block_v = VB + nl + norm(vars_part) + nl + VE + nl + nl
    block_c = nl + CB + nl + norm(code_part) + nl + CE + nl
    m = FIRST_PROC.search(text)
    text = text[:m.start()] + block_v + text[m.start():] if m else text.rstrip('\r\n') + nl + block_v
    return text.rstrip('\r\n') + nl + block_c


def main():
    src, dst = sys.argv[1], sys.argv[2]
    revert = len(sys.argv) > 3 and sys.argv[3] == '--revert'
    shim = '' if revert else open(sys.argv[3], encoding='utf-8-sig').read()
    buf = open(src, 'rb').read()
    entries = parse_entries(buf)
    done = []
    for e in entries:
        name = entry_name(e[0])
        if e[1] is None or '.' not in name:
            continue
        data, was = inflate(e[1])
        if not is_container(data):
            continue
        inner = parse_entries(data)
        for ie in inner:
            if entry_name(ie[0]) != 'text' or ie[1] is None:
                continue
            tdata, tcomp = inflate(ie[1])
            text = decode(tdata)
            if MARKER not in text[:600] or 'RunExchange' not in text:
                continue
            bom = tdata[:3] == b'\xef\xbb\xbf'
            nl = '\r\n' if '\r\n' in text else '\n'
            new_text = strip_blocks(text) if revert else apply(text, shim, nl)
            raw = (b'\xef\xbb\xbf' if bom else b'') + new_text.encode('utf-8')
            ie[1] = deflate(raw) if tcomp else raw
            nested = build_container(inner, data[:16])
            e[1] = deflate(nested) if was else nested
            done.append(name)
            print('patched module %s: %d -> %d chars (bom=%s, nl=%r)' % (name, len(text), len(new_text), bom, nl))
    if len(done) != 1:
        raise SystemExit('expected exactly one external connection module, found %d' % len(done))
    open(dst, 'wb').write(build_container(entries, buf[:16]))
    a = parse_entries(buf)
    b = parse_entries(open(dst, 'rb').read())
    diff = [entry_name(x[0]) for x, y in zip(a, b) if x[0] != y[0] or x[1] != y[1]]
    print('written %s (%d bytes); entries: %d -> %d; differing: %s' % (dst, os.path.getsize(dst), len(a), len(b), diff))
    if len(a) != len(b) or diff != done:
        raise SystemExit('verification failed')


if __name__ == '__main__':
    main()
