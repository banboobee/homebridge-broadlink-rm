const { expect } = require('chai');
const delayForDuration = require('../helpers/delayForDuration');

const { getDevices } = require('./helpers/setup');

describe('Broadlink device', () => {

  it('discover', async () => {
    const config = {};
    const {platform, device, log, broadlink} = await getDevices(config);
    
    await delayForDuration(1.5);

    const devices = Object.keys(broadlink.devices);
    console.log('\tFound', devices.length, 'broadlink devices:');
    devices.forEach(async (device) => {
      const host = broadlink.devices[device].host;
      const {name, lock} = await broadlink.devices[device].getDeviceName(0);
      const v = await broadlink.devices[device].getFWversion(0);
      console.log(`\t${host.macAddress} ${host.address} ${broadlink.devices[device].model} (v${v})\t${name} (${lock ? 'locked' : 'unlocked'})`);
    });
    await delayForDuration(1);

    broadlink.close();	// No device pollings due to null config.
  }).timeout(3000);

})
