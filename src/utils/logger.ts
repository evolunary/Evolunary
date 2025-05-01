/**
 * Evolunary Logging Utility
 * Provides structured, color-coded output across log levels
 * @module utils/logger
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private readonly colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
  };

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return this.colors.red;
      case LogLevel.WARN:  return this.colors.yellow;
      case LogLevel.INFO:  return this.colors.green;
      case LogLevel.DEBUG: return this.colors.cyan;
      default:             return this.colors.reset;
    }
  }

  private log(level: LogLevel, message: string, context?: any): void {
    const timestamp = this.getTimestamp();
    const color = this.getColor(level);
    let logLine = `${color}[${timestamp}] [${level}] ${message}${this.colors.reset}`;

    if (context) {
      logLine += '\n' + JSON.stringify(context, null, 2);
    }

    console.log(logLine);
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: any): void {
    const errorDetails = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context
    } : context;

    this.log(LogLevel.ERROR, message, errorDetails);
  }
}
