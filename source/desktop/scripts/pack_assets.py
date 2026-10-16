"""Збирає ресурси інсталятора з PNG, відрендерених render-brand.mjs: icon.ico, BMP для майстра, license.rtf.

Використання: uv run --with pillow python scripts/pack_assets.py /tmp/kermo-brand assets
"""
import pathlib
import struct
import sys

from PIL import Image

src = pathlib.Path(sys.argv[1])
dst = pathlib.Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)

# ICO з PNG-зображеннями всіх розмірів (формат підтримується з Windows Vista).
sizes = [16, 24, 32, 48, 64, 128, 256]
blobs = [(s, (src / f"icon-{s}.png").read_bytes()) for s in sizes]
offset = 6 + 16 * len(blobs)
entries, data = b"", b""
for size, blob in blobs:
    dim = 0 if size >= 256 else size
    entries += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(blob), offset)
    data += blob
    offset += len(blob)
(dst / "icon.ico").write_bytes(struct.pack("<HHH", 0, 1, len(blobs)) + entries + data)

# Растрові зображення майстра NSIS: 24-бітний BMP без прозорості.
for name, png in (("installerSidebar.bmp", "sidebar.png"), ("uninstallerSidebar.bmp", "sidebar.png"), ("installerHeader.bmp", "header.png")):
    Image.open(src / png).convert("RGB").save(dst / name, format="BMP")

LICENSE = """Кермо — клієнтська програма системи обліку автодилера

1. Призначення. Програма підключається до сервера Кермо у вашій мережі та показує дані й операції системи обліку. Дані зберігаються на сервері, а не на цьому комп’ютері.

2. Сервер обліку. Для роботи потрібен сервер на платформі 1С:Підприємство з чинними ліцензіями 1С. Кермо не містить, не змінює і не поширює компонентів 1С. «1С:Підприємство» є торговою маркою відповідного правовласника.

3. Облікові дані. Програма не зберігає пароль. Вхід виконується вашим ім’ям користувача та паролем від системи обліку; права доступу визначає сервер.

4. Сторонні компоненти. Програма використовує Electron і Chromium (ліцензії MIT, BSD та інші), React і Vite (MIT). Повні тексти ліцензій — у файлах LICENSE.electron.txt і LICENSES.chromium.html у папці встановлення.

5. Умови використання та підтримки визначає власник продукту.

Продовжуючи встановлення, ви підтверджуєте, що ознайомилися з цією інформацією.
"""


def rtf(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        if ch == "\\":
            out.append("\\\\")
        elif ch in "{}":
            out.append("\\" + ch)
        elif ch == "\n":
            out.append("\\par\n")
        elif code < 128:
            out.append(ch)
        else:
            out.append("\\u%d?" % (code if code < 32768 else code - 65536))
    return "".join(out)


header = "{\\rtf1\\ansi\\ansicpg1251\\deff0\\nouicompat{\\fonttbl{\\f0\\fnil\\fcharset204 Segoe UI;}}\\viewkind4\\uc1\\pard\\sa120\\f0\\fs20 "
(dst / "license.rtf").write_text(header + rtf(LICENSE) + "}", encoding="ascii")
print("Ресурси записано в", dst)
