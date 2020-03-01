window.ReduxDevToolsCefEnvironment = 'background';
import chrome from './shims';
window.chrome = chrome;
import configureStore from '../../../app/stores/backgroundStore';

// Expose the extension's store globally to access it from the windows
// via chrome.runtime.getBackgroundPage
window.store = configureStore();
