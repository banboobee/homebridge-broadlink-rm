const ping = require('ping');
const broadlink = new (require('../broadlinkjs-rm'));
const delayForDuration = require('./delayForDuration');
const Mutex = require('await-semaphore').Mutex;

const pingFrequency = 20000;
const keepAliveFrequency = 90000;
const pingTimeout = 5;
let platform = undefined;

// Default interval (minutes) for the scheduled re-discovery sweep.
// Broadcast discovery is the only reliable MAC -> IP mapping we have, so we
// re-run it periodically instead of only once at startup. That way a device
// that took a new DHCP lease, or that was offline when Homebridge booted, is
// picked up without a restart.
const defaultRediscoveryInterval = 60;

const macAddressPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

const normaliseMac = (mac) => {
  if (!mac) {return null;}
  if (Buffer.isBuffer(mac)) {
    return (mac.toString('hex').match(/[\s\S]{1,2}/g) || []).join(':').toLowerCase();
  }
  const value = mac.toString();
  if (value.includes(':')) {return value.toLowerCase();}
  return (value.match(/[\s\S]{1,2}/g) || []).join(':').toLowerCase();
}

// A configured host is either an address or a MAC, and a MAC may be written in
// any case. Normalise both sides before comparing.
const normaliseHost = (host) => {
  if (typeof host !== 'string') {return host;}
  return macAddressPattern.test(host) ? host.toLowerCase() : host;
}

const isDeviceHost = (host, device) => {
  const key = normaliseHost(host);
  return key === device.host.address || key === device.host.macAddress;
}

const isLinkLocal = (address) => typeof address === 'string' && address.startsWith('169.254.');

const startKeepAlive = (device) => {
  // if (!platform.config.accessories?.find((x) => x.host === undefined || x.host === device.host.address || x.host === device.host.macAddress))
  //   return;

  if(!device.host.port) {return;}
  if (device.keepAliveInterval) {return;}	// deviceReady fires again on re-auth
  if (device.ping) {
    device.keepAliveInterval = setInterval(async () => {
      broadlink.logs.trace('sending keepalive to', device.host.address,':',device.host.port);
      device.ping();
    }, keepAliveFrequency);
  }
}

