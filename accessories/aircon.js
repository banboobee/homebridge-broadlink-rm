// -*- mode: js; js-indent-level : 2 -*-
const { assert } = require('chai');
const uuid = require('uuid');
const fs = require('fs');
const findKey = require('find-key');

const delayForDuration = require('../helpers/delayForDuration');
const ServiceManagerTypes = require('../helpers/serviceManagerTypes');
const catchDelayCancelError = require('../helpers/catchDelayCancelError');
const { getDevice } = require('../helpers/getDevice');
const BroadlinkRMAccessory = require('./accessory');

class AirConAccessory extends BroadlinkRMAccessory {

  constructor (log, config = {}, serviceManagerType) {
    super(log, config, serviceManagerType);

    // Characteristic isn't defined until runtime so we set these the instance scope
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
      //this.services = this.getServices();
      //this.displayName = config.name;
      //this.lastUpdatedAt = undefined;
      this.historyService = new HistoryService(
	config.enableModeHistory ? 'custom' : 'room',
	// {displayName: config.name, services: this.getServices(), log: log},
	this.serviceManager.accessory,
	{storage: 'fs', filename: 'RMPro_' + config.name.replace(' ','-') + '_persist.json'});
      // this.historyService.log = this.log;  

      if (config.enableModeHistory) {
	this.valveInterval = 1;
	// let state2 = this.state;
	// //console.log(state2)
	// this.state = new Proxy(state2, {
	//   set: async function(target, key, value) {
	//     if (target[key] != value) {
	//       Reflect.set(target, key, value);
	//       if (this.historyService) {
	// 	if (key == 'targetTemperature') {
	// 	  //this.log(`adding history of targetTemperature.`, value)
	// 	  this.historyService.addEntry(
	// 	    {time: Math.round(new Date().valueOf()/1000),
	// 	     setTemp: value || 30})
	// 	  await this.mqttpublish('targetTemperature', value)
	// 	} else if (key == 'targetHeatingCoolingState') {
	// 	  // this.log(`adding history of targetHeatingCoolingState.`, value * 25)
	// 	  // this.historyService.addEntry(
	// 	  //   {time: Math.round(new Date().valueOf()/1000),
	// 	  //    valvePosition: value ? Math.round((this.state.currentTemperature - this.state.targetTemperature)/this.state.targetTemperature*100 + 50) : 0
	// 	  //    //value * 25
	// 	  //   })
	// 	  this.valveInterval = 1;
	// 	  clearTimeout(this.valveTimer);
	// 	  this.thermoHistory();
	// 	} else if (key == 'currentHeatingCoolingState') {
	// 	  await this.mqttpublish('mode', this.HeatingCoolingConfigKeys[value])
	// 	  await this.mqttpublish('targetTemperature', this.state.targetTemperature)
	// 	}
	//       }
	//     }
	//     return true
	//   }.bind(this)
	// })
      }
    }

