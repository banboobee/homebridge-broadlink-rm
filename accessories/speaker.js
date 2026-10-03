const BroadlinkRMAccessory = require('./accessory');
const persistentState = require('../base/helpers/persistentState');
// const util = require('util');

class SpeakerAccessory extends BroadlinkRMAccessory {
  static configKeys = {
    // common
    ...this.configCommonKeys,

    // complex
    data: [
      (key, values) => this.configIsObject(values[0]) && this.verifyConfig(values, key, this.configDataKeys),
      '`value ${JSON.stringify(value)} is not a valid data config`'],

    // selection
    // string
    // number
  }
  static configDataKeys = {
    on: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    off: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    mute: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    play: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    pause: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    stop: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    'volume': [
      (key, values) => this.configIsObject(values[0]) && this.verifyConfig(values, key, this.configVolumeKeys),
      '`value ${JSON.stringify(value)} is not a valid volume config`'],
  }
  static configVolumeKeys = {
    up: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
    down: [
      (key, values) => {return this.configIsHex(key, values)},
      '`value ${JSON.stringify(value)} is not a valid HEX code`'],
  }

  constructor(log, config = {}, platform) {
    super(log, config, platform);

    const {name} = this;
    const {host, persistState} = config;
    if (persistState === false) return;
    if (this.constructor.isUnitTest) return;    // to avoid duplicate state persisting

    this.MediaState = {
      play: Characteristic.TargetMediaState.PLAY,
      pause: Characteristic.TargetMediaState.PAUSE,
      stop: Characteristic.TargetMediaState.STOP,
    }
    this.MediaStateKeys = {};
    this.MediaStateKeys[Characteristic.TargetMediaState.PLAY] = 'play';
    this.MediaStateKeys[Characteristic.TargetMediaState.PAUSE] = 'pause';
    this.MediaStateKeys[Characteristic.TargetMediaState.STOP] = 'stop';

    // console.log(util.types.isProxy(this.state), this.state);
    const state = {...this.state};
    this.state = new Proxy(state, {     // replace proxy for external accessories
      set: async function(target, key, value) {
        Reflect.set(target, key, value);
        persistentState.save({ host, name, state });
        this.serviceManager.accessory.context[key] = value;
        // console.log(`${host}-${name} persist: ${JSON.stringify(state)}`);
        // console.log(`${host}-${name} context: ${JSON.stringify(this.serviceManager.accessory.context)}`);
        return true
      }.bind(this)
    })
    this.serviceManager.state = this.state;
  }

  checkConfig(config) {
    this.constructor.verifyConfig([config], '', this.constructor.configKeys);
  }

  setDefaults() {
    const { config } = this;
    config.subType ??= 'speaker';

    // state.volumeSelector = -1;
    // this.serviceManager.updateCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE);
    this.serviceManager.updateCharacteristic(Characteristic.CurrentMediaState, Characteristic.CurrentMediaState.PAUSE);
    this.serviceManager.updateCharacteristic(Characteristic.TargetMediaState, Characteristic.TargetMediaState.PAUSE);
    // this.serviceManager.updateCharacteristic(Characteristic.Mute, false);
    this.serviceManager.updateCharacteristic(Characteristic.Volume, 50);
  }

  reset() {
    // const { Characteristic } = this;
    super.reset();

    // if (this.serviceManager.getCharacteristic(Characteristic.Active) === undefined) {
    //   this.serviceManager.setCharacteristic(Characteristic.Active, false);
    // }
  }

  async setTargetMediaState(hexData, previousValue) {
    const { Characteristic } = this;
    const { data, state } = this;

    switch (state.targetMediaState) {
      case Characteristic.TargetMediaState.PLAY:
        hexData = data?.play;
        break;
      case Characteristic.TargetMediaState.PAUSE:
        hexData = data?.pause;
        break;
      case Characteristic.TargetMediaState.STOP:
      default: {
        hexData = data?.stop;
        break;
      }
    }
    if (!hexData) {
      throw new Error(`No IR code for ${this.targetMediaStateKeys[state.targetMediaState]}.`);
    }
    await this.performSend(hexData);
    // this.serviceManager.updateCharacteristic(Characteristic.CurrentMediaState, state.targetMediaState);
    this.serviceManager.setCharacteristic(Characteristic.CurrentMediaState, state.targetMediaState);
  }

  async setVolume(hexData, previousValue) {
    const { data, state } = this;

    const delta = 100 / 20; // 20 steps maximal
    const update = Math.floor(state.volume / delta);
    const current = Math.floor(previousValue / delta);

    if (update - current > 0) {
      hexData = data?.volume?.up;
    } else if (update - current < 0) {
      hexData = data?.volume?.down;
    } else {
      return; // nothing to do
    }
    if (!hexData) {
      throw new Error(`volume: No IR code for ${update > 0 ? 'up': 'down'}.`);
    }
    await this.performSend([{
      data: hexData,
      // interval: 1,
      sendCount: Math.abs(update - current),
    }]);
  }

  // async setVolume(hexData, previousValue) {
  //   const { Characteristic } = this;
  //   const { data, state } = this;

