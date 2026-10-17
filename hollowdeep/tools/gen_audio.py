"""Synthesises all sound effects and music for Hollowdeep (original, procedural).

Run: python3 tools/gen_audio.py   (from hollowdeep/)
Requires numpy and ffmpeg (for ogg music).
"""
import os
import subprocess
import wave
import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(2024)


def t(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=0.005, d=0.1, curve=4.0):
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4)) * np.exp(-np.maximum(0, x - a) * curve / max(d, 1e-4))
    return e


def adsr(n, a, dcy, s, r):
    out = np.ones(n) * s
    ai = int(a * SR)
    di = int(dcy * SR)
    ri = int(r * SR)
    out[:ai] = np.linspace(0, 1, ai)
    out[ai:ai + di] = np.linspace(1, s, len(out[ai:ai + di]))
    if ri > 0:
        out[-ri:] *= np.linspace(1, 0, ri)
    return out


def noise(n):
    return rng.uniform(-1, 1, n)


def lowpass(x, cutoff):
    """One-pole lowpass; cutoff may be an array."""
    cutoff = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def lp_fast(x, cutoff):
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    from itertools import accumulate
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lp_fast(x, cutoff)


def bandpass(x, lo, hi):
    return highpass(lp_fast(x, hi), lo)


def reverb(x, room=0.5, mix=0.3):
    delays = [1557, 1617, 1491, 1422, 1277, 1356]
    out = np.zeros(len(x) + SR * 2)
    out[:len(x)] = x
    wet = np.zeros_like(out)
    for d in delays:
        d = int(d * (0.6 + room))
        buf = np.zeros_like(out)
        g = 0.72 + room * 0.2
        for k in range(1, 12):
            idx = d * k
            if idx >= len(out):
                break
            buf[idx:] += out[:len(out) - idx] * (g ** k)
        wet += buf
    wet /= len(delays)
    wet = lp_fast(wet, 3000)
    res = out * (1 - mix) + wet * mix * 2
    # trim trailing silence
    nz = np.where(np.abs(res) > 1e-3)[0]
    end = nz[-1] + 1 if len(nz) else len(res)
    return res[:end]


def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def write(name, x, peak=0.9, rate=SR):
    x = norm(x, peak)
    # fade edges to avoid clicks
    f = min(len(x) // 10, 200)
    if f > 0:
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())
    print("wrote", name, f"{len(x) / SR:.2f}s")
    return path


def sweep(f0, f1, d, shape="sin"):
    n = int(SR * d)
    f = np.geomspace(f0, f1, n)
    ph = np.cumsum(f) / SR * 2 * np.pi
    if shape == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if shape == "sq":
        return np.sign(np.sin(ph))
    return np.sin(ph)


def pluck(freq, d, bright=0.5, decay=0.996):
    """Karplus-Strong string."""
    n = int(SR * d)
    p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p) * bright + rng.uniform(-1, 1, p) * (1 - bright) * 0.3
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = decay * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out


def growl(f0, d, rough=0.6, formant=600):
    n = int(SR * d)
    tt = np.arange(n) / SR
    vib = 1 + 0.08 * np.sin(2 * np.pi * 7 * tt) + rough * 0.15 * lp_fast(noise(n), 40) * 6
    ph = np.cumsum(f0 * vib) / SR * 2 * np.pi
    src = (2 * ((ph / (2 * np.pi)) % 1) - 1) + rough * noise(n) * 0.6
    return bandpass(src, formant * 0.3, formant * 1.6)


