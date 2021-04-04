export interface RestResponseMessage<T> {
    requestUid: string;
    payload?: T;
    error?: string;
}
