import chrome from './backgroundShims';
import configureStore from '../../../app/stores/backgroundStore';

window.chrome = chrome;
// Expose the extension's store globally to access it from the windows
// via chrome.runtime.getBackgroundPage
window.store = configureStore();
