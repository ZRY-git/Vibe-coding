"use strict";

// ============ 工具 ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============ 存档（浏览器本地，A10/A11） ============
const SAVE_KEY = "englishRpgState";
const RUNS_KEY = "englishRpgRuns";

// 本周一的日期串（自然周，周一为起点）
function mondayOf(d) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day2 = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${m}-${day2}`;
}

function loadState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { saved = null; }
  const base = {
    stamina: 10, weapon: 0, weapon2: 0, activeWeapon: 1, pendants: 0,
    bestScore: 0, weeklyScore: 0, weekKey: "",
    unlockedTitles: [], chosenTitle: "",
    character: "m"   // 我的角色：m = Henry（男），f = Rena（女）
  };
  const state = Object.assign(base, saved || {});
  const thisWeek = mondayOf(new Date());
  if (state.weekKey !== thisWeek) {   // 跨自然周：累计分重置，最高分与称号保留
    state.weekKey = thisWeek;
    state.weeklyScore = 0;
  }
  return state;
}

const state = loadState();
// runs 必须先于下面的吊坠保底初始化：saveAll() 里会用到 runs，
// 顺序反了会让全新浏览器（localStorage 为空）在保底发放时直接 ReferenceError，整页 JS 挂掉
let runs = [];
try { runs = JSON.parse(localStorage.getItem(RUNS_KEY)) || []; } catch (e) { runs = []; }

// workbuddy 吊坠保底发放：确保存档里至少有 1 个（验收条件：发放并装在饰品栏）
if (state.pendants < 1) { state.pendants = 1; saveAll(); }

// 两面三尖刀保底发放：确保存档里至少有 1 把（验收条件：发放并装在武器2栏）
if (state.weapon2 < 1) { state.weapon2 = 1; saveAll(); }

function saveAll() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(-50)));
}

// ============ 派生属性（面板 4 项） ============
const attackPower = () => 1 + state.weapon;                        // 血染荒城 +1
const defensePower = () => 0;                                      // 暂无防具来源
const speedPct = () => 100 + 5 * Math.floor(state.stamina / 10);   // 每 10 点体力 +5%
const moveSpeed = () => 2.6 * (speedPct() / 100);                  // 战斗内实际移速

// ============ 称号（A12：50 / 150 解锁，跨周保留） ============
const TITLES = [
  { name: "学习王", need: 50 },
  { name: "手法王", need: 150 }
];
function checkTitles() {
  TITLES.forEach(t => {
    if (state.weeklyScore >= t.need && !state.unlockedTitles.includes(t.name)) {
      state.unlockedTitles.push(t.name);
    }
  });
}

// ============ 角色精灵（待机 / 行走 sprite sheet，帧等宽横排） ============
// hand = 每帧「右手」在帧内的像素坐标（武器握持点）：
//   idle 为正面照（右手在画面左侧，男插兜/女叉腰，肤色检测+放大目测标定）
//   walk 为侧面照（右手为近侧拳，按肤色像素聚类中心标定；帧1为跨步/空中定格帧）
const CHAR_META = {
  m: { name: "Henry", idle: { src: "assets/char-m-idle.png", frames: 2 }, walk: { src: "assets/char-m-walk.png", frames: 4 },
       hand: { idle: [[13, 81], [13, 81]], walk: [[37, 76], [22, 80], [36, 76], [38, 76]] } },
  f: { name: "Rena",  idle: { src: "assets/char-f-idle.png", frames: 2 }, walk: { src: "assets/char-f-walk.png", frames: 4 },
       hand: { idle: [[14, 80], [14, 80]], walk: [[34, 78], [16, 81], [33, 78], [36, 76]] } }
};
Object.values(CHAR_META).forEach(c => {
  [c.idle, c.walk].forEach(s => { s.img = new Image(); s.img.src = s.src; });
});
const curChar = () => CHAR_META[state.character] || CHAR_META.m;

// 主页「我的角色」待机预览：仅主页显示时运行
let charPrev = { raf: 0, t: 0, last: 0 };
function startCharPreview() {
  stopCharPreview();
  const c = $("#char-canvas");
  if (!c) return;
  const cctx = c.getContext("2d");
  charPrev.last = performance.now();
  const loop = (now) => {
    charPrev.t += (now - charPrev.last) / 1000;
    charPrev.last = now;
    const s = curChar().idle;
    cctx.clearRect(0, 0, c.width, c.height);
    if (s.img.complete && s.img.naturalWidth) {
      const fw = s.img.naturalWidth / s.frames, fh = s.img.naturalHeight;
      const fi = Math.floor(charPrev.t / 0.7) % s.frames;   // 0.7s 换一帧
      const H = c.height - 4, W = H * fw / fh;
      cctx.imageSmoothingEnabled = false;
      cctx.drawImage(s.img, fi * fw, 0, fw, fh, (c.width - W) / 2, c.height - H, W, H);
    }
    charPrev.raf = requestAnimationFrame(loop);
  };
  charPrev.raf = requestAnimationFrame(loop);
}
function stopCharPreview() {
  if (charPrev.raf) cancelAnimationFrame(charPrev.raf);
  charPrev.raf = 0;
}

// ============ 视图切换 ============
function showView(id) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
  if (id === "view-battle") startBattle();
  else stopBattle();
  if (id === "view-home") { renderHome(); startCharPreview(); }
  else stopCharPreview();
  if (id === "view-learn") renderPacks();
  window.scrollTo(0, 0);
  syncOrientation();
  // 触屏 + 已经是横屏：顺着这次点击把全屏一起申请了（无用户手势时浏览器会拒绝，已兜底）
  if (id === "view-battle" && isCoarsePointer() && isLandscape()) enterFullscreen();
}

// ============ 主页渲染 ============
function renderHome() {
  $("#stat-stamina").textContent = state.stamina;
  $("#stat-attack").textContent = attackPower();
  $("#stat-defense").textContent = defensePower();
  $("#stat-speed").textContent = speedPct() + "%";
  $$(".char-choice").forEach(b => b.classList.toggle("active", b.dataset.char === state.character));
  $("#char-name").textContent = `当前：${curChar().name}`;
  const rowWeapon = $("#slot-weapon");
  $("#weapon-count").textContent = `血染荒城 ×${state.weapon}`;
  rowWeapon.classList.toggle("owned", state.weapon > 0);
  const rowWeapon2 = $("#slot-weapon2");
  $("#weapon2-count").textContent = `两面三尖刀 ×${state.weapon2}`;
  rowWeapon2.classList.toggle("owned", state.weapon2 > 0);
  rowWeapon2.classList.toggle("empty", state.weapon2 === 0);
  const slotPendant = $("#slot-pendant");
  $("#pendant-count").textContent = `workbuddy挂坠 ×${state.pendants}`;
  slotPendant.classList.toggle("owned", state.pendants > 0);
  slotPendant.classList.toggle("empty", state.pendants === 0);
  $("#stat-best").textContent = state.bestScore;
  $("#stat-weekly").textContent = state.weeklyScore;
  $("#title-current").textContent = state.chosenTitle || "暂无";

  const sel = $("#title-select");
  sel.innerHTML = "";
  if (state.unlockedTitles.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "暂无已解锁称号";
    sel.appendChild(opt);
    sel.disabled = true;
  } else {
    sel.disabled = false;
    state.unlockedTitles.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    const custom = document.createElement("option");
    custom.value = "__custom";
    custom.textContent = "自定义文字…";
    sel.appendChild(custom);
  }
  $("#title-input").style.display = "none";
  $("#title-progress").textContent =
    `本周累计 ${state.weeklyScore} / 150 · 50 分解锁「学习王」 · 150 分解锁「手法王」`;
}

// ============ 学习页 ============
let learn = null; // { pack, order, idx }

function renderPacks() {
  const box = $("#pack-list");
  box.innerHTML = "";
  WORD_PACKS.forEach(pack => {
    const card = document.createElement("button");
    card.className = "pack-card";
    card.innerHTML = `<b>${pack.name}</b><span>${pack.words.length} 题 · 四选一</span>`;
    card.addEventListener("click", () => startLearning(pack));
    box.appendChild(card);
  });
  $("#quiz-area").innerHTML =
    `<p class="hint">选一组词开始答题：答对得奖励进度，答错只显示正确答案，<b>不扣除任何资源</b>（A3）。</p>`;
  $("#btn-learn-home").style.display = "";
}

function startLearning(pack) {
  learn = { pack, order: shuffle(pack.words), idx: 0 };
  $("#btn-learn-home").style.display = "none";
  renderQuiz();
}

function renderQuiz() {
  const cur = learn.order[learn.idx];
  const wrong = shuffle(learn.pack.words.filter(w => w.meaning !== cur.meaning))
    .slice(0, 3).map(w => w.meaning);
  const options = shuffle([cur.meaning, ...wrong]);
  const area = $("#quiz-area");
  area.innerHTML = `
    <p class="hint">第 ${learn.idx + 1} / ${learn.order.length} 题 · 词组「${learn.pack.name}」</p>
    <div class="quiz-word">${cur.word}</div>
    <div class="choices"></div>
    <div class="quiz-feedback" id="quiz-feedback"></div>`;
  const wrap = area.querySelector(".choices");
  options.forEach(meaning => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = meaning;
    btn.addEventListener("click", () => answer(meaning, cur, wrap, btn));
    wrap.appendChild(btn);
  });
}

function answer(picked, cur, wrap, btn) {
  const fb = $("#quiz-feedback");
  $$(".choice").forEach(b => { b.disabled = true; });
  if (picked === cur.meaning) {
    btn.classList.add("good");
    fb.textContent = "答对了！奖励将在本组结算时一起发放。";
    fb.className = "quiz-feedback good";
  } else {
    btn.classList.add("bad");
    fb.textContent = `答错了。正确答案：${cur.word} = ${cur.meaning}（零扣除，继续下一题）`;
    fb.className = "quiz-feedback bad";
  }
  setTimeout(() => {
    learn.idx++;
    if (learn.idx >= learn.order.length) finishLearning();
    else renderQuiz();
  }, 1100);
}

function finishLearning() {
  state.stamina += 5;
  state.weapon++;
  state.pendants++;
  saveAll();
  renderHome(); // 主页数据同步（面板立即可见，A2/A4）
  $("#quiz-area").innerHTML = `
    <div class="reward-box">
      <h3>本组学习完成，奖励到账！</h3>
      <ul>
        <li>体力 +5（现 ${state.stamina}）</li>
        <li>血染荒城 +1（攻击力 ${attackPower()}）</li>
        <li>workbuddy挂坠 +1（分数获得效率 +20%）</li>
      </ul>
      <p class="hint">移动速度现为 ${speedPct()}%，只增不减。</p>
      <div class="row">
        <button class="primary" id="btn-go-battle">进入战斗</button>
        <button id="btn-back-home">返回主页</button>
        <button id="btn-learn-again">再学一组</button>
      </div>
    </div>`;
  $("#btn-go-battle").addEventListener("click", () => showView("view-battle"));
  $("#btn-back-home").addEventListener("click", () => showView("view-home"));
  $("#btn-learn-again").addEventListener("click", () => { learn = null; renderPacks(); });
}

// ============ 战斗页（2D 横版 · 陆军 · 无尽波次） ============
const cv = $("#battle-canvas");
const ctx = cv.getContext("2d");
// 血染荒城长柄版：只把枪柄拉长 1.5 倍（刀头与坠饰像素原样保留，见 assets 生成脚本记录）
const weaponImgLong = new Image();
weaponImgLong.src = "assets/血染荒城-hand-long.png";
// 两面三尖刀手持图（原图顺时针转 45° 转正裁切：刃口朝上、柄垂直向下）
const weapon2Img = new Image();
weapon2Img.src = "assets/两面三尖刀-hand.png";

// 武器注册表（Day 11 追加：战斗中按 1/2 切换手上武器）
// lean = 贴图自带的倾斜补偿角：血染荒城手持图斜 32.5°，两面三尖刀已转正为 0°
// drawH = 画布上的持握高度。血染荒城长柄版 734×697，drawH 186 ≈ 原 148/556 的放大倍率（0.266），
//         即刀头渲染尺寸与旧版完全一致，只有柄变长；grip 按新素材柄末端实测 (0.599, 1.00)
// 注意：挥砍命中判定用的是固定 60px 范围，与 drawH 无关，改大小不影响平衡
const WEAPONS = {
  1: { name: "血染荒城",   img: weaponImgLong, lean: 32.5, gripX: 0.599, gripY: 1.00, drawH: 186, owned: () => state.weapon > 0 },
  2: { name: "两面三尖刀", img: weapon2Img,    lean: 0,    gripX: 0.524, gripY: 1.00, drawH: 240, owned: () => state.weapon2 > 0 }
};
const curWeapon = () => WEAPONS[state.activeWeapon] || WEAPONS[1];

// 当前应显示的精灵帧（draw 与 drawWeapon 共用，保证武器和身体始终同一帧）
// 同时返回该帧的右手锚点 hand，避免调用方再去猜 sheet/frame 的对应关系
function playerFrame(p) {
  const ch = curChar();
  let kind, fi;
  if (!p.onGround) { kind = "walk"; fi = 1; }                                        // 跳跃/下落：跨步定格
  else if (p.moving) { kind = "walk"; fi = Math.floor(p.animT / 0.12) % ch.walk.frames; }
  else { kind = "idle"; fi = Math.floor(p.animT / 0.7) % ch.idle.frames; }
  const sheet = ch[kind];
  const fw = sheet.img.naturalWidth ? sheet.img.naturalWidth / sheet.frames : 0;
  // 兜底：锚点数据缺失时退回身体中线、脚底上方 50px，绝不让绘制抛错拖死整个游戏循环
  const hand = (ch.hand && ch.hand[kind] && ch.hand[kind][fi]) || [fw / 2, 78];
  return { sheet, fi, hand };
}

// 把武器画在玩家手上：握点 = 当前角色帧的右手锚点（CHAR_META.hand），随待机/行走/跳跃逐帧跟随
function drawWeapon(p) {
  const w = curWeapon();
  if (!w.owned() || !w.img.complete || !w.img.naturalWidth) return null;
  const { sheet, fi, hand } = playerFrame(p);
  if (!sheet.img.complete || !sheet.img.naturalWidth) return null;
  const fw = sheet.img.naturalWidth / sheet.frames;
  // 手的世界坐标：精灵脚踩 p.y+p.h、高 128、水平居中于碰撞盒；锚点先转成精灵局部坐标再按朝向翻转
  // 法天象地时精灵与碰撞盒同步放大，手部锚点也要按同一倍率缩放，武器才不会脱离手
  const gs = p.giantScale;
  const [ax, ay] = hand;
  const handX = p.x + p.w / 2 + p.face * (ax - fw / 2) * gs;
  const handY = p.y + p.h - (128 - ay) * gs;
  // 武器整体（长宽）按蓄力进度 / 体型倍率放大
  const H = w.drawH * weaponScale(p), W = H * w.img.naturalWidth / w.img.naturalHeight;
  const gripX = W * w.gripX, gripY = H * w.gripY;
  const L = w.lean * Math.PI / 180;
  ctx.save();
  ctx.translate(handX, handY);
  ctx.scale(p.face, 1);                       // 朝向翻转
  const base = (45 + w.lean) * Math.PI / 180; // 平时 45° 斜握（叠加贴图固有倾角）
  let ang;
  if (p.slamming) ang = base + 135 * Math.PI / 180;   // 快速下砸时：枪头朝正下
  else if (p.swing > 0) ang = L + (1 - p.swing / SWING_TIME) * 90 * Math.PI / 180;   // 挥砍：枪头从 90°(上) 抡到 0°(前)
  else ang = base;
  ctx.rotate(ang);
  ctx.drawImage(w.img, -gripX, -gripY, W, H);
  ctx.restore();
  return { x: handX, y: handY };              // 供刀光对齐手部
}
const CVW = 1200, CVH = 600, GROUND = 550, GRAV = 0.55, JUMP = -11;
// 血染荒城技能参数（下砸 500px/s，冲击波传播 300px/s，换算成每帧 px）
const SLAM_FALL = 500 / 60;          // 空中按 J 快速下砸
const SHOCK_SPEED = 300 / 60;        // 闪电冲击波向左右传播
const SHOCK_DMG = 10;                // 冲击波伤害
const SWING_TIME = 0.25;             // 挥砍动画时长（秒）
const SWING_CD = 0.1;                // 挥砍完成后的冷却（秒）
const SWING_RANGE = 60;              // 挥砍判定范围（面前多少 px 内吃到剑气）
// 三尖两面刀技能「法天象地」：长按 J 蓄力 8s，武器长宽均匀涨到 2 倍；蓄满松开进入法天象地
const CHARGE_TIME = 8;               // 蓄满所需秒数
const CHARGE_MAX = 2;                // 蓄满时武器的长宽倍数
const CHARGE_DELAY = 0.35;           // 按住超过这个时长才转入蓄力（更短的按下仍算普通挥砍）
const GIANT_GROW = 0.5, GIANT_HOLD = 5, GIANT_SHRINK = 1;   // 0.5s 变大 / 5s 持续 / 1s 恢复（时间节点不变）
const GIANT_MAX = 3;                 // 法天象地最大体型倍率（长宽 ×3）；与武器倍率 CHARGE_MAX 互相独立
let battle = null;

function createBattle() {
  return {
    wave: 1, kills: 0, over: false, raf: 0, last: performance.now(),
    player: {
      x: CVW / 2 - 14, y: GROUND - 44, w: 28, h: 44, bw: 28, bh: 44,   // bw/bh：原始碰撞盒，法天象地时按体型倍率缩放
      vy: 0, hp: 10, face: 1, cd: 0, swing: 0, inv: 0, onGround: true,
      slamming: false, swingHits: new Set(),   // swingHits：本次挥砍已命中的敌人
      moving: false, animT: 0,                 // 动画：是否在走 / 动画累计时间
      // 三尖两面刀技能状态
      charge: 0,          // 蓄力累计秒数（0 ~ CHARGE_TIME），松手未满则清零
      jHeldT: 0,          // J 键已按住的秒数，用于区分「短按挥砍」与「长按蓄力」
      swingRange: 1,      // 本次挥砍的范围倍率（蓄力未满松手 / 法天象地时会 >1）
      giant: null,        // 法天象地阶段：null | "grow" | "hold" | "shrink"
      giantT: 0,          // 当前阶段已过秒数
      giantScale: 1       // 体型倍率 1 → GIANT_MAX(3)（变大 0.5s、持续 5s、恢复 1s 内均匀变化）
    },
    monsters: [], toSpawn: 5, spawnTimer: 0.5, betweenTimer: 0,
    shockwaves: [], shockTimer: 0, slamX: 0, mobId: 0,
    keys: {}, moveScale: 1, weaponMsg: null   // moveScale：摇杆力度（键盘恒为 1，摇杆按推动幅度 0.5~1）
  };
}

function waveHp(w) { return 2 + Math.floor(w / 2); }       // 波次越深越厚
function waveSpeed(w) { return Math.min(2.2, 0.8 + w * 0.15); }
function waveDmg(w) { return 1 + Math.floor(w / 3); }

// 血染荒城：在落地点生成一道闪电冲击波（第一道传 50px 消失，第二道传 100px 消失）
function spawnShock(b, tier) {
  b.shockwaves.push({ x: b.slamX, d: 0, maxD: tier === 1 ? 50 : 100, tier, hits: new Set() });
}

function spawnMonster(b) {
  const fromLeft = Math.random() < 0.5;
  const w = 30, h = 26;
  b.monsters.push({
    id: b.mobId++,
    x: fromLeft ? -w - 4 : CVW + 4, y: GROUND - h, w, h,
    vx: fromLeft ? waveSpeed(b.wave) : -waveSpeed(b.wave),
    hp: waveHp(b.wave), maxHp: waveHp(b.wave), dmg: waveDmg(b.wave)
  });
}

// ============ 三尖两面刀技能「法天象地」 ============
// 武器当前放大倍率：蓄力时随蓄力进度均匀 1 → 2；法天象地期间维持蓄满的 2 倍
// 注意：武器倍率（CHARGE_MAX=2）与体型倍率（GIANT_MAX=3）刻意解耦——若跟随体型，×3 会把武器拉到 720px 冲出画面顶部
function weaponScale(p) {
  if (p.giant) {
    return p.giant === "shrink"
      ? 1 + (CHARGE_MAX - 1) * (1 - Math.min(1, p.giantT / GIANT_SHRINK))   // 恢复期 2 → 1
      : CHARGE_MAX;                                                          // 变大期一进来就是满倍率，最大体型期保持
  }
  if (p.charge > 0) return 1 + (p.charge / CHARGE_TIME) * (CHARGE_MAX - 1);
  return 1;
}
// 触发一次挥砍：rangeScale 作用于判定范围；法天象地期间时长与冷却都翻倍（伤害在判定处 ×2）
function fireSwing(p, rangeScale) {
  const g = p.giant !== null;
  const t = SWING_TIME * (g ? 2 : 1);
  p.cd = t + SWING_CD * (g ? 2 : 1);
  p.swing = t;
  p.swingRange = rangeScale || 1;
  p.swingHits = new Set();
}
function startGiant(p) {
  p.giant = "grow"; p.giantT = 0; p.giantScale = 1;
  showWeaponMsg("法天象地！体型暴涨，撞到即秒杀（5 秒）");
}
// 三阶段推进：0.5s 变大 → 5s 最大体型 → 1s 恢复，倍率随时间均匀变化（时间节点不随最大倍率改变）
function updateGiant(p, dt) {
  if (!p.giant) return;
  p.giantT += dt / 1000;
  if (p.giant === "grow") {
    p.giantScale = 1 + (GIANT_MAX - 1) * Math.min(1, p.giantT / GIANT_GROW);
    if (p.giantT >= GIANT_GROW) { p.giant = "hold"; p.giantT = 0; p.giantScale = GIANT_MAX; }
  } else if (p.giant === "hold") {
    p.giantScale = GIANT_MAX;
    if (p.giantT >= GIANT_HOLD) { p.giant = "shrink"; p.giantT = 0; }
  } else {
    p.giantScale = GIANT_MAX - (GIANT_MAX - 1) * Math.min(1, p.giantT / GIANT_SHRINK);
    if (p.giantT >= GIANT_SHRINK) { p.giant = null; p.giantT = 0; p.giantScale = 1; }
  }
  // 碰撞盒随体型缩放：保持中心不变、脚底不离开地面
  const cx = p.x + p.w / 2, foot = p.y + p.h;
  p.w = p.bw * p.giantScale; p.h = p.bh * p.giantScale;
  p.x = Math.max(0, Math.min(CVW - p.w, cx - p.w / 2));
  p.y = foot - p.h;
  if (p.y + p.h > GROUND) p.y = GROUND - p.h;
}

function startBattle() {
  if (battle && !battle.over) return;
  battle = createBattle();
  $("#battle-over").classList.add("hidden");
  $("#battle-tip").style.display = "";
  if (padEl) {
    padEl.classList.remove("pad-off");            // 战局开始：重新露出触屏操作层
    // 手机屏比页面短，画布常在视野外——开战时把战斗区滚进屏幕（仅触屏层可见时才做）
    if (padEl.offsetParent !== null) {
      const v = $("#view-battle");
      if (v && v.scrollIntoView) v.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }
  updateHud();
  battle.raf = requestAnimationFrame(tick);
}

function stopBattle() {
  if (battle && battle.raf) cancelAnimationFrame(battle.raf);
  battle = null;
}

function tick(now) {
  if (!battle) return;
  const dt = Math.min(32, now - battle.last);
  battle.last = now;
  const k = dt / 16.666;
  if (!battle.over) update(k, dt);
  draw();
  updateHud();
  if (!battle.over) battle.raf = requestAnimationFrame(tick);
  else showBattleOver();
}

function update(k, dt) {
  const b = battle, p = b.player;
  // 左右移动（移速由体力换算；moveScale 是摇杆力度，键盘恒为 1）
  const sp = moveSpeed() * b.moveScale;
  const goL = b.keys["ArrowLeft"] || b.keys["a"] || b.keys["A"];
  const goR = b.keys["ArrowRight"] || b.keys["d"] || b.keys["D"];
  if (goL) { p.x -= sp * k; p.face = -1; }
  if (goR) { p.x += sp * k; p.face = 1; }
  p.moving = !!(goL || goR);
  p.animT += dt / 1000;
  p.x = Math.max(0, Math.min(CVW - p.w, p.x));
  // 跳跃（重力）
  if (p.onGround && (b.keys["ArrowUp"] || b.keys[" "] || b.keys["w"] || b.keys["W"])) {
    p.vy = JUMP; p.onGround = false;
  }
  // 血染荒城：空中按 J → 以 100px/s 恒定速度快速下砸（技能绑定血染荒城，需手持武器1）
  if ((b.keys["j"] || b.keys["J"]) && !p.onGround && !p.slamming && state.weapon > 0 && state.activeWeapon === 1) p.slamming = true;
  if (p.slamming) { p.vy = SLAM_FALL; }   // 下砸期间不受重力，匀速下落
  else p.vy += GRAV * k;
  p.y += p.vy * k;
  if (p.y >= GROUND - p.h) {
    p.y = GROUND - p.h; p.vy = 0; p.onGround = true;
    if (p.slamming) {   // 下砸落地：第一道冲击波，100ms 后第二道
      p.slamming = false;
      b.slamX = p.x + p.w / 2;
      spawnShock(b, 1);
      b.shockTimer = 0.1;
    }
  }
  // 攻击（J）：面前短距离；挥砍 0.25s + 冷却 0.1s
  p.cd = Math.max(0, p.cd - dt / 1000);
  p.swing = Math.max(0, p.swing - dt / 1000);
  p.inv = Math.max(0, p.inv - dt / 1000);
  // ===== 三尖两面刀：长按 J 蓄力，蓄满松手释放「法天象地」=====
  const jHeld = !!(b.keys["j"] || b.keys["J"]);
  const w2Ready = state.activeWeapon === 2 && curWeapon().owned();
  p.jHeldT = jHeld ? p.jHeldT + dt / 1000 : 0;
  // 短按（< 0.35s）仍是普通挥砍；按住超过阈值才转蓄力，蓄力期间不出剑气、不造成伤害
  const charging = w2Ready && jHeld && !p.slamming && p.giant === null && p.jHeldT > CHARGE_DELAY;
  if (charging) p.charge = Math.min(CHARGE_TIME, p.charge + dt / 1000);
  // 松手：蓄满 → 法天象地；未满 → 按当前武器倍率打一次点按挥砍，随后进度清零
  if (!jHeld && p.charge > 0) {
    if (p.charge >= CHARGE_TIME) startGiant(p);
    else if (p.cd <= 0 && !p.slamming) fireSwing(p, weaponScale(p));
    p.charge = 0;
  }
  updateGiant(p, dt);
  // 普通挥砍（J）：法天象地期间范围 ×2（伤害在判定处 ×2，时长与冷却也在 fireSwing 里翻倍）
  if (jHeld && !p.slamming && !charging) {
    if (p.cd <= 0) fireSwing(p, p.giant ? 2 : 1);
  }
  // 剑气伤害：白弧（剑气）出现的挥砍期间才判定，每只怪每次挥砍只中一次
  if (p.swing > 0) {
    const range = SWING_RANGE * (p.swingRange || 1);
    const x1 = p.face > 0 ? p.x + p.w : p.x - range;
    b.monsters.forEach(m => {
      if (p.swingHits.has(m.id)) return;
      const overlapY = m.y + m.h > p.y && m.y < p.y + p.h;
      const overlapX = m.x < x1 + range && m.x + m.w > x1;
      if (overlapY && overlapX) {
        m.hp -= attackPower() * (p.giant ? 2 : 1);   // 法天象地期间伤害翻倍
        p.swingHits.add(m.id);
      }
    });
  }
  // 刷怪：每波 5 只，只从左右进场（A7）
  if (b.toSpawn > 0) {
    b.spawnTimer -= dt / 1000;
    if (b.spawnTimer <= 0) { spawnMonster(b); b.toSpawn--; b.spawnTimer = 1.2; }
  } else if (b.monsters.length === 0) {
    // 本波清空 → 短暂休整进入下一波（A8 难度递增）
    b.betweenTimer += dt / 1000;
    if (b.betweenTimer > 1.5) { b.betweenTimer = 0; b.wave++; b.toSpawn = 5; b.spawnTimer = 0.4; }
  }
  // 怪物移动与碰撞：始终朝玩家走（避免越过玩家后走出画面）
  b.monsters.forEach(m => {
    const dir = p.x + p.w / 2 > m.x + m.w / 2 ? 1 : -1;
    m.vx = dir * waveSpeed(b.wave);
    m.x += m.vx * k;
  });
  // 法天象地：全程无敌；仅「最大体型的 5 秒」内碰到的小怪直接秒杀（变大/恢复过程只无敌不秒）
  const giantInv = p.giant !== null, giantKill = p.giant === "hold";
  b.monsters = b.monsters.filter(m => {
    if (m.hp <= 0) { b.kills++; return false; }   // 分数 = 击杀数
    const hit = p.x < m.x + m.w && p.x + p.w > m.x && p.y < m.y + m.h && p.y + p.h > m.y;
    if (hit && giantKill) { b.kills++; return false; }        // 撞到即秒杀
    if (hit && !giantInv && p.inv <= 0) {
      p.hp -= Math.max(1, m.dmg - defensePower());  // 防御减伤，至少受 1 点
      p.inv = 0.8;
    }
    return true;
  });
  // 血染荒城：第二道冲击波在落地 100ms 后从落地点生成
  if (b.shockTimer > 0) {
    b.shockTimer -= dt / 1000;
    if (b.shockTimer <= 0) spawnShock(b, 2);
  }
  // 闪电冲击波：以 100px/s 向左右同时传播，贴地命中敌人造成 10 点伤害（每只怪每道波只中一次）
  b.shockwaves.forEach(s => {
    s.d += SHOCK_SPEED * k;
    const lx = s.x - s.d, rx = s.x + s.d;
    b.monsters.forEach(m => {
      if (s.hits.has(m.id)) return;
      const nearGround = m.y + m.h > GROUND - 40;
      const hitL = lx > m.x - 6 && lx < m.x + m.w + 6;
      const hitR = rx > m.x - 6 && rx < m.x + m.w + 6;
      if (nearGround && (hitL || hitR)) { m.hp -= SHOCK_DMG; s.hits.add(m.id); }
    });
  });
  b.shockwaves = b.shockwaves.filter(s => s.d < s.maxD);
  if (p.hp <= 0) { b.over = true; }   // 战败：本局结束，资产零损失（A9）
}

function updateHud() {
  if (!battle) return;
  $("#hud-wave").textContent = battle.wave;
  $("#hud-kills").textContent = battle.kills;
  $("#hud-score").textContent = battle.kills;
  $("#hud-hp").textContent = Math.max(0, battle.player.hp);
  const cw = curWeapon();
  $("#hud-weapon").textContent = cw.owned() ? cw.name : "空手";
  updatePadWeapon();                 // 触屏「换武器」键面同步显示当前武器
}

// ============ 按 1/2 切换手上武器（Day 11 追加） ============
function switchWeapon(slot) {
  const w = WEAPONS[slot];
  if (!w) return;
  if (!w.owned()) { showWeaponMsg(`武器${slot}还没有武器`); return; }   // 无效操作不静默
  if (state.activeWeapon === slot) { showWeaponMsg(`手上已经是${w.name}`); return; }
  state.activeWeapon = slot;
  saveAll();
  showWeaponMsg(`已切换：${w.name}`);   // 结果确认：HUD 武器名与手上贴图同步变化
}

// 战斗画布顶部的轻提示（1.2 秒，最后 0.3 秒淡出）
function showWeaponMsg(text) {
  if (!battle) return;
  battle.weaponMsg = { text, until: performance.now() + 1200 };
}

// 血染荒城：像素画闪电（24 列 × 28 行，1 格 = 2px → 宽 48px × 高 56px，即旧版宽×3 高×2）
// B=暗蓝主体 H=亮蓝高光 Y=亮黄点缀（仅第二道显示，第一道降级为主体色）
const BOLT_SPRITE = [
  "........HBBBBBBBB.......",
  ".......HBBBBBBBBBB......",
  "......HBBBBBBBBBBBB.....",
  "......HBBBBBBBBBBBB.....",
  ".....HBBBBBBBBBBBBB.....",
  ".....HBBBBBYBBBBBB......",
  ".....HBBBBBBB...........",
  "....HBBBBBBBB...........",
  "....HBBBBBBB............",
  "...HBBBBBBBBB...........",
  "...HBBBBBBBBBB..........",
  "..HBBBBBBB..............",
  "..HBBBBBB...............",
  ".HBBBBBBBB..............",
  ".HBBBBBBBBB.............",
  ".HBBBBBBBBBBBB..........",
  "..HBBBBBBBBBBBBB........",
  "..HBBBBBBBBBBBBBBB......",
  "...HBBBBBBBBBBBBYBB.....",
  "...HBBBBBBBBBBBBBBB.....",
  "....HBBBBBBBBBBB........",
  ".....HBBBYBBBBB.........",
  ".....HBBBBBBB...........",
  "......HBBBBB............",
  "......HBBBB.............",
  ".......HBBB.............",
  ".......HBB..............",
  "........HB..............",
];
const BOLT_CELL = 2;
const BOLT_COLORS = { B: "#1d3073", H: "#7ea6ff", Y: "#ffd94a" };
function drawBolt(fx, tier, s) {
  const u = BOLT_CELL, rows = BOLT_SPRITE.length, cols = BOLT_SPRITE[0].length;
  const x0 = fx - (cols * u) / 2, y0 = GROUND - rows * u + 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = BOLT_SPRITE[r][c];
      if (ch === ".") continue;
      ctx.fillStyle = (ch === "Y" && tier === 1) ? BOLT_COLORS.B : BOLT_COLORS[ch];
      ctx.fillRect(x0 + c * u, y0 + r * u, u, u);
    }
  }
  // 落地冲击面：闪电柱根部的横向溅射像素
  ctx.fillStyle = BOLT_COLORS.B;
  ctx.fillRect(fx - 12, GROUND + 2, 24, 2);
  ctx.fillStyle = tier === 2 ? BOLT_COLORS.Y : BOLT_COLORS.H;
  ctx.fillRect(fx - 10, GROUND + 4, 5, 2);
  ctx.fillRect(fx + 5, GROUND + 6, 4, 2);
  // 传播轨迹上的能量残渣（左右对称、逐段错落）
  if (s && s.d > 10) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = tier === 2 ? BOLT_COLORS.Y : BOLT_COLORS.H;
    for (let d = 8; d < s.d - 4; d += 10) {
      const py = GROUND + 4 + (Math.floor(d / 10) % 2) * 3;
      ctx.fillRect(s.x - d, py, 2, 2);
      ctx.fillRect(s.x + d, py, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

// 技能状态的可视反馈：蓄力进度条 → 蓄满提示 → 法天象地倒计时
function drawSkillUi(p) {
  const cx = CVW / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 16px 'Microsoft YaHei', sans-serif";
  if (p.giant === "hold") {
    ctx.fillStyle = "#b8860b";
    ctx.fillText(`法天象地 · 剩余 ${(GIANT_HOLD - p.giantT).toFixed(1)}s（撞到即秒杀）`, cx, 54);
  } else if (p.giant) {
    ctx.fillStyle = "#b8860b";
    ctx.fillText(p.giant === "grow" ? "法天象地 · 体型暴涨中…" : "法天象地 · 体型恢复中…", cx, 54);
  } else if (p.charge >= CHARGE_TIME) {
    // 蓄满：文字呼吸闪烁，提示可以松手释放
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 220));
    ctx.fillStyle = "#c93c0b";
    ctx.fillText("蓄满！松开 J → 释放「法天象地」", cx, 54);
  } else if (p.charge > 0) {
    const r = p.charge / CHARGE_TIME, bw = 260, bh = 10, bx = cx - bw / 2, by = 44;
    ctx.fillStyle = "rgba(47,93,138,0.25)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#2f5d8a";
    ctx.fillRect(bx, by, bw * r, bh);
    ctx.strokeStyle = "#2f5d8a";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "#2f5d8a";
    ctx.fillText(`蓄力中 ${Math.round(r * 100)}%（武器 ×${weaponScale(p).toFixed(2)}）`, cx, by + 28);
  }
  ctx.restore();
}

function draw() {
  const b = battle, p = b.player;
  ctx.clearRect(0, 0, CVW, CVH);
  ctx.fillStyle = "#e6f1fb";                       // 天空
  ctx.fillRect(0, 0, CVW, CVH);
  ctx.fillStyle = "#cbb27e";                       // 地面
  ctx.fillRect(0, GROUND, CVW, CVH - GROUND);
  ctx.fillStyle = "#3b6d11";                       // 草皮线
  ctx.fillRect(0, GROUND, CVW, 4);

  // 玩家：所选角色精灵（待机 2 帧循环 / 行走 4 帧循环 / 空中定格跨步帧）
  const blink = p.inv > 0 && Math.floor(p.inv * 10) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  const { sheet, fi } = playerFrame(p);
  if (sheet.img.complete && sheet.img.naturalWidth) {
    const fw = sheet.img.naturalWidth / sheet.frames, fh = sheet.img.naturalHeight;
    const H = 128 * p.giantScale, W = H * fw / fh;   // 精灵 128px 高，法天象地时随体型倍率放大（脚踩盒底）
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(p.x + p.w / 2, p.y + p.h);
    ctx.scale(p.face, 1);                     // 朝左时水平翻转
    ctx.drawImage(sheet.img, fi * fw, 0, fw, fh, -W / 2, -H, W, H);
    ctx.restore();
  } else {
    // 素材未加载完：回退绿色小方块（呼应 WorkBuddy 猫的绿）
    ctx.fillStyle = "#0f6e56";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#ffffff";
    const eyeX = p.face > 0 ? p.x + p.w - 10 : p.x + 4;
    ctx.fillRect(eyeX, p.y + 8, 6, 6);
  }
  ctx.globalAlpha = 1;
  // 法天象地：金色光环（体型倍率越大越亮），让「变大了」这件事一眼可见
  if (p.giant) {
    ctx.save();
    // 透明度封顶 0.95：体型倍率已是 3，不封顶会算出 alpha=1.35 的非法颜色导致描边失效
    ctx.strokeStyle = `rgba(255, 208, 64, ${Math.min(0.95, 0.35 + 0.5 * (p.giantScale - 1))})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.85, p.h * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const handPos = drawWeapon(p);   // 当前手持武器挂在手上（按 1/2 切换），返回手部世界坐标
  // 刀光（圆心对齐当前帧的手部，跟随角色与朝向；范围随武器倍率一起变大）
  if (p.swing > 0 && handPos) {
    const rs = p.swingRange || 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(handPos.x + p.face * 26 * rs, handPos.y, 22 * rs, -1.1, 1.1);
    ctx.stroke();
  }
  drawSkillUi(p);   // 蓄力进度条 / 蓄满提示 / 法天象地剩余时间
  // 画布顶部轻提示：切换武器结果 / 空槽警示，1.2 秒后淡出
  if (b.weaponMsg && performance.now() < b.weaponMsg.until) {
    const left = b.weaponMsg.until - performance.now();
    ctx.save();
    ctx.globalAlpha = Math.min(1, left / 300);
    ctx.font = "bold 16px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#2f5d8a";
    ctx.fillText(b.weaponMsg.text, CVW / 2, 30);
    ctx.restore();
  }
  // 怪物：珊瑚色方块
  b.monsters.forEach(m => {
    ctx.fillStyle = "#d85a30";
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = "#ffffff";
    const dir = m.vx > 0 ? m.w - 10 : 4;
    ctx.fillRect(m.x + dir, m.y + 6, 6, 6);
    // 血条
    ctx.fillStyle = "#5f5e5a";
    ctx.fillRect(m.x, m.y - 8, m.w, 3);
    ctx.fillStyle = "#3b6d11";
    ctx.fillRect(m.x, m.y - 8, m.w * Math.max(0, m.hp / m.maxHp), 3);
  });
  // 血染荒城：闪电冲击波（左右两侧各一根像素闪电柱 + 轨迹残渣）
  b.shockwaves.forEach(s => {
    [-1, 1].forEach(dir => drawBolt(s.x + dir * s.d, s.tier, s));
  });
  // 波间提示
  if (b.toSpawn === 0 && b.monsters.length === 0 && !b.over) {
    ctx.fillStyle = "#2c2c2a";
    ctx.font = "20px 'Microsoft YaHei'";
    ctx.textAlign = "center";
    ctx.fillText(`第 ${b.wave} 波清空！下一波即将来袭…`, CVW / 2, 120);
    ctx.textAlign = "start";
  }
}

