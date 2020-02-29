const source = '@devtools-extension';
const pageSource = '@devtools-page';
const cefPostMessage = (window.CefSharp && typeof (window.CefSharp.PostMessage) === 'function') ?
  window.CefSharp.PostMessage : function() {
  };
const connections = [];

window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {};
window.chrome.runtime.connect = function() {
  console.log('chrome.runtime.connect');
  function addOnMessageListener(handler) {
    console.log('chrome.runtime.connect:addOnMessageListener');
    if (handler) {
      this.onMessageListeners.push(handler);
    }
  }

  function addOnDisconnectListener(handler) {
    console.log('chrome.runtime.connect:addOnDisconnectListener');
    if (handler) {
      this.onDisconnectListeners.push(handler);
    }
  }

  function postMessage(data) {
    console.log('chrome.runtime.connect:postMessage');
    if (data) {
      cefPostMessage(JSON.stringify({
        target: source,
        message: data
      }));
    }
  }

  function disconnect() {
    console.log('chrome.runtime.connect:disconnect');
    let index = connections.findIndex(c => c === connection);
    if (index >= 0) {
      connections.splice(index, 1);
    }
    if (this.onDisconnectListeners && this.onDisconnectListeners.length > 0) {
      this.onDisconnectListeners.forEach(handler => {
        if (handler && typeof handler === 'function') {
          try {
            handler();
          } catch (e) {
            console.error(e);
          }
        }
      });
    }
    this.onMessageListeners = [];
    this.onDisconnectListeners = [];
  }

  const connection = {
    onMessage: {},
    onMessageListeners: [],
    onDisconnect: {},
    onDisconnectListeners: []
  };
  connection.onMessage.addListener = addOnMessageListener.bind(connection);
  connection.onDisconnect.addListener = addOnDisconnectListener.bind(connection);
  connection.postMessage = postMessage.bind(connection);
  connection.disconnect = disconnect.bind(connection);
  connections.push(connection);
  return connection;
};
chrome.storage = chrome.storage || {};
if (!chrome.storage.local || !chrome.storage.local.remove) {
  chrome.storage.local = {
    set(obj, callback) {
      Object.keys(obj).forEach(key => {
        localStorage.setItem(key, obj[key]);
      });
      if (callback) {
        callback();
      }
    },
    get(obj, callback) {
      const result = {};
      Object.keys(obj).forEach(key => {
        result[key] = localStorage.getItem(key) || obj[key];
      });
      if (callback) {
        callback(result);
      }
    },
    // Electron ~ 1.4.6
    remove(items, callback) {
      if (Array.isArray(items)) {
        items.forEach(name => {
          localStorage.removeItem(name);
        });
      } else {
        localStorage.removeItem(items);
      }
      if (callback) {
        callback();
      }
    }
  };
}
chrome.storage.sync = chrome.storage.sync || chrome.storage.local;
chrome.runtime.sendMessage = function(data) {
  if (typeof arguments[arguments.length - 1] === 'function') {
    Array.prototype.pop.call(arguments);
  }
  cefPostMessage(JSON.stringify({
    target: source,
    message: data
  }));
};
window.CefReduxDevToolsMessageDispatch = function(json) {
  if (connections.length < 1) return;
  let data;
  if (json && typeof json === 'string') {
    try {
      // eslint-disable-next-line no-param-reassign
      data = JSON.parse(json);
    } catch (e) {
      console.error(e);
      return;
    }
  } else {
    data = json;
  }
  if (data.target !== pageSource) return;
  connections.forEach(c => {
    if (c.onMessageListeners.length < 1) return;
    c.onMessageListeners.forEach(handler => {
      if (handler && typeof handler === 'function') {
        try {
          handler(data.message);
        } catch (e) {
          console.error(e);
        }
      }
    });
  });
};

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
