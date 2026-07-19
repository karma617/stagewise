import winston from 'winston';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { getLogsDir } from '@/utils/paths';

// Custom format for colorized console output
const colorizeFormat = winston.format.printf(
  ({ level, message, timestamp }) => {
    const prefix = level === 'debug' ? `[DEBUG][${timestamp}] ` : '';

    switch (level) {
      case 'info':
        return chalk.cyan(`${prefix}${message}`);
      case 'warn':
        return chalk.yellow(`${prefix}${message}`);
      case 'error':
        return chalk.red(`${prefix}${message}`);
      case 'debug':
        return chalk.white(`${prefix}${message}`);
      default:
        return `${prefix}${message}`;
    }
  },
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaJson =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${stack ?? message}${metaJson}`;
  }),
);

export class Logger {
  private readonly logger: winston.Logger;

  public constructor(verbose: boolean) {
    const logLevel: 'debug' | 'info' = verbose ? 'debug' : 'info';
    const logsDir = getLogsDir();
    fs.mkdirSync(logsDir, { recursive: true });

    this.logger = winston.createLogger({
      level: logLevel,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            colorizeFormat,
          ),
        }),
        new winston.transports.File({
          filename: path.join(logsDir, 'stagewise-backend.log'),
          level: 'debug',
          maxsize: 5 * 1024 * 1024,
          maxFiles: 5,
          tailable: true,
          format: fileFormat,
        }),
        new winston.transports.File({
          filename: path.join(logsDir, 'stagewise-backend-error.log'),
          level: 'warn',
          maxsize: 5 * 1024 * 1024,
          maxFiles: 3,
          tailable: true,
          format: fileFormat,
        }),
      ],
    });
  }

  get log() {
    return this.logger.log.bind(this.logger);
  }
  get info() {
    return this.logger.info.bind(this.logger);
  }
  get warn() {
    return this.logger.warn.bind(this.logger);
  }
  get error() {
    return this.logger.error.bind(this.logger);
  }
  get debug() {
    return this.logger.debug.bind(this.logger);
  }

  get isDebugEnabled(): boolean {
    return this.logger.isLevelEnabled('debug');
  }

  set verboseMode(verbose: boolean) {
    this.logger.level = verbose ? 'debug' : 'info';
  }
}
