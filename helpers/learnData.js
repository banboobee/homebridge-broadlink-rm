const { getDevice } = require('./getDevice');

let closeClient = null;
let timeout = null;
let getDataTimeout = null;

let currentDevice

const stop = async (log, debug) => {
  // Reset existing learn requests
  if (!closeClient) {return;}

  await closeClient();
  closeClient = null;

  log(`\x1b[35m[INFO]\x1b[0m Learn Code (stopped)`);
  if(this.initalDebug !== undefined && currentDevice) {currentDevice.debug = this.initalDebug;}
}

const start = async (host, callback, turnOffCallback, log, disableTimeout, debug) => {
  stop()

  // Get the Broadlink device
  const device = getDevice({ host, log, learnOnly: true });
  if (!device) {
    return log(`\x1b[31m[ERROR]\x1b[0m Learn Code (Couldn't learn code, device not found)`);
  }  

  this.initalDebug = device.debug;
  if (debug <=1) {device.debug = true;}

  if (!device.enterLearning) {return log(`\x1b[31m[ERROR]\x1b[0m Learn Code (IR learning not supported for device at ${host})`);}

  currentDevice = device

  let onRawData;

  closeClient = async (err) => {
    if (timeout) {clearTimeout(timeout);}
    timeout = null;

    if (getDataTimeout) {clearTimeout(getDataTimeout);}
    getDataTimeout = null;

    device.removeListener('rawData', onRawData);
    await device.cancelLearn(debug);
  };

  onRawData = async (message) => {
    if (!closeClient) {return;}

    const hex = message.toString('hex');
    log(`\x1b[35m[RESULT]\x1b[0m Learn Code (learned hex code: ${hex})`);
    log(`\x1b[35m[INFO]\x1b[0m Learn Code (complete)`);

    await closeClient();

    turnOffCallback();
  };

  device.on('rawData', onRawData);

  await device.enterLearning(debug)
  log(`Learn Code (ready)`);

  if (callback) {callback();}

  getDataTimeout = setTimeout(async () => {
    await getData(device, debug);
  }, 1000)

  if (disableTimeout) {return;}

  // Timeout the client after 10 seconds
  timeout = setTimeout(async () => {
    log('\x1b[35m[INFO]\x1b[0m Learn Code (stopped - 10s timeout)');
    await device.cancelLearn(debug);

    await closeClient();

    turnOffCallback();
  }, 10000); // 10s
}

const getData = async (device, debug) => {
  if (getDataTimeout) {clearTimeout(getDataTimeout);}
  if (!closeClient) {return;}

  await device.checkData(debug)

  getDataTimeout = setTimeout(async () => {
    await getData(device, debug);
  }, 1000);
}

module.exports = { start, stop }
