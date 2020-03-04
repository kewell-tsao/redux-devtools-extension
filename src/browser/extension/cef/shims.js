const cefPostMessage = (window.CefSharp && typeof (window.CefSharp.PostMessage) === 'function') ?
  window.CefSharp.PostMessage : function() {};
const cefTabId = () => window.cefTabId;
const cefFrameId = () => window.cefFrameId;
const connections = [];
const onConnectListeners = [];
const onMessageListeners = [];

let reduxDevtoolsFrame = null;
function autoSwitchPostMessage(data) {
  log('<SEND>', data);
  switch (window.ReduxDevToolsCefEnvironment ) {
    case 'background': // 发送到devtools或inject
      if (data.target === 'background') {
        if (!reduxDevtoolsFrame) {
          reduxDevtoolsFrame = window.document.getElementById('redux_devtools');
        }
        if (reduxDevtoolsFrame) {
          reduxDevtoolsFrame.contentWindow.reduxDevToolsCefMessageDispatch(data);
        }
      } else if (data.target === 'tab' || data.target === 'lmhkpmbekcpmknklioeibfkpmmfibljd') {
        cefPostMessage(JSON.stringify(data));
      } else {
        console.error('Unknown target:' + data.target);
      }
      break;
    case 'devtools': // 发送到background
      if (window.parent !== window) {
        window.parent.reduxDevToolsCefMessageDispatch(data);
      } else {
        console.error('devtools?');
      }
      break;
    case 'inject': // 发送到background
      cefPostMessage(JSON.stringify(data));
      break;
  }
}

const log = window.__REDUX_DEVTOOLS_EXTENSION_LOG_OUTPUT__ ? function(message, json) {
  console.log(`[${window.location.pathname}] ${message}`);
  if (json) {
    console.dir(json);
  }
} : function() { };

class CefMessageConnection {
  constructor(extensionId, name) {
    this.extensionId = extensionId;
    this.name = name;
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
    log('addOnMessageListener');
    if (handler) {
      if (this.onMessageListeners.findIndex(h => h === handler) < 0) {
        this.onMessageListeners.push(handler);
      }
    }
  }

  addOnDisconnectListener(handler) {
    log('addOnDisconnectListener');
    if (handler) {
      if (this.onDisconnectListeners.findIndex(h => h === handler) < 0) {
        this.onDisconnectListeners.push(handler);
      }
    }
  }

  postMessage(data) {
    log('postMessage');
    autoSwitchPostMessage({
      method: 'postMessage',
      target: this.extensionId || this.name,
      sender: {
        tab: {id: cefTabId()},
        frameId: cefFrameId()
      },
      data: data
    });
  }

  disconnect() {
    log('disconnect');
    let index = connections.findIndex(c => c === this);
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
    log('sendResponse');
    this.postMessage(data);
  }

  static connect() {
    log('connect');
    let extensionId;
    let name;
    if (arguments.length > 0) {
      if (typeof arguments[0] === 'string') {
        extensionId = arguments[0];
        if (arguments.length > 1 && typeof arguments[1] === 'object') {
          name = arguments[1].name;
        }
      } else if (typeof arguments[0] === 'object') {
        name = arguments[0].name;
      }
    }
    let found = connections.filter(c => c.extensionId === extensionId && c.name === name);
    if (found.length > 0) {
      return found[0];
    }
    const connection = new CefMessageConnection(extensionId, name);
    connections.push(connection);
    autoSwitchPostMessage({
      method: 'connect',
      target: connection.extensionId || connection.name,
      sender: {
        tab: {id: cefTabId()},
        frameId: cefFrameId()
      },
      connect: {
        name: name,
        extensionId: extensionId
      }
    });
    return connection;
  }
}

const chrome = window.chrome || {};
chrome.runtime = chrome.runtime || {};
chrome.runtime.connect = CefMessageConnection.connect;
chrome.runtime.onConnect = chrome.runtime.onConnect || {
  addListener(handler) {
    if (onConnectListeners.findIndex(h => h === handler) < 0) {
      onConnectListeners.push(handler);
    }
  }
};
chrome.runtime.onConnectExternal = chrome.runtime.onConnectExternal || chrome.runtime.onConnect;
chrome.runtime.onMessage = chrome.runtime.onMessage || {
  addListener(handler) {
    if (onMessageListeners.findIndex(h => h === handler) < 0) {
      onMessageListeners.push(handler);
    }
  }
};
chrome.runtime.onMessageExternal = chrome.runtime.onMessageExternal || chrome.runtime.onMessage;
chrome.runtime.onInstalled = chrome.runtime.onInstalled || {
  addListener: cb => cb()
};
chrome.runtime.sendMessage = chrome.runtime.sendMessage || function() {
  log('sendMessage');
  let extensionId;
  let data;
  if (arguments.length > 0) {
    if (typeof arguments[0] === 'string') {
      extensionId = arguments[0];
      if (arguments.length > 1) {
        data = arguments[0];
      }
    } else {
      data = arguments[0];
    }
  }
  if (typeof arguments[arguments.length - 1] === 'function') {
    Array.prototype.pop.call(arguments);
  }
  autoSwitchPostMessage({
    method: 'sendMessage',
    target: extensionId,
    sender: {
      tab: {id: cefTabId()},
      frameId: cefFrameId()
    },
    data: data
  });
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

chrome.pageAction = {
  show: function() { },
  setIcon: function() { }
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

window.reduxDevToolsCefMessageDispatch = function(json) {
  let body;
  if (json && typeof json === 'string') {
    try {
      // eslint-disable-next-line no-param-reassign
      body = JSON.parse(json);
    } catch (e) {
      console.error(e);
      return;
    }
  } else {
    body = json;
  }
  log('<DISPATCH>', body);
  if (body.method && body.target && body.sender) {
    switch (body.method) {
      case 'postMessage':
        if (connections.length > 0) {
          connections.filter(c => {
            switch (body.target) {
              case 'lmhkpmbekcpmknklioeibfkpmmfibljd':
                if (c.name === 'tab') {
                  return true;
                }
                break;
              case 'background':
                if (c.name === 'background') {
                  return true;
                }
                break;
              default:
                console.error('Unknown target:' + body.target);
                break;
            }
            return false;
          }).forEach(c => {
            if (c.onMessageListeners.length > 0) {
              c.onMessageListeners.forEach(handler => {
                if (handler && typeof handler === 'function') {
                  try {
                    handler(body.data, body.sender, c.sendResponse);
                  } catch (e) {
                    console.error(e);
                  }
                }
              });
            }
          });
        }
        break;
      case 'sendMessage':
        if (onMessageListeners.length > 0) {
          onMessageListeners.forEach(handler => {
            if (handler && typeof handler === 'function') {
              try {
                handler(body.data, body.sender, chrome.runtime.sendMessage);
              } catch (e) {
                console.error(e);
              }
            }
          });
        }
        break;
      case 'connect':
        let extensionId = body.connect.extensionId;
        let name = body.connect.name;
        let found = connections.filter(c => c.extensionId === extensionId && c.name === name);
        if (found.length > 0) return;
        const connection = new CefMessageConnection(extensionId, name);
        connection.sender = body.sender;
        connections.push(connection);
        if (onConnectListeners.length > 0) {
          for (let i = 0; i < onConnectListeners.length; i++) {
            let handler = onConnectListeners[i];
            if (handler && typeof handler === 'function') {
              try {
                handler(connection);
              } catch (e) {
                console.error(e);
              }
            }
          }
        }
        break;
    }
  }
};

export default chrome;
