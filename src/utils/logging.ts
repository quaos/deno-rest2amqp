import { datetime, log } from "../deps/std.ts";

export interface LoggingConfigFactoryOptions {
    level?: string;
    datetimeFormat?: string;
};

export class LoggingConfigFactory {
    static DEFAULT_LEVEL = "INFO";
    static DEFAULT_DATETIME_FORMAT = "yyyy-MM-dd HH:mm:ss.SSS";

    public static get(opts?: LoggingConfigFactoryOptions): log.LogConfig {
        const level = <log.LevelName>(opts?.level ?? LoggingConfigFactory.DEFAULT_LEVEL);
        const dtFormat = opts?.datetimeFormat ?? LoggingConfigFactory.DEFAULT_DATETIME_FORMAT;

        return {
            handlers: {
                default: new log.handlers.ConsoleHandler(level, {
                    formatter: (logRecord) => {
                        const msgParts = [
                            datetime.format(logRecord.datetime, dtFormat),
                            `[${logRecord.levelName}][${logRecord.loggerName}]`,
                            logRecord.msg,
                        ];

                        logRecord.args.forEach((arg: any, _idx: number) => {
                            msgParts.push((typeof arg === "object") ? Deno.inspect(arg) : `${arg}`);
                        });

                        return msgParts.join(" ");
                    }
                }),
            },
            loggers: {
                default: {
                    level: level,
                    handlers: ["default"],
                },
            }
        }
    }
}

export function getLogger(name: string) {
    const logger = log.getLogger(name);
    if (logger.levelName === "NOTSET") {
        const defaultLogger = log.getLogger("default");
        logger.levelName = defaultLogger.levelName;
        logger.level = defaultLogger.level;
        logger.handlers = defaultLogger.handlers;
    }

    return logger
}
