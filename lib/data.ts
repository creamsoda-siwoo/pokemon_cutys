// 게임 데이터: 타입, 기술, 포켓몬, 지역, 아이템

export type Type = "노말" | "불꽃" | "물" | "풀" | "전기" | "에스퍼" | "격투" | "고스트" | "드래곤";

export const TYPE_COLOR: Record<Type, string> = {
  노말: "#a8a29e", 불꽃: "#f97316", 물: "#3b82f6", 풀: "#22c55e", 전기: "#eab308",
  에스퍼: "#ec4899", 격투: "#b45309", 고스트: "#7c3aed", 드래곤: "#4f46e5",
};

// 공격 타입 → 방어 타입 배율 (없으면 1배)
const STRONG: Partial<Record<Type, Type[]>> = {
  불꽃: ["풀"], 물: ["불꽃"], 풀: ["물"], 전기: ["물"], 격투: ["노말"],
  에스퍼: ["격투"], 고스트: ["에스퍼", "고스트"], 드래곤: ["드래곤"],
};
const WEAK: Partial<Record<Type, Type[]>> = {
  불꽃: ["물", "드래곤"], 물: ["풀", "드래곤"], 풀: ["불꽃", "드래곤"], 전기: ["풀", "드래곤"],
  노말: ["고스트"], 격투: ["고스트", "에스퍼"], 에스퍼: ["에스퍼"],
};
export function effectiveness(atk: Type, def: Type): number {
  if (STRONG[atk]?.includes(def)) return 2;
  if (WEAK[atk]?.includes(def)) return 0.5;
  return 1;
}

export type Effect = "burn" | "paralyze" | "drain" | "heal" | "atkUp" | "defUp" | "priority" | "recoil";
export interface Move {
  name: string; type: Type; power: number; acc: number;
  effect?: Effect; chance?: number; desc?: string;
}

export const MOVES: Record<string, Move> = {
  몸통박치기: { name: "몸통박치기", type: "노말", power: 40, acc: 100 },
  전광석화: { name: "전광석화", type: "노말", power: 40, acc: 100, effect: "priority", desc: "무조건 먼저 공격" },
  돌진: { name: "돌진", type: "노말", power: 90, acc: 85, effect: "recoil", desc: "반동 피해" },
  파괴광선: { name: "파괴광선", type: "노말", power: 130, acc: 80 },
  칼춤: { name: "칼춤", type: "노말", power: 0, acc: 100, effect: "atkUp", desc: "공격 크게 상승" },
  철벽: { name: "철벽", type: "노말", power: 0, acc: 100, effect: "defUp", desc: "방어 크게 상승" },
  회복: { name: "회복", type: "노말", power: 0, acc: 100, effect: "heal", desc: "HP 절반 회복" },
  불꽃세례: { name: "불꽃세례", type: "불꽃", power: 40, acc: 100, effect: "burn", chance: 0.15 },
  화염방사: { name: "화염방사", type: "불꽃", power: 85, acc: 100, effect: "burn", chance: 0.1 },
  불대문자: { name: "불대문자", type: "불꽃", power: 115, acc: 85, effect: "burn", chance: 0.2 },
  물대포: { name: "물대포", type: "물", power: 40, acc: 100 },
  거품광선: { name: "거품광선", type: "물", power: 70, acc: 100 },
  하이드로펌프: { name: "하이드로펌프", type: "물", power: 115, acc: 85 },
  덩굴채찍: { name: "덩굴채찍", type: "풀", power: 45, acc: 100 },
  메가드레인: { name: "메가드레인", type: "풀", power: 60, acc: 100, effect: "drain", desc: "준 피해 절반 회복" },
  솔라빔: { name: "솔라빔", type: "풀", power: 120, acc: 85 },
  전기쇼크: { name: "전기쇼크", type: "전기", power: 40, acc: 100, effect: "paralyze", chance: 0.15 },
  "10만볼트": { name: "10만볼트", type: "전기", power: 85, acc: 100, effect: "paralyze", chance: 0.1 },
  번개: { name: "번개", type: "전기", power: 120, acc: 75, effect: "paralyze", chance: 0.3 },
  염동력: { name: "염동력", type: "에스퍼", power: 50, acc: 100 },
  사이코키네시스: { name: "사이코키네시스", type: "에스퍼", power: 90, acc: 100 },
  사이코브레이크: { name: "사이코브레이크", type: "에스퍼", power: 120, acc: 90 },
  태권당수: { name: "태권당수", type: "격투", power: 45, acc: 100 },
  크로스촙: { name: "크로스촙", type: "격투", power: 90, acc: 90 },
  인파이트: { name: "인파이트", type: "격투", power: 120, acc: 95, effect: "recoil" },
  핥기: { name: "핥기", type: "고스트", power: 35, acc: 100, effect: "paralyze", chance: 0.3 },
  섀도볼: { name: "섀도볼", type: "고스트", power: 85, acc: 100 },
  용의숨결: { name: "용의숨결", type: "드래곤", power: 60, acc: 100, effect: "paralyze", chance: 0.2 },
  역린: { name: "역린", type: "드래곤", power: 120, acc: 95 },
};

