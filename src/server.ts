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

import { AppConfig } from "./app-config.ts";
import { AppState } from "./AppState.ts";
import { accessLogger } from "./middlewares/access-logger.ts";
import { errorHandler } from "./middlewares/error-handler.ts";
import { createAmqpProxy } from "./middlewares/amqp-proxy.ts";
import { ServiceConfig} from "./models/ServiceConfig.ts";
import { HttpMethod } from "./models/HttpMethod.ts";

export class Server {
    appConfig: AppConfig;
    
    public constructor(appConfig: AppConfig) {
        this.appConfig = appConfig;
    }
    
    public async start(): Promise<number> {
        console.info(`Starting server on port: ${this.appConfig.port}`);
        console.log("App Config:", this.appConfig);

        let rc;
        try {
            const services = await this.loadServicesConfig();

            const oakApp = await this.buildOakApp(services);    
            await oakApp.listen({
                port: this.appConfig.port
            });
            rc = 0;
        } catch (err) {
            console.error(err);
            rc = -1;
        }
        console.warn("Server stopped.");

        return rc;
    }

    async loadServicesConfig(): Promise<ServiceConfig[]> {
        console.log("Loading Services Config from:", this.appConfig.servicesFile);
        const servicesStr = await Deno.readTextFile(this.appConfig.servicesFile);

        return JSON.parse(servicesStr)
    }

    async buildOakApp<T extends OakApplication>(services: ServiceConfig[]): Promise<T> {
        const app = new OakApplication<AppState>();
        
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
                        console.error(err);
                        reject(err);
                    }
                }, 500);
            })
        });
        app.use(pingRouter.routes(), pingRouter.allowedMethods());

        const proxyRouter = new Router();
        for (let svc of services) {
            const proxy = createAmqpProxy({ mqConfig: this.appConfig.mq, serviceConfig: svc });
            console.log(`Attaching proxy for service: ${svc.method} ${svc.path} => ${svc.queueName}`);
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
