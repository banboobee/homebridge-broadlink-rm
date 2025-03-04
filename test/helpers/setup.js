const hap = require('hap-nodejs');
const { exec, execSync } = require('child_process');
const BroadlinkRMPlatform = require('../../platform');
const FakeDevice = require('./fakeDevice')
const { broadlink, addDevice, discoverDevices } = require('../../helpers/getDevice')

const homebridge = {hap: hap,
		    on: () => {},
		    user: {storagePath: () => {return './'}}
		   };
// const log = (format, ...args) => {
//   const now = `[${(new Date()).toLocaleString()}]`;
//   format = now + ' ' + format;
//   console.log(format, ...args);
// }
const log = () => {};

// const platform = {
//   api: homebridge,
//   log: log,
//   Service: hap.Service,
//   Characteristic: hap.Characteristic,
//   cachedAccessories: []
// }

global.Service = hap.Service;
global.Characteristic = hap.Characteristic;
global.cachedAccessories = [];
global.eve = null;
global.HistoryService = null;

const FakeServiceManager = require('./fakeServiceManager');
class FakePlatform extends BroadlinkRMPlatform {
  static isUnitTest = true;
  static {
    Object.keys(this.classTypes).forEach(type => {
      this.classTypes[type].ServiceManagerClass = FakeServiceManager;
    });
  }

  constructor (log, config = {}, homebridge) {
    super(log, config, homebridge);
  }
}

const setup = (config) => {
  const device = new FakeDevice(log)
  config?.accessories?.forEach((x) => x.host = device.host.address);

  const platform = new FakePlatform(log, config, homebridge);
  addDevice(device)

  return { platform, device, log }
}

const getAccessories = async (config) => {
  const { platform, device, log } = setup(config)

  const accessories = [];
  platform.addAccessories(accessories);
  accessories.forEach(async (accessory) => {
    if (accessory.updateAccessories) {
      await accessory.updateAccessories(accessories);
    }
  })

  return { platform, device, log, accessories };
}

const getDevices = (config) => {
  const { platform, device, log } = setup(config)

  discoverDevices(true, log, 0, 1);
  
  return { platform, device, log, broadlink };
}

const MQTTpublish = async (log, topic, message) => {
  const command = `mosquitto_pub -h localhost -t 'homebridge-broadlink-rm/UT/${topic}' -m ${message}`;
  exec(command, function (error, stdout, stderr) {
    log(`MQTT publish: ${command}, stdout:${stdout}, stderr:${stderr}, error:${error}`);
  });
}

const MQTTtest = async () => {
  try {
    execSync(`which mosquitto_pub`);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { setup, getAccessories, getDevices, MQTTpublish, MQTTtest }
