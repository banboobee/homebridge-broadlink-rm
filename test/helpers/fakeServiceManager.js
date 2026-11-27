import { vi } from 'vitest';
import FakeServiceManager from '../../helpers/serviceManager.js';

vi.mock('../../helpers/serviceManager.js', async (importOriginal) => {
  const original = await importOriginal();
  const ServiceManager = original.default

  class FakseServiceManager  {
    constructor(platform, name, serviceType) {
      this.log = platform.log
      this.names = {};
      this.characteristics = {}
      this.service = new FakeService(name, platform.log);
    }

    // clearRecordedSetCharacteristic = () => {
    //   this.setCharacteristic.mockClear();
    // }

    hasRecordedSetCharacteristic = () => {
      return !!this.setCharacteristic.mock.calls.length;
    }

    setCharacteristic = vi.fn(async (characteristic, value) => {
      await super.setCharacteristic(characteristic, value);
    })

    refreshCharacteristicUI = (characteristic) => {
      this.getCharacteristic(characteristic);
    }
  }

  Object.setPrototypeOf(
    FakseServiceManager.prototype,
    ServiceManager.prototype
  );

  return {
    default: FakseServiceManager,
  }
})

// class FakeServiceManager extends ServiceManager {
//   static isUnitTest = true;
//   constructor (platform, name, serviceType) {
//     super(platform, name, serviceType)

//     this.service = new FakeService(name, platform.log);
//     this.hasRecordedSetCharacteristic = false
//   }

//   clearRecordedSetCharacteristic () {
//     this.hasRecordedSetCharacteristic = false
//   }

//   setCharacteristic = async (characteristic, value) => {
//     this.hasRecordedSetCharacteristic = true

//     await super.setCharacteristic(characteristic, value);
//   }
// }

class FakeService {

  constructor (name, log) {
    this.log = log
    this.name = name
    this.characteristics = {}
  }

  setCharacteristic = async (type, value) => {
    const characteristic = this.characteristics[type]

    if (characteristic) {
      await characteristic.set(value);
    }
  }

  getCharacteristic (type) {
    let characteristic = this.characteristics[type]

    if (!characteristic) {
      characteristic = new FakeCharacteristic(type, this.name, this.log)
      this.characteristics[type] = characteristic
    }

    return characteristic
  }

  addOptionalCharacteristic() {
  }
}

class FakeCharacteristic {

  constructor (type, serviceName, log) {
    this.log = log
    this.type = type
    this.serviceName = serviceName
  }

  get = async () => {
    return await this.getMethod(() => {
      // this.log('Fake Get Callback Received')
      this.log(`FakeServiceManager: get${this.type.name} received callback.`);
    })
  }

  set = async (value) => {
    // this.log('Set Fake Value Received', value, this.type.name)
    this.log(`FakeServiceManager: set${this.type.name} ${value}`);

    return await this.setMethod(value, (err, value) => {
      if (err) {
        return this.log(`FakeServiceManager: set${this.type.name} received failed callback ${err}.`)
      }

      // this.log('Fake Set Callback Received: ', value)
      this.log(`FakeServiceManager: set${this.type.name} received succeed callback ${value}.`);
    })
  }

  on (getSet, method) {
    if (getSet === 'get') {
      this.getMethod = (callback) => {
        method(callback);
      }
    }
    if (getSet === 'set') {
      this.setMethod = (value, callback) => {
        method(value, callback);
      }
    }
  }

  onSet (method) {
    this.setMethod = async (value) => {return new Promise((resolve, reject) => {
      method(value).then(() => {
        resolve(true);
      }).catch((e) => {
        reject(e);
      });
    })};
  }

  onGet (method) {
    this.getMethod = async () => {return new Promise((resolve, reject) => {
      method().then(() => {
        resolve(true);
      }).catch((e) => {
        reject(e);
      });
    })};
  }

  updateValue (value) {
    this.value = value;
  }

  value;

  setProps () {
    return {on: () => {}};
  }
}

export default FakeServiceManager;
