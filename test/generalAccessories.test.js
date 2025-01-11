
const { expect } = require('chai');
const delayForDuration = require('../helpers/delayForDuration');

const { setup } = require('./helpers/setup');
const { getAccessories } = require('./helpers/setup');
const hexCheck = require('./helpers/hexCheck');

// const log = () => {
//   return null
// }

// disableLogs
describe('disableLogs', () => {

  it('UnitTest', async () => {
    const config = {
      isUnitTest: true,
      hideScanFrequencyButton: true,
      disableLogs: true,
      hideLearnButton: true,
      accessories: [
        {
          name: 'Test',
          type: 'switch',
	  persistState: false,
          disableLogs: true
        }
      ]
    };
  
    const {platform, accessories} = await getAccessories(config);
    expect(platform.isUnitTest).to.equal(true);
    expect(accessories[0].isUnitTest).to.equal(true);
    
  });

  // it('disableLogs true returns empty function', async () => {
  //   const config = {
  //     isUnitTest: true,
  //     hideScanFrequencyButton: true,
  //     disableLogs: true,
  //     hideLearnButton: true,
  //     accessories: [
  //       {
  //         name: 'Test',
  //         type: 'switch',
  // 	  persistState: false,
  //         disableLogs: true
  //       }
  //     ]
  //   };
  
  //   const {accessories} = await getAccessories(config);
  //   const logFunctionAsString = accessories[0].log.toString();
  //   const isEmptyFunction = logFunctionAsString === '() => {}';
    
  //   expect(isEmptyFunction).to.equal(true);
  // });

  // it('disableLogs false returns useful function', async () => {
  //   const config = {
  //     isUnitTest: true,
  //     hideScanFrequencyButton: true,
  //     hideLearnButton: true,
  //     accessories: [
  //       {
  //         name: 'Test',
  //         type: 'switch',
  // 	  persistState: false,
  //       }
  //     ]
  //   };

  //   const {accessories} = await getAccessories(config);
  //   const logFunctionAsString = accessories[0].log.toString();
  //   const isEmptyFunction = logFunctionAsString === '() => {}';

  //   expect(isEmptyFunction).to.equal(false);
  // });

  it('Advanced HEX', async () => {
    const config = {
      isUnitTest: true,
      hideScanFrequencyButton: true,
      disableLogs: true,
      hideLearnButton: true,
      accessories: [
        {
          name: 'Test1',
          type: 'switch',
	  persistState: false,
	  logLevel: 'trace',
	  pingGrace: 0.1,
	  data: {
	    on: [
	      {data: 'ON11',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2},
	      {data: 'ON12',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2}
	    ],
	    off: [
	      {data: 'OFF11',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2},
	      {data: 'OFF12',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2}
	    ]
	  },
        },
        {
          name: 'Test2',
          type: 'switch',
	  persistState: false,
          disableLogs: false,
	  logLevel: 'trace',
	  pingGrace: 0.1,
	  data: {
	    on: [
	      {data: 'ON21',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2},
	      {data: 'ON22',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2}
	    ],
	    off: [
	      {data: 'OFF21',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2},
	      {data: 'OFF22',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2}
	    ]
	  },
        }
      ]
    };
    
    const {device, accessories} = await getAccessories(config);
    accessories[0].serviceManager.setCharacteristic(Characteristic.On, true);
    accessories[1].serviceManager.setCharacteristic(Characteristic.On, true);

    accessories[0].serviceManager.setCharacteristic(Characteristic.On, false);
    accessories[1].serviceManager.setCharacteristic(Characteristic.On, false);

    
    await delayForDuration(2.4);
    
    // Check hex codes were sent
    hexCheck({ device,
	       codes: [
		 'ON11', 'ON11',
		 'ON12', 'ON12',
		 'ON21', 'ON21',
		 'ON22', 'ON22',
		 'OFF11', 'OFF11',
		 'OFF12', 'OFF12',
		 'OFF21', 'OFF21',
		 'OFF22', 'OFF22'
	       ],
	       count: 16
	     });
  }).timeout(4000);

  it('Advanced HEX with timeout', async () => {
    const config = {
      isUnitTest: true,
      hideScanFrequencyButton: true,
      disableLogs: true,
      hideLearnButton: true,
      accessories: [
        {
          name: 'Test1',
          type: 'switch',
	  persistState: false,
	  logLevel: 'trace',
	  pingGrace: 0.1,
	  data: {
	    on: [
	      {timeout: 0.4},
	      {data: 'ON11',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2},
	      {data: 'ON12',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2}
	    ],
	    off: [
	      {data: 'OFF11',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2,
	       timeout: 0.3},
	      {data: 'OFF12',
	       sendCount: 2,
	       interval: 0.1,
	       pause: 0.2}
	    ]
	  },
        },
      ]
    };
    
    const {device, accessories} = await getAccessories(config);
    accessories[0].serviceManager.setCharacteristic(Characteristic.On, true);
    accessories[0].serviceManager.setCharacteristic(Characteristic.On, false);

    await delayForDuration(0.9);

    // Check hex codes were sent
    hexCheck({ device,
	       codes: [
		 'ON11', 'ON11',
		 'ON12',
	      // 'ON12',
		 'OFF11', 'OFF11',
	      // 'OFF12', 'OFF12',
	       ],
	       count: 5
	     });
  }).timeout(4000);

  it('Context HEX', async () => {
    const { platform, device, log } = setup();
    const config = {
      allowResend: false,
      name: 'AirConditioner',
      data: {
	on: 'ON',
	off: [
	  {pause: 0.1},
	  {sendCount: 2,
	   eval: "currentHeatingCoolingState === 1 ? 'HEAT_OFF' : 'COOL_OFF'",
	   interval: 0.2,
	   pause: 0.1
	  },
	],
	temperature16: {
	  'pseudo-mode': 'cool',
	  'data': 'TEMPERATURE_16'
	},
	temperature18: {
	  'pseudo-mode': 'cool',
	  'data': 'TEMPERATURE_18'
	},
	temperature23: {
	  'pseudo-mode': 'heat',
	  'data': 'TEMPERATURE_23'
	},
	temperature26: {
	  'pseudo-mode': 'heat',
	  'data': 'TEMPERATURE_26'
	},
	temperature30: {
	  'pseudo-mode': 'heat',
	  'data': 'TEMPERATURE_30'
	}
      },
      replaceAutoMode: 'cool',
      logLevel: 'trace',
      noHistory: true,
      isUnitTest: true,
      persistState: false,
      host: device.host.address
    };

    const airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);

    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.5);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(0);

    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
    await delayForDuration(0.1);

    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.5);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(0);
  });

  it('Invalid context HEX', async () => {
    const { platform, device, log } = setup();
    const config = {
      allowResend: false,
      name: 'AirConditioner',
      data: {
	on: 'ON',
	off: [
	  {pause: 0.1},
	  {sendCount: 2,
	   eval: "HeatingCoolingState === 1 ? 'HEAT_OFF' : 'COOL_OFF'",
	   interval: 0.2,
	   pause: 0.1
	  },
	],
	temperature16: {
	  'pseudo-mode': 'cool',
	  'data': 'TEMPERATURE_16'
	},
	temperature18: {
	  'pseudo-mode': 'cool',
	  'data': 'TEMPERATURE_18'
	},
	temperature23: {
	  'pseudo-mode': 'heat',
	  'data': 'TEMPERATURE_23'
	},
	temperature26: {
	  'pseudo-mode': 'heat',
	  'data': 'TEMPERATURE_26'
	},
	temperature30: {
	  'pseudo-mode': 'heat',
	  'data': 'TEMPERATURE_30'
	}
      },
      replaceAutoMode: 'cool',
      logLevel: 'trace',
      noHistory: true,
      isUnitTest: true,
      persistState: false,
      host: device.host.address
    };

    const airConAccessory = new platform.classTypes['air-conditioner'](log, config, platform);

    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
    await delayForDuration(0.1);

    airConAccessory.serviceManager.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    await delayForDuration(0.5);
    expect(airConAccessory.state.currentHeatingCoolingState).to.equal(1);
  });
})
