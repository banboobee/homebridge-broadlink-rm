const HomebridgePlatform = require('./base/platform');
// const { assert } = require('chai');

const npmPackage = require('./package.json');
// const checkForUpdates = require('./helpers/checkForUpdates');
const { broadlink, discoverDevices } = require('./helpers/getDevice');

class BroadlinkRMPlatform extends HomebridgePlatform {
  static configKeys = {
    // string
    platform: [
      (key, values) => {return typeof values[0] === 'string'},
      '`value ${JSON.stringify(values[0])} is not a string`'],
    name: [
      (key, values) => {return typeof values[0] === 'string'},
      '`value ${JSON.stringify(values[0])} is not a string`'],
    homebridgeDirectory: [
      (key, values) => {return typeof values[0] === 'string'},
      '`value ${JSON.stringify(values[0])} is not a string`'],

    // boolean
    hideScanFrequencyButton: [
      (key, values) => {return typeof values[0] === 'boolean'},
      '`value ${JSON.stringify(values[0])} is not a boolean`'],
    hideLearnButton: [
      (key, values) => {return typeof values[0] === 'boolean'},
      '`value ${JSON.stringify(values[0])} is not a boolean`'],
    hideDiscoverButton:  [
      (key, values) => {return typeof values[0] === 'boolean'},
      '`value ${JSON.stringify(values[0])} is not a boolean`'],
    hideWelcomeMessage:  [
      (key, values) => {return typeof values[0] === 'boolean'},
      '`value ${JSON.stringify(values[0])} is not a boolean`'],
    disableLogs: [
      (key, values) => {
        this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m \x1b[33mUnsupported\x1b[0m property '${key}'.`);
        return true;
      },
      '`value ${JSON.stringify(values[0])} is not a boolean`'],
    debug: [
      (key, values) => {return typeof values[0] === 'boolean'},
      '`value ${JSON.stringify(values[0])} is not a boolean`'],
    isUnitTest: [
      (key, values) => {
        this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m \x1b[33mUnsupported\x1b[0m property '${key}'.`);
        return true;
      },
      '`value ${JSON.stringify(values[0])} is not a boolean`'],

    // number
    deviceDiscoveryTimeout:  [
      (key, values) => {return typeof values[0] !== 'string' && !Number.isNaN(Number(values[0]))},
      '`value ${JSON.stringify(values[0])} is not a number`'],

    // selection
    logLevel: [
      (key, values, choices) => {return choices.find(x => x === values[0])},
      '`${JSON.stringify(values[0])} should be one of: ${choices.map(x => `"${x}"`).join()}`',
      ['verbose', 'trace', 'debug', 'info', 'warning', 'error']
    ],

    // complex
    hosts: [
      (key, values) => {
        return Array.isArray(values[0]) && (values[0].forEach((element, i) => {
          const property = `${key}[${i}]`
          if (!Array.isArray(element) && typeof element === 'object') {
            values.unshift(element);
            let address = false, mac = false;
            this.verifyConfig(values, property, {
              address: [
                (key, values) => {address = true; return typeof values[0] === 'string';},
                '`value ${JSON.stringify(values[0])} is not a string`'],
              mac: [
                (key, values) => {mac = true; return typeof values[0] === 'string';},
                '`value ${JSON.stringify(values[0])} is not a string`'],
              isRFSupported: [
                (key, values) => {return typeof values[0] === 'boolean'},
                '`value ${JSON.stringify(values[0])} is not a boolean`'],
              isRM4: [
                (key, values) => {return typeof values[0] === 'boolean'},
                '`value ${JSON.stringify(values[0])} is not a string`'],
            });
            if (!address) {
              this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '${property}' property. hosts option should contain a unique value for address (e.g. "192.168.1.23").`);
            }
            if (!mac) {
              this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '${property}' property. hosts option should contain a unique value for mac (e.g. "34:ea:34:e7:d7:28").`);
            }
            values.shift();
          } else {
            this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '${property}' property. Each item in the hosts array should be an object.`);
          }
        }), true);
      },
      '`hosts should be an array of objects`'],
    accessories: [
      (key, values, choices) => {
        if (Array.isArray(values[0])) {
          // const unknownTypes = values[0].reduce((x, y) => {
          //   if (!y.type || !Object.keys(this.classTypes).find(z => z === y.type)) {
          //     x.push(`"${y.type ?? ''}"`);
          //   }
          //   return x;
          // }, []);
          // if (unknownTypes.length > 0) {
          //   this.deprecatedTypes.forEach(x => {
          //     if (unknownTypes.find(y => `"${x}"` === y)) {
          //    this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m \x1b[33mObsoleted\x1b[0m accessory type "${x}". Use "switch" type accessory with advanced HEX structure.`);
          //     }
          //   })
          //   this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '${key}' property. Each accessory must be configured with a type (e.g. "switch"). Missing or Unknown type(s) ${unknownTypes}.`);
          // }
          values[0].forEach((x, i) => {
            if (typeof x === 'object' && !Array.isArray(x)) {
              if (!x.type) {
                this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '.accessories[${i}]' property. Each accessory must be configured with a type (e.g. "switch").`);
              } else if (this.deprecatedTypes.find(y => y === x.type)) {
                this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '.accessories[${i}].type' property. \x1b[33mdeprecated\x1b[0m '${x.type} accessory has been removed.`);
              } else if (!Object.keys(this.classTypes).find(y => y === x.type)) {
                this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '.accessories[${i}].type' property. homebridge-broadlink-rm doesn't support accessories of type '${x.type}'.`);
              } else if (x.name && values[0].filter(y => y.name === x.name).length > 1) {
                this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '.accessories[${i}].name' property. Disabled due to duplicating name '${x.name ?? 'anonymous'}'.`);
                x.disabled = true;
              } else if (!x.name && values[0].filter(y => y.name === x.name && y.type === x.type).length > 1) {
                this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '.accessories[${i}].name' property. Disabled due to multiple anonymous '${x.type}' accessories.`);
                x.disabled = true;
              }
            } else {
              this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '.accessories[${i}]' property. value ${JSON.stringify(x)} is not a valid accessories.`);
            }
          });
          return true;
        } else {
          return false;
        }
      },
      '`value ${JSON.stringify(values[0])} is not a valid accessories`']
  }

  static verifyConfig(values, property, options) {
    const property0 = property;
    Object.keys(values[0]).forEach((key) => {
      const match = Object.keys(options).find(y => key.match(y));
      const value = values[0][key];
      values.unshift(value);
      const property = `${property0}.${key}`;
      // console.log(key, match, value);
      if (match) {
        const checker = options[match][0];
        const message = options[match][1];
        const choices = options[match][2];
        if (!checker(property, values, choices)) {
          this.log(`\x1b[31m[CONFIG ERROR]\x1b[0m Failed to verify '${property}' property. ${eval(message)}.`);
        }
      } else {
        if (this.logLevel < 2) {
          this.log(`\x1b[90m[CONFIG DEBUG] Unknown property '${property}'.\x1b[0m`);
        }
      }
      values.shift();
    })

    return true;
  }

  static deprecatedTypes = [
    'switch-multi',
    'switch-multi-repeat',
    'switch-repeat'
  ];
  static classTypes = {
    'air-conditioner': require('./accessories/aircon'),
    'air-purifier': require('./accessories/air-purifier'),
    'humidifier-dehumidifier': require('./accessories/humidifier-dehumidifier'),
    'learn-ir': require('./accessories/learnCode'),
    'learn-code': require('./accessories/learnCode'),
    'switch': require('./accessories/switch'),
    'garage-door-opener': require('./accessories/garageDoorOpener'),
    'lock': require('./accessories/lock'),
    'fan': require('./accessories/fan'),
    'fanv1': require('./accessories/fanv1'),
    'outlet': require('./accessories/outlet'),
    'light': require('./accessories/light'),
    'window': require('./accessories/window'),
    'window-covering': require('./accessories/windowCovering'),
    'tv': require('./accessories/tv'),
    'temperatureSensor': require('./accessories/temperatureSensor.js'),
    'humiditySensor': require('./accessories/humiditySensor.js'),
    'heater-cooler': require('./accessories/heater-cooler'),
    'discover-device': require('./accessories/discoverDevice')
  }
  classTypes = this.constructor.classTypes;

  constructor (log, config = {}, homebridge) {
    super(log, config, homebridge);
  }

  checkConfig(config) {
    BroadlinkRMPlatform.verifyConfig([config], '', this.constructor.configKeys);
  }

  addAccessories (accessories) {
    const { config, log } = this;

    // if (!this.isUnitTest) this.discoverBroadlinkDevices();
    this.showMessage();
    // setTimeout(() => checkForUpdates(log), 1800);

    config.accessories ??= [];

    // Add a Learn Code accessory if none exist in the config
    const learnIRAccessories = (config && config.accessories && Array.isArray(config.accessories)) ? config.accessories.filter((accessory) => (accessory.type === 'learn-ir' || accessory.type === 'learn-code')) : [];
    if (learnIRAccessories.length === 0) {
      if (!config.hideLearnButton) {
        const learnCodeAccessory = new this.classTypes['learn-ir'](log, { name: 'Learn', scanFrequency: false,  type: 'learn-ir' }, this);
        accessories.push(learnCodeAccessory);
      }

      if (!config.hideScanFrequencyButton) {
        const scanFrequencyAccessory = new this.classTypes['learn-code'](log, { name: 'Scan Frequency', scanFrequency: true,  type: 'learn-ir' }, this);
        accessories.push(scanFrequencyAccessory);
      }
    }

    // Add a Discover Device accessory if none exist in the config
    if (!config.accessories?.find(accessory => accessory.type === 'discover-device')) {
      if (config.hideDiscoverButton === false) {
        const discoverDeviceAccessory = new this.classTypes['discover-device'](log, { name: 'Discover RM', type: 'discover-device', timeout: config.deviceDiscoveryTimeout ?? 1 }, this);
        accessories.push(discoverDeviceAccessory);
      }
    }

    // Iterate through the config accessories
    // const tvs = [];
    config.accessories.forEach((accessory) => {
      // if (!accessory.type) {throw new Error(`Each accessory must be configured with a "type". e.g. "switch"`);}
      // if (accessory.disabled) return;
      // if (!this.classTypes[accessory.type]) {throw new Error(`homebridge-broadlink-rm doesn't support accessories of type "${accessory.type}".`);}
      if (!accessory.disabled && this.classTypes[accessory.type]) {

        const homeKitAccessory = new this.classTypes[accessory.type](log, accessory, this);

        // if (this.classTypes[accessory.type] === this.classTypes.tv) {
        //      // if(accessory.subType.toLowerCase() === 'stb'){homeKitAccessory.subType = homebridgeRef.hap.Accessory.Categories.TV_SET_TOP_BOX;}
        //      // if(accessory.subType.toLowerCase() === 'receiver'){homeKitAccessory.subType = homebridgeRef.hap.Accessory.Categories.AUDIO_RECEIVER;}
        //      // if(accessory.subType.toLowerCase() === 'stick'){homeKitAccessory.subType = homebridgeRef.hap.Accessory.Categories.TV_STREAMING_STICK;}

        //   // if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m Adding Accessory ${accessory.type} (${accessory.subType})`);}
        //   tvs.push(homeKitAccessory);
        //   // return;
        // }

        log(`${accessory.type} accessory ${accessory.name}${accessory.subType ? " with type "+accessory.subType : ""} ready.`);
        accessories.push(homeKitAccessory);
      }
    });

    // if (tvs.length > 0) {
    //   // const TV = homebridgeRef.hap.Accessory.Categories.TELEVISION;
    //   // homebridgeRef.publishExternalAccessories('homebridge-broadlink-rm', tvs.map(tv => createAccessory(tv, tv.name, TV, homebridgeRef, tv.subType)));

    //   log('');
    //   log(`**************************************************************************************************************`);
    //   log(`You added TVs in your configuration!`);
    //   log(`Due to a HomeKit limitation you need to add any TVs to the Home app by using the Add Accessory function.`);
    //   log(`There you'll find your TVs and you can use the same PIN as you using for this HomeBridge instance.`);
    //   log(`**************************************************************************************************************`);
    //   log('');
    // }
    if (!this.constructor.isUnitTest) this.discoverBroadlinkDevices();
  }

  discoverBroadlinkDevices () {
    const { config, log, logLevel } = this;
    const { hosts } = config;
    config.deviceDiscoveryTimeout ??= 60;

    if (!hosts) {
      log(`\x1b[32mAutomatically discovering Broadlink RM devices.\x1b[0m`);
      discoverDevices(true, log, logLevel, config.deviceDiscoveryTimeout, this);
      return;
    }

    log(`\x1b[33mAutomatic Broadlink RM device discovery has been disabled as the "hosts" option has been set.\x1b[0m`);
    discoverDevices(false, log, logLevel, undefined, this);

    // assert.isArray(hosts, `\x1b[31m[CONFIG ERROR] \x1b[33mhosts\x1b[0m should be an array of objects.`)

    // hosts.forEach((host) => {
    // assert.isArray(hosts, `\x1b[31m[CONFIG ERROR] \x1b[33mhosts\x1b[0m should be an array of objects.`)

    Array.isArray(hosts) && hosts.forEach((host) => {
      if (Array.isArray(host) || typeof host !== 'object') return;
      // assert.isObject(host, `\x1b[31m[CONFIG ERROR] \x1b[0m Each item in the \x1b[33mhosts\x1b[0m array should be an object.`)

      const { address, isRFSupported, isRM4, mac } = host;
      if (!address || !mac) return;
      // assert(address, `\x1b[31m[CONFIG ERROR] \x1b[0m Each object in the \x1b[33mhosts\x1b[0m option should contain a value for \x1b[33maddress\x1b[0m (e.g. "192.168.1.23").`)
      // assert(mac, `\x1b[31m[CONFIG ERROR] \x1b[0m Each object in the \x1b[33mhosts\x1b[0m option should contain a unique value for \x1b[33mmac\x1b[0m (e.g. "34:ea:34:e7:d7:28").`)

      //Create manual device type
      let deviceType = 0x2221;
      deviceType = isRFSupported ? (deviceType | 0x2) : deviceType;
      deviceType = isRM4 ? (deviceType | 0x4) : deviceType;

      broadlink.addDevice({ address, port: 80 }, mac.toLowerCase(), deviceType);
    })
  }

  showMessage () {
    const { config, log } = this;

    if (config?.hideWelcomeMessage || this.constructor.isUnitTest) {
      log(`\x1b[32mRunning Homebridge Broadlink RM Plugin version ${npmPackage.version}\x1b[0m`);
      return
    }

    setTimeout(() => {
      log('')
      log(`**************************************************************************************************************`)
      log(`** Welcome to version \x1b[32m${npmPackage.version}\x1b[0m of the \x1b[34mHomebridge Broadlink RM Plugin\x1b[0m!`)
      log('** ')
      log(`** Find out the details here: \x1b[4mhttps://github.com/banboobee/homebridge-broadlink-rm/blob/master/README.md\x1b[0m`)
      log(`** `)
      log(`**`)
      log(`** You can disable this message by adding "hideWelcomeMessage": true to the config (see config-sample.json).`)
      log(`**`)
      log(`**************************************************************************************************************`)
      log('')
    }, 1500)
  }
}

module.exports = BroadlinkRMPlatform
