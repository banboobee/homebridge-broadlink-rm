const { expect } = require('chai');

const { setup } = require('./helpers/setup');
const hexCheck = require('./helpers/hexCheck');
const delayForDuration = require('../helpers/delayForDuration');

const data = {
  on: 'ON',
  off: 'OFF',
  mute: 'MUTE',
  play: 'PLAY',
  pause: 'PAUSE',
  stop: 'STOP',
  volume: {
    up: 'VOLUMEUP',
    down: 'VOLUMEDOWN',
  },
};

const defaultConfig = {
  name: 'Speaker',
  type: 'speaker',
  data,
  logLevel: 'trace',
  persistState: false
};

describe('SpeakerAccessory', async function() {

  let SpeakerAccessory;

  it('check config', async function() {
    const { platform, device, log } = setup();

    const config = JSON.parse(JSON.stringify(defaultConfig));
    config.host = device.host.address
    config.data.volume.mute = 'MUTE';
    config.data.remote = {playpause: 'PLAYPAUSE'};

    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);
    await delayForDuration(0.1);
  });

  it('tun on', async function() {
    const { log, device, platform } = setup();
    const { Characteristic } = platform.api.hap;
    defaultConfig.host = device.host.address

    const config = JSON.parse(JSON.stringify(defaultConfig));

    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);
    expect(SpeakerAccessory.constructor.isUnitTest).to.equal(true);

    // Turn on
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Active, true);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.Active).to.equal(true);

    // Check hex codes were sent
    hexCheck({ device,
      codes: [ 'ON' ],
      count: 1,
    });
  });

  it('tun off', async function() {
    const { log, device, platform } = setup();
    const { Characteristic } = platform.api.hap;
    defaultConfig.host = device.host.address

    const config = JSON.parse(JSON.stringify(defaultConfig));

    // Turn off
    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Active, false);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.Active).to.equal(false);

    // Check hex codes were sent
    hexCheck({ device,
      codes: [ 'OFF' ],
      count: 1,
    });
  });

  it('mute', async function() {
    const { log, device, platform } = setup();
    const { Characteristic } = platform.api.hap;
    defaultConfig.host = device.host.address

    const config = JSON.parse(JSON.stringify(defaultConfig));
    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);

    // Mute on/off
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Mute, true);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.Mute).to.equal(true);
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Mute, false);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.Mute).to.equal(false);

    // Check hex codes were sent
    hexCheck({ device,
      codes: [ 'MUTE', 'MUTE' ],
      count: 2,
    });
  });

  it('play', async function() {
    const { log, device, platform } = setup();
    const { Characteristic } = platform.api.hap;
    defaultConfig.host = device.host.address

    const config = JSON.parse(JSON.stringify(defaultConfig));
    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);

    // play/pause/stop
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.TargetMediaState, Characteristic.TargetMediaState.PLAY);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.targetMediaState).to.equal(Characteristic.TargetMediaState.PLAY);
    expect(SpeakerAccessory.state.currentMediaState).to.equal(Characteristic.TargetMediaState.PLAY);

    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.TargetMediaState, Characteristic.TargetMediaState.STOP);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.targetMediaState).to.equal(Characteristic.TargetMediaState.STOP);
    expect(SpeakerAccessory.state.currentMediaState).to.equal(Characteristic.TargetMediaState.STOP);

    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.TargetMediaState, Characteristic.TargetMediaState.PAUSE);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.targetMediaState).to.equal(Characteristic.TargetMediaState.PAUSE);
    expect(SpeakerAccessory.state.currentMediaState).to.equal(Characteristic.TargetMediaState.PAUSE);

    // Check hex codes were sent
    hexCheck({ device,
      codes: [ 'PLAY', 'STOP', 'PAUSE' ],
      count: 3,
    });
  });

  it('Volume', async function() {
    const { log, device, platform } = setup();
    const { Characteristic } = platform.api.hap;
    defaultConfig.host = device.host.address
    const config = JSON.parse(JSON.stringify(defaultConfig));
    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);

    // Volume control
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.INCREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(55);
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.DECREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(50);

    // Check hex codes were sent
    hexCheck({ device,
      codes: [ 'VOLUMEUP', 'VOLUMEDOWN' ],
      count: 2,
    });

    SpeakerAccessory.state.volume = 99;
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Volume, 120);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(99);

    SpeakerAccessory.state.volume = 90;
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Volume, 99);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(99);

    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.INCREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(100);

    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.INCREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(100);

    SpeakerAccessory.state.volume = 93;
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.INCREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(95);

    SpeakerAccessory.state.volume = 1;
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Volume, -10);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(1);

    SpeakerAccessory.state.volume = 6;
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Volume, 1);
    await delayForDuration(.1);
    expect(SpeakerAccessory.state.volume).to.equal(1);

    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.DECREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(0);

    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.DECREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(0);

    SpeakerAccessory.state.volume = 6;
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.VolumeSelector, Characteristic.VolumeSelector.DECREMENT);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.volume).to.equal(0);
  });

  it('"persistState": true', async function() {
    const { log, device, platform } = setup();
    const { Characteristic } = platform.api.hap;
    defaultConfig.host = device.host.address
    let config = JSON.parse(JSON.stringify(defaultConfig));
    config.persistState = true;

    let SpeakerAccessory;
    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);

    // Turn on and mute
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Active, true);
    await delayForDuration(0.1);
    SpeakerAccessory.serviceManager.setCharacteristic(Characteristic.Mute, true);
    await delayForDuration(0.1);
    expect(SpeakerAccessory.state.Active).to.equal(true);
    expect(SpeakerAccessory.state.Mute).to.equal(true);

    // Check hex codes were sent
    hexCheck({ device,
      codes: [ 'ON', 'MUTE' ],
      count: 2,
    });

    device.resetSentHexCodes();

    // Should be on still with a new instance
    config = JSON.parse(JSON.stringify(defaultConfig));
    config.persistState = true;
    SpeakerAccessory = new platform.classTypes['speaker'](log, config, platform);
    expect(SpeakerAccessory.state.Active).to.equal(true);
    expect(SpeakerAccessory.state.Mute).to.equal(true);
  });
})
