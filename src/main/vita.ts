import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, enterPassiveModeIPv4, type FileInfo } from 'basic-ftp'

const MAX_ATTEMPTS = 4
export const LONG_CONNECT_ATTEMPTS = 8
const CONNECT_WAIT_MS = 5000
const PAUSE_BETWEEN_FILES_MS = 25
const COMMAND_TIMEOUT_MS = 30000
const PROMOTE_TIMEOUT_MS = 180000
const RETRYABLE = /ECONNRESET|EPIPE|ETIMEDOUT|ECONNABORTED|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|data socket|socket|closed|timeout|size mismatch|\b42[0-9]\b/i

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export const isRetryableFtpError = (error: unknown): boolean => RETRYABLE.test(errorMessage(error))

export type UploadCallback = (name: string, skipped: boolean) => void

export interface UploadTreeOptions {
  skipExisting?: boolean
}

export type PromoteOutcome = { status: 'ok' } | { status: 'unsupported' } | { status: 'failed'; message: string }

export class VitaFtp {
  private client = new Client(COMMAND_TIMEOUT_MS)
  private host = ''
  private port = 1337

  onRetry?: (message: string) => void
  onLog?: (message: string) => void
  checkCancelled?: () => void
  verbose = false

  async connect(host: string, port: number, attempts = 1): Promise<void> {
    this.host = host
    this.port = port
    await this.openWithRetry(attempts)
  }

  private async openWithRetry(attempts: number): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      this.checkCancelled?.()
      try {
        await this.open()
        return
      } catch (error) {
        const reason = `Cannot reach the Vita at ${this.host}:${this.port} (${errorMessage(error)})`
        if (attempt >= attempts) {
          throw new Error(
            `${reason}. Open VitaShell, start its FTP server with the Select button and leave that dialog open; it shows the IP address to use, and the Vita stays awake only while it is open.`
          )
        }
        this.onRetry?.(`${reason}; trying again in ${CONNECT_WAIT_MS / 1000}s (${attempt}/${attempts - 1})`)
        await sleep(CONNECT_WAIT_MS)
      }
    }
  }

  close(): void {
    this.client.close()
  }

  private async open(): Promise<void> {
    this.client.close()
    this.client = new Client(COMMAND_TIMEOUT_MS)
    this.client.ftp.verbose = this.verbose
    if (this.verbose) this.client.ftp.log = (message: string) => this.onLog?.(String(message).trim())
    this.client.availableListCommands = ['LIST']
    this.client.prepareTransfer = enterPassiveModeIPv4
    await this.client.access({ host: this.host, port: this.port, user: 'anonymous', password: 'archvita' })
  }

  private async reconnect(attempt: number): Promise<void> {
    await sleep(1000 * attempt)
    await this.openWithRetry(LONG_CONNECT_ATTEMPTS)
  }

  private async withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn()
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS || !isRetryableFtpError(error)) {
          if (attempt > 1) {
            throw new Error(
              `${label}: ${errorMessage(error)} after ${attempt} attempts. The Vita dropped the connection; run it again and files that already arrived are skipped.`
            )
          }
          throw error
        }
        this.onRetry?.(`${label}: ${errorMessage(error)}; reconnecting and retrying (${attempt}/${MAX_ATTEMPTS - 1})`)
        await this.reconnect(attempt)
      }
    }
  }

  async listRoot(): Promise<string[]> {
    return this.withRetry('/', async () => {
      await this.client.cd('/')
      return (await this.client.list()).map((entry) => entry.name)
    })
  }

  async dirExists(ftpPath: string): Promise<boolean> {
    return this.withRetry(ftpPath, async () => {
      try {
        await this.client.cd(ftpPath)
        return true
      } catch (error) {
        if (isRetryableFtpError(error)) throw error
        return false
      }
    })
  }

  async fileExists(ftpPath: string): Promise<boolean> {
    return this.withRetry(ftpPath, async () => {
      try {
        await this.client.size(ftpPath)
        return true
      } catch (error) {
        if (isRetryableFtpError(error)) throw error
        return false
      }
    })
  }

  async mkdirp(ftpPath: string): Promise<void> {
    await this.withRetry(ftpPath, async () => {
      const parts = ftpPath.split('/').filter(Boolean)
      let current = `/${parts[0]}`
      for (const part of parts.slice(1)) {
        current += `/${part}`
        await this.client.sendIgnoringError(`MKD ${current}`)
      }
    })
  }

  async listDir(ftpPath: string): Promise<FileInfo[]> {
    return this.withRetry(ftpPath, async () => {
      await this.client.cd(ftpPath)
      return this.client.list()
    })
  }

  private async remoteSizes(ftpPath: string): Promise<Map<string, number>> {
    try {
      return new Map((await this.listDir(ftpPath)).filter((entry) => entry.isFile).map((entry) => [entry.name, entry.size]))
    } catch {
      return new Map()
    }
  }

  async uploadFile(localPath: string, ftpPath: string, expectedSize?: number): Promise<void> {
    await this.withRetry(ftpPath, async () => {
      await this.client.uploadFrom(localPath, ftpPath)
      if (expectedSize === undefined) return
      const size = await this.client.size(ftpPath).catch(() => -1)
      if (size >= 0 && size !== expectedSize) throw new Error(`size mismatch after upload (${size} of ${expectedSize} bytes)`)
    })
  }

  async deleteFile(ftpPath: string): Promise<void> {
    await this.withRetry(ftpPath, () => this.client.remove(ftpPath, true))
  }

  // VitaShell's PROM installs a VPK already on the Vita; never retried, a repeat would run alongside the first
  async promote(vitaPath: string): Promise<PromoteOutcome> {
    const context = this.client.ftp as { timeout: number }
    context.timeout = PROMOTE_TIMEOUT_MS
    try {
      const response = await this.client.sendIgnoringError(`PROM ${vitaPath}`)
      if (response.code === 200) return { status: 'ok' }
      if (response.code === 502) return { status: 'unsupported' }
      return { status: 'failed', message: response.message.trim() }
    } finally {
      context.timeout = COMMAND_TIMEOUT_MS
    }
  }

  async uploadTree(localDir: string, ftpDir: string, onFile?: UploadCallback, options: UploadTreeOptions = {}): Promise<void> {
    await this.mkdirp(ftpDir)
    const existing = options.skipExisting ? await this.remoteSizes(ftpDir) : new Map<string, number>()
    for (const entry of await readdir(localDir, { withFileTypes: true })) {
      const local = join(localDir, entry.name)
      const remote = `${ftpDir}/${entry.name}`
      if (entry.isDirectory()) {
        await this.uploadTree(local, remote, onFile, options)
      } else if (entry.isFile()) {
        const { size } = await stat(local)
        if (existing.get(entry.name) === size) {
          onFile?.(entry.name, true)
          continue
        }
        onFile?.(entry.name, false)
        await this.uploadFile(local, remote, size)
        await sleep(PAUSE_BETWEEN_FILES_MS)
      }
    }
  }
}
