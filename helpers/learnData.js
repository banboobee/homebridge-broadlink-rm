const { getDevice } = require('./getDevice');

let timeout = null;
let currentDevice

const stop = async (log, debug) => {
  if (this.initalDebug !== undefined && currentDevice) currentDevice.debug = this.initalDebug;
}

const start = async (host, callback, turnOffCallback, log, debug) => {
  stop(log, debug)

  // Get the Broadlink device
  const device = getDevice({ host, log, learnOnly: true });
  if (!device) return log(`\x1b[31m[ERROR]\x1b[0m Learn Code (Couldn't learn code, device not found)`);
  if (!device.enterLearning) return log(`\x1b[31m[ERROR]\x1b[0m Learn Code (IR learning not supported for device at ${host})`);

  currentDevice = device
  this.initalDebug = device.debug;
  if (debug <= 1) device.debug = true;

  await device.mutex.use(async () => device.enterLearning(debug));
  log(`\x1b[35m[INFO]\x1b[0m Learning...`);
  callback();

  timeout = setTimeout(async () => {
    timeout = null;
    log('\x1b[35m[INFO]\x1b[0m No data received...');
    await device.mutex.use(async () => device.cancelLearning(debug));
  }, 10 * 1000); // 10s
  while (timeout) {
    await new Promise(resolve => setTimeout(resolve, 1 * 1000));
    if (data = await device.mutex.use(async () => device.checkData(debug))) {
      const hex = data.toString('hex');
      log(`\x1b[35m[INFO]\x1b[0m Packet found!`);
      log(`\x1b[35m[RESULT]\x1b[0m Hex Code: ${hex}`);
      break;
    }
  }
  clearTimeout(timeout);
  turnOffCallback();
}

module.exports = { start, stop }
