import { TIMEOUT_CANCELLATION } from './errors.js';

function delayForDuration(duration) {
  const promiseFunc = function (resolve, reject) {
    const timerID = setTimeout(() => {
      resolve('Timeout Complete');
      this.isCancelled  = true;
    }, duration * 1000);

    return timerID;
  }

  class Timer extends Promise {
    isCancelled = false;
    #resolve = undefined;
    #reject = undefined;
    #timerID = undefined;
    constructor(executor) {
      let resolve, reject;
      super((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
      })
      this.#resolve = resolve;
      this.#reject = reject;
      this.#timerID = executor.call(this, this.#resolve, this.#reject);
    }

    cancel(rejectOnCancel = undefined) {
      if (this.isCancelled) {
        return;
      }
      clearTimeout(this.#timerID);
      this.isCancelled = true;

      if (rejectOnCancel === undefined) {
        this.#reject(new Error(TIMEOUT_CANCELLATION));
      } else if (rejectOnCancel === false) {
        this.#resolve(TIMEOUT_CANCELLATION);
      } else {
        return; // keep pending. compatible with the previous version.
      }
    }
  }

  return new Timer(promiseFunc);
}

export default delayForDuration;
