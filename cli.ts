import * as dotenv from "./src/deps/dotenv.ts";

import { AppConfig } from "./src/app-config.ts";
import { Server } from "./src/server.ts";

let rc;
try {
  dotenv.config({ export: true });
  let appConfig = AppConfig.fromEnv();
  let server = new Server(appConfig);

  rc = await server.start();
} catch (err) {
  console.error(err);
  rc = -1;
}
Deno.exit(rc);

export {}
