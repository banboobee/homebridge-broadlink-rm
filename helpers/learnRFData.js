const { getDevice } = require('./getDevice');

let timeout = null;
let currentDevice = null;

const stop = async (log, debug) => {
  // Reset existing learn requests
  // if (currentDevice) {await currentDevice.cancelSweepFrequency(debug);}
  if(this.initalDebug !== undefined && currentDevice) {currentDevice.debug = this.initalDebug;}
  currentDevice = null;
}

const start = async (host, callback, turnOffCallback, log, debug) => {
  stop(log, debug)

  // Get the Broadlink device
  const device = getDevice({ host, log, learnOnly: true })
  if (!device) return log(`\x1b[35m[INFO]\x1b[0m Learn Code (Couldn't learn code, device not found)`);
  if (!device.enterLearning) {return log(`\x1b[31m[ERROR]\x1b[0m Learn Code (IR/RF learning not supported for device at ${host})`);}
  if (!device.enterRFSweep) {return log(`\x1b[31m[ERROR]\x1b[0m Scan RF (RF learning not supported for device (${device.type}) at ${host})`);}

  currentDevice = device
  this.initalDebug = device.debug;
  if (debug) device.debug = true;

  await device.mutex.use(async () => device.sweepFrequency(debug));
  log(`\x1b[35m[INFO]\x1b[0m Detecting radiofrequency, press and hold the button to learn...`);
  callback();

  timeout = setTimeout(async () => {
    timeout = null;
  }, 30 * 1000); // 30s
  while (timeout) { 
    await new Promise(resolve => setTimeout(resolve, 1 * 1000));
    const data = await device.mutex.use(async () => device.checkFrequency(debug));
    if (data?.locked) {
      const {locked, frequency} = data;
      log(`\x1b[35m[INFO]\x1b[0m Radiofrequency detected: ${frequency.toFixed(1)}Mhz`);
      // log(`\x1b[35m[INFO]\x1b[0m You can now let go of the button`);
      log(`\x1b[35m[INFO]\x1b[0m Press the button again, now a short press.`);
      break;
    }
  }
  if (timeout) {
    clearTimeout(timeout);
    await device.mutex.use(async () => device.findRFPacket(debug));
  } else {
    log('\x1b[35m[INFO]\x1b[0m Radiofrequency not found');
    await device.mutex.use(async () => device.cancelSweepFrequency(debug));
    turnOffCallback();
    return;
  }
  timeout = setTimeout(async () => {
    timeout = null;
    log('\x1b[35m[INFO]\x1b[0m No data received...');
  }, 30 * 1000); // 30s
  while (timeout) { 
    await new Promise(resolve => setTimeout(resolve, 1 * 1000));
    const data = await device.mutex.use(async () => device.checkData(debug));
    if (data) {
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