function showBattleOver() {
  const b = battle;
  if (padEl) padEl.classList.add("pad-off");   // 结算页：收起触屏层，避免挡住「再来一局 / 返回主页」
  clearAllInput();                             // 顺手清掉按住状态，防止下一局一进场就自动跑/自动攻击
  // workbuddy 吊坠加成：拥有 ≥1 个即生效，入账分 = 击杀数 × 1.2（四舍五入）
  const base = b.kills;
  const bonus = state.pendants > 0 ? Math.round(base * 0.2) : 0;
  const final = base + bonus;
  // 写入记录（A10）：最高分、本周累计、称号解锁；战败零损失
  state.bestScore = Math.max(state.bestScore, final);
  state.weeklyScore += final;
  checkTitles();
  runs.push({
    score: final, wave: b.wave, kills: b.kills,
    date: new Date().toISOString().slice(0, 10)
  });
  saveAll();
  $("#battle-tip").style.display = "none";
  $("#result-score").textContent = base;
  $("#result-bonus").textContent = `+${bonus}`;
  $("#result-final").textContent = final;
  $("#result-wave").textContent = b.wave;
  $("#result-kills").textContent = b.kills;
  $("#battle-over").classList.remove("hidden");
}

// ============ 键盘 ============
const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", " ", "w", "a", "d", "W", "A", "D", "j", "J"];
window.addEventListener("keydown", e => {
  if (battle && GAME_KEYS.includes(e.key)) {
    e.preventDefault();
    battle.keys[e.key] = true;
  }
  // 1/2 切换手上武器：一次性动作，不进长按表；只在战斗进行中生效
  if (battle && !battle.over && (e.key === "1" || e.key === "2")) {
    e.preventDefault();
    switchWeapon(Number(e.key));
  }
});
window.addEventListener("keyup", e => {
  if (battle && GAME_KEYS.includes(e.key)) battle.keys[e.key] = false;
});

