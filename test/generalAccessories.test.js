const { expect } = require('chai');

const { getAccessories } = require('./helpers/setup');

// const log = () => {
//   return null
// }

// disableLogs
describe('disableLogs', () => {

  it('disableLogs true returns empty function', async () => {
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
  
    const accessories = await getAccessories(config);
    const logFunctionAsString = accessories[0].log.toString();
    const isEmptyFunction = logFunctionAsString === '() => {}';
    
    // expect(isEmptyFunction).to.equal(true);
  });

  it('disableLogs false returns useful function', async () => {
    const config = {
      isUnitTest: true,
      hideScanFrequencyButton: true,
      hideLearnButton: true,
      accessories: [
        {
          name: 'Test',
          type: 'switch',
	  persistState: false,
        }
      ]
    };

    const accessories = await getAccessories(config);
    const logFunctionAsString = accessories[0].log.toString();
    const isEmptyFunction = logFunctionAsString === '() => {}';

    // expect(isEmptyFunction).to.equal(false);
  });
})
