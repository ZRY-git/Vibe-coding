// 主页渲染逻辑 · Day 8
// 数据来自 mock-data.js（本地假数据），只负责把数据画到页面上
// Day 12：新增单词列表筛选（状态 + 关键词），筛选只改条件，不改数据

// 当前筛选条件（Day 12）。只存「用户想筛什么」，不存筛选结果，
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
    // 无结果：给明确空状态，而不是白着不动
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

renderStats();
bindFilter();
renderWords();
