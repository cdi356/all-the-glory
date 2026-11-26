// The only native things the game can ask for: LAN hosting, finding a host by code, fullscreen and quitting.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('atgNative', {
  host: code => ipcRenderer.invoke('lan-host', code),
  stop: () => ipcRenderer.invoke('lan-stop'),
  find: code => ipcRenderer.invoke('lan-find', code),
  fullscreen: on => ipcRenderer.invoke('fullscreen', on),
  quit: () => ipcRenderer.invoke('quit'),
});
