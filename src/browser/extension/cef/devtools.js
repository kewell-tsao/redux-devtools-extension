import 'remotedev-monitor-components/lib/presets';
import React from 'react';
import {render, unmountComponentAtNode} from 'react-dom';
import {Provider} from 'react-redux';
import {REMOVE_INSTANCE} from 'remotedev-app/lib/constants/actionTypes';
import App from '../../../app/containers/App';
import configureStore from '../../../app/stores/panelStore';
import getPreloadedState from '../background/getPreloadedState';

const source = '@devtools-extension';
const pageSource = '@devtools-page';
const position = '#popup';
const messageStyle = {padding: '20px', width: '100%', textAlign: 'center'};

let rendered;
let store;
let naTimeout;
let preloadedState;
const cefPostMessage = (window.CefSharp && typeof (window.CefSharp.PostMessage) === 'function') ?
  window.CefSharp.PostMessage : function() {};
let bgConnection;
const connections = [];
const onConnectListeners = [];
const onMessageListeners = [];

chrome.devtools = chrome.devtools || {};
chrome.devtools.inspectedWindow = chrome.devtools.inspectedWindow || {};
chrome.devtools.inspectedWindow.tabId = 1;

chrome.runtime = chrome.runtime || {};
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

window.chrome.runtime.connect = function(options) {
  const name = options ? options.name : null;
  console.log('chrome.runtime.connect:' + name);
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

  function sendResponse(data) {
    this.postMessage(data);
  }

  const connection = {
    name: name,
    sender: {
      tab: {
        id: name + '_tabid',
      }
    },
    onMessage: {},
    onMessageListeners: [],
    onDisconnect: {},
    onDisconnectListeners: []
  };
  connection.onMessage.addListener = addOnMessageListener.bind(connection);
  connection.onDisconnect.addListener = addOnDisconnectListener.bind(connection);
  connection.postMessage = postMessage.bind(connection);
  connection.disconnect = disconnect.bind(connection);
  connection.sendResponse = disconnect.bind(sendResponse);
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

getPreloadedState(position, state => {
  preloadedState = state;
});

function renderDevTools() {
  const node = document.getElementById('root');
  unmountComponentAtNode(node);
  clearTimeout(naTimeout);
  store = configureStore(position, bgConnection, preloadedState);
  render(
    <Provider store={store}>
      <App position={position}/>
    </Provider>,
    node
  );
  rendered = true;
  console.log('renderDevTools');
}

function renderNA() {
  if (rendered === false) return;
  rendered = false;
  naTimeout = setTimeout(() => {
    let message = (
      <div style={messageStyle}>
        No store found. Make sure to follow <a
        href="https://github.com/zalmoxisus/redux-devtools-extension#usage" target="_blank">the instructions</a>.
      </div>
    );
    const node = document.getElementById('root');
    unmountComponentAtNode(node);
    render(message, node);
    store = undefined;
    console.log('renderNA');
  }, 3500);
}

function init(id) {
  renderNA();
  bgConnection = chrome.runtime.connect({ name: id ? id.toString() : undefined });
  bgConnection.onMessage.addListener(message => {
    if (message.type === 'NA') {
      if (message.id === id) renderNA();
      else store.dispatch({ type: REMOVE_INSTANCE, id: message.id });
    } else {
      if (!rendered) renderDevTools();
      store.dispatch(message);
    }
  });
}

init(chrome.devtools.inspectedWindow.tabId);
