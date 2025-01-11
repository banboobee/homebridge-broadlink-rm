const HomebridgePlatform = require('./base/platform');
const { assert } = require('chai');

const npmPackage = require('./package.json');
// const checkForUpdates = require('./helpers/checkForUpdates');
const { broadlink, discoverDevices } = require('./helpers/getDevice');

const BroadlinkRMPlatform = class extends HomebridgePlatform {
  classTypes = {
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
    'heater-cooler': require('./accessories/heater-cooler')
  }

  constructor (log, config = {}, homebridge) {
    super(log, config, homebridge);
  }

  addAccessories (accessories) {
    const { config, log } = this;

    // if (!this.isUnitTest) this.discoverBroadlinkDevices();
    this.showMessage();
    // setTimeout(() => checkForUpdates(log), 1800);

    if (!config.accessories) {config.accessories = []}

    // Add a Learn Code accessory if none exist in the config
    const learnIRAccessories = (config && config.accessories && Array.isArray(config.accessories)) ? config.accessories.filter((accessory) => (accessory.type === 'learn-ir' || accessory.type === 'learn-code')) : [];

    if (learnIRAccessories.length === 0) {

      if (!config.hideLearnButton) {
        const learnCodeAccessory = new this.classTypes['learn-ir'](log, { name: 'Learn', scanFrequency: false }, this);
        accessories.push(learnCodeAccessory);
      }

      if (!config.hideScanFrequencyButton) {
        const scanFrequencyAccessory = new this.classTypes['learn-code'](log, { name: 'Scan Frequency', scanFrequency: true }, this);
        accessories.push(scanFrequencyAccessory);
      }
    }

    // Iterate through the config accessories
    const tvs = [];
    config.accessories.forEach((accessory) => {
      if (!accessory.type) {throw new Error(`Each accessory must be configured with a "type". e.g. "switch"`);}
      if (accessory.disabled) {return;}
      if (!this.classTypes[accessory.type]) {throw new Error(`homebridge-broadlink-rm doesn't support accessories of type "${accessory.type}".`);}

      const homeKitAccessory = new this.classTypes[accessory.type](log, accessory, this);

      if (this.classTypes[accessory.type] === this.classTypes.tv) {
	// if(accessory.subType.toLowerCase() === 'stb'){homeKitAccessory.subType = homebridgeRef.hap.Accessory.Categories.TV_SET_TOP_BOX;}
	// if(accessory.subType.toLowerCase() === 'receiver'){homeKitAccessory.subType = homebridgeRef.hap.Accessory.Categories.AUDIO_RECEIVER;}
	// if(accessory.subType.toLowerCase() === 'stick'){homeKitAccessory.subType = homebridgeRef.hap.Accessory.Categories.TV_STREAMING_STICK;}

        // if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m Adding Accessory ${accessory.type} (${accessory.subType})`);}
        tvs.push(homeKitAccessory);
        // return;
      }

      log(`${accessory.type} accessory ${accessory.name}${accessory.subType ? " with type "+accessory.subType : ""} ready.`);
      accessories.push(homeKitAccessory);
    });

    if (tvs.length > 0) {
      // const TV = homebridgeRef.hap.Accessory.Categories.TELEVISION;
      // homebridgeRef.publishExternalAccessories('homebridge-broadlink-rm', tvs.map(tv => createAccessory(tv, tv.name, TV, homebridgeRef, tv.subType)));
      
      log('');
      log(`**************************************************************************************************************`);
      log(`You added TVs in your configuration!`);
      log(`Due to a HomeKit limitation you need to add any TVs to the Home app by using the Add Accessory function.`);
      log(`There you'll find your TVs and you can use the same PIN as you using for this HomeBridge instance.`);
      log(`**************************************************************************************************************`);
      log('');
    }
    if (!this.isUnitTest) this.discoverBroadlinkDevices();
  }

  discoverBroadlinkDevices () {
    const { config, log, logLevel } = this;
    const { hosts } = config;

    if (!hosts) {
      if (logLevel <=2) {log(`\x1b[35m[INFO]\x1b[0m Automatically discovering Broadlink RM devices.`)}
	discoverDevices(true, log, logLevel, config.deviceDiscoveryTimeout, this);

      return;
    }

    discoverDevices(false, log, logLevel);

    if (logLevel <=2) {log(`\x1b[35m[INFO]\x1b[0m Automatic Broadlink RM device discovery has been disabled as the "hosts" option has been set.`)}

    assert.isArray(hosts, `\x1b[31m[CONFIG ERROR] \x1b[33mhosts\x1b[0m should be an array of objects.`)

    hosts.forEach((host) => {
      assert.isObject(host, `\x1b[31m[CONFIG ERROR] \x1b[0m Each item in the \x1b[33mhosts\x1b[0m array should be an object.`)

      const { address, isRFSupported, isRM4, mac } = host;
      assert(address, `\x1b[31m[CONFIG ERROR] \x1b[0m Each object in the \x1b[33mhosts\x1b[0m option should contain a value for \x1b[33maddress\x1b[0m (e.g. "192.168.1.23").`)
      assert(mac, `\x1b[31m[CONFIG ERROR] \x1b[0m Each object in the \x1b[33mhosts\x1b[0m option should contain a unique value for \x1b[33mmac\x1b[0m (e.g. "34:ea:34:e7:d7:28").`)

      //Create manual device type
      let deviceType = 0x2221;
      deviceType = isRFSupported ? (deviceType | 0x2) : deviceType;
      deviceType = isRM4 ? (deviceType | 0x4) : deviceType;
      
      broadlink.addDevice({ address, port: 80 }, mac.toLowerCase(), deviceType);
    })
  }

  showMessage () {
    const { config, log } = this;

    if (config && (config.hideWelcomeMessage || this.isUnitTest || this.logLevel >=4)) {
      log(`\x1b[35m[INFO]\x1b[0m Running Homebridge Broadlink RM Plugin version \x1b[32m${npmPackage.version}\x1b[0m`)

      return
    }

    setTimeout(() => {
      log('')
      log(`**************************************************************************************************************`)
      log(`** Welcome to version \x1b[32m${npmPackage.version}\x1b[0m of the \x1b[34mHomebridge Broadlink RM Plugin\x1b[0m!`)
      log('** ')
      log(`** Find out what's in the latest release here: \x1b[4mhttps://github.com/kiwi-cam/homebridge-broadlink-rm/blob/master/CHANGELOG.md\x1b[0m`)
      log(`** `)
      log(`** If you like this plugin then please star it on GitHub or better yet`)
      log(`** buy me a drink using Paypal \x1b[4mhttps://paypal.me/kiwicamRM\x1b[0m.`)
      log(`**`)
      log(`** You can disable this message by adding "hideWelcomeMessage": true to the config (see config-sample.json).`)
      log(`**`)
      log(`**************************************************************************************************************`)
      log('')
    }, 1500)
  }
}

module.exports = BroadlinkRMPlatform