// ============ 手机触屏操作：左半屏浮动摇杆 + 右下功能键 ============
// 设计要点：不改动任何战斗逻辑，只把触摸“翻译”成同一张 battle.keys 键表。
// 因此蓄力（按住 J 超过 0.35s）、空中下砸、法天象地松手释放等行为全部自动沿用，
// 键盘与触屏是同一套判定，不会出现两套规则各自演化的问题。
const padEl = $("#touch-pad");
const padLeft = $("#pad-left"), joyBase = $("#joy-base"), joyKnob = $("#joy-knob");
const pad = { id: null, cx: 0, cy: 0, r: 34 };   // r = 摇杆最大行程（px）

function setKey(k, v) { if (battle && !battle.over) battle.keys[k] = !!v; }

// 失焦/切后台时清空所有按住状态：避免“松手事件丢失”导致角色一直朝一个方向跑
function clearAllInput() {
  if (battle) for (const k of Object.keys(battle.keys)) battle.keys[k] = false;
  releaseJoy();
  ["#pad-atk", "#pad-jump"].forEach(s => { const el = $(s); if (el) el.classList.remove("is-down"); });
}
window.addEventListener("blur", clearAllInput);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearAllInput(); });

// 摇杆：手指落在左半屏的哪个位置，摇杆就地出现（经典手游做法，命中区域大）
function padPoint(e, el) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function releaseJoy() {
  pad.id = null;
  if (joyBase) { joyBase.style.display = "none"; if (joyKnob) joyKnob.style.transform = "translate(-50%, -50%)"; }
  setKey("ArrowLeft", false);
  setKey("ArrowRight", false);
  if (battle) battle.moveScale = 1;
}
function joyStart(e) {
  if (!battle || battle.over) return;
  const p = padPoint(e, padLeft);
  pad.id = (e.pointerId === undefined ? 1 : e.pointerId);
  pad.cx = p.x; pad.cy = p.y;
  joyBase.style.left = p.x + "px";
  joyBase.style.top = p.y + "px";
  joyBase.style.display = "block";
  if (padLeft.setPointerCapture) { try { padLeft.setPointerCapture(pad.id); } catch (err) { /* 某些环境不支持，忽略 */ } }
  e.preventDefault();
  joyMove(e);
}
function joyMove(e) {
  if (pad.id === null) return;
  if (e.pointerId !== undefined && e.pointerId !== pad.id) return;   // 多指：只跟摇杆那根手指
  const p = padPoint(e, padLeft);
  let dx = p.x - pad.cx;
  const dist = Math.abs(dx);
  if (dist > pad.r) dx = (dx < 0 ? -1 : 1) * pad.r;                  // 超出行程就贴边
  if (joyKnob) joyKnob.style.transform = `translate(calc(-50% + ${dx}px), -50%)`;
  const DEAD = 8;                                                    // 死区，避免手指微抖就走动
  setKey("ArrowLeft", dx < -DEAD);
  setKey("ArrowRight", dx > DEAD);
  // 力度：推动幅度换算成 0.5~1 倍速（轻推慢走、推满全速）
  if (battle) battle.moveScale = Math.min(1, Math.max(0.5, dist / pad.r));
  e.preventDefault();
}
if (padLeft) {
  padLeft.addEventListener("pointerdown", joyStart);
  padLeft.addEventListener("pointermove", joyMove);
  padLeft.addEventListener("pointerup", releaseJoy);
  padLeft.addEventListener("pointercancel", releaseJoy);
  padLeft.addEventListener("lostpointercapture", releaseJoy);
  padLeft.addEventListener("contextmenu", e => e.preventDefault());
}

