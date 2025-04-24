import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { audioService } from './services/audioService';

export let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
    });

    // Load the index.html file
    if (isDev) {
        // Wait for dev server to be ready
        setTimeout(() => {
            mainWindow?.loadURL('http://localhost:3000');
            mainWindow?.webContents.openDevTools();
        }, 2000);
    } else {
        mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
}); 