const ping = require('ping');
const delayForDuration = require('../../helpers/delayForDuration')

const pingIPAddress = async function (ipAddress, interval, callback) {
  performPing(this.isActive, callback)
  
  for (let i = 0; i < 2; i++) {
    performPing(this.isActive, callback)
    await delayForDuration(1.0);
  }
}

// const pingIPAddress = function (ipAddress, interval, callback) {
//   performPing(this.isActive, callback)
  
//   return setInterval(() => {
//     performPing(this.isActive, callback)
//   }, interval * 1000);
// }

const performPing = (isActive, callback) => {
  // Fake Latency
  setTimeout(() => {
    callback(isActive)
  }, 200)
}

module.exports = pingIPAddress;
  
