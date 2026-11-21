import json, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'scripts/podcast/work'
OUT = ROOT / 'assets/video/podcast.mp4'
SR, GAP, W, H, FPS = 24000, 0.3, 1280, 720, 24
F = ROOT / 'scripts/fonts'
font = lambda n, s: ImageFont.truetype(str(F / n), s)
BG, TEXT, MUTED, LINE, ACC, NAVY, FAINT = '#fbfaf7', '#13254a', '#56607a', '#dcdde2', '#e0702c', '#4a5675', '#a9adbb'
PANEL = '#f3f1ec'
COL = {'A': ACC, 'B': NAVY}
NAME = {'A': 'Host 1', 'B': 'Host 2'}

KEEP = [0, 1, 2, 3, 4, 17]
turns = [t for i, t in enumerate(json.loads((WORK / 'transcript.json').read_text())['turns']) if i in KEEP]
pcm, spans, t = [], [], 0.0
for i, tr in enumerate(turns):
    x = np.frombuffer((WORK / 'turns' / f'{KEEP[i]:02d}.pcm').read_bytes(), np.int16).astype(np.float32) / 32768
    spans.append((t, t + len(x) / SR, tr['speaker'], tr['en']))
    pcm += [x, np.zeros(int(GAP * SR), np.float32)]
    t += len(x) / SR + GAP
audio = np.concatenate([np.zeros(int(0.4 * SR), np.float32)] + pcm)
spans = [(a + 0.4, b + 0.4, s, e) for a, b, s, e in spans]
dur = len(audio) / SR
raw = WORK / 'episode.wav'
with wave.open(str(raw), 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())

NB, X0, X1, CY, AMP = 130, 76, 676, 262, 44
STEPS = json.loads((ROOT / 'scripts/profile.json').read_text())['radio']['steps']
hop = len(audio) // NB
lv = np.sqrt((audio[: NB * hop].reshape(NB, hop) ** 2).mean(1))
lv = lv / lv.max()
who = []
for i in range(NB):
    tc = (i + 0.5) * hop / SR
    who.append(next((s for a, b, s, _ in spans if a - GAP <= tc <= b + GAP), None))

f_kick, f_title, f_name, f_line, f_dim, f_leg = font('geist-mono.ttf', 16), font('geist-600.ttf', 30), font('geist-600.ttf', 19), font('geist-600.ttf', 26), font('geist-400.ttf', 20), font('geist-400.ttf', 17)
f_num, f_step, f_txt = font('geist-mono.ttf', 15), font('geist-600.ttf', 21), font('geist-400.ttf', 17)
PX0, PX1 = 736, 1220


def wrap(d, text, f, width):
    out, cur = [], ''
    for wd in text.split():
        if d.textlength((cur + ' ' + wd).strip(), font=f) > width and cur:
            out.append(cur); cur = wd
        else:
            cur = (cur + ' ' + wd).strip()
    return out + ([cur] if cur else [])


def frame(t):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((60, 48), 'WEEKLY BRIEF · EXCERPT · WRITTEN AND VOICED BY AI', font=f_kick, fill=ACC)
    d.text((60, 76), "A company's week, as a radio show", font=f_title, fill=TEXT)
    d.rounded_rectangle([60, 180, 692, 344], radius=16, outline=LINE, width=2)
    step = (X1 - X0) / NB
    up = X0 + (X1 - X0) * t / dur
    for i, v in enumerate(lv):
        x = X0 + i * step
        h = max(2, v * AMP)
        c = Image.new('RGB', (1, 1), COL.get(who[i], FAINT)).getpixel((0, 0))
        d.rounded_rectangle([x + 0.8, CY - h, x + step - 1.2, CY + h], radius=1.5, fill=c + ((255,) if x <= up else (60,)))
    d.line([up, 192, up, 332], fill=TEXT, width=2)
    cur = max([k for k, s in enumerate(spans) if s[0] - GAP <= t] or [0])
    a, b, spk, text = spans[cur]
    d.rounded_rectangle([60, 382, 72, 394], radius=3, fill=COL[spk])
    d.text((82, 376), NAME[spk], font=f_name, fill=COL[spk])
    y = 410
    for ln in wrap(d, text, f_line, 632)[:5]:
        d.text((60, y), ln, font=f_line, fill=TEXT); y += 36
    if cur + 1 < len(spans):
        d.text((60, max(y + 14, 604)), wrap(d, spans[cur + 1][3], f_dim, 632)[0], font=f_dim, fill=FAINT)
    lx = 60
    for s in 'AB':
        d.rounded_rectangle([lx, 671, lx + 13, 684], radius=4, fill=COL[s])
        d.text((lx + 21, 666), NAME[s], font=f_leg, fill=MUTED); lx += 21 + d.textlength(NAME[s], font=f_leg) + 26
    d.text((lx, 666), 'translated from French, anonymized', font=f_leg, fill=FAINT)
    m = f'{int(t) // 60}:{int(t) % 60:02d} / {int(dur) // 60}:{int(dur) % 60:02d}'
    d.text((692 - d.textlength(m, font=f_leg), 666), m, font=f_leg, fill=MUTED)
    d.rounded_rectangle([PX0 - 20, 36, W - 40, H - 36], radius=18, fill=PANEL, outline=LINE, width=2)
    d.text((PX0, 60), 'HOW IT IS MADE, EVERY WEEK', font=f_kick, fill=MUTED)
    act = int(t / 6) % len(STEPS)
    y = 96
    for i, s in enumerate(STEPS):
        on = i == act
        hot = s.get('hot')
        tl = wrap(d, s['text'], f_txt, PX1 - PX0 - 74)[:2]
        bh = 50 + 22 * len(tl)
        d.rounded_rectangle([PX0 - 4, y, PX1 + 4, y + bh], radius=12, fill=BG if on else None, outline=(ACC if hot else TEXT) if on else (ACC if hot else LINE), width=2 if on else 1)
        d.text((PX0 + 12, y + 16), f'0{i + 1}', font=f_num, fill=ACC)
        d.text((PX0 + 50, y + 12), s['title'], font=f_step, fill=TEXT if on or hot else MUTED)
        for k, ln in enumerate(tl):
            d.text((PX0 + 50, y + 42 + 22 * k), ln, font=f_txt, fill=MUTED)
        y += bh + 12
    d.text((PX0, H - 74), 'Sources only: nothing invented, nothing aired unchecked.', font=f_leg, fill=MUTED)
    return im


OUT.parent.mkdir(parents=True, exist_ok=True)
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', str(raw),
                       '-af', 'loudnorm=I=-16:TP=-1.5', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-shortest', '-movflags', '+faststart', str(OUT)], stdin=subprocess.PIPE)
for i in range(int(dur * FPS) + 1):
    ff.stdin.write(frame(i / FPS).tobytes())
ff.stdin.close(); ff.wait()
frame(spans[2][0] + 2).save(WORK / 'poster.png')
print(OUT, f'{dur:.1f}s', OUT.stat().st_size // 1024, 'KB')
