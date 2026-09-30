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
    stamina: 10, weapon: 0, pendants: 0,
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
const CHAR_META = {
  m: { name: "Henry", idle: { src: "assets/char-m-idle.png", frames: 2 }, walk: { src: "assets/char-m-walk.png", frames: 4 } },
  f: { name: "Rena",  idle: { src: "assets/char-f-idle.png", frames: 2 }, walk: { src: "assets/char-f-walk.png", frames: 4 } }
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
// 血染荒城手持图（已抠透明背景）
const weaponImg = new Image();
weaponImg.src = "assets/血染荒城-hand.png";

// 把武器画在玩家手上：尺寸随人物放大（人物 128px，武器 ≈148px，保持原有人枪比例），握点 = 切断的杆口
function drawWeapon(p) {
  if (state.weapon < 1 || !weaponImg.complete || !weaponImg.naturalWidth) return;
  const H = 148, W = H * weaponImg.naturalWidth / weaponImg.naturalHeight;
  const gripX = W * 0.50, gripY = H * 0.98;
  ctx.save();
  // 手的位置：精灵脚踩 p.y+p.h、高 128px，手部约在脚底上方 50px、身体中线略前
  ctx.translate(p.x + p.w / 2 + p.face * 8, p.y + p.h - 50);
  ctx.scale(p.face, 1);                       // 朝向翻转
  const base = 77.5 * Math.PI / 180;          // 平时 45° 斜握（枪头指向前上方 45°）
  let ang;
  if (p.slamming) ang = base + 135 * Math.PI / 180;   // 快速下砸时：枪头朝正下（-90°）
  else if (p.swing > 0) ang = (32.5 + (1 - p.swing / SWING_TIME) * 90) * Math.PI / 180;   // 挥砍：枪头从 90°(上) 抡到 0°(前)
  else ang = base;
  ctx.rotate(ang);
  ctx.drawImage(weaponImg, -gripX, -gripY, W, H);
  ctx.restore();
}
const CVW = 1200, CVH = 600, GROUND = 550, GRAV = 0.55, JUMP = -11;
// 血染荒城技能参数（下砸 500px/s，冲击波传播 300px/s，换算成每帧 px）
const SLAM_FALL = 500 / 60;          // 空中按 J 快速下砸
const SHOCK_SPEED = 300 / 60;        // 闪电冲击波向左右传播
const SHOCK_DMG = 10;                // 冲击波伤害
const SWING_TIME = 0.25;             // 挥砍动画时长（秒）
const SWING_CD = 0.1;                // 挥砍完成后的冷却（秒）
let battle = null;

function createBattle() {
  return {
    wave: 1, kills: 0, over: false, raf: 0, last: performance.now(),
    player: {
      x: CVW / 2 - 14, y: GROUND - 44, w: 28, h: 44,
      vy: 0, hp: 10, face: 1, cd: 0, swing: 0, inv: 0, onGround: true,
      slamming: false, swingHits: new Set(),   // swingHits：本次挥砍已命中的敌人
      moving: false, animT: 0                  // 动画：是否在走 / 动画累计时间
    },
    monsters: [], toSpawn: 5, spawnTimer: 0.5, betweenTimer: 0,
    shockwaves: [], shockTimer: 0, slamX: 0, mobId: 0,
    keys: {}
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

function startBattle() {
  if (battle && !battle.over) return;
  battle = createBattle();
  $("#battle-over").classList.add("hidden");
  $("#battle-tip").style.display = "";
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
  // 左右移动（移速由体力换算）
  const sp = moveSpeed();
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
  // 血染荒城：空中按 J → 以 100px/s 恒定速度快速下砸（需持有武器）
  if ((b.keys["j"] || b.keys["J"]) && !p.onGround && !p.slamming && state.weapon > 0) p.slamming = true;
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
  if ((b.keys["j"] || b.keys["J"]) && !p.slamming) {
    if (p.cd <= 0) {
      p.cd = SWING_TIME + SWING_CD; p.swing = SWING_TIME;
      p.swingHits = new Set();
    }
  }
  // 剑气伤害：白弧（剑气）出现的挥砍期间才判定，每只怪每次挥砍只中一次
  if (p.swing > 0) {
    const x1 = p.face > 0 ? p.x + p.w : p.x - 60;
    b.monsters.forEach(m => {
      if (p.swingHits.has(m.id)) return;
      const overlapY = m.y + m.h > p.y && m.y < p.y + p.h;
      const overlapX = m.x < x1 + 60 && m.x + m.w > x1;
      if (overlapY && overlapX) { m.hp -= attackPower(); p.swingHits.add(m.id); }
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
  b.monsters = b.monsters.filter(m => {
    if (m.hp <= 0) { b.kills++; return false; }   // 分数 = 击杀数
    const hit = p.x < m.x + m.w && p.x + p.w > m.x && p.y < m.y + m.h && p.y + p.h > m.y;
    if (hit && p.inv <= 0) {
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
  const ch = curChar();
  let sheet, fi;
  if (!p.onGround) { sheet = ch.walk; fi = 1; }                       // 跳跃/下落：跨步定格
  else if (p.moving) { sheet = ch.walk; fi = Math.floor(p.animT / 0.12) % sheet.frames; }
  else { sheet = ch.idle; fi = Math.floor(p.animT / 0.7) % sheet.frames; }
  if (sheet.img.complete && sheet.img.naturalWidth) {
    const fw = sheet.img.naturalWidth / sheet.frames, fh = sheet.img.naturalHeight;
    const H = 128, W = H * fw / fh;           // 精灵 128px 高（碰撞盒仍是 28×44，脚踩盒底）
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
  drawWeapon(p);   // 血染荒城挂在手上
  // 刀光（中心对齐手部高度）
  if (p.swing > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const cx = p.face > 0 ? p.x + p.w + 26 : p.x - 26;
    ctx.arc(cx, p.y + p.h - 50, 22, -1.1, 1.1);
    ctx.stroke();
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
});
window.addEventListener("keyup", e => {
  if (battle && GAME_KEYS.includes(e.key)) battle.keys[e.key] = false;
});

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

// ============ 事件绑定 ============
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  renderPacks();
  startCharPreview();   // 首屏即主页，直接开播待机动画
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
