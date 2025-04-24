import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
        on: (channel: string, func: (...args: any[]) => void) => {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        },
        removeAllListeners: (channel: string) => {
            ipcRenderer.removeAllListeners(channel);
        }
    }
}); 