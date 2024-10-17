const BroadlinkRMPlatform = require('./platform');
const homebridgelib = require( 'homebridge-lib');
const fakegatoHistory = require( 'fakegato-history');

module.exports = (homebridge) => {
  global.HomebridgeAPI = homebridge;
  global.cachedAccessories = [];
  global.eve = new homebridgelib.EveHomeKitTypes(homebridge);;
  global.HistoryService = fakegatoHistory( homebridge );
  
  global.Service = homebridge.hap.Service;
  global.Accessory = homebridge.hap.Accessory;
  global.Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform("homebridge-broadlink-rm", "BroadlinkRM", BroadlinkRMPlatform);
}
