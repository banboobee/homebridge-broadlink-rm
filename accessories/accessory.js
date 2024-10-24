const uuid = require('uuid');

const { HomebridgeAccessory } = require('../base');

const sendData = require('../helpers/sendData');
// const delayForDuration = require('../helpers/delayForDuration');
// const catchDelayCancelError = require('../helpers/catchDelayCancelError');
const { getDevice } = require('../helpers/getDevice');

class BroadlinkRMAccessory extends HomebridgeAccessory {

  constructor(log, config = {}, platform) {
    if (!config.name) {config.name = "Unknown Accessory"}

    config.resendDataAfterReload = config.resendHexAfterReload;
    if (config.host) {
      //Clean up MAC address formatting
      config.host = config.host.toLowerCase();
      if (!config.host.includes(".") && !config.host.includes(":") && config.host.length === 12){
        config.host = config.host.match(/[\s\S]{1,2}/g).join(':');
      }
    }

    super(log, config, platform);
    if (config.debug) {this.debug = true}

    // this.manufacturer = 'Broadlink';
    // this.model = 'RM Mini or Pro';
    // this.serialNumber = uuid.v4();

    // //Set LogLevel
    // switch(this.config.logLevel){
    //   case 'none':
    //     this.logLevel = 6;
    //     break;
    //   case 'critical':
    //     this.logLevel = 5;
    //     break;
    //   case 'error':
    //     this.logLevel = 4;
    //     break;
    //   case 'warning':
    //     this.logLevel = 3;
    //     break;
    //   case 'info':
    //     this.logLevel = 2;
    //     break;
    //   case 'debug':
    //     this.logLevel = 1;
    //     break;
    //   case 'trace':
    //     this.logLevel = 0;
    //     break;
    //   default:
    //     //default to 'info':
    //     if(this.config.logLevel !== undefined) {log(`\x1b[31m[CONFIG ERROR] \x1b[33mlogLevel\x1b[0m should be one of: trace, debug, info, warning, error, critical, or none.`);}
    //     this.logLevel = 2;
    //     break;
    // }
    // if(this.config.debug) {this.logLevel = Math.min(1, this.logLevel);}
    // // if(this.config.disableLogs) {this.logLevel = 6;}  
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

  async performSend (data, actionCallback) {
    const { logLevel, config, host, log, name } = this;
    let r = 0, x = 0;

    //Error catch
    if(data === undefined){return}

    // Get the Broadlink device
    const device = getDevice({ host, log });

    if (!host || !device) {	// Error reporting
      await sendData({ host, hexData: data, log, name, logLevel });
      return {
	attempt : 0,
	fail: -1,
	timeout: false
      };
    }

    return await device.mutex.use(async () => {	// Queue command sequence
      let timeout = setTimeout(() => {
	timeout = null;
	this.logs.error(`${name} Failed to execute command sequence. Timed out of 60 second(s).`);
      }, 60*1000);
      
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
	    
	    if (j < sendCount) {
	      await new Promise(resolve => setTimeout(resolve, interval * 1000));
	      this.logs.debug(`repeating #${j+1} with intervals of ${interval * 1000} ms.`);
	    }
	  }
	  
          if (pause) {
	    await new Promise(resolve => setTimeout(resolve, pause * 1000));
	    this.logs.debug(`pausing ${pause * 1000} ms.`);
          }
	}
      }
      clearTimeout(timeout);

      return {
	attempt : x,
	fail: r,
	timeout: !timeout
      };
    });
  }
  
//   async performRepeatSend (parentData, actionCallback) {
//     const { host, log, name, logLevel } = this;
//     let { data, interval, sendCount } = parentData;

//     sendCount = sendCount || 1
//     if (sendCount > 1) {interval = interval || 0.1;}

//     // Itterate through each hex config in the array
//     for (let index = 0; data && index < sendCount; index++) {
//       await sendData({ host, hexData: data, log, name, logLevel });

//       if (interval && index < sendCount) {
// 	await new Promise(resolve => setTimeout(resolve, interval * 1000));
// 	if (logLevel < 2) log(`${name} interval (${host}) ${interval * 1000} ms`);
//       }
//     }
//   }
}

module.exports = BroadlinkRMAccessory;
