const ServiceManager = require('../helpers/serviceManager');
const persistentState = require('./helpers/persistentState');
const mqtt = require('mqtt');

class HomebridgeAccessory {

  static ServiceManagerClass = ServiceManager;
  constructor(log, config = {}, platform){
    if (this.constructor.ServiceManagerClass === ServiceManager) {
      this.isUnitTest = false;
      this.serviceManagerType = 'ServiceManager';
    } else {
      this.isUnitTest = true;
      this.serviceManagerType = 'FakeServiceManager';
    }
    this.serviceManagerClass = this.constructor.ServiceManagerClass;
    
    const { host, name, data } = config;

    // this.log = (!disableLogs && log) ? log : () => { };
    this.log = log;
    this.logLevel ??= 2; //Default to info
    this.config = config;
    this.platform = platform;

    this.host = host;
    this.name = name;
    this.data = data;

    this.state = {}

    // short cuts
    this.Service = platform.api.hap.Service;
    this.Accessory = platform.api.hap.Accessory;
    this.Characteristic = platform.api.hap.Characteristic;
    this.Categories = platform.api.hap.Categories;

    // MQTT Support
    this.mqttValues = {};
    this.mqttValuesTemp = {};
    
    //Set LogLevel
    switch (this.config.logLevel) {
      case 'none':
        this.logLevel = 6;
        break;
      case 'critical':
        this.logLevel = 5;
        break;
      case 'error':
        this.logLevel = 4;
        break;
      case 'warning':
        this.logLevel = 3;
        break;
      case 'info':
        this.logLevel = 2;
        break;
      case 'debug':
        this.logLevel = 1;
        break;
      case 'trace':
        this.logLevel = 0;
        break;
      default:
        //default to 'info':
        if(this.config.logLevel !== undefined) {log(`\x1b[31m[CONFIG ERROR] \x1b[33mlogLevel\x1b[0m should be one of: trace, debug, info, warning, error, critical, or none.`);}
        this.logLevel = 2;
        break;
    }
    if(this.config.debug) {this.logLevel = Math.min(1, this.logLevel);}
    // if(this.config.disableLogs) {this.logLevel = 6;}

    this.checkConfig(config)
    this.setupServiceManager()
    this.loadState()

    this.setDefaults();

    this.serviceManager.service.addOptionalCharacteristic(this.Characteristic.StatusActive);
    this.serviceManager.addToggleCharacteristic({
      name: 'statusActive',
      type: this.Characteristic.StatusActive,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
      }
    });
    this.serviceManager.updateCharacteristic(this.Characteristic.StatusActive, this.isUnitTest || this.config.host === undefined);

