import { connect } from "../../src/deps/amqp.ts";
import * as dotenv from "../../src/deps/dotenv.ts";

import { MqConfig } from "../../src/app-config.ts";
import { RestRequestMessage } from "../../src/models/RestRequestMessage.ts";
import { RestResponseMessage } from "../../src/models/RestResponseMessage.ts";
import { getConnectOptions } from "../../src/utils/amqp-helper.ts";

export const QUEUE_NAME = "echo";

export interface EchoMessage {
  message: string;
}

try {
  dotenv.config({ export: true });
  // console.log("Environment:", Deno.env.toObject());
  const config = MqConfig.fromEnv("MQ_");
  console.log("Starting example MQ backend service: echo; with config:", config);
  const exchange = config.exchangeName;
  const queue = QUEUE_NAME;

  const connectOpts = getConnectOptions(config);
  console.log("Connect options:", connectOpts);

  const connection = await connect(connectOpts);

  console.log("Connected to MQ server, opening channel");
  const channel = await connection.openChannel();
  
  if (exchange) {
    console.log("Declaring exchange:", exchange);
    await channel.declareExchange({ exchange });
  }

  console.log("Declaring queue:", queue);
  await channel.declareQueue({ queue });

  const onIncomingMessage = async (args: any, props: any, data: Uint8Array) => {
    try {
      console.log("args:", args, "; props:", props);

      const dataStr = new TextDecoder().decode(data);
      console.log(`Received request data: ${dataStr}`);

      await channel.ack({ deliveryTag: args.deliveryTag });

      const echoReq: RestRequestMessage<EchoMessage> = JSON.parse(dataStr);

      const replyTo = props.replyTo;
      if (!replyTo) {
        console.warn(`Request#${echoReq.requestUid} has no replyTo property; cannot respond`);
        return;
      }

      await channel.declareQueue({ queue: replyTo });

      const echoResp: RestResponseMessage<EchoMessage> = {
        requestUid: echoReq.requestUid,
        payload: {
          message: echoReq.params.message,
        }
      };

      console.log(`Responding to address: ${replyTo} with message:`, echoResp);

      await channel.publish(
        { routingKey: replyTo },
        { contentType: "application/json" },
        new TextEncoder().encode(JSON.stringify(echoResp)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  await channel.consume(
    { queue },
    onIncomingMessage,
  );

  // const retryDelay = 30000;

  // while (true) {
  // try {
  // } catch (err) {
  //   console.error(err);
  //   await new Promise((resolve) => {
  //     console.log(`Waiting to retry for: ${retryDelay} msecs`);
  //     setTimeout(() => resolve(true), retryDelay);
  //   });
  // }
  // }
} catch (err) {
  console.error(err);
  Deno.exit(-1);
}
