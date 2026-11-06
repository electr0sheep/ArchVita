import { app, BrowserWindow, net, protocol, session, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIpc } from './ipc'
import { artDir } from './paths'

const devServerUrl = process.env.ELECTRON_RENDERER_URL
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' art: data:"

protocol.registerSchemesAsPrivileged([
  { scheme: 'art', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    title: 'ArchVita',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function serveArt(request: Request): Promise<Response> | Response {
  const url = new URL(request.url)
  const relative = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
  const root = artDir()
  const absolute = join(root, relative)
  if (!absolute.startsWith(root)) return new Response('Forbidden', { status: 403 })
  return net.fetch(pathToFileURL(absolute).toString())
}

function applyCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } })
  })
}

void app.whenReady().then(() => {
  protocol.handle('art', serveArt)
  if (!devServerUrl) applyCsp()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
