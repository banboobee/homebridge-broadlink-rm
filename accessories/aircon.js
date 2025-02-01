// -*- mode: js; js-indent-level : 2 -*-
const { assert } = require('chai');
const fs = require('fs');
const Mutex = require('await-semaphore').Mutex;

const delayForDuration = require('../helpers/delayForDuration');
// const catchDelayCancelError = require('../helpers/catchDelayCancelError');
const { getDevice } = require('../helpers/getDevice');
const BroadlinkRMAccessory = require('./accessory');

class AirConAccessory extends BroadlinkRMAccessory {

  constructor (log, config = {}, platform) {
    super(log, config, platform);
    this.mutex = new Mutex();

    // Characteristic isn't defined until runtime so we set these the instance scope
    const { Characteristic } = this;
    const HeatingCoolingStates = {
      off: Characteristic.TargetHeatingCoolingState.OFF,
      cool: Characteristic.TargetHeatingCoolingState.COOL,
      heat: Characteristic.TargetHeatingCoolingState.HEAT,
      auto: Characteristic.TargetHeatingCoolingState.AUTO
    };
    this.HeatingCoolingStates = HeatingCoolingStates;
    config.heatOnly ??= false;
    config.coolOnly ??= false;

    const HeatingCoolingConfigKeys = {};
    HeatingCoolingConfigKeys[Characteristic.TargetHeatingCoolingState.OFF] = 'off';
    HeatingCoolingConfigKeys[Characteristic.TargetHeatingCoolingState.COOL] = 'cool';
    HeatingCoolingConfigKeys[Characteristic.TargetHeatingCoolingState.HEAT] = 'heat';
    HeatingCoolingConfigKeys[Characteristic.TargetHeatingCoolingState.AUTO] = 'auto';
    this.HeatingCoolingConfigKeys = HeatingCoolingConfigKeys;
    
    // Fakegato setup
    if(config.noHistory !== true) {
      this.historyService = new this.platform.HistoryService(
	config.enableModeHistory ? 'custom' : 'room',
	this.serviceManager.accessory,
	{storage: 'fs', filename: 'RMPro_' + config.name.replace(' ','-') + '_persist.json'});

      if (config.enableModeHistory) {
	this.valveInterval = 1;
      }
    }

    this.monitorTemperature();
    this.thermoHistory();
  }

  checkMQTTTopic(property, config) {
    const options = {
      identifier: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      topic: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      characteristic: [
	(key, value, choices) => {return choices.find(x => x === value.toLowerCase())},
	'`value \'${JSON.stringify(value)}\' is not one of ${choices.join()}`',
	['temperature', 'currenttemperature', 'humidity', 'currentrelativehumidity']
      ],
    }
    config.forEach(element => {
      Object.keys(element).forEach(key => {
	const value = element[key];
	if (options[key]) {
	  const checker = options[key][0];
	  const message = options[key][1];
	  const choices = options[key][2];
	  if (!checker(key, value, choices)) {
	    this.logs.config.error(`failed to verify '${key}' property of '${property}'. ${eval(message)}.`);
	  }
	} else {
	  this.logs.config.debug(`contains unknown property '${key}' of '${property}'.`);
	}
      })
    })
    
    return true;
  }

  isMQTTTopic(key, value) {
    if (typeof value === 'string') {
      return true;
    } else if (Array.isArray(value)) {
      return this.checkMQTTTopic(key, value);
    } else if (typeof value === 'object') {
      this.logs.config.error(`failed to verify '${key}' property. value '${JSON.stringify(value)}' is not a valid mqttTopic.`);
      return true;
    }
  }

