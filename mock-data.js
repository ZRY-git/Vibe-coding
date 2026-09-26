// 本地假数据（mock）· Day 8
// 第 3 周会用真实 API 替换这里的数据，页面渲染代码不用改
const MOCK_STATS = [
  { label: "本周已学单词", value: "9", sub: "目标 12 个" },
  { label: "答对率", value: "86%", sub: "42 / 49 题" },
  { label: "本周累计分", value: "1260", sub: "上周 940" },
  { label: "连续打卡", value: "5 天", sub: "本周已练 3 天" }
];

const MOCK_WORDS = [
  { word: "apple", meaning: "苹果", pack: "日常起步", status: "done" },
  { word: "book", meaning: "书", pack: "日常起步", status: "done" },
  { word: "train", meaning: "火车", pack: "天气出行", status: "doing" },
  { word: "snow", meaning: "雪", pack: "天气出行", status: "doing" },
  { word: "egg", meaning: "鸡蛋", pack: "日常起步", status: "todo" }
];

const STATUS_TEXT = { done: "已掌握", doing: "学习中", todo: "未开始" };
