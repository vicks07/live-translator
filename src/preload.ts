import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => {
            return ipcRenderer.invoke(channel, ...args);
        },
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
            ipcRenderer.on(channel, listener);
        },
        removeAllListeners: (channel: string) => {
            ipcRenderer.removeAllListeners(channel);
        }
    }
}); 