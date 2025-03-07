// -*- js-indent-level : 2 -*-
const { assert } = require('chai');
const delayForDuration = require('../helpers/delayForDuration');
const catchDelayCancelError = require('../helpers/catchDelayCancelError')
const Mutex = require('await-semaphore').Mutex;

const SwitchAccessory = require('./switch');

class LightAccessory extends SwitchAccessory {
  static configKeys = {
    // common
    ...this.configCommonKeys,

    //MQTT
    ...this.configMqttKeys,
    mqttTopic: [	// override to use own configIsMQTTTopicKeys
      (key, value) => this.configIsMQTTTopic(key, value, this.configMqttTopicKeys),
      '`value ${JSON.stringify(value)} is not a valid mqttTopic`'],

    // complex
    data: [
      (key, value) => this.configIsObject(value) && this.verifyConfig(value, key, this.configDataKeys),
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    exclusives: [
      (key, value) => this.configIsArray(value) && this.configIsExclusives(key, value),
      '`value ${JSON.stringify(value)} is not a valid accessory name array.`'],
    
    // string
    'pingIPAddress$': [
      (key, value) => this.configIsString(value),
      '`value ${JSON.stringify(value)} is not a string`'],

    // boolean
    useLastKnownBrightness: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    enableAutoOff: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    enableAutoOn: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    disableAutomaticOn: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    disableAutomaticOff: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    pingIPAddressStateOnly: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    pingUseArp: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    noHistory: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    history: [
      (key, value) => this.configIsBoolean(value),
      '`value ${JSON.stringify(value)} is not a boolean`'],

    // number
    defaultBrightness: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    defaultColorTemperature: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    pingFrequency: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    pingGrace: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    onDelay: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    onDuration: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    offDuration: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
  }
  static configMqttTopicKeys = {
    identifier: [
      (key, value, choices) => {return typeof value === 'string'},
      '`value ${JSON.stringify(value)} is not a string`',
      ['on', 'brightness']
    ],
    topic: [
      (key, value) => {return typeof value === 'string'},
      '`value ${JSON.stringify(value)} is not a string`']
  }
  static configDataKeys = {
    on: [
      (key, value) => {return this.configIsHex(key, value)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    off: [
      (key, value) => {return this.configIsHex(key, value)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    white: [
      (key, value) => {return this.configIsHex(key, value)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    'brightness\\+$': [
      (key, value) => {return this.configIsHex(key, value)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    'brightness\\-$': [
      (key, value) => {return this.configIsHex(key, value)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    '^brightness.+$': [
      (key, value) => {return !Number.isNaN(Number(key.match('(brightness)(.+)$')[2])) && this.configIsHex(key, value)},
      '`brightness suffix is not a number`'],
    '^hue.+$': [
      (key, value) => {return !Number.isNaN(Number(key.match('(hue)(.+)$')[2])) && this.configIsHex(key, value)},
      '`hue suffix is not a number`'],
    availableBrightnessSteps: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    availableColorTemperatureSteps: [
      (key, value) => this.configIsNumber(value),
      '`value ${JSON.stringify(value)} is not a number`'],
    'colorTemperature+': [
      (key, value) => {return this.configIsHex(key, value)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    'colorTemperature-': [
      (key, value) => {return this.configIsHex(key, value)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
  }
  static configIsExclusives(property, value) {
    // console.log(property, value);
    value.forEach(element => {
      if (!this.configIsString(property, element)) {
	this.logs.config.error(`failed to verify '${property}' property. value '${JSON.stringify(element)}' is not a valid accessory name.`);
      }
    });
    return true;
  }
  
  constructor (log, config = {}, platform) {
    super(log, config, platform);
    this.mutex = new Mutex();
  }
  
  checkConfig(config) {
    this.constructor.verifyConfig(config, undefined, this.constructor.configKeys); 
  }

  setDefaults () {
    super.setDefaults();
    
    const { config } = this;

    config.onDelay = config.onDelay || 0.1;
    config.defaultBrightness = config.defaultBrightness || 100;
    config.defaultColorTemperature = config.defaultColorTemperature || 500;
  }

  reset () {
    super.reset();

    // Clear existing timeouts
    if (this.onDelayTimeoutPromise) {
      this.onDelayTimeoutPromise.cancel();
      this.onDelayTimeoutPromise = undefined
    }
  }

  async updateAccessories (accessories) {
    const { config } = this;
    const { exclusives } = config;
    //console.log('updateAccessories: %s', this.name);

    if (exclusives) {
      exclusives.forEach(exname => {
        const exAccessory = accessories.find(x => x.name === exname);
        //console.log(exAccessory.name);
        if (exAccessory && exAccessory.config.type === 'light') {
	  if (!this.exclusives) {this.exclusives = [];}
	  if (!this.exclusives.find(x => x === exAccessory)) {
	    this.exclusives.push(exAccessory);
	  }
	  if (!exAccessory.exclusives) {exAccessory.exclusives = [];}
	  if (!exAccessory.exclusives.find(x => x === this)) {
	    exAccessory.exclusives.push(this);
	  }
        } else {
	  this.logs.error(`No light accessory could be found with the name "${exname}". Please update the "exclusives" value or add matching light accessories.`);
        }
      });
    }
  }

  async setExclusivesOFF () {
    const { Characteristic } = this;
    if (this.exclusives) {
      this.exclusives.forEach(async (x) => {
	if (x.state.switchState) {
	  this.logs.info(`setSwitchState: ${x.name} is configured to be turned off`);
	  x.reset();
	  x.state.switchState = false;
	  x.lastBrightness = undefined;
          x.serviceManager.refreshCharacteristicUI(Characteristic.On);
	  await x.mqttpublish('On', 'false');
	}
      });
    }
  }

  async setSwitchState (hexData, previousValue) {
    const { Characteristic } = this;
    const { config, state, serviceManager } = this;
    const { defaultBrightness, useLastKnownBrightness } = config;
    const { defaultColorTemperature, useLastKnownColorTemperature } = config;
    this.reset();

    if (state.switchState) {
      this.setExclusivesOFF();
      const brightness = (useLastKnownBrightness && state.brightness > 0) ? state.brightness : defaultBrightness;
      const colorTemperature = useLastKnownColorTemperature ? state.colorTemperature : defaultColorTemperature;
      if (brightness !== state.brightness || previousValue !== state.switchState || colorTemperature !== state.colorTemperature) {
        this.logs.debug(`setSwitchState: (brightness: ${brightness})`);

        state.switchState = false;	// ???
        state.brightness = brightness;	// ???
        serviceManager.setCharacteristic(Characteristic.Brightness, brightness);
	serviceManager.refreshCharacteristicUI(Characteristic.Brightness);	// ???
	if (this.dataKeys('colorTemperature').length > 0) {
          state.colorTemperature = colorTemperature;
          serviceManager.setCharacteristic(Characteristic.ColorTemperature, colorTemperature);
	  serviceManager.refreshCharacteristicUI(Characteristic.ColorTemperature);	// ???
	}
      } else {
        if (hexData) {await this.performSend(hexData);}
	await this.mqttpublish('On', 'true');

        this.checkAutoOnOff();
      }
    } else {
      this.lastBrightness = undefined;

      if (hexData) {await this.performSend(hexData);}
      await this.mqttpublish('On', 'false');

      this.checkAutoOnOff();
    }
  }

  async setSaturation () {
    
  }

  async setHue () {
    const { Characteristic } = this;
    await catchDelayCancelError(async () => {
      const { config, data, state, serviceManager} = this;
      const { onDelay } = config;
      const { on } = data;

      this.reset();

      if (!state.switchState) {

        state.switchState = true;
        serviceManager.refreshCharacteristicUI(Characteristic.On);

        if (on) {
          this.logs.debug(`setHue: (turn on, wait ${onDelay}s)`);
          await this.performSend(on);

          this.logs.debug(`setHue: (wait ${onDelay}s then send data)`);
          this.onDelayTimeoutPromise = delayForDuration(onDelay);
          await this.onDelayTimeoutPromise;
        }
	await this.mqttpublish('On', 'true');
      }

      // Find hue closest to the one requested
      const foundValues = this.dataKeys('hue');
      const closest = foundValues.reduce((prev, curr) => Math.abs(curr - state.hue) < Math.abs(prev - state.hue) ? curr : prev);
      var hexData = "";
      // If saturation is less than 10, choose white
      if (state.saturation < 10 && data.white) {
        hexData = data.white;
        this.logs.debug(`setHue: (closest: white)`);
      } else {
        hexData = data[`hue${closest}`];
        this.logs.debug(`setHue: (closest: hue${closest})`);
      }
      await this.performSend(hexData);
    });
  }

  async setBrightness (dummy, previousValue) {
    const { Characteristic } = this;
    await catchDelayCancelError(async () => {
      const { config, data, state, serviceManager } = this;
      const { off, on } = data;
      const { onDelay } = config;

      if (this.lastBrightness === state.brightness) {

        if (state.brightness > 0) {
          state.switchState = true;
	  // await this.mqttpublish('On', 'true');
        }

        await this.checkAutoOnOff();

        return;
      }

      this.lastBrightness = state.brightness;

      this.reset();

      if (state.brightness > 0) {
        if (!state.switchState) {
          state.switchState = true;
          serviceManager.refreshCharacteristicUI(Characteristic.On);
	  this.setExclusivesOFF();
    
          if (on) {
            this.logs.debug(`setBrightness: (turn on, wait ${onDelay}s)`);
            await this.performSend(on);
    
            this.onDelayTimeoutPromise = delayForDuration(onDelay);
            await this.onDelayTimeoutPromise;
          }
    	  await this.mqttpublish('On', 'true');
        }

	if (data['brightness+'] || data['brightness-'] || data['availableBrightnessSteps']) {
          assert(data['brightness+'] && data['brightness-'] && data['availableBrightnessSteps'], `\x1b[31m[CONFIG ERROR] \x1b[33mbrightness+, brightness- and availableBrightnessSteps\x1b[0m need to be set.`);
	  
	  const targetBrightness = state.brightness;
	  await this.mutex.use(async () => {
	    let previous = previousValue ?? config.defaultBrightness;
	    if (targetBrightness !== state.brightness) {
	      previous = state.brightness;	// queued attemps.
	    }
	    const n = data['availableBrightnessSteps'] + 1;
	    const r = 1000 % n;
	    const delta = (1000 - r)/n;
	    const increment = data['brightness+'];
	    const decrement = data['brightness-'];
	    const current = previous > 0 ? Math.floor(Math.min(previousValue*10, delta*n - 1)/delta) + 1 : 0;
	    const target = targetBrightness > 0 ? Math.floor(Math.min(targetBrightness*10, delta*n - 1)/delta) + 1 : 0;
	    
	    this.logs.debug(`setBrightness: current:${String(previous).padStart(3, ' ')}%(${String(current).padStart(2, ' ')}), target:${String(targetBrightness).padStart(3, ' ')}%(${String(target).padStart(2, ' ')}), increment:${target - current} interval:${onDelay}s`);
	    if (current != target) {	// need incremental operation
	      const d = target - current;
	      try {
		await this.performSend([
		  {'data': d > 0 ? increment : decrement,
		   'interval': onDelay,
		   'sendCount': Math.abs(d),
		  }]);
	      } catch (e) {
		const {attempt, fail, timeout} = e;
		const c = d > 0 ? d - attempt - fail : d + attempt + fail;
		const u = Math.floor((Math.min(targetBrightness*10, delta*n - 1) - c*delta)/10);
		this.logs.debug(`setBrightness: current:${targetBrightness}%, request:${d}, attempt:${attempt}, fail:${fail}, timeout:${timeout}, adjust:${c}, update:${u}%.`);
		state.brightness = u;
		serviceManager.refreshCharacteristicUI(Characteristic.Brightness);
	      }
	    }
	    await this.mqttpublish('Brightness', state.brightness);
	  })
	} else {
          // Find brightness closest to the one requested
          const foundValues = this.dataKeys('brightness')
	  
          assert(foundValues.length > 0, `\x1b[31m[CONFIG ERROR] \x1b[33mbrightness\x1b[0m keys need to be set. See the config-sample.json file for an example.`);
	  
          const closest = foundValues.reduce((prev, curr) => Math.abs(curr - state.brightness) < Math.abs(prev - state.brightness) ? curr : prev);
          const hexData = data[`brightness${closest}`];
	  
          this.logs.debug(`setBrightness: (closest: ${closest})`);
          await this.performSend(hexData);
	  await this.mqttpublish('Brightness', state.brightness);
	}
      } else {
        this.logs.debug(`setBrightness: (off)`);
        await this.performSend(off);
    	await this.mqttpublish('On', 'false');
      }

      await this.checkAutoOnOff();
    });
  }

  async setColorTemperature(dummy, previousValue) {
    const { Characteristic } = this;
    await catchDelayCancelError(async () => {
      const { config, data, state, serviceManager} = this;
      const { onDelay } = config;
      const { on } = data;
      
      this.reset();
      
      if (!state.switchState) {
        state.switchState = true;
        serviceManager.refreshCharacteristicUI(Characteristic.On);
	this.setExclusivesOFF();

        if (on) {
          this.logs.debug(`setColorTemperature: (turn on, wait ${onDelay}s)`);
          await this.performSend(on);
          this.onDelayTimeoutPromise = delayForDuration(onDelay);
          await this.onDelayTimeoutPromise;
        }
	await this.mqttpublish('On', 'true');
      }
      if (data['colorTemperature+'] || data['colorTemperature-'] || data['availableColorTemperatureSteps']) {
        assert(data['colorTemperature+'] && data['colorTemperature-'] && data['availableColorTemperatureSteps'], `\x1b[31m[CONFIG ERROR] \x1b[33mcolorTemperature+, colorTemperature- and availableColorTemperatureSteps\x1b[0m need to be set.`);
	const targetColorTemperature = state.colorTemperature;
	await this.mutex.use(async () => {
	  let previous = previousValue ?? config.defaultColorTemperature;
	  if (targetColorTemperature !== state.colorTemperature) {
	    previous = state.colorTemperature;	// queued attemps.
	  }
	  const min = 140, max = 500;
	  const n = data['availableColorTemperatureSteps'] + 1;
	  const r = 1000 % n;
	  const delta = (1000 - r)/n;
	  const increment = data['colorTemperature+'];
	  const decrement = data['colorTemperature-'];
	  const current = Math.floor(Math.min((previous - min)/(max - min)*1000, delta*n - 1)/delta);
	  const target = Math.floor(Math.min((targetColorTemperature - min)/(max - min)*1000, delta*n - 1)/delta);
	  
	  this.logs.debug(`setColorTemperature: current:${String(previous).padStart(3, ' ')}(${String(current).padStart(2, ' ')}), target:${String(targetColorTemperature).padStart(3, ' ')}(${String(target).padStart(2, ' ')}), increment:${target - current} interval:${onDelay}s`);
	  if (current != target) {	// need incremental operation
	    const d = target - current;
	    try {
              await this.performSend([
		{'data': target > current ? increment : decrement,
		 'interval': onDelay,
		 'sendCount': Math.abs(target - current),
		}]);
	    } catch (e) {
              const {attempt, fail, timeout} = e;
	      const c = d > 0 ? d - attempt - fail : d + attempt + fail;
	      const u = Math.floor((Math.min((targetColorTemperature - min)/(max - min)*1000, delta*n - 1) - c*delta)*(max - min)/1000) + min;
	      this.logs.debug(`setColorTemperature: current:${targetColorTemperature}, request:${d}, attempt:${attempt}, fail:${fail}, timeout:${timeout}, adjust:${c}, update:${u}.`);
	      state.colorTemperature = u;
	      serviceManager.refreshCharacteristicUI(Characteristic.ColorTemperature);
	    }
	  }
	})
      } else {
        // Find closest to the one requested
        const foundValues = this.dataKeys('colorTemperature')
	
        assert(foundValues.length > 0, `\x1b[31m[CONFIG ERROR] \x1b[33mcolorTemperature\x1b[0m keys need to be set.`);
	
        const closest = foundValues.reduce((prev, curr) => Math.abs(curr - state.colorTemperature) < Math.abs(prev - state.colorTemperature) ? curr : prev);
        const hexData = data[`colorTemperature${closest}`];
	
        this.logs.debug(`setColorTemperature: (closest: ${closest})`);
        await this.performSend(hexData);
      }
      
      await this.checkAutoOnOff();
    });
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

  async getLastActivation(callback) {
    const lastActivation = this.state.lastActivation ?
	  Math.max(0, this.state.lastActivation - this.historyService.getInitialTime()) : 0;
    
    callback(null, lastActivation);
  }

  // MQTT
  onMQTTMessage (identifier, message) {
    const { Characteristic } = this;
    const { config } = this;
    const mqttStateOnly = config.mqttStateOnly === false ? false : true;

    super.onMQTTMessage(identifier, message);

    if (identifier.toLowerCase() === 'brightness') {
      const brightness = Number(this.mqttValuesTemp[identifier]);
      // this.reset();
      if (mqttStateOnly) {
	// this.state.brightness = brightness;
	// this.serviceManager.refreshCharacteristicUI(Characteristic.Brightness);
	this.serviceManager.updateCharacteristic(Characteristic.Brightness, brightness);
      } else {
	this.serviceManager.setCharacteristic(Characteristic.Brightness, brightness)
      }
      this.logs.debug(`onMQTTMessage: set brightness to ${this.state.brightness}.`);
    }
  }

  // localCharacteristic(key, uuid, props) {
  //   const { Characteristic } = this;
  //   let characteristic = class extends Characteristic {
  //     constructor() {
  // 	super(key, uuid);
  // 	this.setProps(props);
  //     }
  //   }
  //   characteristic.UUID = uuid;

  //   return characteristic;
  // }

  setupServiceManager () {
    const { Service, Characteristic } = this;
    const { data, name, config } = this;
    const { on, off } = data || { };
    const history = config.history === true || config.noHistory === false;
    
    //this.serviceManager = new this.serviceManagerClass(name, Service.Lightbulb, this.log);
    this.serviceManager = new this.serviceManagerClass(name, history ? Service.Switch : Service.Lightbulb, this.log);

    if (history) {
      // const LastActivationCharacteristic = this.localCharacteristic(
      // 	'LastActivation', 'E863F11A-079E-48FF-8F27-9C2605A29F52',
      // 	{format: Characteristic.Formats.UINT32,
      // 	 unit: Characteristic.Units.SECONDS,
      // 	 perms: [
      // 	   Characteristic.Perms.READ,
      // 	   Characteristic.Perms.NOTIFY
      // 	 ]});
      
      this.serviceManager.service.addOptionalCharacteristic(eve.Characteristics.LastActivation);
      this.serviceManager.addGetCharacteristic({
	name: 'LastActivation',
	// type: LastActivationCharacteristic,
	type: eve.Characteristics.LastActivation,
	method: this.getLastActivation,
	bind: this
      });

      this.serviceManager.service.addOptionalCharacteristic(Characteristic.Brightness);
    }
  
    this.serviceManager.addToggleCharacteristic({
      name: 'switchState',
      type: Characteristic.On,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        onData: on,
        offData: off,
        setValuePromise: this.setSwitchState.bind(this)
      }
    });

    this.serviceManager.getCharacteristic(Characteristic.On)
      .on('change', async function(event) {
	if (event.newValue !== event.oldValue) {
	  if (this.historyService) {
	    const value = event.newValue;
	    // this.logs.debug(`adding history of switchState.`, value);
	    const time = Math.round(new Date().valueOf()/1000);
	    // if (value) {
	    this.state.lastActivation = time;
	    // }
	    this.historyService.addEntry(
	      {time: time, status: value ? 1 : 0})
	    // await this.mqttpublish('On', value ? 'true' : 'false')
	  }
	}
      }.bind(this))
    
    this.serviceManager.addToggleCharacteristic({
      name: 'brightness',
      type: Characteristic.Brightness,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        setValuePromise: this.setBrightness.bind(this),
        ignorePreviousValue: true // TODO: Check what this does and test it
      }
    });

    if (this.dataKeys('colorTemperature').length > 0) {
      this.serviceManager.addToggleCharacteristic({
        name: 'colorTemperature',
        type: Characteristic.ColorTemperature,
        getMethod: this.getCharacteristicValue,
        setMethod: this.setCharacteristicValue,
        bind: this,
        props: {
          setValuePromise: this.setColorTemperature.bind(this),
          ignorePreviousValue: true // TODO: Check what this does and test it
        }
      });
    }
    if (this.dataKeys('hue').length > 0) {
      this.serviceManager.addToggleCharacteristic({
        name: 'hue',
        type: Characteristic.Hue,
        getMethod: this.getCharacteristicValue,
        setMethod: this.setCharacteristicValue,
        bind: this,
        props: {
          setValuePromise: this.setHue.bind(this),
          ignorePreviousValue: true // TODO: Check what this does and test it
        }
      });

      this.serviceManager.addToggleCharacteristic({
        name: 'saturation',
        type: Characteristic.Saturation,
        getMethod: this.getCharacteristicValue,
        setMethod: this.setCharacteristicValue,
        bind: this,
        props: {
          setValuePromise: this.setSaturation.bind(this),
          ignorePreviousValue: true // TODO: Check what this does and test it
        }
      });
    }
  }
}

module.exports = LightAccessory;
