const { getDevice } = require('../helpers/getDevice');
const ServiceManager = require('../helpers/serviceManager');
const ServiceManagerTypes = require('../helpers/serviceManagerTypes');

const BroadlinkRMAccessory = require('./accessory');

class LearnIRAccessory extends BroadlinkRMAccessory {

  constructor(log, config = {}, serviceManagerType) {
    // Set a default name for the accessory
    if (!config.name) {config.name = 'Learn Code';}
    config.persistState = false;

    super(log, config, serviceManagerType);
  }

  setDefaults() {
    this.state.switchState = false;
  }

  toggleLearning(props, on, callback) {
    const { config, serviceManager } = this;
    const { disableAutomaticOff, scanRF, scanFrequency, frequency } = config;

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
    if (!device) return this.logs.error(`Learn Code (Couldn't learn code, device not found)`);
    if (!device.enterLearning) return this.logs.error(`Learn Code (IR learning not supported for device at ${host})`);
    
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
      this.logs.error('No data received...');
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
    if (!device) return this.logs.error(`Learn Code (Couldn't learn code, device not found)`);
    if (!device.enterLearning) return this.logs.error(`Learn Code (IR/RF learning not supported for device at ${host})`);
    if (!device.enterRFSweep) return this.logs.error(`Scan RF (RF learning not supported for device (${device.type}) at ${host})`);
    
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
      this.logs.error('No data received...');
    }
    this.turnOffCallback();
  }
  
  setupServiceManager() {
    const { data, name, config, serviceManagerType } = this;
    const { on, off } = data || {};

    this.serviceManager = new ServiceManagerTypes[serviceManagerType](name, Service.Switch, this.log);

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
