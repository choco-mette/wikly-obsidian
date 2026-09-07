export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogMeta {
  requestId?: string
  path?: string
  method?: string
  status?: number
  durationMs?: number
  error?: string | Error | unknown
  [key: string]: unknown
}

interface LogEntry extends Record<string, unknown> {
  timestamp: string
  level: LogLevel
  message: string
}

function formatLog(level: LogLevel, message: string, meta?: LogMeta): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  }

  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (key === 'error') {
        if (value instanceof Error) {
          entry.error = {
            name: value.name,
            message: value.message,
            stack: value.stack,
          }
        } else if (typeof value === 'string') {
          entry.error = value
        } else {
          entry.error = String(value)
        }
      } else {
        entry[key] = value
      }
    }
  }

  return JSON.stringify(entry)
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (process.env.LOG_LEVEL === 'debug') {
      process.stdout.write(`${formatLog('debug', message, meta)}\n`)
    }
  },

  info(message: string, meta?: LogMeta): void {
    process.stdout.write(`${formatLog('info', message, meta)}\n`)
  },

  warn(message: string, meta?: LogMeta): void {
    process.stderr.write(`${formatLog('warn', message, meta)}\n`)
  },

  error(message: string, meta?: LogMeta): void {
    process.stderr.write(`${formatLog('error', message, meta)}\n`)
  },
}
