// -*- mode: js; js-indent-level : 2 -*-
const { assert } = require('chai');
const fs = require('fs');

const delayForDuration = require('../helpers/delayForDuration');
// const catchDelayCancelError = require('../helpers/catchDelayCancelError');
const { getDevice } = require('../helpers/getDevice');
const BroadlinkRMAccessory = require('./accessory');

class AirConAccessory extends BroadlinkRMAccessory {

  constructor (log, config = {}, platform) {
    super(log, config, platform);

    // Characteristic isn't defined until runtime so we set these the instance scope
    const { Characteristic } = this;
    const HeatingCoolingStates = {
      off: Characteristic.TargetHeatingCoolingState.OFF,
      cool: Characteristic.TargetHeatingCoolingState.COOL,
      heat: Characteristic.TargetHeatingCoolingState.HEAT,
      auto: Characteristic.TargetHeatingCoolingState.AUTO
    };
    this.HeatingCoolingStates = HeatingCoolingStates;
    config.heatOnly = config.heatOnly || false;
    config.coolOnly = config.coolOnly || false;

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

  correctReloadedState (state) {
    //state.targetHeatingCoolingState = state.currentHeatingCoolingState;

    if (state.userSpecifiedTargetTemperature) {state.targetTemperature = state.userSpecifiedTargetTemperature}
  }

  setDefaults () {
    const { Characteristic } = this;
    const { config, state } = this;

    // Set config default values
    if (config.turnOnWhenOff === undefined) {config.turnOnWhenOff = config.sendOnWhenOff || false;} // Backwards compatible with `sendOnWhenOff`
    if (config.minimumAutoOnOffDuration === undefined) {config.minimumAutoOnOffDuration = config.autoMinimumDuration || 120;} // Backwards compatible with `autoMinimumDuration`
    config.minTemperature = config.minTemperature || 10;	// HAP default
    config.maxTemperature = config.maxTemperature || 38;	// HAP default
    config.tempStepSize = config.tempStepSize || 1;	// HAP default: 0.1
    config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 300;
    // if(config.mqttURL) {
    //   //MQTT updates when published so frequent refreshes aren't required ( 10 minute default as a fallback )
    //   config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 600;
    // } else {
    //   config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 10;
    // }
    config.units = config.units ? config.units.toLowerCase() : 'c';
    config.temperatureAdjustment = config.temperatureAdjustment || 0;
    config.humidityAdjustment = config.humidityAdjustment || 0;
    config.autoSwitchName = config.autoSwitch || config.autoSwitchName;

    if (config.preventResendHex === undefined && config.allowResend === undefined) {
      config.preventResendHex = false;
    } else if (config.allowResend !== undefined) {
      config.preventResendHex = !config.allowResend;
    }

    // When a temperature hex doesn't exist we try to use the hex set for these
    // default temperatures
    config.defaultCoolTemperature = config.defaultCoolTemperature || 16;
    config.defaultHeatTemperature = config.defaultHeatTemperature || 30;
    // ignore Humidity if set to not use it, or using Temperature source that doesn't support it
    if(config.noHumidity || config.pseudoDeviceTemperature){
      state.currentHumidity = null;
      config.noHumidity = true;
    } else {
      config.noHumidity = false;
    }

    // Used to determine when we should use the defaultHeatTemperature or the
    // defaultHeatTemperature
    config.heatTemperature = config.heatTemperature || 22;

    // Set state default values
    // state.targetTemperature = state.targetTemperature || config.minTemperature;
    // state.targetTemperature = state.targetTemperature || config.maxTemperature || config.minTemperature;
    state.currentHeatingCoolingState = state.currentHeatingCoolingState || Characteristic.CurrentHeatingCoolingState.OFF;
    state.targetHeatingCoolingState = state.targetHeatingCoolingState || Characteristic.TargetHeatingCoolingState.OFF;
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

  async updateServiceTargetHeatingCoolingState (value) {
    const { Characteristic } = this;
    const { serviceManager, state, log } = this;
    const keys = this.HeatingCoolingConfigKeys;
    // this.logs.debug(`updateServiceTargetHeatingCoolingState current:${keys[this.state['targetHeatingCoolingState']]} target:${keys[value]}`);

    await delayForDuration(0.2).then(() => {
      serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, value);
    });
  }

  async updateServiceCurrentHeatingCoolingState (value) {
    const { Characteristic } = this;
    const { serviceManager, name, state, log, logLevel } = this;
    const keys = this.HeatingCoolingConfigKeys;
    let update = value;

    if (value === Characteristic.TargetHeatingCoolingState.AUTO) {
      if (state.currentTemperature <= state.targetTemperature) {
	update = Characteristic.TargetHeatingCoolingState.COOL;
      } else {
	update = Characteristic.TargetHeatingCoolingState.HEAT;
      }
    }
    // this.logs.debug(`updateServiceCurrentHeatingCoolingState current:${keys[this.state['currentHeatingCoolingState']]} target:${keys[value]} update:${keys[update]}`);
    if (state.currentHeatingCoolingState === update) return;

    await delayForDuration(0.25).then(() => {
      serviceManager.setCharacteristic(Characteristic.CurrentHeatingCoolingState, update);
    });
  }

  async getCurrentHeatingCoolingState (current) {
    const { Characteristic } = this;
    const { serviceManager, name, state, log, logLevel } = this;
    const keys = this.HeatingCoolingConfigKeys;
    let target = state.targetHeatingCoolingState;
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
    const { config, name, log, logLevel } = this;
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

  async setTargetTemperature (HexData,previousValue) {
    const { Characteristic } = this;
    const { HeatingCoolingConfigKeys, data, config, log, logLevel, name, serviceManager, state } = this;
    const { preventResendHex, minTemperature, maxTemperature } = config;

    if (state.targetTemperature === previousValue && preventResendHex && !this.previouslyOff) {return;}

    this.previouslyOff = false;

    if (state.targetTemperature < minTemperature) {
      return this.logs.error(`The target temperature (${this.targetTemperature}) must be more than the minTemperature (${minTemperature})`);
    }
    if (state.targetTemperature > maxTemperature) {
      return this.logs.error(`The target temperature (${this.targetTemperature}) must be less than the maxTemperature (${maxTemperature})`);
    }

    const mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
    const x = this.dataKeys(`${mode}`).sort();
    const modemin = parseInt(x[0]);
    const modemax = parseInt(x[x.length - 1]);
    const temperature = state.targetTemperature;
    if (temperature < modemin) {
      state.targetTemperature = previousValue;
      throw new Error(`Target temperature ${temperature} is below minimal ${mode} temperature ${modemin}`);
    } else if (temperature > modemax) {
      state.targetTemperature = previousValue;
      throw new Error(`Target temperature ${temperature} is above maxmum ${mode} temperature ${modemax}`);
    }
	
    // Used within correctReloadedState() so that when re-launching the accessory it uses
    // this temperature rather than one automatically set.
    state.userSpecifiedTargetTemperature = state.targetTemperature;

    // Do the actual sending of the temperature
    this.sendTemperature(state.targetTemperature, previousValue);
    serviceManager.refreshCharacteristicUI(Characteristic.TargetTemperature);
  }

  async setTargetHeatingCoolingState (hexData, previousValue) {
    const { Characteristic } = this;
    const { HeatingCoolingConfigKeys, HeatingCoolingStates, config, data, host, log, logLevel, name, serviceManager, state, debug } = this;
    const { preventResendHex, defaultCoolTemperature, defaultHeatTemperature, replaceAutoMode } = config;

    const targetHeatingCoolingState = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
    const lastUsedHeatingCoolingState = HeatingCoolingConfigKeys[state.lastUsedHeatingCoolingState];
    const currentHeatingCoolingState = HeatingCoolingConfigKeys[state.currentHeatingCoolingState];

    // Some calls are made to this without a value for some unknown reason
    if (state.targetHeatingCoolingState === undefined) {return;}

    // Check to see if it's changed
    if (state.targetHeatingCoolingState === state.currentHeatingCoolingState && preventResendHex) {return;}

    if (targetHeatingCoolingState === 'off') {
      await this.updateServiceCurrentHeatingCoolingState(HeatingCoolingStates.off);

      if (currentHeatingCoolingState === 'cool' && data.offDryMode !== undefined) {
        // Dry off mode when previously cooling
        this.logs.info(`Previous state ${currentHeatingCoolingState}, setting off with dry mode`);
        await this.performSend(data.offDryMode);
      } else {
        await this.performSend(data.off);
      }

      this.reset();

      return;
    }

    if (previousValue === Characteristic.TargetHeatingCoolingState.OFF) {this.previouslyOff = true;}

    // If the air-conditioner is turned off then turn it on first and try this again
    if (this.checkTurnOnWhenOff()) {
      this.turnOnWhenOffDelayPromise = delayForDuration(.3);
      await this.turnOnWhenOffDelayPromise
    }

    // Perform the auto -> cool/heat conversion if `replaceAutoMode` is specified
    if (replaceAutoMode && targetHeatingCoolingState === 'auto') {
      this.logs.info(`setTargetHeatingCoolingState (converting from auto to ${replaceAutoMode})`);
      await this.updateServiceTargetHeatingCoolingState(HeatingCoolingStates[replaceAutoMode]);

      return;
    }

    state.targetTemperature = state.targetTemperature ?? (targetHeatingCoolingState === 'heat' ? config.defaultHeatTemperature : config.defaultCoolTemperature);
    let temperature = state.targetTemperature;
    const mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
    const x = this.dataKeys(`${mode}`).sort();
    const modemin = parseInt(x[0]);
    const modemax = parseInt(x[x.length - 1]);
    this.logs.debug(`setTargetHeatingCoolingState mode(${mode}) range[${modemin}, ${modemax}] target(${temperature})`);
    // serviceManager.getCharacteristic(Characteristic.TargetTemperature).setProps({
    //   minValue: modemin,
    //   maxValue: modemax,
    //   minstep: 1
    // });
    // this.updateServiceCurrentHeatingCoolingState(state.targetHeatingCoolingState);
    
    if (state.currentHeatingCoolingState !== state.targetHeatingCoolingState){
      if (temperature < modemin || temperature > modemax) {
	
	// Selecting a heating/cooling state allows a default temperature to be used for the given state.
	if (state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.AUTO) {
	  temperature = temperature -  modemax > 0 ? modemax : mododemin;
	} else if (state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.HEAT) {
          temperature = modemin;
	} else if (state.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.COOL) {
          temperature = modemax;
	}
      }

      //Set the mode, and send the mode hex
      await this.updateServiceCurrentHeatingCoolingState(state.targetHeatingCoolingState);
      if (data.heat && mode === 'heat'){
        await this.performSend(data.heat);
      } else if (data.cool && mode === 'cool'){
        await this.performSend(data.cool);
      } else if (data.auto && mode === 'auto'){
        await this.performSend(data.auto);
      } else if (hexData) {
        //Just send the provided temperature hex if no mode codes are set
        await this.performSend(hexData);
      }

      this.logs.debug(`sentMode (${mode})`);

      //Force Temperature send
      await delayForDuration(0.25).then(() => {
        //this.sendTemperature(temperature, state.currentTemperature);	// what a bad.
        this.sendTemperature(temperature, previousValue);
        serviceManager.refreshCharacteristicUI(Characteristic.TargetTemperature);
      });
    }

    serviceManager.refreshCharacteristicUI(Characteristic.CurrentHeatingCoolingState);
    serviceManager.refreshCharacteristicUI(Characteristic.TargetHeatingCoolingState);

    this.checkAutoOff();
  }

  async checkAutoOff () {
    const {config, name, data, log} = this;
    let {enableAutoOff, onDuration, enableAutoOn, offDuration} = config;
    onDuration = onDuration|| 60;
    offDuration = offDuration|| 60;
    
    if (enableAutoOn) {
      this.logs.error(`enableAutoOn is not supported.`);
    }
    if (enableAutoOff && parseInt(onDuration) > 0) {
      if (!this.autoOffTimeoutPromise) {
	this.logs.info(`setTargetHeatingCoolingState: automatically turn off in ${onDuration} seconds`);
	this.autoOffTimeoutPromise = delayForDuration(onDuration);
	await this.autoOffTimeoutPromise;
	await this.performSend(data.off);
	await this.updateServiceTargetHeatingCoolingState(this.HeatingCoolingStates.off);
	await this.updateServiceCurrentHeatingCoolingState(this.HeatingCoolingStates.off);
      }
    }
  }

  // Thermostat
  async sendTemperature (temperature, previousTemperature) {
    const { HeatingCoolingConfigKeys, HeatingCoolingStates, config, data, host, log, name, state, logLevel } = this;
    const { preventResendHex, defaultCoolTemperature, heatTemperature, ignoreTemperatureWhenOff, sendTemperatureOnlyWhenOff } = config;

    this.logs.debug(`Potential sendTemperature (${temperature})`);

    // Ignore Temperature if off, staying off - and set to ignore. OR temperature not provided
    if ((!state.targetHeatingCoolingState && ignoreTemperatureWhenOff) || !temperature) {
      this.logs.info(`Ignoring sendTemperature due to "ignoreTemperatureWhenOff": true or no temperature set.`);
      return;
    }

    let mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
    const { hexData, finalTemperature } = this.getTemperatureHexData(mode, temperature);
    state.targetTemperature = finalTemperature;

    // Update the heating/cooling mode based on the pseudo-mode - if pressent.
    if (hexData['pseudo-mode']){
      mode = hexData['pseudo-mode'];
      if (mode) {assert.oneOf(mode, [ 'heat', 'cool', 'auto' ], `\x1b[31m[CONFIG ERROR] \x1b[33mpseudo-mode\x1b[0m should be one of "heat", "cool" or "auto"`)}
      await this.updateServiceCurrentHeatingCoolingState(HeatingCoolingStates[mode]);
    }

    if((previousTemperature !== finalTemperature) || state.firstTemperatureUpdate || !preventResendHex){
      //Set the temperature
      this.logs.info(`sentTemperature (${state.targetTemperature})`);
      await this.performSend(hexData.data);
      state.firstTemperatureUpdate = false;
    }
  }

  getTemperatureHexData (mode, temperature) {
    const { config, data, name, state, logLevel } = this;
    const { defaultHeatTemperature, defaultCoolTemperature, heatTemperature } = config;

    let finalTemperature = temperature;
    if (mode === 'off') {
      let hexData = data.off;
      return { finalTemperature, hexData };
    }
    const x = this.dataKeys(`${mode}`);
    const closest = x.reduce((prev, curr) => Math.abs(curr - temperature) < Math.abs(prev - temperature) ? curr : prev);
    // let hexData = data[`${mode}${temperature}`];
    let hexData = data[`${mode}${closest}`];
    // console.log(x, temperature, closest);
    this.logs.debug(`getTemperatureHexData mode(${mode}) choice[${x}] temperature(${temperature}) closest(${closest})`);

    if (!hexData) {
      // Mode based code not found, try mode-less
      this.logs.warn(`No ${mode}${closest} HEX code found. Use temperature${closest} HEX code instead.`);
      hexData = data[`temperature${closest}`];
    }
    // else {
    //   if (hexData['pseudo-mode']) {
    //     this.logs.info(`Configuration found for ${mode}${temperature} with pseudo-mode. Pseudo-mode will replace the configured mode.`);
    //   }
    // }

    // You may not want to set the hex data for every single mode...
    if (!hexData) {
      const defaultTemperature = (temperature >= heatTemperature) ? defaultHeatTemperature : defaultCoolTemperature;
      hexData = data[`temperature${defaultTemperature}`];

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
    const { config, data, host, log, logLevel, name, state } = this;
    const { on } = data;

    if (state.currentHeatingCoolingState === Characteristic.TargetHeatingCoolingState.OFF && config.turnOnWhenOff) {
      this.logs.info(`sending "on" hex before sending temperature`);

      if (on) {
        await this.performSend(on);
      } else {
        log(`\x1b[31m[CONFIG ERROR] \x1b[0m ${name} No On Hex configured, but turnOnWhenOff enabled`);
      }

      return true;
    }

    return false;
  }

  // Device Temperature Methods

  async monitorTemperature () {
    const { config, host, log, logLevel, name, state } = this;
    const { temperatureFilePath, pseudoDeviceTemperature} = config;

    if (pseudoDeviceTemperature !== undefined) {return;}

    //Force file devices to a minimum 1 minute refresh
    // if (temperatureFilePath) {config.temperatureUpdateFrequency = Math.max(config.temperatureUpdateFrequency,60);}

    // const device = getDevice({ host, log });

    // Try again in a second if we don't have a device yet
    // if (!device) {
    //   this.logs.trace(`monitorTemperature: waiting device ${host} to be ready for 1 sec.`);
    //   await delayForDuration(1);

    //   this.monitorTemperature();

    //   return;
    // }

    let device;
    for (let i = 0; !device; i++) {
      if (device = getDevice({ host, log }))
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

    // this.updateTemperatureUI();
    // if (!config.isUnitTest) {setInterval(this.updateTemperatureUI.bind(this), config.temperatureUpdateFrequency * 1000)}
    this.logs.info(`updating temperature/humidity every ${config.temperatureUpdateFrequency} secs.`);
    if (!this.isUnitTest) setInterval(this.getCurrentTemperature.bind(this), config.temperatureUpdateFrequency * 1000);
  }

  async onTemperature(temperature, humidity) {
    const { Characteristic } = this;
    const { config, host, logLevel, log, name, state } = this;
    const { minTemperature, maxTemperature, temperatureAdjustment, humidityAdjustment, noHumidity, tempSourceUnits } = config;

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
    const {config} = this;
    if (config.noHistory !== true && config.enableModeHistory) {
      const valve = this.state.targetHeatingCoolingState ?
	     (this.state.currentTemperature - this.state.targetTemperature)/this.state.targetTemperature*100*2 + 50 : 0;
      if (valve >= 0 && valve <= 100) {
	this.historyService.addEntry({
	  time: Math.round(new Date().valueOf() / 1000),
	  setTemp: this.state.targetTemperature, 
	  valvePosition: valve
	});
      } else {
	this.valveInterval = 0.7;
      }
      
      this.valveInterval = Math.min(this.valveInterval * 1/0.7, 10);
      this.valveTimer = setTimeout(() => {
	this.thermoHistory();
      }, Math.round(this.valveInterval * 60 * 1000));
    }
  }

  updateTemperature () {
    const { config, host, logLevel, log, name, state } = this;
    const { mqttURL, mqttTopic, temperatureFilePath, noHumidity } = config;

    // Read temperature from file
    if (temperatureFilePath) {
      this.updateTemperatureFromFile();

      return;
    }

    // Read temperature from mqtt
    if (mqttURL) {
      let topic, temperature, humidity;
      if (topic = mqttTopic?.filter(x => x.identifier.match(/^unknown$/i))[0]) {
	temperature = this.mqttValueForIdentifier('temperature');
	humidity = noHumidity ? undefined : this.mqttValueForIdentifier('humidity');
	this.logs.trace(`updateTemperature: {mqttValueForIdentifier: {"tepmerature":${temperature}, "humidity":${humidity}}}`);
	this.onTemperature(temperature, humidity);
	return;
      }
      if (topic = mqttTopic?.filter(x =>
	x.identifier.match(/^temperature$/i) ||
	x.characteristic?.match(/^currenttemperature$/i))[0]) {
	temperature = this.mqttValueForIdentifier(topic.identifier);
	this.logs.trace(`updateTemperature: {mqttValueForIdentifier: {"${topic.identifier}":${temperature}}}`);
	if (topic = mqttTopic?.filter(x => 
	  x.identifier.match(/^humidity$/i) ||
	  x.characteristic?.match(/^currentrelativehumidity$/i))[0]) {
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
    const { config, logLevel, host, log, name, state } = this;
    const { temperatureFilePath, noHumidity} = config;
    let humidity = null;
    let temperature = null;
    // let battery = null;

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
            let value = line.split(':');
            if(value[0] == 'temperature') {temperature = parseFloat(value[1]);}
            if(value[0] == 'humidity' && !noHumidity) {humidity = parseFloat(value[1]);}
            // if(value[0] == 'battery' && batteryAlerts) {battery = parseFloat(value[1]);}
          }
        });
      }

      //Default battery level if none returned
      // if (battery) {
      //   state.batteryLevel = battery;
      // }else{
      //   state.batteryLevel = 100;
      // }
	    
      this.logs.trace(`updateTemperatureFromFile (parsed temperature: ${temperature} humidity: ${humidity})`);

      this.onTemperature(temperature, humidity);
    });
  }

  // updateTemperatureUI () {
  //   const { config, serviceManager } = this;
  //   const { noHumidity } = config;

  //   if (!Number.isNaN(Number(this.state.currentTemperature))) {
  //     serviceManager.refreshCharacteristicUI(Characteristic.CurrentTemperature);
  //   }
  //   if (!noHumidity && !Number.isNaN(Number(this.state.currentHumidity))) {
  //     serviceManager.refreshCharacteristicUI(Characteristic.CurrentRelativeHumidity);
  //   }
  // }

  getCurrentTemperature (callback = undefined) {
    const { Characteristic } = this;
    const { config, host, logLevel, log, name, state } = this;
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
    const { config, host, logLevel, log, name, state } = this;
    const { pseudoDeviceTemperature } = config;

    this.logs.trace(`*getCurrentHumidity: ${state.currentHumidity}`);
    return callback(Number.isNaN(Number(this.state.currentHumidity)), state.currentHumidity);
  }

  async checkTemperatureForAutoOnOff (temperature) {
    const { Characteristic } = this;
    const { config, host, log, logLevel, name, serviceManager, state } = this;
    let { autoHeatTemperature, autoCoolTemperature, minimumAutoOnOffDuration } = config;

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
    const { state, logLevel, log, name, config } = this;
    const mqttStateOnly = config.mqttStateOnly === false ? false : true;
    this.logs.trace(`onMQTTMessage: Received {identifier:"${identifier}", message:${message}}`);

    if (identifier.toLowerCase() === 'mode' ||
	identifier.toLowerCase() === 'targetheatingcoolingstate' ||
	identifier.toLowerCase() === 'targetheatercoolerstate') {
      let mode = message.toLowerCase();
      switch (mode) {
      case 'off':
      case 'heat':
      case 'cool':
      case 'auto':
	let state = this.HeatingCoolingStates[mode];
	this.reset();
	if (mqttStateOnly) {
	  this.serviceManager.updateCharacteristic(Characteristic.TargetHeatingCoolingState, state);
	  await this.updateServiceCurrentHeatingCoolingState(state);
	} else {
	  await this.updateServiceTargetHeatingCoolingState(state);
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
      let target = Number(message);
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
	this.logs.error(`onMQTTMessage: "${identifier}:${message}" couldn't be parsed.`);
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

      const characteristic = this.config.mqttTopic.find(x => x.tpoic === identifier)?.characteristic?.toLowerCase();
      if (identifier.toLowerCase() === 'temperature' || characteristic === 'currenttemperature') {
	this.onTemperature(value, undefined);
      } else if (identifier.toLowerCase() === 'humidity' || characteristic === 'currentrelativehumidity') {
	this.onTemperature(undefined, value);
      } else {
	this.logs.error(`onMQTTMessage: Unexpected identifier "${identifier}" with message "${message}".`);
      }
    } catch (e) {
      this.logs.error(`onMQTTMessage: "${identifier}:${message}" couldn't be parsed.`);
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

  getValvePosition(callback) {
    let valve = this.state.targetHeatingCoolingState ?
	   (this.state.currentTemperature - this.state.targetTemperature)/this.state.targetTemperature*100*2 + 50 : 0;
      valve = valve < 0 ? 0 : (valve > 100 ? 100 : valve);
    //callback(null, this.state.targetHeatingCoolingState * 25);
    //console.log('getValvePosition() is requested.', this.displayName, valve);
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
	this.logs.info(`Accessory is configured to record HeatingCoolingState and targetTemperature histories.`);
      } else if (config.enableModeHistory === true) {
	this.logs.info(`Accessory is configured to record HeatingCoolingState history.`);
      }
    }

    if(config.noHistory !== true && config.enableModeHistory) {
      this.serviceManager.service.addOptionalCharacteristic(this.platform.eve.Characteristics.ValvePosition);
      this.serviceManager.addGetCharacteristic({
	name: 'currentValvePosition',
	type: this.platform.eve.Characteristics.ValvePosition,
	// type: ValvePositionCharacteristic,
	method: this.getValvePosition,
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
        setValuePromise: this.setTargetTemperature.bind(this),
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
        setValuePromise: this.setTargetHeatingCoolingState.bind(this),
        ignorePreviousValue: true
      }
    });
      
    this.serviceManager.getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('change', async function (event) {
	if (event.newValue !== event.oldValue) {
	  const value = event.newValue;
	  // this.log(`updated TargetHeatingCoolingState.`, value)
	  await this.mqttpublish('mode', this.HeatingCoolingConfigKeys[value]);
	  await this.mqttpublish('targetTemperature', this.state.targetTemperature);
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
	    const value = event.newValue
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
