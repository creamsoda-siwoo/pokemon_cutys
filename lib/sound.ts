// 간단한 8비트 효과음 (Web Audio API, 파일 없음)

export type Sfx = "click" | "hit" | "super" | "weak" | "heal" | "ball" | "catch" | "faint" | "win" | "levelup" | "evolve" | "fanfare" | "buy" | "lose";

let ctx: AudioContext | null = null;
let muted = false;

export function loadMuted() {
  try { muted = localStorage.getItem("pkrpg-muted") === "1"; } catch {}
  return muted;
}
export function setMuted(v: boolean) {
  muted = v;
  try { localStorage.setItem("pkrpg-muted", v ? "1" : "0"); } catch {}
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.05, slide = 0, delay = 0) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  } catch {}
}
const seq = (notes: number[], step: number, dur = step, type: OscillatorType = "square") =>
  notes.forEach((f, i) => tone(f, dur, type, 0.05, 0, i * step));

export function sfx(name: Sfx) {
  if (muted || typeof window === "undefined") return;
  switch (name) {
    case "click": tone(660, 0.05, "square", 0.03); break;
    case "hit": tone(220, 0.15, "sawtooth", 0.06, -120); break;
    case "super": tone(300, 0.1, "sawtooth", 0.07, -200); tone(150, 0.2, "square", 0.06, -80, 0.08); break;
    case "weak": tone(180, 0.12, "triangle", 0.05, -60); break;
    case "heal": seq([523, 659, 784], 0.08, 0.1, "sine"); break;
    case "ball": tone(400, 0.12, "triangle", 0.05, 400); break;
    case "catch": seq([784, 988, 1175, 1568], 0.1, 0.12); break;
    case "faint": tone(500, 0.5, "square", 0.05, -420); break;
    case "win": seq([523, 659, 784, 1047], 0.11, 0.14); break;
    case "levelup": seq([659, 784, 988, 1319], 0.07, 0.09); break;
    case "evolve": seq([392, 440, 494, 523, 587, 659, 698, 784, 880, 988], 0.2, 0.18, "triangle"); break;
    case "fanfare": seq([523, 523, 523, 698, 880, 784, 880, 1047], 0.12, 0.14); break;
    case "buy": seq([988, 1319], 0.07, 0.1, "sine"); break;
    case "lose": seq([392, 349, 330, 262], 0.22, 0.25, "triangle"); break;
  }
}

// ---------- 포켓몬 울음소리 (PokeAPI cries) ----------
let lastCry: HTMLAudioElement | null = null;
export function cry(id: number) {
  if (muted || typeof window === "undefined") return;
  try {
    lastCry?.pause();
    const a = new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`);
    a.volume = 0.3;
    lastCry = a;
    void a.play().catch(() => {});
  } catch {}
}
