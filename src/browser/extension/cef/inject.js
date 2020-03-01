window.ReduxDevToolsCefEnvironment = 'inject';
import chrome from './shims';
window.chrome = chrome;
window.devToolsExtensionID = 'lmhkpmbekcpmknklioeibfkpmmfibljd';

require('../inject/contentScript');
require('../inject/pageScript');

window.devToolsOptions = {
  'blacklist': '',
  'editor': '',
  'filter': 'DO_NOT_FILTER',
  'inject': true,
  'maxAge': 50,
  'projectPath': '',
  'shouldCatchErrors': false,
  'showContextMenus': false,
  'urls': '^https?://localhost|0\\.0\\.0\\.0:\\d+\n^https?://.+\\.github\\.io',
  'useEditor': 0,
  'whitelist': ''
};
window.__REDUX_DEVTOOLS_EXTENSION__.notifyErrors();
