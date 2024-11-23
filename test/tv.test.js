const { expect } = require('chai');

const { setup } = require('./helpers/setup');
const { MQTTpublish } = require('./helpers/setup');
const hexCheck = require('./helpers/hexCheck');
const delayForDuration = require('../helpers/delayForDuration');

const data = {
  on: 'ON',
  off: 'OFF',
  volume: {
    up: 'VOLUMEUP',
    down: 'VOLUMEDOWN',
    mute: 'MUTE'
  },
  remote: {
    select: 'SELECT',
    arrowUp: 'ARROWUP',
    arrowDown: 'ARROWDOWN',
    arrowLeft: 'ARROWLEFT',
    arrowRight: 'ARROWRIGHT',
    back: 'BACK',
    exit: 'EXIT',
    playPause: 'PLAYPAUSE',
    info: 'INFO'
  },
  inputs: [
    {
      name: 'Channel A',
      type: 'other',
      data: 'Channel-A'
    },
    {
      name: 'Channel B',
      type: 'other',
      data: 'Channel-B'
    },
    {
      name: 'Channel C',
      type: 'other',
      data: 'Channel-C'
    }
  ]
};

const defaultConfig = {
  name: 'TV',
  type: 'tv',
  data,
  logLevel: 'trace',
  pingGrace: 0.1,
  persistState: false
};

