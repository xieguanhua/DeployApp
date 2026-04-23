const configPanel = document.getElementById("configPanel");
const deviceIdInput = document.getElementById("deviceIdInput");
const envGrid = document.getElementById("envGrid");
const saveEnvBtn = document.getElementById("saveEnvBtn");
const envStatus = document.getElementById("envStatus");

let envFields = [];
let envValues = {};

function setAlert(el, text, type = "muted") {
  el.className = `alert ${type}`;
  el.textContent = text;
}

function levelBadge(level) {
  const safe = ["required", "recommended", "optional"].includes(level) ? level : "optional";
  return `<span class="badge ${safe}">${safe}</span>`;
}

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLinks(links) {
  if (!Array.isArray(links) || links.length === 0) return "";
  const items = links
    .slice(0, 4)
    .map((link) => `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">${escapeHtml(link)}</a>`)
    .join("");
  return `<div class="links">${items}</div>`;
}

function renderFields() {
  envGrid.innerHTML = "";
  for (const field of envFields) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const desc = field.description ? `<p class="desc">${escapeHtml(field.description)}</p>` : "";
    const links = renderLinks(field.links);
    wrapper.innerHTML = `
      <label>${field.key} ${levelBadge(field.level)}</label>
      ${desc}
      ${links}
      <textarea rows="2" data-key="${field.key}" placeholder="请输入 ${field.key}">${envValues[field.key] ?? field.defaultValue ?? ""}</textarea>
    `;
    envGrid.appendChild(wrapper);
  }
}

async function bootstrap() {
  const state = await window.tradingClient.getBootstrapState();
  envFields = state.fields;
  envValues = state.envValues || {};
  deviceIdInput.value = state.deviceId || "";
  renderFields();
  configPanel.classList.remove("hidden");
}

saveEnvBtn.addEventListener("click", async () => {
  const values = {};
  const textareas = envGrid.querySelectorAll("textarea[data-key]");
  textareas.forEach((textarea) => {
    values[textarea.getAttribute("data-key")] = textarea.value.trim();
  });

  saveEnvBtn.disabled = true;
  setAlert(envStatus, "正在写入 .env ...", "muted");
  try {
    await window.tradingClient.saveEnvConfig(values);
    setAlert(envStatus, ".env 保存成功。", "ok");
  } catch (error) {
    setAlert(envStatus, `保存失败：${error.message || error}`, "err");
  } finally {
    saveEnvBtn.disabled = false;
  }
});

bootstrap().catch((error) => {
  setAlert(envStatus, `初始化失败：${error.message || error}`, "err");
});
