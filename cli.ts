import * as dotenv from "./src/deps/dotenv.ts";
import { log } from "./src/deps/std.ts";

import { AppConfig } from "./src/app-config.ts";
import { Server } from "./src/server.ts";

let rc;
try {
  dotenv.config({ export: true });
  let appConfig = AppConfig.fromEnv();
  (appConfig.logging) && await log.setup(appConfig.logging);
  // TEST
  // log.debug("Env:", Deno.env.toObject());
  // log.debug("App Config:", appConfig);

  const bannerFilePath = `${Deno.cwd()}/banner.txt`;
  const banner = await Deno.readTextFile(bannerFilePath);
  appConfig.banner = banner;

  let server = new Server(appConfig);

  rc = await server.start();
} catch (err) {
  log.critical(err);
  rc = -1;
}
log.debug(`Terminated (${rc})`);
Deno.exit(rc);

export { }
