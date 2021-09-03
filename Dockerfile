ARG APP_PORT=9080
ARG BIN_NAME=rest2amqp
ARG DENO_UID=1993
ARG DENO_GID=1993

#builder
FROM denoland/deno:debian-1.13.2 as builder

ARG BIN_NAME
ARG DENO_UID

MAINTAINER Chakrit W. <quaos.qrz@gmail.com>

WORKDIR /app

VOLUME ["/app/conf/services.d"]

COPY src/deps src/deps

RUN deno cache src/deps/*.ts

COPY . .

RUN mkdir -p target \
    && mkdir -p target/conf

RUN chown -R deno:deno . \
    && chown -R deno:deno $DENO_DIR

USER $DENO_UID

RUN deno compile --allow-env --allow-net --allow-read --config tsconfig.json -o target/$BIN_NAME cli.ts \
    && cp -v banner.txt target/ \
    && cp -v conf/services.json target/conf/

# server
FROM debian:bullseye-slim AS server

MAINTAINER Chakrit W. <quaos.qrz@gmail.com>

ARG APP_PORT
ARG BIN_NAME
ARG DENO_UID
ARG DENO_GID

WORKDIR /app

RUN addgroup --gid $DENO_GID deno \
  && adduser --uid $DENO_UID --gid $DENO_GID deno \
  && chown -R deno:deno .

USER $DENO_UID

VOLUME ["/app/conf/services.d"]

RUN mkdir -p conf

COPY --from=builder /app/target/$BIN_NAME $BIN_NAME
COPY --from=builder /app/target/banner.txt banner.txt
COPY --from=builder /app/target/conf/services.json conf/services.json

EXPOSE $APP_PORT

ENV APP_PORT=$APP_PORT
ENV BIN_NAME=$BIN_NAME

ENTRYPOINT /app/$BIN_NAME