// 按住类功能键：按下置键、松手清键（与键盘同一个 key，逻辑完全复用）
function bindHoldKey(sel, key) {
  const el = $(sel);
  if (!el) return;
  const down = e => {
    if (!battle || battle.over) return;
    e.preventDefault();
    setKey(key, true);
    el.classList.add("is-down");
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId === undefined ? 1 : e.pointerId); } catch (err) { /* 忽略 */ } }
  };
  const up = e => { e.preventDefault(); setKey(key, false); el.classList.remove("is-down"); };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("lostpointercapture", up);
  el.addEventListener("contextmenu", e => e.preventDefault());
}
bindHoldKey("#pad-jump", " ");   // 跳跃：等价于键盘空格
bindHoldKey("#pad-atk", "j");    // 攻击 / 蓄力：等价于键盘 J（短按挥砍，按住 >0.35s 蓄力）

// 换武器：手机上一个键循环切换 1↔2，键面直接显示当前手持武器（切换结果一眼可见）
function updatePadWeapon() {
  const el = $("#pad-swap-name");
  if (!el || !battle) return;
  const cw = curWeapon();
  const t = cw.owned() ? cw.name : "空手";
  if (el.textContent !== t) el.textContent = t;
}
const padSwap = $("#pad-swap");
if (padSwap) {
  padSwap.addEventListener("pointerdown", e => {
    e.preventDefault();
    if (!battle || battle.over) return;
    switchWeapon(state.activeWeapon === 1 ? 2 : 1);
    updatePadWeapon();
  });
  padSwap.addEventListener("contextmenu", e => e.preventDefault());
}