  checkHex(property, config) {
    let data = false;
    let d = false, r = false, x = false;
    const options = {
      pause: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      sendCount: [
	(key, value) => {r = true; return typeof value !== 'string' && !Number.isNaN(Number(value));},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      interval: [
	(key, value) => {x = true; return typeof value !== 'string' && !Number.isNaN(Number(value));},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      eval: [
	(key, value) => {data = true; d = true; return typeof value === 'string';},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      data: [
	(key, value) => {data = true; d = true; return typeof value === 'string';},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
    }
    config.forEach(element => {
      d = false;
      r = false;
      x = false;
      Object.keys(element).forEach(key => {
	const value = element[key];
	if (options[key]) {
	  const checker = options[key][0];
	  const message = options[key][1];
	  const choices = options[key][2];
	  if (!checker(key, value, choices)) {
	    this.logs.config.error(`failed to verify '${key}' property in '${property}' property of 'data'. ${eval(message)}.`);
	  }
	} else {
	  this.logs.config.debug(`contains unknown property '${key}' in '${property}' property of 'data'.`);
	}
      })
      if (r && !d) {
	this.logs.config.error(`failed to verify '${property}' property of 'data'. 'sendCount' without HEX code.`);
      }
      if (x && !d) {
	this.logs.config.error(`failed to verify '${property}' property of 'data'. 'interval' without HEX code.`);
      }
    })
    if (!data) {
      this.logs.config.error(`failed to verify '${property}' property of 'data'. missing HEX code.`);
    }
    
    return true;
  }

  checkTemperature(property, config) {
    let mode = false, data = false;
    const options = {
      'pseudo-mode': [
	(key, value, choices) => {mode = true; return choices.find(x => x === value);},
	'`value \'${JSON.stringify(value)}\' is not one of ${choices.join()}`',
	['heat', 'cool']
      ],
      data: [
	(key, value) => {data = true; return this.isHex(property, value);},	// use property instead of key
	'`value \'${JSON.stringify(value)}\' is not a string`'
      ],
    }
    Object.keys(config).forEach(key => {
      const match = Object.keys(options).find(y => key.match(y));
      const value = config[key];
      if (match) {
	const checker = options[match][0];
	const message = options[match][1];
	const choices = options[match][2];
	if (!checker(key, value, choices)) {
	  this.logs.config.error(`failed to verify '${key}' property in '${property}' property of 'data'. ${eval(message)}.`);
	}
      } else {
	this.logs.config.debug(`contains unknown property '${key}' in '${property}' property of 'data'.`);
      }
    })
    if (!mode) {
      this.logs.config.error(`failed to verify '${property}' property of 'data'. missing 'pseudo-mode' property.`);
    }
    if (!data) {
      this.logs.config.error(`failed to verify '${property}' property of 'data'. missing HEX code.`);
    }

    return true;
  }

  isTemperature(key, value) {
    if (typeof value === 'string') {
      this.logs.config.error(`failed to verify '${key}' property of 'data'. HEX code needs to be specified with mode.`);
      return true;
    } else if (Array.isArray(value)) {
      return this.checkHex(key, value);
    } else if (typeof value === 'object') {
      return this.checkTemperature(key, value)
    } else {
      return false;
    }
  }

  isHex(key, value) {
    if (typeof value === 'string') {
      return true;
    } else if (Array.isArray(value)) {
      return this.checkHex(key, value);
    } else if (typeof value === 'object') {
      this.logs.config.error(`failed to verify '${key}' property of 'data'. value '${JSON.stringify(value)}' is not HEX code or Advanced HEX array.`);
      return true;
    }
  }

  checkData(property, config) {
    const options = {
      on: [
	(key, value) => {return this.isHex(key, value)},
	'`value \'${JSON.stringify(value)}\' is not valid HEX code`'],
      off: [
	(key, value) => {return this.isHex(key, value)},
	'`value \'${JSON.stringify(value)}\' is not valid HEX code`'],
      '^temperature.+$': [
	(key, value) => {return !Number.isNaN(Number(key.match('(temperature)(.+)$')[2])) && this.isTemperature(key, value)},
	'`temperature suffix is not a number`'],
      '^(heat|cool|auto).+$': [
	(key, value) => {return !Number.isNaN(Number(key.match('(heat|cool|auto)(.+)$')[2])) && this.isHex(key, value)},
	'`temperature suffix is not a number`'],
    }
    Object.keys(config).forEach((key) => {
      const match = Object.keys(options).find(y => key.match(y));
      const value = config[key];
      if (match) {
	const checker = options[match][0];
	const message = options[match][1];
	const choices = options[match][2];
	if (!checker(key, value, choices)) {
	  this.logs.config.error(`failed to verify '${key}' property in '${property}' property. ${eval(message)}.`);
	}
      } else {
	this.logs.config.debug(`contains unknown property '${key}' in '${property}' property.`);
      }
    })

    return true;
  }

  checkConfig(config) {
    const options = {
      // common
      name: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      type: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      host: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      logLevel: [
	(key, value, choices) => {return choices.find(x => x === value)},
	'`value \'${JSON.stringify(value)}\' is not one of ${choices.join()}`',
	['trace', 'debug', 'info', 'warning', 'error']
      ],
      isUnitTest: [
	(key, value) => {return typeof value === 'boolean'},
	'`value \'${JSON.stringify(value)}\' is not a boolean`'],
      persistState: [
	(key, value) => {return typeof value === 'boolean'},
	'`value \'${JSON.stringify(value)}\' is not a boolean`'],
      allowResend: [
	(key, value) => {return typeof value === 'boolean'},
	'`value \'${JSON.stringify(value)}\' is not a boolean`'],

      // complex
      data: [
	(key, value) => {return typeof value === 'object' && this.checkData(key, value)},
	'`value \'${JSON.stringify(value)}\' is not valid HEX code`'],
      mqttTopic: [
	(key, value) => {return this.isMQTTTopic(key, value)},
	'`value \'${JSON.stringify(value)}\' is not valid HEX code`'],

      // selection
      replaceAutoMode: [
	(key, value, choices) => {return choices.find(x => x === value)},
	'`value \'${JSON.stringify(value)}\' is not one of ${choices.join()}`',
	['heat', 'cool']
      ],
      units: [
	(key, value, choices) => {return choices.find(x => x === value.toLowerCase())},
	'`value \'${JSON.stringify(value)}\' is not one of ${choices.join()}`',
	['c', 'f']
      ],

      // string
      autoSwitch: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      autoSwitchName: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],
      mqttURL: [
	(key, value) => {return typeof value === 'string'},
	'`value \'${JSON.stringify(value)}\' is not a string`'],

      // boolean
      noHistory: [
	(key, value) => {return typeof value === 'boolean'},
	'`value \'${JSON.stringify(value)}\' is not a boolean`'],
      turnOnWhenOff: [
	(key, value) => {return typeof value === 'boolean'},
	'`value \'${JSON.stringify(value)}\' is not a boolean`'],
      enableAutoOff: [
	(key, value) => {return typeof value === 'boolean'},
	'`value \'${JSON.stringify(value)}\' is not a boolean`'],
      mqttStateOnly: [
	(key, value) => {return typeof value === 'boolean'},
	'`value \'${JSON.stringify(value)}\' is not a boolean`'],

      // number
      minimumAutoOnOffDuration: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      minTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      maxTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      tempStepSize: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      temperatureUpdateFrequency: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      temperatureAdjustment: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      defaultCoolTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      defaultHeatTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      autoHeatTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      autoCoolTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      pseudoDeviceTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      heatTemperature: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
      onDuration: [
	(key, value) => {return typeof value !== 'string' && !Number.isNaN(Number(value))},
	'`value \'${JSON.stringify(value)}\' is not a number`'],
    };
    Object.keys(config).forEach((key) => {
      const match = Object.keys(options).find(y => key.match(y));
      const value = config[key];
      if (match) {
	const checker = options[match][0];
	const message = options[match][1];
	const choices = options[match][2];
	if (!checker(key, value, choices)) {
	  this.logs.config.error(`failed to verify '${key}' property. ${eval(message)}.`);
	}
      } else {
	this.logs.config.debug(`contains unknown property '${key}'.`);
      }
    })
  }
  
  correctReloadedState (state) {
    //state.targetHeatingCoolingState = state.currentHeatingCoolingState;

    //if (state.userSpecifiedTargetTemperature) {state.targetTemperature = state.userSpecifiedTargetTemperature}
  }

  setDefaults () {
    const { Characteristic } = this;
    const { config, state } = this;

    // Set config default values
    // if (config.turnOnWhenOff === undefined) {config.turnOnWhenOff = config.sendOnWhenOff || false;} // Backwards compatible with `sendOnWhenOff`
    // if (config.minimumAutoOnOffDuration === undefined) {config.minimumAutoOnOffDuration = config.autoMinimumDuration || 120;} // Backwards compatible with `autoMinimumDuration`
    config.turnOnWhenOff ??= false;
    config.minimumAutoOnOffDuration ??= 120;
    config.minTemperature ??= 10;	// HAP default
    config.maxTemperature ??= 38;	// HAP default
    config.tempStepSize ??= 1;		// HAP default: 0.1
    config.temperatureUpdateFrequency ??= 300;
    // if(config.mqttURL) {
    //   //MQTT updates when published so frequent refreshes aren't required ( 10 minute default as a fallback )
    //   config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 600;
    // } else {
    //   config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 10;
    // }
    config.units = config.units ? config.units.toLowerCase() : 'c';
    config.temperatureAdjustment ??= 0;
    config.humidityAdjustment ??= 0;
    config.autoSwitchName ??= config.autoSwitch;

    // if (config.preventResendHex === undefined && config.allowResend === undefined) {
    //   config.preventResendHex = false;
    // } else if (config.allowResend !== undefined) {
    //   config.preventResendHex = !config.allowResend;
    // }
    config.allowResend ??= true;	// should be false

    // When a temperature hex doesn't exist we try to use the hex set for these
    // default temperatures
    config.defaultCoolTemperature ??= 16;
    config.defaultHeatTemperature ??= 30;
    // ignore Humidity if set to not use it, or using Temperature source that doesn't support it
    if(config.noHumidity || config.pseudoDeviceTemperature){
      state.currentHumidity = null;
      config.noHumidity = true;
    } else {
      config.noHumidity = false;
    }

    // Used to determine when we should use the defaultHeatTemperature or the
    // defaultHeatTemperature
    config.heatTemperature ??= 22;

    // Set state default values
    // state.targetTemperature ??= config.minTemperature;
    // state.targetTemperature ??= config.maxTemperature || config.minTemperature;
    state.currentHeatingCoolingState ??= Characteristic.CurrentHeatingCoolingState.OFF;
    state.targetHeatingCoolingState ??= Characteristic.TargetHeatingCoolingState.OFF;
    state.firstTemperatureUpdate = true;

    // Check required properties
    if (config.pseudoDeviceTemperature) {
      assert.isBelow(config.pseudoDeviceTemperature, config.maxTemperature + 1, `\x1b[31m[CONFIG ERROR] \x1b[33mpseudoDeviceTemperature\x1b[0m (${config.pseudoDeviceTemperature}) must be less than the maxTemperature (${config.maxTemperature})`)
      assert.isAbove(config.pseudoDeviceTemperature, config.minTemperature - 1, `\x1b[31m[CONFIG ERROR] \x1b[33mpseudoDeviceTemperature\x1b[0m (${config.pseudoDeviceTemperature}) must be more than the minTemperature (${config.minTemperature})`)
    }

    // minTemperature can't be more than 10 or HomeKit throws a fit - This limitation has been removed
    //assert.isBelow(config.minTemperature, 11, `\x1b[31m[CONFIG ERROR] \x1b[33mminTemperature\x1b[0m (${config.minTemperature}) must be <= 10`)

    // maxTemperature > minTemperature
    assert.isBelow(config.minTemperature, config.maxTemperature, `\x1b[31m[CONFIG ERROR] \x1b[33mmaxTemperature\x1b[0m (${config.minTemperature}) must be more than minTemperature (${config.minTemperature})`)
  }

  reset () {
    const NULL = () => {};	// disables 'Error: Timeout Cancelled'
    super.reset();

    this.state.isRunningAutomatically = false;

    if (this.shouldIgnoreAutoOnOffPromise) {
      this.shouldIgnoreAutoOnOffPromise.cancel(NULL);
      this.shouldIgnoreAutoOnOffPromise = undefined;

      this.shouldIgnoreAutoOnOff = false;
    }

    if (this.turnOnWhenOffDelayPromise) {
      this.turnOnWhenOffDelayPromise.cancel(NULL);
      this.turnOnWhenOffDelayPromise = undefined;
    }

    if (this.autoOffTimeoutPromise) {
      this.autoOffTimeoutPromise.cancel(NULL);
      this.autoOffTimeoutPromise = null;
    }
  }

  async updateServiceCurrentHeatingCoolingState (targetHeatingCoolingState) {
    const { Characteristic } = this;
    const { serviceManager, state } = this;
    const keys = this.HeatingCoolingConfigKeys;
    let update = targetHeatingCoolingState;

    this.state.currentHeatingCoolingState = targetHeatingCoolingState;
    if (targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.AUTO) {
      if (state.currentTemperature <= state.targetTemperature) {
	update = Characteristic.CurrentHeatingCoolingState.COOL;
      } else {
	update = Characteristic.CurrentHeatingCoolingState.HEAT;
      }
    }
    serviceManager.updateCharacteristic(Characteristic.TargetHeatingCoolingState, targetHeatingCoolingState);	// to sync state0
    if (serviceManager.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value === update) return;
    this.logs.debug(`updateServiceCurrentHeatingCoolingState current:${keys[this.state['currentHeatingCoolingState']]} target:${keys[targetHeatingCoolingState]} update:${keys[update]}`);

    // Use low-level API to keep CurrentHeatingCoolingState as TargetHeatingCoolingState
    serviceManager.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(update);
  }

  async getCurrentHeatingCoolingState (current) {
    const { Characteristic } = this;
    const { state } = this;
    const keys = this.HeatingCoolingConfigKeys;
    const target = state.targetHeatingCoolingState;
    let update = current;

    if (current !== Characteristic.TargetHeatingCoolingState.OFF &&
	target === Characteristic.TargetHeatingCoolingState.AUTO) {
      if (state.currentTemperature <= state.targetTemperature) {
	update = Characteristic.TargetHeatingCoolingState.COOL;
      } else {
	update = Characteristic.TargetHeatingCoolingState.HEAT;
      }
      this.logs.debug(`getCurrentHeatingCoolingState current:${keys[current]} update:${keys[update]}`);
    }

    return update;
  }


  // Allows this accessory to know about switch accessories that can determine whether
  // auto-on/off should be permitted.
  updateAccessories (accessories) {
    const { config } = this;
    const { autoSwitchName } = config;

    if (!autoSwitchName) {return;}

    this.logs.info(`Linking autoSwitch "${autoSwitchName}"`);

    const autoSwitchAccessories = accessories.filter(accessory => accessory.name === autoSwitchName);

    if (autoSwitchAccessories.length === 0) {
      return this.logs.error(`No accessory could be found with the name "${autoSwitchName}". Please update the "autoSwitchName" value or add a matching switch accessory.`);
    }

    this.autoSwitchAccessory = autoSwitchAccessories[0];
  }

  isAutoSwitchOn () {
    return (!this.autoSwitchAccessory || (this.autoSwitchAccessory && this.autoSwitchAccessory.state && this.autoSwitchAccessory.state.switchState));
  }

  async setTargetTemperature(HexData, previousValue) {
    const { Characteristic } = this;
    const { HeatingCoolingConfigKeys, config, state } = this;
    const { allowResend } = config;

    if (state.targetHeatingCoolingState === state.currentHeatingCoolingState &&
	state.targetTemperature === state.userSpecifiedTargetTemperature && !allowResend && !this.previouslyOff) {
      this.logs.debug(`setTargetTemperature: No updates on targetTemperature(${state.targetTemperature}) and targetHeatingCoolingState(${state.targetHeatingCoolingState})`);
      return;
    }

    this.previouslyOff = false;
    
    const mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
    const x = this.dataKeys(`${mode}`).sort();
    const modemin = parseInt(x[0]);
    const modemax = parseInt(x[x.length - 1]);
    let temperature = state.targetTemperature ?? (mode === 'heat' ? config.defaultHeatTemperature : config.defaultCoolTemperature);
    if (temperature < modemin || temperature > modemax) {
      // Selecting a heating/cooling state allows a default temperature to be used for the given state.
      if (state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.AUTO) {
	temperature = temperature -  modemax > 0 ? modemax : modemin;
      } else if (state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.HEAT) {
        temperature = modemin;
      } else if (state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.COOL) {
        temperature = modemax;
      }
    }
    
    // if (temperature < minTemperature) {
    //   throw new Error(`The target temperature (${temperature}) must be more than the minTemperature (${minTemperature})`);
    // }
    // if (temperature > maxTemperature) {
    //   throw new Error(`The target temperature (${temperature}) must be less than the maxTemperature (${maxTemperature})`);
    // }
    // if (temperature < modemin) {
    //   // state.targetTemperature = previousValue;
    //   throw new Error(`Target temperature ${temperature} is below minimal ${mode} temperature ${modemin}`);
    // } else if (temperature > modemax) {
    //   // state.targetTemperature = previousValue;
    //   throw new Error(`Target temperature ${temperature} is above maxmum ${mode} temperature ${modemax}`);
    // }
    // serviceManager.updateCharacteristic(Characteristic.TargetTemperature, temperature);

    // Do the actual sending of the temperature
    await this.sendTemperature(temperature, previousValue);
  }

  async setTargetHeatingCoolingState(hexData, previousValue) {
    const { Characteristic } = this;
    const { HeatingCoolingStates, config, data, state } = this;
    const { allowResend, replaceAutoMode } = config;

    try {
      // Some calls are made to this without a value for some unknown reason
      if (state.targetHeatingCoolingState === undefined) {
	return;
      }
      
      // Check to see if it's changed
      if (state.targetHeatingCoolingState === state.currentHeatingCoolingState && !allowResend) {
	this.logs.debug(`setTargetHeatingCoolingState: No updates on targetTemperature(${state.targetTemperature}) and targetHeatingCoolingState(${state.targetHeatingCoolingState})`);
	return;
      }
      
      if (state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.OFF) {
	await this.performSend(data.off);
	await this.updateServiceCurrentHeatingCoolingState(Characteristic.TargetHeatingCoolingState.OFF);
	
	this.reset();
	
	return;
      }
      
      if (previousValue === Characteristic.TargetHeatingCoolingState.OFF) {
	this.previouslyOff = true;
      }
      
      // If the air-conditioner is turned off then turn it on first and try this again
      if (await this.checkTurnOnWhenOff()) {
	this.turnOnWhenOffDelayPromise = delayForDuration(.3);
	await this.turnOnWhenOffDelayPromise
      }
      
      // Perform the auto -> cool/heat conversion if `replaceAutoMode` is specified
      if (replaceAutoMode && state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.AUTO) {
	this.logs.info(`setTargetHeatingCoolingState (converting from auto to ${replaceAutoMode})`);
	// await this.updateServiceTargetHeatingCoolingState(HeatingCoolingStates[replaceAutoMode]);
	this.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, HeatingCoolingStates[replaceAutoMode]);
	
	return;
      }
      
      // const mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
      // const x = this.dataKeys(`${mode}`).sort();
      // const modemin = Number(x[0]);
      // const modemax = Number(x[x.length - 1]);
      // this.logs.debug(`setTargetHeatingCoolingState mode(${mode}) range[${modemin}, ${modemax}]`);
      // serviceManager.getCharacteristic(Characteristic.TargetTemperature).setProps({
      //   minValue: modemin,
      //   maxValue: modemax,
      //   minstep: 1
      // });
      // this.serviceManager.refreshCharacteristicUI(Characteristic.TargetTemperature);
      
      // serviceManager.setCharacteristic(Characteristic.TargetTemperature, temperature);
      await this.setTargetTemperature(undefined, undefined);
    } catch(e) {
      this.serviceManager.updateCharacteristic(Characteristic.TargetHeatingCoolingState, previousValue);
      this.logs.trace(`reverted targetHeatingCoolingState:${this.state.targetHeatingCoolingState} currentHeatingCoolingState:${this.state.currentHeatingCoolingState} targetTemperature:${this.state.targetTemperature}`);
      throw(e);
    }
  }

  async checkAutoOff () {
    const {config, data} = this;
    const {enableAutoOff, enableAutoOn} = config;
    let {onDuration} = config;
    onDuration = onDuration || 60;
    
    if (enableAutoOn) {
      this.logs.error(`enableAutoOn is not supported.`);
    } else if (enableAutoOff && parseInt(onDuration) > 0) {
      if (this.autoOffTimeoutPromise) {
	const NULL = () => {};	// disables 'Error: Timeout Cancelled'
	this.autoOffTimeoutPromise.cancel(NULL);
	this.autoOffTimeoutPromise = null;
      }
      this.logs.info(`automatically turns off in ${onDuration} seconds.`);
      this.autoOffTimeoutPromise = delayForDuration(onDuration);
      await this.autoOffTimeoutPromise;
      try {
	this.logs.info(`turned off due to exceeding ${onDuration} onDuration seconds.`);
	await this.performSend(data.off);
	// await this.updateServiceTargetHeatingCoolingState(this.HeatingCoolingStates.off);
	// await this.updateServiceCurrentHeatingCoolingState(this.HeatingCoolingStates.off);
	await this.serviceManager.updateCharacteristic(Characteristic.TargetHeatingCoolingState, this.HeatingCoolingStates.off);
	await this.serviceManager.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, this.HeatingCoolingStates.off);
      } catch (e) {
	// nothing to do.
      }
    }
  }

  // Thermostat
  async sendTemperature (temperature, previousTemperature) {
    const { Characteristic } = this;
    const { HeatingCoolingConfigKeys, HeatingCoolingStates, /*config, */state } = this;
    // const { allowResend/*, ignoreTemperatureWhenOff*/ } = config;

    this.logs.debug(`Potential sendTemperature (${temperature})`);

    try {
      // what is the case to need ignoreTemperatureWhenOff?
      // Need to aware temperature === undefined?
      // // Ignore Temperature if off, staying off - and set to ignore. OR temperature not provided
      // if ((!state.targetHeatingCoolingState && ignoreTemperatureWhenOff) || !temperature) {
      // 	this.logs.info(`Ignoring sendTemperature due to "ignoreTemperatureWhenOff": true or no temperature set.`);
      // 	return;
      // }
      
      // let mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
      const mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
      const { hexData, finalTemperature } = this.getTemperatureHexData(mode, temperature);
      // state.targetTemperature = finalTemperature;
      
      // // Update the heating/cooling mode based on the pseudo-mode - if pressent.
      // if (hexData['pseudo-mode']){
      // 	mode = hexData['pseudo-mode'];
      //        // Won't come here. getTemperatureHexData would return mode less HEX.
      // 	if (mode) {assert.oneOf(mode, [ 'heat', 'cool', 'auto' ], `\x1b[31m[CONFIG ERROR] \x1b[33mpseudo-mode\x1b[0m should be one of "heat", "cool" or "auto"`)}
      // 	// await this.updateServiceCurrentHeatingCoolingState(HeatingCoolingStates[mode]);
      // }
      
      if (state.targetHeatingCoolingState !== Characteristic.TargetHeatingCoolingState.OFF) {
	if (state.currentHeatingCoolingState !== state.targetHeatingCoolingState ||
	    previousTemperature !== finalTemperature || state.firstTemperatureUpdate /*|| allowResend*/){
	  //Set the temperature
	  this.logs.info(`sendTemperature: ${mode} ${finalTemperature}`);
	  await this.performSend(hexData.data || hexData);	// may throw in here.
	  await this.updateServiceCurrentHeatingCoolingState(HeatingCoolingStates[mode]);
	  state.firstTemperatureUpdate = false;
	  
	  this.checkAutoOff();
	}
	// this.serviceManager.updateCharacteristic(Characteristic.TargetTemperature, finalTemperature);
      
	// // Used within correctReloadedState() so that when re-launching the accessory it uses
	// // this temperature rather than one automatically set.
	// state.userSpecifiedTargetTemperature = finalTemperature;
      }
      // } else {
      // 	this.serviceManager.updateCharacteristic(Characteristic.TargetTemperature, previousTemperature);
      // }
      this.serviceManager.updateCharacteristic(Characteristic.TargetTemperature, finalTemperature);
      
      // Used within correctReloadedState() so that when re-launching the accessory it uses
      // this temperature rather than one automatically set.
      state.userSpecifiedTargetTemperature = finalTemperature;
    } catch(e) {
      this.serviceManager
	// .updateCharacteristic(Characteristic.TargetHeatingCoolingState, currentHeatingCoolingState)
	// .updateCharacteristic(Characteristic.CurrentHeatingCoolingState, currentHeatingCoolingState)
	.updateCharacteristic(Characteristic.TargetTemperature, previousTemperature);
      this.logs.trace(`reverted targetHeatingCoolingState:${this.state.targetHeatingCoolingState} currentHeatingCoolingState:${this.state.currentHeatingCoolingState} targetTemperature:${this.state.targetTemperature}`);
      throw(e);
    }
  }

  getTemperatureHexData(mode, temperature) {
    const { config, data } = this;
    const { defaultHeatTemperature, defaultCoolTemperature, heatTemperature } = config;

    let finalTemperature = temperature;
    if (mode === 'off') {
      const hexData = data.off;
      return { finalTemperature, hexData };
    }
    const x = this.dataKeys(`${mode}`);
    finalTemperature = x.length > 0 && Number(x.reduce((previous, current) => Math.abs(current - temperature) < Math.abs(previous - temperature) ? current : previous));
    let hexData = data?.[`${mode}${finalTemperature}`];
    this.logs.debug(`getTemperatureHexData mode(${mode}) choice[${x}] temperature(${temperature}) closest(${finalTemperature})`);

    if (!hexData && finalTemperature !== false) {
      // Mode based code not found, try mode-less
      this.logs.warn(`No ${mode}${finalTemperature} HEX code found. Use temperature${finalTemperature} HEX code instead.`);
      hexData = data?.[`temperature${finalTemperature}`];
    }

    // You may not want to set the hex data for every single mode...
    if (!hexData) {
      const defaultTemperature = (temperature >= heatTemperature) ? defaultHeatTemperature : defaultCoolTemperature;
      hexData = data?.[`temperature${defaultTemperature}`];

      assert(hexData, `\x1b[31m[CONFIG ERROR] \x1b[0m You need to provide a hex code for the following temperature:
        \x1b[33m{ "temperature${temperature}": { "data": "HEXCODE", "pseudo-mode" : "heat/cool" } }\x1b[0m
        or provide the default temperature:
        \x1b[33m { "temperature${defaultTemperature}": { "data": "HEXCODE", "pseudo-mode" : "heat/cool" } }\x1b[0m`);

      this.logs.info(`Update to default temperature (${defaultTemperature})`);
      finalTemperature = defaultTemperature;
    }

    return { finalTemperature, hexData }
  }

  async checkTurnOnWhenOff () {
    const { Characteristic } = this;
    const { config, data, state } = this;
    const { on } = data;

    if (state.currentHeatingCoolingState === Characteristic.TargetHeatingCoolingState.OFF && config.turnOnWhenOff) {
      this.logs.info(`sending "on" hex before sending temperature`);

      if (on) {
        await this.performSend(on);
      } else {
        this.logs.error(`No On Hex configured, but turnOnWhenOff enabled.`);
      }

      return true;
    }

    return false;
  }

  // Device Temperature Methods

  async monitorTemperature () {
    const { config, host, log } = this;
    const { pseudoDeviceTemperature} = config;

    if (pseudoDeviceTemperature !== undefined) {return;}
    let device;
    for (let i = 0; !device; i++) {
      if ((device = getDevice({ host, log })))
	break;
      if (i > 10) {
	this.logs.error(`disabled temperature/humidity monitoring. device ${host} not responding.`);
	return;
      }
      this.logs.trace(`waiting device ${host} to be ready for 1 sec. attempt:${i+1}`);
      await delayForDuration(1);
    }
    this.logs.trace(`monitorTemperature: device ${host} ready.`);

    device.on('temperature', this.onTemperature.bind(this));
    // device.checkTemperature(logLevel);

    this.logs.info(`updating temperature/humidity every ${config.temperatureUpdateFrequency} secs.`);
    if (!this.isUnitTest) setInterval(this.getCurrentTemperature.bind(this), config.temperatureUpdateFrequency * 1000);
  }

  async onTemperature(temperature, humidity) {
    const { Characteristic } = this;
    const { config, state } = this;
    const { temperatureAdjustment, humidityAdjustment, noHumidity, tempSourceUnits } = config;

    if (!Number.isNaN(Number(temperature))) {
      temperature += temperatureAdjustment;
      if (tempSourceUnits == 'F') {temperature = (temperature - 32) * 5/9;}
      state.currentTemperature = temperature;
      this.logs.trace(`onTemperature: update temperature ${temperature}`);
      this.serviceManager.getCharacteristic(Characteristic.CurrentTemperature).updateValue(temperature);
    }

    if (!noHumidity && !Number.isNaN(Number(humidity))) {
      humidity += humidityAdjustment;
      state.currentHumidity = humidity;
      this.logs.trace(`onTemperature: update humidity ${humidity}`);
      this.serviceManager.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(humidity);
    }
    
    //Process Fakegato history
    if (!Number.isNaN(Number(this.state.currentTemperature))) {
      if (!config.noHistory) {
	//this.lastUpdatedAt = Date.now();
	this.logs.trace(`onTemperature: Logging data to history. temperture: ${this.state.currentTemperature}, humidity: ${this.state.currentHumidity}`);
	if (noHumidity) {
          this.historyService.addEntry({ time: Math.round(new Date().valueOf() / 1000), temp: this.state.currentTemperature });
	} else {
          this.historyService.addEntry({ time: Math.round(new Date().valueOf() / 1000), temp: this.state.currentTemperature, humidity: this.state.currentHumidity });
	}
      }
      if (noHumidity) {
	await this.mqttpublish('temperature', `{"temperature":${this.state.currentTemperature}}`);
      } else {
	await this.mqttpublish('temperature', `{"temperature":${this.state.currentTemperature}, "humidity":${this.state.currentHumidity}}`);
      }
    }
    
    this.updateServiceCurrentHeatingCoolingState(state.targetHeatingCoolingState);
    this.checkTemperatureForAutoOnOff(temperature);
  }

  async thermoHistory() {
    const {noHistory, enableModeHistory} = this.config;
    if (noHistory !== true && enableModeHistory) {
      const {targetHeatingCoolingState, currentTemperature, targetTemperature} = this.state;
      let valve = 0;
      if (targetHeatingCoolingState) {
	valve = (currentTemperature - targetTemperature)/targetTemperature*100*2 + 50;
	valve = valve < 1 ? 1 : (valve > 100 ? 100 : valve); 
	this.historyService.addEntry({
	  time: Math.round(new Date().valueOf() / 1000),
	  setTemp: this.state.targetTemperature,
	  valvePosition: valve
	});
      }
      
      this.valveInterval = Math.min(this.valveInterval * 1/0.7, 10);
      this.valveTimer = setTimeout(() => {
	this.thermoHistory();
      }, Math.round(this.valveInterval * 60 * 1000));
    }
  }

  updateTemperature () {
    const { config, host, logLevel, log } = this;
    const { mqttURL, mqttTopic, temperatureFilePath, noHumidity } = config;

    // Read temperature from file
    if (temperatureFilePath) {
      this.updateTemperatureFromFile();

      return;
    }

    // Read temperature from mqtt
    if (mqttURL) {
      let topic, temperature, humidity;
      if ((topic = mqttTopic?.filter(x => x.identifier.match(/^unknown$/i))[0])) {
	temperature = this.mqttValueForIdentifier('temperature');
	humidity = noHumidity ? undefined : this.mqttValueForIdentifier('humidity');
	this.logs.trace(`updateTemperature: {mqttValueForIdentifier: {"tepmerature":${temperature}, "humidity":${humidity}}}`);
	this.onTemperature(temperature, humidity);
	return;
      }
      if ((topic = mqttTopic?.filter(x =>
	x.identifier.match(/^temperature$/i) ||
	  x.characteristic?.match(/^currenttemperature$/i))[0])) {
	temperature = this.mqttValueForIdentifier(topic.identifier);
	this.logs.trace(`updateTemperature: {mqttValueForIdentifier: {"${topic.identifier}":${temperature}}}`);
	if ((topic = mqttTopic?.filter(x =>
	  x.identifier.match(/^humidity$/i) ||
	    x.characteristic?.match(/^currentrelativehumidity$/i))[0])) {
	  humidity = noHumidity ? undefined : this.mqttValueForIdentifier(topic.identifier);
	  this.logs.trace(`updateTemperature: {mqttValueForIdentifier: {"${topic.identifier}":${humidity}}}`);
	}
	this.onTemperature(temperature, humidity);
	return;
      }
    }

    // Read temperature from Broadlink RM device
    // If the device is no longer available, use previous tempeature
    const device = getDevice({ host, log });

    if (!device || device.state === 'inactive') {
      this.logs.warn(`updateTemperature: device no longer active, using existing temperature`);

      return;
    }

    if (device.checkTemperature) {
      device.checkTemperature(logLevel);
      this.logs.trace(`updateTemperature: requested temperature from device, waiting`);
    } else {
      this.logs.error(`unable to get temperature. checkTemperature/Humidity not supported for device 0x${device.type.toString(16)}.`);
    }
  }

  updateTemperatureFromFile () {
    const { config, state } = this;
    const { temperatureFilePath, noHumidity} = config;
    let humidity = null;
    let temperature = null;

    this.logs.trace(`updateTemperatureFromFile reading file: ${temperatureFilePath}`);

    fs.readFile(temperatureFilePath, 'utf8', (err, data) => {
      if (err) {
        this.logs.error(`updateTemperatureFromFile\n\n${err.message}`);
      }

      if (data === undefined || data.trim().length === 0) {
        this.logs.warn(`updateTemperatureFromFile error reading file: ${temperatureFilePath}, using previous Temperature`);
        if (!noHumidity) {humidity = (state.currentHumidity || 0);}
        temperature = (state.currentTemperature || 0);
      }

      const lines = data.split(/\r?\n/);
      if (/^[0-9]+\.*[0-9]*$/.test(lines[0])){
        temperature = parseFloat(data);
      } else {
        lines.forEach((line) => {
          if(-1 < line.indexOf(':')){
            const value = line.split(':');
            if(value[0] == 'temperature') {temperature = parseFloat(value[1]);}
            if(value[0] == 'humidity' && !noHumidity) {humidity = parseFloat(value[1]);}
          }
        });
      }

      this.logs.trace(`updateTemperatureFromFile (parsed temperature: ${temperature} humidity: ${humidity})`);

      this.onTemperature(temperature, humidity);
    });
  }

  getCurrentTemperature (callback = undefined) {
    const { Characteristic } = this;
    const { config, state } = this;
    const { pseudoDeviceTemperature } = config;

    // Some devices don't include a thermometer and so we can use `pseudoDeviceTemperature` instead
    if (pseudoDeviceTemperature !== undefined) {
      this.logs.trace(`getCurrentTemperature: using pseudoDeviceTemperature ${pseudoDeviceTemperature} from config`);
      this.serviceManager.updateCharacteristic(Characteristic.CurrentTemperature, pseudoDeviceTemperature);
      return callback?.(Number.isNaN(Number(pseudoDeviceTemperature)), pseudoDeviceTemperature);
    }

    this.logs.trace(`${callback ? '*' : ''}getCurrentTemperature: ${state.currentTemperature}`);
    callback?.(Number.isNaN(Number(this.state.currentTemperature)), state.currentTemperature);

    this.updateTemperature();
  }

  getCurrentHumidity (callback) {
    const { state } = this;

    this.logs.trace(`*getCurrentHumidity: ${state.currentHumidity}`);
    return callback(Number.isNaN(Number(this.state.currentHumidity)), state.currentHumidity);
  }

  async checkTemperatureForAutoOnOff (temperature) {
    const { Characteristic } = this;
    const { config, serviceManager } = this;
    const { autoHeatTemperature, autoCoolTemperature, minimumAutoOnOffDuration } = config;

    if (this.shouldIgnoreAutoOnOff) {
      this.logs.info(`checkTemperatureForAutoOn (ignore within ${minimumAutoOnOffDuration}s of previous auto-on/off due to "minimumAutoOnOffDuration")`);

      return;
    }

    if (!autoHeatTemperature && !autoCoolTemperature) {return;}

    if (!this.isAutoSwitchOn()) {
      this.logs.info(`checkTemperatureForAutoOnOff (autoSwitch is off)`);
      return;
    }

    this.logs.debug(`checkTemperatureForAutoOnOff`);

    if (autoHeatTemperature && temperature < autoHeatTemperature) {
      this.state.isRunningAutomatically = true;

      this.logs.info(`checkTemperatureForAutoOnOff (${temperature} < ${autoHeatTemperature}: auto heat)`);
      serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    } else if (autoCoolTemperature && temperature > autoCoolTemperature) {
      this.state.isRunningAutomatically = true;

      this.logs.info(`checkTemperatureForAutoOnOff (${temperature} > ${autoCoolTemperature}: auto cool)`);
      serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    } else {
      this.logs.debug(`checkTemperatureForAutoOnOff (temperature is ok)`);

      if (this.state.isRunningAutomatically) {
        this.isAutomatedOff = true;
        this.logs.info(`checkTemperatureForAutoOnOff (auto off)`);
        serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
      } else {
        return;
      }
    }

    this.shouldIgnoreAutoOnOff = true;
    this.shouldIgnoreAutoOnOffPromise = delayForDuration(minimumAutoOnOffDuration);
    await this.shouldIgnoreAutoOnOffPromise;

    this.shouldIgnoreAutoOnOff = false;
  }

  getTemperatureDisplayUnits (callback) {
    const { Characteristic } = this;
    const { config } = this;
    const temperatureDisplayUnits = (config.units.toLowerCase() === 'f') ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS;

    callback(null, temperatureDisplayUnits);
  }

  dataKeys (filter) {
    const { data } = this;
    const allHexKeys = Object.keys(data || {});

    if (!filter) {return allHexKeys;}

    // Create an array of value specified in the data config
    return allHexKeys
      // .map(x => x.match(new RegExp(`^(${filter}|temperature)([\\d\\.]+)$`), 'i')?.[2])
      .map(x => {
	const y = x.match(new RegExp(`^(${filter}|temperature)([\\d\\.]+)$`), 'i');
	if (!y) {
	  return null;
	} else if (y[1] === 'temperature') {
	  return data[x]['pseudo-mode'] === filter ? y[2] : null;
	} else {
	  return y[2];
	}
      })
      .filter(x => x);
  }

  // MQTT
  async onMQTTMessage (identifier, message) {
    const { Characteristic } = this;
    const { config } = this;
    const mqttStateOnly = config.mqttStateOnly === false ? false : true;
    this.logs.trace(`onMQTTMessage: Received {identifier:"${identifier}", message:${message}}`);

    if (identifier.toLowerCase() === 'mode' ||
	identifier.toLowerCase() === 'targetheatingcoolingstate' ||
	identifier.toLowerCase() === 'targetheatercoolerstate') {
      const mode = message.toLowerCase();
      switch (mode) {
      case 'off':
      case 'heat':
      case 'cool':
      case 'auto':
	{
	  const state = this.HeatingCoolingStates[mode];
	  this.reset();
	  if (mqttStateOnly) {
	    this.serviceManager.updateCharacteristic(Characteristic.TargetHeatingCoolingState, state);
	    await this.updateServiceCurrentHeatingCoolingState(state);
	  } else {
	    // await this.updateServiceTargetHeatingCoolingState(state);
	    this.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, state);
	  }
	}
	this.logs.debug(`onMQTTMessage: set targetHeatingCoolingState to ${this.state.targetHeatingCoolingState}.`);
	break;
      default:
	this.logs.error(`onMQTTMessage: Unexpected targetHeatingCoolingState "${message}".`);
      }
      return;
    }

    if (identifier.toLowerCase() === 'targettemperature' ||
	identifier.toLowerCase() === 'coolingthresholdtemperature' ||
	identifier.toLowerCase() === 'heatingthresholdtemperature') {
      const target = Number(message);
      if (!Number.isNaN(target) && target >= config.minTemperature && target <= config.maxTemperature) {
	if (mqttStateOnly) {
	  this.serviceManager.updateCharacteristic(Characteristic.TargetTemperature, target);
	} else {
	  this.serviceManager.setCharacteristic(Characteristic.TargetTemperature, target);
	}
	this.logs.debug(`onMQTTMessage: set targetTemperature to ${target}.`);
      } else {
	this.logs.error(`onMQTTMessage: Unexpected targetTemperature "${message}".)`);
      }
      return;
    }

    if (identifier.toLowerCase() === 'unknown') {
      try {
	let temperature = Number(message), humidity = undefined;
	if (Number.isNaN(temperature)) {
	  const value = JSON.parse(message);
	  temperature = Number(this.findKey(value, '^temp$|^temperature$')?.[0]);
	  this.logs.trace(`onMQTTMessage: parsed temperture ${temperature}`);
	  if (Number.isNaN(temperature)) {
	    this.logs.error(`onMQTTMessage: couldn't be found temperature value in ${message}.`);
	    this.mqttValues['temperature'] = undefined;
	  } else {
	    this.mqttValues['temperature'] = temperature;
	  }
	  if (!config.noHumidity) {
	    humidity = Number(this.findKey(value, '^humidity$|^relativehumidity$')?.[0]);
	    this.logs.trace(`onMQTTMessage: parsed himidity ${humidity}`);
	    if (Number.isNaN(temperature)) {
	      this.logs.error(`onMQTTMessage: couldn't be found humidity value in ${message}.`);
	      this.mqttValues['humidity'] = undefined;
	    } else {
	      this.mqttValues['humidity'] = humidity;
	    }
	  }
	  this.onTemperature(temperature, humidity);
	} else {
	  this.logs.trace(`onMQTTMessage: parsed temperture ${temperature}`);
	  this.mqttValues['temperature'] = temperature;
	  this.onTemperature(temperature, undefined);
	}
      } catch (e) {
	this.logs.error(`onMQTTMessage: "${identifier}:${message}" couldn't be parsed. ${e}`);
	this.mqttValues['temperature'] = undefined;
	// this.mqttValues['humidity'] = undefined;
      }
      return;
    }
    
    try {
      let value = Number(message);
      if (Number.isNaN(value)) {
	value = Number(this.findKey(JSON.parse(message), identifier)?.[0]);
      }
      this.logs.trace(`onMQTTMessage: parsed ${identifier} ${value}`);
      if (Number.isNaN(value)) {
	this.logs.error(`onMQTTMessage: couldn't be found ${identifier} value in ${message}.`);
	this.mqttValues[identifier] = undefined;
      } else {
	this.mqttValues[identifier] = value;
      }

      const characteristic = this.config.mqttTopic.find(x => x.identifier === identifier)?.characteristic?.toLowerCase();
      if (identifier.toLowerCase() === 'temperature' || characteristic === 'currenttemperature') {
	this.onTemperature(value, undefined);
      } else if (identifier.toLowerCase() === 'humidity' || characteristic === 'currentrelativehumidity') {
	this.onTemperature(undefined, value);
      } else {
	this.logs.error(`onMQTTMessage: Unexpected identifier "${identifier}" with message "${message}".`);
      }
    } catch (e) {
      this.logs.error(`onMQTTMessage: "${identifier}:${message}" couldn't be parsed. ${e}`);
      this.mqttValues[identifier] = undefined;
    }
  }

