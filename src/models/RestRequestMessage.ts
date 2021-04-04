import { HttpMethod } from "./HttpMethod.ts";

export interface RestRequestMessage<T> {
    requestUid: string;
    method: HttpMethod;
    endpoint: string;
    params: T;
}