// 타입별로 배우는 기술 (레벨, 기술)
const LEARN: Record<Type, [number, string][]> = {
  노말: [[1, "몸통박치기"], [3, "전광석화"], [8, "돌진"], [15, "파괴광선"]],
  불꽃: [[1, "불꽃세례"], [5, "칼춤"], [9, "화염방사"], [15, "불대문자"]],
  물: [[1, "물대포"], [5, "철벽"], [9, "거품광선"], [15, "하이드로펌프"]],
  풀: [[1, "덩굴채찍"], [5, "메가드레인"], [10, "회복"], [15, "솔라빔"]],
  전기: [[1, "전기쇼크"], [4, "전광석화"], [9, "10만볼트"], [15, "번개"]],
  에스퍼: [[1, "염동력"], [6, "회복"], [10, "사이코키네시스"], [16, "사이코브레이크"]],
  격투: [[1, "태권당수"], [5, "칼춤"], [10, "크로스촙"], [16, "인파이트"]],
  고스트: [[1, "핥기"], [6, "회복"], [10, "섀도볼"], [16, "사이코키네시스"]],
  드래곤: [[1, "용의숨결"], [6, "칼춤"], [11, "역린"], [16, "파괴광선"]],
};
export function movesFor(type: Type, level: number): string[] {
  const own = LEARN[type].filter(([l]) => l <= level).map(([, m]) => m);
  const list = type === "노말" ? own : ["몸통박치기", ...own];
  const uniq = [...new Set(list)];
  // 최대 4개: 약한 노말 기술부터 밀려남
  while (uniq.length > 4) uniq.splice(uniq.indexOf("몸통박치기") >= 0 ? uniq.indexOf("몸통박치기") : 0, 1);
  return uniq;
}

export interface Species {
  id: number; name: string; type: Type;
  hp: number; atk: number; def: number; spd: number;
  evo?: { to: number; level: number; choices?: number[] };
}

const S = (id: number, name: string, type: Type, hp: number, atk: number, def: number, spd: number, evo?: [number, number]): Species =>
  ({ id, name, type, hp, atk, def, spd, evo: evo ? { to: evo[0], level: evo[1] } : undefined });

