import { BrowserWindow } from 'electron'
import type { Progress, ProgressLevel } from '@shared/types'

export interface JobContext {
  report(current: number, total: number, message: string, level?: ProgressLevel): void
  checkCancelled(): void
}

export class JobCancelled extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'JobCancelled'
  }
}

let activeJob: { name: string; cancelled: boolean } | null = null

function emit(progress: Progress): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('archvita:progress', progress)
}

export async function runJob<T>(name: string, fn: (ctx: JobContext) => Promise<T>): Promise<T> {
  if (activeJob) throw new Error(`Wait for the current job to finish (${activeJob.name}).`)
  const job = { name, cancelled: false }
  activeJob = job
  const ctx: JobContext = {
    report: (current, total, message, level = 'info') => emit({ job: name, current, total, message, level }),
    checkCancelled: () => {
      if (job.cancelled) throw new JobCancelled()
    }
  }
  try {
    const result = await fn(ctx)
    emit({ job: name, current: 1, total: 1, message: `${name} finished`, level: 'done' })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emit({ job: name, current: 0, total: 0, message, level: 'error' })
    throw error
  } finally {
    activeJob = null
  }
}

export function cancelJob(): void {
  if (activeJob) activeJob.cancelled = true
}
