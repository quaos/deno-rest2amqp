import { HttpMethod } from "./HttpMethod.ts";

export interface ServiceConfig {
  method: HttpMethod;
  path: string;
  allowedHeaders?: string[];
  exchangeName?: string;
  queueName?: string;
  isDurableQueue?: boolean;
}
