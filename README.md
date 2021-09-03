# deno-rest2amqp: REST-to-AMQP API Gateway example on Deno

## Requirements

* Deno version: ^1.13.2
* Adds `~/.deno/bin` path to your system or user's `PATH` environment variable

```shell
# for *nix and MacOS
export PATH="${PATH}:~/.deno/bin"

# for Windows
set PATH=%PATH%;%HOME%\.deno\bin
```

* Needs [denon](https://github.com/denosaurs/denon) for debugging/live reloading

### Environment Vars

* ***APP_ENV:*** (dev|production)
* ***APP_HOST:*** (default: `0.0.0.0`)
* ***APP_PORT:*** (default: `9080`)
* ***APP_FRONT_ORIGIN:*** Origin for CORS (default: `*`)
* ***MQ_HOST:*** (default: `0.0.0.0`)
* ***MQ_PORT:*** (default: `5672`)
* ***MQ_USER:***
* ***MQ_PASSWORD:***
* ***MQ_VHOST:*** (default: '')
* ***MQ_EXCHANGE:*** (default: '')
* ***MQ_QUEUE:*** (default: '')
* ***MQ_TIMEOUT:*** (default: `30000`) (millisecs)

## Backend Services Config Format

* Built-in/example services config is in `conf/services.json`

* Additional services config files can be added to: `conf/services.d/` (Docker volume)

```typescript
// See: src/models/ServiceConfig.ts
// each config JSON file is parsed as ServiceConfig[]

export interface ServiceConfig {
  method: HttpMethod;
  path: string;
  allowedHeaders?: string[];
  exchangeName?: string;
  queueName?: string;
  isDurableQueue?: boolean;
}
```

## Outgoing Request Message Format

```typescript
// See: src/models/RestRequestMessage.ts
import { HttpMethod } from "./HttpMethod.ts";

export interface RestRequestMessage<T> {
    requestUid: string;
    method: HttpMethod;
    endpoint: string;
    headers: Record<string, string>;
    payload: T;
}

// See: src/models/HttpMethod.ts
export enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE"
}
```

## Accepted Response Message Format

```typescript
// See: src/models/RestResponseMessage.ts
export interface RestResponseMessage<T> {
    requestUid: string;
    headers?: Record<string, string>;
    payload?: T;
    error?: string;
}
```

### Running

***Running everything in containers, using Docker compose***
```shell
docker-compose up -d
```

***Running API Gateway/Proxy***
```shell
yarn start

# or:
deno run --allow-env --allow-net --allow-read cli.ts

# or for live-reload:
denon start

# or for live-reload and debugging:
denon debug
```

***Running mq-echo, the sample backend service***
```shell
yarn echo:start

# or:
deno run --allow-env --allow-net --allow-read backends/mq-echo/main.ts

# or for live-reload:
denon echo:start

# or for live-reload and debugging:
denon echo:debug
```

***Adding more backend service***
```shell
# use the same format as conf/services.json
cp my-mq-services.json conf/services/

# restart
```

### Testing Operations

```shell
curl -s -X POST \
    -H"Authorization: Bearer xxxx" \
    http://localhost:9080/echo/hi
```