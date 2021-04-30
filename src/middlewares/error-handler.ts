import { Middleware, RouterMiddleware } from "../deps/oak.ts";
import { log } from "../deps/std.ts";

import { getLogger } from "../utils/logging.ts";

export interface ErrorHandlerOptions {
    formatter?: ErrorFormatter;
    loggerPrefix?: string;
};

export type ErrorFormatter = (err: Error) => any;

export function errorHandler<
    T extends RouterMiddleware | Middleware = Middleware,
    >(opts?: ErrorHandlerOptions): T {
    const loggerName = (opts?.loggerPrefix)
        ? `${opts.loggerPrefix}-error-handler`
        : "error-handler";
    const logger = getLogger(loggerName);

    const middleware: Middleware = async (ctx, next) => {
        await next();
        if (ctx.state.lastError) {
            // TEST
            // logger.debug("in errorHandler:", opts);

            if ((ctx.response.status >= 500) && (!ctx.state.errorLogged)) {
                logger.error(ctx.state.lastError);
                ctx.state.errorLogged = true;
            }
            ctx.response.body = (opts?.formatter)
                ? opts?.formatter(ctx.state.lastError)
                : ctx.state.lastError.message;
        }
    };
    return middleware as T;
}
