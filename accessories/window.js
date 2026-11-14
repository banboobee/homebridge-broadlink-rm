import WindowCoveringAccessory from './windowCovering.js';

class WindowAccessory extends WindowCoveringAccessory {
  serviceType () { return this.Service.Window }
}
export default WindowAccessory;
