const ping = require('ping');
const broadlink = new (require('broadlinkjs-rm'));
const delayForDuration = require('./delayForDuration');
const Mutex = require('await-semaphore').Mutex;

const pingFrequency = 20000;
const keepAliveFrequency = 90000;
const pingTimeout = 5;
let platform = undefined;

const startKeepAlive = (device) => {
  // if (!platform.config.accessories?.find((x) => x.host === undefined || x.host === device.host.address || x.host === device.host.macAddress))
  //   return;
  
  if(!device.host.port) {return;}
  device.ping && setInterval(async () => {
    broadlink.logs.trace('sending keepalive to', device.host.address,':',device.host.port);
    device.ping();
  }, keepAliveFrequency);
}

const startPing = (device) => {
  // if (!platform.config.accessories?.find((x) => x.host === undefined || x.host === device.host.address || x.host === device.host.macAddress))
  //   return;
    
  device.state = 'unknown';
  device.retryCount = 1;

  // setInterval(async () => {await device.mutex?.use(async () => {
  device.pauseWhile && setInterval(async () => {device.pauseWhile(async () => {
    try {
      ping.sys.probe(device.host.address, (active, err) => {
        broadlink.logs.trace(`pinging Broadlink RM device at ${device.host.address} (${device.host.macAddress || ''})`);
        if(err){
          // broadlink.logs.error(`error pinging Broadlink RM device at ${device.host.address}. ${err}`);
          throw err;
        }
        
        if (!active && device.state === 'active' && device.retryCount === 2) {
	  broadlink.logs.warn(`Broadlink RM device at ${device.host.address} (${device.host.macAddress || ''}) is no longer reachable after three attempts.`);

          device.state = 'inactive';
          device.retryCount = 0;
	  platform?.accessories.forEach((x) => {
	    if (x.host === device.host.address || x.host === device.host.macAddress) {
	      x.serviceManager.updateCharacteristic(platform.api.hap.Characteristic.StatusActive, false);
              x.logs.warn(`is inactive due to offline the device.`);
	    }
	  });
        } else if (!active && device.state === 'active') {
	  broadlink.logs.trace(`Broadlink RM device at ${device.host.address} is no longer reachable. (attempt ${device.retryCount})`);

          device.retryCount += 1;
        } else if (active && device.state !== 'active') {
          if (device.state === 'inactive') {
	    broadlink.logs.info(`Broadlink RM device at ${device.host.address} (${device.host.macAddress || ''}) has been re-discovered.`);
	    platform?.accessories.forEach((x) => {
	      if (x.host === device.host.address || x.host === device.host.macAddress) {
		x.serviceManager.updateCharacteristic(platform.api.hap.Characteristic.StatusActive, true);
		x.logs.info(`is back Online. Host device is re-descovered.`);
	      }
	    });
	  }

          device.state = 'active';
          device.retryCount = 0;
        } else if (active && device.retryCount !== 0 ) {
          //Acive - reset retry counter
          device.retryCount = 0;
        }
      }, {timeout: pingTimeout});
      // await new Promise(resolve => setTimeout(resolve, 1 * 1000));
    } catch (err) {
      broadlink.logs.error(`error pinging Broadlink RM device at ${device.host.address}. ${err}`);
    }
  })}, pingFrequency);
}

const discoveredDevices = {};
const manualDevices = {};
let discoverDevicesInterval;

const discoverDevices = (automatic = true, log, logLevel, deviceDiscoveryTimeout = 60, thisPlatform = null) => {
  broadlink.log = log;
  broadlink.debug = logLevel;
  platform = thisPlatform;
  //broadlink.logLevel = logLevel;

  if (automatic) {
    discoverDevicesInterval = setInterval(() => {
      broadlink.discover();
    }, 2000);

    delayForDuration(deviceDiscoveryTimeout).then(() => {
      clearInterval(discoverDevicesInterval);
    });

    // broadlink.discover({local_ip_address: ['0.0.0.0'], discover_ip_address: '192.168.0.255'});
    broadlink.discover();
  }

  broadlink.on('deviceReady', async (device) => {
    let macAddressParts, macAddress;
    if (device.mac.includes(":")) {
      macAddress = device.mac;
    }else{
      macAddressParts = device.mac.toString('hex').match(/[\s\S]{1,2}/g) || [];
      macAddress = macAddressParts.join(':');
    }
    device.host.macAddress = macAddress;

    const v = await device.getFWversion?.(logLevel);
    broadlink.logs.info(`Discovered ${device.model} (0x${device.type.toString(16)}${v ? ', v'+parseInt(v) : ''}) at ${device.host.address} (${device.host.macAddress})`);
    addDevice(device);

    const accessories = platform.accessories?.filter((x) => x.host === undefined || x.host === device.host.address || x.host === device.host.macAddress);
    if (accessories.length > 0) {
      startPing(device);
      startKeepAlive(device);
      accessories.forEach((x) => {
	x.serviceManager.updateCharacteristic(platform.api.hap.Characteristic.StatusActive, true)
	x.logs.debug(`is activated from finding the associated host device in config.`);
      });
    }
  })
}

const addDevice = (device) => {
  if (!device.isUnitTestDevice && (discoveredDevices[device.host.address] || discoveredDevices[device.host.macAddress])) {return;}

  device.mutex = new Mutex();

  discoveredDevices[device.host.address] = device;
  discoveredDevices[device.host.macAddress] = device;
}

const getDevice = ({ host, log, learnOnly }) => {
  let device;

  if (host) {
    device = discoveredDevices[host];

    // Create manual device
    if (!device && !manualDevices[host]) {
      const device = { host: { address: host } };
      manualDevices[host] = device;

      startPing(device);
      startKeepAlive(device);
    }
  } else { // use the first one of no host is provided
    const hosts = Object.keys(discoveredDevices);
    if (hosts.length === 0) {
      // broadlink.logs.error(`Send data (no devices found)`);

      return;
    }

    // Only return device that can Learn Code codes
    if (learnOnly) {
      for (let i = 0; i < hosts.length; i++) {
        const currentDevice = discoveredDevices[hosts[i]];

        if (currentDevice.enterLearning) {
          device = currentDevice

          break;
        }
      }

      if (!device) broadlink.logs.error(`Learn Code (no device found at ${host})`);
    } else {
      device = discoveredDevices[hosts[0]];

      if (!device) broadlink.logs.error(`Send data (no device found at ${host})`);
    }
  }

  return device;
}

module.exports = { broadlink, getDevice, discoverDevices, addDevice };
