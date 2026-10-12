// health —— Day 15 健康检查：证明后端公网可达
// 说明：HTTP 网关转发到函数内部的路径与外部 URL 不一致（实测外部 /api/health 进来后
// req.url 不是 /api/health），因此这里对任意路径都返回 200 的健康信息，
// 并把网关实际转来的 req.url 回显在 path 字段里便于确认。
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify({
    ok: true,
    service: 'english-rpg',
    path: req.url,
    env: process.env.TCB_ENV || '',
    time: new Date().toISOString()
  }));
});

server.listen(process.env.PORT || 9000);
