import { vi } from 'vitest';
import * as uuid from 'uuid';

class FakeDevice {
  constructor (log) {
    const identifier = uuid.v4();

    this.host = {
      address: identifier,
      macAddress: identifier
    };

    this.callbacks = {};

    this.isUnitTestDevice = true;

    this.resetSentHexCodes();

    this.log = log;

    this.failureResponseOnSendData = null;
  }

  resetSentHexCodes () {
    this.sendData.mockClear();
  }

  getSentHexCodeCount () {
    return this.sendData.mock.calls.length;
  }

  hasSentCode (hexCode) {
    return !!this.sendData.mock.calls.find(x => x[2] === hexCode);
  }

  hasSentCodes (hexCodes) {
    let hasSentCodes = true;

    hexCodes.forEach((hexCode) => {
      if (!this.sendData.mock.calls.find(x => x[2] === hexCode)) {
        hasSentCodes = false;
      }
    })

    return hasSentCodes;
  }

  sendData = vi.fn((hexBufferData, debug, originalHexString) => {
    if (!hexBufferData) {
      throw new Error('Missing HEX Data');
    }
    if (originalHexString.length < 1) {
      return -1;
    } else if (this.failureResponseOnSendData === 'random') {
      return Math.random() > 0.2 ? 0 : -1;
    } else if (this.failureResponseOnSendData === 'always') {
      return -1;
    } else {
      return 0;
    }
  });

  on (type, callback) {
    this.callbacks[type] = callback;
  }

  sendFakeOnCallback (type, value) {
    const callback = this.callbacks[type];

    if (callback) {
      callback(value);
    }
  }

  checkTemperature () {
  }

  setFailureResponseOnSendData(mode) {
    this.failureResponseOnSendData = mode;
  }

  logs = {
    debug: (level, ...args) => {
      this.log(...args);
    },
    error: (level, ...args) => {
      this.log(...args);
    }
  }
}

export default FakeDevice;
