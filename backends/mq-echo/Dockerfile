FROM hayd/debian-deno:1.8.2

ARG SRC_PATH 

WORKDIR /app

USER deno

COPY src/app-config.ts src/
COPY src/deps src/deps
COPY src/models src/models
COPY src/utils src/utils
COPY ${SRC_PATH} ${SRC_PATH}

WORKDIR /app/${SRC_PATH}

RUN deno cache "main.ts"

CMD ["run", "--allow-env", "--allow-net", "--allow-read", "main.ts"]
