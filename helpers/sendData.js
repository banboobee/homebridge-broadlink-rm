const assert = require('assert')

const { getDevice } = require('./getDevice');
const convertProntoCode = require('./convertProntoCode')

module.exports = async ({ host, hexData, log, name, logLevel }) => {
  assert(hexData && typeof hexData === 'string', `\x1b[31m[ERROR]: \x1b[0m${name} sendData (HEX value is missing)`);

  // Check for pronto code
  if (hexData.substring(0, 4) === '0000') {
    if (logLevel <= 1) log(`\x1b[33m[DEBUG]\x1b[0m ${name} sendHex (Converting Pronto code "${hexData}" to Broadlink code)`);
    hexData = convertProntoCode(hexData, log);
    if (logLevel <= 1) log(`\x1b[33m[DEBUG]\x1b[0m ${name} sendHex (Pronto code successfuly converted: "${hexData}")`);
    
    if (!hexData) {
      log(`\x1b[31m[ERROR] \x1b[0m${name} sendData (A Pronto code was detected however its conversion to a Broadlink code failed.)`);
      return -1;
    }
  }

  // Get the Broadlink device
  const device = getDevice({ host, log });

  if (!device) {
    if (!host) {
      log(`\x1b[31m[ERROR] \x1b[0m${name} sendData (no device found, ensure the device is not locked)`);
    } else {
      log(`\x1b[31m[ERROR] \x1b[0m${name} sendData (no device found at ${host}, ensure the device is not locked)`);
    }
    return -1;
  }
  
  if (!device.sendData) {
    log(`\x1b[31m[ERROR] \x1b[0mThe device at ${device.host.address} (${device.host.macAddress}) doesn't support the sending of IR or RF codes.`);
    return -1;
  }
  if (hexData.includes('5aa5aa555')) {
    log(`\x1b[31m[ERROR] \x1b[0mThis type of hex code (5aa5aa555...) is no longer valid. Use the included "Learn Code" accessory to find new (decrypted) codes.`);
    return -1;
  }
  
  if (logLevel <=2) log(`${name} sendHex (${device.host.address}; ${device.host.macAddress}) ${hexData}`);

  const hexDataBuffer = new Buffer.from(hexData, 'hex');
  return await device.sendData(hexDataBuffer, logLevel);
}
