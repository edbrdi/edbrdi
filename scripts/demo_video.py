import json, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'dev/alkove/site/web/samples')
OUT = ROOT / 'assets/video/alkove-demo.mp4'
W, H, FPS, SR, GAP = 1280, 640, 30, 16000, 0.5
F = ROOT / 'scripts/fonts'
font = lambda n, s: ImageFont.truetype(str(F / n), s)
BG, TEXT, MUTED, LINE, ACC, VA, VB = '#fbfaf7', '#13254a', '#56607a', '#dcdde2', '#e0702c', '#4a5675', '#b3a184'
GHOST = (19, 37, 74, 26)


def read(p):
    with wave.open(str(p)) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def env(x, hop=512):
    n = len(x) // hop
    return np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1))


KEPT = ROOT / 'scripts/demo'
mix, a, b = read(SAMPLES / 'focus-two-voices.wav'), read(KEPT / 'kept-a.wav'), read(KEPT / 'kept-b.wav')
a, b = (np.pad(x, (0, max(0, len(mix) - len(x))))[: max(len(mix), len(x))] for x in (a, b))
ab = json.loads((SAMPLES / 'focus-two-voices.json').read_text())
ea, eb, em = np.array(ab['a']), np.array(ab['b']), env(mix)
SEGS = [
    ('mix', 'Both', mix, 'Music plays, a man talks, then a woman talks over him.'),
    ('a', 'Keep A', a, 'Alkove hears a few seconds of voice A, then keeps only that one.'),
    ('b', 'Keep B', b, 'Same input, voice B picked: the man, the music and the noise are gone.'),
]

f_title, f_mono, f_body, f_btn, f_leg = font('geist-600.ttf', 40), font('geist-mono.ttf', 18), font('geist-400.ttf', 24), font('geist-600.ttf', 22), font('geist-400.ttf', 19)
X0, X1, CY, AMP = 80, W - 80, 360, 120


def bars(d, e, color, upto, ghost=False, scale=1.0):
    n = len(e)
    step = (X1 - X0) / n
    for i, v in enumerate(e):
        x = X0 + i * step
        h = max(2, min(AMP, v * scale * AMP * 3.2))
        played = x <= upto
        if ghost:
            col = GHOST
        else:
            c = Image.new('RGB', (1, 1), color).getpixel((0, 0))
            col = c + ((255,) if played else (70,))
        d.rounded_rectangle([x + 1, CY - h, x + step - 1.5, CY + h], radius=2, fill=col)


def frame(seg, t, dur):
    key, label, audio, status = seg
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((80, 62), 'ALKOVE · FOCUS 1 · RUNS ON THE DEVICE', font=f_mono, fill=ACC)
    d.text((80, 96), 'Two voices at once: pick the one to keep.', font=f_title, fill=TEXT)
    bx = 80
    for k, lab in (('mix', 'Both'), ('a', 'Keep A'), ('b', 'Keep B')):
        w = d.textlength(lab, font=f_btn) + 44
        on = k == key
        d.rounded_rectangle([bx, 170, bx + w, 214], radius=22, fill=TEXT if on else None, outline=TEXT if on else LINE, width=2)
        d.text((bx + 22, 180), lab, font=f_btn, fill=BG if on else MUTED)
        bx += w + 12
    d.rounded_rectangle([60, 236, W - 60, 486], radius=18, outline=LINE, width=2)
    upto = X0 + (X1 - X0) * min(1, t / dur)
    if key == 'mix':
        bars(d, eb, VB, upto, scale=1.0)
        bars(d, ea, VA, upto, scale=1.0)
    else:
        bars(d, ea if key == 'b' else eb, None, upto, ghost=True)
        bars(d, env(audio), ACC, upto)
    d.line([upto, 250, upto, 472], fill=TEXT, width=2)
    d.text((80, 512), status, font=f_body, fill=MUTED)
    lx = 80
    for col, lab in ((VA, 'Voice A'), (VB, 'Voice B'), (ACC, 'What Alkove keeps')):
        d.rounded_rectangle([lx, 572, lx + 16, 588], radius=4, fill=col)
        d.text((lx + 26, 567), lab, font=f_leg, fill=MUTED)
        lx += 26 + d.textlength(lab, font=f_leg) + 34
    s = f'0:{int(t):02d}'
    d.text((W - 80 - d.textlength(s, font=f_leg), 567), s, font=f_leg, fill=MUTED)
    return im.convert('RGB')


OUT.parent.mkdir(parents=True, exist_ok=True)
tmp = ROOT / 'scripts/.demo.wav'
pad = np.zeros(int(GAP * SR), np.float32)
track = np.concatenate([np.concatenate([s[2], pad]) for s in SEGS])
with wave.open(str(tmp), 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes())

ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', str(tmp),
                       '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-shortest', '-movflags', '+faststart', str(OUT)], stdin=subprocess.PIPE)
for seg in SEGS:
    dur = len(seg[2]) / SR
    for i in range(int((dur + GAP) * FPS)):
        ff.stdin.write(frame(seg, min(i / FPS, dur), dur).tobytes())
ff.stdin.close(); ff.wait(); tmp.unlink()
frame(SEGS[1], 3.0, len(SEGS[1][2]) / SR).save(ROOT / 'scripts/.demo-poster.png')
print(OUT, OUT.stat().st_size // 1024, 'KB')
