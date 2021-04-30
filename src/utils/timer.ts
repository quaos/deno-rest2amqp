/** 
 * Wrapper class for set/clearTimeouts, for use in asyncs
 */
export class Timer {
    timeoutId?: number;
    timedOut: boolean = false;

    public constructor() {
    }

    public async start<T>(
        timeout: number,
        onTimeout: () => void,
        opFn: () => Promise<T>,
    ): Promise<T> {
        if (this.timeoutId) {
            throw new Error("timer is already running");
        }
        if (this.timedOut) {
            throw new Error("timer has already timed out");
        }

        return await Promise.race([
            new Promise<T>((resolve, reject) => {
                this.timeoutId = setTimeout(() => {
                    try {
                        this.timeoutId = undefined;
                        this.timedOut = true;
                        onTimeout();
                        reject(new Error("timeout"));
                    } catch (err) {
                        reject(err);
                    }
                }, timeout)
            }),
            opFn().then((result) => {
                this.stop();
                return result
            }),
        ])
    }

    public isTimedOut() {
        return this.timedOut
    }

    public stop() {
        (this.timeoutId) && clearTimeout(this.timeoutId);
        this.timeoutId = undefined;
    }
}
