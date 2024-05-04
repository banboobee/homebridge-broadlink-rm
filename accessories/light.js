// -*- js-indent-level : 2 -*-
const { assert } = require('chai');
const ServiceManagerTypes = require('../helpers/serviceManagerTypes');
const delayForDuration = require('../helpers/delayForDuration');
const catchDelayCancelError = require('../helpers/catchDelayCancelError')

const SwitchAccessory = require('./switch');

class LightAccessory extends SwitchAccessory {
    
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
    const { config, name, log, logLevel } = this;
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
	  log(`${name}: No light accessory could be found with the name "${exname}". Please update the "exclusives" value or add matching light accessories.`);
        }
      });
    }
  }

  async setExclusivesOFF () {
    const { log, name, logLevel } = this;
    if (this.exclusives) {
      this.exclusives.forEach(x => {
	if (x.state.switchState) {
	  this.log(`${name} setSwitchState: (${x.name} is configured to be turned off)`);
	  x.reset();
	  x.state.switchState = false;
	  x.lastBrightness = undefined;
          x.serviceManager.refreshCharacteristicUI(Characteristic.On);
	}
      });
    }
  }

  async setSwitchState (hexData, previousValue) {
    const { config, data, host, log, name, state, logLevel, serviceManager } = this;
    let { defaultBrightness, useLastKnownBrightness } = config;
    let { defaultColorTemperature, useLastKnownColorTemperature } = config;    

    this.reset();

    if (state.switchState) {
      this.setExclusivesOFF();
      const brightness = (useLastKnownBrightness && state.brightness > 0) ? state.brightness : defaultBrightness;
      const colorTemperature = useLastKnownColorTemperature ? state.colorTemperature : defaultColorTemperature;
      if (brightness !== state.brightness || previousValue !== state.switchState || colorTemperature !== state.colorTemperature) {
        log(`${name} setSwitchState: (brightness: ${brightness})`);

        state.switchState = false;
        state.brightness = brightness;
        serviceManager.setCharacteristic(Characteristic.Brightness, brightness);
	serviceManager.refreshCharacteristicUI(Characteristic.Brightness);
	if (this.dataKeys('colorTemperature').length > 0) {
          state.colorTemperature = colorTemperature;
          serviceManager.setCharacteristic(Characteristic.ColorTemperature, colorTemperature);
	  serviceManager.refreshCharacteristicUI(Characteristic.ColorTemperature);
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
    await catchDelayCancelError(async () => {
      const { config, data, host, log, name, state, logLevel, serviceManager} = this;
      const { onDelay } = config;
      const { off, on } = data;

      this.reset();

      if (!state.switchState) {

        state.switchState = true;
        serviceManager.refreshCharacteristicUI(Characteristic.On);

        if (on) {
          log(`${name} setHue: (turn on, wait ${onDelay}s)`);
          await this.performSend(on);

          log(`${name} setHue: (wait ${onDelay}s then send data)`);
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
        log(`${name} setHue: (closest: white)`);
      } else {
        hexData = data[`hue${closest}`];
        log(`${name} setHue: (closest: hue${closest})`);
      }
      await this.performSend(hexData);
    });
  }

  async setBrightness (dummy, previousValue) {
    await catchDelayCancelError(async () => {
      const { config, data, host, log, name, state, logLevel, serviceManager } = this;
      const { off, on } = data;
      let { onDelay } = config;

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
            log(`${name} setBrightness: (turn on, wait ${onDelay}s)`);
            await this.performSend(on);
    
            this.onDelayTimeoutPromise = delayForDuration(onDelay);
            await this.onDelayTimeoutPromise;
          }
    	  await this.mqttpublish('On', 'true');
        }

	if (data['brightness+'] || data['brightness-'] || data['availableBrightnessSteps']) {
          assert(data['brightness+'] && data['brightness-'] && data['availableBrightnessSteps'], `\x1b[31m[CONFIG ERROR] \x1b[33mbrightness+, brightness- and availableBrightnessSteps\x1b[0m need to be set.`);
	  
	  const n = data['availableBrightnessSteps'] + 1;
	  const r = 1000 % n;
	  const delta = (1000 - r)/n;
	  const increment = data['brightness+'];
	  const decrement = data['brightness-'];
	  const current = previousValue > 0 ? Math.floor(Math.min(previousValue*10, delta*n - 1)/delta) + 1 : 0;
	  const target = state.brightness > 0 ? Math.floor(Math.min(state.brightness*10, delta*n - 1)/delta) + 1 : 0;

	  log(`${name} setBrightness: (current:${previousValue}%(${current}) target:${state.brightness}%(${target}) increment:${target - current} interval:${onDelay}s)`);
	  if (current != target) {	// need incremental operation
            await this.performSend([
	      {'data': target > current ? increment : decrement,
	       'interval': onDelay,
	       'sendCount': Math.abs(target - current),
	      }]);
	  }
	} else {
          // Find brightness closest to the one requested
          const foundValues = this.dataKeys('brightness')
	  
          assert(foundValues.length > 0, `\x1b[31m[CONFIG ERROR] \x1b[33mbrightness\x1b[0m keys need to be set. See the config-sample.json file for an example.`);
	  
          const closest = foundValues.reduce((prev, curr) => Math.abs(curr - state.brightness) < Math.abs(prev - state.brightness) ? curr : prev);
          const hexData = data[`brightness${closest}`];
	  
          log(`${name} setBrightness: (closest: ${closest})`);
          await this.performSend(hexData);
	}
      } else {
        log(`${name} setBrightness: (off)`);
        await this.performSend(off);
    	await this.mqttpublish('On', 'false');
      }

      await this.checkAutoOnOff();
    });
  }

  async setColorTemperature(dummy, previousValue) {
    await catchDelayCancelError(async () => {
      const { config, data, host, log, name, state, logLevel, serviceManager} = this;
      const { onDelay } = config;
      const { off, on } = data;
      
      this.reset();
      
      if (!state.switchState) {
        state.switchState = true;
        serviceManager.refreshCharacteristicUI(Characteristic.On);
	this.setExclusivesOFF();

        if (on) {
          log(`${name} setColorTemperature: (turn on, wait ${onDelay}s)`);
          await this.performSend(on);
          this.onDelayTimeoutPromise = delayForDuration(onDelay);
          await this.onDelayTimeoutPromise;
        }
	await this.mqttpublish('On', 'true');
      }
      if (data['colorTemperature+'] || data['colorTemperature-'] || data['availableColorTemperatureSteps']) {
        assert(data['colorTemperature+'] && data['colorTemperature-'] && data['availableColorTemperatureSteps'], `\x1b[31m[CONFIG ERROR] \x1b[33mcolorTemperature+, colorTemperature- and availableColorTemperatureSteps\x1b[0m need to be set.`);
	const min = 140, max = 500;
	const n = data['availableColorTemperatureSteps'] + 1;
	const r = 1000 % n;
	const delta = (1000 - r)/n;
	const increment = data['colorTemperature+'];
	const decrement = data['colorTemperature-'];
	const current = Math.floor(Math.min((previousValue - min)/(max - min)*1000, delta*n - 1)/delta);
	const target = Math.floor(Math.min((state.colorTemperature - min)/(max - min)*1000, delta*n - 1)/delta);
	
	log(`${name} setColorTemperature: (current:${previousValue}(${current}) target:${state.colorTemperature}(${target}) increment:${target - current} interval:${onDelay}s)`);
	if (current != target) {	// need incremental operation
          await this.performSend([
	    {'data': target > current ? increment : decrement,
	     'interval': onDelay,
	     'sendCount': Math.abs(target - current),
	    }]);
	}
      } else {
        // Find closest to the one requested
        const foundValues = this.dataKeys('colorTemperature')
	
        assert(foundValues.length > 0, `\x1b[31m[CONFIG ERROR] \x1b[33mcolorTemperature\x1b[0m keys need to be set.`);
	
        const closest = foundValues.reduce((prev, curr) => Math.abs(curr - state.colorTemperature) < Math.abs(prev - state.colorTemperature) ? curr : prev);
        const hexData = data[`colorTemperature${closest}`];
	
        log(`${name} setColorTemperature: (closest: ${closest})`);
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

  setupServiceManager () {
    const { data, name, config, serviceManagerType } = this;
    const { on, off } = data || { };
    const history = config.history === true || config.noHistory === false;
    
    //this.serviceManager = new ServiceManagerTypes[serviceManagerType](name, Service.Lightbulb, this.log);
    this.serviceManager = new ServiceManagerTypes[serviceManagerType](name, history ? Service.Switch : Service.Lightbulb, this.log);

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
	    // this.log(`adding history of switchState.`, value);
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
