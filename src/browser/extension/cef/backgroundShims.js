const cefPostMessage = (window.CefSharp && typeof (window.CefSharp.PostMessage) === 'function') ?
  window.CefSharp.PostMessage : function() {};
const connections = [];
const onConnectListeners = [];
const onMessageListeners = [];

class CefMessageConnection {
  constructor(extensionId, name) {
    this.extensionId = extensionId;
    this.name = name;
    this.sender = {
      tab: {
        id: name + '_tabid',
      }
    };
    this.onMessage = {
      addListener: this.addOnMessageListener.bind(this)
    };
    this.onMessageListeners = [];
    this.onDisconnect = {
      addListener: this.addOnDisconnectListener.bind(this)
    };
    this.onDisconnectListeners = [];
  }

  addOnMessageListener(handler) {
    console.log('chrome.runtime.connect:addOnMessageListener');
    if (handler) {
      this.onMessageListeners.push(handler);
    }
  }

  addOnDisconnectListener(handler) {
    console.log('chrome.runtime.connect:addOnDisconnectListener');
    if (handler) {
      this.onDisconnectListeners.push(handler);
    }
  }

  postMessage(data) {
    console.log('chrome.runtime.connect:postMessage');
    if (data) {
      if (this.name === 'devtools-bg') {
        if (this.onMessageListeners.length < 1) return;
        this.onMessageListeners.forEach(handler => {
          if (handler && typeof handler === 'function') {
            try {
              handler(data);
            } catch (e) {
              console.error(e);
            }
          }
        });
      } else if (this.name === 'tab') {
        cefPostMessage(JSON.stringify({
          target: pageSource,
          message: data
        }));
      }
    }
  }

  disconnect() {
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

  sendResponse(data) {
    this.postMessage(data);
  }

  static connect() {
    let extensionId;
    let name;
    if (arguments.length > 0) {
      if (typeof arguments[0] === 'string') {
        extensionId = arguments[0];
        if (arguments.length > 1 && typeof arguments[1] === 'object') {
          name = arguments[0].name;
        }
      } else if (typeof arguments[0] === 'object') {
        name = arguments[0].name;
      }
    }
    const connection = new CefMessageConnection(extensionId, name);
    connections.push(connection);
    setTimeout(() => {
      if (onConnectListeners.length > 0) {
        onConnectListeners.forEach(handler => {
          if (handler && typeof handler === 'function') {
            try {
              handler(connection);
            } catch (e) {
              console.error(e);
            }
          }
        });
      }
    }, 0);
    return connection;
  }
}

const chrome = window.chrome || (window.chrome = {});
chrome.runtime = chrome.runtime || {};
chrome.runtime.connect = CefMessageConnection.connect;
chrome.runtime.onConnect = chrome.runtime.onConnect || {
  addListener(handler) {
    onConnectListeners.push(handler);
  }
};
chrome.runtime.onConnectExternal = chrome.runtime.onConnectExternal || chrome.runtime.onConnect;
chrome.runtime.onMessage = chrome.runtime.onMessage || {
  addListener(handler) {
    onMessageListeners.push(handler);
  }
};
chrome.runtime.onMessageExternal = chrome.runtime.onMessageExternal || chrome.runtime.onMessage;
chrome.runtime.onInstalled = chrome.runtime.onInstalled || {
  addListener: cb => cb()
};
chrome.runtime.sendMessage = chrome.runtime.sendMessage || function(data) {
  if (typeof arguments[arguments.length - 1] === 'function') {
    Array.prototype.pop.call(arguments);
  }
  cefPostMessage(JSON.stringify({
    target: source,
    message: data
  }));
};

chrome.notifications = chrome.notifications || {
  onClicked: {
    addListener() {
    }
  },
  create() {
  },
  clear() {
  }
};
chrome.contextMenus = chrome.contextMenus || {
  onClicked: {
    addListener() {
    }
  }
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
  if (data.target !== source) return;
  connections.forEach(c => {
    if (c.name !== 'tab') return;
    if (c.onMessageListeners.length > 0) {
      c.onMessageListeners.forEach(handler => {
        if (handler && typeof handler === 'function') {
          try {
            handler(data.message, c.sender, c.sendResponse);
          } catch (e) {
            console.error(e);
          }
        }
      });
    }
    if (onMessageListeners.length > 0) {
      onMessageListeners.forEach(handler => {
        if (handler && typeof handler === 'function') {
          try {
            handler(data.message, c.sender, c.sendResponse);
          } catch (e) {
            console.error(e);
          }
        }
      });
    }
  });

};

export default chrome;