  //   try {
  //     const delta = 100 / 20; // 20 steps maximal
  //     let update;
  //     if (state.volume > previousValue) {
  //       hexData = data?.volume?.up;
  //       update = (previousValue / delta + 1) * delta;
  //     } else if (state.volume < previousValue) {
  //       hexData = data?.volume?.down;
  //       update = (previousValue / delta - 1) * delta;
  //     } else {
  //       return; // nothing to do
  //     }
  //     if (!hexData) {
  //       throw new Error(`volume: No IR code for ${state.volume > previousValue ? 'up': 'down'}.`);
  //     }
  //     await this.performSend(hexData);
  //     state.volume = update;
  //     this.serviceManager.updateCharacteristic(Characteristic.Volume, state.Volume);
  //   } catch (e) {
  //     // this.serviceManager.updateCharacteristic(Characteristic.Volume, previousValue);
  //     throw(e);
  //   }
  // }

  // async setVolumeSelector(hexData, previousValue) {
  //   const { Characteristic } = this;
  //   const { data, state } = this;

  //   try {
  //     const delta = 100 / 20;
  //     let update;
  //     switch (state.volumeSelector) {
  //       case Characteristic.VolumeSelector.INCREMENT:
  //         hexData = data?.volume?.up;
  //         update = (state.volume / delta + 1) * delta;
  //         break;
  //       case Characteristic.VolumeSelector.DECREMENT:
  //         hexData = data?.volume?.down;
  //         update = (state.volume / delta - 1) * delta;
  //         break;
  //       default: {
  //         throw new Error(`Unexpected volume selector control ${state.volumeSelector}.`);
  //       }
  //     }
  //     if (!hexData) {
  //       throw new Error(`No IR code found for volume ${state.volumeSelector ? 'up' : 'down'}`);
  //     }
  //     await this.performSend(hexData);
  //     this.state.volume = update;
  //     this.state.volumeSelector = -1;
  //     this.serviceManager.updateCharacteristic(Characteristic.Volume, state.volume);
  //   } catch(e) {
  //     throw(e);
  //   }
  // };

  setupServiceManager() {
    const { Service, Characteristic, Categories } = this;
    const { data, name, log } = this;
    const { on, off } = data || {};

    this.serviceManager = new this.serviceManagerClass(
      name,
      Service.SmartSpeaker,
      log,
      Categories.SPEAKER,
    );

    if (data?.on) {
      this.serviceManager.service.addOptionalCharacteristic(Characteristic.Active);
      this.serviceManager.addToggleCharacteristic({
        name: 'Active',
        type: Characteristic.Active,
        getMethod: this.getCharacteristicValue,
        setMethod: this.setCharacteristicValue,
        bind: this,
        props: {
          onData: on || data,
          offData: off || undefined,
          ignorePreviousValue: true,
        }
      });
    }

    if (data?.mute) {
      this.serviceManager.addToggleCharacteristic({
        name: 'Mute',
        type: Characteristic.Mute,
        getMethod: this.getCharacteristicValue,
        setMethod: this.setCharacteristicValue,
        bind: this,
        props: {
          onData: data?.mute,
          ignorePreviousValue: true,
        }
      });
    }

    // this.serviceManager.service.addOptionalCharacteristic(Characteristic.VolumeControlType);
    // this.serviceManager.setCharacteristic(
    //   Characteristic.VolumeControlType,
    //   Characteristic.VolumeControlType.ABSOLUTE
    // );

    this.serviceManager.addToggleCharacteristic({
      name: 'volume',
      type: Characteristic.Volume,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        setValuePromise: this.setVolume.bind(this),
      }
    });

    this.serviceManager.addToggleCharacteristic({
      name: 'targetMediaState',
      type: Characteristic.TargetMediaState,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
        setValuePromise: this.setTargetMediaState.bind(this),
        ignorePreviousValue: true,
      }
    });

    this.serviceManager.addToggleCharacteristic({
      name: 'currentMediaState',
      type: Characteristic.CurrentMediaState,
      getMethod: this.getCharacteristicValue,
      setMethod: this.setCharacteristicValue,
      bind: this,
      props: {
      }
    });

    this.serviceManager.service.addOptionalCharacteristic(Characteristic.VolumeSelector);
    // this.serviceManager.addToggleCharacteristic({
    //   name: 'volumeSelector',
    //   type: Characteristic.VolumeSelector,
    //   getMethod: this.getCharacteristicValue,
    //   setMethod: this.setCharacteristicValue,
    //   bind: this,
    //   props: {
    //     setValuePromise: this.setVolumeSelector.bind(this),
    //     // ignorePreviousValue: true,
    //   }
    // });
    this.serviceManager.getCharacteristic(Characteristic.VolumeSelector)
      .onSet(async (value) => {
        const { Characteristic } = this;
        const { data, state } = this;
        try {
          const delta = 100 / 20; // 20 steps maximal
          let hex, update;
          switch (value) {
            case Characteristic.VolumeSelector.INCREMENT:
              hex = data?.volume?.up;
              update = (state.volume / delta + 1) * delta;
              break;
            case Characteristic.VolumeSelector.DECREMENT:
              hex = data?.volume?.down;
              update = (state.volume / delta - 1) * delta;
              break;
            default: {
              throw new Error(`Unexpected volume selector control ${value}.`);
            }
          }
          if (!hex) {
            throw new Error(`No IR code found for volume ${value ? 'up' : 'down'}.`);
          }
          await this.performSend(hex);
          // this.state.volume = update;
          this.serviceManager.updateCharacteristic(Characteristic.Volume, update);
        } catch(e) {
          this.logs.error(`${e}`);
          // throw(e);
        }
      });
  }
}

module.exports = SpeakerAccessory;
