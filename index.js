const BroadlinkRMPlatform = require('./platform');
const fakegatoHistory = require( 'fakegato-history');

module.exports = async (homebridge) => {
  const { EveHomeKitTypes } = await import( 'homebridge-lib/EveHomeKitTypes' );
  global.HomebridgeAPI = homebridge;
  global.cachedAccessories = [];
  global.eve = new EveHomeKitTypes( homebridge )
  global.HistoryService = fakegatoHistory( homebridge );

  global.Service = homebridge.hap.Service;
  global.Accessory = homebridge.hap.Accessory;
  global.Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform("homebridge-broadlink-rm", "BroadlinkRM", BroadlinkRMPlatform);
}
