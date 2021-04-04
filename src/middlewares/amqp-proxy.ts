import { Middleware, RouterMiddleware, Context, Status, RouterContext } from "../deps/oak.ts";

import { MqConfig } from "../app-config.ts";
import { connect, AmqpChannel, BasicConsumeOk } from "../deps/amqp.ts";
import { RestRequestMessage } from "../models/RestRequestMessage.ts";
import { RestResponseMessage } from "../models/RestResponseMessage.ts";
import { ServiceConfig } from "../models/ServiceConfig.ts";
import { ErrorFormatter } from "./error-handler.ts";
import { getConnectOptions } from "../utils/amqp-helper.ts";
import { merge } from "../utils/utils.ts";

export interface AmqpProxyMiddlewareOptions {
    mqConfig: MqConfig;
    serviceConfig: ServiceConfig;
};

export function createAmqpProxy<
    T extends RouterMiddleware | Middleware = Middleware,
>(opts: AmqpProxyMiddlewareOptions): T {
    const connectOpts = getConnectOptions(opts.mqConfig);
    const serverUri = `${opts.mqConfig.host}:${opts.mqConfig.port}/${opts.mqConfig.vhost}`;
    const exchange = opts.serviceConfig.exchangeName ?? opts.mqConfig.exchangeName;
    const queue = opts.serviceConfig.queueName ?? opts.mqConfig.queueName;

    const middleware: RouterMiddleware = async (ctx, next) => {
        // Workaround for Oak setting initial status of responses to 404
        // const expectingNotFound = (ctx.response.status === Status.NotFound);
        
        const params: Record<string, string> = {};
        const reqBody = await ctx.request.body().value as any;
        (reqBody) && merge(params, reqBody);
        (ctx.params) && merge(params, ctx.params);
        const requestUid = generateRequestUid();
        ctx.state.lastRequestUid = requestUid;

        const reqMessage: RestRequestMessage<typeof params> = {
            method: opts.serviceConfig.method,
            endpoint: ctx.request.url.pathname,
            requestUid,
            params,
        };

        await relayMessageToQueue(ctx, reqMessage);

        //TEST
        console.log("awaits ended; response status:", ctx.response.status);
    };

    const relayMessageToQueue = async (
        ctx: RouterContext,
        reqMessage: RestRequestMessage<any>,
    ) => {
        const requestUid = reqMessage.requestUid;

        let channel: AmqpChannel | undefined = undefined;
        let reqTimerId: number | undefined = undefined;
        let replyConsumeResult: BasicConsumeOk | undefined = undefined;
        try {
            console.log(
                "Sending request to MQ server:", serverUri,
                "; exchange:", exchange,
                "; queue: ", queue,
                "; message:", reqMessage
            );

            const connection = await connect(connectOpts);
            channel = await connection.openChannel();

            if (exchange) {
                await channel.declareExchange({ exchange });
            }

            await channel.declareQueue({ queue });
            
            const timeout = opts.mqConfig.timeout;
            reqTimerId = (timeout)
                ? setTimeout(() => {
                    const err = new Error(`Request timed out after: ${timeout} msecs`);
                    sendGatewayError(reqMessage.requestUid, err, ctx, Status.GatewayTimeout);
                }, timeout)
                : undefined;

            return await new Promise((resolve, reject) => {
                const onReplyMessage = async (args: any, props: any, data: Uint8Array) => {
                    try {
                        (reqTimerId) && clearTimeout(reqTimerId);
                        reqTimerId = undefined;

                        console.log("Got reply: args:", args, "; props:", props);
                        const dataStr = new TextDecoder().decode(data);
                        console.log("Received response data:", dataStr);

                        if (ctx.response.status === Status.NotFound) { // && (expectingNotFound))
                            // Ignore
                        } else if (ctx.response.status >= 300) {
                            console.warn("Request already ended with status:", ctx.response.status);
                            return resolve(undefined);
                        }
                        if (ctx.state.lastError) {
                            console.warn("Request already failed with error:", ctx.state.lastError);
                            return resolve(undefined);
                        }
                        const respMessage: RestResponseMessage<any> = JSON.parse(dataStr);

                        ctx.response.status = Status.OK;
                        ctx.response.body = respMessage;
                        resolve(respMessage);
                    } catch (err) {
                        console.error(err);
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
            console.error(err);
            (reqTimerId) && clearTimeout(reqTimerId);
            reqTimerId = undefined;
            sendGatewayError(requestUid, err, ctx);
            if (channel) {
                try {
                    (replyConsumeResult)
                        && channel.cancel({ consumerTag: replyConsumeResult!.consumerTag });
                    await channel.close();
                } catch (err2) {
                    console.error("Error cleaning up AMQP channel:", err2);
                }
            }
        }
    };
    
    return middleware as T
}

// TODO:
export function createProxyErrorFormatter(): ErrorFormatter {
    return (err: Error) => {
        return <RestResponseMessage<any>> {
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
    } catch (err) {
        console.error("Failed sending error response:", err);
    }
}
