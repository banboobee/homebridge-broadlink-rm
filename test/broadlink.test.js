const { expect } = require('chai');

const { setup, getDevices } = require('./helpers/setup');
const delayForDuration = require('../helpers/delayForDuration');

describe.skip('Broadlink device', () => {

  it('discover', async () => {
    const config = {
      deviceDiscoveryTimeout: 3
    };
    const {broadlink} = await getDevices(config);
    
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

  it('re-discover', async () => {
    const { platform, log } = setup();
    const {broadlink} = await getDevices({logLevel: 'trace'}, false);
    const config = {
      timeout: 0.1,
      logLevel: 'debug'
    };
    const discoveryAccessory = new platform.classTypes['discover-device'](log, config, platform);

    discoveryAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.1);
    expect(discoveryAccessory.state.switchState).to.equal(true);
    discoveryAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    await delayForDuration(0.1);
    expect(discoveryAccessory.state.switchState).to.equal(true);
    await delayForDuration(5);
    expect(discoveryAccessory.state.switchState).to.equal(false);

    discoveryAccessory.serviceManager.setCharacteristic(Characteristic.On, true);

    await delayForDuration(5.1);
    expect(discoveryAccessory.state.switchState).to.equal(false);
    
    broadlink.close();
  }).timeout(11000);

  it('multiple discover instances', async () => {
    const { platform, log } = setup();
    const {broadlink} = await getDevices({logLevel: 'trace'}, false);
    const discoveryAccessory1 = new platform.classTypes['discover-device'](
      log,
      {
	name: 'discover1',
	timeout: 0.1,
	logLevel: 'debug'
      },
      platform);
    const discoveryAccessory2 = new platform.classTypes['discover-device'](
      log,
      {
	name: 'discover2',
	timeout: 0.1,
	logLevel: 'debug'
      },
      platform);

    discoveryAccessory1.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(1);
    discoveryAccessory2.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.1);
    expect(discoveryAccessory1.state.switchState).to.equal(true);
    expect(discoveryAccessory2.state.switchState).to.equal(false);
    await delayForDuration(4);
    expect(discoveryAccessory1.state.switchState).to.equal(false);
    
    broadlink.close();
  }).timeout(6000);
})
