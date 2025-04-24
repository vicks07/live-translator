import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { audioService } from './services/audioService';

export let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

// Set up IPC handlers
function setupIpcHandlers() {
    ipcMain.handle('start-audio-capture', async () => {
        try {
            return await audioService.startCapture();
        } catch (error: any) {
            console.error('Error starting audio capture:', error);
            throw error;
        }
    });

    ipcMain.handle('stop-audio-capture', async () => {
        try {
            audioService.stopCapture();
            return { success: true };
        } catch (error: any) {
            console.error('Error stopping audio capture:', error);
            throw error;
        }
    });

    ipcMain.handle('play-captured-audio', async () => {
        try {
            return await audioService.playCapturedAudio();
        } catch (error: any) {
            console.error('Error playing captured audio:', error);
            throw error;
        }
    });
}

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
        mainWindow.loadURL('http://localhost:3000').then(() => {
            mainWindow?.webContents.openDevTools();
        }).catch(console.error);
    } else {
        mainWindow.loadFile(path.join(__dirname, 'index.html'))
            .then(() => {
                mainWindow?.webContents.openDevTools();
            })
            .catch(console.error);
    }

    // Wait for window to be ready
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window is ready');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialize app
app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();
});

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