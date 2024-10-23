const assert = require('assert')
const ServiceManager = require('../../helpers/serviceManager')

class FakeServiceManager extends ServiceManager {
  static isUnitTest = true;
  constructor (name, serviceType, log) {
    super(name, serviceType, log)

    this.service = new FakeService(name, log);
    this.hasRecordedSetCharacteristic = false
  }

  clearRecordedSetCharacteristic () {
    this.hasRecordedSetCharacteristic = false
  }

  setCharacteristic (characteristic, value) {    
    this.hasRecordedSetCharacteristic = true
    
    super.setCharacteristic(characteristic, value)
  }
}

class FakeService {

  constructor (name, log) {
    this.log = log
    this.name = name
    this.characteristics = {}
  }

  setCharacteristic (type, value) {
    let characteristic = this.characteristics[type]

    if (characteristic) {characteristic.set(value);}
  }

  getCharacteristic (type) {
    let characteristic = this.characteristics[type]

    if (!characteristic) {
      characteristic = new FakeCharacteristic(type, this.name, this.log)
      this.characteristics[type] = characteristic
    }

    return characteristic
  }
}

class FakeCharacteristic {

  constructor (type, serviceName, log) {
    this.log = log
    this.type = type
    this.serviceName = serviceName
  }

  get () {
    return this.getMethod(() => {
      // this.log('Fake Get Callback Received')
      this.log(`FakeServiceManager: get${this.type.name} received callback.`);
    })
  }

  set (value) {
    // this.log('Set Fake Value Received', value, this.type.name)
    this.log(`FakeServiceManager: set${this.type.name} ${value}`);

    return this.setMethod(value, (err, value) => {
      if (err) {return this.log(err.message)}

      // this.log('Fake Set Callback Received: ', value)
      this.log(`FakeServiceManager: set${this.type.name} received callback ${value}.`);
    })
  }

  on (getSet, method) {
    if (getSet === 'get') {this.getMethod = method}
    if (getSet === 'set') {this.setMethod = method}
  }

  // getValue () {
  //   return new Promise((resolve, reject) => {
  //     this.getMethod((error, value) => {
  //       if (error) {return reject(error)}

  //       resolve(value)
  //     })
  //   })
  // }

  updateValue () {
    return new Promise((resolve, reject) => {
      this.getMethod((error, value) => {
        if (error) {return reject(error)}

	this.value = value;
	resolve(value)
      })
    })
  }

  value;
  
  setProps () {
    return {on: () => {}};
  }
}

module.exports = FakeServiceManager
