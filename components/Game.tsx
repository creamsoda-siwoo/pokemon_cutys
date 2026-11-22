"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACHIEVEMENTS, art, DIFFICULTY, Difficulty, effectiveness, endlessStage, evoLine, FLOORS_PER_REGION, getRegion, isEndless,
  EMPTY_ITEMS, formAtLevel, ItemKey, ITEMS, MOVES, REGIONS, RIVAL_NAME, RIVAL_STARTER, SHINY_RATE, STONE_KEYS, STONES,
  SPECIES, STARTERS, TYPE_COLOR, Type,
} from "@/lib/data";
import {
  canEvolve, catchChance, effectiveSpeed, enemyChoose, evolve, Fighter, giveXp, levelUp, makeMon, Mon,
  monArt, monMoves, performMove, pick, randInt, rnd, sp, stats, xpNeeded, xpReward,
} from "@/lib/engine";
import { cry, loadMuted, setMuted, sfx } from "@/lib/sound";

function evSound(ev?: { text: string; hit?: string; dmg?: { color: string; text: string }; ball?: boolean }) {
  if (!ev) return;
  if (ev.text.includes("쓰러졌다")) sfx("faint");
  else if (ev.ball) sfx("ball");
  else if (ev.hit) sfx(ev.dmg?.color === "#f97316" ? "super" : ev.dmg?.color === "#94a3b8" ? "weak" : "hit");
  else if (ev.dmg?.text.startsWith("+")) sfx("heal");
}

// ---------------- 타입 ----------------
type NodeKind = "battle" | "elite" | "camp" | "shop" | "event" | "boss" | "rival";
const TYPES = Object.keys(TYPE_COLOR) as Type[];
type Screen = "title" | "starter" | "map" | "battle" | "camp" | "shop" | "event" | "recruit" | "evolve" | "gameover" | "victory";

interface Run {
  party: Mon[]; gold: number; items: Record<ItemKey, number>;
  region: number; floor: number; choices: NodeKind[]; wins: number; caught: number;
  difficulty?: Difficulty;
  starter?: number; rivalWins?: number;
}
interface Meta { dex: number[]; bestRegion: number; clears: number; ach?: string[]; shinies?: number[]; bestEndless?: number }
interface After { evos: string[]; recruit: Mon | null; next: "map" | "region" | "victory" | "stay"; stoneTo?: number }

interface Ev {
  text: string; pHp: number; pIdx: number; eHp: number; eRef?: Mon;
  hit?: "p" | "e"; dmg?: { side: "p" | "e"; text: string; color: string }; ball?: boolean;
}
type Phase = "choose" | "anim" | "forceSwitch" | "won" | "lost";
interface Battle {
  kind: "wild" | "elite" | "boss" | "trainer";
  queue: Mon[]; defeated: Mon[];
  party: Mon[]; active: number; pf: Fighter; ef: Fighter;
  items: Record<ItemKey, number>;
  events: Ev[]; evIdx: number; phase: Phase; outcome?: "won" | "lost" | "caught" | "switch";
  result: string[]; gold: number; dropItem?: ItemKey; caught?: boolean;
}

const NODE_INFO: Record<NodeKind, { emoji: string; name: string; desc: string }> = {
  battle: { emoji: "⚔️", name: "야생 포켓몬", desc: "배틀 후 동료가 될 수도!" },
  elite: { emoji: "💀", name: "강한 포켓몬", desc: "어렵지만 보상 2배 + 아이템" },
  camp: { emoji: "⛺", name: "휴식 캠프", desc: "파티 전원 완전 회복" },
  shop: { emoji: "🛒", name: "상점", desc: "아이템 구매" },
  event: { emoji: "🎁", name: "수상한 장소", desc: "무슨 일이 생길까?" },
  boss: { emoji: "👑", name: "보스", desc: "지역의 주인과 대결!" },
  rival: { emoji: "🧢", name: `라이벌 ${RIVAL_NAME}`, desc: "트레이너 배틀! 이기면 진화의 돌" },
};

const MAX_PARTY = 4;
const SAVE_KEY = "pkrpg-run";
const META_KEY = "pkrpg-meta";

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function genChoices(region: number, floor: number): NodeKind[] {
  if (floor >= FLOORS_PER_REGION - 1 || getRegion(region).wild.length === 0) return ["boss"];
  const weights: [NodeKind, number][] = [["battle", 45], ["elite", floor >= 1 ? 16 : 0], ["camp", 12], ["shop", 12], ["event", 15], ["rival", floor >= 2 ? 11 : 0]];
  const roll = () => {
    let r = rnd() * weights.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of weights) { if ((r -= w) < 0) return k; }
    return "battle";
  };
  const n = floor === 0 ? 2 : 3;
  const out: NodeKind[] = [];
  while (out.length < n) { const k = roll(); if (!out.includes(k) || k === "battle") out.push(k); }
  if (!out.includes("battle") && !out.includes("elite")) out[0] = "battle";
  return out;
}

