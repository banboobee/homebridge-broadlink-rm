import ping from 'ping';

const pingIPAddress = (ipAddress, interval, callback) => {
  setInterval(() => {
    try {
      ping.sys.probe(ipAddress, (isActive) => {
        callback(isActive)
      })
    } catch {
      callback(false)
    }
  }, interval * 1000);
}

export default pingIPAddress;
