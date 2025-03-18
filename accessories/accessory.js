const HomebridgeAccessory = require('../base/accessory');
const sendData = require('../helpers/sendData');
// const delayForDuration = require('../helpers/delayForDuration');
// const catchDelayCancelError = require('../helpers/catchDelayCancelError');
const { getDevice } = require('../helpers/getDevice');

class BroadlinkRMAccessory extends HomebridgeAccessory {
  static configCommonKeys = {
    // common
    name: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    type: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    host: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    disabled: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    disableLogs: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'.`);
	return true;
      },
      '`value ${JSON.stringify(value)} is not a boolean`'],
    logLevel: [
      (key, values, choices) => this.configIsSelection(values[0], choices),
      '`${JSON.stringify(value)} should be one of: ${choices.map(x => `"${x}"`).join()}`',
      ['trace', 'debug', 'info', 'warning', 'error']
    ],
    isUnitTest: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'.`);
	return true;
      },
      '`value ${JSON.stringify(value)} is not a boolean`'],
    persistState: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    allowResend: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    preventResendHex: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'. Use 'allowresend' property instead.`);
	return true;
      },
      '`Unsupported config key. Use \'allowResend\' instead`'],
    resendHexAfterReloadDelay: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    'resendHexAfterReload$': [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
    resendDataAfterReloadDelay: [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'. Use 'resendHexAfterReloadDelay' property instead.`);
	return true;
      },
      '`Unsupported config key. Use \'resendHexAfterReloadDelay\' instead`'],
    'resendDataAfterReload$': [
      (key, values) => {
	this.logs.config.error(`contains \x1b[33munsupported\x1b[0m property '${key}'. Use 'resendHexAfterReload' property instead.`);
	return true;
      },
      '`Unsupported config key. Use \'resendHexAfterReload\' instead`'],
  }
  static configMqttKeys = {
    mqttTopic: [
      (key, values) => this.configIsMQTTTopic(key, values, this.configMqttTopicKeys),
      '`value ${JSON.stringify(value)} is not a valid mqttTopic`'],
    mqttURL: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    mqttUsername: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    mqttPassword: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    mqttStateOnly: [
      (key, values) => this.configIsBoolean(values[0]),
      '`value ${JSON.stringify(value)} is not a boolean`'],
  }
  static configMqttTopicKeys = {
    identifier: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    topic: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
  }
  static configDataKeys = {
    on: [
      (key, values) => this.configIsHex(key, values),
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    off: [
      (key, values) => this.configIsHex(key, values),
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
  }
  static configHexKeys = {
    data: [
      (key, values) => this.configIsHex(key, values),
      '`value ${JSON.stringify(value)} is not a valid HEX code`'
    ],
  }
  static configAdvancedHexKeys = {
    timeout: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    pause: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    sendCount: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    interval: [
      (key, values) => this.configIsNumber(values[0]),
      '`value ${JSON.stringify(value)} is not a number`'],
    eval: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
    data: [
      (key, values) => this.configIsString(values[0]),
      '`value ${JSON.stringify(value)} is not a string`'],
  }
  static configIsString(value) {
    return typeof value === 'string'
  }
  static configIsBoolean(value) {
    return typeof value === 'boolean'
  }
  static configIsNumber(value, range = undefined) {
    return typeof value !== 'string' && !Number.isNaN(Number(value)) && !(range?.[0] > value) && !(range?.[1] < value)
  }
  static configIsSelection(value, oneof) {
    return oneof.find(x => x === value);
  }
  static configIsArray(value) {
    return Array.isArray(value);
  }
  static configIsObject(value) {
    return typeof value === 'object' && !this.configIsArray(value);
  }
  static configIsHex(property, values) {
    // console.log('configIsHex', property, value);
    if (this.configIsString(values[0])) {
      return true;
    } else if (this.configIsArray(values[0])) {
      let data = false;
      values[0].forEach(element => {
	if (this.configIsObject(element)) {
	  values.unshift(element);
	  const d = Object.keys(element).find?.(x => x === 'data' || x === 'eval');
	  const r = Object.keys(element).find?.(x => x === 'sendCount');
	  const x = Object.keys(element).find?.(x => x === 'interval');
	  this.verifyConfig(values, property, this.configAdvancedHexKeys);
	  if (!!r && !d) {
	    this.logs.config.error(`failed to verify '${property}' property of 'data'. 'sendCount' without HEX code.`);
	  }
	  if (!!x && !d) {
	    this.logs.config.error(`failed to verify '${property}' property of 'data'. 'interval' without HEX code.`);
	  }
	  data |= !!d;
	  // console.log(`d:${d} r:${r} x:${x} data:${data}`);
	  values.shift();
	} else {
	  this.logs.config.error(`failed to verify '${property}' property of 'data'. '${JSON.stringify(element)}' is not a valid advanced HEX code.`);
	}
      })
      if (!data) {
	this.logs.config.error(`failed to verify '${property}' property of 'data'. missing HEX code.`);
      }
      return true;
    } else if (this.configIsObject(values[0])) {
      const data = Object.keys(values[0]).find?.(x => x === 'data');
      this.verifyConfig(values, property, this.configHexKeys);
      if (!data) {
	this.logs.config.error(`failed to verify '${property}' property of 'data'. missing HEX code.`);
      }
      return true;
    }
  }
  static configIsMQTTTopic(property, values, topics) {
    if (this.configIsString(values[0])) {
      return true;
    } else if (this.configIsArray(values[0])) {
      values[0].forEach(element => {
	if (this.configIsObject(element)) {
	  values.unshift(element);
	  const identifier = element?.identifier;
	  const topic = element?.topic;
	  const characteristic = element?.characteristic;
	  this.verifyConfig(values, property, topics);
	  if (!identifier) {
	    this.logs.config.error(`failed to verify '${property}' property. missing 'identifier' property.`);
	  } else if (!characteristic && this.configIsString(identifier) && topics?.identifier?.[2] && !topics.identifier[2].find(x => x === identifier.toLowerCase())) {
	    this.logs.config.error(`failed to verify 'identifier' property of '${property}'. value ${JSON.stringify(identifier)} is not one of ${topics.identifier[2].map(x => `"${x}"`).join()}.`);
	  }
	  if (!topic) {
	    this.logs.config.error(`failed to verify '${property}' property. missing 'topic' property.`);
	  }
	  values.shift();
	} else {
	  this.logs.config.error(`failed to verify '${property}' property. value '${JSON.stringify(element)}' is not a valid mqttTopic.`);
	}
      });
      return true;
    } else {
      this.logs.config.error(`failed to verify '${property}' property. value '${JSON.stringify(values[0])}' is not a valid mqttTopic.`);
      return true;
    }
  }
  static verifyConfig(values, property, options) {
    Object.keys(values[0]).forEach((key) => {
      const match = Object.keys(options).find(y => key.match(y));
      const value = values[0][key];
      values.unshift(value);
      // this.logs.config.debug(key, value, match);
      // console.log(key, value, match);
      if (match) {
	const checker = options[match][0];
	const message = options[match][1];
	const choices = options[match][2];
	if (!checker(key, values, choices)) {
	  this.logs.config.error(`failed to verify '${key}' property${property ? ` of '${property}'` : ''}. ${eval(message)}.`);
	}
      } else {
	this.logs.config.debug(`contains unknown property '${key}'${property ? ` in property '${property}'` : ''}.`);
      }
      values.shift();
    })

    return true;
  }

  constructor(log, config = {}, platform) {
    if (!config.name) {config.name = "Unknown Accessory"}

    // config.resendDataAfterReload = config.resendHexAfterReload;
    if (config.host) {
      //Clean up MAC address formatting
      config.host = config.host.toLowerCase();
      if (!config.host.includes(".") && !config.host.includes(":") && config.host.length === 12){
        config.host = config.host.match(/[\s\S]{1,2}/g).join(':');
      }
    }

    super(log, config, platform);
    if (config.debug) {this.debug = true}
  }

  performSetValueAction ({ host, data, log, name, logLevel }) {
    sendData({ host, hexData: data, log, name, logLevel });
  }
  
  reset () {
    // Clear Multi-hex timeouts
    // if (this.intervalTimeoutPromise) {
    //   this.intervalTimeoutPromise.cancel();
    //   this.intervalTimeoutPromise = null;
    // }

    // if (this.pauseTimeoutPromise) {
    //   this.pauseTimeoutPromise.cancel();
    //   this.pauseTimeoutPromise = null;
    // }
  }

  async performSend (hex, actionCallback) {
    const { logLevel, host, log, name } = this;
    let r = 0, x = 0;

    //Error catch
    if (hex === undefined) return;

    // Get the Broadlink device
    const device = getDevice({ host, log });

    if (!host || !device) {	// Error reporting
      await sendData({ host, hexData: hex, log, name, logLevel });
      throw new function () {
	return {
	  attempt : 0,
	  fail: -1,
	  timeout: false
	};
      };
    }

    let data = hex;
    if (Array.isArray(hex)) {
      data = [];
      hex.forEach(x => {
	const p = {};
	Object.keys(x).forEach(y => {
	  if (y === 'eval') {
	    try {
	      this.logs.trace(`found context HEX: "${x[y]}"`);
	      const z = `{\nconst {\n\t${Object.keys(this.state).map(x => `${x} = ${this.state[x]}`).join(',\n\t')}\n} = this.state0;\n${x[y]};\n}`;
	      this.logs.trace(`expands context HEX:\n${z}`);
	      p['data'] = `${eval(z)}`;
	      this.logs.trace(`resolved context HEX: ${p['data']}`);
	    } catch (e) {
	      this.logs.error(`failed to evaluate context HEX. ${e}`);
	      throw new function () {
		return {
		  attempt : 0,
		  fail: -1,
		  timeout: false
		};
	      };
	    }
	  } else {
	    p[y] = x[y];
	  }
	});
	data.push(p);
      })
    }

    return await device.mutex.use(async () => {	// Queue command sequence
      const maxduration = data[0].timeout ?? 60;// 'xyz'[0] will be undefined.
      let timeout = setTimeout(() => {
	timeout = null;
	this.logs.error(`Failed to execute command sequence. Timed out of ${maxduration} second(s).`);
      }, maxduration*1000);
      
      if (typeof data === 'string') {
	r += await sendData({ host, hexData: data, log, name, logLevel });
	x++;
      } else {
	// Itterate through each hex config in the array
	for (let i = 0; timeout && i < data.length; i++) {
          const { pause } = data[i];
	  const { data: hex, interval = 0.1, sendCount = 1} = data[i];
	  
          // await this.performRepeatSend(data[index], actionCallback);
	  for (let j = 0; timeout && hex && j < sendCount; j++) {
	    r += await sendData({ host, hexData: hex, log, name, logLevel });
	    x++;
	    
	    if (timeout && j < sendCount - 1) {
	      await new Promise(resolve => setTimeout(resolve, interval * 1000));
	      this.logs.debug(`repeating #${j+1} with intervals of ${interval * 1000} ms.`);
	    }
	  }
	  
          if (timeout && pause) {
	    await new Promise(resolve => setTimeout(resolve, pause * 1000));
	    this.logs.debug(`pausing ${pause * 1000} ms.`);
          }
	}
      }
      clearTimeout(timeout);

      if (r < 0 || !timeout) {
	this.logs.error(`failed to blast IR/RF commands ${Math.abs(r)} times out of ${x}.`);
	throw new function () {
	  return {
	    attempt : x,
	    fail: r,
	    timeout: !timeout
	  };
	};
      }
    });
  }
}

module.exports = BroadlinkRMAccessory;
