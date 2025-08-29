/**
 * Enhanced logging system for MadPlan frontend application
 * Provides structured logging with different levels and contexts
 */

// Log levels enum
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// Log context types
export interface LogContext {
  userId?: string
  sessionId?: string
  component?: string
  action?: string
  route?: string
  timestamp?: Date
  [key: string]: any
}

// Performance timing interface
export interface PerformanceTiming {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel
  enableConsoleOutput: boolean
  enablePerformanceLogging: boolean
  enableNetworkLogging: boolean
  enableErrorReporting: boolean
  maxLogHistory: number
  sensitiveKeys: string[]
}

// Log entry interface
export interface LogEntry {
  id: string
  level: LogLevel
  message: string
  context: LogContext
  timestamp: Date
  stack?: string
  performanceData?: PerformanceTiming
  networkData?: any
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN,
  enableConsoleOutput: import.meta.env.DEV,
  enablePerformanceLogging: import.meta.env.DEV,
  enableNetworkLogging: import.meta.env.DEV,
  enableErrorReporting: !import.meta.env.DEV,
  maxLogHistory: 1000,
  sensitiveKeys: ['password', 'token', 'key', 'secret', 'authorization']
}

class Logger {
  private config: LoggerConfig
  private logHistory: LogEntry[] = []
  private performanceMarks = new Map<string, PerformanceTiming>()
  private sessionId: string
  private globalContext: LogContext = {}

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.sessionId = this.generateSessionId()
    this.globalContext.sessionId = this.sessionId
    