    this.temperatureCallbackQueue = {};
    this.monitorTemperature();
    this.thermoHistory();
  }

  correctReloadedState (state) {
    //if (state.currentHeatingCoolingState === Characteristic.CurrentHeatingCoolingState.OFF)  {
    //  state.targetTemperature = state.currentTemperature;
    //}

    //state.targetHeatingCoolingState = state.currentHeatingCoolingState;

    if (state.userSpecifiedTargetTemperature) {state.targetTemperature = state.userSpecifiedTargetTemperature}
  }

  setDefaults () {
    const { config, state } = this;

    // Set config default values
    if (config.turnOnWhenOff === undefined) {config.turnOnWhenOff = config.sendOnWhenOff || false;} // Backwards compatible with `sendOnWhenOff`
    if (config.minimumAutoOnOffDuration === undefined) {config.minimumAutoOnOffDuration = config.autoMinimumDuration || 120;} // Backwards compatible with `autoMinimumDuration`
    config.minTemperature = config.minTemperature || -15;
    config.maxTemperature = config.maxTemperature || 50;
    config.tempStepSize = config.tempStepSize || 1;
    if(config.mqttURL) {
      //MQTT updates when published so frequent refreshes aren't required ( 10 minute default as a fallback )
      config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 600;
    } else {
      config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 10;
    }
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
    if(config.noHumidity || config.w1Device || config.pseudoDeviceTemperature){
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
    state.targetTemperature = state.targetTemperature || config.maxTemperature || config.minTemperature;
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
    const { serviceManager, state } = this;

    await delayForDuration(0.2).then(() => {
      serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, value);
    });
  }

  async updateServiceCurrentHeatingCoolingState (value) {
    const { serviceManager, name, state, log, logLevel } = this;
    const keys = this.HeatingCoolingConfigKeys;
    let update = value;

    if (value === Characteristic.TargetHeatingCoolingState.AUTO) {
      if (state.currentTemperature <= state.targetTemperature) {
	update = Characteristic.TargetHeatingCoolingState.COOL;
      } else {
	update = Characteristic.TargetHeatingCoolingState.HEAT;
      }
      log(`${name} updateServiceCurrentHeatingCoolingState target:${keys[value]} update:${keys[update]}`);
    }

    await delayForDuration(0.25).then(() => {
      serviceManager.setCharacteristic(Characteristic.CurrentHeatingCoolingState, update);
    });
  }

  async getCurrentHeatingCoolingState (current) {
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
      if (logLevel <=1) log(`${name} getCurrentHeatingCoolingState current:${keys[current]} update:${keys[update]}`);
    }

    return update;
  }


  // Allows this accessory to know about switch accessories that can determine whether
  // auto-on/off should be permitted.
  updateAccessories (accessories) {
    const { config, name, log, logLevel } = this;
    const { autoSwitchName } = config;

    if (!autoSwitchName) {return;}

    if (logLevel <=2) {log(`${name} Linking autoSwitch "${autoSwitchName}"`)}

    const autoSwitchAccessories = accessories.filter(accessory => accessory.name === autoSwitchName);

    if (autoSwitchAccessories.length === 0) {return log(`${name} No accessory could be found with the name "${autoSwitchName}". Please update the "autoSwitchName" value or add a matching switch accessory.`);}

    this.autoSwitchAccessory = autoSwitchAccessories[0];
  }

  isAutoSwitchOn () {
    return (!this.autoSwitchAccessory || (this.autoSwitchAccessory && this.autoSwitchAccessory.state && this.autoSwitchAccessory.state.switchState));
  }

  async setTargetTemperature (HexData,previousValue) {
    const { HeatingCoolingConfigKeys, data, config, log, logLevel, name, serviceManager, state } = this;
    const { preventResendHex, minTemperature, maxTemperature } = config;

    if (state.targetTemperature === previousValue && preventResendHex && !this.previouslyOff) {return;}

    this.previouslyOff = false;

    if (state.targetTemperature < minTemperature) {return log(`The target temperature (${this.targetTemperature}) must be more than the minTemperature (${minTemperature})`);}
    if (state.targetTemperature > maxTemperature) {return log(`The target temperature (${this.targetTemperature}) must be less than the maxTemperature (${maxTemperature})`);}

    const mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
    // const r = new RegExp(`${mode}`);
    // const k = Object.keys(data).sort().filter(x => x.match(r));
    // const modemin = parseInt(k[0].match(/\d+/)[0]);
    // const modemax = parseInt(k[k.length - 1].match(/\d+/)[0]);
    const x = this.dataKeys(`${mode}`).sort();
    const modemin = parseInt(x[0]);
    const modemax = parseInt(x[x.length - 1]);
    const temperature = state.targetTemperature;
    if (temperature < modemin) {
      state.targetTemperature = previousValue;
      throw new Error(`${name} Target temperature (${temperature}) is below minimal ${mode} temperature (${modemin})`);
    } else if (temperature > modemax) {
      state.targetTemperature = previousValue;
      throw new Error(`${name} Target temperature (${temperature}) is above maxmum ${mode} temperature (${modemax})`);
    }
	
    // Used within correctReloadedState() so that when re-launching the accessory it uses
    // this temperature rather than one automatically set.
    state.userSpecifiedTargetTemperature = state.targetTemperature;

    // Do the actual sending of the temperature
    this.sendTemperature(state.targetTemperature, previousValue);
    serviceManager.refreshCharacteristicUI(Characteristic.TargetTemperature);
  }

  async setTargetHeatingCoolingState (hexData, previousValue) {
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
        if (logLevel <=2) {log(`${name} Previous state ${currentHeatingCoolingState}, setting off with dry mode`);}
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
      if (logLevel <=2) {log(`${name} setTargetHeatingCoolingState (converting from auto to ${replaceAutoMode})`);}
      await this.updateServiceTargetHeatingCoolingState(HeatingCoolingStates[replaceAutoMode]);

      return;
    }

    let temperature = state.targetTemperature;
    const mode = HeatingCoolingConfigKeys[state.targetHeatingCoolingState];
    // const r = new RegExp(`${mode}`);
    // const k = Object.keys(data).sort().filter(x => x.match(r));
    // const modemin = parseInt(k[0].match(/\d+/)[0]);
    // const modemax = parseInt(k[k.length - 1].match(/\d+/)[0]);
    const x = this.dataKeys(`${mode}`).sort();
    const modemin = parseInt(x[0]);
    const modemax = parseInt(x[x.length - 1]);
    this.log(`${name} setTargetHeatingCoolingState mode(${mode}) range[${modemin}, ${modemax}]`);
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

      if (logLevel <=1) {this.log(`${name} sentMode (${mode})`);}

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
      log(`${name} enableAutoOn is not supported.`);
    }
    if (enableAutoOff && parseInt(onDuration) > 0) {
      if (!this.autoOffTimeoutPromise) {
	log(`${name} setTargetHeatingCoolingState: (automatically turn off in ${onDuration} seconds)`);
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

    if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} Potential sendTemperature (${temperature})`);}

    // Ignore Temperature if off, staying off - and set to ignore. OR temperature not provided
    if ((!state.targetHeatingCoolingState && ignoreTemperatureWhenOff) || !temperature) {
      if (logLevel <=2) {log(`${name} Ignoring sendTemperature due to "ignoreTemperatureWhenOff": true or no temperature set.`);}
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

    if((previousTemperature !== finalTemperature) || (state.firstTemperatureUpdate && !preventResendHex)){
      //Set the temperature
      await this.performSend(hexData.data);
      if (logLevel <=2) {this.log(`${name} sentTemperature (${state.targetTemperature})`);}
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
    const hexData = data[`${mode}${closest}`];
    // console.log(v, temperature, closest);

    if (!hexData) {
      // Mode based code not found, try mode-less
      if (logLevel <=3) {this.log(`${name} No ${mode} HEX code found for ${temperature}`);}
      hexData = data[`temperature${temperature}`];
    } else {
      if (hexData['pseudo-mode']) {
        if (logLevel <=2) {this.log(`\x1b[36m[INFO] \x1b[0m${name} Configuration found for ${mode}${temperature} with pseudo-mode. Pseudo-mode will replace the configured mode.`);}
      }
    }

    // You may not want to set the hex data for every single mode...
    if (!hexData) {
      const defaultTemperature = (temperature >= heatTemperature) ? defaultHeatTemperature : defaultCoolTemperature;
      hexData = data[`temperature${defaultTemperature}`];

      assert(hexData, `\x1b[31m[CONFIG ERROR] \x1b[0m You need to provide a hex code for the following temperature:
        \x1b[33m{ "temperature${temperature}": { "data": "HEXCODE", "pseudo-mode" : "heat/cool" } }\x1b[0m
        or provide the default temperature:
        \x1b[33m { "temperature${defaultTemperature}": { "data": "HEXCODE", "pseudo-mode" : "heat/cool" } }\x1b[0m`);

      if (logLevel <=2) {this.log(`${name} Update to default temperature (${defaultTemperature})`);}
      finalTemperature = defaultTemperature;
    }

    return { finalTemperature, hexData }
  }

  async checkTurnOnWhenOff () {
    const { config, data, host, log, logLevel, name, state } = this;
    const { on } = data;

    if (state.currentHeatingCoolingState === Characteristic.TargetHeatingCoolingState.OFF && config.turnOnWhenOff) {
      if (logLevel <=2) {log(`${name} sending "on" hex before sending temperature`);}

      if (on) {
        await this.performSend(on);
      } else {
        if (logLevel <=4) {log(`\x1b[31m[CONFIG ERROR] \x1b[0m ${name} No On Hex configured, but turnOnWhenOff enabled`);}
      }

      return true;
    }

    return false;
  }

  // Device Temperature Methods

  async monitorTemperature () {
    const { config, host, log, logLevel, name, state } = this;
    const { temperatureFilePath, pseudoDeviceTemperature, w1DeviceID } = config;

    if (pseudoDeviceTemperature !== undefined) {return;}

    //Force w1 and file devices to a minimum 1 minute refresh
    if (w1DeviceID || temperatureFilePath) {config.temperatureUpdateFrequency = Math.max(config.temperatureUpdateFrequency,60);}

    const device = getDevice({ host, log });

    // Try again in a second if we don't have a device yet
    if (!device) {
      await delayForDuration(1);

      this.monitorTemperature();

      return;
    }

    if (logLevel <=1) {log(`${name} monitorTemperature`);}

    device.on('temperature', this.onTemperature.bind(this));
    device.checkTemperature(logLevel);

    this.updateTemperatureUI();
    if (!config.isUnitTest) {setInterval(this.updateTemperatureUI.bind(this), config.temperatureUpdateFrequency * 1000)}
  }

  async onTemperature (temperature,humidity) {
    const { config, host, logLevel, log, name, state } = this;
    const { minTemperature, maxTemperature, temperatureAdjustment, humidityAdjustment, noHumidity, tempSourceUnits } = config;

    // onTemperature is getting called twice. No known cause currently.
    // This helps prevent the same temperature from being processed twice
    if (Object.keys(this.temperatureCallbackQueue).length === 0) {return;}

    temperature += temperatureAdjustment;
    if (tempSourceUnits == 'F') {temperature = (temperature - 32) * 5/9;}
    state.currentTemperature = temperature;
    if(logLevel < 2) {log(`\x1b[36m[INFO] \x1b[0m${name} onTemperature (${temperature})`);}

    if(humidity) {
      if(noHumidity){
        state.currentHumidity = null;
      }else{
        humidity += humidityAdjustment;
        state.currentHumidity = humidity;
        if(logLevel < 2) {log(`\x1b[36m[INFO] \x1b[0m${name} onHumidity (` + humidity + `)`);}
      }
    }
    
    //Process Fakegato history
    //Ignore readings of exactly zero - the default no value value.
    if(config.noHistory !== true && this.state.currentTemperature != 0.00) {
      //this.lastUpdatedAt = Date.now();
      if(logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} Logging data to history: temp: ${this.state.currentTemperature}, humidity: ${this.state.currentHumidity}`);}
      if(noHumidity && config.enableModeHistory === false){
        this.historyService.addEntry({ time: Math.round(new Date().valueOf() / 1000), temp: this.state.currentTemperature });
	await this.mqttpublish('temperature', `{"temperature":${this.state.currentTemperature}}`);
      }else{
        this.historyService.addEntry({ time: Math.round(new Date().valueOf() / 1000), temp: this.state.currentTemperature, humidity: this.state.currentHumidity });
	await this.mqttpublish('temperature', `{"temperature":${this.state.currentTemperature}, "humidity":${this.state.currentHumidity}}`);
      }
    }
    
    this.processQueuedTemperatureCallbacks(temperature);
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

  addTemperatureCallbackToQueue (callback) {
    const { config, host, logLevel, log, name, state } = this;
    const { mqttURL, temperatureFilePath, w1DeviceID, noHumidity } = config;

    // Clear the previous callback
    if (Object.keys(this.temperatureCallbackQueue).length > 1) {
      if (state.currentTemperature) {
        if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} addTemperatureCallbackToQueue (clearing previous callback, using existing temperature)`);}
        this.processQueuedTemperatureCallbacks(state.currentTemperature);
      }
    }

    // Add a new callback
    const callbackIdentifier = uuid.v4();
    this.temperatureCallbackQueue[callbackIdentifier] = callback;

    // Read temperature from file
    if (temperatureFilePath) {
      this.updateTemperatureFromFile();

      return;
    }

    // Read temperature from W1 Device
    if (w1DeviceID) {
      this.updateTemperatureFromW1();

      return;
    }

    // Read temperature from mqtt
    if (mqttURL) {
      const temperature = this.mqttValueForIdentifier('temperature');
      const humidity = noHumidity ? null : this.mqttValueForIdentifier('humidity');
      this.onTemperature(temperature || 0,humidity);

      return;
    }

    // Read temperature from Broadlink RM device
    // If the device is no longer available, use previous tempeature
    const device = getDevice({ host, log });

    if (!device || device.state === 'inactive') {
      if (logLevel <=3) {log(`${name} addTemperatureCallbackToQueue (device no longer active, using existing temperature)`);}

      this.processQueuedTemperatureCallbacks(state.currentTemperature || 0);

      return;
    }

    device.checkTemperature(logLevel);
    if (logLevel <1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} addTemperatureCallbackToQueue (requested temperature from device, waiting)`);}
  }

  updateTemperatureFromFile () {
    const { config, logLevel, host, log, name, state } = this;
    const { temperatureFilePath, noHumidity, batteryAlerts } = config;
    let humidity = null;
    let temperature = null;
    let battery = null;

    if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} updateTemperatureFromFile reading file: ${temperatureFilePath}`);}

    fs.readFile(temperatureFilePath, 'utf8', (err, data) => {
      if (err) {
        if (logLevel <=4) {log(`\x1b[31m[ERROR] \x1b[0m${name} updateTemperatureFromFile\n\n${err.message}`);}
      }

      if (data === undefined || data.trim().length === 0) {
        if (logLevel <=3) {log(`\x1b[33m[WARNING]\x1b[0m ${name} updateTemperatureFromFile error reading file: ${temperatureFilePath}, using previous Temperature`);}
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
            if(value[0] == 'battery' && batteryAlerts) {battery = parseFloat(value[1]);}
          }
        });
      }

      //Default battery level if none returned
      if (battery) {
        state.batteryLevel = battery;
      }else{
        state.batteryLevel = 100;
      }
	    
      if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} updateTemperatureFromFile (parsed temperature: ${temperature} humidity: ${humidity})`);}

      this.onTemperature(temperature, humidity);
    });
  }

  updateTemperatureFromW1 () {
    const { config, logLevel, host, log, name, state } = this;
    const { w1DeviceID } = config;

    var W1PATH = "/sys/bus/w1/devices";
    var fName = W1PATH + "/" + w1DeviceID + "/w1_slave";
    var temperature;

    if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} updateTemperatureFromW1 reading file: ${fName}`);}

    fs.readFile(fName, 'utf8', (err, data) => {
      if (err) {
        log(`\x1b[31m[ERROR] \x1b[0m${name} updateTemperatureFromW1\n\n${err.message}`);
      }

      if(data.includes("t=")){
        var matches = data.match(/t=([0-9]+)/);
        temperature = parseInt(matches[1]) / 1000;
      }else{
        if (logLevel <=3) {log(`\x1b[33m[WARNING]\x1b[0m ${name} updateTemperatureFromW1 error reading file: ${fName}, using previous Temperature`);}
        temperature = (state.currentTemperature || 0);
      }
      //Default battery level 
      state.batteryLevel = 100;

      if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} updateTemperatureFromW1 (parsed temperature: ${temperature})`);}
      this.onTemperature(temperature);
    });
  }

  processQueuedTemperatureCallbacks (temperature) {
    if (Object.keys(this.temperatureCallbackQueue).length === 0) {return;}

    Object.keys(this.temperatureCallbackQueue).forEach((callbackIdentifier) => {
      const callback = this.temperatureCallbackQueue[callbackIdentifier];

      //callback(null, temperature);

      this.serviceManager.getCharacteristic(Characteristic.CurrentTemperature).updateValue(temperature);
      
      delete this.temperatureCallbackQueue[callbackIdentifier];
    })

    this.temperatureCallbackQueue = {};

    this.checkTemperatureForAutoOnOff(temperature);
  }

  updateTemperatureUI () {
    const { config, serviceManager } = this;
    const { noHumidity } = config;

    serviceManager.refreshCharacteristicUI(Characteristic.CurrentTemperature);
    if(!noHumidity){serviceManager.refreshCharacteristicUI(Characteristic.CurrentRelativeHumidity);}
  }

  getCurrentTemperature (callback) {
    const { config, host, logLevel, log, name, state } = this;
    const { pseudoDeviceTemperature } = config;

    // Some devices don't include a thermometer and so we can use `pseudoDeviceTemperature` instead
    if (pseudoDeviceTemperature !== undefined) {
      if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} getCurrentTemperature (using pseudoDeviceTemperature ${pseudoDeviceTemperature} from config)`);}
      return callback(null, pseudoDeviceTemperature);
    }

    callback(null, this.state.currentTemperature);

    this.addTemperatureCallbackToQueue(callback);
  }

  getCurrentHumidity (callback) {
    const { config, host, logLevel, log, name, state } = this;
    const { pseudoDeviceTemperature } = config;

    return callback(null, state.currentHumidity);
  }

  async checkTemperatureForAutoOnOff (temperature) {
    const { config, host, log, logLevel, name, serviceManager, state } = this;
    let { autoHeatTemperature, autoCoolTemperature, minimumAutoOnOffDuration } = config;

    if (this.shouldIgnoreAutoOnOff) {
      if (logLevel <=2) {log(`${name} checkTemperatureForAutoOn (ignore within ${minimumAutoOnOffDuration}s of previous auto-on/off due to "minimumAutoOnOffDuration")`);}

      return;
    }

    if (!autoHeatTemperature && !autoCoolTemperature) {return;}

    if (!this.isAutoSwitchOn()) {
      if (logLevel <=2) {log(`${name} checkTemperatureForAutoOnOff (autoSwitch is off)`);}
      return;
    }

    if (logLevel <=1) {log(`${name} checkTemperatureForAutoOnOff`);}

    if (autoHeatTemperature && temperature < autoHeatTemperature) {
      this.state.isRunningAutomatically = true;

      if (logLevel <=2) {log(`${name} checkTemperatureForAutoOnOff (${temperature} < ${autoHeatTemperature}: auto heat)`);}
      serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    } else if (autoCoolTemperature && temperature > autoCoolTemperature) {
      this.state.isRunningAutomatically = true;

      if (logLevel <=2) {log(`${name} checkTemperatureForAutoOnOff (${temperature} > ${autoCoolTemperature}: auto cool)`);}
      serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    } else {
      if (logLevel <=1) {log(`${name} checkTemperatureForAutoOnOff (temperature is ok)`);}

      if (this.state.isRunningAutomatically) {
        this.isAutomatedOff = true;
        if (logLevel <=2) {log(`${name} checkTemperatureForAutoOnOff (auto off)`);}
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
    const { config } = this;
    const temperatureDisplayUnits = (config.units.toLowerCase() === 'f') ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS;

    callback(null, temperatureDisplayUnits);
  }

  dataKeys (filter) {
    const { data } = this;
    const allHexKeys = Object.keys(data || {});

    if (!filter) {return allHexKeys;}

    // Create an array of value specified in the data config
    const foundValues = [];

    allHexKeys.forEach((key) => {
      const parts = key.split(filter);

      if (parts.length !== 2) {return;}

      foundValues.push(parts[1]);
    })

    return foundValues
  }

  // MQTT
  async onMQTTMessage (identifier, message) {
    const { state, logLevel, log, name, config } = this;
    const mqttStateOnly = config.mqttStateOnly === false ? false : true;

    super.onMQTTMessage(identifier, message);

    if (identifier === 'mode' ||
	// identifier.toLowerCase() === 'currentheatingcoolingstate' ||
	// identifier.toLowerCase() === 'currentheatercoolerstate') {
	identifier.toLowerCase() === 'targetheatingcoolingstate' ||
	identifier.toLowerCase() === 'targetheatercoolerstate') {
      let mode = this.mqttValuesTemp[identifier].toLowerCase();
      switch (mode) {
      case 'off':
      case 'heat':
      case 'cool':
      case 'auto':
	let state = this.HeatingCoolingStates[mode];
	//log(`${name} onMQTTMessage (set HeatingCoolingState to ${mode}).`);
	this.reset();
	if (mqttStateOnly) {
	  // this.state.currentHeatingCoolingState = state;
	  // this.serviceManager.refreshCharacteristicUI(Characteristic.CurrentHeatingCoolingState);
	  this.state.targetHeatingCoolingState = state;
	  this.serviceManager.refreshCharacteristicUI(Characteristic.TargetHeatingCoolingState);
	  await this.updateServiceCurrentHeatingCoolingState(state);
	} else {
	  await this.updateServiceTargetHeatingCoolingState(state);
	}
	log(`${name} onMQTTMessage (set currentHeatingCoolingState to ${this.state.currentHeatingCoolingState}).`);
	break;
      default:
	log(`\x1b[31m[ERROR] \x1b[0m${name} onMQTTMessage (unexpected HeatingCoolingState: ${this.mqttValuesTemp[identifier]})`);
      }
      return;
    }

    if (identifier.toLowerCase() === 'targettemperature' ||
	identifier.toLowerCase() === 'coolingthresholdtemperature' ||
	identifier.toLowerCase() === 'heatingthresholdtemperature') {
      let target = parseInt(this.mqttValuesTemp[identifier].match(/^([0-9]+)$/g));
      if (target > 0 && target >= config.minTemperature && target <= config.maxTemperature) {
	if (mqttStateOnly) {
	  this.state.targetTemperature = target;
	  this.serviceManager.refreshCharacteristicUI(Characteristic.TargetTemperature);
	} else {
	  this.serviceManager.setCharacteristic(Characteristic.TargetTemperature, target);
	}
	log(`${name} onMQTTMessage (set targetTemperature to ${target}).`);
      } else {
	log(`\x1b[31m[ERROR] \x1b[0m${name} onMQTTMessage (unexpected targetTemperature: ${this.mqttValuesTemp[identifier]})`);
      }
      return;
    }

    if (identifier !== 'unknown' && identifier !== 'temperature' && identifier !== 'humidity' && identifier !== 'battery' && identifier !== 'combined') {
      log(`\x1b[31m[ERROR] \x1b[0m${name} onMQTTMessage (mqtt message received with unexpected identifier: ${identifier}, ${message.toString()})`);

      return;
    }

    let temperatureValue, humidityValue, batteryValue;
    let objectFound = false;
    let value = this.mqttValuesTemp[identifier];
    if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} onMQTTMessage (raw value: ${value})`);}
    try {
      //Attempt to parse JSON - if result is JSON
      const temperatureJSON = JSON.parse(value);

      if (typeof temperatureJSON === 'object') {
        objectFound = true;
        let values = [];
        if (identifier !== 'temperature' && identifier !== 'battery'){
          //Try to locate other Humidity fields
          if (values.length === 0) {values = findKey(temperatureJSON, 'Hum');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'hum');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'Humidity');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'humidity');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'RelativeHumidity');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'relativehumidity');}
          if(values.length > 0) {
            humidityValue = values;
            values = [];
          }
        }
        if (identifier !== 'temperature' && identifier !== 'humidity'){
          //Try to locate other Battery fields
          if (values.length === 0) {values = findKey(temperatureJSON, 'Batt');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'batt');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'Battery');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'battery');}
          if(values.length > 0) {
            batteryValue = values;
            values = [];
          }
        }
        if(identifier !== 'battery' && identifier !== 'humidity'){
          //Try to locate other Temperature fields
          if (values.length === 0) {values = findKey(temperatureJSON, 'temp');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'Temp');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'temperature');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'Temperature');}
          if (values.length === 0) {values = findKey(temperatureJSON, 'local_temperature');}
          if(values.length > 0) {
            temperatureValue = values;
          }
        }
             
        if (values.length > 0) {
          value = values[0];
        } else {
          value = undefined;
        }
      }
    } catch (err) {} //Result couldn't be parsed as JSON

    if(objectFound) {
      if(temperatureValue !== undefined && temperatureValue.length > 0) {
        this.mqttValues.temperature = parseFloat(temperatureValue[0]);
      }
      if(batteryValue !== undefined && batteryValue.length > 0) {
        state.batteryLevel = parseFloat(batteryValue[0]);
        this.mqttValues.battery = parseFloat(batteryValue[0]);
      }
      if(humidityValue !== undefined && humidityValue.length > 0) {
        this.mqttValues.humidity = parseFloat(humidityValue[0]);
      }
    }else{
      if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
        log(`\x1b[31m[ERROR] \x1b[0m${name} onMQTTMessage (mqtt value not found)`);
        return;
      }

      if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} onMQTTMessage (parsed value: ${value})`);}
      value = parseFloat(value);

      if (identifier == 'battery'){
        state.batteryLevel = value;
        return;
      } 
      this.mqttValues[identifier] = value;
    }
    this.onTemperature(this.mqttValues.temperature,this.mqttValues.humidity);
  }

  getValvePosition(callback) {
    let valve = this.state.targetHeatingCoolingState ?
	   (this.state.currentTemperature - this.state.targetTemperature)/this.state.targetTemperature*100*2 + 50 : 0;
      valve = valve < 0 ? 0 : (valve > 100 ? 100 : valve);
    //callback(null, this.state.targetHeatingCoolingState * 25);
    //console.log('getValvePosition() is requested.', this.displayName, valve);
    callback(null, valve);
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

  // localCharacteristic(key, uuid, props) {
  //   let characteristic = class extends Characteristic {
  //     constructor() {
  // 	super(key, uuid);
  // 	this.setProps(props);
  //     }
  //   }
  //   characteristic.UUID = uuid;

  //   return characteristic;
  // }

  // Service Manager Setup

  setupServiceManager () {
    const { config, name, serviceManagerType } = this;

    this.serviceManager = new ServiceManagerTypes[serviceManagerType](name, Service.Thermostat, this.log);

    config.enableTargetTemperatureHistory = config.enableTargetTemperatureHistory === true || false;
    config.enableModeHistory = config.enableModeHistory === true || config.enableTargetTemperatureHistory === true || false;
    if (config.noHistory !== true) {
      if (config.enableTargetTemperatureHistory === true) {
	this.log(`${this.name} Accessory is configured to record HeatingCoolingState and targetTemperature histories.`);
      } else if (config.enableModeHistory === true) {
	this.log(`${this.name} Accessory is configured to record HeatingCoolingState history.`);
      }
    }

    if(config.noHistory !== true && config.enableModeHistory) {
      // const ValvePositionCharacteristic = this.localCharacteristic(
      // 	'ValvePosition', 'E863F12E-079E-48FF-8F27-9C2605A29F52',
      // 	{format: Characteristic.Formats.UINT8,
      // 	 unit: Characteristic.Units.PERCENTAGE,
      // 	 perms: [
      //      Characteristic.Perms.READ,
      //      Characteristic.Perms.NOTIFY
      // 	 ]});

      this.serviceManager.service.addOptionalCharacteristic(eve.Characteristics.ValvePosition);
      this.serviceManager.addGetCharacteristic({
	name: 'currentValvePosition',
	type: eve.Characteristics.ValvePosition,
	// type: ValvePositionCharacteristic,
	method: this.getValvePosition,
	bind: this
      });
      
      if (config.enableTargetTemperatureHistory) {
	// const ProgramDataCharacteristic = this.localCharacteristic(
	//   'ProgramData', 'E863F12F-079E-48FF-8F27-9C2605A29F52',
	//   {format: Characteristic.Formats.DATA,
	//    perms: [
        //      Characteristic.Perms.READ,
        //      Characteristic.Perms.NOTIFY
	//    ]});
	
	// const ProgramCommandCharacteristic = this.localCharacteristic(
	//   'ProgramCommand', 'E863F12C-079E-48FF-8F27-9C2605A29F52',
	//   {format: Characteristic.Formats.DATA,
	//    perms: [
        //      Characteristic.Perms.WRITE
	//    ]});
	
	this.serviceManager.service.addOptionalCharacteristic(eve.Characteristics.ProgramData);
	this.serviceManager.addGetCharacteristic({
	  name: 'setProgramData',
	  type: eve.Characteristics.ProgramData,
	  // type: ProgramDataCharacteristic,
	  method: this.getProgramData,
	  bind: this,
	});
	
	this.serviceManager.service.addOptionalCharacteristic(eve.Characteristics.ProgramCommand);
	this.serviceManager.addSetCharacteristic({
	  name: 'setProgramCommand',
	  type: eve.Characteristics.ProgramCommand,
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

    this.serviceManager.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('change', async function (event) {
	if (event.newValue !== event.oldValue) {
	  if (this.historyService) {
	    const value = event.newValue;
	    // this.log(`updated CurrentHeatingCoolingState.`, value)
	    await this.mqttpublish('mode', this.HeatingCoolingConfigKeys[value]);
	    await this.mqttpublish('targetTemperature', this.state.targetTemperature);
	  }
	}
      }.bind(this))

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
	    // this.log(`adding history of targetHeatingCoolingState.`, value * 25)
	    // this.historyService.addEntry(
	    //   {time: Math.round(new Date().valueOf()/1000),
	    //    valvePosition: value ? Math.round((this.state.currentTemperature - this.state.targetTemperature)/this.state.targetTemperature*100 + 50) : 0
	    //    //value * 25
	    //   })
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
      .setProps({
        minValue: config.minTemperature,
        maxValue: config.maxTemperature,
        minStep: config.tempStepSize || 1
      })
      .on('change', async function (event) {
	if (event.newValue !== event.oldValue) {
	  if (this.historyService) {
	    const value = event.newValue;
	    // this.log(`adding history of targetTemperature.`, value)
	    this.historyService.addEntry(
	      {time: Math.round(new Date().valueOf()/1000),
	       setTemp: value || 30});
	    await this.mqttpublish('targetTemperature', value);
	  }
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
