import type { AmqpConnectOptions } from "../deps/amqp.ts";

import { MqConfig } from "../app-config.ts";

export function getConnectOptions(config: MqConfig): AmqpConnectOptions {
  return {
    hostname: config.host,
    port: config.port,
    vhost: config.vhost,
    username: config.user,
    password: config.password,
    loglevel: (config.debug) ? "debug" : "none",
  }
}