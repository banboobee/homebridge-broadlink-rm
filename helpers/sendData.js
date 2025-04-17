const assert = require('assert')

const { broadlink, getDevice } = require('./getDevice');
const convertProntoCode = require('./convertProntoCode')

module.exports = async ({ host, hexData, log, name, logLevel }) => {
  // assert(hexData && typeof hexData === 'string', `\x1b[31m[ERROR]: \x1b[0m${name} sendData (HEX value is missing)`);
  if (!hexData || typeof hexData !== 'string') {
    broadlink.logs.error(`\x1b[0m${name} sendData (HEX value is missing)`);
    return -1;
  }

  // Check for pronto code
  if (hexData.substring(0, 4) === '0000') {
    broadlink.logs.debug(`${name} sendHex (Converting Pronto code "${hexData}" to Broadlink code)`);
    hexData = convertProntoCode(hexData, log);
    broadlink.logs.debug(`${name} sendHex (Pronto code successfuly converted: "${hexData}")`);
    
    if (!hexData) {
      broadlink.logs.error(`${name} sendData (A Pronto code was detected however its conversion to a Broadlink code failed.)`);
      return -1;
    }
  }

  // Get the Broadlink device
  const device = getDevice({ host, log });

  if (!device) {
    if (!host) {
      broadlink.logs.error(`${name} sendData (no device found, ensure the device is not locked)`);
    } else {
      broadlink.logs.error(`${name} sendData (no device found at ${host}, ensure the device is not locked)`);
    }
    return -1;
  }
  
  if (!device.sendData) {
    device.logs.error(logLevel, `The device at ${device.host.address} (${device.host.macAddress}) doesn't support the sending of IR or RF codes.`);
    return -1;
  }
  if (hexData.includes('5aa5aa555')) {
    device.logs.error(logLevel, `This type of hex code (5aa5aa555...) is no longer valid. Use the included "Learn Code" accessory to find new (decrypted) codes.`);
    return -1;
  }
  
  device.logs.debug(logLevel, `sendHex(${device.host.address}) ${hexData}`);

  const hexDataBuffer = new Buffer.from(hexData, 'hex');
  return await device.sendData(hexDataBuffer, logLevel, hexData);
}
