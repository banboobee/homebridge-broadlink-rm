const { getDevice } = require('./getDevice');

let timeout = null;
let currentDevice

const stop = async (log, debug) => {
  if (this.initalDebug !== undefined && currentDevice) currentDevice.debug = this.initalDebug;
  if (timeout) {
    clearTimeout(timeout);
    log('\x1b[35m[INFO]\x1b[0m Canceled');
  }
  timeout = null;
}

const start = async (host, callback, turnOffCallback, log, debug) => {
  callback();
  stop(log, debug)

  // Get the Broadlink device
  const device = getDevice({ host, log, learnOnly: true });
  if (!device) return log(`\x1b[31m[ERROR]\x1b[0m Learn Code (Couldn't learn code, device not found)`);
  if (!device.enterLearning) return log(`\x1b[31m[ERROR]\x1b[0m Learn Code (IR learning not supported for device at ${host})`);

  currentDevice = device
  this.initalDebug = device.debug;
  device.debug = debug;

  await device.enterLearning(debug);
  log(`\x1b[35m[INFO]\x1b[0m Learning...`);

  timeout = setTimeout(async () => {
    timeout = null;
  }, 10 * 1000); // 10s
  while (timeout) {
    await new Promise(resolve => setTimeout(resolve, 1 * 1000));
    if (data = await device.checkData(debug)) {
      const hex = data.toString('hex');
      log(`\x1b[35m[INFO]\x1b[0m Packet found!`);
      log(`\x1b[35m[RESULT]\x1b[0m Hex Code: ${hex}`);
      break;
    }
  }
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  } else {
    log('\x1b[35m[INFO]\x1b[0m No data received...');
    await device.cancelLearning(debug);
  }
  turnOffCallback();
}

module.exports = { start, stop }
