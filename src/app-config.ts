import { merge } from "./utils/utils.ts";

export class AppConfig {
    appName: string = "deno-rest2amqp";
    appVersion: string = "1.0.0";
    appFrontOrigin: string = "http://localhost:3000";
    host: string = "0.0.0.0";
    port: number = 9080;
    servicesFile: string = "conf/services.json";
    mq: MqConfig = new MqConfig();
    
    public constructor(attrs?: Partial<AppConfig>) {
        (attrs) && merge(this, attrs);
    }

    static fromEnv(): AppConfig {
        let portStr = Deno.env.get("APP_PORT");

        const config = new AppConfig({
            appName: Deno.env.get("APP_NAME"),
            appVersion: Deno.env.get("APP_VERSION"),
            appFrontOrigin: Deno.env.get("APP_FRONT_ORIGIN"),
            host: Deno.env.get("APP_HOST"),
            port: (portStr) ? Number(portStr) : undefined,
            mq: MqConfig.fromEnv("MQ_"),
        });
        
        return config;
    }
}

export class MqConfig {
    host: string = "localhost";
    port: number = 5672;
    user?: string;
    password?: string;
    vhost?: string;
    exchangeName: string = "";
    queueName: string = "";
    replyToQueue: string = "amq.rabbitmq.reply-to";
    useTls: boolean = false;
    timeout?: number = 30000;
    debug: boolean = false;

    public constructor(attrs?: Partial<MqConfig>) {
        (attrs) && merge(this, attrs);
    }

    static fromEnv(prefix?: string): MqConfig {
        let portStr = Deno.env.get(`${prefix}PORT`);
        let useTlsStr = Deno.env.get(`${prefix}USE_TLS`);
        let debugStr = Deno.env.get(`${prefix}DEBUG`);

        const config = new MqConfig({
            host: Deno.env.get(`${prefix}HOST`),
            port: (portStr) ? Number(portStr) : undefined,
            user: Deno.env.get(`${prefix}USER`),
            password: Deno.env.get(`${prefix}PASSWORD`),
            vhost: Deno.env.get(`${prefix}VHOST`),
            exchangeName: Deno.env.get(`${prefix}EXCHANGE`),
            queueName: Deno.env.get(`${prefix}QUEUE`),
            useTls: (useTlsStr) ? /^(1|t|true|y|yes)$/i.test(useTlsStr) : false,
            debug: (debugStr) ? /^(1|t|true|y|yes)$/i.test(debugStr) : false,
        });
        
        return config;
    }
}
