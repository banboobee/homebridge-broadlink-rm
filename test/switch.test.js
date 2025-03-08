const { expect } = require('chai');
const { MQTTpublish } = require('./helpers/setup');
const { MQTTtest } = require('./helpers/setup');
const hexCheck = require('./helpers/hexCheck');

const { setup } = require('./helpers/setup');
const ping = require('./helpers/fakePing');

const delayForDuration = require('../helpers/delayForDuration');

const data = {
  on: 'ON',
  off: 'OFF'
}

// TODO: Check cancellation of timeouts

describe('switchAccessory', async function() {

  const MQTTready = await MQTTtest();
  
  let switchAccessory;

  afterEach(function() {
    switchAccessory?.mqttClient?.end();
  })

  it('check config', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'DEBUG',
      pingGrace: 0.1,
      persistState: 'false',
      enableAutoOn: true,
      noHistory: 'false',
      host: device.host.address,
      mqttTopic: [
	{
          identifier: "on",
          topic: "homebridge-broadlink-rm/UT/on"
	},
	{
          identifier: "off",
          topic: "homebridge-broadlink-rm/UT/on"
	},
	{
          topic: "homebridge-broadlink-rm/UT/on"
	},
	{
          identifier: "on",
          topic: "homebridge-broadlink-rm/UT/on",
	  characteristic: 'on',
	  
	},
      ]
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
     await delayForDuration(0.1);
  });

  // Switch Turn On
  it('turns on', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address
    }
    
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    
    await delayForDuration(0.1);

    expect(switchAccessory.state.switchState).to.equal(true);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('ON');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Switch Turn On then Off
  it('turns off', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);

    // Turn On Switch
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.1);

    expect(switchAccessory.state.switchState).to.equal(true);
    
    // Turn Off Switch
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    await delayForDuration(0.1);

    expect(switchAccessory.state.switchState).to.equal(false);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'OFF' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });


  // Auto Off
  it('"enableAutoOff": true, "onDuration": 1', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      enableAutoOff: true,
      onDuration: 1
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);


    // Turn On Switch
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(switchAccessory.state.switchState).to.equal(true);

    await delayForDuration(0.4);
    // Expecting on after 0.4s total
    expect(switchAccessory.state.switchState).to.equal(true);
    
    await delayForDuration(0.7);
    // Expecting off after 1.1s total
    expect(switchAccessory.state.switchState).to.equal(false);
  }).timeout(4000);


  // Auto On
  it('"enableAutoOn": true, "offDuration": 1', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      enableAutoOn: true,
      offDuration: 1
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);

    // Turn On Switch
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(switchAccessory.state.switchState).to.equal(true);

    // Turn Off Switch
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    expect(switchAccessory.state.switchState).to.equal(false);

    await delayForDuration(0.4);
    // Expecting off after 0.4s total
    expect(switchAccessory.state.switchState).to.equal(false);
    
    await delayForDuration(0.7);
    // Expecting on after 1.1s total
    expect(switchAccessory.state.switchState).to.equal(true);
  }).timeout(4000);


  // Persist State
  it('"persistState": true', async function() {
    const { platform, device, log } = setup();

    const config = {
      data,
      host: device.host.address,
      name: 'Unit Test Switch',
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: true
    }
    
    let switchAccessory

    // Turn On Switch
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(switchAccessory.state.switchState).to.equal(true);

    // Should still be on when loading within a new instance
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(true);
    
    // Turn Off Switch
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    expect(switchAccessory.state.switchState).to.equal(false);

    // Should still be off when loading within a new instance
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(false);
  });

  it('"persistState": false', async function() {
    const { platform, device, log } = setup();

    const config = {
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      name: 'Unit Test Switch'
    }
    
    let switchAccessory

    // Turn On Switch
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(switchAccessory.state.switchState).to.equal(true);

    // Should be off again with a new instance
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(undefined);
  });


  // IP Address used to for state
  it('"pingIPAddress": "192.168.1.1", host up', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      pingIPAddress: '192.168.1.1',
      isUnitTest: true
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    const pingInterval = switchAccessory.checkPing(ping.bind({ isActive: true }));

    await delayForDuration(0.3);
    expect(switchAccessory.state.switchState).to.equal(true);

    // Stop the ping setInterval
    clearInterval(pingInterval);
  });

  it('"pingIPAddress": "192.168.1.1", host down', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      pingIPAddress: '192.168.1.1',
      isUnitTest: true
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(undefined);
    
    const pingInterval = switchAccessory.checkPing(ping.bind({ isActive: false }));

    await delayForDuration(0.3);
    expect(switchAccessory.state.switchState).to.equal(false);

    // Stop the ping setInterval
    clearInterval(pingInterval);
  });

  it('"pingIPAddressStateOnly": true, "pingIPAddress": "192.168.1.1", host up', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      pingIPAddress: '192.168.1.1',
      pingIPAddressStateOnly: true,
      isUnitTest: true
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(undefined);
    
    const pingInterval = switchAccessory.checkPing(ping.bind({ isActive: true }));

    await delayForDuration(0.3);
    expect(switchAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(false);
    expect(switchAccessory.state.switchState).to.equal(true);

    // Stop the ping setInterval
    clearInterval(pingInterval);
  });

  it('"pingIPAddressStateOnly": false, "pingIPAddress": "192.168.1.1", host up', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      pingIPAddress: '192.168.1.1',
      pingIPAddressStateOnly: false,
      isUnitTest: true
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(undefined);
    
    const pingInterval = switchAccessory.checkPing(ping.bind({ isActive: true }));

    await delayForDuration(0.3);
    expect(switchAccessory.state.switchState).to.equal(true);
    expect(switchAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(true);

    // Stop the ping setInterval
    clearInterval(pingInterval);
  });


  // Ensure the hex is resent after reload
  it('"resendHexAfterReload": true, "persistState": true', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      type: 'switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: true,
      host: device.host.address,
      resendHexAfterReload: true,
      resendHexAfterReloadDelay: 0.1,
      isUnitTest: true
    }
    
    let switchAccessory

    // Turn On Switch
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.1);
    expect(switchAccessory.state.switchState).to.equal(true);

    device.resetSentHexCodes();

    // Should be on still with a new instance
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(true);

    // We should find that setCharacteristic has been called after a duration of resendHexAfterReloadDelay
    await delayForDuration(0.3);
    expect(switchAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(true);

    // Check ON hex code was sent
    const hasSentOnCode = device.hasSentCode('ON');
    expect(hasSentOnCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Ensure the hex is not resent after reload
  it('"resendHexAfterReload": false, "persistState": true', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      type: 'switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: true,
      host: device.host.address,
      resendHexAfterReload: false,
      resendHexAfterReloadDelay: 0.1,
      isUnitTest: true
    }

    let switchAccessory

    // Turn On Switch
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.1);
    expect(switchAccessory.state.switchState).to.equal(true);

    // Should be on still with a new instance
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    expect(switchAccessory.state.switchState).to.equal(true);

    device.resetSentHexCodes();

    // We should find that setCharacteristic has not been called after a duration of resendHexAfterReloadDelay
    await delayForDuration(0.3);
    expect(switchAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(false);

    // Check ON hex code was not sent
    const hasSentOnCode = device.hasSentCode('ON');
    expect(hasSentOnCode).to.equal(false);

    // Check that no code was sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(0);
  });
  
  (MQTTready ? it : it.skip)('"mqttStateOnly": true', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      mqttStateOnly: true,
      mqttURL: "mqtt://localhost",
      mqttTopic: [
	{
          "identifier": "on",
          "topic": "homebridge-broadlink-rm/UT/on"
	},
      ]
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    await delayForDuration(0.1);
    
    await MQTTpublish(log, 'on', 'true');
    await delayForDuration(0.1);
    expect(switchAccessory.state.switchState).to.equal(true);

    switchAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttStateOnly": false', async function() {
    const { platform, device, log } = setup();

    const config = {
      name: 'Switch',
      data,
      logLevel: 'trace',
      pingGrace: 0.1,
      persistState: false,
      host: device.host.address,
      mqttStateOnly: false,
      mqttURL: "mqtt://localhost",
      mqttTopic: [
	{
          "identifier": "on",
          "topic": "homebridge-broadlink-rm/UT/on"
	},
      ]
    }
    
    switchAccessory = new platform.classTypes['switch'](log, config, platform);
    await delayForDuration(0.1);
    
    MQTTpublish(log, 'on', true);
    await delayForDuration(0.1);
    expect(switchAccessory.state.switchState).to.equal(true);
    await delayForDuration(0.1);
    MQTTpublish(log, 'on', false);
    await delayForDuration(0.1);
    expect(switchAccessory.state.switchState).to.equal(false);

    // Check hex codes were sent
    hexCheck({ device,
	       codes: [
		 'ON',
		 'OFF'
	       ],
	       count: 2
	     });

    switchAccessory.mqttClient.end();
  });
})
