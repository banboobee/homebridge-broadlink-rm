// -*- js-indent-level : 2 -*-
const delayForDuration = require('../helpers/delayForDuration');
const catchDelayCancelError = require('../helpers/catchDelayCancelError');
const ping = require('../helpers/ping')
const arp = require('../helpers/arp')
const BroadlinkRMAccessory = require('./accessory');

class SwitchAccessory extends BroadlinkRMAccessory {
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
      (key, values) => this.configIsString(values[0]) || this.configIsObject(values[0]) && this.verifyConfig(values, key, this.configDataKeys),
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],

    // string
    'pingIPAddress$': [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],

    // boolean
    enableAutoOff: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    enableAutoOn: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    disableAutomaticOn: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    disableAutomaticOff: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    pingIPAddressStateOnly: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    pingUseArp: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    stateless: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    noHistory: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    history: [
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
      ['on']
    ],
    topic: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`']
  }
  static configDataKeys = {
    on: [
      (key, values) => this.configIsHex(key, values),
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    off: [
      (key, values) => this.configIsHex(key, values),
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
  }

  constructor (log, config = {}, platform) {
    super(log, config, platform);

    // Fakegato setup
    if (config.history === true || config.noHistory === false) {
      // this.historyService = new HistoryService('switch', { displayName: config.name, log: log }, { storage: 'fs', filename: 'RMPro_' + config.name.replace(' ','-') + '_persist.json'});
      this.historyService = new HistoryService('switch', this.serviceManager.accessory, { storage: 'fs', filename: 'RMPro_' + config.name.replace(' ','-') + '_persist.json'});
      this.historyService.addEntry(
	{time: Math.round(new Date().valueOf()/1000),
	 status: this.state.switchState ? 1 : 0})
    }
      
    if (!this.constructor.isUnitTest) {this.checkPing(ping)}
  }

  checkConfig(config) {
    this.constructor.verifyConfig([config], '', this.constructor.configKeys); 
  }
  
  setDefaults () {
    const { config } = this;
    config.pingFrequency = config.pingFrequency || 1;
    config.pingGrace = config.pingGrace || 10;

    config.offDuration = config.offDuration || 60;
    config.onDuration = config.onDuration || 60;

    if (config.enableAutoOn === undefined && config.disableAutomaticOn === undefined) {
      config.enableAutoOn = false;
    } else if (config.disableAutomaticOn !== undefined) {
      config.enableAutoOn = !config.disableAutomaticOn;
    }

    if (config.enableAutoOff === undefined && config.disableAutomaticOff === undefined) {
      config.enableAutoOff = false;
    } else if (config.disableAutomaticOff !== undefined) {
      config.enableAutoOff = !config.disableAutomaticOff;
    }
  }

  reset () {
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
      this.autoOnTimeoutPromise = null
    }
    
    if (this.pingGraceTimeout) {
      this.pingGraceTimeout.cancel();
      this.pingGraceTimeout = null;
    }
    
    if (this.serviceManager.getCharacteristic(Characteristic.On) === undefined) {
      this.state.switchState = false;
      this.serviceManager.refreshCharacteristicUI(Characteristic.On);
    }
  }

  checkAutoOnOff () {
    this.reset();
    this.checkPingGrace();
    this.checkAutoOn();
    this.checkAutoOff();
    
  }
  
  checkPing (ping) {
    const { config } = this
    const { pingIPAddress, pingFrequency, pingUseArp } = config;

    if (!pingIPAddress) {return}
    
    // Setup Ping/Arp-based State
    if(!pingUseArp) {
      ping(pingIPAddress, pingFrequency, this.pingCallback.bind(this));
    } else {
      arp(pingIPAddress, pingFrequency, this.pingCallback.bind(this));
    }
  }

  pingCallback (active) {
    const { Characteristic } = this;
    const { config, state, serviceManager } = this;

    if (this.stateChangeInProgress){
      return;
    }
    
    if (config.pingIPAddressStateOnly) {
      state.switchState = active ? true : false;
      serviceManager.refreshCharacteristicUI(Characteristic.On);

      return;
    }
    
    const value = active ? true : false;
    serviceManager.setCharacteristic(Characteristic.On, value);
  }

  async setSwitchState (hexData) {
    const { Characteristic } = this;
    const { config, state, serviceManager } = this;
    this.stateChangeInProgress = true;
    this.reset();

    if (hexData) {await this.performSend(hexData);}
    await this.mqttpublish('On', state.switchState ? 'true' : 'false')
    
    if (config.stateless === true) {
      state.switchState = false;
      serviceManager.refreshCharacteristicUI(Characteristic.On);
      await this.mqttpublish('On', 'false')
    } else {
      this.checkAutoOnOff();
    }
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
  
  async checkAutoOff () {
    const { Characteristic } = this;
    await catchDelayCancelError(async () => {
      const { config, state, serviceManager } = this;
      const { enableAutoOff, onDuration } = config;

      if (state.switchState && enableAutoOff) {
        this.logs.info(`setSwitchState: automatically turn off in ${onDuration} seconds`);

        this.autoOffTimeoutPromise = delayForDuration(onDuration);
        await this.autoOffTimeoutPromise;

        serviceManager.setCharacteristic(Characteristic.On, false);
      }
    });
  }

  async checkAutoOn () {
    const { Characteristic } = this;
    await catchDelayCancelError(async () => {
      const { config, state, serviceManager } = this;
      const { enableAutoOn, offDuration } = config;

      if (!state.switchState && enableAutoOn) {
        this.logs.info(`setSwitchState: automatically turn on in ${offDuration} seconds`);

        this.autoOnTimeoutPromise = delayForDuration(offDuration);
        await this.autoOnTimeoutPromise;

        serviceManager.setCharacteristic(Characteristic.On, true);
      }
    });
  }

  async getLastActivation(callback) {
    const lastActivation = this.state.lastActivation ?
	  Math.max(0, this.state.lastActivation - this.historyService.getInitialTime()) : 0;
    
    callback(null, lastActivation);
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

  // MQTT
  onMQTTMessage (identifier, message) {
    const { Characteristic } = this;
    const { config } = this;
    const mqttStateOnly = config.mqttStateOnly === false ? false : true;

    super.onMQTTMessage(identifier, message);

    if (identifier.toLowerCase() === 'on') {
      const on = this.mqttValuesTemp[identifier] === 'true' ? true : false;
      this.reset();
      if (mqttStateOnly) {
	// this.state.switchState = on;
	// this.serviceManager.refreshCharacteristicUI(Characteristic.On);
	this.serviceManager.updateCharacteristic(Characteristic.On, on);
      } else {
	this.serviceManager.setCharacteristic(Characteristic.On, on)
      }
      this.logs.debug(`onMQTTMessage: set switchState to ${this.state.switchState}.`);
    }
  }

  setupServiceManager () {
    const { Service, Characteristic } = this;
    const { data, name, config } = this;
    const { on, off } = data || { };
    const history = config.history === true || config.noHistory === false;
    
    this.serviceManager = new this.serviceManagerClass(name, Service.Switch, this.log);

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
    }
  
    this.serviceManager.addToggleCharacteristic({
      name: 'switchState',
      type: Characteristic.On,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        onData: on || data,
        offData: off || undefined,
        setValuePromise: this.setSwitchState.bind(this)
      }
    });

    this.serviceManager.getCharacteristic(Characteristic.On)
      .on('change', async function(event) {
	if (event.newValue !== event.oldValue) {
	  if (this.historyService) {
	    const value = event.newValue;
	    // this.logs.trace(`adding history of switchState.`, value);
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
  }
}

module.exports = SwitchAccessory;
