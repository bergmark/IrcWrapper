require('Task/Joose/NodeJS');

Class('IRCMock', {
  has : {
    listeners : {
      is : "ro",
      init : function () { return []; }
    },
    serverListeners : {
      init : function () { return {}; }
    },
    receivedLog : {
      init : function () { return {}; }
    }
  },
  methods : {
    initialize : function (args) {
      if (IRCMock.serverListeners) {
        for (var i= 0; i < IRCMock.serverListeners.length; i++) {
          var v = IRCMock.serverListeners[i];
          this.addServerListener(v.raw, v.callback);
        }
      }
      this.nick(args.nick);
      delete IRCMock.serverListeners;
    },
    addServerListener : function (raw, callback) {
      this.serverListeners[raw] = this.serverListeners[raw] || [];
      this.serverListeners[raw].push(callback);
    },
    _onServerGet : function (raw, params) {
      this.receivedLog[raw] = this.receivedLog[raw] || [];
      this.receivedLog[raw].push(params);
      this.serverListeners[raw] = this.serverListeners[raw] || [];
      for (var i = 0; i < this.serverListeners[raw].length; i++) {
        this.serverListeners[raw][i](params);
      }
    },
    getReceivedLog : function (raw) {
      this.receivedLog[raw] = this.receivedLog[raw] || [];
      return this.receivedLog[raw];
    },

    // Client to server.
    connect : function () {

    },
    privmsg : function (location, message) {
      this._onServerGet("privmsg", { location : location, message : message});
    },
    join : function (channel, password) {
      this._onServerGet("join", { location : channel, password : password || "" });
    },
    part : function (channel) {
      this._onServerGet("part", { location : channel });
    },
    nick : function (newNick) {
      this._onServerGet("nick", { newNick : newNick });
    },
    quit : function (message) {
      this._onServerGet("quit", { message : message });
    },
    user : function () {
      this._onServerGet("user", arguments);
    },

    // Server to client.
    addListener : function (raw, callback) {
      this.listeners.push({
        raw : raw,
        callback : callback
      });
    },
    sendRaw : function (raw, e) {
      if (typeof raw !== "string") {
        throw new Error("IRCMock: sendRaw: raw must be a string.");
      }
      for (var i = 0; i < this.listeners.length; i++) {
        var listener = this.listeners[i];
        if (listener.raw === raw) {
          listener.callback(e);
        }
      }
    },
    // Nick already taken.
    send433 : function (serverName, nick) {
      this.sendRaw("433", {
        servername : serverName,
        command : "433",
        params : ["*", nick, "Nickname is already in use."]
      });
    },
    // Connect
    send001 : function (nick) {
      this.sendRaw("001", {
        params : [nick, "Welcome message!"]
      });
    },
    // Names list
    send353 : function (mehash, chan, nicks) {
      this.sendRaw("353", {
        servername : "server.name",
        command : "353",
        params : [
          mehash.nick,
          "=",
          chan,
          [mehash.nick].concat(nicks)
        ]
      });
    },
    sendPrivmsg : function (location, message, person) {
      if (person === undefined) {
        throw new Error("sendPrivmsg: need to specify person.");
      }
      this.sendRaw("privmsg", {
        person : person,
        params : [location, message]
      });
    },
    sendJoin : function (location, person) {
      if (person === undefined) {
        throw new Error("sendJoin: need to specify person.");
      }
      this.sendRaw("join", {
        person : person,
        params : [location]
      });
    },
    sendPart : function (location, person) {
      if (person === undefined) {
        throw new Error("sendPart: need to specify person.");
      }
      this.sendRaw("part", {
        person : person,
        params : [location]
      });
    },
    sendQuit : function (person) {
      this.sendRaw("quit", {
        person : person,
        params : ["Quit message!"]
      });
    },
    sendClientQuit : function (person) {
      this.sendRaw("quit", {
        person : person,
        command : "QUIT",
        params : ["Client Quit"]
      });
    },
    sendNick : function (person, newNick) {
      this.sendRaw("nick", {
        person : person,
        command : 'NICK',
        params : [newNick]
      });
    }
  }
});
