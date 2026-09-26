// 主页渲染逻辑 · Day 8
// 数据来自 mock-data.js（本地假数据），只负责把数据画到页面上

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

function renderWords() {
  const list = document.getElementById("word-list");
  list.innerHTML = MOCK_WORDS.map(function (w) {
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

renderStats();
renderWords();
