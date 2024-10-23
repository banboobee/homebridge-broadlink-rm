const hap = require('hap-nodejs');
const BroadlinkRMPlatform = require('../../platform');
const FakeDevice = require('./fakeDevice')
const { addDevice } = require('../../helpers/getDevice')

const homebridge = {hap: hap,
		    on: () => {},
		    user: {storagePath: () => {}}
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

const setup = (config) => {
  const platform = new BroadlinkRMPlatform(log, config, homebridge);

  const device = new FakeDevice(log)
  addDevice(device)

  return { platform, device, log }
}

// const getAccessories = (config, replacementLog) => {
//   const { platform, device } = setup(config)

//   const accessoriesPromise = new Promise((resolve, reject) => {
//     platform.accessories(resolve);
//   })

//   return accessoriesPromise
// }

// module.exports = { log, setup, getAccessories }
module.exports = { setup }
