import { SPECIES, MOVES, Move, effectiveness, movesFor, Species } from "./data";

export interface Mon {
  uid: string; id: number; level: number; xp: number; hp: number;
  status?: "burn" | "paralyze";
  boss?: boolean; foe?: boolean;
}

export const rnd = () => Math.random();
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export const sp = (m: Mon): Species => SPECIES[m.id];

export function stats(m: Mon) {
  const s = sp(m), L = m.level;
  const hp = Math.floor(s.hp * L / 40) + L * 2 + 15;
  return {
    maxHp: m.boss ? Math.floor(hp * 1.2) : hp,
    atk: Math.floor((s.atk * (0.5 + L * 0.07) + 5) * (m.foe ? 0.85 : 1)),
    def: Math.floor((s.def * (0.5 + L * 0.07) + 5) * (m.foe ? 0.9 : 1)),
    spd: Math.floor(s.spd * (0.5 + L * 0.07)) + 5,
  };
}

let uidN = 0;
export function makeMon(id: number, level: number, boss = false, foe = false): Mon {
  const m: Mon = { uid: `${Date.now().toString(36)}-${uidN++}-${Math.random().toString(36).slice(2, 6)}`, id, level, xp: 0, hp: 0, boss, foe };
  m.hp = stats(m).maxHp;
  return m;
}

export const xpNeeded = (level: number) => 12 + level * 10;
export const xpReward = (enemyLevel: number, kind: "wild" | "elite" | "boss") =>
  Math.floor(enemyLevel * 8 * (kind === "boss" ? 3 : kind === "elite" ? 1.6 : 1));

export const monMoves = (m: Mon): Move[] => movesFor(sp(m).type, m.level).map(n => MOVES[n]);

/** 경험치를 주고 레벨업 메시지를 돌려준다 (m을 직접 수정). 진화는 따로 checkEvolve로. */
export function giveXp(m: Mon, amount: number): string[] {
  const msgs: string[] = [];
  if (m.hp <= 0) return msgs;
  m.xp += amount;
  while (m.xp >= xpNeeded(m.level)) {
    m.xp -= xpNeeded(m.level);
    levelUp(m, msgs);
  }
  return msgs;
}

export function levelUp(m: Mon, msgs: string[]) {
  const before = stats(m).maxHp;
  const oldMoves = movesFor(sp(m).type, m.level);
  m.level++;
  const after = stats(m).maxHp;
  if (m.hp > 0) m.hp = Math.min(after, m.hp + (after - before) + Math.ceil(after * 0.1));
  msgs.push(`${sp(m).name}의 레벨이 ${m.level}(으)로 올랐다!`);
  for (const mv of movesFor(sp(m).type, m.level)) if (!oldMoves.includes(mv)) msgs.push(`${sp(m).name}은(는) ${mv}을(를) 배웠다!`);
}

export const canEvolve = (m: Mon) => { const e = sp(m).evo; return !!e && m.level >= e.level && m.hp > 0; };

export function evolve(m: Mon, to?: number) {
  const s = sp(m);
  if (!s.evo) return;
  const ratio = m.hp / stats(m).maxHp;
  m.id = to && s.evo.choices?.includes(to) ? to : s.evo.to;
  m.hp = Math.max(1, Math.round(stats(m).maxHp * ratio));
}

// ---------- 전투 ----------
export interface Fighter { mon: Mon; atkStage: number; defStage: number }
export interface HitResult {
  text: string[]; damage: number; eff: number; crit: boolean; missed: boolean; healed: number;
}

const stageMul = (s: number) => [1, 1.5, 2, 2.5, 3][Math.max(0, Math.min(4, s))];

