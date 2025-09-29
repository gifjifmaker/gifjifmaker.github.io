const { app, BrowserWindow, screen, globalShortcut, Menu } = require('electron');
const path = require('path');

// require('electron-reload')(__dirname, {
//   electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
//   // Optional: watch only certain directories
//   // hardResetMethod: 'exit'
// });


function createWindow() {
  // Get the primary display's size
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Determine the correct icon based on the platform
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, 'icons', 'gifjifmaker-icon.icns')
    : path.join(__dirname, 'icons', 'gifjifmaker-icon.png');

  // Create the browser window with full screen dimensions and the appropriate icon
  const mainWindow = new BrowserWindow({
    width: 2080,
    height: height,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('src/index.html');


  // Create a custom menu that does not include DevTools options
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
        {
    label: 'Developer',
      submenu: [
        {
          label: 'Toggle DevTools',
          // accelerator: 'CmdOrCtrl+Shift+I',
            click: () => {
              mainWindow.webContents.toggleDevTools();
            }
          }
        ]
      }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
