const { getDevice } = require('../helpers/getDevice');

const BroadlinkRMAccessory = require('./accessory');

class LearnIRAccessory extends BroadlinkRMAccessory {
  static configKeys = {
    // common
    ...this.configCommonKeys,

    // boolean
    scanRF: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    scanFrequency: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],

    // number
    frequency: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
  }

  constructor(log, config = {}, platform) {
    // Set a default name for the accessory
    if (!config.name) {config.name = 'Learn Code';}
    config.persistState = false;

    super(log, config, platform);
  }

  checkConfig(config) {
    this.constructor.verifyConfig([config], '', this.constructor.configKeys); 
  }

  setDefaults() {
    this.state.switchState = false;
  }

  toggleLearning(props, on, callback) {
    const { config } = this;
    const { scanRF, scanFrequency, frequency } = config;

    if (scanRF || scanFrequency) {
      const scan = frequency ?? undefined;
      if (on) {
        this.RFstart(this.host, scan, callback);
      } else {
        this.RFstop();

        callback();
      }

      return;
    }

    if (on) {
      this.IRstart(this.host, callback);
    } else {
      this.IRstop();

      callback();
    }
  }

  turnOffCallback = () => {
    const { Characteristic } = this;
    this.serviceManager.setCharacteristic(Characteristic.On, false);
  }

  timeout = null;
  currentDevice = null;
  initialDebug = undefined;
  
  IRstop = async () => {
    if (this.initialDebug !== undefined && this.currentDevice) this.currentDevice.debug = this.initialDebug;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.logs.log('Canceled');
    }
    this.timeout = null;
  }
  
  IRstart = async (host, callback) => {
    callback();
    this.IRstop()
    
    // Get the Broadlink device
    const device = getDevice({ host, log: this.log, learnOnly: true });
    if (!device) return this.logs.error(`Learn Code (Couldn't learn code, device not found).`);
      if (!device.enterLearning) return device.logs.error(this.logLevel, `learn Code (IR learning) not supported for device 0x${device.type.toString(16)}.`);
    
    this.currentDevice = device
    this.initialDebug = device.debug;
    device.debug = this.logLevel;
    
    await device.enterLearning(this.logLevel);
    this.logs.log(`Learning...`);
    
    this.timeout = setTimeout(async () => {
      this.timeout = null;
    }, 10 * 1000); // 10s
    while (this.timeout) {
      await new Promise(resolve => setTimeout(resolve, 1 * 1000));
      const data = await device.checkData(this.logLevel);
      if (data) {
	const hex = data.toString('hex');
	this.logs.log(`Packet found!`);
	this.logs.log(`Hex Code: ${hex}`);
	break;
      }
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    } else {
      this.logs.log('No data received...');
      await device.cancelLearning(this.logLevel);
    }
    this.turnOffCallback();
  }

  RFstop = async () => {
    // Reset existing learn requests
    // if (this.currentDevice) {await this.currentDevice.cancelSweepFrequency(this.logLevel);}
    if(this.initalDebug !== undefined && this.currentDevice) {this.currentDevice.debug = this.initalDebug;}
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.logs.log('Canceled');
    }
    this.currentDevice = null;
    this.timeout = null;
  }
  
  RFstart = async (host, frequency, callback) => {
    callback();
    this.RFstop()
    
    // Get the Broadlink device
    const device = getDevice({ host, log: this.log, learnOnly: true })
    if (!device) return this.logs.error(`Learn Code (Couldn't learn code, device not found).`);
    if (!device.enterLearning) return device.logs.error(this.logLevel, `learn Code (IR/RF learning) not supported for device 0x${device.type.toString(16)}.`);
    if (!device.enterRFSweep) return device.logs.error(this.logLevel, `scan RF (RF learning) not supported for device 0x${device.type.toString(16)}.`);
    
    this.currentDevice = device
    this.initalDebug = device.debug;
    if (this.logLevel) device.debug = true;
    
    if (!frequency) {
      await device.sweepFrequency(this.logLevel);
      this.logs.log(`Detecting radiofrequency, press and hold the button to learn...`);
      
      this.timeout = setTimeout(async () => {
	this.timeout = null;
      }, 30 * 1000); // 30s
      while (this.timeout) { 
	await new Promise(resolve => setTimeout(resolve, 1 * 1000));
	const data = await device.checkFrequency(this.logLevel);
	if (data) {
	  const {locked, frequency} = data;
	  if (locked) {
	    this.logs.log(`Radiofrequency detected: ${frequency.toFixed(2)}MHz`);
	    // this.logs.log(`You can now let go of the button`);
	    this.logs.log(`Pausing 3 seconds.`);
	    await new Promise(resolve => setTimeout(resolve, 3 * 1000));
	    this.logs.log(`Press the button again, now a short press.`);
	    break;
	  } else {
	    this.logs.log(`scanning ${frequency.toFixed(2)}MHz ...`);
	  }
	}
      }
      if (this.timeout) {
	clearTimeout(this.timeout);
	this.timeout = null;
      } else {
	this.logs.log('Radiofrequency not found');
	await device.cancelSweepFrequency(this.logLevel);
	this.turnOffCallback();
	return;
      }
    } else {
      this.logs.log('Press the button you want to learn, a short press...');
    }
    await device.findRFPacket(frequency, this.logLevel);
    this.timeout = setTimeout(async () => {
      this.timeout = null;
    }, 30 * 1000); // 30s
    while (this.timeout) { 
      await new Promise(resolve => setTimeout(resolve, 1 * 1000));
      const data = await device.checkData(this.logLevel);
      if (data) {
	const hex = data.toString('hex');
	this.logs.log(`Packet found!`);
	this.logs.log(`Hex Code: ${hex}`);
	break;
      }
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    } else {
      this.logs.log('No data received...');
    }
    this.turnOffCallback();
  }
  
  setupServiceManager() {
    const { Service, Characteristic } = this;
    const { name } = this;

    this.serviceManager = new this.serviceManagerClass(name, Service.Switch, this.log);

    this.serviceManager.addToggleCharacteristic({
      name: 'switchState',
      type: Characteristic.On,
      getMethod: this.getCharacteristicValue,
      setMethod: this.toggleLearning.bind(this),
      bind: this,
      props: {

      }
    })
  }
}

module.exports = LearnIRAccessory
