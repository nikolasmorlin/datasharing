# Places each spoken chunk of a narration at the moment its caption appears.
# usage: python3 tools/place_narration.py in.wav out.wav
import sys, wave, subprocess, re, numpy as np
src, dst = sys.argv[1], sys.argv[2]
TOTAL = 97.5
# speech-chunk groups (indices of chunks between detected pauses) -> caption time in the video
PLAN = [([0],1.4),([1],4.7),([2],7.5),([3,4],11.0),([5],13.9),([6,7],15.7),([8],18.7),([9],22.1),([10],25.9),
        ([11],29.7),([12,13],31.3),([14,15],35.3),([16],37.6),([17],41.3),([18],42.9),([19],44.9),([20],47.6),
        ([21],50.3),([22],53.5),([23],55.9),([24],56.8),([25],57.6),([26],59.6),([27,28],62.6),([29],65.2),
        ([30],66.8),([31],70.1),([32,33],74.1),([34],76.7),([35],80.5),([36],87.3),([37,38],89.6),([39],92.3),([40],95.25)]
log = subprocess.run(['ffmpeg','-hide_banner','-i',src,'-af','silencedetect=noise=-38dB:d=0.18','-f','null','-'],capture_output=True,text=True).stderr
ss = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]; se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
w = wave.open(src); sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32); dur = len(a)/sr
starts = [0.0] + se; ends = ss + ([dur] if len(ss) == len(se) else [])
chunks = [(s, e) for s, e in zip(starts, ends) if e - s > .05]
assert len(chunks) == 41, len(chunks)
PAD = .08
out = np.zeros(int(TOTAL*sr), np.float32); prev = 0
for idx, t in PLAN:
    s = max(0, chunks[idx[0]][0]-PAD); e = min(dur, chunks[idx[-1]][1]+PAD)
    seg = a[int(s*sr):int(e*sr)].copy(); f = int(.02*sr); seg[:f] *= np.linspace(0,1,f); seg[-f:] *= np.linspace(1,0,f)
    at = max(t + .05 - PAD, prev + .1)            # voice starts ~50 ms after the caption appears
    if at > t + .3: print(f'shifted {idx} by {at-t:.2f}s')
    i = int(at*sr); out[i:i+len(seg)] += seg[:len(out)-i]; prev = at + len(seg)/sr
    print(f'{idx} caption {t:5.1f}  voice {at+PAD:5.2f}-{prev-PAD:5.2f}')
o = wave.open(dst,'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(np.clip(out,-32768,32767).astype(np.int16).tobytes()); o.close()
