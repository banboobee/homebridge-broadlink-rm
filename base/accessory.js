const persistentState = require('./helpers/persistentState');
const mqtt = require('mqtt');

class HomebridgeAccessory {

  constructor(log, config = {}, serviceManagerType = 'ServiceManager') {
    this.serviceManagerType = serviceManagerType;

    let { disableLogs, host, name, data, persistState, resendDataAfterReload, resendDataAfterReloadDelay } = config;

    // this.log = (!disableLogs && log) ? log : () => { };
    this.log = log;
    this.logLevel ??= 2; //Default to info
    this.config = config;

    this.host = host;
    this.name = name;
    this.data = data;

    this.state = {}

    this.checkConfig(config)
    this.setupServiceManager()
    this.loadState()

    this.setDefaults();

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
    const { name, log, logLevel } = this;
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
    const { config, host, log, name, logLevel } = this;

    try {
      const { delay, resendDataAfterReload, allowResend } = config;
      const { service, propertyName, onData, offData, setValuePromise, ignorePreviousValue } = props;

      const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

      if (delay) {
        this.logs.warn(`set${capitalizedPropertyName}: ${value} (delaying by ${delay}s)`);

        await delayForDuration(delay);
      }

      this.logs.info(`set${capitalizedPropertyName}: ${value}`);

      if (this.isReloadingState && !resendDataAfterReload) {
        this.state[propertyName] = value;

        this.logs.warn(`set${capitalizedPropertyName}: already ${value} (no data sent - A)`);

        callback(null);
        return;
      }

      if (!ignorePreviousValue && this.state[propertyName] == value && !this.isReloadingState) {
        if (!allowResend) {
          this.logs.warn(`set${capitalizedPropertyName}: already ${value} (no data sent - B)`);

          callback(null);
          return;
        }
      }

      let previousValue = this.state[propertyName];
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
    } catch (err) {
      this.logs.error('setCharacteristicValue error:', err.message);
      // callback(err)
    }
  }

  async getCharacteristicValue(props, callback) {
    const { propertyName, getValuePromise } = props;
    const { log, name, logLevel } = this;
    let value;

    const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

    if (this.state[propertyName] === undefined) {
      let thisCharacteristic = this.serviceManager.getCharacteristicTypeForName(propertyName);
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
    const { config, log, logLevel, name, serviceManager } = this;
    let { host, resendDataAfterReload, resendDataAfterReloadDelay, persistState } = config;

    // Set defaults
    if (persistState === undefined) {persistState = true;}
    if (!resendDataAfterReloadDelay) {resendDataAfterReloadDelay = 2}

    if (!persistState) {return;}

    // Load state from file
    const restoreStateOrder = this.restoreStateOrder();
    const state = !Object.keys(this.serviceManager.accessory.context).length ?
	  persistentState.load({ host, name }) || {} :
	  {...this.serviceManager.accessory.context}

    // Allow each accessory to correct the state if necessary
    this.correctReloadedState(state);
    this.serviceManager.accessory.context = {...state};
    // console.log(`${host}-${name} persist: ${JSON.stringify(state)}`);
    // console.log(`${host}-${name} context: ${JSON.stringify(this.serviceManager.accessory.context)}`);

    // Proxy so that whenever this.state is changed, it will persist to disk
    // this.state = addSaveProxy(name, state, (state) => {
    //   persistentState.save({ host, name, state });
    // });
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

        this.logs.info(`Accessory Ready`);
      }, (resendDataAfterReloadDelay * 1000) + 300);
    } else {
      this.logs.info(`Accessory Ready`);
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
    const { config, log, logLevel, name } = this;
    let { mqttTopic, mqttURL, mqttUsername, mqttPassword } = config;

    if (!mqttURL) {return;}

    this.mqttValues = {};
    this.mqttValuesTemp = {};

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

    mqttClient.on('connect', () => {
      this.isMQTTConnecting = false;

      this.logs.info(`MQTT client connected.`);

      [... new Set(mqttTopic?.map(x => x.topic))].forEach(x => {
	this.logs.info(`subscribes MQTT topic ${x}.`);
        mqttClient.subscribe(x);
      });

    })

    mqttClient.on('error', () => {
      this.isMQTTConnecting = false;
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
    const { log, logLevel, name } = this;

    let value = this.mqttValues[identifier];

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
    log: (log) => {
      this.log(`${this.name}`, String(log));
    },
    trace: (log) => {
      if (!this.config.disableLogs && this.logLevel < 1) {
	this.log(`\x1b[90m[TRACE] ${this.name}`, String(log), '\x1b[0m');
      }
    },
    debug: (log) => {
      if (!this.config.disableLogs && this.logLevel < 2) {
	this.log(`\x1b[90m[DEBUG] ${this.name}`, String(log), '\x1b[0m');
      }
    },
    info: (log) => {
      if (this.logLevel < 3) {
	this.log(`\x1b[35m[INFO]\x1b[0m ${this.name}`, String(log));
      }
    },
    warn: (log) => {
      if (this.logLevel < 4) {
	this.log(`\x1b[33m[WARN]\x1b[0m ${this.name}`, String(log));
      }
    },
    error: (log) => {
      // if (this.logLevel < 5) {
	this.log(`\x1b[31m[ERROR]\x1b[0m ${this.name}`, String(log));
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
