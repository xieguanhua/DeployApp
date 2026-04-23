const { app, BrowserWindow, ipcMain } = require("electron");
const { readFile, writeFile, access } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, ".env.example");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

let mainWindow = null;

function getDeviceId() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()?.[0]?.model || "cpu",
    os.totalmem().toString()
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function parseEnvExample(content) {
  const lines = content.split(/\r?\n/);
  const fields = [];
  let currentLevel = "optional";
  let commentBuffer = [];

  function flushComment() {
    commentBuffer = [];
  }

  function buildFieldNotes(comments) {
    const filtered = comments
      .map((item) => item.trim())
      .filter((item) => item && !item.startsWith("====") && !item.startsWith("-----"));
    const links = [];
    const notes = [];
    for (const item of filtered) {
      const match = item.match(/https?:\/\/\S+/g);
      if (match) {
        for (const link of match) links.push(link);
      }
      notes.push(item);
    }
    return {
      description: notes.join("\n"),
      links
    };
  }

  for (const line of lines) {
    const trim = line.trim();
    if (!trim) {
      if (commentBuffer.length > 6) commentBuffer = commentBuffer.slice(-6);
      continue;
    }
    if (trim.includes("[REQUIRED]")) currentLevel = "required";
    else if (trim.includes("[RECOMMENDED]")) currentLevel = "recommended";
    else if (trim.includes("[OPTIONAL]")) currentLevel = "optional";

    if (trim.startsWith("#")) {
      commentBuffer.push(trim.replace(/^#\s?/, ""));
      if (commentBuffer.length > 8) commentBuffer = commentBuffer.slice(-8);
      continue;
    }
    if (!trim.includes("=")) continue;
    if (trim.startsWith("export ")) continue;

    const idx = trim.indexOf("=");
    const key = trim.slice(0, idx).trim();
    const value = trim.slice(idx + 1).trim();
    if (!key) continue;

    const noteInfo = buildFieldNotes(commentBuffer);
    fields.push({
      key,
      defaultValue: value,
      level: currentLevel,
      description: noteInfo.description,
      links: noteInfo.links
    });
    flushComment();
  }
  return fields;
}

function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trim = line.trim();
    if (!trim || trim.startsWith("#") || !trim.includes("=")) continue;
    const idx = trim.indexOf("=");
    const key = trim.slice(0, idx).trim();
    const value = trim.slice(idx + 1);
    if (key) result[key] = value;
  }
  return result;
}

ipcMain.handle("client:getBootstrapState", async () => {
  const deviceId = getDeviceId();

  const envExampleRaw = await readFile(ENV_EXAMPLE_PATH, "utf8");
  const fields = parseEnvExample(envExampleRaw);

  let envValues = {};
  try {
    const envRaw = await readFile(ENV_PATH, "utf8");
    envValues = parseEnvFile(envRaw);
  } catch (_) {
    envValues = {};
  }

  return {
    deviceId,
    fields,
    envValues
  };
});

ipcMain.handle("client:saveEnvConfig", async (_, envObject) => {
  const keys = Object.keys(envObject || {}).sort();
  const lines = [];
  for (const key of keys) {
    const value = String(envObject[key] ?? "");
    lines.push(`${key}=${value}`);
  }
  await writeFile(ENV_PATH, `${lines.join("\n")}\n`, "utf8");
  return { ok: true, path: ENV_PATH };
});

ipcMain.handle("client:checkEnvExists", async () => {
  try {
    await access(ENV_PATH);
    return { exists: true };
  } catch (_) {
    return { exists: false };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