// ============ 称号「设为展示」的三层反馈（Day 11） ============
// 第 1 层即时反馈（按下就有反应）由 style.css 的 button:active 负责，Day 9 已做，这里不重复。
// 本节只补第 2 层（按钮状态反馈）与第 3 层（结果确认反馈）。
// 定时器集中放在 titleFx：连续快速点击时先清掉上一次的，避免多个定时器互相打架。
const titleFx = { btn: 0, feedback: 0, flashOff: 0 };

// 第 3 层 · 结果确认 A：按钮下方滑出提示条（role=status，屏幕阅读器也会念）
function showTitleFeedback(text, kind) {
  const fb = $("#title-feedback");
  if (!fb) return;
  fb.textContent = text;
  fb.className = `title-feedback show ${kind}`;
  clearTimeout(titleFx.feedback);
  titleFx.feedback = setTimeout(() => { fb.className = `title-feedback ${kind}`; }, 2500);
}

// 第 3 层 · 结果确认 B：「当前展示」那一行闪一下，把视线引到结果上
function flashTitleRow() {
  const row = $("#title-row");
  if (!row) return;
  row.classList.remove("flash");
  void row.offsetWidth;                     // 强制重排，动画才能被连续触发重播
  row.classList.add("flash");
  clearTimeout(titleFx.flashOff);
  titleFx.flashOff = setTimeout(() => row.classList.remove("flash"), 1100);
}