  findKey = (jsObject, requiredKey, results = undefined) => {
    const rx = new RegExp(requiredKey, 'i');
    for (const key in jsObject) {
      const value = jsObject[key];
      if (key.match(rx) && !results?.includes(value)) {
	results = results ?? [];
        results.push(value);
      }
      if ((typeof value) === 'object') {
        results = this.findKey(value, requiredKey, results);
      }
    }
    
    return results;
  }

  getCurrentValvePosition(callback) {
    let valve = 0;
    const {targetHeatingCoolingState, currentTemperature, targetTemperature} = this.state;
    if (targetHeatingCoolingState) {
      valve = (currentTemperature - targetTemperature)/targetTemperature*100*2 + 50;
      valve = valve < 1 ? 1 : (valve > 100 ? 100 : valve);
    }
    this.logs.trace(`getCurrentValvePosition: ${valve}`);
    callback(Number.isNaN(Number(valve)), valve);
  }
  
  setProgramCommand(value, callback) {
    // not implemented
    //console.log('setProgramCommand() is requested. %s', value, this.displayName);
    callback();
  }
  
  getProgramData(callback) {
    // not implemented
    //    var data  = "12f1130014c717040af6010700fc140c170c11fa24366684ffffffff24366684ffffffff24366684ffffffff24366684ffffffff24366684ffffffff24366684ffffffff24366684fffffffff42422222af3381900001a24366684ffffffff";
    var data  = "ff04f6";
    var buffer = new Buffer.from(('' + data).replace(/[^0-9A-F]/ig, ''), 'hex').toString('base64');
    //console.log('getProgramData() is requested. (%s)', buffer, this.displayName);
    callback(null, buffer);
  }

