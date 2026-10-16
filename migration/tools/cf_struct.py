# -*- coding: utf-8 -*-
"""cf_struct.py <file.cf> <modules_dir> - low-level container facts needed to write a patched .cf (read-only)."""
import collections, os, re, struct, sys
here = os.path.dirname(os.path.abspath(__file__))
for p in (here, r'C:\Base_1C\MCP_LR_Copy_20261016\agent_work\tools'):
    if p not in sys.path:
        sys.path.insert(0, p)
from cf_container import parse_container, read_block, inflate, decode, is_container, LAST, _hdr

G = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
buf = open(sys.argv[1], 'rb').read()
print('file header:', buf[:16].hex())
print('toc block (size,page,next):', _hdr(buf, 16))
toc = read_block(buf, 16)
n = len(toc) // 12
print('toc entries:', n)
kinds = collections.Counter()
for i in list(range(4)) + [n - 2, n - 1]:
    ha, da, x = struct.unpack_from('<III', toc, i * 12)
    print(' #%d hdr@%x data@%x third=%x hdrblk=%s datablk=%s' % (i, ha, da, x, _hdr(buf, ha), _hdr(buf, da) if da != LAST else None))
for i in range(n):
    ha, da, x = struct.unpack_from('<III', toc, i * 12)
    if ha == LAST:
        break
    s, p, nx = _hdr(buf, da)
    kinds['page==size' if p == s else ('page=512' if p == 512 else 'page=other')] += 1
print('data block page kinds:', dict(kinds))
top = dict(parse_container(buf))
for k in ('root', 'version', 'versions'):
    t = decode(inflate(top[k])[0])
    print('--', k, 'chars=%d' % len(t))
    print(t[:600] if k == 'versions' else t[:200])
root = decode(inflate(top['root'])[0])
cfg = re.search(G, root).group(0)
print('-- entries of the configuration object (guid hidden):')
for nm, raw in parse_container(buf):
    if nm.startswith(cfg + '.') or nm == cfg:
        d = inflate(raw)[0]
        inner = [x for x, _ in parse_container(d)] if is_container(d) else None
        print('  ', nm.replace(cfg, '<cfg>'), len(d), inner)
rx = re.compile('^\\s*#\u0415\u0441\u043b\u0438\\s+(.+?)\\s+\u0422\u043e\u0433\u0434\u0430', re.M)
cnt = collections.Counter()
files = 0
for dp, dn, fns in os.walk(sys.argv[2]):
    for fn in fns:
        files += 1
        for m in rx.finditer(open(os.path.join(dp, fn), encoding='utf-8-sig').read()):
            cnt[m.group(1).strip()] += 1
print('-- preprocessor #If expressions over %d module files (top 15):' % files)
for k, v in cnt.most_common(15):
    print('  %6d  #If %s' % (v, k))
