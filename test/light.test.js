const { expect } = require('chai');

const { setup } = require('./helpers/setup');
const { getAccessories } = require('./helpers/setup');
const { MQTTpublish } = require('./helpers/setup');
const { MQTTtest } = require('./helpers/setup');
const ping = require('./helpers/fakePing');
const hexCheck = require('./helpers/hexCheck');

const delayForDuration = require('../helpers/delayForDuration');

const data = {
  on: 'ON',
  off: 'OFF',
  brightness5: 'BRIGHTNESS5',
  brightness10: 'BRIGHTNESS10',
  brightness20: 'BRIGHTNESS20',
  brightness30: 'BRIGHTNESS30',
  brightness40: 'BRIGHTNESS40',
  hue5: 'HUE5',
  hue10: 'HUE10',
  hue20: 'HUE20',
  hue30: 'HUE30',
  hue40: 'HUE40',
}

const defaultConfig = {
  name: 'Light',
  type: 'light',
  data,
  isUnitTest: true,
  persistState: false
};

describe('lightAccessory', async () => {

  const MQTTready = await MQTTtest();
  
  // Light Turn On
  it('turns on', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.1
    }
    
    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.3);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('ON');
    expect(hasSentCode).to.equal(true);

    // Check that defaultBrightness was used (default 100);
    expect(lightAccessory.state.brightness).to.equal(100);
    expect(lightAccessory.state.switchState).to.equal(true);
    
    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'BRIGHTNESS40' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  }).timeout(3000);


  // Light Turn On then Off
  it('turns off', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      pingGrace: 0.1,
      host: device.host.address
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);

    // Turn On Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(true);
    
    // Turn Off Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(false);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes(['OFF', 'ON', 'BRIGHTNESS40' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(3);
  });


  // Last Known Brightness
  it('"useLastKnownBrightness" : true', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      onDelay: 0.1,
      useLastKnownBrightness: true,
      pingGrace: 0.1,
      host: device.host.address
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);

    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 20);
    await delayForDuration(0.2);
    expect(lightAccessory.state.brightness).to.equal(20);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    let hasSentCodes = device.hasSentCodes([ 'ON', 'BRIGHTNESS20' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that 2 codes have been sent
    let sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
    
    // Turn Off Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(false);

    // Check hex code was sent
    hasSentCodes = device.hasSentCodes(['OFF', 'ON', 'BRIGHTNESS20' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that 3 codes have been sent
    sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(3);

    // Turn On Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(true);

    expect(lightAccessory.state.switchState).to.equal(true);
    expect(lightAccessory.state.brightness).to.equal(20);

    // Check that all required codes have been sent
    sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(5);
  });


  // Default Brightness
  it('"useLastKnownBrightness": false', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      onDelay: 0.1,
      pingGrace: 0.1,
      host: device.host.address
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);

    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 20);
    await delayForDuration(0.2);
    expect(lightAccessory.state.brightness).to.equal(20);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    let hasSentCodes = device.hasSentCodes([ 'ON', 'BRIGHTNESS20' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    let sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
    
    // Turn Off Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(false);

    // Check hex code was sent
    hasSentCodes = device.hasSentCodes(['OFF', 'ON', 'BRIGHTNESS20' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(3);

    // Turn On Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(true);
    expect(lightAccessory.state.brightness).to.equal(100);

    // Check hex code was sent
    hasSentCodes = device.hasSentCodes(['OFF', 'ON', 'BRIGHTNESS20', 'BRIGHTNESS40' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that all required codes have been sent
    sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(5);
  });


  // Auto Off
  it('"enableAutoOff": true, "onDuration": 1', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      enableAutoOff: true,
      pingGrace: 0.1,
      onDuration: 1
    }
    
    const lightAccessory = new platform.classTypes['light'](log, config, platform);

    // Turn On Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Wait for onDelay
    await delayForDuration(0.4);

    // Expecting "on" after 0.4s total
    expect(lightAccessory.state.switchState).to.equal(true);
    
    await delayForDuration(0.9);

    // Expecting "off" after 1.3s total
    expect(lightAccessory.state.switchState).to.equal(false);
  }).timeout(4000);


  // Auto On
  it('"enableAutoOn": true, "offDuration": 1', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      enableAutoOn: true,
      pingGrace: 0.1,
      offDuration: 1
    }
    
    const lightAccessory = new platform.classTypes['light'](log, config, platform);

    // Turn On Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Turn Off Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    await delayForDuration(0.2);
    expect(lightAccessory.state.switchState).to.equal(false);

    // Expecting off after 0.4s
    await delayForDuration(0.4);
    expect(lightAccessory.state.switchState).to.equal(false);
    
    await delayForDuration(0.7);

    // Expecting on after 1.1s total
    expect(lightAccessory.state.switchState).to.equal(true);
  }).timeout(4000);


  // Set Brightness
  it('brightness set to 20', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.1
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 20);
    await delayForDuration(0.2);
    expect(lightAccessory.state.brightness).to.equal(20);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'BRIGHTNESS20' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });

  it('brightness set to 32 (closest 30)', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.1
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 32);
    await delayForDuration(0.2);
    expect(lightAccessory.state.brightness).to.equal(32);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'BRIGHTNESS30' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });

  it('brightness set to 36 (closest 40)', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.1
    }
    
    

    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 36);
    await delayForDuration(0.2);
    expect(lightAccessory.state.brightness).to.equal(36);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'BRIGHTNESS40' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });


  // Set HUE
  it('hue set to 20', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.1
    }
    
    

    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Hue, 20);
    await delayForDuration(0.2);
    expect(lightAccessory.state.hue).to.equal(20);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'HUE20' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });

  it('hue set to 32 (closest 30)', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.1
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Hue, 32);
    await delayForDuration(0.2);
    expect(lightAccessory.state.hue).to.equal(32);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'HUE30' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });

  it('hue set to 36 (closest 40)', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.1
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Hue, 36);
    await delayForDuration(0.2);
    expect(lightAccessory.state.hue).to.equal(36);

    // Check hex code was sent
    const hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'HUE40' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });


  // onDelay
  it('"onDelay": 0.5', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      onDelay: 0.5
    }

    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 20);
    await delayForDuration(0.2);
    expect(lightAccessory.state.brightness).to.equal(20);

    // Check hex code was sent
    let hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    let sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);

    // Check onDelay some time after default (0.1) but before the config option
    // await delayForDuration(0.2);

    // Check hex code was sent
    hasSentCode = device.hasSentCodes([ 'ON' ]);
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);

    // Wait for onDelay timeout (total 0.6s)
    await delayForDuration(0.4);

    // Check hex code was sent
    const hasSentCodes = device.hasSentCodes([ 'ON', 'BRIGHTNESS20' ]);
    expect(hasSentCodes).to.equal(true);

    // Check that only two codes have been sent
    sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });


  // Persist State
  it('"persistState": true', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      name: 'Unit Test Light',
      pingGrace: 0.1,
      persistState: true
    }
    
    let lightAccessory

    // Turn On Light
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Should still be on when loading within a new instance
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    expect(lightAccessory.state.switchState).to.equal(true);
    
    // Turn Off Light
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    expect(lightAccessory.state.switchState).to.equal(false);

    // Should still be off when loading within a new instance
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    expect(lightAccessory.state.switchState).to.equal(false);
  });

  it('"persistState": false', async () => {
        const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      pingGrace: 0.1,
      name: 'Unit Test Light'
    }
    
    let lightAccessory

    // Turn On Light
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Should be off again with a new instance
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    expect(lightAccessory.state.switchState).to.equal(undefined);
  });


  // Ensure the hex is resent after reload
  it('"resendHexAfterReload": true, "persistState": true', async () => {
    const { platform, device, log } = setup();

    
    const config = {
      ...defaultConfig,
      host: device.host.address,
      persistState: true,
      onDelay: 0.1,
      pingGrace: 0.1,
      resendHexAfterReload: true,
      resendDataAfterReloadDelay: 0.1
    }

    let lightAccessory;

    // Turn On Light
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Wait for resendDataAfterReloadDelay and onDelay
    await delayForDuration(0.3);

    device.resetSentHexCodes();
    
    // Check that no code has been sent
    let sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(0);

    // Should be on still with a new instance
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    expect(lightAccessory.state.switchState).to.equal(true);

    // We should find that setCharacteristic has been called after a duration of resendHexAfterReloadDelay
    await delayForDuration(0.2);

    // Wait for onDelay
    await delayForDuration(0.2);

    expect(lightAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(true);

    // Check ON hex code was sent
    const hasSentOnCode = device.hasSentCode('ON');
    expect(hasSentOnCode).to.equal(true);

    // Check that only one code has been sent
    sentHexCodeCount = device.getSentHexCodeCount();
    // expect(sentHexCodeCount).to.equal(2);	// including brightness?
    expect(sentHexCodeCount).to.equal(1);
  }).timeout(2000);


  // Ensure the hex is not resent after reload
  it('"resendHexAfterReload": false, "persistState": true', async () => {
    const { platform, device, log } = setup();


    const config = {
      ...defaultConfig,
      host: device.host.address,
      persistState: true,
      pingGrace: 0.1,
      resendHexAfterReload: false,
      resendDataAfterReloadDelay: 0.1
    }
    
    let lightAccessory

    // Turn On Light
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Wait for resendDataAfterReloadDelay
    await delayForDuration(0.3);

    device.resetSentHexCodes();

    // Should be on still with a new instance
    lightAccessory = new platform.classTypes['light'](log, config, platform);
    expect(lightAccessory.state.switchState).to.equal(true);

    // We should find that setCharacteristic has not been called after a duration of resendHexAfterReloadDelay
    await delayForDuration(0.3);
    expect(lightAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(false);

    // Check ON hex code was not sent
    const hasSentOnCode = device.hasSentCode('ON');
    expect(hasSentOnCode).to.equal(false);

    // Check that no code was sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(0);
  });

  it('ColorTemperature+/-, Brightness+/-', async () => {
    const { platform, device, log } = setup();

    const config = {
      name: 'Light',
      type: 'light',
      isUnitTest: true,
      logLevel: 'trace',
      persistState: false,
      defaultBrightness: 100,
      defaultColorTemperature: 140,
      onDelay: 0.1,
      data: {
        availableBrightnessSteps: 3,
        'brightness+': 'BRIGHTNESS+',
        'brightness-': 'BRIGHTNESS-',
	availableColorTemperatureSteps: 5,
	'colorTemperature+': 'COLORTEMPERATURE+',
	'colorTemperature-': 'COLORTEMPERATURE-',
        "on": 'ON',
        "off": 'OFF'
      },
      host: device.host.address,
      pingGrace: 0.1
    }
    
    // Turn On Light
    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    device.setFailureResponseOnSendData('random');

    lightAccessory.serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.1);
    
    lightAccessory.serviceManager.setCharacteristic(Characteristic.ColorTemperature, 500);
    await delayForDuration(0.1);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.ColorTemperature, 320);
    await delayForDuration(0.1);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.ColorTemperature, 400);
    await delayForDuration(0.1);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.ColorTemperature, 140);

    await delayForDuration(1.3);
    // device.resetSentHexCodes();

    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 70);
    await delayForDuration(0.1);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 90);
    await delayForDuration(0.1);
    lightAccessory.serviceManager.setCharacteristic(Characteristic.Brightness, 30);
    
    await delayForDuration(0.2);
    // No expected values due to random fails.
    // expect(lightAccessory.state.brightness).to.equal(90);
    // hexCheck({ device,
    // 	       codes: ['BRIGHTNESS-', 'BRIGHTNESS-',
    // 		       'BRIGHTNESS+', 'BRIGHTNESS+'
    // 		      ],
    // 	       count: 4});

  }).timeout(3000);

  (MQTTready ? it : it.skip)('"mqttStateOnly": false', async () => {
    const { platform, device, log } = setup();
    const config = {
      ...defaultConfig,
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "On",
          "topic": "homebridge-broadlink-rm/UT/On"
        },
        {
          "identifier": "Brightness",
          "topic": "homebridge-broadlink-rm/UT/Brightness"
        }
      ],
      pingGrace: 0.1,
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      mqttStateOnly: false,
      host: device.host.address
    };
    
    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    await delayForDuration(0.3);
    
    MQTTpublish(log, 'On', 'true');
    MQTTpublish(log, 'Brightness', 1);
    await delayForDuration(0.3);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Check hex codes were sent
    hexCheck({ device,
	       codes: [
		 'ON', 'BRIGHTNESS5'
	       ],
	       count: 2
	     });

    lightAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttStateOnly": true', async () => {
    const { platform, device, log } = setup();
    const config = {
      name: 'Light',
      type: 'light',
      data: {
	on: 'ON',
	off: 'OFF',
	brightness5: 'BRIGHTNESS5',
	brightness40: 'BRIGHTNESS40'
      },
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "On",
          "topic": "homebridge-broadlink-rm/UT/On"
        },
        {
          "identifier": "Brightness",
          "topic": "homebridge-broadlink-rm/UT/Brightness"
        }
      ],
      pingGrace: 0.1,
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      mqttStateOnly: true,
      host: device.host.address
    };
    
    const lightAccessory = new platform.classTypes['light'](log, config, platform);
    await delayForDuration(0.3);
    
    MQTTpublish(log, 'On', 'true');
    MQTTpublish(log, 'Brightness', 1);
    await delayForDuration(0.3);
    expect(lightAccessory.state.switchState).to.equal(true);

    // Check hex codes were sent
    hexCheck({ device,
	       codes: [
	       ],
	       count: 0
	     });

    lightAccessory.mqttClient.end();
  });
  
  it('exclusives', async () => {
    const config = {
      isUnitTest: true,
      hideScanFrequencyButton: true,
      disableLogs: true,
      hideLearnButton: true,
      accessories: [
        {
          name: 'Light1',
          type: 'light',
	  persistState: false,
	  logLevel: 'trace',
	  pingGrace: 0.1,
	  data: {
	      on: 'ON@LIGHT1',
	      off: 'OFF@LIGHT1',
	      brightness5: 'BRIGHTNESS5@LIGHT1',
	      brightness40: 'BRIGHTNESS40@LIGHT1'
	  }
        },
        {
          name: 'Light2',
          type: 'light',
	  persistState: false,
	  logLevel: 'trace',
	  pingGrace: 0.1,
	  exclusives: [
	    "Light1"
	  ],
	  data: {
	      on: 'ON@LIGHT2',
	      off: 'OFF@LIGHT2',
	      brightness5: 'BRIGHTNESS5@LIGHT2',
	      brightness40: 'BRIGHTNESS40@LIGHT2'
	  }
        }
      ]
    };
    
    const {platform, device, log, accessories} = await getAccessories(config);
    accessories[0].serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.3);
    expect(accessories[0].state.switchState).to.equal(true);

    
    accessories[1].serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.3);
    expect(accessories[0].state.switchState).to.equal(false);
    expect(accessories[1].state.switchState).to.equal(true);

    accessories[0].serviceManager.setCharacteristic(Characteristic.On, true);
    await delayForDuration(0.3);
    expect(accessories[0].state.switchState).to.equal(true);
    expect(accessories[1].state.switchState).to.equal(false);

    // await delayForDuration(0.9);

    // Check hex codes were sent
    hexCheck({ device,
	       codes: [
		 'ON@LIGHT1', 'BRIGHTNESS40@LIGHT1',
		 'ON@LIGHT2', 'BRIGHTNESS40@LIGHT2',
		 'ON@LIGHT1', 'BRIGHTNESS40@LIGHT1'
	       ],
	       count: 6
	     });
  });

})