  // Service Manager Setup

  setupServiceManager () {
    const { Service, Characteristic } = this;
    const { config, name } = this;

    this.serviceManager = new this.serviceManagerClass(name, Service.Thermostat, this.log);

    config.enableTargetTemperatureHistory = config.enableTargetTemperatureHistory === true || false;
    config.enableModeHistory = config.enableModeHistory === true || config.enableTargetTemperatureHistory === true || false;
    if (config.noHistory !== true) {
      if (config.enableTargetTemperatureHistory === true) {
	this.logs.info(`accessory is configured to record HeatingCoolingState and targetTemperature histories.`);
      } else if (config.enableModeHistory === true) {
	this.logs.info(`accessory is configured to record HeatingCoolingState history.`);
      }
    }

    if(config.noHistory !== true && config.enableModeHistory) {
      this.serviceManager.service.addOptionalCharacteristic(this.platform.eve.Characteristics.ValvePosition);
      this.serviceManager.addGetCharacteristic({
	name: 'currentValvePosition',
	type: this.platform.eve.Characteristics.ValvePosition,
	// type: ValvePositionCharacteristic,
	method: this.getCurrentValvePosition,
	bind: this
      });
      
      if (config.enableTargetTemperatureHistory) {
	this.serviceManager.service.addOptionalCharacteristic(this.platform.eve.Characteristics.ProgramData);
	this.serviceManager.addGetCharacteristic({
	  name: 'setProgramData',
	  type: this.platform.eve.Characteristics.ProgramData,
	  // type: ProgramDataCharacteristic,
	  method: this.getProgramData,
	  bind: this,
	});
	
	this.serviceManager.service.addOptionalCharacteristic(this.platform.eve.Characteristics.ProgramCommand);
	this.serviceManager.addSetCharacteristic({
	  name: 'setProgramCommand',
	  type: this.platform.eve.Characteristics.ProgramCommand,
	  // type: ProgramCommandCharacteristic,
	  method: this.setProgramCommand,
	  bind: this,
	});
      }
    }

    this.serviceManager.addToggleCharacteristic({
      name: 'currentHeatingCoolingState',
      type: Characteristic.CurrentHeatingCoolingState,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        getValuePromise: this.getCurrentHeatingCoolingState.bind(this)
      }
    });

