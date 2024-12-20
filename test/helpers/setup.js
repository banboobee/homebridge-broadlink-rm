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
const AirCon = require('../../accessories/aircon');
const AirPurifier = require('../../accessories/air-purifier');
const HumidifierDehumidifier = require('../../accessories/humidifier-dehumidifier');
const LearnCode = require('../../accessories/learnCode');
const Outlet = require('../../accessories/outlet');
const Switch = require('../../accessories/switch');
const Fan = require('../../accessories/fan');
const Fanv1 = require('../../accessories/fanv1');
const GarageDoorOpener = require('../../accessories/garageDoorOpener');
const Lock = require('../../accessories/lock');
const Light = require('../../accessories/light');
const Window = require('../../accessories/window');
const WindowCovering = require('../../accessories/windowCovering');
const TV = require('../../accessories/tv');
const TemperatureSensor = require('../../accessories/temperatureSensor.js');
const HumiditySensor = require('../../accessories/humiditySensor.js');
const HeaterCooler = require('../../accessories/heater-cooler');

AirCon.ServiceManagerClass = FakeServiceManager;
AirPurifier.ServiceManagerClass = FakeServiceManager;
HumidifierDehumidifier.ServiceManagerClass = FakeServiceManager;
LearnCode.ServiceManagerClass = FakeServiceManager;
Outlet.ServiceManagerClass = FakeServiceManager;
Switch.ServiceManagerClass = FakeServiceManager;
Fan.ServiceManagerClass = FakeServiceManager;
Fanv1.ServiceManagerClass = FakeServiceManager;
GarageDoorOpener.ServiceManagerClass = FakeServiceManager;
Lock.ServiceManagerClass = FakeServiceManager;
Light.ServiceManagerClass = FakeServiceManager;
Window.ServiceManagerClass = FakeServiceManager;
WindowCovering.ServiceManagerClass = FakeServiceManager;
TV.ServiceManagerClass = FakeServiceManager;
TemperatureSensor.ServiceManagerClass = FakeServiceManager;
HumiditySensor.ServiceManagerClass = FakeServiceManager;
HeaterCooler.ServiceManagerClass = FakeServiceManager;

class FakePlatform extends BroadlinkRMPlatform {
  static isUnitTest = true;
  classTypes = {
    'air-conditioner': AirCon,
    'air-purifier': AirPurifier,
    'humidifier-dehumidifier': HumidifierDehumidifier,
    'learn-ir': LearnCode,
    'learn-code': LearnCode,
    'switch': Switch,
    'garage-door-opener': GarageDoorOpener,
    'lock': Lock,
    'fan': Fan,
    'fanv1': Fanv1,
    'outlet': Outlet,
    'light': Light,
    'window': Window,
    'window-covering': WindowCovering,
    'tv': TV,
    'temperatureSensor': TemperatureSensor,
    'humiditySensor': HumiditySensor,
    'heater-cooler': HeaterCooler
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
