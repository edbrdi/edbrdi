import base64, json, os, sys, urllib.request
from pathlib import Path

WORK = Path(__file__).resolve().parent / 'work'
src = Path(sys.argv[1])
audio = base64.b64encode(src.read_bytes()).decode()

PROMPT = """This is a short French radio-style podcast, generated weekly by AI from a company's internal content.
1. Transcribe it faithfully, split into speaker turns, with start and end times in seconds.
2. Describe each speaker (gender, age range, tone, pace) precisely enough to cast a TTS voice.
3. Note music beds and jingles (start, end, what they sound like).
4. Translate every turn into natural spoken English with the same radio tone and roughly the same length, so it can be voiced.
In the English only, anonymize: the company name and its product names become generic words ("the company", "the app"), people's names become plausible English first names (keep each one consistent), customer or client names become generic. List every replacement.
Answer with JSON only:
{"speakers":[{"id":"A","gender":"","description":""}],"music":[{"start":0,"end":0,"description":""}],"turns":[{"speaker":"A","start":0,"end":0,"fr":"","en":""}],"replacements":[{"from":"","to":""}]}"""

body = {
    'model': 'google/gemini-3.8-flash',
    'response_format': {'type': 'json_object'},
    'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': PROMPT}, {'type': 'input_audio', 'input_audio': {'data': audio, 'format': 'mp3'}}]}],
}
req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', json.dumps(body).encode(), {'Authorization': f"Bearer {os.environ['OPENROUTER_API_KEY']}", 'Content-Type': 'application/json'})
res = json.load(urllib.request.urlopen(req, timeout=600))
text = res['choices'][0]['message']['content'].strip().removeprefix('```json').removesuffix('```')
WORK.mkdir(exist_ok=True)
(WORK / 'transcript.json').write_text(json.dumps(json.loads(text), indent=2, ensure_ascii=False))
print(res.get('usage'))
