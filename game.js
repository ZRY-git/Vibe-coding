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
    stamina: 10, gloves: 0, bracers: 0, pendants: 0,
    bestScore: 0, weeklyScore: 0, weekKey: "",
    unlockedTitles: [], chosenTitle: ""
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
let runs = [];
try { runs = JSON.parse(localStorage.getItem(RUNS_KEY)) || []; } catch (e) { runs = []; }

function saveAll() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(-50)));
}

// ============ 派生属性（面板 4 项） ============
const attackPower = () => 1 + state.gloves;                        // 力量手套 +1
const defensePower = () => state.bracers;                          // 皮护腕 +1
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

// ============ 视图切换 ============
function showView(id) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
  if (id === "view-battle") startBattle();
  else stopBattle();
  if (id === "view-home") renderHome();
  if (id === "view-learn") renderPacks();
  window.scrollTo(0, 0);
}

// ============ 主页渲染 ============
function renderHome() {
  $("#stat-stamina").textContent = state.stamina;
  $("#stat-attack").textContent = attackPower();
  $("#stat-defense").textContent = defensePower();
  $("#stat-speed").textContent = speedPct() + "%";
  $("#slot-gloves").textContent = `力量手套 ×${state.gloves}`;
  $("#slot-bracers").textContent = `皮护腕 ×${state.bracers}`;
  $("#slot-pendant").textContent = `workbuddy挂坠 ×${state.pendants}`;
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
  state.gloves++;
  state.bracers++;
  state.pendants++;
  saveAll();
  renderHome(); // 主页数据同步（面板立即可见，A2/A4）
  $("#quiz-area").innerHTML = `
    <div class="reward-box">
      <h3>本组学习完成，奖励到账！</h3>
      <ul>
        <li>体力 +5（现 ${state.stamina}）</li>
        <li>力量手套 +1（攻击力 ${attackPower()}）</li>
        <li>皮护腕 +1（防御 ${defensePower()}）</li>
        <li>workbuddy挂坠 +1（收藏中，本期无数值）</li>
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
const CVW = 800, CVH = 360, GROUND = 310, GRAV = 0.55, JUMP = -11;
let battle = null;

function createBattle() {
  return {
    wave: 1, kills: 0, over: false, raf: 0, last: performance.now(),
    player: {
      x: CVW / 2 - 14, y: GROUND - 44, w: 28, h: 44,
      vy: 0, hp: 10, face: 1, cd: 0, swing: 0, inv: 0, onGround: true
    },
    monsters: [], toSpawn: 5, spawnTimer: 0.5, betweenTimer: 0,
    keys: {}
  };
}

function waveHp(w) { return 2 + Math.floor(w / 2); }       // 波次越深越厚
function waveSpeed(w) { return Math.min(2.2, 0.8 + w * 0.15); }
function waveDmg(w) { return 1 + Math.floor(w / 3); }

function spawnMonster(b) {
  const fromLeft = Math.random() < 0.5;
  const w = 30, h = 26;
  b.monsters.push({
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
  if (b.keys["ArrowLeft"] || b.keys["a"] || b.keys["A"]) { p.x -= sp * k; p.face = -1; }
  if (b.keys["ArrowRight"] || b.keys["d"] || b.keys["D"]) { p.x += sp * k; p.face = 1; }
  p.x = Math.max(0, Math.min(CVW - p.w, p.x));
  // 跳跃（重力）
  if (p.onGround && (b.keys["ArrowUp"] || b.keys[" "] || b.keys["w"] || b.keys["W"])) {
    p.vy = JUMP; p.onGround = false;
  }
  p.vy += GRAV * k;
  p.y += p.vy * k;
  if (p.y >= GROUND - p.h) { p.y = GROUND - p.h; p.vy = 0; p.onGround = true; }
  // 攻击（J）：面前短距离，冷却 0.35s
  p.cd = Math.max(0, p.cd - dt / 1000);
  p.swing = Math.max(0, p.swing - dt / 1000);
  p.inv = Math.max(0, p.inv - dt / 1000);
  if (b.keys["j"] || b.keys["J"]) {
    if (p.cd <= 0) {
      p.cd = 0.35; p.swing = 0.15;
      const x1 = p.face > 0 ? p.x + p.w : p.x - 60;
      b.monsters.forEach(m => {
        const overlapY = m.y + m.h > p.y && m.y < p.y + p.h;
        const overlapX = m.x < x1 + 60 && m.x + m.w > x1;
        if (overlapY && overlapX) m.hp -= attackPower();
      });
    }
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
  if (p.hp <= 0) { b.over = true; }   // 战败：本局结束，资产零损失（A9）
}

function updateHud() {
  if (!battle) return;
  $("#hud-wave").textContent = battle.wave;
  $("#hud-kills").textContent = battle.kills;
  $("#hud-score").textContent = battle.kills;
  $("#hud-hp").textContent = Math.max(0, battle.player.hp);
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

  // 玩家：绿色小方块（呼应 WorkBuddy 猫的绿）
  const blink = p.inv > 0 && Math.floor(p.inv * 10) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.fillStyle = "#0f6e56";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#ffffff";
  const eyeX = p.face > 0 ? p.x + p.w - 10 : p.x + 4;
  ctx.fillRect(eyeX, p.y + 8, 6, 6);
  ctx.globalAlpha = 1;
  // 刀光
  if (p.swing > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const cx = p.face > 0 ? p.x + p.w + 26 : p.x - 26;
    ctx.arc(cx, p.y + p.h / 2, 22, -1.1, 1.1);
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
  // 写入记录（A10）：最高分、本周累计、称号解锁；战败零损失
  state.bestScore = Math.max(state.bestScore, b.kills);
  state.weeklyScore += b.kills;
  checkTitles();
  runs.push({
    score: b.kills, wave: b.wave, kills: b.kills,
    date: new Date().toISOString().slice(0, 10)
  });
  saveAll();
  $("#battle-tip").style.display = "none";
  $("#result-score").textContent = b.kills;
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

// ============ 事件绑定 ============
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  renderPacks();
  $("#btn-start-learn").addEventListener("click", () => showView("view-learn"));
  $("#btn-learn-home").addEventListener("click", () => showView("view-home"));
  $("#btn-retry").addEventListener("click", () => startBattle());
  $("#btn-battle-home").addEventListener("click", () => showView("view-home"));
  // 称号选择（P0-5.2）
  $("#title-select").addEventListener("change", e => {
    $("#title-input").style.display = e.target.value === "__custom" ? "" : "none";
  });
  $("#title-save").addEventListener("click", () => {
    const v = $("#title-select").value;
    state.chosenTitle = v === "__custom" ? $("#title-input").value.trim() : v;
    saveAll();
    renderHome();
  });
});