describe('TVAccessory', async () => {

  it('tun on', async () => {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    
    const config = JSON.parse(JSON.stringify(defaultConfig));

    const TVAccessory = new platform.classTypes['tv'](log, config, platform);
    expect(TVAccessory.isUnitTest).to.equal(true);

    // Turn on
    TVAccessory.serviceManager.setCharacteristic(Characteristic.Active, true);
    await delayForDuration(0.1);
    expect(TVAccessory.state.switchState).to.equal(true);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'ON' ], count: 1 });
  });

  it('tun off', async () => {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    
    const config = JSON.parse(JSON.stringify(defaultConfig));

    // Turn off
    const TVAccessory = new platform.classTypes['tv'](log, config, platform);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.Active, false);
    await delayForDuration(0.1);
    expect(TVAccessory.state.switchState).to.equal(false);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'OFF' ], count: 1 });
  });

  it('Select source', async () => {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    
    const config = JSON.parse(JSON.stringify(defaultConfig));

    // Select channel
    const TVAccessory = new platform.classTypes['tv'](log, config, platform);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.ActiveIdentifier, 1);
    await delayForDuration(0.1);
    expect(TVAccessory.state.currentInput).to.equal(1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'Channel-A' ], count: 1 });

  });

  it('Remote', async () => {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    const config = JSON.parse(JSON.stringify(defaultConfig));
    const TVAccessory = new platform.classTypes['tv'](log, config, platform);

    // Remote keys
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.PLAY_PAUSE);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.EXIT);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.ARROW_UP);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.ARROW_DOWN);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.ARROW_LEFT);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.ARROW_RIGHT);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.SELECT);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.BACK);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.REWIND);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.FAST_FORWARD);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.NEXT_TRACK);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.PREVIOUS_TRACK);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.RemoteKey, Characteristic.RemoteKey.INFORMATION);
    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes:
	       ['PLAYPAUSE', 'EXIT', 'ARROWUP', 'ARROWDOWN',
		'ARROWLEFT', 'ARROWRIGHT', 'SELECT', 'BACK',
		'INFO'
	       ], count: 9
	     });
  });

  it('Volume', async () => {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    const config = JSON.parse(JSON.stringify(defaultConfig));
    const TVAccessory = new platform.classTypes['tv'](log, config, platform);
    
    // Volume control
    TVAccessory.speakerService.setCharacteristic(Characteristic.Mute, true);
    await delayForDuration(0.1);
    expect(TVAccessory.state.Mute).to.equal(true);
    TVAccessory.speakerService.setCharacteristic(Characteristic.Mute, false);
    await delayForDuration(0.1);
    expect(TVAccessory.state.Mute).to.equal(false);

    TVAccessory.speakerService.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.INCREMENT);
    await delayForDuration(0.1);
    TVAccessory.speakerService.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.DECREMENT);
    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device,
	       codes: [ 'MUTE', 'MUTE', 'VOLUMEUP', 'VOLUMEDOWN' ],
	       count: 4
	     });
  });

  it('"persistState": true', async () => {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    let config = JSON.parse(JSON.stringify(defaultConfig));
    config.persistState = true;

    let TVAccessory;
    TVAccessory = new platform.classTypes['tv'](log, config, platform);

    // Turn on and mute
    TVAccessory.serviceManager.setCharacteristic(Characteristic.Active, true);
    await delayForDuration(0.1);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.ActiveIdentifier, 2);
    await delayForDuration(0.1);
    TVAccessory.speakerService.setCharacteristic(Characteristic.Mute, true);
    await delayForDuration(0.1);
    expect(TVAccessory.state.switchState).to.equal(true);
    expect(TVAccessory.state.currentInput).to.equal(2);
    expect(TVAccessory.state.Mute).to.equal(true);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'ON', 'Channel-B', 'MUTE' ], count: 3 });

    device.resetSentHexCodes();

    // Should be on still with a new instance
    config = JSON.parse(JSON.stringify(defaultConfig));
    config.persistState = true;
    TVAccessory = new platform.classTypes['tv'](log, config, platform);
    expect(TVAccessory.state.switchState).to.equal(true);
    expect(TVAccessory.state.Mute).to.equal(true);
    expect(TVAccessory.state.currentInput).to.equal(2);
  });

  it('automation', async () => {
    const { log, device, platform } = setup();
    defaultConfig.host = device.host.address
    let config = JSON.parse(JSON.stringify(defaultConfig));
    config.persistState = true;

    const TVAccessory = new platform.classTypes['tv'](log, config, platform);

    // Simultaneously Turn on and select channel
    TVAccessory.serviceManager.setCharacteristic(Characteristic.Active, true);
    TVAccessory.serviceManager.setCharacteristic(Characteristic.ActiveIdentifier, 2);
    expect(TVAccessory.state.switchState).to.equal(true);
    expect(TVAccessory.state.currentInput).to.equal(2);

    await delayForDuration(0.1);

    // Check hex codes were sent
    hexCheck({ device, codes: [ 'ON', 'Channel-B' ], count: 2 });
  });

  it('"mqttStateOnly": true', async () => {
    const { platform, device, log } = setup();
    const config = JSON.parse(JSON.stringify(defaultConfig));
    config.host = device.host.address
    config.mqttStateOnly = true;
    config.mqttURL =  "mqtt://localhost";
    config.mqttTopic = [
      {
        "identifier": "Power",
        "topic": "homebridge-broadlink-rm/UT/Power"
      },
      {
        "identifier": "Source",
        "topic": "homebridge-broadlink-rm/UT/Source"
      }
    ];
    const TVAccessory = new platform.classTypes['tv'](log, config, platform);
    await delayForDuration(0.1);
    
    await MQTTpublish(log, 'Power', 'on');
    await delayForDuration(0.1);
    await MQTTpublish(log, 'Source', '\"Channel A\"');
    await delayForDuration(0.1);
    expect(TVAccessory.state.switchState).to.equal(true);
    expect(TVAccessory.state.currentInput).to.equal(1);

    TVAccessory.mqttClient.end();
  });

  it('"mqttStateOnly": false', async () => {
    const { platform, device, log } = setup();
    const config = JSON.parse(JSON.stringify(defaultConfig));
    config.host = device.host.address
    config.mqttStateOnly = false;
    config.mqttURL =  "mqtt://localhost";
    config.mqttTopic = [
      {
        "identifier": "Power",
        "topic": "homebridge-broadlink-rm/UT/Power"
      },
      {
        "identifier": "Source",
        "topic": "homebridge-broadlink-rm/UT/Source"
      }
    ];
    const TVAccessory = new platform.classTypes['tv'](log, config, platform);
    await delayForDuration(0.1);
    
    MQTTpublish(log, 'Power', 'on');
    await delayForDuration(0.1);
    MQTTpublish(log, 'Source', 'Channel\\ A');
    await delayForDuration(0.1);
    expect(TVAccessory.state.switchState).to.equal(true);
    expect(TVAccessory.state.currentInput).to.equal(1);
    MQTTpublish(log, 'Source', 'Channel\\ C');
    await delayForDuration(0.1);
    MQTTpublish(log, 'Power', 'off');
    await delayForDuration(0.1);
    expect(TVAccessory.state.switchState).to.equal(false);
    expect(TVAccessory.state.currentInput).to.equal(3);

    // Check hex codes were sent
    hexCheck({ device,
	       codes: [
		 'ON',
		 'Channel-A',
		 'Channel-C',
		 'OFF'
	       ],
	       count: 4
	     });

    TVAccessory.mqttClient.end();
  });
})
