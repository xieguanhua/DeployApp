const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tradingClient", {
  getBootstrapState: () => ipcRenderer.invoke("client:getBootstrapState"),
  saveEnvConfig: (config) => ipcRenderer.invoke("client:saveEnvConfig", config),
  checkEnvExists: () => ipcRenderer.invoke("client:checkEnvExists")
});