// ---------------- 작은 UI 조각 ----------------
function TypeBadge({ t }: { t: Type }) {
  return <span className="badge" style={{ background: TYPE_COLOR[t] }}>{t}</span>;
}
function HpBar({ hp, max }: { hp: number; max: number }) {
  const r = Math.max(0, hp / max);
  const c = r > 0.5 ? "#22c55e" : r > 0.2 ? "#eab308" : "#ef4444";
  return (
    <div className="hpwrap">
      <div className="hpbar"><div style={{ width: `${r * 100}%`, background: c }} /></div>
      <span className="hptext">{Math.max(0, hp)} / {max}</span>
    </div>
  );
}
function MonMini({ m, onClick, active, extra }: { m: Mon; onClick?: () => void; active?: boolean; extra?: React.ReactNode }) {
  const st = stats(m);
  return (
    <div className={`monmini ${m.hp <= 0 ? "fainted" : ""} ${active ? "active" : ""} ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <img src={monArt(m)} alt={sp(m).name} />
      <div className="mm-body">
        <div className="mm-name">{m.shiny && <span title="색이 다른 포켓몬">✨</span>}<b>{sp(m).name}</b> <small>Lv.{m.level}</small> <TypeBadge t={sp(m).type} />
          {m.status === "burn" && " 🔥"}{m.status === "paralyze" && " ⚡"}</div>
        <HpBar hp={m.hp} max={st.maxHp} />
        <div className="xpbar"><div style={{ width: `${(m.xp / xpNeeded(m.level)) * 100}%` }} /></div>
        {extra}
      </div>
    </div>
  );
}

// ================== 메인 ==================
export default function Game() {
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<Run | null>(null);
  const [meta, setMeta] = useState<Meta>({ dex: [], bestRegion: 0, clears: 0 });
  const [hasSave, setHasSave] = useState(false);
  const [after, setAfter] = useState<After | null>(null);
  const [eventView, setEventView] = useState<{ title: string; text: string; img?: string; emoji?: string } | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState(false);
  const [evoStage, setEvoStage] = useState(0);
  const [mute, setMute] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [achToast, setAchToast] = useState<string | null>(null);
  const [diff, setDiff] = useState<Difficulty>("normal");
  const [detail, setDetail] = useState<Mon | null>(null);

  const bRef = useRef<Battle | null>(null);
  const [battleView, setBattleView] = useState<Battle | null>(null);
  const rerender = () => setBattleView(bRef.current ? { ...bRef.current } : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 불러오기
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeta(load(META_KEY, { dex: [], bestRegion: 0, clears: 0 }));
    setMute(loadMuted());
    setHasSave(!!load<Run | null>(SAVE_KEY, null));
  }, []);
  // 저장 (전투 밖)
  useEffect(() => { if (run && screen !== "battle") save(SAVE_KEY, run); }, [run, screen]);
  useEffect(() => { save(META_KEY, meta); }, [meta]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const addDex = useCallback((...ids: number[]) => {
    setMeta(m => ({ ...m, dex: [...new Set([...m.dex, ...ids])] }));
  }, []);

  // 업적
  const unlock = useCallback((id: string) => {
    setMeta(m => {
      if (m.ach?.includes(id)) return m;
      const a = ACHIEVEMENTS.find(x => x.id === id);
      if (a) setAchToast(`${a.emoji} 업적 달성! ${a.name}`);
      return { ...m, ach: [...(m.ach ?? []), id] };
    });
  }, []);
  useEffect(() => {
    if (!achToast) return;
    sfx("levelup");
    const t = setTimeout(() => setAchToast(null), 2600);
    return () => clearTimeout(t);
  }, [achToast]);
  const gold = run?.gold ?? 0;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (gold >= 500) unlock("rich"); }, [gold, unlock]);
  const dexCount = meta.dex.length;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (dexCount >= 20) unlock("dex20"); if (dexCount >= 50) unlock("dex50"); }, [dexCount, unlock]);

  const difficulty = DIFFICULTY[run?.difficulty ?? "normal"];
  /** 적 포켓몬 생성: 난이도 배율 + 색이 다른 포켓몬 확률 */
  function makeFoe(id: number, level: number, boss = false): Mon {
    const m = makeMon(id, level, boss, true);
    m.foeMul = difficulty.foe;
    if (!boss && rnd() < SHINY_RATE) m.shiny = true;
    m.hp = stats(m).maxHp;
    return m;
  }

  // ---------- 진행 ----------
  function startRun(starterId: number) {
    const s = makeMon(starterId, 6);
    const r: Run = { party: [s], gold: 100, items: { ...EMPTY_ITEMS, potion: 3, ball: 3, revive: 1 }, starter: starterId,
      region: 0, floor: 0, choices: genChoices(0, 0), wins: 0, caught: 0, difficulty: diff };
    addDex(starterId);
    setRun(r); setScreen("map");
  }
  function continueRun() {
    const r = load<Run | null>(SAVE_KEY, null);
    if (r) { setRun({ ...r, items: { ...EMPTY_ITEMS, ...r.items } }); setScreen("map"); }
  }

  function advance(r: Run): Run {
    const floor = r.floor + 1;
    return { ...r, floor, choices: genChoices(r.region, floor) };
  }

  function chooseNode(k: NodeKind) {
    if (!run) return;
    const reg = getRegion(run.region);
    if (k === "battle" || k === "elite" || k === "boss") {
      let enemy: Mon;
      if (k === "boss") enemy = makeFoe(reg.boss.id, reg.boss.level, true);
      else if (k === "elite") enemy = makeFoe(pick(reg.elite), reg.levels[1] + randInt(1, 2));
      else enemy = makeFoe(pick(reg.wild), randInt(reg.levels[0], reg.levels[1]));
      startBattle(k === "battle" ? "wild" : k, enemy);
      return;
    }
    if (k === "rival") {
      const size = run.region < 2 ? 2 : 3;
      const ace = formAtLevel(RIVAL_STARTER[run.starter ?? 4] ?? 7, reg.levels[1] + 1);
      const team = [...Array(size - 1)].map(() => makeFoe(formAtLevel(pick(reg.wild.length ? reg.wild : reg.elite), reg.levels[1]), reg.levels[1]));
      team.forEach(m => { m.shiny = false; m.hp = stats(m).maxHp; });
      team.push(makeFoe(ace, reg.levels[1] + 1));
      team[team.length - 1].shiny = false; team[team.length - 1].hp = stats(team[team.length - 1]).maxHp;
      startBattle("trainer", team[0], team.slice(1));
      return;
    }
    if (k === "camp") {
      const party = run.party.map(m => ({ ...m, hp: stats(m).maxHp, status: undefined }));
      setRun({ ...run, party });
      setEventView({ title: "⛺ 휴식 캠프", text: "모닥불 앞에서 푹 쉬었다. 파티 전원의 HP가 완전히 회복되었다!", emoji: "🔥" });
      setScreen("event"); return;
    }
    if (k === "shop") { setScreen("shop"); return; }
    if (k === "event") { doEvent(); return; }
  }

  function doEvent() {
    if (!run) return;
    const reg = getRegion(run.region);
    const r = rnd();
    if (r < 0.25) {
      const g = randInt(40, 90) + run.region * 20;
      setRun({ ...run, gold: run.gold + g });
      setEventView({ title: "🎁 보물상자!", text: `반짝이는 상자 안에 ${g}G가 들어 있었다!`, emoji: "💰" });
    } else if (r < 0.45) {
      const key = pick<ItemKey>(["potion", "potion", "superPotion", "ball", "candy", "revive", ...(rnd() < 0.35 ? STONE_KEYS : [])]);
      setRun({ ...run, items: { ...run.items, [key]: run.items[key] + 1 } });
      setEventView({ title: "🎁 아이템 발견!", text: `풀숲에서 ${ITEMS[key].name}을(를) 주웠다!`, emoji: ITEMS[key].emoji });
    } else if (r < 0.65) {
      const m = makeMon(pick(reg.wild), reg.levels[0]);
      if (rnd() < SHINY_RATE * 2) { m.shiny = true; m.hp = stats(m).maxHp; }
      setAfter({ evos: [], recruit: m, next: "map" });
      setEventView({ title: "🥚 포켓몬 알!", img: monArt(m),
        text: `따뜻한 알이 부화했다! ${m.shiny ? "✨ 반짝반짝 빛나는 " : ""}${sp(m).name}이(가) 태어났다!` });
    } else if (r < 0.82) {
      const party = clone(run.party);
      const msgs: string[] = [];
      party.forEach(m => msgs.push(...giveXp(m, 25 + run.region * 25)));
      const evos = party.filter(canEvolve).map(m => m.uid);
      setRun({ ...run, party });
      if (evos.length) setAfter({ evos, recruit: null, next: "map" });
      setEventView({ title: "🏋️ 수련장", text: `떠돌이 트레이너와 함께 특훈을 했다! 파티 전원이 경험치를 얻었다.\n${msgs.join("\n")}`, emoji: "💪" });
    } else {
      const good = rnd() < 0.55;
      const party = run.party.map(m => {
        const mx = stats(m).maxHp;
        return good ? { ...m, hp: m.hp > 0 ? mx : m.hp } : { ...m, hp: m.hp > 0 ? Math.max(1, m.hp - Math.ceil(mx * 0.25)) : 0 };
      });
      setRun({ ...run, party });
      setEventView(good
        ? { title: "🍄 수상한 버섯", text: "맛있는 버섯이었다! 파티의 HP가 회복되었다.", emoji: "😋" }
        : { title: "🍄 수상한 버섯", text: "으악, 독버섯이었다! 파티가 피해를 입었다…", emoji: "🤢" });
    }
    setScreen("event");
  }

  function eventDone() {
    setEventView(null);
    if (after) { processAfter(after); return; }
    setRun(r => r && advance(r)); setScreen("map");
  }

  function processAfter(a: After) {
    if (a.evos.length) { setAfter(a); setEvoStage(0); setScreen("evolve"); return; }
    if (a.recruit) { setAfter(a); setSwapFor(false); setScreen("recruit"); cry(a.recruit.id); return; }
    setAfter(null);
    if (a.next === "stay") { setScreen("map"); return; }
    if (a.next === "victory") {
      setMeta(m => ({ ...m, clears: m.clears + 1, bestRegion: REGIONS.length }));
      unlock("champion");
      if (run?.difficulty === "hard") setTimeout(() => unlock("hard_clear"), 2800);
      save(SAVE_KEY, null); setHasSave(false); setScreen("victory"); return;
    }
    if (a.next === "region") {
      setRun(r => {
        if (!r) return r;
        const region = r.region + 1;
        setMeta(m => ({ ...m, bestRegion: Math.max(m.bestRegion, Math.min(region, REGIONS.length)),
          bestEndless: isEndless(r.region) ? Math.max(m.bestEndless ?? 0, endlessStage(r.region)) : m.bestEndless }));
        if (isEndless(r.region)) {
          const cleared = endlessStage(r.region);
          setTimeout(() => { unlock("endless_1"); if (cleared >= 5) unlock("endless_5"); }, 0);
        }
        return { ...r, region, floor: 0, choices: genChoices(region, 0),
          party: r.party.map(m => ({ ...m, hp: stats(m).maxHp, status: undefined })) };
      });
      setToast(run && isEndless(run.region) ? "♾️ 구역 돌파! 다음 구역은 더 강해요. 파티 회복 ✨" : "지역 클리어! 파티가 모두 회복되었다 ✨");
      setScreen("map"); return;
    }
    setRun(r => r && advance(r)); setScreen("map");
  }

  // 진화
  function doEvolve(to?: number) {
    if (!after) return;
    const uid = after.evos[0];
    unlock("evolve");
    if (run?.party.find(p => p.uid === uid)?.id === 133) setTimeout(() => unlock("eevee"), 2800);
    setRun(r => {
      if (!r) return r;
      const party = clone(r.party);
      const m = party.find(p => p.uid === uid);
      if (m) { evolve(m, to); addDex(m.id); }
      return { ...r, party };
    });
    sfx("fanfare");
    const cur = run?.party.find(p => p.uid === uid);
    const e = cur && sp(cur).evo;
    if (e) setTimeout(() => cry(to ?? e.to), 900);
    setEvoStage(2);
  }
  function evolveNext() {
    if (!after) return;
    processAfter({ ...after, evos: after.evos.slice(1), stoneTo: undefined });
  }

  // 영입
  function acceptRecruit(replaceIdx?: number) {
    if (!run || !after?.recruit) return;
    const m = { ...after.recruit, status: undefined, boss: false, foe: false };
    let party = [...run.party];
    if (party.length >= MAX_PARTY) {
      if (replaceIdx === undefined) { setSwapFor(true); return; }
      party = party.filter((_, i) => i !== replaceIdx);
    }
    party.push(m);
    addDex(m.id);
    if (party.length >= MAX_PARTY) unlock("full_party");
    if (m.shiny) { unlock("shiny"); setMeta(mt => ({ ...mt, shinies: [...new Set([...(mt.shinies ?? []), m.id])] })); }
    setRun({ ...run, party, caught: run.caught + 1 });
    setToast(`${sp(m).name}이(가) 동료가 되었다! 🎉`); sfx("catch");
    processAfter({ ...after, recruit: null });
  }
  function declineRecruit() { if (after) processAfter({ ...after, recruit: null }); }

  // 상점
  function buy(k: ItemKey) {
    if (!run || run.gold < ITEMS[k].price) return;
    setRun({ ...run, gold: run.gold - ITEMS[k].price, items: { ...run.items, [k]: run.items[k] + 1 } });
    setToast(`${ITEMS[k].name} 구매!`); sfx("buy");
  }

  // 파티 화면에서 아이템 사용
  function applyItemOutside(k: ItemKey, idx: number) {
    if (!run || run.items[k] <= 0) return;
    const party = clone(run.party);
    const m = party[idx], mx = stats(m).maxHp;
    let ok = false;
    if (k === "potion" && m.hp > 0 && m.hp < mx) { m.hp = Math.min(mx, m.hp + Math.ceil(mx / 2)); ok = true; }
    if (k === "superPotion" && m.hp > 0 && m.hp < mx) { m.hp = mx; m.status = undefined; ok = true; }
    if (k === "revive" && m.hp <= 0) { m.hp = Math.ceil(mx / 2); ok = true; }
    const msgs: string[] = [];
    if (k === "candy" && m.hp > 0) { levelUp(m, msgs); ok = true; }
    const stoneTo = STONES[k]?.[m.id];
    if (stoneTo) {
      if (m.hp <= 0) { setToast("기절한 포켓몬에게는 쓸 수 없어요"); return; }
      setRun({ ...run, items: { ...run.items, [k]: run.items[k] - 1 } });
      setPartyOpen(false); unlock("stone");
      processAfter({ evos: [m.uid], recruit: null, next: "stay", stoneTo });
      return;
    }
    if (!ok) { setToast("지금은 쓸 수 없어요"); return; }
    const items = { ...run.items, [k]: run.items[k] - 1 };
    setRun({ ...run, party, items });
    if (msgs.length) setToast(msgs[0]);
    if (canEvolve(m)) { setPartyOpen(false); processAfter({ evos: [m.uid], recruit: null, next: "stay" }); }
  }
  function startEndless() {
    if (!run) return;
    const region = REGIONS.length;
    setRun({ ...run, region, floor: 0, choices: genChoices(region, 0),
      party: run.party.map(m => ({ ...m, hp: stats(m).maxHp, status: undefined })) });
    setHasSave(true);
    setToast("♾️ 무한의 탑에 도전! 몇 구역까지 갈 수 있을까?");
    setScreen("map");
  }
  function setLead(idx: number) {
    if (!run) return;
    const party = [...run.party]; const [m] = party.splice(idx, 1); party.unshift(m);
    setRun({ ...run, party });
  }

  // ================== 전투 ==================
  function startBattle(kind: Battle["kind"], enemy: Mon, queue: Mon[] = []) {
    if (!run) return;
    const party = clone(run.party);
    const active = party.findIndex(m => m.hp > 0);
    const b: Battle = {
      kind, party, active, pf: { mon: party[active], atkStage: 0, defStage: 0 }, ef: { mon: enemy, atkStage: 0, defStage: 0 },
      items: { ...run.items }, events: [], evIdx: 0, phase: "anim", result: [], gold: 0, queue, defeated: [],
    };
    bRef.current = b;
    const intro = kind === "boss" ? `👑 ${getRegion(run.region).name}의 주인 ${sp(enemy).name}이(가) 나타났다!`
      : kind === "trainer" ? `🧢 라이벌 ${RIVAL_NAME}이(가) 승부를 걸어왔다! "이번엔 내가 이길 거야!"`
      : kind === "elite" ? `💀 강해 보이는 ${sp(enemy).name}이(가) 앞을 막아섰다!`
      : `야생의 ${sp(enemy).name}이(가) 튀어나왔다!`;
    const shinyIntro = enemy.shiny ? `✨ 반짝반짝! 색이 다른 ${sp(enemy).name}이다! (이기면 꼭 동료가 돼요)` : null;
    b.events = [
      { text: intro, pHp: b.pf.mon.hp, pIdx: active, eHp: enemy.hp, eRef: enemy },
      ...(kind === "trainer" ? [{ text: `${RIVAL_NAME}은(는) ${sp(enemy).name}을(를) 내보냈다!`, pHp: b.pf.mon.hp, pIdx: active, eHp: enemy.hp, eRef: enemy }] : []),
      ...(shinyIntro ? [{ text: shinyIntro, pHp: b.pf.mon.hp, pIdx: active, eHp: enemy.hp }] : []),
      { text: `가라, ${sp(b.pf.mon).name}!`, pHp: b.pf.mon.hp, pIdx: active, eHp: enemy.hp, eRef: enemy },
    ];
    b.outcome = undefined;
    setScreen("battle");
    if (enemy.shiny) sfx("catch");
    cry(enemy.id);
    play();
  }

  function play() {
    const b = bRef.current; if (!b) return;
    b.phase = "anim"; b.evIdx = 0; rerender();
    const step = () => {
      const bb = bRef.current; if (!bb) return;
      if (bb.evIdx < bb.events.length - 1) {
        bb.evIdx++; rerender(); evSound(bb.events[bb.evIdx]);
        timer.current = setTimeout(step, bb.events[bb.evIdx].hit ? 900 : 750);
      } else finishAnim();
    };
    timer.current = setTimeout(step, 850);
  }
  function skipAnim() {
    const b = bRef.current; if (!b || b.phase !== "anim") return;
    if (timer.current) clearTimeout(timer.current);
    b.evIdx = b.events.length - 1; finishAnim();
  }

  function finishAnim() {
    const b = bRef.current; if (!b) return;
    const o = b.outcome;
    if (o === "won" || o === "caught") { winBattle(); return; }
    if (o === "lost") { b.phase = "lost"; rerender(); sfx("lose"); return; }
    if (o === "switch") { b.phase = "forceSwitch"; rerender(); return; }
    b.phase = "choose"; rerender();
  }

  type Action = { kind: "move"; i: number } | { kind: "switch"; idx: number } | { kind: "item"; key: ItemKey };

  function act(action: Action) {
    const b = bRef.current; if (!b || b.phase !== "choose") return;
    const evs: Ev[] = [];
    const push = (text: string, extra: Partial<Ev> = {}) =>
      evs.push({ text, pHp: b.party[b.active].hp, pIdx: b.active, eHp: b.ef.mon.hp, eRef: b.ef.mon, ...extra });

    const attack = (att: Fighter, def: Fighter, side: "p" | "e", moveIdx?: number) => {
      if (att.mon.hp <= 0 || def.mon.hp <= 0) return;
      const name = sp(att.mon).name;
      if (att.mon.status === "paralyze" && rnd() < 0.25) { push(`${name}은(는) 몸이 저려서 움직일 수 없다! ⚡`); return; }
      const move = side === "p" ? monMoves(att.mon)[moveIdx!] : enemyChoose(att, def);
      const label = `${side === "e" ? (b.kind === "wild" ? "야생 " : "상대 ") : ""}${name}의 ${move.name}!`;
      push(label);
      const res = performMove(att, def, move);
      if (res.damage > 0) {
        const tgt = side === "p" ? "e" : "p";
        push(label, { hit: tgt, dmg: { side: tgt, text: `-${res.damage}${res.crit ? "!!" : ""}`, color: res.eff > 1 ? "#f97316" : res.eff < 1 ? "#94a3b8" : "#ef4444" } });
      }
      if (res.healed > 0) push(res.text.shift() ?? "", { dmg: { side, text: `+${res.healed}`, color: "#22c55e" } });
      res.text.forEach(t => push(t));
      if (def.mon.hp <= 0) push(`${sp(def.mon).name}은(는) 쓰러졌다!`);
    };

    if (action.kind === "switch") {
      push(`돌아와, ${sp(b.pf.mon).name}!`);
      b.active = action.idx; b.pf = { mon: b.party[action.idx], atkStage: 0, defStage: 0 };
      push(`가라, ${sp(b.pf.mon).name}!`);
      attack(b.ef, b.pf, "e");
    } else if (action.kind === "item") {
      const k = action.key; b.items[k]--;
      if (k === "ball") {
        push("몬스터볼을 던졌다!", { ball: true });
        const ok = rnd() < catchChance(b.ef.mon);
        push("흔들… 흔들…", { ball: true });
        if (ok) {
          push(`신난다! ${sp(b.ef.mon).name}을(를) 잡았다! 🎉`, { ball: true });
          b.caught = true; b.outcome = "caught"; b.events = evs; play(); return;
        }
        push(`아앗! ${sp(b.ef.mon).name}이(가) 볼에서 나와버렸다!`);
      } else {
        const m = b.pf.mon, mx = stats(m).maxHp;
        const h = k === "superPotion" ? mx - m.hp : Math.min(mx - m.hp, Math.ceil(mx / 2));
        m.hp += h; if (k === "superPotion") m.status = undefined;
        push(`${ITEMS[k].name}을(를) 사용했다! ${sp(m).name}의 HP가 회복되었다.`, { dmg: { side: "p", text: `+${h}`, color: "#22c55e" } });
      }
      attack(b.ef, b.pf, "e");
    } else {
      const move = monMoves(b.pf.mon)[action.i];
      const pFirst = move.effect === "priority" || effectiveSpeed(b.pf.mon) >= effectiveSpeed(b.ef.mon);
      if (pFirst) { attack(b.pf, b.ef, "p", action.i); attack(b.ef, b.pf, "e"); }
      else { attack(b.ef, b.pf, "e"); attack(b.pf, b.ef, "p", action.i); }
    }

    // 턴 종료: 화상
    for (const [f, side] of [[b.pf, "p"], [b.ef, "e"]] as [Fighter, "p" | "e"][]) {
      if (f.mon.hp > 0 && f.mon.status === "burn") {
        const d = Math.min(f.mon.hp, Math.ceil(stats(f.mon).maxHp / 12));
        f.mon.hp -= d;
        push(`${sp(f.mon).name}은(는) 화상 데미지를 입었다! 🔥`, { hit: side, dmg: { side, text: `-${d}`, color: "#f97316" } });
        if (f.mon.hp <= 0) push(`${sp(f.mon).name}은(는) 쓰러졌다!`);
      }
    }

    const playerDown = () => b.pf.mon.hp <= 0 ? (b.party.some(m => m.hp > 0) ? "switch" as const : "lost" as const) : undefined;
    if (b.ef.mon.hp <= 0) {
      b.defeated.push(b.ef.mon);
      if (b.queue.length) {
        b.ef = { mon: b.queue.shift()!, atkStage: 0, defStage: 0 };
        const last = b.queue.length === 0;
        push(`${RIVAL_NAME}은(는) ${last ? "마지막으로 파트너 " : ""}${sp(b.ef.mon).name}을(를) 내보냈다!`);
        b.outcome = playerDown();
        const nid = b.ef.mon.id; setTimeout(() => cry(nid), 900);
      } else b.outcome = "won";
    }
    else if (b.pf.mon.hp <= 0) b.outcome = playerDown();
    else b.outcome = undefined;
    if (b.outcome === "lost") push("눈앞이 깜깜해졌다…");
    b.events = evs; play();
  }

  function forceSwitch(idx: number) {
    const b = bRef.current; if (!b) return;
    b.active = idx; b.pf = { mon: b.party[idx], atkStage: 0, defStage: 0 };
    b.events = [{ text: `가라, ${sp(b.pf.mon).name}!`, pHp: b.pf.mon.hp, pIdx: idx, eHp: b.ef.mon.hp, eRef: b.ef.mon }];
    b.outcome = undefined; play();
  }

  function winBattle() {
    const b = bRef.current; if (!b || !run) return;
    const e = b.ef.mon;
    const beaten = b.defeated.length ? b.defeated : [e];
    const xp = beaten.reduce((a, m) => a + xpReward(m.level, b.kind), 0);
    const msgs: string[] = [];
    if (b.kind === "trainer") {
      msgs.push(`🧢 라이벌 ${RIVAL_NAME}과의 승부에서 이겼다!`);
      msgs.push(`${RIVAL_NAME}: "으으… 다음엔 꼭 이길 거야! 이거 받아!"`);
      const wins = (run.rivalWins ?? 0) + 1;
      unlock("rival"); if (wins >= 3) setTimeout(() => unlock("rival3"), 2800);
    } else if (!b.caught) msgs.push(`${sp(e).name}을(를) 쓰러뜨렸다!`);
    b.party.forEach((m, i) => {
      if (m.hp <= 0) return;
      const amt = i === b.active ? xp : Math.floor(xp * 0.6);
      msgs.push(`${sp(m).name}은(는) 경험치 ${amt}을(를) 얻었다.`);
      msgs.push(...giveXp(m, amt));
    });
    b.gold = Math.floor((b.kind === "trainer" ? beaten.reduce((a, m) => a + m.level * 8, 0)
      : e.level * 5 * (b.kind === "boss" ? 5 : b.kind === "elite" ? 2 : 1)) * difficulty.gold);
    msgs.push(`💰 ${b.gold}G를 얻었다!`);
    msgs.push(`💚 승리 보너스: 파티의 HP가 ${Math.round(difficulty.heal * 100)}% 회복된다.`);
    unlock("first_win");
    if (b.caught) unlock("catch");
    if (b.kind === "boss" && !isEndless(run.region)) unlock(`boss_${e.id}`);
    if (b.kind === "boss" && [249, 384, 151].includes(e.id)) unlock("legend");
    if (b.kind === "elite" || b.kind === "boss" || b.kind === "trainer") {
      b.dropItem = b.kind === "trainer" ? pick(STONE_KEYS) : pick<ItemKey>(["superPotion", "candy", "revive", "ball"]);
      msgs.push(`${ITEMS[b.dropItem].emoji} ${ITEMS[b.dropItem].name}을(를) 얻었다!`);
    }
    b.result = msgs; b.phase = "won"; rerender();
    sfx(b.caught ? "catch" : "win");
    if (msgs.some(t => t.includes("레벨이"))) setTimeout(() => sfx("levelup"), 700);
  }

  function leaveBattle() {
    const b = bRef.current; if (!b || !run) return;
    const party = b.party.map(m => { const mx = stats(m).maxHp; return { ...m, status: undefined, hp: m.hp > 0 ? Math.min(mx, m.hp + Math.ceil(mx * difficulty.heal)) : 0 }; });
    const items = { ...b.items }; if (b.dropItem) items[b.dropItem]++;
    let recruit: Mon | null = null;
    const e = b.ef.mon;
    if (b.caught) recruit = { ...e, xp: 0, status: undefined, foe: false, foeMul: undefined };
    else if (b.kind !== "boss" && b.kind !== "trainer" && (e.shiny || rnd() < (b.kind === "elite" ? 0.5 : 0.35))) {
      recruit = makeMon(e.id, e.level); recruit.shiny = e.shiny;
      recruit.hp = Math.ceil(stats(recruit).maxHp * 0.6);
    }
    const evos = party.filter(canEvolve).map(m => m.uid);
    const lastRegion = run.region === REGIONS.length - 1;
    setRun({ ...run, party, items, gold: run.gold + b.gold, wins: run.wins + 1,
      rivalWins: (run.rivalWins ?? 0) + (b.kind === "trainer" ? 1 : 0) });
    bRef.current = null;
    processAfter({ evos, recruit, next: b.kind === "boss" ? (lastRegion ? "victory" : "region") : "map" });
  }

  function gameOver() {
    const b = bRef.current;
    if (b && run) setRun({ ...run, party: b.party });
    bRef.current = null;
    if (run) setMeta(m => ({ ...m, bestRegion: Math.max(m.bestRegion, Math.min(run.region, REGIONS.length)) }));
    save(SAVE_KEY, null); setHasSave(false);
    setScreen("gameover");
  }

  // ================== 렌더 ==================
  const region = getRegion(run?.region ?? 0);

  return (
    <div className="game" style={{ ["--region-bg" as string]: region.bg }}>
      {toast && <div className="toast">{toast}</div>}
      {achToast && <div className="toast ach">{achToast}</div>}
      <div className="toolbar">
        <button title="타입 상성표" onClick={() => setHelpOpen(true)}>📊 상성표</button>
        <button title={mute ? "소리 켜기" : "소리 끄기"} onClick={() => { setMuted(!mute); setMute(!mute); if (mute) sfx("click"); }}>
          {mute ? "🔇" : "🔊"}
        </button>
      </div>
      {achOpen && (
        <div className="modal-bg" onClick={() => setAchOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🏅 업적 {meta.ach?.length ?? 0} / {ACHIEVEMENTS.length}</h2>
            <div className="achlist">
              {ACHIEVEMENTS.map(a => {
                const got = meta.ach?.includes(a.id);
                return (
                  <div key={a.id} className={`ach-item ${got ? "got" : ""}`}>
                    <span className="ach-emoji">{got ? a.emoji : "🔒"}</span>
                    <div><b>{a.name}</b><br /><small className="muted">{a.desc}</small></div>
                  </div>
                );
              })}
            </div>
            <button className="primary" onClick={() => setAchOpen(false)}>닫기</button>
          </div>
        </div>
      )}
      {helpOpen && (
        <div className="modal-bg" onClick={() => setHelpOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📊 타입 상성표</h2>
            <p className="muted small">왼쪽이 <b>공격하는 기술</b>, 위쪽이 <b>맞는 포켓몬</b>의 타입이에요.
              <span className="eff2"> 2 </span> 효과 굉장 · <span className="eff05"> ½ </span> 별로</p>
            <div className="typechart-wrap">
              <table className="typechart">
                <thead><tr><th></th>{TYPES.map(t => <th key={t}><TypeBadge t={t} /></th>)}</tr></thead>
                <tbody>
                  {TYPES.map(a => (
                    <tr key={a}><th><TypeBadge t={a} /></th>
                      {TYPES.map(d => { const e = effectiveness(a, d); return <td key={d} className={e > 1 ? "eff2" : e < 1 ? "eff05" : ""}>{e > 1 ? "2" : e < 1 ? "½" : ""}</td>; })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">💡 기술과 포켓몬 타입이 같으면 위력 1.3배! 이브이는 Lv.10에 5가지 중 원하는 모습으로 진화할 수 있어요.</p>
            <button className="primary" onClick={() => setHelpOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {screen === "title" && (
        <div className="panel center title">
          <div className="title-mons">
            {[25, 6, 9, 3, 150].map((id, i) => <img key={id} src={art(id)} alt="" style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
          <h1>포켓몬 모험 RPG</h1>
          <p className="muted">파트너와 함께 5개의 지역을 돌파하고 최후의 탑의 주인을 쓰러뜨려라!</p>
          <div className="btns">
            {hasSave && <button className="primary" onClick={continueRun}>▶ 이어하기</button>}
            <button className={hasSave ? "" : "primary"} onClick={() => setScreen("starter")}>✨ 새 모험 시작</button>
          </div>
          <div className="metarow">
            <span>📖 도감 {meta.dex.length} / {Object.keys(SPECIES).length}</span>
            <span>🏆 클리어 {meta.clears}회</span>
            <span>🗺️ 최고 도달 {meta.bestRegion >= REGIONS.length ? "정복!" : `${meta.bestRegion + 1}지역`}</span>
            <span>🌟 색이 다른 포켓몬 {meta.shinies?.length ?? 0}종</span>
            {(meta.bestEndless ?? 0) > 0 && <span>♾️ 무한의 탑 최고 {meta.bestEndless}구역</span>}
          </div>
          <button onClick={() => setAchOpen(true)}>🏅 업적 {meta.ach?.length ?? 0} / {ACHIEVEMENTS.length}</button>
          <div className="dexstrip">
            {Object.values(SPECIES).map(s => (
              <img key={s.id} src={art(s.id)} alt={s.name} title={meta.dex.includes(s.id) ? s.name : "???"}
                className={meta.dex.includes(s.id) ? "" : "unknown"} />
            ))}
          </div>
          <p className="muted small">다른 게임: <a href="/catch.html">포켓볼 던지기</a> · <a href="/memory.html">짝맞추기</a></p>
        </div>
      )}

      {screen === "starter" && (
        <div className="panel center">
          <h3>난이도</h3>
          <div className="difficulty">
            {(Object.keys(DIFFICULTY) as Difficulty[]).map(d => (
              <button key={d} className={diff === d ? "on" : ""} onClick={() => setDiff(d)}>
                <b>{DIFFICULTY[d].emoji} {DIFFICULTY[d].name}</b><small>{DIFFICULTY[d].desc}</small>
              </button>
            ))}
          </div>
          <h2>함께 모험할 파트너를 골라주세요!</h2>
          <div className="starters">
            {STARTERS.map(id => {
              const s = SPECIES[id];
              return (
                <button key={id} className="starter" onClick={() => startRun(id)} style={{ ["--tc" as string]: TYPE_COLOR[s.type] }}>
                  <img src={art(id)} alt={s.name} />
                  <b>{s.name}</b>
                  <TypeBadge t={s.type} />
                  <small className="muted">
                    {s.evo ? `Lv.${s.evo.level}에 ${SPECIES[s.evo.to].name}(으)로 진화` : ""}
                  </small>
                </button>
              );
            })}
          </div>
          <button onClick={() => setScreen("title")}>← 돌아가기</button>
        </div>
      )}

      {run && screen === "map" && (
        <div className="panel">
          <div className="regionhead">
            <div>
              <div className="muted small">{isEndless(run.region) ? "♾️ 무한의 탑" : `${run.region + 1} / ${REGIONS.length} 지역`} · {difficulty.emoji} {difficulty.name}</div>
              <h2>{region.emoji} {region.name}</h2>
            </div>
            <div className="goldbox">💰 {run.gold}G</div>
          </div>
          <div className="floors">
            {Array.from({ length: region.wild.length ? FLOORS_PER_REGION : 1 }).map((_, i) => (
              <div key={i} className={`floor ${i < run.floor ? "done" : i === run.floor ? "now" : ""}`}>
                {i === (region.wild.length ? FLOORS_PER_REGION - 1 : 0) ? "👑" : i < run.floor ? "✓" : i + 1}
              </div>
            ))}
          </div>
          <h3>어디로 갈까?</h3>
          <div className="choices">
            {run.choices.map((k, i) => (
              <button key={i} className={`choice c-${k}`} onClick={() => chooseNode(k)}>
                <span className="cemoji">{NODE_INFO[k].emoji}</span>
                <b>{NODE_INFO[k].name}</b>
                <small>{k === "boss" ? `${SPECIES[region.boss.id].name} Lv.${region.boss.level}` : NODE_INFO[k].desc}</small>
                {k === "boss" && <img src={art(region.boss.id)} alt="" className="bossprev" />}
                {k === "rival" && <img src={art(formAtLevel(RIVAL_STARTER[run.starter ?? 4] ?? 7, region.levels[1] + 1))} alt="" className="bossprev rivalprev" />}
              </button>
            ))}
          </div>
          <div className="partyrow">
            <h3>내 파티 <small className="muted">({run.party.length}/{MAX_PARTY}) · 눌러서 정보 보기</small></h3>
            <button onClick={() => setPartyOpen(true)}>🎒 파티 · 가방</button>
          </div>
          <div className="partylist">
            {run.party.map((m, i) => <MonMini key={m.uid} m={m} active={i === 0} onClick={() => { setDetail(m); cry(m.id); }} />)}
          </div>
        </div>
      )}

      {run && screen === "shop" && (
        <div className="panel center">
          <h2>🛒 상점</h2>
          <p className="muted">어서 오세요! 💰 보유: <b>{run.gold}G</b></p>
          <div className="shop">
            {(Object.keys(ITEMS) as ItemKey[]).map(k => (
              <div key={k} className="shopitem">
                <span className="cemoji">{ITEMS[k].emoji}</span>
                <div><b>{ITEMS[k].name}</b> <small className="muted">(보유 {run.items[k]})</small><br /><small className="muted">{ITEMS[k].desc}</small></div>
                <button disabled={run.gold < ITEMS[k].price} onClick={() => buy(k)}>{ITEMS[k].price}G</button>
              </div>
            ))}
          </div>
          <button className="primary" onClick={() => { setRun(advance(run)); setScreen("map"); }}>나가기 →</button>
        </div>
      )}

      {screen === "event" && eventView && (
        <div className="panel center">
          <h2>{eventView.title}</h2>
          {eventView.img ? <img className="bigart pop" src={eventView.img} alt="" /> : <div className="bigemoji pop">{eventView.emoji}</div>}
          <p className="pre">{eventView.text}</p>
          <button className="primary" onClick={eventDone}>계속 →</button>
        </div>
      )}

      {run && screen === "recruit" && after?.recruit && (
        <div className="panel center">
          <h2>{after.recruit.shiny ? "🌟 색이 다른 " : "✨ "}{sp(after.recruit).name}이(가) 동료가 되고 싶어 한다!</h2>
          <img className={`bigart pop ${after.recruit.shiny ? "shiny-glow" : ""}`} src={monArt(after.recruit)} alt="" />
          <p><TypeBadge t={sp(after.recruit).type} /> Lv.{after.recruit.level}
            {sp(after.recruit).evo && <span className="muted small"> · Lv.{sp(after.recruit).evo!.level}에 진화</span>}</p>
          {!swapFor ? (
            <div className="btns">
              <button className="primary" onClick={() => acceptRecruit()}>💖 동료로 맞이하기</button>
              <button onClick={declineRecruit}>보내주기</button>
            </div>
          ) : (
            <>
              <p>파티가 가득 찼어요! 누구와 작별할까요?</p>
              <div className="partylist">
                {run.party.map((m, i) => <MonMini key={m.uid} m={m} onClick={() => acceptRecruit(i)} />)}
              </div>
              <button onClick={declineRecruit}>그냥 보내주기</button>
            </>
          )}
        </div>
      )}

      {run && screen === "evolve" && after?.evos.length ? (() => {
        const m = run.party.find(p => p.uid === after.evos[0]);
        if (!m) return <div className="panel center"><button className="primary" onClick={evolveNext}>계속 →</button></div>;
        const fromName = evoStage === 2 ? "" : sp(m).name;
        return (
          <div className="panel center evolve">
            {evoStage === 0 && <>
              <h2>어라…!? {fromName}의 상태가…!</h2>
              <img className="bigart evo-glow" src={monArt(m)} alt="" />
              {after.stoneTo && <p>💎 진화의 돌이 반짝이기 시작했다!</p>}
              {sp(m).evo?.choices && !after.stoneTo ? <>
                <p>어떤 모습으로 진화할까? 하나를 골라주세요!</p>
                <div className="evochoices">
                  {sp(m).evo!.choices!.map(id => (
                    <button key={id} onClick={() => { sfx("evolve"); setEvoStage(1); setTimeout(() => doEvolve(id), 2200); }}
                      style={{ ["--tc" as string]: TYPE_COLOR[SPECIES[id].type] }}>
                      <img src={art(id, !!m.shiny)} alt="" />
                      <b>{SPECIES[id].name}</b> <TypeBadge t={SPECIES[id].type} />
                    </button>
                  ))}
                </div>
              </> : <button className="primary" onClick={() => { sfx("evolve"); setEvoStage(1); setTimeout(() => doEvolve(after.stoneTo), 2200); }}>✨ 지켜보기</button>}
            </>}
            {evoStage === 1 && <>
              <h2>…!</h2>
              <img className="bigart evo-flash" src={monArt(m)} alt="" />
            </>}
            {evoStage === 2 && <>
              <h2>🎉 축하합니다! {sp(m).name}(으)로 진화했다!</h2>
              <img className="bigart pop" src={monArt(m)} alt="" />
              <p><TypeBadge t={sp(m).type} /> Lv.{m.level}</p>
              <button className="primary" onClick={evolveNext}>계속 →</button>
            </>}
          </div>
        );
      })() : null}

      {run && screen === "battle" && battleView && <BattleView
        b={battleView} region={region} onAct={act} onForce={forceSwitch} onSkip={skipAnim}
        onLeave={leaveBattle} onLose={gameOver} />}

      {screen === "gameover" && run && (
        <div className="panel center">
          <h2>💫 모험 실패…</h2>
          <p>{getRegion(run.region).name}에서 쓰러지고 말았다.</p>
          {isEndless(run.region) && <p>♾️ 무한의 탑 <b>{endlessStage(run.region) - 1}구역</b> 돌파! 대단해요!</p>}
          <p className="muted">승리 {run.wins}회 · 동료 {run.caught}마리 영입</p>
          <div className="partylist">{run.party.map(m => <MonMini key={m.uid} m={m} />)}</div>
          <p className="muted small">도감 기록은 남아 있어요. 다시 도전해 보세요!</p>
          <button className="primary" onClick={() => { setRun(null); setScreen("starter"); }}>다시 도전</button>
          <button onClick={() => { setRun(null); setScreen("title"); }}>타이틀로</button>
        </div>
      )}

      {screen === "victory" && run && (
        <div className="panel center victory">
          <h1>🏆 전 지역 정복!</h1>
          <p>최후의 탑의 주인을 쓰러뜨렸다! 당신과 파트너들은 진정한 챔피언이다!</p>
          <div className="victory-mons">{run.party.map(m => <img key={m.uid} src={monArt(m)} alt="" />)}</div>
          <p className="muted">승리 {run.wins}회 · 동료 {run.caught}마리 영입</p>
          <div className="btns">
            <button className="primary" onClick={startEndless}>♾️ 무한의 탑 도전</button>
            <button onClick={() => { setRun(null); setScreen("title"); }}>타이틀로</button>
          </div>
          <p className="muted small">무한의 탑: 지금 파티 그대로 계속! 구역마다 적이 강해져요.</p>
        </div>
      )}

      {detail && <DetailCard m={detail} onClose={() => setDetail(null)} />}

      {partyOpen && run && (
        <div className="modal-bg" onClick={() => setPartyOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🎒 파티 · 가방</h2>
            <div className="bag">
              {(Object.keys(ITEMS) as ItemKey[]).filter(k => run.items[k] > 0).map(k => <span key={k}>{ITEMS[k].emoji} {ITEMS[k].name} x{run.items[k]}</span>)}
            </div>
            {run.party.map((m, i) => (
              <MonMini key={m.uid} m={m} active={i === 0} extra={
                <div className="mm-actions">
                  <div className="movechips">{monMoves(m).map(mv => <span key={mv.name} style={{ borderColor: TYPE_COLOR[mv.type] }}>{mv.name}</span>)}</div>
                  <button onClick={() => { setDetail(m); cry(m.id); }}>📋 정보</button>
                  {i > 0 && <button onClick={() => setLead(i)}>⭐ 선두로</button>}
                  {(["potion", "superPotion", "revive", "candy"] as ItemKey[]).filter(k => run.items[k] > 0).map(k =>
                    <button key={k} onClick={() => applyItemOutside(k, i)}>{ITEMS[k].emoji} {ITEMS[k].name}</button>)}
                  {STONE_KEYS.filter(k => run.items[k] > 0 && STONES[k]![m.id]).map(k =>
                    <button key={k} className="stonebtn" onClick={() => applyItemOutside(k, i)}>
                      {ITEMS[k].emoji} {ITEMS[k].name} → {SPECIES[STONES[k]![m.id]].name}</button>)}
                </div>
              } />
            ))}
            <button className="primary" onClick={() => setPartyOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ================== 포켓몬 정보 카드 ==================
const STAT_LABEL: [keyof ReturnType<typeof stats>, string, number][] = [
  ["maxHp", "HP", 120], ["atk", "공격", 110], ["def", "방어", 110], ["spd", "스피드", 110],
];
/** 같은 레벨에서 종족값이 아주 높은 포켓몬의 능력치 (막대 길이 기준) */
const statCap = (k: string, L: number, base: number) =>
  k === "maxHp" ? Math.floor(base * 1.3 * L / 40) + L * 2 + 15 : Math.floor(base * 1.2 * (0.5 + L * 0.07)) + 5;
function DetailCard({ m, onClose }: { m: Mon; onClose: () => void }) {
  const s = sp(m), st = stats(m);
  const line = evoLine(m.id);
  const learnNext = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => m.level + d)
    .map(L => ({ L, moves: monMoves({ ...m, level: L }).map(x => x.name) }))
    .find(x => x.moves.some(n => !monMoves(m).some(y => y.name === n)));
  const nextMove = learnNext?.moves.find(n => !monMoves(m).some(y => y.name === n));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal detail" onClick={e => e.stopPropagation()} style={{ ["--tc" as string]: TYPE_COLOR[s.type] }}>
        <div className="detail-head">
          <img className={m.shiny ? "shiny-glow" : ""} src={monArt(m)} alt={s.name} />
          <div>
            <h2>{m.shiny && "✨"}{s.name}</h2>
            <p><TypeBadge t={s.type} /> Lv.{m.level} <span className="muted small">· No.{String(s.id).padStart(3, "0")}</span></p>
            <p className="muted small">경험치 {m.xp} / {xpNeeded(m.level)}</p>
            {STONE_KEYS.filter(k => STONES[k]![s.id]).map(k => <p key={k} className="small">{ITEMS[k].emoji} {ITEMS[k].name}을(를) 쓰면 {SPECIES[STONES[k]![s.id]].name}(으)로 진화</p>)}
            {s.evo && <p className="small">⭐ {s.evo.choices ? "Lv." + s.evo.level + "에 5가지 중 선택 진화" : `Lv.${s.evo.level}에 ${SPECIES[s.evo.to].name}(으)로 진화`}</p>}
          </div>
        </div>
        <h3>능력치</h3>
        <div className="statlist">
          {STAT_LABEL.map(([k, label, max]) => (
            <div key={k} className="statrow">
              <span>{label}</span><b>{st[k]}</b>
              <div className="statbar"><div style={{ width: `${Math.min(100, Math.round(st[k] / statCap(k, m.level, max) * 100))}%` }} /></div>
            </div>
          ))}
        </div>
        <h3>기술</h3>
        <div className="movelist">
          {monMoves(m).map(mv => (
            <div key={mv.name} className="moveinfo" style={{ ["--tc" as string]: TYPE_COLOR[mv.type] }}>
              <b>{mv.name}</b> <TypeBadge t={mv.type} />
              <small>{mv.power ? `위력 ${mv.power} · 명중 ${mv.acc}` : ""}{mv.desc ? ` ${mv.desc}` : ""}</small>
            </div>
          ))}
        </div>
        {learnNext && nextMove && <p className="muted small">📚 Lv.{learnNext.L}에 <b>{nextMove}</b>({MOVES[nextMove].type}) 배움</p>}
        <h3>진화 단계</h3>
        <div className="evoline">
          {line.map((stage, i) => (
            <div key={i} className="evostage-wrap">
              {i > 0 && <span className="evoarrow">→</span>}
              <div className="evostage">
                {stage.map(id => (
                  <div key={id} className={`evomon ${id === m.id ? "cur" : ""}`}>
                    <img src={art(id, !!m.shiny)} alt="" />
                    <small>{SPECIES[id].name}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="primary" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}

// ================== 전투 화면 ==================
function BattleView({ b, region, onAct, onForce, onSkip, onLeave, onLose }: {
  b: Battle; region: (typeof REGIONS)[number];
  onAct: (a: { kind: "move"; i: number } | { kind: "switch"; idx: number } | { kind: "item"; key: ItemKey }) => void;
  onForce: (i: number) => void; onSkip: () => void; onLeave: () => void; onLose: () => void;
}) {
  const [tab, setTab] = useState<"moves" | "switch" | "bag">("moves");
  const ev = b.events[b.evIdx];
  const anim = b.phase === "anim";
  const pIdx = anim && ev ? ev.pIdx : b.active;
  const pm = b.party[pIdx];
  const em = anim && ev?.eRef ? ev.eRef : b.ef.mon;
  const teamLeft = b.kind === "trainer" ? b.queue.length + (b.ef.mon.hp > 0 ? 1 : 0) : 0;
  const pHp = anim && ev ? ev.pHp : pm.hp;
  const eHp = anim && ev ? ev.eHp : em.hp;
  const hitKey = `${b.evIdx}-${ev?.hit ?? ""}`;
  const caughtView = anim && ev?.ball;

  return (
    <div className="panel battle" style={{ background: region.bg }}>
      <div className="field">
        <div className={`side player ${ev?.hit === "p" && anim ? "hit" : ""} ${pHp <= 0 ? "down" : ""}`} key={`p-${hitKey}`}>
          <div className="namecard">
            {pm.shiny && "✨"}<b>{sp(pm).name}</b> <small>Lv.{pm.level}</small> <TypeBadge t={sp(pm).type} />
            {pm.status === "burn" && " 🔥"}{pm.status === "paralyze" && " ⚡"}
            <HpBar hp={pHp} max={stats(pm).maxHp} />
          </div>
          <img className="fighter flip" src={monArt(pm)} alt={sp(pm).name} />
          {anim && ev?.dmg?.side === "p" && <div className="float" style={{ color: ev.dmg.color }}>{ev.dmg.text}</div>}
        </div>
        <div className="vs">VS</div>
        <div className={`side enemy ${ev?.hit === "e" && anim ? "hit" : ""} ${eHp <= 0 ? "down" : ""} ${b.kind}`} key={`e-${hitKey}`}>
          <div className="namecard">
            {b.kind === "boss" && <span className="bosstag">👑 BOSS</span>}
            {b.kind === "elite" && <span className="bosstag elite">💀 강적</span>}
            {b.kind === "trainer" && <span className="bosstag rivaltag">🧢 {RIVAL_NAME} {"●".repeat(teamLeft)}{"○".repeat(b.defeated.length)}</span>}
            {em.shiny && <span className="bosstag shinytag">✨ 색이 다름</span>}
            <b>{sp(em).name}</b> <small>Lv.{em.level}</small> <TypeBadge t={sp(em).type} />
            {em.status === "burn" && " 🔥"}{em.status === "paralyze" && " ⚡"}
            <HpBar hp={eHp} max={stats(em).maxHp} />
          </div>
          {caughtView ? <div className="pokeball shake">🔴</div> : <img className={`fighter ${em.shiny ? "shiny-glow" : ""}`} src={monArt(em)} alt={sp(em).name} />}
          {anim && ev?.dmg?.side === "e" && <div className="float" style={{ color: ev.dmg.color }}>{ev.dmg.text}</div>}
        </div>
      </div>

      <div className="msgbox" onClick={onSkip}>
        {b.phase === "anim" && <span key={b.evIdx} className="typing">{ev?.text}</span>}
        {b.phase === "choose" && <span>{sp(pm).name}은(는) 무엇을 할까?</span>}
        {b.phase === "forceSwitch" && <span>다음 포켓몬을 골라주세요!</span>}
        {b.phase === "won" && <div className="pre">{b.result.join("\n")}</div>}
        {b.phase === "lost" && <span>파티가 모두 쓰러졌다…</span>}
        {anim && <small className="skip">탭하여 넘기기 ▶</small>}
      </div>

      {b.phase === "choose" && (
        <div className="actions">
          <div className="tabs">
            <button className={tab === "moves" ? "on" : ""} onClick={() => setTab("moves")}>⚔️ 기술</button>
            <button className={tab === "switch" ? "on" : ""} onClick={() => setTab("switch")}>🔄 교체</button>
            <button className={tab === "bag" ? "on" : ""} onClick={() => setTab("bag")}>🎒 가방</button>
          </div>
          {tab === "moves" && (
            <div className="moves">
              {monMoves(pm).map((mv, i) => {
                const eff = mv.power ? effectiveness(mv.type, sp(em).type) : 1;
                return (
                  <button key={mv.name} className="move" style={{ ["--tc" as string]: TYPE_COLOR[mv.type] }} onClick={() => onAct({ kind: "move", i })}>
                    <b>{mv.name}</b>
                    <small>{mv.type} · {mv.power ? `위력 ${mv.power}` : mv.desc}{mv.acc < 100 ? ` · 명중 ${mv.acc}` : ""}</small>
                    {eff > 1 && <span className="effhint good">효과 굉장!</span>}
                    {eff < 1 && <span className="effhint bad">별로…</span>}
                  </button>
                );
              })}
            </div>
          )}
          {tab === "switch" && (
            <div className="partylist">
              {b.party.map((m, i) => <MonMini key={m.uid} m={m} active={i === b.active}
                onClick={m.hp > 0 && i !== b.active ? () => { setTab("moves"); onAct({ kind: "switch", idx: i }); } : undefined} />)}
            </div>
          )}
          {tab === "bag" && (
            <div className="moves">
              {(["potion", "superPotion", "ball"] as ItemKey[]).map(k => {
                const disabled = b.items[k] <= 0 || (k === "ball" && (b.kind === "boss" || b.kind === "trainer")) ||
                  (k !== "ball" && pm.hp >= stats(pm).maxHp);
                return (
                  <button key={k} className="move" disabled={disabled} onClick={() => { setTab("moves"); onAct({ kind: "item", key: k }); }}>
                    <b>{ITEMS[k].emoji} {ITEMS[k].name} x{b.items[k]}</b>
                    <small>{k === "ball" ? (b.kind === "boss" ? "보스는 잡을 수 없어요" : b.kind === "trainer" ? "트레이너의 포켓몬은 잡을 수 없어요" : `포획 확률 약 ${Math.round(catchChance(em) * 100)}%`) : ITEMS[k].desc}</small>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {b.phase === "forceSwitch" && (
        <div className="partylist">
          {b.party.map((m, i) => <MonMini key={m.uid} m={m} onClick={m.hp > 0 ? () => onForce(i) : undefined} />)}
        </div>
      )}
      {b.phase === "won" && <button className="primary wide" onClick={onLeave}>계속 →</button>}
      {b.phase === "lost" && <button className="primary wide" onClick={onLose}>결과 보기</button>}
    </div>
  );
}
