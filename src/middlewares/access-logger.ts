import { Middleware, RouterMiddleware } from "../deps/oak.ts";
import { log } from "../deps/std.ts";

import { getLogger } from "../utils/logging.ts";

export interface AccessLoggerOptions {
    format?: string;
};

export function accessLogger<
    T extends RouterMiddleware | Middleware = Middleware,
    >(opts?: AccessLoggerOptions): T {
    const logger = getLogger("access-logger");

    //TODO: Add format support
    const middleware: Middleware = async (ctx, next) => {
        let t1 = Date.now();

        await next();
        let dt = Date.now() - t1;
        logger.info(`${ctx.request.method} ${ctx.request.url} => ${ctx.response.status} (${dt} msecs)`);
    };
    return middleware as T;
}
