import sys, wave
from pathlib import Path
import numpy as np
import alkove

S = Path(sys.argv[1]); OUT = Path(sys.argv[2]); RATE, LEAD = 16000, 1.5
read = lambda p: np.frombuffer(wave.open(str(p)).readframes(10**9), np.int16).astype(np.float32) / 32768
models = alkove.Models.load(["focus", "timbre", "cue"], dir=sys.argv[3])
mix = read(S / 'focus-two-voices.wav')
for k in 'ab':
    lead = np.zeros(int(LEAD * RATE), np.float32)
    part = alkove.process(models, np.concatenate([lead, mix]), voiceprint=read(S / f'focus-voice-{k}.wav'))
    out = np.asarray(part.audio, np.float32)[len(lead):]
    with wave.open(str(OUT / f'kept-{k}.wav'), 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
    print(k, len(out) / RATE, float(np.sqrt((out ** 2).mean())))