    // this.serviceManager.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
    //   .on('change', async function (event) {
    // 	if (event.newValue !== event.oldValue) {
    // 	  // if (this.historyService) {
    // 	    const value = event.newValue;
    // 	    // this.log(`updated CurrentHeatingCoolingState.`, value)
    // 	    await this.mqttpublish('mode', this.HeatingCoolingConfigKeys[value]);
    // 	    await this.mqttpublish('targetTemperature', this.state.targetTemperature);
    // 	  // }
    // 	}
    //   }.bind(this))

    this.serviceManager.addToggleCharacteristic({
      name: 'targetTemperature',
      type: Characteristic.TargetTemperature,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        setValuePromise: async (...args) => {
	  await this.mutex.use(async () => {
	    // console.log('setTargetTemperature', ...args, this.state);
	    await this.setTargetTemperature(...args);
	  })},
        ignorePreviousValue: true
      }
    });

    this.serviceManager.addToggleCharacteristic({
      name: 'targetHeatingCoolingState',
      type: Characteristic.TargetHeatingCoolingState,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        setValuePromise: async (...args) => {
	  await this.mutex.use(async () => {
	    // console.log('setTargetHeatingCoolingState', ...args, this.state);
	    await this.setTargetHeatingCoolingState(...args);
	  })},
        ignorePreviousValue: true
      }
    });
      
    this.serviceManager.getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('change', async function (event) {
	if (event.newValue !== event.oldValue) {
	  const value = event.newValue;
	  // this.log(`updated TargetHeatingCoolingState.`, value)
	  await this.mqttpublish('targetTemperature', this.state.targetTemperature);
	  await this.mqttpublish('mode', this.HeatingCoolingConfigKeys[value]);
	}
      }.bind(this))

    if (config.heatOnly) {
      this.serviceManager
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .setProps({
          minValue: 0,
          maxValue: 1,
          validValues: [0,1]
        });
    }
    if (config.coolOnly) {
      this.serviceManager
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .setProps({
          minValue: 0,
          maxValue: 2,
          validValues: [0,2]
        });
    }
    this.serviceManager.getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('change', async function(event) {
	if (event.newValue !== event.oldValue) {
	  if (this.historyService) {
	    this.valveInterval = 1;
	    clearTimeout(this.valveTimer);
	    this.thermoHistory();
	  }
	}
      }.bind(this))

    this.serviceManager.addGetCharacteristic({
      name: 'currentTemperature',
      type: Characteristic.CurrentTemperature,
      method: this.getCurrentTemperature,
      bind: this
    });

    if (!config.noHumidity){
      this.serviceManager.addGetCharacteristic({
        name: 'currentHumidity',
        type: Characteristic.CurrentRelativeHumidity,
        method: this.getCurrentHumidity,
        bind: this
      })
    }

    this.serviceManager.addGetCharacteristic({
      name: 'temperatureDisplayUnits',
      type: Characteristic.TemperatureDisplayUnits,
      method: this.getTemperatureDisplayUnits,
      bind: this
    })

    this.serviceManager
      .getCharacteristic(Characteristic.TargetTemperature)
      .setProps({	// safe to be undefined
        minValue: config.minTemperature,
        maxValue: config.maxTemperature,
        minStep: config.tempStepSize || 1
      })
      .on('change', async function (event) {
	if (event.newValue !== event.oldValue) {
	  const value = event.newValue;
	  if (this.historyService) {
	    // this.log(`adding history of targetTemperature.`, value)
	    this.historyService.addEntry(
	      {time: Math.round(new Date().valueOf()/1000),
	       setTemp: value || 30});
	  }
	  await this.mqttpublish('targetTemperature', value);
	}
      }.bind(this));

    this.serviceManager
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({
        minStep: 0.1
      });
  }
}

module.exports = AirConAccessory