export function performMove(attacker: Fighter, defender: Fighter, move: Move): HitResult {
  const a = attacker.mon, d = defender.mon;
  const an = sp(a).name;
  const r: HitResult = { text: [], damage: 0, eff: 1, crit: false, missed: false, healed: 0 };
  if (Math.random() * 100 >= move.acc) { r.missed = true; r.text.push("하지만 빗나갔다!"); return r; }

  if (move.power === 0) {
    if (move.effect === "atkUp") { attacker.atkStage = Math.min(4, attacker.atkStage + 2); r.text.push(`${an}의 공격이 크게 올랐다! ⬆️`); }
    if (move.effect === "defUp") { attacker.defStage = Math.min(4, attacker.defStage + 2); r.text.push(`${an}의 방어가 크게 올랐다! 🛡️`); }
    if (move.effect === "heal") {
      const mx = stats(a).maxHp; const h = Math.min(mx - a.hp, Math.ceil(mx / 2));
      a.hp += h; r.healed = h; r.text.push(h > 0 ? `${an}의 HP가 회복되었다! 💚` : "하지만 HP가 이미 가득 찼다!");
    }
    return r;
  }

  const as = stats(a), ds = stats(d);
  let atk = as.atk * stageMul(attacker.atkStage);
  if (a.status === "burn") atk *= 0.75;
  const def = ds.def * stageMul(defender.defStage);
  const eff = effectiveness(move.type, sp(d).type);
  const stab = move.type === sp(a).type ? 1.3 : 1;
  const crit = Math.random() < 0.07;
  let dmg = ((2 * a.level / 5 + 2) * move.power * (atk / def)) / 50 + 2;
  dmg = Math.max(1, Math.floor(dmg * stab * eff * (crit ? 1.5 : 1) * rand(0.85, 1)));
  dmg = Math.min(dmg, d.hp);
  d.hp -= dmg;
  Object.assign(r, { damage: dmg, eff, crit });
  if (crit) r.text.push("급소에 맞았다!");
  if (eff > 1) r.text.push("효과가 굉장했다!");
  if (eff < 1) r.text.push("효과가 별로인 듯하다…");

  if (move.effect === "drain") {
    const h = Math.min(as.maxHp - a.hp, Math.ceil(dmg / 2)); a.hp += h; r.healed = h;
    if (h > 0) r.text.push(`${sp(d).name}에게서 체력을 흡수했다!`);
  }
  if (move.effect === "recoil") {
    const rc = Math.min(a.hp - 1, Math.ceil(dmg / 4));
    if (rc > 0) { a.hp -= rc; r.text.push(`${an}은(는) 반동 피해를 입었다!`); }
  }
  if (d.hp > 0 && !d.status && move.chance && Math.random() < move.chance) {
    if (move.effect === "burn") { d.status = "burn"; r.text.push(`${sp(d).name}은(는) 화상을 입었다! 🔥`); }
    if (move.effect === "paralyze") { d.status = "paralyze"; r.text.push(`${sp(d).name}은(는) 마비되었다! ⚡`); }
  }
  return r;
}

/** 적 AI: 기대 피해가 큰 기술 위주, 가끔 보조 기술 */
export function enemyChoose(e: Fighter, p: Fighter): Move {
  const moves = monMoves(e.mon);
  const hpRatio = e.mon.hp / stats(e.mon).maxHp;
  const heal = moves.find(m => m.effect === "heal");
  if (heal && hpRatio < 0.35 && Math.random() < 0.5) return heal;
  const buff = moves.find(m => m.effect === "atkUp" || m.effect === "defUp");
  if (buff && hpRatio > 0.7 && e.atkStage + e.defStage < 2 && Math.random() < 0.3) return buff;
  const atk = moves.filter(m => m.power > 0);
  const score = (m: Move) => m.power * (m.acc / 100) * effectiveness(m.type, sp(p.mon).type) * (m.type === sp(e.mon).type ? 1.3 : 1);
  atk.sort((x, y) => score(y) - score(x));
  return Math.random() < 0.75 ? atk[0] : pick(atk);
}

export function catchChance(m: Mon): number {
  const ratio = m.hp / stats(m).maxHp;
  return Math.min(0.95, 0.15 + (1 - ratio) * 0.7 + (m.status ? 0.1 : 0));
}

export const effectiveSpeed = (m: Mon) => stats(m).spd * (m.status === "paralyze" ? 0.5 : 1);
