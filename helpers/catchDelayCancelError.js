import { TIMEOUT_CANCELLATION } from './errors.js';

const catchDelayCancelError = async (originalMethod) => {

  let result

  try {
    result = await originalMethod()
  } catch (err) {
    if (err.message !== TIMEOUT_CANCELLATION) {throw err}
  }

  return result
}

export default catchDelayCancelError;
