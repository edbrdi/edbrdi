import json, os, urllib.request, wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

WORK = Path(__file__).resolve().parent / 'work'
VOICES = {'A': 'Aoede', 'B': 'Iapetus'}
turns = json.loads((WORK / 'transcript.json').read_text())['turns']
(WORK / 'turns').mkdir(exist_ok=True)


def say(i):
    out = WORK / 'turns' / f'{i:02d}.pcm'
    if out.exists() and out.stat().st_size > 1000:
        return
    t = turns[i]
    body = {'model': 'google/gemini-3.8-flash-tts', 'input': t['en'], 'voice': VOICES[t['speaker']], 'response_format': 'pcm'}
    req = urllib.request.Request('https://openrouter.ai/api/v1/audio/speech', json.dumps(body).encode(), {'Authorization': f"Bearer {os.environ['OPENROUTER_API_KEY']}", 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        print(i, r.headers.get('content-type'), end=' | ')
        out.write_bytes(r.read())


with ThreadPoolExecutor(6) as ex:
    list(ex.map(say, range(len(turns))))
print('\n', sorted(p.stat().st_size for p in (WORK / 'turns').glob('*.pcm'))[:3])
