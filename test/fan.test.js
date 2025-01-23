const { expect } = require('chai');

const { setup } = require('./helpers/setup')
// const ping = require('./helpers/fakePing')

const delayForDuration = require('../helpers/delayForDuration')

// TODO: Check the closest hex is chosen for fan speed

const data = {
  on: 'ON',
  off: 'OFF',
  clockwise: 'CLOCKWISE',
  counterClockwise: 'COUNTERCLOCKWISE',
  swingToggle: 'SWINGTOGGLE',
  fanSpeed5: 'FANSPEED5',
  fanSpeed10: 'FANSPEED10',
  fanSpeed20: 'FANSPEED20',
  fanSpeed30: 'FANSPEED30',
  fanSpeed40: 'FANSPEED40',
}

const defaultConfig = {
  name: 'Fan',
  data,
  isUnitTest: true,
  pingGrace: 0.1,
  persistState: false
};

describe('fanAccessory', () => {

  // Fan Turn On
  it('turns on', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address,
    }
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, true)
    await delayForDuration(.1);
    
    expect(fanAccessory.state.switchState).to.equal(true);

    // await delayForDuration(.2);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('ON');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Fan Turn On then Off
  it('turns off', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address,
    }
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);

    // Turn On Fan
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, true)
    await delayForDuration(.1);
    expect(fanAccessory.state.switchState).to.equal(true);
    
    // Turn Off Fan
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, false)
    await delayForDuration(.1);
    expect(fanAccessory.state.switchState).to.equal(false);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('OFF');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });


  // Fan Speed
  it('fan speed set to 20', async () => {
    const { platform, device, log } = setup();

    const config = {
      host: device.host.address,
      ...defaultConfig,
    }
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.RotationSpeed, 20)
    await delayForDuration(.1);
    
    expect(fanAccessory.state.fanSpeed).to.equal(20);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('FANSPEED20');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Fan Speed Closed
  it('fan speed set to 32 (closest 30)', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address
    }
    
    
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.RotationSpeed, 32)
    await delayForDuration(.1);
    
    expect(fanAccessory.state.fanSpeed).to.equal(32);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('FANSPEED30');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Fan Speed Closed
  it('fan speed set to 36 (closest 40)', async () => {
    const { platform, device, log } = setup();

    const config = {
      host: device.host.address,
      ...defaultConfig,
    }
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.RotationSpeed, 36)
    await delayForDuration(.1);
    
    expect(fanAccessory.state.fanSpeed).to.equal(36);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('FANSPEED40');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Fan Turn Swing Mode On
  it('swing mode on', async () => {
    const { platform, device, log } = setup();

    const config = {
      host: device.host.address,
      ...defaultConfig,
    }
    
    
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.SwingMode, 1)
    await delayForDuration(.1);
    
    expect(fanAccessory.state.swingMode).to.equal(1);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('SWINGTOGGLE');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Fan Turn Swing Mode On then Off
  it('swing mode off', async () => {
    const { platform, device, log } = setup();

    const config = {
      host: device.host.address,
      ...defaultConfig,
    }
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);

    // Turn On Swing Mode
    fanAccessory.serviceManager.setCharacteristic(Characteristic.SwingMode, 1)
    await delayForDuration(.1);
    expect(fanAccessory.state.swingMode).to.equal(1);
    
    // Turn Off Swing Mode
    fanAccessory.serviceManager.setCharacteristic(Characteristic.SwingMode, 0)
    await delayForDuration(.1);
    expect(fanAccessory.state.swingMode).to.equal(0);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('SWINGTOGGLE');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });


  // Hide Swing Mode
  it('"hideSwingMode": true', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address,
      persistState: false,
      hideSwingMode: true,
    };
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);

    // Attempt To Turn On Swing Mode
    fanAccessory.serviceManager.setCharacteristic(Characteristic.SwingMode, 1)
    expect(fanAccessory.state.swingMode).to.equal(undefined);

    // Check that no code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(0);
  });


  // Fan Turn Swing Mode On
  it('rotation direction clockwise', async () => {
    const { platform, device, log } = setup();

    const config = {
      host: device.host.address,
      ...defaultConfig,
    };
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.RotationDirection, 0);
    await delayForDuration(.1);
    
    expect(fanAccessory.state.rotationDirection).to.equal(0);

    // Check hex code was sent
    const hasSentCode = device.hasSentCode('CLOCKWISE');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Set Rotation Direction To Clockwise Then Anti-clockwise
  it('rotation direction anti-clockwise', async () => {
    const { platform, device, log } = setup();

    const config = {
      host: device.host.address,
      ...defaultConfig
    }
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);

    // Turn On Swing Mode
    fanAccessory.serviceManager.setCharacteristic(Characteristic.RotationDirection, 0)
    await delayForDuration(.1);
    expect(fanAccessory.state.rotationDirection).to.equal(0);

    // Check hex code was sent
    let hasSentCode = device.hasSentCode('CLOCKWISE');
    expect(hasSentCode).to.equal(true);
    
    // Turn Off Swing Mode
    fanAccessory.serviceManager.setCharacteristic(Characteristic.RotationDirection, 1)
    await delayForDuration(.1);
    expect(fanAccessory.state.rotationDirection).to.equal(1);

    // Check hex code was sent
    hasSentCode = device.hasSentCode('COUNTERCLOCKWISE');
    expect(hasSentCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(2);
  });


  // Hide Rotation Direction
  it('"hideRotationDirection": true', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address,
      hideRotationDirection: true,
    }
    
    const fanAccessory = new platform.classTypes['fan'](log, config, platform);

    // Attempt To Set Rotation Direction To Clockwise
    fanAccessory.serviceManager.setCharacteristic(Characteristic.RotationDirection, 1)
    expect(fanAccessory.state.rotationDirection).to.equal(undefined);

    // Check that no code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(0);
  });


  // Persist State
  it('"persistState": true', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      name: 'Unit Test Fan',
      host: device.host.address,
      persistState: true
    }
    
    let fanAccessory

    // Turn On Fan
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, true)
    expect(fanAccessory.state.switchState).to.equal(true);

    await delayForDuration(.1);

    // Should still be on when loading within a new instance
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    expect(fanAccessory.state.switchState).to.equal(true);
    
    // Turn Off Fan
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, false)
    expect(fanAccessory.state.switchState).to.equal(false);

    // Should still be off when loading within a new instance
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    expect(fanAccessory.state.switchState).to.equal(false);
  });

  it('"persistState": false', async () => {
    const { platform, device, log } = setup();

    const config = {
      host: device.host.address,
      name: 'Unit Test Fan',
      ...defaultConfig,
    }
    
    let fanAccessory

    // Turn On Fan
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, true)
    expect(fanAccessory.state.switchState).to.equal(true);

    // Should be off again with a new instance
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    expect(fanAccessory.state.switchState).to.equal(undefined);
  });


  // Ensure the hex is resent after reload
  it('"resendHexAfterReload": true, "persistState": true', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address,
      persistState: true,
      resendHexAfterReload: true,
      resendHexAfterReloadDelay: 0.1
    }

    let fanAccessory

    // Turn On Fan
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, true)
    expect(fanAccessory.state.switchState).to.equal(true);

    // Wait for resendHexAfterReloadDelay
    await delayForDuration(0.3)

    device.resetSentHexCodes()

    // Should be on still with a new instance
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    expect(fanAccessory.state.switchState).to.equal(true);

    // We should find that setCharacteristic has been called after a duration of resendHexAfterReloadDelay
    await delayForDuration(0.3)
    expect(fanAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(true);

    // Check ON hex code was sent
    const hasSentOnCode = device.hasSentCode('ON');
    expect(hasSentOnCode).to.equal(true);

    // Check that only one code has been sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(1);
  });


  // Ensure the hex is not resent after reload
  it('"resendHexAfterReload": false, "persistState": true', async () => {
    const { platform, device, log } = setup();

    const config = {
      ...defaultConfig,
      host: device.host.address,
      persistState: true,
      resendHexAfterReload: false,
      resendHexAfterReloadDelay: 0.1
    }
    
    let fanAccessory

    // Turn On Fan
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    fanAccessory.serviceManager.setCharacteristic(Characteristic.Active, true)
    expect(fanAccessory.state.switchState).to.equal(true);

    // Wait for resendHexAfterReloadDelay
    await delayForDuration(0.3)

    device.resetSentHexCodes()

    // Should be on still with a new instance
    fanAccessory = new platform.classTypes['fan'](log, config, platform);
    expect(fanAccessory.state.switchState).to.equal(true);

    // We should find that setCharacteristic has not been called after a duration of resendHexAfterReloadDelay
    await delayForDuration(0.3)
    expect(fanAccessory.serviceManager.hasRecordedSetCharacteristic).to.equal(false);

    // Check ON hex code was not sent
    const hasSentOnCode = device.hasSentCode('ON');
    expect(hasSentOnCode).to.equal(false);

    // Check that no code was sent
    const sentHexCodeCount = device.getSentHexCodeCount();
    expect(sentHexCodeCount).to.equal(0);
  });
})
