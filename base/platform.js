const persistentState = require('./helpers/persistentState')
// const semver = require('semver');

// if (semver.lt(process.version, '7.6.0')) {throw new Error(`Homebridge plugins that use the "homebridge-platform-helper" library require your node version to be at least the v12.14.0 LTM. Current version: ${process.version}`)}

class HomebridgePlatform {

  constructor (log, config = {}, homebridge) {
    HomebridgePlatform.isUnitTest = this.constructor.isUnitTest;
    // if (this.constructor.isUnitTest === true) {
    //   this.isUnitTest = true;
    // } else {
    //   this.isUnitTest = false;
    // }
    this.log = log;
    this.config = config;
    // this.homebridge = homebridge;
    this.api = homebridge;
    this.cachedAccessories = cachedAccessories;
    this.eve = eve;
    this.HistoryService = HistoryService;
    HomebridgePlatform.log = this.log;
    
    const { homebridgeDirectory } = config;

    persistentState.init({ homebridge, homebridgeDirectory });

    //Set LogLevel
    switch(this.config.logLevel){
      // case 'none':
      //   this.logLevel = 6;
      //   break;
      // case 'critical':
      //   this.logLevel = 5;
      //   break;
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
        // if(this.config.logLevel !== undefined) {log(`\x1b[31m[CONFIG ERROR] \x1b[33mlogLevel\x1b[0m should be one of: trace, debug, info, warning, error, critical, or none.`);}
        this.logLevel = 2;
        break;
    }
    if(this.config.debug) {this.logLevel = Math.min(1, this.logLevel);}
    // if(this.config.disableLogs) {this.logLevel = 6;}
    HomebridgePlatform.logLevel = this.logLevel;

    this.checkConfig(config);

    homebridge.on('didFinishLaunching', async () => {
      // this.log('Executed didFinishLaunching callback');
      this.discoverDevices();
    })
  }

  checkConfig(config) {
  }

  async addAccessories (accessories) {
    throw new Error('The addAccessories method must be overridden.')
  }

  async configureAccessory(cache) {
    // this.log(`Loading accessory from cache: ${cache.displayName} context: ${JSON.stringify(cache.context)}`);
    this.log(`Restoring existing accessory ${cache.displayName} from cache.`);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    cachedAccessories.push(cache);
  }

  async discoverDevices () {
  // async accessories (callback) {
    const { config, log } = this;
    const { name, disableLogs } = config;

    const accessories = [];

    await this.addAccessories(accessories);

    // Disable logs if requested
    if (disableLogs !== undefined) {
      accessories.forEach((accessory) => {
        if (accessory.config.disableLogs === undefined) {
          accessory.disableLogs = disableLogs
        }
      })
    }

    // Check for no accessories
    if (!config.accessories || config.accessories.length === 0) {
      // if (!disableLogs) {log(`No accessories have been added to the "${name}" platform config.`);}
      log(`No accessories have been added to the "${name}" platform config.`);
      // return callback(accessories);
    }

    // Let accessories know about one-another if they wish
    accessories.forEach((accessory) => {
      if (accessory.updateAccessories) {accessory.updateAccessories(accessories);}
    })

    // Register new accessories
    // this.api.registerPlatformAccessories('homebridge-broadlink-rm', 'BroadlinkRM',
    // 					      accessories
    // 					      .filter(x => !cachedAccessories.find(y => y === x.serviceManager.accessory))
    // 					      .filter(x => x.config.type !== 'tv')
    // 					      .map(x => x.serviceManager.accessory));
    // Register external accessories
    // this.api.publishExternalAccessories('homebridge-broadlink-rm', 
    // 					     accessories
    // 					     .filter(x => x.config.type === 'tv')
    // 					     .map(x => x.serviceManager.accessory));
    accessories.forEach(x => {
      if (x.config.type === 'tv') {
	// Register external accessories
	this.api.publishExternalAccessories('homebridge-broadlink-rm', [x.serviceManager.accessory]);
	this.log(`Registered ${x.config.type} accessory ${x.config.name} with type ${x.config.subType}.`);
      } else if (!cachedAccessories.find(y => y === x.serviceManager.accessory)) {
	// Register new accessories
	this.api.registerPlatformAccessories('homebridge-broadlink-rm', 'BroadlinkRM', [x.serviceManager.accessory]);
	this.log(`Registered ${x.config.type} accessory ${x.config.name}.`)
      }
    });
    
    // Unregister deleted accessories
    cachedAccessories.forEach(x => {
      if (!accessories.find(y => y.serviceManager.accessory.UUID === x.UUID)) {
	this.api.unregisterPlatformAccessories('homebridge-broadlink-rm', 'BroadlinkRM', [x]);
	this.log(`Removed existing accessory ${x.displayName} from cache.`);
      }
    });

    // callback(accessories);
    this.accessories = accessories;
  }
}

module.exports = HomebridgePlatform;
