const uuid = require('uuid')

class FakeDevice {

  constructor (log) {
    const identifier = uuid.v4()

    this.host = {
      address: identifier,
      macAddress: identifier
    };

    this.callbacks = {};

    this.isUnitTestDevice = true;

    this.resetSentHexCodes();

    this.log = log;
  }

  resetSentHexCodes () {
    this.sentHexCodes = []
  }

  getSentHexCodeCount () {
    return this.sentHexCodes.length
  }

  hasSentCode (hexCode) {
    return (this.sentHexCodes.indexOf(hexCode) > -1);
  }

  hasSentCodes (hexCodes) {
    let hasSentCodes = true
    
    hexCodes.forEach((hexCode) => {
      if (this.sentHexCodes.indexOf(hexCode) === -1) {hasSentCodes = false}
    })
  
    return hasSentCodes
  }

  sendData (hexBufferData, debug, originalHexString) {
    if (!hexBufferData) {throw new Error('Missing HEX Data')}

    this.sentHexCodes.push(originalHexString)

    // return originalHexString.length > 0 ? 0 : -1;
    return originalHexString.length > 0 ? (Math.random() > 0.2 ? 0 : -1) : -1;
  }

  on (type, callback) {
    this.callbacks[type] = callback;
  }

  sendFakeOnCallback (type, value) {
    const callback = this.callbacks[type];

    if(callback) {callback(value);}
  }

  checkTemperature () {
    
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

module.exports = FakeDevice