def sfx():
    # --- combat ---
    n = int(SR * 0.28)
    x = bandpass(noise(n), 300, 2600) * np.sin(np.linspace(0, np.pi, n)) ** 2
    write("swing", x, 0.6)
    n = int(SR * 0.22)
    x = bandpass(noise(n), 900, 5000) * np.sin(np.linspace(0, np.pi, n)) ** 3
    write("swing2", x, 0.55)
    n = int(SR * 0.25)
    thump = np.sin(2 * np.pi * np.cumsum(np.geomspace(160, 50, n)) / SR) * env(n, 0.002, 0.08, 5)
    squish = lp_fast(noise(n), 1400) * env(n, 0.001, 0.06, 6)
    write("hit_flesh", thump + squish * 1.5, 0.85)
    n = int(SR * 0.3)
    crack = highpass(noise(n), 1500) * env(n, 0.0005, 0.02, 8)
    knock = np.sin(2 * np.pi * 900 * t(0.3)) * env(n, 0.001, 0.04, 6) + np.sin(2 * np.pi * 1350 * t(0.3)) * env(n, 0.001, 0.03, 6)
    write("hit_bone", crack + knock * 0.7, 0.8)
    n = int(SR * 0.6)
    ring = sum(np.sin(2 * np.pi * f * t(0.6)) * env(n, 0.001, 0.25, 4) * a for f, a in [(1130, 1), (2370, 0.6), (3410, 0.4), (4900, 0.2)])
    write("hit_metal", ring + highpass(noise(n), 3000) * env(n, 0.001, 0.02, 8), 0.6)
    n = int(SR * 0.4)
    write("player_hurt", growl(140, 0.4, 0.8, 700) * adsr(n, 0.02, 0.1, 0.6, 0.2) + lp_fast(noise(n), 800) * env(n, 0.001, 0.05, 6) * 0.5, 0.8)
    n = int(SR * 1.6)
    write("player_death", reverb(growl(110, 1.6, 0.9, 600) * np.geomspace(1, 0.01, n), 0.6, 0.4), 0.85)
    # --- monsters ---
    write("ghoul_aggro", reverb(growl(70, 0.9, 0.9, 500) * adsr(int(SR * 0.9), 0.1, 0.2, 0.7, 0.4), 0.4, 0.25), 0.8)
    write("ghoul_death", reverb(growl(55, 1.0, 1.0, 420) * np.geomspace(1, 0.02, int(SR * 1.0)) + lp_fast(noise(int(SR * 1.0)), 500) * env(int(SR * 1.0), 0.001, 0.2, 4), 0.4, 0.3), 0.85)
    n = int(SR * 0.5)
    sc = sweep(900, 1500, 0.5, "saw") * adsr(n, 0.01, 0.1, 0.6, 0.25) * (1 + 0.5 * np.sin(2 * np.pi * 30 * t(0.5)))
    write("imp_aggro", bandpass(sc, 600, 4000), 0.6)
    sc = sweep(1400, 400, 0.6, "saw") * env(int(SR * 0.6), 0.005, 0.4, 3) * (1 + 0.6 * np.sin(2 * np.pi * 40 * t(0.6)))
    write("imp_death", bandpass(sc, 400, 4000), 0.65)
    n = int(SR * 0.6)
    rattle = np.zeros(n)
    for k in range(14):
        pos = int(rng.uniform(0, 0.5) * SR)
        m = int(SR * 0.03)
        if pos + m < n:
            rattle[pos:pos + m] += highpass(noise(m), 2000) * env(m, 0.0005, 0.01, 6) * rng.uniform(0.4, 1)
    write("skel_aggro", rattle, 0.6)
    n = int(SR * 1.0)
    clatter = np.zeros(n)
    for k in range(26):
        pos = int((k / 26) ** 1.5 * 0.85 * SR)
        m = int(SR * 0.05)
        f = rng.uniform(700, 1800)
        clatter[pos:pos + m] += (np.sin(2 * np.pi * f * t(0.05)) + highpass(noise(m), 1500) * 0.6) * env(m, 0.0005, 0.02, 6) * rng.uniform(0.3, 1)
    write("skel_death", reverb(clatter, 0.3, 0.2), 0.7)
    write("brute_aggro", reverb(growl(48, 1.6, 1.0, 380) * adsr(int(SR * 1.6), 0.1, 0.3, 0.8, 0.6), 0.7, 0.35), 0.95)
    write("brute_death", reverb(growl(40, 2.4, 1.0, 330) * np.geomspace(1, 0.01, int(SR * 2.4)), 0.8, 0.4), 0.95)
    n = int(SR * 1.8)
    wail = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.03 * np.sin(2 * np.pi * 5 * t(1.8)) + np.linspace(0, 0.4, n))) / SR) * a for f, a in [(320, 1), (480, 0.5), (650, 0.3)])
    write("matron_aggro", reverb(wail * adsr(n, 0.3, 0.3, 0.7, 0.7), 0.8, 0.5), 0.75)
    write("matron_death", reverb(sum(np.sin(2 * np.pi * np.cumsum(np.geomspace(f, f * 0.3, int(SR * 2.5))) / SR) for f in (400, 610, 830)) * np.geomspace(1, 0.01, int(SR * 2.5)), 0.9, 0.5), 0.8)
    write("cultist_aggro", reverb(growl(120, 0.7, 0.4, 900) * adsr(int(SR * 0.7), 0.05, 0.2, 0.5, 0.3), 0.5, 0.3), 0.7)
    write("cultist_death", reverb(growl(100, 0.9, 0.6, 800) * np.geomspace(1, 0.02, int(SR * 0.9)), 0.5, 0.3), 0.75)
    # --- magic ---
    n = int(SR * 0.6)
    fire = bandpass(noise(n), 200, 2500) * adsr(n, 0.05, 0.1, 0.7, 0.3) * (1 + 0.4 * lp_fast(noise(n), 20) * 5)
    write("firebolt", fire + sweep(200, 900, 0.6) * env(n, 0.01, 0.3, 3) * 0.3, 0.7)
    n = int(SR * 0.9)
    boom = lp_fast(noise(n), 900) * env(n, 0.002, 0.3, 4) + np.sin(2 * np.pi * np.cumsum(np.geomspace(120, 35, n)) / SR) * env(n, 0.001, 0.25, 4)
    write("explode", reverb(boom, 0.5, 0.3), 0.9)
    n = int(SR * 1.0)
    shimmer = sum(np.sin(2 * np.pi * f * t(1.0) + rng.uniform(0, 6)) * np.clip(np.sin(np.pi * (t(1.0) - k * 0.08) / 0.5), 0, 1) for k, f in enumerate([523, 659, 784, 1046, 1318]))
    write("heal", reverb(shimmer * adsr(n, 0.02, 0.2, 0.6, 0.5), 0.6, 0.4), 0.6)
    n = int(SR * 0.5)
    write("magic_bolt", reverb(sweep(1800, 300, 0.5, "sq") * env(n, 0.005, 0.25, 3) * 0.4 + bandpass(noise(n), 1000, 6000) * env(n, 0.001, 0.1, 4) * 0.4, 0.4, 0.3), 0.6)
    n = int(SR * 0.3)
    twang = sum(np.sin(2 * np.pi * f * t(0.3)) * a for f, a in [(220, 1), (440, 0.4), (660, 0.2)]) * env(n, 0.001, 0.12, 4)
    write("bow", twang + bandpass(noise(n), 1500, 6000) * env(n, 0.001, 0.05, 6) * 0.5, 0.7)
    n = int(SR * 1.4)
    write("portal", reverb(sweep(150, 900, 1.4, "saw") * adsr(n, 0.2, 0.2, 0.7, 0.6) * 0.3 + bandpass(noise(n), 400, 3000) * adsr(n, 0.3, 0.3, 0.5, 0.6), 0.7, 0.5), 0.7)
    # --- world ---
    for i in range(3):
        n = int(SR * 0.16)
        x = lp_fast(noise(n), 500 + i * 120) * env(n, 0.002, 0.04, 5) + highpass(noise(n), 3000) * env(n, 0.001, 0.015, 6) * 0.25
        write(f"step{i}", x, 0.45)
    n = int(SR * 1.2)
    creak = np.sin(2 * np.pi * np.cumsum(220 + 90 * np.sin(2 * np.pi * 1.1 * t(1.2)) + 40 * lp_fast(noise(n), 30) * 8) / SR)
    creak = bandpass(np.sign(creak) * (np.abs(creak) ** 0.3), 300, 3000) * adsr(n, 0.05, 0.2, 0.6, 0.4)
    write("door", reverb(creak, 0.5, 0.3), 0.6)
    n = int(SR * 0.7)
    x = np.zeros(n)
    for k in range(5):
        pos = int(rng.uniform(0, 0.3) * SR)
        m = int(SR * 0.12)
        x[pos:pos + m] += bandpass(noise(m), 200, 2500) * env(m, 0.001, 0.05, 5)
    write("break_wood", reverb(x + lp_fast(noise(n), 200) * env(n, 0.001, 0.1, 5), 0.3, 0.2), 0.8)
    write("chest", reverb(creak[: int(SR * 0.7)] * 0.6 + lp_fast(noise(int(SR * 0.7)), 300) * env(int(SR * 0.7), 0.4, 0.1, 5), 0.4, 0.3), 0.6)
    n = int(SR * 0.6)
    coins = np.zeros(n)
    for k in range(9):
        pos = int(rng.uniform(0, 0.35) * SR)
        m = int(SR * 0.2)
        f = rng.uniform(2500, 5200)
        coins[pos:pos + m] += np.sin(2 * np.pi * f * t(0.2)) * env(m, 0.0005, 0.06, 5) * rng.uniform(0.3, 1)
    write("gold", coins, 0.55)
    n = int(SR * 0.3)
    write("pickup", lp_fast(noise(n), 1200) * env(n, 0.002, 0.05, 5) + np.sin(2 * np.pi * 330 * t(0.3)) * env(n, 0.001, 0.08, 5) * 0.4, 0.6)
    n = int(SR * 0.8)
    glug = np.zeros(n)
    for k in range(4):
        pos = int(k * 0.15 * SR)
        m = int(SR * 0.14)
        glug[pos:pos + m] += np.sin(2 * np.pi * np.cumsum(np.geomspace(300, 700, m)) / SR) * env(m, 0.005, 0.07, 4)
    write("drink", lp_fast(glug, 2000), 0.6)
    n = int(SR * 1.6)
    notes = [392, 494, 587, 784]
    lv = np.zeros(n)
    for k, f in enumerate(notes):
        off = int(k * 0.12 * SR)
        pl = pluck(f, 1.6, 0.7, 0.998)[: n - off]
        lv[off:off + len(pl)] += pl
    write("levelup", reverb(lv, 0.7, 0.4), 0.7)
    n = int(SR * 0.07)
    write("click", bandpass(noise(n), 800, 4000) * env(n, 0.0005, 0.01, 6), 0.4)
    n = int(SR * 0.25)
    write("error", sweep(220, 160, 0.25, "sq") * env(n, 0.005, 0.12, 3) * 0.5, 0.4)
    n = int(SR * 1.2)
    steps = np.concatenate([np.pad(lp_fast(noise(int(SR * 0.12)), 400 - k * 40) * env(int(SR * 0.12), 0.002, 0.04, 5), (0, int(SR * 0.06))) * (1 - k * 0.15) for k in range(5)])
    write("stairs", reverb(steps, 0.6, 0.35), 0.7)
    n = int(SR * 3.0)
    # torch crackle loop (seamless-ish)
    cr = lp_fast(noise(n), 900) * 0.15
    for k in range(60):
        pos = int(rng.uniform(0, 2.9) * SR)
        m = int(SR * 0.01)
        cr[pos:pos + m] += highpass(noise(m), 2000) * rng.uniform(0.2, 1)
    write("fire_loop", cr, 0.35)