const startPing = (device) => {
  // if (!platform.config.accessories?.find((x) => x.host === undefined || x.host === device.host.address || x.host === device.host.macAddress))
  //   return;

  if (device.pingInterval) {return;}	// deviceReady fires again on re-auth

  device.state = 'unknown';
  device.retryCount = 1;

  // setInterval(async () => {await device.mutex?.use(async () => {
  if (device.pauseWhile) {
    device.pingInterval = setInterval(async () => {device.pauseWhile(async () => {
      try {
        ping.sys.probe(device.host.address, (active, err) => {
          broadlink.logs.trace(`pinging Broadlink RM device ${device.name ?? ''} at ${device.host.address} (${device.host.macAddress || ''})`);
          if(err){
            // broadlink.logs.error(`error pinging Broadlink RM device ${device.name ?? ''} at ${device.host.address}. ${err}`);
            throw err;
          }

          if (!active && device.state === 'active' && device.retryCount === 2) {
            broadlink.logs.warn(`Broadlink RM device ${device.name ?? ''} at ${device.host.address} (${device.host.macAddress || ''}) is no longer reachable after three attempts.`);

            device.state = 'inactive';
            device.retryCount = 0;

            // A device that dropped off its address is exactly the case a
            // broadcast sweep can fix, so kick one off immediately rather than
            // waiting for the next scheduled sweep.
            runDiscoveryBurst(15);

            platform?.accessories.forEach((x) => {
              if (isDeviceHost(x.host, device)) {
                x.serviceManager.updateCharacteristic(platform.api.hap.Characteristic.StatusActive, false);
                x.logs.warn(`is inactive due to offline the device ${device.name ?? ''}.`);
              }
            });
          } else if (!active && device.state === 'active') {
            broadlink.logs.trace(`Broadlink RM device ${device.name ?? ''} at ${device.host.address} is no longer reachable. (attempt ${device.retryCount})`);

            device.retryCount += 1;
          } else if (active && device.state !== 'active') {
            if (device.state === 'inactive') {
              broadlink.logs.info(`Broadlink RM device ${device.name ?? ''} at ${device.host.address} (${device.host.macAddress || ''}) has been re-discovered.`);
              platform?.accessories.forEach((x) => {
                if (isDeviceHost(x.host, device)) {
                  x.serviceManager.updateCharacteristic(platform.api.hap.Characteristic.StatusActive, true);
                  x.logs.info(`is back Online. Host device ${device.name ?? ''} is re-descovered.`);
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
        broadlink.logs.error(`error pinging Broadlink RM device ${device.name ?? ''} at ${device.host.address}. ${err}`);
      }
    })}, pingFrequency);
  }
}

const discoveredDevices = {};
const manualDevices = {};
let discoverDevicesInterval;
let discoveryBurstInterval = null;

// Fire a short burst of broadcast discovery packets. Broadlink devices only
// answer a broadcast, so a burst is how we learn the current IP of every device
// on the LAN, keyed by MAC.
const runDiscoveryBurst = (durationSeconds = 30) => {
  if (discoveryBurstInterval) {return;}	// a burst is already in flight

  discoveryBurstInterval = setInterval(() => {
    broadlink.discover();
  }, 2000);

  broadlink.discover();

  const stop = () => {
    clearInterval(discoveryBurstInterval);
    discoveryBurstInterval = null;
  }

  delayForDuration(durationSeconds).then(stop).catch(stop);
}

// Log one line per known device so an unhealthy device is visible in the log
// without having to reproduce a failed send.
const reportDeviceHealth = () => {
  const seen = {};

  Object.keys(discoveredDevices).forEach((key) => {
    const device = discoveredDevices[key];
    if (!device || typeof device !== 'object') {return;}

    const mac = device.host.macAddress || normaliseMac(device.mac) || key;
    if (seen[mac]) {return;}
    seen[mac] = true;

    const address = device.host.address;
    const reachable = device.state === undefined ? 'unknown' : device.state;
    const authenticated = device.authenticated === undefined ? 'unknown' : (device.authenticated ? 'yes' : 'no');

    if (isLinkLocal(address)) {
      broadlink.logs.error(`Broadlink device ${mac} is on a link-local address (${address}). It failed to get a DHCP lease, so it can only be reached by broadcast and will not respond to commands. Reserve an IP for this MAC on the router and power-cycle the device.`);
      return;
    }

    broadlink.logs.info(`Broadlink health: ${mac} at ${address} - reachable: ${reachable}, authenticated: ${authenticated}`);
  });

  Object.keys(manualDevices).forEach((key) => {
    broadlink.logs.warn(`Broadlink device ${key} has never been discovered on this network. Check that it is powered on and joined to the same VLAN/subnet as Homebridge.`);
  });
}

const discoverDevices = (automatic = true, log, logLevel, deviceDiscoveryTimeout = 60, thisPlatform = null, rediscoveryInterval = defaultRediscoveryInterval) => {
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

  broadlink.removeAllListeners('deviceReady');
  broadlink.on('deviceReady', async (device) => {
    device.host.macAddress = normaliseMac(device.mac);
    // deviceReady is only emitted once the handshake has succeeded.
    device.authenticated = true;

    const v = await device.getFWversion?.(logLevel);
    broadlink.logs.info(`Discovered ${device.model} (${device.name ? device.name+', ' : ''}0x${device.type.toString(16)}${v ? ', v'+parseInt(v) : ''}) at ${device.host.address} (${device.host.macAddress})`);
    addDevice(device);

    const accessories = platform.accessories?.filter((x) => x.host === undefined || isDeviceHost(x.host, device));
    if (accessories.length > 0) {
      startPing(device);
      startKeepAlive(device);
      accessories.forEach((x) => {
        x.serviceManager.updateCharacteristic(platform.api.hap.Characteristic.StatusActive, true)
        x.logs.debug(`is enabled. Associated host device ${device.name ?? ''} was found in config.`);
      });
    }
  })

  // A device that changed IP re-authenticates against its new address.
  // Re-index it so lookups by the old IP stop resolving to it.
  broadlink.removeAllListeners('deviceMoved');
  broadlink.on('deviceMoved', (device) => {
    const macAddress = normaliseMac(device.mac);
    device.host.macAddress = macAddress;

    // Only re-index a device that was already usable. One that has never
    // authenticated - a device sitting on a link-local address, for instance -
    // is registered by the deviceReady handler once its handshake succeeds.
    // Registering it here would hand accessories a device they cannot reach,
    // turning a fast "no device found" into a read that never responds.
    if (discoveredDevices[macAddress]) {addDevice(device);}
  })

  // Scheduled sweep. Runs in both automatic and manual-hosts mode - in manual
  // mode the configured addresses are only a starting hint, and the sweep is
  // what keeps them correct when DHCP hands out a different IP.
  if (rediscoveryInterval > 0) {
    // Always keep a broadcast sweep available, even when "hosts" is configured
    // and the initial automatic discovery was skipped.
    if (!automatic) {runDiscoveryBurst(deviceDiscoveryTimeout);}

    setInterval(() => {
      broadlink.logs.info(`Running scheduled Broadlink device discovery (every ${rediscoveryInterval} minutes).`);
      runDiscoveryBurst(30);

      delayForDuration(35).then(() => reportDeviceHealth()).catch(() => {});
    }, rediscoveryInterval * 60 * 1000);
  }
}

const addDevice = (device) => {
  // Index by MAC first and drop any stale IP key, so a device that moved to a
  // new address is reachable under its new IP and not its old one.
  const macAddress = device.host.macAddress || normaliseMac(device.mac);

  if (device.isUnitTestDevice) {
    device.mutex = device.mutex || new Mutex();
    discoveredDevices[device.host.address] = device;
    if (macAddress) {discoveredDevices[macAddress] = device;}
    return;
  }

  if (!device.mutex) {device.mutex = new Mutex();}

  // Remove any address key that used to point at this device but no longer
  // matches its current address.
  Object.keys(discoveredDevices).forEach((key) => {
    if (discoveredDevices[key] === device && key !== macAddress && key !== device.host.address) {
      delete discoveredDevices[key];
    }
  });

  discoveredDevices[device.host.address] = device;
  if (macAddress) {
    discoveredDevices[macAddress] = device;
    // A real device turned up for this MAC, so the placeholder is obsolete.
    delete manualDevices[macAddress];
  }
}

const getDevice = ({ host, log, learnOnly }) => {
  let device;

  if (host) {
    // Accessories reference devices by MAC, so normalise the lookup key before
    // going to the index.
    const key = normaliseHost(host);
    device = discoveredDevices[key];

    // Create manual device
    if (!device && !manualDevices[key]) {
      // A MAC is not routable - there is nothing to ping or keep alive, so just
      // record that we are still waiting for this device to be discovered.
      if (macAddressPattern.test(key)) {
        manualDevices[key] = { host: { macAddress: key } };
      } else {
        const device = { host: { address: key } };
        manualDevices[key] = device;

        startPing(device);
        startKeepAlive(device);
      }
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

module.exports = { broadlink, getDevice, discoverDevices, discoveredDevices, addDevice };
