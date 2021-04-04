FROM hayd/debian-deno:1.8.2

WORKDIR /app

USER deno

COPY src/deps ./src/

RUN deno cache src/deps/*.ts

COPY . .

RUN deno cache main.ts

CMD ["run", "--allow-env", "--allow-net", "--allow-read", "main.ts"]
