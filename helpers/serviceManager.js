const assert = require('assert')

class ServiceManager {

  constructor (name, serviceType, log, subType = undefined) {
    assert(name, 'ServiceManager requires a "name" to be provided.')
    assert(serviceType, 'ServiceManager requires the "type" to be provided.')
    assert(log, 'ServiceManager requires "log" to be provided.')
    
    this.log = log
    this.names = {};
    
    if (this.constructor.isUnitTest) {
      this.service = new serviceType(name);
    } else {
      const uuid = HomebridgeAPI.hap.uuid.generate(`${serviceType}:${name}`);
      this.accessory = cachedAccessories.find((cache) => cache.UUID === uuid) || new HomebridgeAPI.platformAccessory(name, uuid, subType);
      this.accessory.getService(Service.AccessoryInformation)
	.setCharacteristic(Characteristic.Manufacturer, 'Broadlink')
	.setCharacteristic(Characteristic.Model, 'RM Mini or Pro')
	.setCharacteristic(Characteristic.SerialNumber, uuid);
      this.service = this.accessory.getService(serviceType) || this.accessory.addService(serviceType);
    }
    this.characteristics = {}

    this.addNameCharacteristic(name);
  }

  setCharacteristic (characteristic, value) {    
    this.service.setCharacteristic(characteristic, value);
  }

  updateCharacteristic (characteristic, value) {
    // const name = this.getCharacteristic(Characteristic.Name).value;
    this.state[this.names[characteristic.UUID]] = value;
    this.state0[this.names[characteristic.UUID]] = value;
    this.getCharacteristic(characteristic).updateValue(value);
    // this.log(`\x1b[33m[DEBUG]\x1b[0m ${name} updateCharacteristic: ${this.names[characteristic.UUID]} ${value}`);

    return this;
  }

  getCharacteristic (characteristic) {
    return this.service.getCharacteristic(characteristic)
  }

  refreshCharacteristicUI (characteristic) {
    if (this.constructor.isUnitTest) {
      this.getCharacteristic(characteristic);
    } else {
      // this.getCharacteristic(characteristic).value;
      // const name = this.getCharacteristic(Characteristic.Name).value;
      const value = this.state[this.names[characteristic.UUID]];
      this.getCharacteristic(characteristic).updateValue(value);
      //this.log(`\x1b[33m[DEBUG]\x1b[0m ${name} refreshCharacteristicUI: ${this.names[characteristic.UUID]} ${value}`);
    }
  }

  // Convenience

  addCharacteristic ({ name, type, getSet, method, bind, props }) {
    this.characteristics[name] = type
    this.names[type.UUID] = name;
    
    if (props) {
      props.propertyName = name

      assert('A value for `bind` is required if you are setting `props`')
      this.getCharacteristic(type).on(getSet, method.bind(bind, props));
    } else {
      const boundMethod = bind ? method.bind(bind) : method
      this.getCharacteristic(type).on(getSet, boundMethod);
    }
  }

  addGetCharacteristic ({ name, type, method, bind, props }) {
    this.addCharacteristic({ name, type, getSet: 'get', method, bind, props })
  }

  addSetCharacteristic ({ name, type, method, bind, props }) {
    this.addCharacteristic({ name, type, getSet: 'set', method, bind, props })
  }

  addToggleCharacteristic ({ name, type, getMethod, setMethod, bind, props }) {
    this.addGetCharacteristic({ name, type, method: getMethod, bind, props }) 
    this.addSetCharacteristic({ name, type, method: setMethod, bind, props }) 
  }

  getCharacteristicTypeForName (name) {
    return this.characteristics[name]
  }

  // Name Characteristic

  addNameCharacteristic (name) {
    // console.log(`addNameCharacteristic: ${name}`);
    this.addCharacteristic({ name: 'name', type: Characteristic.Name, method: this.getName });
    this.setCharacteristic(Characteristic.Name, name);    
  }

  getName (callback = undefined) {
    // const { name } = this
    const name = this.getCharacteristic(Characteristic.Name).value;

    this.log(`${name} getName: ${name}`);

    callback?.(null, name);

    return name;
  }
}

module.exports = ServiceManager
