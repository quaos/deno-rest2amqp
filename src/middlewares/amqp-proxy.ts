import { Middleware, RouterMiddleware, Context, Status, RouterContext } from "../deps/oak.ts";
import { log } from "../deps/std.ts";

import { MqConfig } from "../app-config.ts";
import { connect, AmqpChannel, BasicConsumeOk } from "../deps/amqp.ts";
import { RestRequestMessage } from "../models/RestRequestMessage.ts";
import { RestResponseMessage } from "../models/RestResponseMessage.ts";
import { ServiceConfig } from "../models/ServiceConfig.ts";
import { ErrorFormatter } from "./error-handler.ts";
import { getConnectOptions } from "../utils/amqp-helper.ts";
import { getLogger } from "../utils/logging.ts";
import { Timer } from "../utils/timer.ts";
import { merge, setProperty } from "../utils/utils.ts";

export interface AmqpProxyMiddlewareOptions {
    mqConfig: MqConfig;
    serviceConfig: ServiceConfig;
};

export function createAmqpProxy<
    T extends RouterMiddleware | Middleware = Middleware,
    >(opts: AmqpProxyMiddlewareOptions): T {
    const connectOpts = getConnectOptions(opts.mqConfig);
    const vhost = opts.mqConfig.vhost || "";
    const serverUri = `${opts.mqConfig.host}:${opts.mqConfig.port}/${vhost}`;
    const allowedHeaders = opts.serviceConfig.allowedHeaders ?? [];
    const exchange = opts.serviceConfig.exchangeName ?? opts.mqConfig.exchangeName;
    const queue = opts.serviceConfig.queueName ?? opts.mqConfig.queueName;
    const logger = getLogger("amqp-proxy");

    const middleware: RouterMiddleware = async (ctx, next) => {
        // Workaround for Oak setting initial status of responses to 404
        // const expectingNotFound = (ctx.response.status === Status.NotFound);

        const reqPayload: Record<string, string> = {};
        const reqTimer = new Timer();
        try {
            const reqBody = await ctx.request.body().value;
            (reqBody) && merge(reqPayload, reqBody);
            (ctx.params) && merge(reqPayload, ctx.params);
            const queryParams = ctx.request.url.searchParams;
            if (queryParams) {
                for (const [key, val] of queryParams.entries()) {
                    // TODO: Use lodash or some other library?
                    setProperty(reqPayload, key, val);
                }
            }
            const requestUid = generateRequestUid();
            ctx.state.lastRequestUid = requestUid;

            const reqHeaders: Record<string, string> = {};
            ctx.request.headers.forEach((val, key, _parent) => {
                if (allowedHeaders.find((h) => h.toLowerCase() === key)) {
                    reqHeaders[key] = val;
                }
            });

            const reqMessage: RestRequestMessage<typeof reqPayload> = {
                method: opts.serviceConfig.method,
                endpoint: ctx.request.url.pathname,
                requestUid,
                headers: reqHeaders,
                payload: reqPayload,
            };

            const timeout = opts.mqConfig.timeout;
            if (timeout) {
                await reqTimer.start(
                    timeout,
                    () => {
                        const err = new Error(`Request timed out after: ${timeout} msecs`);
                        logger.warning(err.message);
                        sendGatewayError(reqMessage.requestUid, err, ctx, Status.GatewayTimeout);
                        throw err;
                    },
                    () => relayMessageToQueue(ctx, reqMessage, reqTimer),
                );
            } else {
                await relayMessageToQueue(ctx, reqMessage);
            }
        } catch (err) {
            ctx.state.lastError = err;
            if ((!reqTimer.isTimedOut()) && (!ctx.state.errorLogged)) {
                logger.error(err);
                ctx.state.errorLogged = true;
            }
            await next();
        }

        //TEST
        // log.debug("awaits ended; response status:", ctx.response.status);
    };

    const relayMessageToQueue = async (
        ctx: RouterContext,
        reqMessage: RestRequestMessage<any>,
        reqTimer?: Timer,
    ) => {
        const requestUid = reqMessage.requestUid;

        let channel: AmqpChannel | undefined = undefined;
        let replyConsumeResult: BasicConsumeOk | undefined = undefined;
        try {
            logger.info(
                "Sending request to MQ server:", serverUri,
                "; exchange:", exchange,
                "; queue:", queue
            );
            logger.debug("Sending request message:", reqMessage);

            const connection = await connect(connectOpts);
            channel = await connection.openChannel();

            if (exchange) {
                await channel.declareExchange({ exchange });
            }

            const durable = opts.serviceConfig.isDurableQueue ?? true;
            await channel.declareQueue({ queue, durable });

            return await new Promise((resolve, reject) => {
                const onReplyMessage = async (args: any, props: any, data: Uint8Array) => {
                    try {
                        (reqTimer) && reqTimer.stop();

                        logger.debug("Got reply: args:", args, "; props:", props);
                        const dataStr = new TextDecoder().decode(data);
                        logger.debug("Received response data:", dataStr);

                        if (ctx.response.status === Status.NotFound) { // && (expectingNotFound))
                            // Ignore
                        } else if (ctx.response.status >= 300) {
                            logger.warning("Request already ended with status:", ctx.response.status);
                            return resolve(undefined);
                        }
                        if (ctx.state.lastError) {
                            logger.warning("Request already failed with error:", ctx.state.lastError);
                            return resolve(undefined);
                        }
                        const respMessage: RestResponseMessage<any> = JSON.parse(dataStr);

                        ctx.response.status = Status.OK;
                        (respMessage.headers) && Object.entries(respMessage.headers).forEach(([key, val]) => {
                            ctx.response.headers.append(key, val);
                        });

                        ctx.response.body = respMessage;
                        resolve(respMessage);
                    } catch (err) {
                        logger.error(err);
                        reject(err);
                    }
                };

                channel!.consume(
                    {
                        queue: opts.mqConfig.replyToQueue,
                        noAck: true,
                    },
                    onReplyMessage
                )
                    .then((result) => {
                        replyConsumeResult = result;
                        channel!.publish(
                            { exchange, routingKey: queue },
                            {
                                contentType: "application/json",
                                correlationId: requestUid,
                                replyTo: opts.mqConfig.replyToQueue,
                            },
                            new TextEncoder().encode(JSON.stringify(reqMessage)),
                        );
                    })
                    .catch(reject);
            });
        } catch (err) {
            if (!ctx.state.errorLogged) {
                logger.error(err);
                ctx.state.errorLogged = true;
            }
            (reqTimer) && reqTimer.stop();
            sendGatewayError(requestUid, err, ctx);
            if (channel) {
                try {
                    (replyConsumeResult)
                        && channel.cancel({ consumerTag: replyConsumeResult!.consumerTag });
                    await channel.close();
                } catch (err2) {
                    logger.error("Error cleaning up AMQP channel:", err2);
                }
            }
        }
    };

    function sendGatewayError(
        requestUid: string,
        err: Error | string,
        ctx: Context<Record<string, any>>,
        status?: number,
    ) {
        try {
            ctx.response.status = status || Status.BadGateway;
            const errRespBody: RestResponseMessage<any> = {
                requestUid,
                error: (typeof err === "string") ? err : (err.message ?? `${err}`),
            };
            ctx.response.body = errRespBody;
        } catch (err2) {
            logger.error("Failed sending error response:", err2);
        }
    }

    return middleware as T
}

// TODO:
export function createProxyErrorFormatter(): ErrorFormatter {
    return (err: Error) => {
        return <RestResponseMessage<any>>{
            requestUid: "",
            error: err.message,
        }
    }
}

function generateRequestUid(): string {
    const t = new Date().getTime();
    const x = Math.floor(Math.random() * 1000000);

    return `${t}_${x}`
}
