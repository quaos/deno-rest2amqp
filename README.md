# deno-rest2amqp: REST-to-AMQP API Gateway example on Deno

## Requirements

* Deno version: ^1.8.0
* Adds `~/.deno/bin` path to your system or user's `PATH` environment variable

```shell
# for *nix and MacOS
export PATH="${PATH}:~/.deno/bin"

# for Windows
set PATH=%PATH%;%HOME%\.deno\bin
```

* Needs [denon](https://github.com/denosaurs/denon) for debugging/live reloading

### Environment vars

* ***APP_ENV:*** (dev|production)
* ***APP_HOST:*** (default: `0.0.0.0`)
* ***APP_PORT:*** (default: `9080`)
* ***APP_FRONT_ORIGIN:*** Origin for CORS (default: `http://localhost:3000`)
* ***MQ_HOST:*** (default: `0.0.0.0`)
* ***MQ_PORT:*** (default: `5672`)
* ***MQ_USER:***
* ***MQ_PASSWORD:***
* ***MQ_VHOST:*** (default: ``)
* ***MQ_EXCHANGE:*** (default: ``)
* ***MQ_QUEUE:*** (default: ``)
* ***MQ_TIMEOUT:*** (default: `30000`) (millisecs)


### Running

***Running everything in containers, using Docker compose***
```shell
docker-compose up -d
```

***Running API Gateway/Proxy***
```
yarn start

# or:
deno run --allow-env --allow-net --allow-read cli.ts

# or for live-reload:
denon start

# or for live-reload and debugging:
denon debug
```

***Running mq-echo, the sample backend service***
```
yarn echo:start

# or:
deno run --allow-env --allow-net --allow-read backends/mq-echo/main.ts

# or for live-reload:
denon echo:start

# or for live-reload and debugging:
denon echo:debug
```

### Testing Operations

```
curl -s -X POST http://localhost:9080/echo/hi
```