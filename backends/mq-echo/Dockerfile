ARG BIN_NAME=mq-echo
ARG SRC_PATH=backends/mq-echo
ARG DENO_UID=1993
ARG DENO_GID=1993

#builder
FROM denoland/deno:debian-1.13.2 as builder

ARG BIN_NAME
ARG SRC_PATH
ARG DENO_UID

MAINTAINER Chakrit W. <quaos.qrz@gmail.com>

WORKDIR /app

COPY src/app-config.ts src/
COPY src/deps src/deps
COPY src/models src/models
COPY src/utils src/utils
COPY tsconfig.json ${SRC_PATH}/
COPY ${SRC_PATH} ${SRC_PATH}

RUN deno cache src/deps/*.ts

RUN mkdir -p ${SRC_PATH}/target

RUN chown -R deno:deno . \
    && chown -R deno:deno $DENO_DIR

USER $DENO_UID

WORKDIR /app/${SRC_PATH}

RUN deno compile --allow-env --allow-net --allow-read --config tsconfig.json -o target/$BIN_NAME main.ts


# server
FROM debian:bullseye-slim AS server

ARG BIN_NAME
ARG SRC_PATH
ARG DENO_UID
ARG DENO_GID

MAINTAINER Chakrit W. <quaos.qrz@gmail.com>

WORKDIR /app

RUN addgroup --gid $DENO_GID deno \
  && adduser --uid $DENO_UID --gid $DENO_GID deno \
  && chown -R deno:deno .

USER $DENO_UID

COPY --from=builder /app/${SRC_PATH}/target/$BIN_NAME $BIN_NAME

ENV BIN_NAME=$BIN_NAME

ENTRYPOINT /app/$BIN_NAME
