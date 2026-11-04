const WindowCoveringAccessory = require('./windowCovering');

class WindowAccessory extends WindowCoveringAccessory {
  serviceType () { return this.Service.Window }
}
module.exports = WindowAccessory;