// 第 2 层 · 状态反馈：按钮自身短暂变成「已生效 ✓」再自动复原
function markTitleSaved() {
  const btn = $("#title-save");
  btn.classList.add("is-done");
  btn.textContent = "已生效 ✓";
  clearTimeout(titleFx.btn);
  titleFx.btn = setTimeout(() => {
    btn.classList.remove("is-done");
    btn.textContent = "设为展示";
  }, 1600);
}

// ============ 手机：横屏铺满 + 竖屏引导（Day 11 追加） ============
// 同样坚持「不动战斗逻辑」的原则：这里只根据「是否触屏 + 当前方向 + 是否在战斗页」
// 给 body 挂/摘 CSS 类，排版交给 style.css；输入仍然全部汇入同一张 battle.keys。
const isCoarsePointer = () => !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
const isLandscape = () => window.innerWidth > window.innerHeight;
const inBattleView = () => document.querySelector("#view-battle.active") !== null;
const rotateMask = $("#rotate-mask");
const padFs = $("#pad-fs"), padFsLabel = $("#pad-fs-label");
let portraitDismissed = false;   // 用户点了「仍要竖屏玩」就不再打扰

function isFullscreenNow() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
// 全屏 + 旋转锁定：两个 API 都可能不存在或被浏览器拒绝（iOS Safari 不支持 orientation.lock，
// 无用户手势时 requestFullscreen 也会被拒），一律静默降级——失败就停留原样，不影响游戏本身。
function requestIn(elem, method) {
  const t = elem || document.documentElement;
  const fn = t && t[method];
  if (typeof fn !== "function") return Promise.reject(new Error("unsupported"));
  try { const r = fn.call(t); return (r && r.catch) ? r : Promise.resolve(); }
  catch (e) { return Promise.reject(e); }
}
function enterFullscreen(target) {
  requestIn(target || $("#view-battle"), "requestFullscreen")
    .catch(() => requestIn(target || $("#view-battle"), "webkitRequestFullscreen"))
    .catch(() => { /* 进不了全屏也没关系，横屏布局本身已经铺满 */ });
  try {
    const so = screen.orientation || screen.msOrientation;
    if (so && so.lock) { const r = so.lock("landscape"); if (r && r.catch) r.catch(() => {}); }
  } catch (e) { /* 不支持锁定方向的设备忽略 */ }
}
function exitFullscreen() {
  requestIn(document, "exitFullscreen")
    .catch(() => requestIn(document, "webkitExitFullscreen"))
    .catch(() => {});
}
function toggleFullscreen() { if (isFullscreenNow()) exitFullscreen(); else enterFullscreen(); }