# ------------------------------------------------------------------ music
def note_freq(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def music_town():
    """Melancholic plucked-string piece, 12 bars of 3/4 at 72 bpm, D minor feel."""
    bpm = 72
    beat = 60 / bpm
    bars = 16
    total = bars * 3 * beat
    n = int(SR * total) + SR * 3
    out = np.zeros(n)
    # chord roots (MIDI) — original progression
    prog = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61],
            [50, 57, 62, 65], [43, 50, 55, 58], [45, 52, 57, 64], [45, 52, 57, 61]]
    pattern = [0, 2, 3, 1, 2, 3]
    melody = [74, None, 72, 70, None, 69, 70, None, 72, 69, None, None,
              74, None, 77, 76, None, 74, 72, None, 70, 69, None, None,
              77, None, 76, 74, None, 72, 70, None, 72, 74, None, 70,
              69, None, 67, 69, None, 70, 72, None, 69, 69, None, None]
    step = beat / 2
    for b in range(bars):
        ch = prog[b % len(prog)]
        for i, p in enumerate(pattern):
            pos = int(((b * 3) * beat + i * step) * SR)
            s = pluck(note_freq(ch[p]), 2.2, 0.55, 0.9965) * 0.5
            out[pos:pos + len(s)] += s[: n - pos]
        # bass
        pos = int((b * 3 * beat) * SR)
        bs = pluck(note_freq(ch[0] - 12), 3.0, 0.4, 0.998) * 0.6
        out[pos:pos + len(bs)] += bs[: n - pos]
    # melody (second half of each 8 bars)
    for k, m in enumerate(melody * 2):
        if m is None:
            continue
        tpos = (k * beat / 2) + 4 * 3 * beat * (k // len(melody))
        pos = int(tpos * SR)
        if pos >= n:
            break
        s = pluck(note_freq(m), 2.5, 0.8, 0.9975) * 0.35
        out[pos:pos + len(s)] += s[: n - pos]
    out = reverb(out, 0.7, 0.35)
    loop_len = int(SR * total)
    # fold the tail back onto the start for a seamless loop
    tail = out[loop_len:]
    res = out[:loop_len].copy()
    res[: len(tail)] += tail[: loop_len]
    return res


def music_dungeon():
    """Dark ambient drone loop, 48s."""
    d = 48.0
    n = int(SR * d)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for f, a, lfo in [(55, 0.5, 0.05), (55 * 1.5, 0.25, 0.031), (55 * 2.02, 0.18, 0.07), (41.2, 0.4, 0.021)]:
        ph = 2 * np.pi * f * tt
        mod = 0.5 + 0.5 * np.sin(2 * np.pi * lfo * tt * (48 * lfo // 1 + 1) / (48 * lfo) if lfo else 0)
        out += np.sin(ph + 0.6 * np.sin(2 * np.pi * f * 0.5 * tt)) * a * (0.6 + 0.4 * np.sin(2 * np.pi * tt / d * (1 + int(lfo * 40))))
    wind = bandpass(noise(n), 150, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * tt * 3 / d)) * 0.35
    out += wind
    # distant metallic hits / bells
    for k in range(7):
        pos = int(rng.uniform(2, d - 6) * SR)
        f = rng.choice([110, 146.8, 164.8, 98])
        m = int(SR * 5)
        bell = sum(np.sin(2 * np.pi * f * r * t(5)) * a for r, a in [(1, 1), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)]) * env(m, 0.002, 2.0, 3)
        out[pos:pos + m] += bell[: n - pos] * 0.25
    out = reverb(out, 0.9, 0.5)
    tail = out[n:]
    res = out[:n].copy()
    res[: len(tail)] += tail[:n]
    return res


def music_boss():
    """Pounding ritual drums with low brass stabs, 16s loop at 100bpm."""
    bpm = 100
    beat = 60 / bpm
    bars = 8
    total = bars * 4 * beat
    n = int(SR * total)
    out = np.zeros(n + SR * 2)
    kick_pat = [0, 1.5, 2, 3, 3.5]
    for b in range(bars):
        for kp in kick_pat:
            pos = int((b * 4 + kp) * beat * SR)
            m = int(SR * 0.5)
            k = np.sin(2 * np.pi * np.cumsum(np.geomspace(110, 40, m)) / SR) * env(m, 0.001, 0.25, 4)
            out[pos:pos + m] += k
        for sp in [1, 3]:
            pos = int((b * 4 + sp) * beat * SR)
            m = int(SR * 0.3)
            out[pos:pos + m] += bandpass(noise(m), 200, 3000) * env(m, 0.001, 0.1, 5) * 0.5
        root = [38, 38, 41, 36][b % 4]
        pos = int((b * 4) * beat * SR)
        m = int(SR * beat * 2.5)
        tt = np.arange(m) / SR
        br = sum(2 * ((note_freq(root + iv) * tt) % 1) - 1 for iv in (0, 7, 12))
        br = lp_fast(br, 700) * adsr(m, 0.08, 0.3, 0.6, 0.5) * 0.35
        out[pos:pos + m] += br
    out = reverb(out, 0.6, 0.3)
    res = out[:n].copy()
    tail = out[n:]
    res[: len(tail)] += tail[:n]
    return res


def write_ogg(name, x):
    wav = write(name + "_tmp", x, 0.8)
    ogg = os.path.join(OUT, name + ".ogg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "3", ogg], check=True)
    os.remove(wav)
    print("wrote", ogg)


if __name__ == "__main__":
    sfx()
    write_ogg("music_town", music_town())
    write_ogg("music_dungeon", music_dungeon())
    write_ogg("music_boss", music_boss())
