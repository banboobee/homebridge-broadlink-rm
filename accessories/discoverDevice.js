const { broadlink, discoverDevices, discoveredDevices } = require('../helpers/getDevice');
const BroadlinkRMAccessory = require('./accessory');

class DiscoverDeviceAccessory extends BroadlinkRMAccessory {
  static configKeys = {
    // common
    ...this.configCommonKeys,

    // boolean

    // number
    timeout: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
  }

  constructor(log, config = {}, platform) {
    // Set a default name for the accessory
    config.name ??= 'Discover Device';
    config.persistState = false;

    super(log, config, platform);
  }

  checkConfig(config) {
    this.constructor.verifyConfig([config], '', this.constructor.configKeys); 
  }

  setDefaults() {
    const { config, state } = this;

    config.timeout ??= 60;
    state.switchState = false;
  }

  static discoverTimeout = undefined;
  discover(hexData, previousValue) {
    const { state, config, serviceManager } = this;
    if (this.constructor.discoverTimeout) {
      const hap = this.platform.api.hap;
      throw new hap.HapStatusError(hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    } else if (state.switchState) {
      if (!this.constructor.discoverTimeout) {
	this.logs.info(`re-discovering Broadlink RM devices for ${config.timeout} secs.`);
	this.constructor.discoverTimeout = setTimeout(() => {
	  this.constructor.discoverTimeout = undefined;
	  state.switchState = false;
	  serviceManager.refreshCharacteristicUI(Characteristic.On);
	}, (config.timeout + 5) * 1000);	// with library timeout
      }
      Object.keys(broadlink.devices).forEach(device => {
	clearInterval(broadlink.devices[device].keepAliveInterval);
	clearInterval(broadlink.devices[device].pingInterval);
	discoveredDevices[broadlink.devices[device].host.address] = undefined;
	discoveredDevices[broadlink.devices[device].host.macAddress] = undefined;
      })
      broadlink.close();
      discoverDevices(true, this.log, this.logLevel, config.timeout, this.platform);
    } else {
      // state.switchState = false;
      // this.serviceManager.refreshCharacteristicUI(Characteristic.On);
    }
  }
  
  setupServiceManager() {
    const { Service, Characteristic } = this;
    const { name } = this;

    this.serviceManager = new this.serviceManagerClass(name, Service.Switch, this.log);

    this.serviceManager.addToggleCharacteristic({
      name: 'switchState',
      type: Characteristic.On,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        setValuePromise: this.discover.bind(this),
      }
    })
  }
}

module.exports = DiscoverDeviceAccessory