// 方向/类名同步：横屏 → 铺满；竖屏 → 弹出引导（除非已被用户关掉）
function syncOrientation() {
  const touch = isCoarsePointer();
  const battle = inBattleView();
  const land = isLandscape();
  document.body.classList.toggle("landscape-game", touch && land && battle);
  const warn = touch && battle && !land && !portraitDismissed && !isFullscreenNow();
  if (rotateMask) rotateMask.classList.toggle("hidden", !warn);
  if (padFsLabel) padFsLabel.textContent = isFullscreenNow() ? "⤢ 退出" : "⛶ 全屏";
  if (padFs) padFs.style.display = touch ? "" : "none";   // 桌面隐藏全屏按钮（桌面用系统快捷键）
}
window.addEventListener("resize", syncOrientation);
window.addEventListener("orientationchange", () => setTimeout(syncOrientation, 250));
document.addEventListener("fullscreenchange", syncOrientation);
if (padFs) {
  padFs.addEventListener("pointerdown", e => { e.preventDefault(); toggleFullscreen(); });
  padFs.addEventListener("contextmenu", e => e.preventDefault());
}
const rotFs = $("#btn-rotate-fs"), rotSkip = $("#btn-rotate-skip");
if (rotFs) rotFs.addEventListener("click", () => { enterFullscreen(); });
if (rotSkip) rotSkip.addEventListener("click", () => { portraitDismissed = true; syncOrientation(); });

