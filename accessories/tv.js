const delayForDuration = require('../helpers/delayForDuration');
const catchDelayCancelError = require('../helpers/catchDelayCancelError');
const ping = require('../helpers/ping');
const arp = require('../helpers/arp');
const BroadlinkRMAccessory = require('./accessory');
const persistentState = require('../base/helpers/persistentState');

class TVAccessory extends BroadlinkRMAccessory {
  static configKeys = {
    // common
    ...this.configCommonKeys,

    //MQTT
    ...this.configMqttKeys,
    mqttTopic: [	// override to use own configMQTTTopicKeys
      (key, values) => this.configIsMQTTTopic(key, values, this.configMqttTopicKeys),
      '`value ${JSON.stringify(value)} is not a valid mqttTopic`'],

    // complex
    data: [
      (key, values) => this.configIsObject(values[0]) && this.verifyConfig(values, key, this.configDataKeys),
      '`value ${JSON.stringify(value)} is not a valid data config`'],

    // selection
    subtype: [
      (key, values, choices) => this.configIsSelection(values[0].toLowerCase(), choices),
      '`value ${JSON.stringify(value)} is not one of ${choices.map(x => `"${x}"`).join()}`',
      ['tv', 'stb', 'receiver', 'stick']
    ],

    // string
    'pingIPAddress$': [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],

    // boolean
    enableAutoOff: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'. Use 'onDuration' property sololy.`);
	return true;
      },
      '`Unsupported config key.`'],
    enableAutoOn: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'. Use 'offDuration' property sololy.`);
	return true;
      },
      '`Unsupported config key.`'],
    disableAutomaticOn: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'.`);
	return true;
      },
      '`Unsupported config key.`'],
    disableAutomaticOff: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'.`);
	return true;
      },
      '`Unsupported config key.`'],
    pingIPAddressStateOnly: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    pingUseArp: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    syncInputSourceWhenOn: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],

    // number
    pingFrequency: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    pingGrace: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    onDuration: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    offDuration: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
  }
  static configMqttTopicKeys = {
    identifier: [
      (key, values, choices) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`',
      ['power', 'active', 'source', 'activeidentifier']
    ],
    topic: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`']
  }
  static configDataKeys = {
    on: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    off: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    'volume': [
      (key, values) => this.configIsObject(values[0]) && this.verifyConfig(values, key, this.configVolumeKeys),
      '`value ${JSON.stringify(value)} is not a valid volume config`'],
    'remote': [
      (key, values) => this.configIsObject(values[0]) && this.verifyConfig(values, key, this.configRemoteKeys),
      '`value ${JSON.stringify(value)} is not a valid remote config`'],
    'inputs': [
      (key, values) => this.configIsArray(values[0]) && this.configIsInputs(key, values),
      '`value ${JSON.stringify(value)} is not a valid inputs config`'],
  }
  static configVolumeKeys = {
    up: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    down: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    mute: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
  }
  static configRemoteKeys = {
    select: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    arrowUp: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    arrowDown: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    arrowLeft: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    arrowRight: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    back: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    exit: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    playPause: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    info: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
  }
  static configInputsKeys = {
    name: [
      (key, values) => {return this.configIsString(values[0])},
      '`value ${JSON.stringify(value)} is not a string`'],
    type: [
      (key, values, choices) => this.configIsSelection(values[0].toLowerCase(), choices),
      '`value ${JSON.stringify(value)} is not one of ${choices.map(x => `"${x}"`).join()}`',
      ['other', 'home_screen', 'tuner', 'hdmi', 'composite_video', 's_video', 'component_video', 'dvi', 'airplay', 'usb', 'application']
    ],
    data: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
  }
  static configIsInputs(property, values) {
    const property0 = property;
    values[0].forEach((element, i) => {
      const property = `${property0}[${i}]`;
      if (this.configIsObject(element)) {
	values.unshift(element);
	this.verifyConfig(values, property, this.configInputsKeys);
	values.shift();
      } else {
	this.logs.config.error(`failed to verify '${property}' property. value '${JSON.stringify(element)}' is not a valid input config.`);
      }
    });
    return true;
  }
  
  constructor(log, config = {}, platform) {
    super(log, config, platform);

    if (!this.constructor.isUnitTest) this.checkPing(ping);
    this.lastPingResponse = undefined;

    const {name} = this;
    const {host, persistState} = config;
    if (persistState === false) return;
    if (this.constructor.isUnitTest) return;	// to avoid duplicate state persisting
    
    // const state = {...this.serviceManager.accessory.context};
    const state = {...this.serviceManager.state};
    this.state = new Proxy(state, {	// replace proxy for external accessories
      set: async function(target, key, value) {
	Reflect.set(target, key, value);
	persistentState.save({ host, name, state });
	this.serviceManager.accessory.context[key] = value;
	// console.log(`${host}-${name} persist: ${JSON.stringify(state)}`);
	// console.log(`${host}-${name} context: ${JSON.stringify(this.serviceManager.accessory.context)}`);
	
	return true
      }.bind(this)
    })
    this.serviceManager.state = this.state;
  }

  checkConfig(config) {
    this.constructor.verifyConfig([config], '', this.constructor.configKeys); 
  }
  
  setDefaults() {
    const { config } = this;
    config.pingFrequency = config.pingFrequency || 1;
    config.pingGrace = config.pingGrace || 10;

    // config.offDuration = config.offDuration || 60;
    // config.onDuration = config.onDuration || 60;
    
    config.subType = config.subType || 'tv';

    // if (
    //   config.enableAutoOn === undefined &&
    //   config.disableAutomaticOn === undefined
    // ) {
    //   config.enableAutoOn = false;
    // } else if (config.disableAutomaticOn !== undefined) {
    //   config.enableAutoOn = !config.disableAutomaticOn;
    // }

    // if (
    //   config.enableAutoOff === undefined &&
    //   config.disableAutomaticOff === undefined
    // ) {
    //   config.enableAutoOff = false;
    // } else if (config.disableAutomaticOff !== undefined) {
    //   config.enableAutoOff = !config.disableAutomaticOff;
    // }
  }

  reset() {
    const { Characteristic } = this;

    super.reset();

    this.stateChangeInProgress = true;
    
    // Clear Timeouts
    if (this.delayTimeoutPromise) {
      this.delayTimeoutPromise.cancel();
      this.delayTimeoutPromise = null;
    }

    if (this.autoOffTimeoutPromise) {
      this.autoOffTimeoutPromise.cancel();
      this.autoOffTimeoutPromise = null;
    }

    if (this.autoOnTimeoutPromise) {
      this.autoOnTimeoutPromise.cancel();
      this.autoOnTimeoutPromise = null;
    }
  
    if (this.pingGraceTimeout) {
      this.pingGraceTimeout.cancel();
      this.pingGraceTimeout = null;
    }
    
    if (this.serviceManager.getCharacteristic(Characteristic.Active) === undefined) {
      this.serviceManager.setCharacteristic(Characteristic.Active, false);
    }
  }
  
  checkAutoOnOff() {
    this.reset();
    this.checkPingGrace();
    this.checkAutoOn();
    this.checkAutoOff();
  }

  checkPing(ping) {
    const { config } = this;
    const { pingIPAddress, pingFrequency, pingUseArp } = config;

    if (!pingIPAddress) {return;}

    // Setup Ping/Arp-based State
    if(!pingUseArp) {ping(pingIPAddress, pingFrequency, this.pingCallback.bind(this))}
    else {arp(pingIPAddress, pingFrequency, this.pingCallback.bind(this))}
  }

  async pingCallback(active) {
    const { Characteristic } = this;
    const { config, state, serviceManager } = this;
    
    if (this.stateChangeInProgress){
      return;
    }

    if (this.lastPingResponse !== undefined && this.lastPingResponse !== active) {
      // console.log(`[${new Date().toLocaleString()}] ${name} Ping: Turned ${active ? 'on' : 'off'}.`);
      if (config.syncInputSourceWhenOn && active && this.state.currentInput !== undefined) {
	this.logs.info(`received ping response. Sync input source.`);
	await this.setInputSource();	// sync if asynchronously turned on
      }
    }
    this.lastPingResponse = active;
    if (config.pingIPAddressStateOnly) {
      state.switchState = active ? 1 : 0;
      serviceManager.refreshCharacteristicUI(Characteristic.Active);

      return;
    }

    const value = active ? 1 : 0;
    serviceManager.setCharacteristic(Characteristic.Active, value);
  }

  async setSwitchState(hexData) {
    this.stateChangeInProgress = true;
    this.reset();

    if (hexData) {await this.performSend(hexData);}

    this.checkAutoOnOff();
    // console.log(`[${new Date().toLocaleString()}] ${name} Active: set to ${this.state.switchState ? 'ON' : 'OFF'}.`);
  }
  
  async checkPingGrace () {
    await catchDelayCancelError(async () => {
      const { config } = this;

      const { pingGrace } = config;

      if (pingGrace) {

        this.pingGraceTimeoutPromise = delayForDuration(pingGrace);
        await this.pingGraceTimeoutPromise;

        this.stateChangeInProgress = false;
      }
    });
  }
  
  async checkAutoOff() {
    const { Characteristic } = this;
    await catchDelayCancelError(async () => {
      const { config, state, serviceManager } = this;
      const { /*enableAutoOff,*/ onDuration } = config;

      if (state.switchState && /*enableAutoOff*/ typeof onDuration !== 'string' && Number(onDuration) > 0) {
        this.logs.info(`setSwitchState: automatically turn off in ${onDuration} seconds`);

        this.autoOffTimeoutPromise = delayForDuration(onDuration);
        await this.autoOffTimeoutPromise;

        serviceManager.setCharacteristic(Characteristic.Active, false);
      }
    });
  }

  async checkAutoOn() {
    const { Characteristic } = this;
    await catchDelayCancelError(async () => {
      const { config, state, serviceManager } = this;
      const { /*enableAutoOn,*/ offDuration } = config;

      if (!state.switchState && /*enableAutoOn*/ typeof offDuration !== 'string' && Number(offDuration) > 0) {
        this.logs.info(`setSwitchState: (automatically turn on in ${offDuration} seconds)`);

        this.autoOnTimeoutPromise = delayForDuration(offDuration);
        await this.autoOnTimeoutPromise;

        serviceManager.setCharacteristic(Characteristic.Active, true);
      }
    });
  }

  // getServices() {
  //   const services = this.getInformationServices();

  //   services.push(this.serviceManager.service);
  //   services.push(...this.serviceManagers);

  //   return services;
  // }

  async setInputSource(on, previous) {
    // const { Characteristic } = this;
    const { data } = this;
    const newValue = this.state.currentInput;
  
    if (
      !data ||
        !data.inputs ||
        !data.inputs[newValue] ||
        !data.inputs[newValue].data
    ) {
      this.logs.error(`Input: No input data found. Ignoring request ${newValue}.`);
      this.state.currentInput = previous;
      return;
    }
  
    await this.performSend(data.inputs[newValue].data);
    // this.serviceManager.setCharacteristic(Characteristic.ActiveIdentifier, newValue);
    // log(`${name} select input source to ${data.inputs[newValue].name}(${newValue}).`);
  }
  
  async onMQTTMessage (identifier, message) {
    const { Characteristic } = this;
    const { config } = this;
    const mqttStateOnly = config.mqttStateOnly === false ? false : true;
    this.logs.trace(`onMQTTMessage: Received {identifier:"${identifier}", message:${message}}`);

    if (identifier.toLowerCase() === 'power' || identifier.toLowerCase() === 'active') {
      const power = message.toLowerCase() === 'on' ? true : false;
      this.reset();
      if (mqttStateOnly) {
	this.serviceManager.updateCharacteristic(Characteristic.Active, power);
      } else {
	this.serviceManager.setCharacteristic(Characteristic.Active, power);
      }
      this.logs.debug(`onMQTTMessage: set Active to ${this.state.switchState}.`);
      return;
    }
    if (identifier.toLowerCase() === 'source' || identifier.toLowerCase() === 'activeidentifier') {
      const index = this.config.data.inputs.findIndex(x => x?.name?.toLowerCase() === message.toLowerCase());
      if (index > 0 && index < this.config.data.inputs.length) {
	// this.reset();
	if (mqttStateOnly) {
	  this.serviceManager.updateCharacteristic(Characteristic.ActiveIdentifier, index);
	} else {
	  this.serviceManager.setCharacteristic(Characteristic.ActiveIdentifier, index);
	}
	this.logs.debug(`onMQTTMessage: set ActiveIdentifier to ${this.state.currentInput}.`);
      } else {
	this.logs.error(`onMQTTMessage: Unknown source ${message}.`);
      }
      return;
    }
  }

  setupServiceManager() {
    const { Service, Characteristic, Categories } = this;
    const { data, name, config, log } = this;
    const { on, off } = data || {};
    let { subType } = config;

    if (!subType) {
      subType = Categories.TELEVISION;
    } else if (subType.toLowerCase() === 'stb') {
      subType = Categories.TV_SET_TOP_BOX;
    } else if (subType.toLowerCase() === 'receiver') {
      subType = Categories.AUDIO_RECEIVER;
    } else if (subType.toLowerCase() === 'stick') {
      subType = Categories.TV_STREAMING_STICK;
    }

    // this.serviceManagers = [];
    this.serviceManager = new this.serviceManagerClass(
      name,
      Service.Television,
      log,
      subType
    );

    this.state = persistentState.load({ host: config.host, name }) || {};
    Object.keys(this.state)
      .map(x => x.match(/^inputs\/.+\/.+$/)?.[0])
      .filter(x => x)
      .forEach(x => {
	const source = x.match(/^inputs\/(.+)\/(.+)$/);
	if (!this.config?.data?.inputs.find(y => source[1] === y.name)) {
          this.logs.debug(`removed ${source[2]} of unknown input source ${source[1]}.`);
	  delete this.state[x];
	}
      })

    this.serviceManager.setCharacteristic(Characteristic.ConfiguredName, name);

    this.serviceManager.setCharacteristic(
      Characteristic.SleepDiscoveryMode,
      Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
    );

    this.serviceManager.addToggleCharacteristic({
      name: 'switchState',
      type: Characteristic.Active,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        onData: on || data,
        offData: off || undefined,
        setValuePromise: this.setSwitchState.bind(this)
      }
    });
    this.serviceManager.getCharacteristic(Characteristic.Active)
      .on('change', async function (event) {
	if (event.newValue !== event.oldValue) {
	  const value = event.newValue;
	  await this.mqttpublish('Power', value ? "on" : "off");
	  if (this.state.currentInput > 0 && this.state.currentInput < this.config?.data?.inputs?.length) {
	    await this.mqttpublish('Source', this.config.data.inputs[this.state.currentInput].name);
	  }
	}
      }.bind(this))

    this.serviceManager.addToggleCharacteristic({
      name: 'currentInput',
      type: Characteristic.ActiveIdentifier,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        setValuePromise: this.setInputSource.bind(this),
	ignorePreviousValue: true
      }
    });
    this.serviceManager.getCharacteristic(Characteristic.ActiveIdentifier)
      .on('change', async function (event) {
	if (event.newValue !== event.oldValue) {
	  const value = event.newValue;
	  if (value > 0 && value < this.config?.data?.inputs?.length) {
	    await this.mqttpublish('Source', this.config.data.inputs[value].name);
	  }
	}
      }.bind(this))

    this.serviceManager
      .getCharacteristic(Characteristic.RemoteKey)
      .on('set', async (newValue, callback) => {
        if (!data || !data.remote) {
          this.logs.error(`RemoteKey: No remote keys found. Ignoring request.`);
          callback(null);
          return;
        }

        let hexData = null;
        switch (newValue) {
          case Characteristic.RemoteKey.REWIND:
            hexData = data.remote.rewind; // not found yet
            break;
          case Characteristic.RemoteKey.FAST_FORWARD:
            hexData = data.remote.fastForward; // not found yet
            break;
          case Characteristic.RemoteKey.NEXT_TRACK:
            hexData = data.remote.nextTrack; // not found yet
            break;
          case Characteristic.RemoteKey.PREVIOUS_TRACK:
            hexData = data.remote.previousTrack; // not found yet
            break;
          case Characteristic.RemoteKey.ARROW_UP:
            hexData = data.remote.arrowUp;
            break;
          case Characteristic.RemoteKey.ARROW_DOWN:
            hexData = data.remote.arrowDown;
            break;
          case Characteristic.RemoteKey.ARROW_LEFT:
            hexData = data.remote.arrowLeft;
            break;
          case Characteristic.RemoteKey.ARROW_RIGHT:
            hexData = data.remote.arrowRight;
            break;
          case Characteristic.RemoteKey.SELECT:
            hexData = data.remote.select;
            break;
          case Characteristic.RemoteKey.BACK:
            hexData = data.remote.back;
            break;
          case Characteristic.RemoteKey.EXIT:
            hexData = data.remote.exit;
            break;
          case Characteristic.RemoteKey.PLAY_PAUSE:
            hexData = data.remote.playPause;
            break;
          case Characteristic.RemoteKey.INFORMATION:
            hexData = data.remote.info;
            break;
        }

        if (!hexData) {
          this.logs.error(`RemoteKey: No IR code found for received remote input!`);
          callback(null);
          return;
        }

        await this.performSend(hexData);
        callback(null);
      });

    this.serviceManager
      .getCharacteristic(Characteristic.PictureMode)
      .on('set', function(newValue, callback) {
        // Not found yet
        console.log('set PictureMode => setNewValue: ' + newValue);
        callback(null);
      });

    this.serviceManager
      .getCharacteristic(Characteristic.PowerModeSelection)
      .on('set', async (newValue, callback) => {
        if (!data || !data.powerMode) {
          this.logs.error(`PowerModeSelection: No settings data found. Ignoring request.`);
          callback(null);
          return;
        }

        let hexData = null;
        switch (newValue) {
          case Characteristic.PowerModeSelection.SHOW: // TV settings
            hexData = data.powerMode.show;
            break;
          case Characteristic.PowerModeSelection.HIDE: // not found yet
            hexData = data.powerMode.hide;
            break;
        }

        if (!hexData) {
          this.logs.error(`PowerModeSelection: No IR code found for received remote input!`);
          callback(null);
          return;
        }

        await this.performSend(hexData);
        callback(null);
      });

    // const speakerService = new Service.TelevisionSpeaker('Speaker', 'Speaker');
    // const speakerService = new Service.TelevisionSpeaker(`${name} Speaker`, '${name} Speaker');
    if (this.constructor.isUnitTest) {	// external control in UnitTest
      this.speakerService = new Service.TelevisionSpeaker(`${name} Speaker`, '${name} Speaker');
    } else {
      this.speakerService = this.serviceManager.accessory.addService(Service.TelevisionSpeaker, `${name} Speaker`, '${name} Speaker');
    }

    this.speakerService.setCharacteristic(
      Characteristic.Active,
      Characteristic.Active.ACTIVE
    );
    this.speakerService.setCharacteristic(
      Characteristic.VolumeControlType,
      Characteristic.VolumeControlType.ABSOLUTE
    );

    this.speakerService.getCharacteristic(Characteristic.VolumeSelector)
      .on('set', async (newValue, callback) => {
        if (!data || !data.volume) {
          this.logs.error(`VolumeSelector: No settings data found. Ignoring request.`);
          callback(null);
          return;
        }

        let hexData = null;
        switch (newValue) {
          case Characteristic.VolumeSelector.INCREMENT:
            hexData = data.volume.up;
            break;
          case Characteristic.VolumeSelector.DECREMENT:
            hexData = data.volume.down;
            break;
        }

        if (!hexData) {
          this.logs.error(`VolumeSelector: No IR code found for received remote input!`);
          callback(null);
          return;
        }

        await this.performSend(hexData);
        callback(null);
      });
    
    this.speakerService.setCharacteristic(Characteristic.Mute, false);
    this.speakerService.getCharacteristic(Characteristic.Mute)
      .on('get', (callback) => {
	// console.log(`${name} Mute: get ${this.state.Mute}.`);
	callback(null, this.state.Mute || false);
      })
      .on('set', async (newValue, callback) => {
        if (!data || !data.volume || !data.volume.mute) {
          this.logs.error(`VolumeSelector: No mute data found. Ignoring request.`);
          callback(null);
          return;
        }
      
        const hexData = data.volume.mute;
        if (!hexData) {
          this.logs.error(`VolumeSelector: No IR code found for mute!`);
          callback(null);
          return;
        }

	this.state.Mute = newValue;
        await this.performSend(hexData);
        callback(null);
      });

    // this.serviceManagers.push(this.speakerService);

    if (data.inputs && data.inputs instanceof Array) {
      data.inputs.unshift(undefined);
      for (let i = 1; i < data.inputs.length; i++) {
        const input = data.inputs[i];
        // const inputService = new Service.InputSource(`${name} input${i}`, `${name} input${i}`);
        const inputService = this.serviceManager.accessory?.addService(Service.InputSource, `${name} input${i}`, `${name} input${i}`);

	const visibility = this.state[`inputs/${input.name}/VisibilityState`] ?? Characteristic.CurrentVisibilityState.SHOWN;
	if (visibility === Characteristic.CurrentVisibilityState.HIDDEN) {
	  this.logs.debug(`hiding input source '${input.name}'.`);
	}
	const configuredName = this.state[`inputs/${input.name}/ConfiguredName`] ?? input.name;
	if (configuredName !== input.name) {
	  this.logs.debug(`displaying input source '${input.name}' as '${configuredName}'.`);
	}
	
        inputService?.setCharacteristic(Characteristic.Identifier, i)
          .setCharacteristic(Characteristic.ConfiguredName, configuredName)
          .setCharacteristic(
            Characteristic.IsConfigured,
            Characteristic.IsConfigured.CONFIGURED
          )
          .setCharacteristic(
	    Characteristic.InputSourceType,
	    this.getInputType(input.type)
	  )
	  .setCharacteristic(Characteristic.TargetVisibilityState, visibility)
	  .setCharacteristic(Characteristic.CurrentVisibilityState, visibility);

        inputService?.getCharacteristic(Characteristic.TargetVisibilityState)
	  .onSet(state => {
            this.logs.debug(`${input.name} setCurrentVisibilityState: ${state}`);
	    this.state[`inputs/${input.name}/VisibilityState`] = state;
	    if (state === Characteristic.CurrentVisibilityState.SHOWN) {
	      delete this.state[`inputs/${input.name}/VisibilityState`];
	    }
	    inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, state);
	  })
        inputService?.getCharacteristic(Characteristic.ConfiguredName)
	  .onSet(update => {
	    const current = inputService.getCharacteristic(Characteristic.ConfiguredName).value;
	    if (update !== current) {
              this.logs.debug(`${input.name} setConfiguredName: ${update}`);
	      this.state[`inputs/${input.name}/ConfiguredName`] = update;
	      if (update === input.name) {
		delete this.state[`inputs/${input.name}/ConfiguredName`];
	      }
	    }
	  })
	  .onGet(() => {
	    const current = inputService.getCharacteristic(Characteristic.ConfiguredName).value;
            this.logs.trace(`${input.name} getConfiguredName: ${current}`);
	    return current;
	  })
	
        // this.serviceManagers.push(inputService);
        this.serviceManager.service.addLinkedService?.(inputService);
      }

      const displayOrder = this.IdentifiersOrder(data.inputs.map((x, y) => y));
      // console.log(displayOrder);
      this.serviceManager.service.setCharacteristic(Characteristic.DisplayOrder, displayOrder);
    }
  }

  IdentifiersOrder(listOfIdentifiers) {
    const DisplayOrderTypes = {
      ARRAY_ELEMENT_START: 0x01,
      ARRAY_ELEMENT_END: 0x00
    }
    let identifiersTLV = Buffer.alloc(0);
    listOfIdentifiers.forEach((identifier, index) => {
      if (index !== 0) {
	identifiersTLV = Buffer.concat([
          identifiersTLV,
          this.platform.api.hap.encode(DisplayOrderTypes.ARRAY_ELEMENT_END, Buffer.alloc(0)),
	]);
      }
      
      const element = Buffer.alloc(4);
      element.writeUInt32LE(identifier, 0);
      identifiersTLV = Buffer.concat([
	identifiersTLV,
	this.platform.api.hap.encode(DisplayOrderTypes.ARRAY_ELEMENT_START, element),
      ]);
    });
    return identifiersTLV.toString('base64');
  }
  
  getInputType(type) {
    if (!type) {
      return 0;
    }
    
    switch (type.toLowerCase()) {
    case 'other':
      return 0;
    case 'home_screen':
      return 1;
    case 'tuner':
      return 2;
    case 'hdmi':
      return 3;
    case 'composite_video':
      return 4;
    case 's_video':
      return 5;
    case 'component_video':
      return 6;
    case 'dvi':
      return 7;
    case 'airplay':
      return 8;
    case 'usb':
      return 9;
    case 'application':
      return 10;
    }
  }
}

module.exports = TVAccessory;
