// 밸런스 확인용 시뮬레이션: npx tsx scripts/sim.ts
import { REGIONS, STARTERS } from "../lib/data";
import { makeMon, monMoves, performMove, enemyChoose, stats, Fighter, sp, effectiveSpeed, giveXp, xpReward, canEvolve, evolve, Mon } from "../lib/engine";
import { effectiveness } from "../lib/data";

function duel(p: Mon, e: Mon): boolean {
  const P: Fighter = { mon: p, atkStage: 0, defStage: 0 }, E: Fighter = { mon: e, atkStage: 0, defStage: 0 };
  for (let t = 0; t < 60; t++) {
    const mv = monMoves(p).filter(m => m.power > 0).sort((a, b) => b.power * effectiveness(b.type, sp(e).type) - a.power * effectiveness(a.type, sp(e).type))[0];
    const order: [Fighter, Fighter, boolean][] = effectiveSpeed(p) >= effectiveSpeed(e) ? [[P, E, true], [E, P, false]] : [[E, P, false], [P, E, true]];
    for (const [a, d, isP] of order) {
      if (a.mon.hp <= 0 || d.mon.hp <= 0) continue;
      performMove(a, d, isP ? mv : enemyChoose(a, d));
    }
    if (e.hp <= 0) return true;
    if (p.hp <= 0) return false;
  }
  return false;
}

for (const starter of STARTERS) {
  const res: string[] = [];
  let p = makeMon(starter, 5);
  for (let r = 0; r < REGIONS.length; r++) {
    const reg = REGIONS[r];
    let wins = 0, n = 0, hpLeft = 0;
    for (const id of reg.wild.length ? reg.wild : [reg.boss.id]) {
      for (let k = 0; k < 20; k++) {
        const pc: Mon = JSON.parse(JSON.stringify(p)); pc.hp = stats(pc).maxHp;
        const e = makeMon(id, reg.levels[1], false, true);
        n++; if (duel(pc, e)) { wins++; hpLeft += pc.hp / stats(pc).maxHp; }
      }
    }
    for (let k = 0; k < 5; k++) { giveXp(p, xpReward(reg.levels[1], k === 4 ? "elite" : "wild")); }
    while (canEvolve(p)) evolve(p);
    let bw = 0;
    for (let k = 0; k < 20; k++) {
      const pc: Mon = JSON.parse(JSON.stringify(p)); pc.hp = stats(pc).maxHp;
      if (duel(pc, makeMon(reg.boss.id, reg.boss.level, true, true))) bw++;
    }
    res.push(`${reg.name}: ${sp(p).name} Lv${p.level} 야생승률 ${Math.round(wins / n * 100)}% (남은HP ${Math.round(hpLeft / Math.max(1, wins) * 100)}%) → 보스전 Lv${p.level} 1:1 승률 ${bw * 5}%`);
    giveXp(p, xpReward(reg.boss.level, "boss"));
    while (canEvolve(p)) evolve(p);
    p = { ...p, hp: stats(p).maxHp };
  }
  console.log(res.join("\n"), "\n");
}
