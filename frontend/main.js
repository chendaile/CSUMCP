const apiStatusEl = document.getElementById("apiStatus");
const mcpStatusEl = document.getElementById("mcpStatus");
const routeListEl = document.getElementById("routeList");
const checkDayEl = document.getElementById("checkDay");

const formatStatus = (ok, text) => {
  return `<span class="${ok ? "ok" : "fail"}">${text}</span>`;
};

const renderRoutes = (routes = []) => {
  routeListEl.innerHTML = "";
  routes.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    routeListEl.appendChild(li);
  });
};

const fetchApiRoot = async () => {
  try {
    const resp = await fetch("/api/meta");
    const data = await resp.json();
    apiStatusEl.innerHTML = formatStatus(true, "在线");
    if (Array.isArray(data.routes)) {
      renderRoutes(data.routes);
    }
    if (data?.service) {
      checkDayEl.textContent = `服务标识：${data.service}`;
    }
  } catch (e) {
    apiStatusEl.innerHTML = formatStatus(false, "不可用");
    routeListEl.innerHTML = `<li>无法获取路由 (${e})</li>`;
  }
};

const detectMcp = async () => {
  // MCP 无 HTTP 入口，这里仅提示同源 SSE 需由反代提供。
  mcpStatusEl.innerHTML = formatStatus(true, "通过 Nginx /mcp/ 反代访问");
};

fetchApiRoot();
detectMcp();
