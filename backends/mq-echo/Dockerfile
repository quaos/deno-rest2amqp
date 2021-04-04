FROM hayd/debian-deno:1.8.2

ARG SRC_PATH 

WORKDIR /app

USER deno

COPY src/app-config.ts src/
COPY src/deps src/
COPY src/models src/
COPY src/models src/
COPY ${SRC_PATH} ${SRC_PATH}}

RUN deno cache "${SRC_PATH}/cli.ts"

CMD ["run", "--allow-net", "${SRC_PATH}/cli.ts"]