export const SPECIES: Record<number, Species> = Object.fromEntries([
  // 스타터
  S(1, "이상해씨", "풀", 45, 49, 49, 45, [2, 7]), S(2, "이상해풀", "풀", 60, 62, 63, 60, [3, 14]), S(3, "이상해꽃", "풀", 80, 82, 83, 80),
  S(4, "파이리", "불꽃", 39, 52, 43, 65, [5, 7]), S(5, "리자드", "불꽃", 58, 64, 58, 80, [6, 14]), S(6, "리자몽", "불꽃", 78, 84, 78, 100),
  S(7, "꼬부기", "물", 44, 48, 65, 43, [8, 7]), S(8, "어니부기", "물", 59, 63, 80, 58, [9, 14]), S(9, "거북왕", "물", 79, 83, 100, 78),
  S(25, "피카츄", "전기", 35, 55, 40, 90, [26, 12]), S(26, "라이츄", "전기", 60, 90, 55, 110),
  // 숲
  S(16, "구구", "노말", 40, 45, 40, 56, [17, 8]), S(17, "피죤", "노말", 63, 60, 55, 71, [18, 15]), S(18, "피죤투", "노말", 83, 80, 75, 101),
  S(19, "꼬렛", "노말", 30, 56, 35, 72, [20, 9]), S(20, "레트라", "노말", 55, 81, 60, 97),
  S(43, "뚜벅쵸", "풀", 45, 50, 55, 30, [44, 8]), S(44, "냄새꼬", "풀", 60, 65, 70, 40, [45, 15]), S(45, "라플레시아", "풀", 75, 80, 85, 50),
  S(133, "이브이", "노말", 55, 55, 50, 55, [134, 10]),
  S(134, "샤미드", "물", 130, 65, 60, 65), S(135, "쥬피썬더", "전기", 65, 65, 60, 130), S(136, "부스터", "불꽃", 65, 130, 60, 65),
  S(196, "에브이", "에스퍼", 65, 130, 60, 110), S(197, "블래키", "고스트", 95, 65, 110, 65),
  S(143, "잠만보", "노말", 160, 110, 65, 30),
  // 호수
  S(54, "고라파덕", "물", 50, 52, 48, 55, [55, 11]), S(55, "골덕", "물", 80, 82, 78, 85),
  S(60, "발챙이", "물", 40, 50, 40, 90, [61, 9]), S(61, "슈륙챙이", "물", 65, 65, 65, 90),
  S(129, "잉어킹", "물", 20, 10, 55, 80, [130, 8]), S(130, "갸라도스", "물", 95, 125, 79, 81),
  S(100, "찌리리공", "전기", 40, 30, 50, 100, [101, 10]), S(101, "붐볼", "전기", 60, 50, 70, 150),
  S(79, "야돈", "에스퍼", 90, 65, 65, 15, [80, 12]), S(80, "야도란", "에스퍼", 95, 75, 110, 30),
  // 동굴
  S(92, "고오스", "고스트", 30, 35, 30, 80, [93, 9]), S(93, "고우스트", "고스트", 45, 50, 45, 95, [94, 15]), S(94, "팬텀", "고스트", 60, 65, 60, 110),
  S(66, "알통몬", "격투", 70, 80, 50, 35, [67, 10]), S(67, "근육몬", "격투", 80, 100, 70, 45, [68, 16]), S(68, "괴력몬", "격투", 90, 130, 80, 55),
  S(63, "캐이시", "에스퍼", 25, 20, 15, 90, [64, 10]), S(64, "윤겔라", "에스퍼", 40, 35, 30, 105, [65, 16]), S(65, "후딘", "에스퍼", 55, 50, 45, 120),
  // 화산
  S(58, "가디", "불꽃", 55, 70, 45, 60, [59, 14]), S(59, "윈디", "불꽃", 90, 110, 80, 95),
  S(37, "식스테일", "불꽃", 38, 41, 40, 65, [38, 14]), S(38, "나인테일", "불꽃", 73, 76, 75, 100),
  S(147, "미뇽", "드래곤", 41, 64, 45, 50, [148, 12]), S(148, "신뇽", "드래곤", 61, 84, 65, 70, [149, 18]), S(149, "망나뇽", "드래곤", 91, 134, 95, 80),
  S(150, "뮤츠", "에스퍼", 106, 110, 90, 130),
  // ===== 새 포켓몬 =====
  // 새 스타터 (2세대)
  S(152, "치코리타", "풀", 45, 49, 65, 45, [153, 7]), S(153, "베이리프", "풀", 60, 62, 80, 60, [154, 14]), S(154, "메가니움", "풀", 80, 83, 100, 80),
  S(155, "브케인", "불꽃", 39, 60, 43, 65, [156, 7]), S(156, "마그케인", "불꽃", 58, 80, 58, 80, [157, 14]), S(157, "블레이범", "불꽃", 78, 109, 78, 100),
  S(158, "리아코", "물", 50, 65, 64, 43, [159, 7]), S(159, "엘리게이", "물", 65, 80, 80, 58, [160, 14]), S(160, "장크로다일", "물", 85, 105, 100, 78),
  // 숲 (달의돌로 진화)
  S(35, "삐삐", "노말", 70, 45, 48, 35), S(36, "픽시", "노말", 95, 85, 73, 60),
  S(39, "푸린", "노말", 115, 45, 20, 20), S(40, "푸크린", "노말", 140, 85, 45, 45),
  S(52, "나옹", "노말", 40, 45, 35, 90, [53, 11]), S(53, "페르시온", "노말", 65, 70, 60, 115),
  // 호수
  S(118, "콘치", "물", 45, 67, 60, 63, [119, 10]), S(119, "왕콘치", "물", 80, 92, 65, 68),
  S(81, "코일", "전기", 25, 50, 70, 45, [82, 11]), S(82, "레어코일", "전기", 50, 95, 95, 70),
  S(258, "물짱이", "물", 50, 70, 50, 40, [259, 8]), S(259, "늪짱이", "물", 70, 85, 70, 50, [260, 15]), S(260, "대짱이", "물", 100, 110, 90, 60),
  S(179, "메리프", "전기", 55, 50, 40, 35, [180, 8]), S(180, "보송송", "전기", 70, 70, 55, 45, [181, 15]), S(181, "전룡", "전기", 90, 105, 85, 55),
  // 동굴
  S(355, "해골몽", "고스트", 20, 40, 90, 25, [356, 12]), S(356, "미라몽", "고스트", 40, 70, 130, 25),
  S(280, "랄토스", "에스퍼", 28, 35, 25, 40, [281, 9]), S(281, "킬리아", "에스퍼", 38, 60, 35, 50, [282, 15]), S(282, "가디안", "에스퍼", 68, 115, 65, 80),
  S(447, "리오르", "격투", 40, 70, 40, 60, [448, 12]), S(448, "루카리오", "격투", 70, 115, 70, 90),
  S(302, "깜까미", "고스트", 50, 75, 75, 50),
  // 화산
  S(77, "포니타", "불꽃", 50, 85, 55, 90, [78, 12]), S(78, "날쌩마", "불꽃", 65, 100, 70, 105),
  S(371, "아공이", "드래곤", 45, 75, 60, 50, [372, 12]), S(372, "쉘곤", "드래곤", 65, 95, 100, 50, [373, 18]), S(373, "보만다", "드래곤", 95, 135, 80, 100),
  S(443, "딥상어동", "드래곤", 58, 70, 45, 42, [444, 12]), S(444, "한바이트", "드래곤", 68, 90, 65, 82, [445, 18]), S(445, "한카리아스", "드래곤", 108, 130, 95, 102),
  // 전설 · 환상 (무한의 탑 보스)
  S(249, "루기아", "에스퍼", 106, 90, 130, 110), S(384, "레쿠쟈", "드래곤", 105, 150, 90, 95), S(151, "뮤", "에스퍼", 100, 100, 100, 100),
].map(s => [s.id, s]));

