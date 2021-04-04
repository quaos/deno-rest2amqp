import { Middleware, RouterMiddleware } from "../deps/oak.ts";

export interface ErrorHandlerOptions {
    formatter?: ErrorFormatter;
};

export type ErrorFormatter = (err: Error) => any;

export function errorHandler<
    T extends RouterMiddleware | Middleware = Middleware,
>(opts?: ErrorHandlerOptions): T {
    const middleware: Middleware = async (ctx, next) => {
        await next();
        if (ctx.state.lastError) {
            // TEST
            console.log("in errorHandler:", opts);

            if (ctx.response.status >= 500) {
                console.error(ctx.state.lastError);
            }
            ctx.response.body = (opts?.formatter)
                ? opts?.formatter(ctx.state.lastError)
                : ctx.state.lastError.message;
        }
    };
    return middleware as T;
}
