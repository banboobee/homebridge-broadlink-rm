const BroadlinkRMPlatform = require('./platform');
const fakegatoHistory = require( 'fakegato-history');

module.exports = async (homebridge) => {
  const { EveHomeKitTypes } = await import( 'homebridge-lib/EveHomeKitTypes' );
  global.eve = new EveHomeKitTypes( homebridge )
  global.HistoryService = fakegatoHistory( homebridge );

  homebridge.registerPlatform("homebridge-broadlink-rm", "BroadlinkRM", BroadlinkRMPlatform);
}
