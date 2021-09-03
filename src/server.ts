import {
    Application as OakApplication,
    Context,
    Middleware,
    Router,
    RouterContext,
    RouterMiddleware,
    Status,
} from "./deps/oak.ts";
import { oakCors } from "./deps/cors.ts";
import { log } from "./deps/std.ts";

import { AppConfig } from "./app-config.ts";
import { AppState } from "./AppState.ts";
import { accessLogger } from "./middlewares/access-logger.ts";
import { errorHandler } from "./middlewares/error-handler.ts";
import { createAmqpProxy } from "./middlewares/amqp-proxy.ts";
import { ServiceConfig } from "./models/ServiceConfig.ts";
import { HttpMethod } from "./models/HttpMethod.ts";
import { getLogger } from "./utils/logging.ts";

export class Server {
    appConfig: AppConfig;
    logger: log.Logger;

    public constructor(appConfig: AppConfig) {
        this.appConfig = appConfig;
        this.logger = getLogger("server");
    }

    public async start(): Promise<number> {
        if (this.appConfig.banner) {
            this.appConfig.banner.split("\n").forEach((line) => console.info(line));
        }
        this.logger.info(`Starting server on host: ${this.appConfig.host}; port: ${this.appConfig.port}`);
        // this.logger.debug("App Config:", this.appConfig);

        let rc;
        try {
            const services = await this.loadServicesConfig();

            const oakApp = await this.buildOakApp(services);
            await oakApp.listen({
                hostname: this.appConfig.host,
                port: this.appConfig.port
            });
            rc = 0;
        } catch (err) {
            console.error(err);
            rc = -1;
        }
        this.logger.warning("Server stopped.");

        return rc;
    }

    async loadServicesConfig(): Promise<ServiceConfig[]> {
        this.logger.debug("Loading Services Config from:", this.appConfig.servicesFile);
        const servicesStr = await Deno.readTextFile(this.appConfig.servicesFile);
        const servicesConf = JSON.parse(servicesStr) || [];

        if (this.appConfig.extServicesDir) {
            this.logger.debug("Searching Ext. Services Config files in path:", this.appConfig.extServicesDir);
            for await (const dirEntry of Deno.readDir(this.appConfig.extServicesDir)) {
                if (!dirEntry.isFile) {
                    continue;
                }
                if (!(/^(.+?)\.json$/i.test(dirEntry.name))) {
                    continue;
                }
                this.logger.debug("Loading Ext. Services Config from:", dirEntry.name);
                const extServicesStr = await Deno.readTextFile(dirEntry.name);
                const extServicesConf = JSON.parse(extServicesStr);
                (extServicesConf) && (Array.isArray(extServicesConf))
                    && extServicesConf.forEach((svc) => servicesConf.push(svc));
            }
        }

        return servicesConf
    }

    async buildOakApp<T extends OakApplication>(services: ServiceConfig[]): Promise<T> {
        const app = new OakApplication<AppState>();

        app.use(async (ctx, next) => {
            // reset states
            delete ctx.state.lastRequestUid;
            delete ctx.state.lastError;
            delete ctx.state.errorLogged;
            await next();
        });

        app.use(oakCors({ origin: this.appConfig.appFrontOrigin }));
        app.use(accessLogger<Middleware>({ format: "short" }));

        const pingRouter = new Router();
        await pingRouter.all("/ping", async (ctx, next) => {
            // TEST
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        ctx.response.status = Status.OK;
                        ctx.response.body = "Ok";
                        resolve(true);
                    } catch (err) {
                        this.logger.error(err);
                        reject(err);
                    }
                }, 500);
            })
        });
        app.use(pingRouter.routes(), pingRouter.allowedMethods());

        const proxyRouter = new Router();
        for (let svc of services) {
            const proxy = createAmqpProxy({ mqConfig: this.appConfig.mq, serviceConfig: svc });
            this.logger.info(`Attaching proxy for service: ${svc.method} ${svc.path} => ${svc.queueName}`);
            let routerFn: any;
            switch (svc.method) {
                case HttpMethod.Get:
                    routerFn = proxyRouter.get;
                    // await proxyRouter.get(svc.path, proxy);
                    break;
                case HttpMethod.Post:
                    routerFn = proxyRouter.post;
                    // await proxyRouter.post(svc.path, proxy);
                    break;
                case HttpMethod.Put:
                    routerFn = proxyRouter.put;
                    // await proxyRouter.put(svc.path, proxy);
                    break;
                case HttpMethod.Delete:
                    routerFn = proxyRouter.delete;
                    // await proxyRouter.delete(svc.path, proxy);
                    break;
                default:
                    throw new Error(`Unknown/unsupported HTTP Method: ${svc.method}`);
            }
            await routerFn.call(proxyRouter, svc.path, proxy);
        }
        proxyRouter.use(errorHandler<RouterMiddleware>({
            formatter: (err) => JSON.stringify({
                errorMessage: err.message
            }),
            loggerPrefix: "amqp-proxy",
        }));
        app.use(proxyRouter.routes(), proxyRouter.allowedMethods());

        app.use(errorHandler<Middleware>());

        return app as T;
    }

    public static fromEnv(): Server {
        const appConfig = AppConfig.fromEnv();
        return new Server(appConfig);
    }
}
