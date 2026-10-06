// 主页渲染逻辑 · Day 8
// 数据来自 mock-data.js（本地假数据），只负责把数据画到页面上
// Day 12：新增单词列表筛选（状态 + 关键词），筛选只改条件，不改数据
// Day 13：新增 hash 路由（3 个视图）与列表四种数据状态（正常/加载中/空数据/出错）

/* ===================== 一、Day 12 的筛选（本次未改逻辑） ===================== */

// 当前筛选条件。只存「用户想筛什么」，不存筛选结果，
// 避免出现第二份真相 —— 结果每次由 MOCK_WORDS 现算。
const filterState = { status: "all", keyword: "" };

function renderStats() {
  const grid = document.getElementById("stat-grid");
  grid.innerHTML = MOCK_STATS.map(function (s) {
    return (
      '<div class="stat-card">' +
      '<span class="stat-label">' + s.label + "</span>" +
      '<b class="stat-value">' + s.value + "</b>" +
      '<span class="stat-sub">' + s.sub + "</span>" +
      "</div>"
    );
  }).join("");
}

// 按当前条件从同一份 MOCK_WORDS 里筛出要显示的单词
function getVisibleWords() {
  const kw = filterState.keyword.trim().toLowerCase();
  return MOCK_WORDS.filter(function (w) {
    const hitStatus = filterState.status === "all" || w.status === filterState.status;
    const hitKeyword =
      kw === "" ||
      w.word.toLowerCase().indexOf(kw) !== -1 ||
      w.meaning.indexOf(kw) !== -1;
    return hitStatus && hitKeyword;
  });
}

// 结果计数：有结果、无结果都要说清「共几个 / 显示几个」
function renderCount(shown) {
  const el = document.getElementById("filter-count");
  el.textContent = "共 " + MOCK_WORDS.length + " 个单词，当前显示 " + shown + " 个";
  el.classList.toggle("is-empty", shown === 0);
}

function renderWords() {
  const list = document.getElementById("word-list");
  const words = getVisibleWords();

  if (words.length === 0) {
    // 「筛选没命中」：数据是好的，只是条件太窄。文案要和「空数据」区分开。
    list.innerHTML =
      '<li class="word-empty">没有符合当前条件的单词 —— 换个关键词，或点「清空筛选」看全部。</li>';
  } else {
    list.innerHTML = words.map(function (w) {
      return (
        '<li class="word-item">' +
        "<b>" + w.word + "</b>" +
        "<span>" + w.meaning + "</span>" +
        '<span class="word-tag">' + w.pack + "</span>" +
        '<span class="word-status ' + w.status + '">' + STATUS_TEXT[w.status] + "</span>" +
        "</li>"
      );
    }).join("");
  }

  renderCount(words.length);
}

