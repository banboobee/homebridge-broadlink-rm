import BroadlinkRMPlatform from './platform.js';

export default async (homebridge) => {
  homebridge.registerPlatform("homebridge-broadlink-rm", "BroadlinkRM", BroadlinkRMPlatform);
}
