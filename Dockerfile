FROM hayd/debian-deno:1.8.2

EXPOSE 9080

WORKDIR /app

USER deno

COPY src/deps src/deps

RUN deno cache src/deps/*.ts

COPY . .

RUN deno cache cli.ts

CMD ["run", "--allow-env", "--allow-net", "--allow-read", "cli.ts"]