// 把按钮选中态同步到界面上，让「当前筛的是什么」看得见，不靠记
function syncChips() {
  const chips = document.querySelectorAll("#word-filter .filter-chip");
  for (let i = 0; i < chips.length; i++) {
    const on = chips[i].getAttribute("data-status") === filterState.status;
    chips[i].classList.toggle("is-on", on);
    chips[i].setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function clearFilter() {
  filterState.status = "all";
  filterState.keyword = "";
  document.getElementById("filter-keyword").value = "";
  syncChips();
  renderWords();
}

function bindFilter() {
  const bar = document.getElementById("word-filter");

  // 状态按钮：点哪个就把条件换成哪个（事件委托，按钮是数据驱动的）
  bar.addEventListener("click", function (e) {
    const chip = e.target.closest(".filter-chip");
    if (!chip) return;
    filterState.status = chip.getAttribute("data-status");
    syncChips();
    renderWords();
  });

  // 关键词：输入即筛
  document.getElementById("filter-keyword").addEventListener("input", function (e) {
    filterState.keyword = e.target.value;
    renderWords();
  });

  // 清空：条件与列表一起回到未筛选状态
  document.getElementById("filter-clear").addEventListener("click", clearFilter);
}

/* ===================== 二、Day 13 的 hash 路由 =====================
   地址格式：#/<视图>[/<列表状态>]
     #/overview          概览
     #/words             单词列表 · 正常
     #/words/loading     单词列表 · 加载中
     #/words/empty       单词列表 · 空数据
     #/words/error       单词列表 · 出错
     #/about             关于与下一步
   没有任何 hash 时 → 兜底到 #/overview；视图名或状态名不认识 → 也兜底，不白屏。 */

const VIEWS = ["overview", "words", "about"];
const LIST_STATES = ["ok", "loading", "empty", "error"];
const LIST_STATE_TEXT = { ok: "正常", loading: "加载中", empty: "空数据", error: "出错" };
const DEFAULT_HASH = "#/overview";
const SIM_DELAY = 1200; // 「模拟真实加载」耗时，和真实请求一个量级

let simTimer = null; // 模拟加载的计时器；离开加载态必须清掉，否则会把用户拽走

// 会话内的导航轨迹（今日加练用）：判断「还有没有上一页可回」。
// 浏览器只会告诉我们「hash 变了」，不说是前进还是后退，所以自己记一份轨迹：
// 落到轨迹里的上一条 = 后退，下一条 = 前进，都不是 = 新跳转。
let trail = [];
let trailIndex = -1;

function trackHash(hash) {
  if (trailIndex >= 0 && trail[trailIndex] === hash) return;              // 原地没动
  if (trailIndex > 0 && trail[trailIndex - 1] === hash) {                 // 后退
    trailIndex--;
    return;
  }
  if (trailIndex < trail.length - 1 && trail[trailIndex + 1] === hash) {  // 前进
    trailIndex++;
    return;
  }
  trail = trail.slice(0, trailIndex + 1);                                 // 新跳转：截断后重记
  trail.push(hash);
  trailIndex = trail.length - 1;
}

function canGoBack() {
  return trailIndex > 0;
}

// 把地址栏的 hash 解析成 { view, state }，并负责兜底。
// 不是 #/ 开头的地址（例如跳到主内容的 #main-content）返回 null —— 交给浏览器自己跳，不动视图
function parseHash() {
  if (location.hash && location.hash.indexOf("#/") !== 0) return null;

  const seg = location.hash.replace(/^#\/?/, "").split("/");
  const rawView = seg[0] || "";
  const rawState = seg[1] || "";

  // 兜底一：视图名不认识（手敲错了、分享链接被改坏）→ 回默认视图
  const view = VIEWS.indexOf(rawView) !== -1 ? rawView : "overview";

  // 兜底二：只有 words 有二级状态；状态名不认识 → 正常态
  const state =
    view === "words" && LIST_STATES.indexOf(rawState) !== -1 ? rawState : "ok";

  return { view: view, state: state };
}

// 一次只显示一个视图，复用项目已有的 .view / .view.active 机制
function showView(view) {
  const sections = document.querySelectorAll("main .view");
  for (let i = 0; i < sections.length; i++) {
    sections[i].classList.toggle("active", sections[i].getAttribute("data-view") === view);
  }
}

// 导航高亮 + aria-current，让「现在在哪」看得见，屏幕阅读器也读得到
function syncNav(view) {
  const links = document.querySelectorAll(".page-nav .nav-link");
  for (let i = 0; i < links.length; i++) {
    const on = links[i].getAttribute("data-view") === view;
    links[i].classList.toggle("is-on", on);
    if (on) {
      links[i].setAttribute("aria-current", "page");
    } else {
      links[i].removeAttribute("aria-current");
    }
  }
}

/* ---------- 三种非正常状态的样子 ---------- */

// 加载中：骨架屏（形状照着 .word-item 排，加载完不跳位）
function skeletonHtml() {
  let rows = "";
  for (let i = 0; i < 3; i++) {
    rows +=
      '<div class="skeleton-row">' +
      '<span class="skeleton-bar bar-a"></span>' +
      '<span class="skeleton-bar bar-b"></span>' +
      '<span class="skeleton-bar bar-c"></span>' +
      "</div>";
  }
  return (
    '<div class="state-block" role="status" aria-live="polite" aria-busy="true">' +
    '<p class="state-title">正在加载单词列表…</p>' +
    '<div class="skeleton">' + rows + "</div>" +
    "</div>"
  );
}

// 空数据：请求成功但 0 条。和「筛选没命中」是两种不同的空，文案要分开。
function emptyHtml() {
  return (
    '<div class="state-block" role="status">' +
    '<p class="state-title">这个列表还没有单词</p>' +
    '<p class="state-text">请求是成功的，只是返回 0 条（mock 演示）。注意它和「筛选没命中」不是一回事：这里连筛选栏都没有出现，因为没有数据可筛。</p>' +
    '<button type="button" class="state-btn" data-retry>重新加载</button>' +
    "</div>"
  );
}

// 出错：给原因 + 一条出路
function errorHtml() {
  return (
    '<div class="state-block state-error" role="alert">' +
    '<p class="state-title">单词列表加载失败</p>' +
    '<p class="state-text">请求没能完成（mock 演示）。点「重试」会走一遍真实流程：加载中 → 正常。</p>' +
    '<button type="button" class="state-btn" data-retry>重试</button>' +
    "</div>"
  );
}

// 按当前状态渲染单词视图
function renderWordsView(state) {
  const filter = document.getElementById("word-filter");
  const list = document.getElementById("word-list");
  const box = document.getElementById("list-state");
  const note = document.getElementById("state-note");

  // 状态条选中态：当前地址对应哪个状态，看得见
  const chips = document.querySelectorAll(".state-chip");
  for (let i = 0; i < chips.length; i++) {
    const on = chips[i].getAttribute("data-state") === state;
    chips[i].classList.toggle("is-on", on);
    if (on) {
      chips[i].setAttribute("aria-current", "true");
    } else {
      chips[i].removeAttribute("aria-current");
    }
  }

  if (state === "ok") {
    // 正常：筛选栏 + 列表；清掉状态块
    filter.hidden = false;
    list.hidden = false;
    box.hidden = true;
    box.innerHTML = "";
    note.textContent = "正常状态：数据已就绪，下面可以正常筛选。";
    renderWords();
    return;
  }

  // 其余三态：没有数据可筛，筛选栏收起（免得出现「筛一个还没拿到的列表」）
  filter.hidden = true;
  list.hidden = true;
  box.hidden = false;

  if (state === "loading") {
    note.textContent = "加载中：真实请求返回前先亮骨架屏，不白屏、也不跳位置。";
    box.innerHTML = skeletonHtml();
  } else if (state === "empty") {
    note.textContent = "空数据：请求成功但一条都没有 —— 和「筛选没命中」是两种不同的空。";
    box.innerHTML = emptyHtml();
  } else {
    note.textContent = "出错：请求失败，给出原因和一条出路。";
    box.innerHTML = errorHtml();
  }
}

/* ---------- 面包屑与「返回上一页」（今日加练） ---------- */

// 面包屑层级：一层一级，除最后一级外都可点回上一层
function crumbsFor(route) {
  const home = { text: "主页", href: "#/overview" };
  if (route.view === "overview") return [{ text: "主页", current: true }];
  if (route.view === "about") return [home, { text: "关于与下一步", current: true }];

  // 单词列表：带状态时是三级（主页 / 单词列表 / 状态），
  // 中间那级可点 —— 从「出错」点回「单词列表」就回到了正常态
  if (route.state === "ok") return [home, { text: "单词列表", current: true }];
  return [home, { text: "单词列表", href: "#/words" },
    { text: LIST_STATE_TEXT[route.state], current: true }];
}

function renderCrumbs(route) {
  const ol = document.getElementById("crumbs");
  ol.innerHTML = crumbsFor(route).map(function (c) {
    const inner = c.current
      ? '<span aria-current="page">' + c.text + "</span>"
      : '<a href="' + c.href + '">' + c.text + "</a>";
    return "<li>" + inner + "</li>";
  }).join("");
}

// 返回上一页：只有轨迹里确实有上一条时才显示，避免死按钮
function renderBackButton() {
  document.getElementById("nav-back").hidden = !canGoBack();
}

// 路由总入口：地址变了就重画
function renderRoute() {
  const route = parseHash();
  if (!route) return; // 不是 #/ 开头的地址（页内锚点），交给浏览器自己跳，不动视图

  trackHash(location.hash);

  showView(route.view);
  syncNav(route.view);
  renderCrumbs(route);
  renderBackButton();

  // 只要不是停在加载态，就把没跑完的模拟加载取消掉，
  // 否则 1.2 秒后它会把用户从别的状态里拽回正常态（C4 无残留）
  const inLoading = route.view === "words" && route.state === "loading";
  if (!inLoading && simTimer) {
    clearTimeout(simTimer);
    simTimer = null;
  }

  if (route.view === "words") {
    renderWordsView(route.state);
  }
}

// 「模拟真实加载」：走一遍 加载中 →(1.2s)→ 正常 的真实流程
function startSimLoad() {
  if (location.hash !== "#/words/loading") {
    location.hash = "#/words/loading"; // 地址栏同步，中途也能用后退键离开
  } else {
    renderWordsView("loading"); // 已经在加载页：直接重画（重新计时）
  }
  if (simTimer) clearTimeout(simTimer);
  simTimer = setTimeout(function () {
    simTimer = null;
    location.hash = "#/words"; // 落下到正常态
  }, SIM_DELAY);
}

function bootRoute() {
  // 首次打开一点 hash 都没有：给个默认视图，并写进地址栏
  //（用 replace 不额外占一条历史，避免「后退」原地打转）
  if (!location.hash) {
    location.replace(DEFAULT_HASH);
  }
  renderRoute();
}

/* ===================== 三、启动 ===================== */

window.addEventListener("hashchange", renderRoute);

document.getElementById("sim-load").addEventListener("click", startSimLoad);

// 状态块里的按钮是渲染出来的，用事件委托接（重试 / 重新加载都是同一条流程）
document.getElementById("list-state").addEventListener("click", function (e) {
  if (e.target.closest("[data-retry]")) startSimLoad();
});

// 返回上一页：交给浏览器历史，回到上一条时 hashchange 会自己把按钮收起来
document.getElementById("nav-back").addEventListener("click", function () {
  window.history.back();
});

renderStats();
bindFilter();
bootRoute();
