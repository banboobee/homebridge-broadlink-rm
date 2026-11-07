const BroadlinkRMPlatform = require('./platform');

module.exports = async (homebridge) => {
  homebridge.registerPlatform("homebridge-broadlink-rm", "BroadlinkRM", BroadlinkRMPlatform);
}