export const STARTERS = [1, 4, 7, 25, 152, 155, 158];

export const art = (id: number, shiny = false) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${shiny ? "shiny/" : ""}${id}.png`;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTY: Record<Difficulty, { name: string; emoji: string; desc: string; foe: number; heal: number; gold: number }> = {
  easy: { name: "쉬움", emoji: "🌱", desc: "적이 약하고 승리 후 HP 35% 회복", foe: 0.8, heal: 0.35, gold: 1.2 },
  normal: { name: "보통", emoji: "⚔️", desc: "기본 난이도", foe: 1, heal: 0.2, gold: 1 },
  hard: { name: "어려움", emoji: "🔥", desc: "적이 강하고 회복이 적지만 골드 1.5배", foe: 1.15, heal: 0.1, gold: 1.5 },
};

export const SHINY_RATE = 1 / 20;

export const ACHIEVEMENTS: { id: string; emoji: string; name: string; desc: string }[] = [
  { id: "first_win", emoji: "⚔️", name: "첫 승리", desc: "배틀에서 처음으로 이기기" },
  { id: "evolve", emoji: "✨", name: "진화의 순간", desc: "포켓몬을 처음으로 진화시키기" },
  { id: "eevee", emoji: "🦊", name: "이브이 마스터", desc: "이브이를 진화시키기" },
  { id: "full_party", emoji: "👨‍👩‍👧‍👦", name: "든든한 동료들", desc: "파티를 4마리로 채우기" },
  { id: "catch", emoji: "🔴", name: "포획 성공", desc: "몬스터볼로 포켓몬 잡기" },
  { id: "shiny", emoji: "🌟", name: "반짝반짝", desc: "색이 다른 포켓몬을 동료로 맞이하기" },
  { id: "rich", emoji: "💰", name: "부자", desc: "골드 500G 모으기" },
  { id: "dex20", emoji: "📖", name: "도감 수집가", desc: "도감 20종 채우기" },
  { id: "dex50", emoji: "📚", name: "포켓몬 박사", desc: "도감 50종 채우기" },
  { id: "legend", emoji: "🌈", name: "전설과의 만남", desc: "무한의 탑에서 루기아·레쿠쟈·뮤 중 하나 쓰러뜨리기" },
  { id: "boss_143", emoji: "😴", name: "숲의 주인", desc: "잠만보 쓰러뜨리기" },
  { id: "boss_130", emoji: "🌊", name: "호수의 주인", desc: "갸라도스 쓰러뜨리기" },
  { id: "boss_94", emoji: "👻", name: "동굴의 주인", desc: "팬텀 쓰러뜨리기" },
  { id: "boss_149", emoji: "🐉", name: "화산의 주인", desc: "망나뇽 쓰러뜨리기" },
  { id: "champion", emoji: "🏆", name: "챔피언", desc: "최후의 탑의 뮤츠 쓰러뜨리기" },
  { id: "hard_clear", emoji: "🔥", name: "진정한 챔피언", desc: "어려움 난이도로 클리어" },
  { id: "endless_1", emoji: "♾️", name: "끝없는 도전", desc: "무한의 탑 1구역 돌파" },
  { id: "endless_5", emoji: "🌌", name: "탑의 전설", desc: "무한의 탑 5구역 돌파" },
  { id: "stone", emoji: "💎", name: "돌의 힘", desc: "진화의 돌로 포켓몬 진화시키기" },
  { id: "rival", emoji: "🧢", name: "라이벌 격파", desc: "라이벌 하늘에게 이기기" },
  { id: "rival3", emoji: "🤝", name: "영원한 라이벌", desc: "라이벌 하늘에게 3번 이기기" },
];

export interface Region {
  name: string; emoji: string; bg: string; levels: [number, number];
  wild: number[]; elite: number[]; boss: { id: number; level: number };
}
export const REGIONS: Region[] = [
  { name: "초록빛 숲", emoji: "🌳", bg: "linear-gradient(#bbf7d0,#4ade80)", levels: [2, 4],
    wild: [16, 19, 43, 133, 35, 39, 52], elite: [133, 43, 52], boss: { id: 143, level: 5 } },
  { name: "반짝이는 호수", emoji: "🌊", bg: "linear-gradient(#bae6fd,#38bdf8)", levels: [6, 8],
    wild: [54, 60, 129, 100, 79, 118, 81, 258, 179], elite: [55, 61, 119, 82, 259], boss: { id: 130, level: 11 } },
  { name: "으스스한 동굴", emoji: "🦇", bg: "linear-gradient(#c4b5fd,#4c1d95)", levels: [10, 12],
    wild: [92, 66, 63, 93, 355, 280, 447, 302], elite: [67, 64, 356, 281, 448], boss: { id: 94, level: 15 } },
  { name: "불타는 화산", emoji: "🌋", bg: "linear-gradient(#fed7aa,#dc2626)", levels: [14, 16],
    wild: [58, 37, 147, 148, 77, 371, 443], elite: [59, 38, 78, 372, 444], boss: { id: 149, level: 17 } },
  { name: "최후의 탑", emoji: "🗼", bg: "linear-gradient(#e9d5ff,#1e1b4b)", levels: [20, 20],
    wild: [], elite: [], boss: { id: 150, level: 21 } },
];
export const FLOORS_PER_REGION = 6; // 마지막 층은 보스

// ---------- 무한의 탑 (클리어 후 도전) ----------
const ENDLESS_POOL = [18, 20, 45, 55, 61, 80, 101, 134, 135, 136, 196, 197, 59, 38, 68, 65, 93, 148, 26, 3, 6, 9,
  154, 157, 160, 36, 40, 53, 119, 82, 260, 181, 356, 282, 448, 302, 78, 373, 445];
const ENDLESS_BOSSES = [143, 130, 94, 149, 249, 6, 9, 3, 384, 65, 68, 373, 445, 151, 150];
export const isEndless = (idx: number) => idx >= REGIONS.length;
export const endlessStage = (idx: number) => idx - REGIONS.length + 1;
export function getRegion(idx: number): Region {
  if (!isEndless(idx)) return REGIONS[idx];
  const t = endlessStage(idx);
  const base = 20 + t * 3;
  return {
    name: `무한의 탑 ${t}구역`, emoji: "♾️", bg: "linear-gradient(#f5d0fe,#312e81)", levels: [base, base + 2],
    wild: ENDLESS_POOL, elite: ENDLESS_POOL,
    boss: { id: ENDLESS_BOSSES[(t - 1) % ENDLESS_BOSSES.length], level: base + 4 },
  };
}

/** 진화 단계 목록: [[1], [2], [3]] / 이브이는 [[133], [134,135,136,196,197]] */
export function evoLine(id: number): number[][] {
  let root = id;
  for (;;) {
    const prev = Object.values(SPECIES).find(s => s.evo && (s.evo.to === root || s.evo.choices?.includes(root)));
    if (!prev) break;
    root = prev.id;
  }
  const stages: number[][] = [[root]];
  for (;;) {
    const next = stages[stages.length - 1].flatMap(i => { const e = SPECIES[i].evo; return e ? (e.choices ?? [e.to]) : []; });
    if (!next.length) break;
    stages.push(next);
  }
  return stages;
}

export type ItemKey = "potion" | "superPotion" | "ball" | "candy" | "revive"
  | "fireStone" | "waterStone" | "thunderStone" | "leafStone" | "moonStone";
export const ITEMS: Record<ItemKey, { name: string; emoji: string; price: number; desc: string }> = {
  potion: { name: "상처약", emoji: "🧪", price: 30, desc: "HP 50% 회복" },
  superPotion: { name: "고급상처약", emoji: "💊", price: 70, desc: "HP 전부 회복" },
  ball: { name: "몬스터볼", emoji: "🔴", price: 40, desc: "야생 포켓몬 포획 시도" },
  candy: { name: "이상한사탕", emoji: "🍬", price: 120, desc: "레벨 1 상승" },
  revive: { name: "기력의조각", emoji: "💎", price: 100, desc: "기절한 포켓몬 HP 50%로 부활" },
  fireStone: { name: "불꽃의돌", emoji: "🔥", price: 150, desc: "이브이·식스테일·가디 진화" },
  waterStone: { name: "물의돌", emoji: "💧", price: 150, desc: "이브이 → 샤미드 진화" },
  thunderStone: { name: "천둥의돌", emoji: "⚡", price: 150, desc: "이브이·피카츄 진화" },
  leafStone: { name: "리프의돌", emoji: "🍃", price: 150, desc: "냄새꼬 → 라플레시아 진화" },
  moonStone: { name: "달의돌", emoji: "🌙", price: 150, desc: "삐삐 → 픽시, 푸린 → 푸크린 진화" },
};
export const EMPTY_ITEMS: Record<ItemKey, number> = {
  potion: 0, superPotion: 0, ball: 0, candy: 0, revive: 0, fireStone: 0, waterStone: 0, thunderStone: 0, leafStone: 0, moonStone: 0,
};

/** 진화의 돌: 돌 → { 포켓몬: 진화 후 } (레벨과 상관없이 바로 진화) */
export const STONES: Partial<Record<ItemKey, Record<number, number>>> = {
  fireStone: { 133: 136, 37: 38, 58: 59 },
  waterStone: { 133: 134 },
  thunderStone: { 133: 135, 25: 26 },
  leafStone: { 44: 45 },
  moonStone: { 35: 36, 39: 40 },
};
export const STONE_KEYS = Object.keys(STONES) as ItemKey[];

// ---------- 라이벌 ----------
export const RIVAL_NAME = "하늘";
/** 플레이어 스타터를 이기는 타입의 스타터 */
export const RIVAL_STARTER: Record<number, number> = { 1: 4, 4: 7, 7: 1, 25: 1, 152: 155, 155: 158, 158: 152 };
/** 진화형을 따라가서 해당 레벨에 맞는 모습 */
export function formAtLevel(id: number, level: number): number {
  let cur = id;
  for (;;) {
    const e = SPECIES[cur].evo;
    if (!e || e.choices || level < e.level) return cur;
    cur = e.to;
  }
}

// 이브이는 진화할 때 5가지 중 하나를 고를 수 있다
SPECIES[133].evo!.choices = [134, 135, 136, 196, 197];
