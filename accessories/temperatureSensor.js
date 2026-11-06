const AirconAccessory = require('./aircon');

class TemperatureSensorAccessory extends AirconAccessory {

  constructor (log, config = {}, platform) {
    super(log, config, platform);

    this.temperatureCallbackQueue = {};
  }

  setDefaults () {
    const { config, state } = this;

    // Set config default values
    config.temperatureUpdateFrequency = config.temperatureUpdateFrequency || 10;
    config.units = config.units ? config.units.toLowerCase() : 'c';
    config.temperatureAdjustment = config.temperatureAdjustment || 0;
    config.humidityAdjustment = config.humidityAdjustment || 0;

    // ignore Humidity if set to not use it, or using Temperature source that doesn't support it
    if(config.noHumidity || config.w1Device || config.pseudoDeviceTemperature){
      state.currentHumidity = null;
      config.noHumidity = true;
    } else {
      config.noHumidity = false;
    }

    state.firstTemperatureUpdate = true;
  }

  reset () {
    super.reset();
  }

  getBatteryAlert (callback) {
    const { Characteristic } = this;
    const { name, state, log, logLevel } = this;

    const batteryAlert = state.batteryLevel <= 20? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} Battery Alert:`,batteryAlert);}

    callback(null, batteryAlert);
  }

  getBatteryLevel (callback) {
    const { name, state, log, logLevel } = this;
    if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m ${name} Battery Level:`,state.batteryLevel);}
    callback(null, parseFloat(state.batteryLevel));
  }

  // Service Manager Setup

  setupServiceManager () {
    const { platform, Service, Characteristic } = this;
    const { config, name } = this;

    this.serviceManager = new this.serviceManagerClass(platform, name, Service.TemperatureSensor);

    this.serviceManager.addGetCharacteristic({
      name: 'currentTemperature',
      type: Characteristic.CurrentTemperature,
      method: this.getCurrentTemperature,
      bind: this
    });

    if (!config.noHumidity){
      this.serviceManager.addGetCharacteristic({
        name: 'currentHumidity',
        type: Characteristic.CurrentRelativeHumidity,
        method: this.getCurrentHumidity,
        bind: this
      })
    }

    if (config.batteryAlerts){
      this.serviceManager.addGetCharacteristic({
        name: 'batteryAlert',
        type: Characteristic.StatusLowBattery,
        method: this.getBatteryAlert,
        bind: this
      })

      this.serviceManager.addGetCharacteristic({
        name: 'batteryLevel',
        type: Characteristic.BatteryLevel,
        method: this.getBatteryLevel,
        bind: this
      })
    }

    this.serviceManager.addGetCharacteristic({
      name: 'temperatureDisplayUnits',
      type: Characteristic.TemperatureDisplayUnits,
      method: this.getTemperatureDisplayUnits,
      bind: this
    })

    this.serviceManager
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({
        minStep: 0.1
      });
  }
}

module.exports = TemperatureSensorAccessory