    this.initializeLogger()
  }

  private initializeLogger() {
    // Set up global error handling
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('Global Error Handler', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        })
      })

      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled Promise Rejection', {
          reason: event.reason,
          stack: event.reason?.stack
        })
      })

      // Performance observer for navigation timing
      if (this.config.enablePerformanceLogging && 'PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.logPerformanceEntry(entry)
            }
          })
          
          observer.observe({ entryTypes: ['navigation', 'measure', 'mark'] })
        } catch (error) {
          console.warn('Performance observer not supported:', error)
        }
      }
    }

    this.info('Logger initialized', {
      config: this.sanitizeData(this.config),
      sessionId: this.sessionId,
      timestamp: new Date()
    })
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level
  }

  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return data
    
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item))
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(data)) {
        if (this.config.sensitiveKeys.some(sensitiveKey => 
          key.toLowerCase().includes(sensitiveKey.toLowerCase())
        )) {
          sanitized[key] = '[REDACTED]'
        } else {
          sanitized[key] = this.sanitizeData(value)
        }
      }
      return sanitized
    }
    
    return data
  }

  private formatMessage(level: LogLevel, message: string, context: LogContext): string {
    const levelStr = LogLevel[level].padEnd(5)
    const timestamp = new Date().toISOString()
    const component = context.component ? `[${context.component}]` : ''
    const action = context.action ? `{${context.action}}` : ''
    
    return `[${timestamp}] ${levelStr} ${component}${action} ${message}`
  }

  private outputToConsole(entry: LogEntry) {
    if (!this.config.enableConsoleOutput) return

    const formattedMessage = this.formatMessage(entry.level, entry.message, entry.context)
    
    const consoleContext = {
      ...entry.context,
      logId: entry.id
    }

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, consoleContext)
        if (entry.stack) console.error('Stack:', entry.stack)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage, consoleContext)
        break
      case LogLevel.INFO:
        console.info(formattedMessage, consoleContext)
        break
      case LogLevel.DEBUG:
        console.debug(formattedMessage, consoleContext)
        break
      case LogLevel.TRACE:
        console.trace(formattedMessage, consoleContext)
        break
    }
  }

  private addToHistory(entry: LogEntry) {
    this.logHistory.push(entry)
    
    // Maintain history size limit
    if (this.logHistory.length > this.config.maxLogHistory) {
      this.logHistory.shift()
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    includeStack = false
  ): LogEntry {
    const entry: LogEntry = {
      id: this.generateLogId(),
      level,
      message,
      context: { ...this.globalContext, ...context },
      timestamp: new Date()
    }

    if (includeStack) {
      const error = new Error()
      if ((Error as any).captureStackTrace) {
        (Error as any).captureStackTrace(error, this.createLogEntry)
      }
      entry.stack = error.stack
    }

    return entry
  }

  private log(level: LogLevel, message: string, context: LogContext = {}, includeStack = false) {
    if (!this.shouldLog(level)) return

    const sanitizedContext = this.sanitizeData(context)
    const entry = this.createLogEntry(level, message, sanitizedContext, includeStack)

    this.outputToConsole(entry)
    this.addToHistory(entry)

    // Report to external service if configured
    if (this.config.enableErrorReporting && level <= LogLevel.WARN) {
      this.reportError(entry)
    }
  }

  private logPerformanceEntry(entry: PerformanceEntry) {
    this.debug('Performance Entry', {
      name: entry.name,
      type: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration
    })
  }

  private reportError(entry: LogEntry) {
    // In a real application, you would send this to an error reporting service
    // like Sentry, LogRocket, or your own analytics service
    
    if (import.meta.env.DEV) {
      console.log('📊 Error would be reported:', {
        id: entry.id,
        level: LogLevel[entry.level],
        message: entry.message,
        context: entry.context,
        timestamp: entry.timestamp
      })
    }
    
    // Example integration:
    // errorReportingService.captureException(entry)
  }

  // Public logging methods
  public error(message: string, context: LogContext = {}) {
    this.log(LogLevel.ERROR, message, context, true)
  }

  public warn(message: string, context: LogContext = {}) {
    this.log(LogLevel.WARN, message, context)
  }

  public info(message: string, context: LogContext = {}) {
    this.log(LogLevel.INFO, message, context)
  }

  public debug(message: string, context: LogContext = {}) {
    this.log(LogLevel.DEBUG, message, context)
  }

  public trace(message: string, context: LogContext = {}) {
    this.log(LogLevel.TRACE, message, context, true)
  }

  // Specialized logging methods
  public auth(action: string, context: LogContext = {}) {
    this.info(`Auth: ${action}`, { ...context, category: 'authentication' })
  }

  public api(method: string, url: string, status?: number, duration?: number, context: LogContext = {}) {
    const level = status && status >= 400 ? LogLevel.WARN : LogLevel.INFO
    this.log(level, `API: ${method.toUpperCase()} ${url}`, {
      ...context,
      category: 'api',
      method,
      url,
      status,
      duration
    })
  }

  public route(from: string, to: string, context: LogContext = {}) {
    this.info(`Route: ${from} → ${to}`, { ...context, category: 'navigation', from, to })
  }

  public component(name: string, action: string, context: LogContext = {}) {
    this.debug(`Component: ${name} - ${action}`, { 
      ...context, 
      category: 'component', 
      component: name, 
      action 
    })
  }

  public user(action: string, context: LogContext = {}) {
    this.info(`User: ${action}`, { ...context, category: 'user' })
  }

  // Performance logging methods
  public startPerformanceMark(name: string, metadata?: Record<string, any>) {
    if (!this.config.enablePerformanceLogging) return

    const timing: PerformanceTiming = {
      name,
      startTime: performance.now(),
      metadata
    }

    this.performanceMarks.set(name, timing)
    
    if (typeof performance.mark === 'function') {
      performance.mark(`${name}-start`)
    }

    this.trace(`Performance mark started: ${name}`, { category: 'performance', timing })
  }

  public endPerformanceMark(name: string, additionalMetadata?: Record<string, any>) {
    if (!this.config.enablePerformanceLogging) return

    const timing = this.performanceMarks.get(name)
    if (!timing) {
      this.warn(`Performance mark not found: ${name}`)
      return
    }

    timing.endTime = performance.now()
    timing.duration = timing.endTime - timing.startTime

    if (additionalMetadata) {
      timing.metadata = { ...timing.metadata, ...additionalMetadata }
    }

    if (typeof performance.mark === 'function' && typeof performance.measure === 'function') {
      performance.mark(`${name}-end`)
      performance.measure(name, `${name}-start`, `${name}-end`)
    }

    this.info(`Performance: ${name} completed in ${timing.duration.toFixed(2)}ms`, {
      category: 'performance',
      timing
    })

    this.performanceMarks.delete(name)
  }

  // Utility methods
  public setGlobalContext(context: LogContext) {
    this.globalContext = { ...this.globalContext, ...context }
  }

  public getLogHistory(): LogEntry[] {
    return [...this.logHistory]
  }

  public clearLogHistory() {
    this.logHistory = []
  }

  public exportLogs(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      exportedAt: new Date(),
      config: this.sanitizeData(this.config),
      logs: this.logHistory
    }, null, 2)
  }

  public getSessionId(): string {
    return this.sessionId
  }

  public updateConfig(newConfig: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...newConfig }
    this.info('Logger configuration updated', { config: this.sanitizeData(this.config) })
  }

  // Group logging for related operations
  public group(name: string, callback: () => void | Promise<void>) {
    if (!this.config.enableConsoleOutput) {
      return callback()
    }

    console.group(name)
    const startTime = performance.now()
    
    try {
      const result = callback()
      
      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - startTime
          console.log(`Group duration: ${duration.toFixed(2)}ms`)
          console.groupEnd()
        })
      } else {
        const duration = performance.now() - startTime
        console.log(`Group duration: ${duration.toFixed(2)}ms`)
        console.groupEnd()
        return result
      }
    } catch (error) {
      console.groupEnd()
      throw error
    }
  }
}

// Create and export default logger instance
const logger = new Logger()

// Export the logger and related types
export default logger
export { Logger }

// Convenience functions for quick logging
export const log = {
  error: (message: string, context?: LogContext) => logger.error(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  trace: (message: string, context?: LogContext) => logger.trace(message, context),
  
  auth: (action: string, context?: LogContext) => logger.auth(action, context),
  api: (method: string, url: string, status?: number, duration?: number, context?: LogContext) => 
    logger.api(method, url, status, duration, context),
  route: (from: string, to: string, context?: LogContext) => logger.route(from, to, context),
  component: (name: string, action: string, context?: LogContext) => logger.component(name, action, context),
  user: (action: string, context?: LogContext) => logger.user(action, context),
  
  startTimer: (name: string, metadata?: Record<string, any>) => logger.startPerformanceMark(name, metadata),
  endTimer: (name: string, metadata?: Record<string, any>) => logger.endPerformanceMark(name, metadata),
  
  group: (name: string, callback: () => void | Promise<void>) => logger.group(name, callback)
}