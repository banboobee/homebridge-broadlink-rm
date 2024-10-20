const hap = require('hap-nodejs');
const homebridge = {hap: hap,
		    on: () => {},
		    user: {storagepath: () => {}}
		   };


const BroadlinkRMPlatform = require('../../platform');
const FakeDevice = require('./fakeDevice')
const { addDevice } = require('../../helpers/getDevice')

global.Service = hap.Service;
global.Characteristic = hap.Characteristic;
global.cachedAccessories = [];
global.eve = null;
global.HistoryService = null;

const log = console.log;
// const log = () => {};

const platform = {
  api: homebridge,
  log: log,
  Service: hap.Service,
  Characteristic: hap.Characteristic,
  cachedAccessories: []
}


const setup = (config) => {
  // const platform = new BroadlinkRMPlatform(log, config, homebridge);

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
