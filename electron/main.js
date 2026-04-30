const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");

const isDev = !app.isPackaged;
const SERVER_PORT = process.env.PORT || 3001;
const DEV_CLIENT_URL = process.env.ELECTRON_START_URL || "http://localhost:5173";
const PROD_APP_URL = `http://127.0.0.1:${SERVER_PORT}`;

let mainWindow;

function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Server did not start within ${timeoutMs}ms`));
          return;
        }

        setTimeout(check, 500);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    }

    check();
  });
}

async function startLocalServer() {
  if (isDev) return;

  try {
    // In the packaged app, server.js is copied into app.asar/app resources.
    require(path.join(__dirname, "..", "server.js"));
    await waitForServer(`${PROD_APP_URL}/api`);
  } catch (error) {
    dialog.showErrorBox(
      "Server failed to start",
      error?.message || "The local app server could not be started."
    );
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Int Messager",
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const url = isDev ? DEV_CLIENT_URL : PROD_APP_URL;
  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(async () => {
  await startLocalServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
