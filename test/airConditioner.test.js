const { expect } = require('chai');

const { setup } = require('./helpers/setup');
const { getAccessories } = require('./helpers/setup');
const { MQTTpublish } = require('./helpers/setup');
const { MQTTtest } = require('./helpers/setup');
const hexCheck = require('./helpers/hexCheck');
const delayForDuration = require('../helpers/delayForDuration');

const data = {
  on: 'ON',
  off: 'OFF',
  temperature16: {
    'pseudo-mode': 'cool',
    'data': 'TEMPERATURE_16'
  },
  temperature18: {
    'pseudo-mode': 'cool',
    'data': 'TEMPERATURE_18'
  },
  temperature23: {
    'pseudo-mode': 'heat',
    'data': 'TEMPERATURE_23'
  },
  temperature26: {
    'pseudo-mode': 'heat',
    'data': 'TEMPERATURE_26'
  },
  temperature30: {
    'pseudo-mode': 'heat',
    'data': 'TEMPERATURE_30'
  }
};

const defaultConfig = {
  name: 'AirConditioner',
  data,
  replaceAutoMode: 'cool',
  logLevel: 'trace',
  noHistory: true,
  isUnitTest: true,
  allowResend: false,
  persistState: false
};

describe('airConAccessory', async function() {

  const MQTTready = await MQTTtest();
  
  let airConAccessory;

  afterEach(function() {
    airConAccessory?.mqttClient?.end();
  })

  it ('default config', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address

    const config = {
      ...defaultConfig
    };
    
    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    expect(airConAccessory.config.turnOnWhenOff).to.equal(false);
    expect(airConAccessory.config.minimumAutoOnOffDuration).to.equal(120);
    expect(airConAccessory.config.minTemperature).to.equal(10);
    expect(airConAccessory.config.maxTemperature).to.equal(38);
    expect(airConAccessory.config.tempStepSize).to.equal(1);
    expect(airConAccessory.config.units).to.equal('c');
    expect(airConAccessory.config.temperatureUpdateFrequency).to.equal(300);
    expect(airConAccessory.config.temperatureAdjustment).to.equal(0);
    expect(airConAccessory.config.defaultCoolTemperature).to.equal(16);
    expect(airConAccessory.config.defaultHeatTemperature).to.equal(30);
    expect(airConAccessory.config.heatTemperature).to.equal(22);
    expect(airConAccessory.config.replaceAutoMode).to.equal('cool');
  });

  it('custom config', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address

    const config = {
      ...defaultConfig,
      turnOnWhenOff: true,
      minimumAutoOnOffDuration: 60,
      minTemperature: 2,
      maxTemperature: 36,
      tempStepSize: 0.5,
      units: 'f',
      temperatureUpdateFrequency: 20,
      temperatureAdjustment: 1,
      defaultCoolTemperature: 17,
      defaultHeatTemperature: 32,
      heatTemperature: 20,
      replaceAutoMode: 'heat'
    };
    
    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    
    expect(airConAccessory.config.turnOnWhenOff).to.equal(true);
    expect(airConAccessory.config.minimumAutoOnOffDuration).to.equal(60);
    expect(airConAccessory.config.minTemperature).to.equal(2);
    expect(airConAccessory.config.maxTemperature).to.equal(36);
    expect(airConAccessory.config.tempStepSize).to.equal(0.5);
    expect(airConAccessory.config.units).to.equal('f');
    expect(airConAccessory.config.temperatureUpdateFrequency).to.equal(20);
    expect(airConAccessory.config.temperatureAdjustment).to.equal(1);
    expect(airConAccessory.config.defaultCoolTemperature).to.equal(17);
    expect(airConAccessory.config.defaultHeatTemperature).to.equal(32);
    expect(airConAccessory.config.heatTemperature).to.equal(20);
    expect(airConAccessory.config.replaceAutoMode).to.equal('heat');
  });


  it('missing data', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      logLevel: 'info',
    };
    delete config.data;

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set heat
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
  });

  it('missing HEX', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      data: {},
      logLevel: 'info',
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set heat
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
  });

  it('check config', async () => {
    const { platform, device, log } = setup();
    
    const config1 = {
      allowResend: 'false',	// ERROR
      unknown: true,		// DEBUG
      name: 'AirConditioner1',
      replaceAutoMode: 'cold',	// ERROR
      logLevel: 'trace',
      noHistory: true,
      persistState: 'false',	// ERROR
      data: {
	on: 'ON',
	off: [
	  {pause: '0.1'},	// ERROR
	  {sendCount: '2',	// ERROR
	   eval: "targetHeatingCoolingState === 1 ? 'HEAT_OFF' : (targetHeatingCoolingState === 2 ? 'COOL_OFF' : 'OFF')",
	   interval: '0.2',	// ERROR
	   pause: 0.1,
	   unknown: 0		// DEBUG
	  }
	],
	'temperature1,6': {	// ERROR
	  'pseudo-mode': 'cool',
	  'data': 'TEMPERATURE_16'
	},
	temperature18: {
	  'pseudo-mode': 'auto',// ERROR
	  'data': 'TEMPERATURE_18'
	},
	temperature19: {
	  'pseudo-mode': 'cool',
	  'data': [
	    {data: 'TEMPERATURE_19'}
	  ]
	},
	cool20: {		// ERROR
	  'pseudo-mode': 'cool',
	  'data': 'TEMPERATURE_20'
	},
	heat21: [		// ERROR
	  {pause: 1},
	],
	heat22: [		// ERROR
	  {interval: 1},
	  {sendCount: 1},
	  {data: 'TEMPERATURE_22'}
	],
	temperature23: {
	  'pseudo-mode': 'heat',
	  'data': 23		// ERROR
	},
	temperature25: {
	  'pseudo-mode': 'heat',
	  'data': [
	    {
	      unkown: true,	// DEBUG
	      data: 'TEMPERATURE_25'
	    }
	  ]
	},
	temperature26: 'TEMPERATURE_26', // ERROR
	temperature27: {	// ERROR
	  // 'pseudo-mode': 'heat',
	  'data': 'TEMPERATURE_27'
	},
	temperature28: {	// ERROR
	  'pseudo-mode': 'heat',
	  // 'data': 'TEMPERATURE_27'
	},
	temperature30: {
	  'pseudo-mode': 'hot',	// ERROR
	  'data': 'TEMPERATURE_30'
	}
      },
    };
    airConAccessory = new platform.classTypes['air-conditioner'](log, config1, platform);
    await delayForDuration(0.1);

    const config2 = {
      ...defaultConfig,
      name: 'AirConditioner2',
      // mqttURL: "mqtt://localhost",
      mqttTopic:"homebridge-broadlink-rm/UT/x",		// NO ERROR
    };
    airConAccessory = new platform.classTypes['air-conditioner'](log, config2, platform);
    await delayForDuration(0.1);

    const config3 = {
      ...defaultConfig,
      // mqttURL: "mqtt://localhost",
      name: 'AirConditioner3',
      mqttTopic: [
        {
          identifier: "x",
          characteristic: "targetTemperature",		// ERROR
          topic: "homebridge-broadlink-rm/UT/weather",
	  unkown: true					// ERROR
        },
        {
          identifier: "y",
          characteristic: "currentRelativeHumidity",
          topic: "homebridge-broadlink-rm/UT/weather"
        }
      ],
    };
    airConAccessory = new platform.classTypes['air-conditioner'](log, config3, platform);
    await delayForDuration(0.1);

  });

  it('turn on', async function() {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set air-con mode to "auto"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.AUTO);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_16' ], count: 1 });

    // Check `replaceAutoMode` worked as expected
    expect(airConAccessory.state.targetHeatingCoolingState).to.equal(Characteristic.TargetHeatingCoolingState.COOL);
  });

  it('turn off', async function() {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set air-con mode to "auto"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.AUTO);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_16' ], count: 1 });

    await delayForDuration(0.1);

    // Set air-con mode to "off"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_16', 'OFF' ], count: 2 });
  });


  it('set heat', async function() {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set air-con mode to "heat"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });
  });

  it('set cool', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set air-con mode to "cool"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_16' ], count: 1 });
  });


  it('set heat temperature', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set temperature
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 26);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_26' ], count: 1 });
  });

  it('set cool temperature', async function() {

    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set temperature
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 18);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_18' ], count: 1 });
  });


  it('set missing heat temperature', async function() {

    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set missing temperature
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 24);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_23' ], count: 1 });
    expect(airConAccessory.state.targetTemperature).to.equal(23);
  });

  it('set missing cool temperature 20', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set missing temperature
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_18' ], count: 1 });
    expect(airConAccessory.state.targetTemperature).to.equal(18);
  });

  it('set missing cool temperature 17', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set missing temperature
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
     airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 17);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_16' ], count: 1 });
  });

  it('"turnOnWhenOff": true', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      turnOnWhenOff: true
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set temperature
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 26);

    await delayForDuration(0.5);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_26', 'ON' ], count: 2 });
  });

  it('"allowResend": true', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      allowResend: true
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set heat
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    // Ask Siri to set temperature 30. No HEX code to be sent.
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 30);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    // Ask Siri to set heat. HEX Code to be sent.
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 2 });

    // Set OFF
    device.resetSentHexCodes();
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'OFF' ], count: 1 });

    // Ask Siri to set OFF. OFF code to be sent.
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'OFF' ], count: 2 });

    // Ask Siri to set HEAT 20c. HEX code to be sent two times.
    device.resetSentHexCodes();
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_23' ], count: 2 });

    // set OFF
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.1);

    // Ask Siri to set 29c then set HEAT. HEX code to be sent only once.
    device.resetSentHexCodes();
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 29);
    await delayForDuration(0.1);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });
  });

  it('"allowResend": false', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      allowResend: false
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set heat
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    // Ask Siri to set temperature 30. No HEX code to be sent.
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 30);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    // Ask Siri to set heat. No HEX code to be sent.
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    // Set OFF
    device.resetSentHexCodes();
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'OFF' ], count: 1 });

    // Ask Siri to set OFF. No HEX code to be sent.
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'OFF' ], count: 1 });

    // Ask Siri to set HEAT 20c. HEX code to be sent only once.
    device.resetSentHexCodes();
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_23' ], count: 1 });

    // set OFF
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.1);

    // Ask Siri to set 29c then set HEAT. HEX code to be sent only once.
    device.resetSentHexCodes();
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 29);
    await delayForDuration(0.1);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });
  });

  it('auto-heat & "minimumAutoOnOffDuration": 0.5', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      autoHeatTemperature: 18,
      autoCoolTemperature: 27,
      minimumAutoOnOffDuration: 1
    };

    new platform.classTypes['air-conditioner'](log, config, platform);

    device.sendFakeOnCallback('temperature', 17)

    await delayForDuration(0.3);
    
    // Check auto-on was performed by ensuring hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    // Test `minimumAutoOnOffDuration` by forcing auto-on/off check with a normal temperature
    // Use a temperature lower than `autoCoolTemperature` so that the air-con should automatically turn off
    await delayForDuration(0.3);

    // airConAccessory.updateTemperatureUI();
    
    device.sendFakeOnCallback('temperature', 23)
    
    await delayForDuration(0.3);
    
    // No more hex codes should have been sent yet due to `minimumAutoOnOffDuration`
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    await delayForDuration(0.3);
    
    // Try forcing auto-on/off again with a normal temperature
    // airConAccessory.updateTemperatureUI();

    device.sendFakeOnCallback('temperature', 23)

    await delayForDuration(0.3);
    
    // auto-off should have occurred by now as 1.2s has passed
    hexCheck({ device, codes: [ 'TEMPERATURE_30', 'OFF' ], count: 2 });
  });


  it('auto-cool & "minimumAutoOnOffDuration": 0.5', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      autoHeatTemperature: 18,
      autoCoolTemperature: 27,
      minimumAutoOnOffDuration: 1
    };

    new platform.classTypes['air-conditioner'](log, config, platform);

    device.sendFakeOnCallback('temperature', 28)

    await delayForDuration(0.3);
    
    // Check auto-on was performed by ensuring hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_16' ], count: 1 });

    // Test `minimumAutoOnOffDuration` by forcing auto-on/off check with a normal temperature
    // Use a temperature lower than `autoCoolTemperature` so that the air-con should automatically turn off
    await delayForDuration(0.3);

    // airConAccessory.updateTemperatureUI();
    
    device.sendFakeOnCallback('temperature', 26)
    
    await delayForDuration(0.3);
    
    // No more hex codes should have been sent yet due to `minimumAutoOnOffDuration`
    hexCheck({ device, codes: [ 'TEMPERATURE_16' ], count: 1 });

    await delayForDuration(0.3);
    
    // Try forcing auto-on/off again with a normal temperature
    // airConAccessory.updateTemperatureUI();

    device.sendFakeOnCallback('temperature', 26)

    await delayForDuration(0.3);
    
    // auto-off should have occurred by now as 1.2s has passed
    hexCheck({ device, codes: [ 'TEMPERATURE_16', 'OFF' ], count: 2 });
  });


  it ('"pseudoDeviceTemperature": 2', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      pseudoDeviceTemperature: 10
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    airConAccessory.getCurrentTemperature();

    await delayForDuration(0.1);

    device.sendFakeOnCallback('temperature', 20);

    const temperature = airConAccessory.serviceManager.getCharacteristic(Characteristic.CurrentTemperature).value;

    expect(temperature).to.equal(10);
  });


  it ('"temperatureAdjustment": 10', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      temperatureAdjustment: 10
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    await delayForDuration(0.1);

    device.sendFakeOnCallback('temperature', 20);

    const temperature = airConAccessory.serviceManager.getCharacteristic(Characteristic.CurrentTemperature).value;

    expect(temperature).to.equal(30);
  });

  it('"temperatureAdjustment": -10', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      temperatureAdjustment: -10
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    await delayForDuration(0.1);

    device.sendFakeOnCallback('temperature', 20);

    const temperature = airConAccessory.serviceManager.getCharacteristic(Characteristic.CurrentTemperature).value;

    expect(temperature).to.equal(10);
  });

  it('"replaceAutoMode": "heat"', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      replaceAutoMode: 'heat'
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set air-con mode to "auto"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.AUTO);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    // Check `replaceAutoMode` worked as expected
    expect(airConAccessory.state.targetHeatingCoolingState).to.equal(Characteristic.TargetHeatingCoolingState.HEAT);
  });

  it('autoSwitch', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig,
      autoSwitch: 'Air-Con Auto'
    };
    
    const switchConfig = {
      ...defaultConfig,
      name: 'Air-Con Auto'
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    const switchAccessory = new platform.classTypes['switch'](log, switchConfig, platform);

    airConAccessory.updateAccessories([ switchAccessory ]);

    expect(airConAccessory.autoSwitchAccessory).to.equal(switchAccessory)
  });

  it('fail to set heat temperature', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    device.setFailureResponseOnSendData('always');

    // Set temperature
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 26);

    await delayForDuration(0.1);

    // Check hex codes were sent
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(0);
  });

  it('autoSwitch on/off ', async function() {
    const config = {
      hideScanFrequencyButton: true,
      disableLogs: true,
      hideLearnButton: true,
      accessories: [
        {
	  type: 'air-conditioner',
	  ...defaultConfig,
	  autoHeatTemperature: 18,
	  autoCoolTemperature: 27,
	  minimumAutoOnOffDuration: 1,
	  autoSwitch: 'Air-Con Auto'
        },
        {
	  name: 'Air-Con Auto',
	  type: 'switch',
	  logLevel: 'trace',
	  pingGrace: 0.1
        }
      ]
    };
    const {device, accessories} = await getAccessories(config);
    airConAccessory = accessories[0];
    const switchAccessory = accessories[1];
    
    expect(airConAccessory.autoSwitchAccessory).to.equal(switchAccessory)
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, true);

    // Check auto-on was performed by ensuring hex codes were sent
    device.sendFakeOnCallback('temperature', 17)
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30' ], count: 1 });

    await delayForDuration(1);

    // Try forcing auto-on/off again with a normal temperature
    device.sendFakeOnCallback('temperature', 23)
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30', 'OFF' ], count: 2 });

    // No more hex codes should have been sent due to disabling autoswitch
    switchAccessory.serviceManager.setCharacteristic(Characteristic.On, false);
    device.sendFakeOnCallback('temperature', 17)
    await delayForDuration(0.1);
    hexCheck({ device, codes: [ 'TEMPERATURE_30', 'OFF' ], count: 2 });

  });

  it('set auto', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      data: {
	on: 'ON',
	off: 'OFF',
	heat16: 'HEAT_16',
	heat18: 'HEAT_18',
	heat23: 'HEAT_23',
	heat26: 'HEAT_26',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool18: 'COOL_18',
	cool23: 'COOL_23',
	cool26: 'COOL_26',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto18: 'AUTO_18',
	auto23: 'AUTO_23',
	auto26: 'AUTO_26',
	auto30: 'AUTO_30'
      },
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    device.sendFakeOnCallback('temperature', 25)

    // Set air-con mode to "heat"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(1);

    // Set air-con mode to "cool"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(2);

    // Set air-con mode to "auto"
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.AUTO);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(3);
    expect(airConAccessory.serviceManager.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value).to.equal(1);

    // await delayForDuration(2);	// wait enough to settle mode and temperature

    device.sendFakeOnCallback('temperature', 20)
    await delayForDuration(0.1);
    // expect(airConAccessory.state.currentHeatingCoolingState).to.equal(2);
    expect(airConAccessory.serviceManager.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value).to.equal(1);

    device.sendFakeOnCallback('temperature', 18)
    await delayForDuration(0.1);
    // expect(airConAccessory.state.currentHeatingCoolingState).to.equal(2);
    expect(airConAccessory.serviceManager.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value).to.equal(2);

    // await delayForDuration(1.0);
  });

  it('"enableAutoOff": true', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      data: {
	// on: 'ON',
	off: 'OFF',
	heat16: 'HEAT_16',
	heat18: 'HEAT_18',
	heat23: 'HEAT_23',
	heat26: 'HEAT_26',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool18: 'COOL_18',
	cool23: 'COOL_23',
	cool26: 'COOL_26',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto18: 'AUTO_18',
	auto23: 'AUTO_23',
	auto26: 'AUTO_26',
	auto30: 'AUTO_30'
      },
      enableAutoOff: true,
      onDuration: 1,
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    device.sendFakeOnCallback('temperature', 25)

    // Set air-con mode to "cool"
    // ios 18 sends targetTemperature first then heatingCoolingState
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(2);

    await delayForDuration(1.0);
    
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(0);
  });

  (MQTTready ? it : it.skip)('"mqttStateOnly": false', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool19: 'COOL_19',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "mode",
          "topic": "homebridge-broadlink-rm/UT/mode"
        },
        {
          "identifier": "targetTemperature",
          "topic": "homebridge-broadlink-rm/UT/targetTemperature"
        }
      ],
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      mqttStateOnly: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    MQTTpublish(log, 'targetTemperature', 20);
    MQTTpublish(log, 'mode', 'cool');
    await delayForDuration(0.1);

    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(2);
    expect(airConAccessory.state.targetTemperature).to.equal(19);
    hexCheck({ device, codes: [ 'COOL_19' ], count: 1 });
    
    airConAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttStateOnly": true', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "mode",
          "topic": "homebridge-broadlink-rm/UT/mode"
        },
        {
          "identifier": "targetTemperature",
          "topic": "homebridge-broadlink-rm/UT/targetTemperature"
        }
      ],
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    MQTTpublish(log, 'targetTemperature', 20);
    MQTTpublish(log, 'mode', 'cool');
    await delayForDuration(0.1);

    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(2);
    expect(airConAccessory.state.targetTemperature).to.equal(20);
    hexCheck({ device, codes: [ ], count: 0 });
    
    airConAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttTopic": string form', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      mqttURL: "mqtt://localhost",
      mqttTopic: "homebridge-broadlink-rm/UT/x",
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    MQTTpublish(log, 'x', '{\\"temperature\\":20.5,\\"humidity\\":59}');
    await delayForDuration(0.1);
    
    expect(airConAccessory.state.currentTemperature).to.equal(20.5);
    expect(airConAccessory.state.currentHumidity).to.equal(59);

    airConAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttTopic": convenient array form', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "unknown",
          "topic": "homebridge-broadlink-rm/UT/x"
        }
      ],
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    MQTTpublish(log, 'x', '{\\"temp\\":20.5,\\"relativehumidity\\":59}');
    await delayForDuration(0.1);

    expect(airConAccessory.state.currentTemperature).to.equal(20.5);
    expect(airConAccessory.state.currentHumidity).to.equal(59);
    
    airConAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttTopic": standard array form', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "temperature",
          "topic": "homebridge-broadlink-rm/UT/temperature"
        },
        {
          "identifier": "humidity",
          "topic": "homebridge-broadlink-rm/UT/temperature"
        }
      ],
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    MQTTpublish(log, 'temperature', '{\\"temperature\\":20.5,\\"humidity\\":59}');
    await delayForDuration(0.1);
    
    expect(airConAccessory.state.currentTemperature).to.equal(20.5);
    expect(airConAccessory.state.currentHumidity).to.equal(59);

    airConAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttTopic": characteristic form', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "x",
          "characteristic": "currentTemperature",
          "topic": "homebridge-broadlink-rm/UT/weather"
        },
        {
          "identifier": "y",
          "characteristic": "currentRelativeHumidity",
          "topic": "homebridge-broadlink-rm/UT/weather"
        }
      ],
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    MQTTpublish(log, 'weather', '{\\"x\\":20.5,\\"y\\":59}');
    await delayForDuration(0.1);
    
    expect(airConAccessory.state.currentTemperature).to.equal(20.5);
    expect(airConAccessory.state.currentHumidity).to.equal(59);

    airConAccessory.mqttClient.end();
  });

  (MQTTready ? it : it.skip)('"mqttTopic": numeric form', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      mqttURL: "mqtt://localhost",
      mqttTopic: [
        {
          "identifier": "temperature",
          "topic": "homebridge-broadlink-rm/UT/temperature"
        },
        {
          "identifier": "humidity",
          "topic": "homebridge-broadlink-rm/UT/humidity"
        }
      ],
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    MQTTpublish(log, 'temperature', 20.5);
    MQTTpublish(log, 'humidity', 59);
    await delayForDuration(0.1);
    
    expect(airConAccessory.state.currentTemperature).to.equal(20.5);
    expect(airConAccessory.state.currentHumidity).to.equal(59);

    airConAccessory.mqttClient.end();
  });

  it('set StatusActive false/true', async function() {
    const { platform, device, log } = setup();
    defaultConfig.host = device.host.address
    
    const config = {
      allowResend: false,
      ...defaultConfig
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    // Set temperature
    airConAccessory.serviceManager.updateCharacteristic(Characteristic.StatusActive, false);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 26);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(0);

    // Set temperature
    airConAccessory.serviceManager.updateCharacteristic(Characteristic.StatusActive, true);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 26);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(1);
  });

  it('scene off', async function() {
    const { platform, device, log } = setup();
    const config = {
      name: 'AirConditioner',
      type: 'air-conditioner',
      data: {
	off: 'OFF',
	heat16: 'HEAT_16',
	heat30: 'HEAT_30',
	cool16: 'COOL_16',
	cool19: 'COOL_19',
	cool30: 'COOL_30',
	auto16: 'AUTO_16',
	auto30: 'AUTO_30'
      },
      logLevel: 'trace',
      noHistory: true,
      persistState: false,
      mqttStateOnly: false,
      host: device.host.address
    };

    airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);
    await delayForDuration(0.1);

    // Scene OFF (iOS 18 prior)
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(0);
    expect(airConAccessory.state.targetTemperature).to.equal(20);
    hexCheck({ device, codes: [ 'OFF' ], count: 1 });

    // Manual COOL
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(2);
    expect(airConAccessory.state.targetTemperature).to.equal(19);
    hexCheck({ device, codes: [ 'COOL_19' ], count: 2 });

    // Scene OFF (iOS 18)
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetTemperature, 20);
    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.1);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(0);
    expect(airConAccessory.state.targetTemperature).to.equal(20);
    hexCheck({ device, codes: [ 'OFF' ] , count: 3});
  });
})
