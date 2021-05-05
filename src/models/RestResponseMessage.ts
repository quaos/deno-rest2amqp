export interface RestResponseMessage<T> {
    requestUid: string;
    headers?: Record<string, string>;
    payload?: T;
    error?: string;
}