    this.subscribeToMQTT();
  }

  setDefaults() {
    if (this.config.allowResend === undefined) {
      if (this.config.preventResendHex === undefined) {
        this.config.allowResend = true;
      } else {
        this.config.allowResend = !this.config.preventResendHex;
      }
    }
  }

  restoreStateOrder() { }

  correctReloadedState() { }

  checkConfig(config) {
    const { name, log } = this;
    if (typeof config !== 'object') {return;}

    Object.keys(config).forEach((key) => {
      const value = config[key];

      if (value === 'true' || value === 'false') {
        log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name}Boolean values should look like this: \x1b[32m"${key}": ${value}\x1b[0m not this \x1b[31m"${key}": "${value}"\x1b[0m`);

        process.exit(0);
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          this.checkConfig(item);
        })
      } else if (typeof value === 'object') {
        this.checkConfig(value);
      } else if (value === '0' || (typeof value === 'string' && parseInt(value) !== 0 && !isNaN(parseInt(value)))) {

        if (typeof value === 'string' && value.split('.').length - 1 > 1) {return;}
        if (typeof value === 'string' && !value.match(/^\d\.{0,1}\d*$/)) {return;}

        log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name}Numeric values should look like this: \x1b[32m"${key}": ${value}\x1b[0m not this \x1b[31m"${key}": "${value}"\x1b[0m`);

        process.exit(0);
      }
    })
  }

  // identify(callback) {
  //   const { name, log, logLevel } = this

  //   if (logLevel <= 1) {log(`Identify requested for ${name}`);}

  //   callback();
  // }

  performSetValueAction({ host, data, log, name }) {
    throw new Error('The "performSetValueAction" method must be overridden.');
  }

  async setCharacteristicValue(props, value, callback) {
    const { config, host, log, name } = this;
    let previousValue = this.state[props.propertyName];

    try {
      const { delay, resendDataAfterReload, allowResend } = config;
      const { propertyName, onData, offData, setValuePromise, ignorePreviousValue } = props;

      const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

      if (this.state['statusActive'] === false) {
	this.logs.error(`failed to set ${capitalizedPropertyName} to ${value} due to offline the device.`);
	callback(true);
	return;
      }

      if (delay) {
        this.logs.warn(`set${capitalizedPropertyName}: ${value} (delaying by ${delay}s)`);

        await delayForDuration(delay);
      }

      this.logs.info(`set${capitalizedPropertyName}: ${value}`);

      if (this.isReloadingState && !resendDataAfterReload) {
        this.state[propertyName] = value;

        this.logs.debug(`set${capitalizedPropertyName}: already ${value} (no data sent - A)`);

        callback(null);
        return;
      }

      if (!ignorePreviousValue && this.state[propertyName] == value && !this.isReloadingState) {
        if (!allowResend) {
          this.logs.debug(`set${capitalizedPropertyName}: already ${value} (no data sent - B)`);

          callback(null);
          return;
        }
      }

      // previousValue = this.state[propertyName];
      if (this.isReloadingState && resendDataAfterReload) {
        previousValue = undefined
      }

      this.state[propertyName] = value;
      
      callback(null);

      // Set toggle data if this is a toggle
      const data = value ? onData : offData;

      if (setValuePromise) {
        await setValuePromise(data, previousValue);
      } else if (data) {
        await this.performSetValueAction({ host, data, log, name });
      }
      // callback(null);
    } catch (e) {	// revert to original state.
      const thisCharacteristic = this.serviceManager.getCharacteristicTypeForName(props.propertyName);
      // this.state[props.propertyName] = previousValue;
      // this.serviceManager.refreshCharacteristicUI(thisCharacteristic);
      this.serviceManager.updateCharacteristic(thisCharacteristic, previousValue);
      this.logs.error(`failed setCharacteristicValue of ${props.propertyName} characteristic.`, e.message ?? '');
      this.logs.trace(e.stack ?? 'Error: empty stack')
      // callback(e)
    }
  }

  async getCharacteristicValue(props, callback) {
    const { propertyName, getValuePromise } = props;
    let value;

    const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

    if (this.state[propertyName] === undefined) {
      const thisCharacteristic = this.serviceManager.getCharacteristicTypeForName(propertyName);
      if (this.serviceManager.getCharacteristic(thisCharacteristic).props.format != 'bool' && this.serviceManager.getCharacteristic(thisCharacteristic).props.minValue) {
        value = this.serviceManager.getCharacteristic(thisCharacteristic).props.minValue;
      } else {
        value = 0;
      }
    } else {
      value = this.state[propertyName];
    }

    if (getValuePromise) {
      value = await getValuePromise(value);
      this.state[propertyName] = value;
    }
    
    this.logs.trace(`get${capitalizedPropertyName}: ${value}`);
    
    callback(null, value);
  }

  loadState() {
    const { config, name, serviceManager } = this;
    const { host, resendDataAfterReload } = config;
    let { resendDataAfterReloadDelay, persistState } = config;

    // Set defaults
    if (persistState === undefined) {persistState = true;}
    if (!resendDataAfterReloadDelay) {resendDataAfterReloadDelay = 2}
    this.serviceManager.state = this.state;

    if (!persistState) {return;}

    // Load state from file
    /* const restoreStateOrder = */ this.restoreStateOrder();
    const state = !Object.keys(this.serviceManager.accessory?.context ?? {}).length ?
	  persistentState.load({ host, name }) || {} :
	  {...this.serviceManager.accessory.context}

    // Allow each accessory to correct the state if necessary
    this.correctReloadedState(state);
    // console.log(`${host}-${name} persist: ${JSON.stringify(state)}`);
    // console.log(`${host}-${name} context: ${JSON.stringify(this.serviceManager.accessory.context)}`);

    // Proxy so that whenever this.state is changed, it will persist to disk
    // this.state = addSaveProxy(name, state, (state) => {
    //   persistentState.save({ host, name, state });
    // });
    if (this.isUnitTest) {
      this.state = new Proxy(state, {
	set: async function(target, key, value) {
	  Reflect.set(target, key, value);
	  persistentState.save({ host, name, state });
	  // this.serviceManager.accessory.context[key] = value;
	  // console.log(`${host}-${name} persist: ${JSON.stringify(state)}`);
	  // console.log(`${host}-${name} context: ${JSON.stringify(this.serviceManager.accessory.context)}`);
	  
	  return true
	}.bind(this)
      })
    } else {
      this.serviceManager.accessory.context = {...state};
      this.state = new Proxy(state, {
	set: async function(target, key, value) {
	  Reflect.set(target, key, value);
	  // persistentState.save({ host, name, state });
	  this.serviceManager.accessory.context[key] = value;
	  // console.log(`${host}-${name} persist: ${JSON.stringify(state)}`);
	  // console.log(`${host}-${name} context: ${JSON.stringify(this.serviceManager.accessory.context)}`);
	  
	  return true
	}.bind(this)
      })
    }
    this.serviceManager.state = this.state;

    // Refresh the UI and resend data based on existing state
    Object.keys(serviceManager.characteristics).forEach((name) => {
      if (this.state[name] === undefined) {return;}

      const characteristcType = serviceManager.characteristics[name];

      // Refresh the UI for any state that's been set once the init has completed
      // Use timeout as we want to make sure this doesn't happen until after all child contructor code has run
      setTimeout(() => {
        if (persistState) {serviceManager.refreshCharacteristicUI(characteristcType);}
      }, 200);

      // Re-set the value in order to resend
      if (resendDataAfterReload) {

        // Delay to allow Broadlink to be discovered
        setTimeout(() => {
          const value = this.state[name];

          serviceManager.setCharacteristic(characteristcType, value);
        }, (resendDataAfterReloadDelay * 1000));
      }
    })

    if (resendDataAfterReload) {
      this.isReloadingState = true;

      setTimeout(() => {
        this.isReloadingState = false;
	
        this.log(`Initializing ${this.config.type} accessory ${this.name}.`);
      }, (resendDataAfterReloadDelay * 1000) + 300);
    } else {
	this.log(`Initializing ${this.config.type} accessory ${this.name}.`);
    }
  }

  // getInformationServices() {
  //   const informationService = new Service.AccessoryInformation();
  //   informationService
  //     .setCharacteristic(Characteristic.Manufacturer, this.manufacturer || 'Homebridge Easy Platform')
  //     .setCharacteristic(Characteristic.Model, this.model || 'Unknown')
  //     .setCharacteristic(Characteristic.SerialNumber, this.serialNumber || 'Unknown');

  //   return [informationService];
  // }

  // getServices() {
  //   const services = this.getInformationServices();

  //   services.push(this.serviceManager.service);

  //   if (this.historyService && this.config.noHistory !== true) {
  //     //Note that noHistory is not working as intended. Need to pull from platform config
  //     services.push(this.historyService);
  //   }

  //   return services;
  // }

  // MQTT Support
  subscribeToMQTT() {
    const { config, log, name } = this;
    const { mqttURL, mqttUsername, mqttPassword } = config;
    let { mqttTopic } = config;

    if (!mqttURL) {return;}

    // this.mqttValues = {};
    // this.mqttValuesTemp = {};

    // Perform some validation of the mqttTopic option in the config.
    if (mqttTopic && typeof mqttTopic !== 'string' && !Array.isArray(mqttTopic)) {
      log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name} \x1b[33mmqttTopic\x1b[0m value is incorrect. Please check out the documentation for more details.`);

      return;
    }

    if (Array.isArray(mqttTopic)) {
      const erroneousTopics = mqttTopic.filter((mqttTopicObj) => {
        if (typeof mqttTopic !== 'object') {return true;}

        const { identifier, topic } = mqttTopicObj;

        if (!identifier || !topic) {return true;}
        if (typeof identifier !== 'string') {return true;}
        if (typeof topic !== 'string') {return true;}
      });

      if (erroneousTopics.length > 0) {
        log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name} \x1b[33mmqttTopic\x1b[0m value is incorrect. Please check out the documentation for more details.`);

        return;
      }
    }

    // mqqtTopic may be an array or an array of objects. Add to a new array if string.
    if (typeof mqttTopic === 'string') {
      const mqttTopicObj = {
        identifier: 'unknown',
        topic: mqttTopic
      }

      mqttTopic = [mqttTopicObj]
      config.mqttTopic = mqttTopic;
    }

    // Create an easily referenced instance variable
    // const mqttTopicIdentifiersByTopic = {};
    // mqttTopic && mqttTopic.forEach(({ identifier, topic }) => {
    //   mqttTopicIdentifiersByTopic[topic] = identifier;
    // })

    // Connect to mqtt
    const mqttClientID = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    const options = {
      keepalive: 10,
      clientId: this.client_Id,
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      serialnumber: mqttClientID,
      username: mqttUsername,
      password: mqttPassword,
      will: {
        topic: 'WillMsg',
        payload: 'Connection Closed abnormally..!',
        qos: 0,
        retain: false
      },
      rejectUnauthorized: false
    };

    const mqttClient = mqtt.connect(mqttURL, options);
    this.mqttClient = mqttClient;

    // Subscribe to topics
    this.isMQTTConnecting = true;

    // Timeout isMQTTConnecting - it's used to prevent error messages about not being connected.
    setTimeout(() => {
      this.isMQTTConnecting = false;
    }, 2000)

    mqttClient.on('connect', (packet) => {
      this.isMQTTConnecting = false;

      if (process.uptime() < 600) { // Only use console during startup
	this.logs.info(`connected to MQTT broker ${mqttURL}.`);
	this.logs.trace(`packet: ${JSON.stringify(packet, null, 2)}`);

	[... new Set(mqttTopic?.map(x => x.topic))].forEach(x => {
	  this.logs.info(`subscribes MQTT topic ${x}.`);
          mqttClient.subscribe(x);
	});
      }

    })

    mqttClient.on('disconnect', (packet) => {
      this.logs.warn(`disconnected from MQTT broker ${mqttURL}. packet: ${JSON.stringify(packet, null, 2)}`);
      this.isMQTTConnecting = true;
    })

    mqttClient.on('reconnect', () => {
      this.logs.warn(`reconnecting to MQTT broker ${mqttURL}.`);
      this.isMQTTConnecting = true;
    })

    mqttClient.on('error', (e) => {
      this.logs.error(`failed to connect MQTT broker ${mqttURL}. ${e}`);
    })

    mqttClient.on('close', () => {
      this.logs.info(`closed connection to MQTT broker ${mqttURL}.`);
      this.isMQTTConnecting = true;
    })

    this.platform.api.on('shutdown', async () => {
      this.mqttClient.end();
    })

    mqttClient.on('message', (topic, message) => {
      // const identifier = mqttTopicIdentifiersByTopic[topic];

      mqttTopic.filter(x => x.topic === topic).forEach(x => {
	this.onMQTTMessage(x.identifier, message.toString());
      })
    })
  }

  async mqttpublish (topic, message) {
    if (this.mqttClient) {
      try {
	await this.mqttClient.publish(`homebridge-broadlink-rm/${this.config.type}/${this.name}/${topic}`, `${message}`, {"retain": true})
	// this.logs.debug(`MQTT publish(topic: ${topic}, message: ${message})`)
      } catch (e) {
	this.logs.error(`Failed to publish MQTT message. ${e}`)
      }
    }
  }
  
  onMQTTMessage(identifier, message) {
    // this.mqttValuesTemp[identifier] = message.toString();
    this.mqttValuesTemp[identifier] = message;
  }

  mqttValueForIdentifier(identifier) {
    const value = this.mqttValues[identifier];

    // No identifier may have been set in the user's config so let's try "unknown" too
    // if (value === undefined) {value = this.mqttValues.unknown;}

    if (!this.mqttClient.connected) {
      if (!this.isMQTTConnecting) {
	this.logs.error(`MQTT client is not connected. Value could not be found for topic with identifier "${identifier}".`);
      }

      return;
    }

    if (value === undefined) {
      this.logs.error(`No MQTT value could be found for topic with identifier "${identifier}".`);

      return;
    }

    return value;
  }

  logs = {
    log: (format, ...args) => {
      format = "%s " + format;
      this.log(format, `${this.name}`, ...args);
    },
    trace: (format, ...args) => {
      if (!this.config.disableLogs && this.logLevel < 1) {
	format = "%s " + format;
	this.log(format, `\x1b[90m[TRACE] ${this.name}`, ...args, '\x1b[0m');
      }
    },
    debug: (format, ...args) => {
      if (!this.config.disableLogs && this.logLevel < 2) {
	format = "%s " + format;
	this.log(format, `\x1b[90m[DEBUG] ${this.name}`, ...args, '\x1b[0m');
      }
    },
    info: (format, ...args) => {
      if (this.logLevel < 3) {
	format = "%s " + format;
	this.log(format, `\x1b[35m[INFO]\x1b[0m ${this.name}`, ...args);
      }
    },
    warn: (format, ...args) => {
      if (this.logLevel < 4) {
	format = "%s " + format;
	this.log(format, `\x1b[33m[WARN]\x1b[0m ${this.name}`, ...args);
      }
    },
    error: (format, ...args) => {
      // if (this.logLevel < 5) {
        format = "%s " + format;
        this.log(format, `\x1b[31m[ERROR]\x1b[0m ${this.name}`, ...args);
      // }
    }
  }

}

module.exports = HomebridgeAccessory;

const delayForDuration = (duration) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration * 1000)
  })
}