// ============ 事件绑定 ============
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  renderPacks();
  startCharPreview();   // 首屏即主页，直接开播待机动画
  syncOrientation();    // 方向/全屏状态与 body 类名对齐
  $$(".char-choice").forEach(btn => btn.addEventListener("click", () => {
    state.character = btn.dataset.char;
    saveAll();
    renderHome();       // 高亮与「当前：」立即更新，预览循环自己切到新角色
  }));
  $("#btn-start-learn").addEventListener("click", () => showView("view-learn"));
  $("#btn-start-battle").addEventListener("click", () => showView("view-battle"));  // Day 10：主页直接开战（跳过学习）
  $("#btn-learn-home").addEventListener("click", () => showView("view-home"));
  $("#btn-retry").addEventListener("click", () => startBattle());
  $("#btn-battle-home").addEventListener("click", () => showView("view-home"));
  // 称号选择（P0-5.2）
  $("#title-select").addEventListener("change", e => {
    $("#title-input").style.display = e.target.value === "__custom" ? "" : "none";
  });
  // 称号「设为展示」（Day 11：补上状态反馈与结果确认反馈）
  $("#title-save").addEventListener("click", () => {
    const sel = $("#title-select");
    const v = sel.value;
    const text = v === "__custom" ? $("#title-input").value.trim() : v;

    // 边界 1：一个称号都没解锁时点按钮 —— 无效操作也必须给出反馈，不能静默无反应
    if (sel.disabled) {
      showTitleFeedback("还没有可展示的称号：本周累计满 50 分才能解锁「学习王」", "warn");
      return;
    }
    // 边界 2：选了自定义文字但输入框是空的
    if (v === "__custom" && text === "") {
      showTitleFeedback("请先输入称号文字，再点「设为展示」", "warn");
      $("#title-input").focus();
      return;
    }

    // 正常生效
    state.chosenTitle = text;
    saveAll();
    renderHome();                                     // 上方「当前展示」立即更新
    markTitleSaved();                                 // 第 2 层：按钮进入已生效态
    showTitleFeedback(`称号已生效：${text}`, "ok");    // 第 3 层 A：提示条
    flashTitleRow();                                   // 第 3 层 B：结果行闪一下
  });
});
