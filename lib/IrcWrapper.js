var joose = require('Joose');
var collection = CactusJuice.Data.Collection;
var object = CactusJuice.Addon.Object;
var Pair = CactusJuice.Data.Pair;

joose.Class("IrcWrapper", {
  has : {
    server : {},
    irc : {
      is : "ro"
    },
    nicks : {
      init : function () { return []; }
    },
    joinChannels : {
      init : function () { return []; }
    },
    bindings : {
      init : function () { return {}; }
    },
    channels : {
      is : "ro",
      init : function () { return {}; }
    },
    people : {
      is : "ro",
      init : function () { return {}; }
    },
    me : {
      is : "ro"
    },
    admins : {
      init : function () { return []; }
    }
  },
  methods : {
    initialize : function (args) {
      // Merge if several binding arrays are passed.
      if (this.bindings instanceof Array) {
        var res = {};
        collection.each(this.bindings, function (binding) {
          object.map(binding, function (p, v) {
            res[p] = res[p] || [];
            res[p].push(v);
          });
        });
        this.bindings = res;
      }

      this.bindings.join = this.bindings.join || [];
      this.bindings.privmsg = this.bindings.privmsg || [];
      this.bindings.part = this.bindings.part || [];
      this.bindings.quit = this.bindings.quit || [];
      this.bindings['001'] = this.bindings['001'] || [];
      this.bindings['433'] = this.bindings['433'] || [];
      this.bindings.nick = this.bindings.nick || [];
      this.bindings.clientquit = this.bindings.clientquit || [];

      this.irc = new args.IRC({
        server : this.server,
        nick : this.nicks.shift(),
        flood_protection : true
      });

      this.bindings.join.push({
        callback : function (h) {
          if (!(h.location in this.channels)) {
            this._addChannel(new Channel({
              name : h.location
            }));
          }
          var channel = this.channels[h.location];
          channel.addPerson(h.person);
          h.person.addChannel(channel);
        }.bind(this)
      });
      this.bindings['433'].push({
        callback : function (h) {
          var newNick = this.nicks.shift();
          if (newNick === undefined) {
            this.quit();
          } else {
            this.getIrc().user("js-irc", false, false, "Javascript bot");
            this.nick(newNick);
          }
        }.bind(this)
      });
      this.bindings['001'].push({
        callback : function (h) {
          this.me = this._personCreate({
            nick : h.nick
          });
          for (var i = 0; i < this.joinChannels.length; i++) {
            this.join(this.joinChannels[i]);
          }
        }.bind(this)
      });
      this.bindings.part.push({
        callback : function (h) {
          var channel = this.getChannel(h.location);
          var person = h.person;
          channel.removePerson(person);
          person.removeChannel(channel);

          // If bot parts, remove channel from memory.
          if (this.getMe() === person) {
            this._removeChannel(channel);
          }
        }.bind(this)
      });
      this.bindings.quit.push({
        callback : function (h) {
          var person = h.person;
          for (var p in this.channels) {
            var channel = this.channels[p];
            channel.removePerson(person);
            person.removeChannel(channel);
          }
        }.bind(this)
      });
      this.bindings.nick.push({
        callback : function (h) {
          h.person.setNick(h.newNick);
        }
      });

      // Apply bindings.
      for (var p in this.bindings) if (this.bindings.hasOwnProperty(p)) {
        var raw = p;
        var v = this.bindings[p];
        if ("_on" + raw in this) {
          for (var i = 0; i < v.length; i++) {
            this["_on" + raw](v[i]);
          }
        } else {
          for (var i = 0; i < v.length; i++) {
            this._addListener(raw, v[i].callback);
          }
        }
      }
      this.irc.connect();
    },
    _addListener : function (raw, callback) {
      if (!(callback instanceof Function)) {
        throw new Error("_addListener: callback must be a function.");
      }
      this.irc.addListener(raw, function (e) {
        var x = this._parseE(raw, e);
        callback.call(this, x);
      }.bind(this));
    },
    _parseE : function (raw, e) {
      var h = {
        e : e
      };
      if (raw === "join" || raw === "part" || raw === "quit" || raw === "privmsg" || raw === "nick") {
        h.person = this._personCreate({
          nick : e.person.nick,
          user : e.person.user,
          host : e.person.host
        });
      }
      if (raw === "quit" && h.person === this.getMe()) {
        h.clientQuit = true;
      }
      if (raw === "nick") {
        h.oldNick = e.person.nick;
        h.newNick = e.params[0];
      }
      if (raw === "001") {
        h.nick = e.params[0];
      }
      if (raw === "join" || raw === "part" || raw === "quit" || raw === "privmsg") {
        var location = e.params[0];
        h.location = location;
        h.reply = this.privmsg.bind(this, location);
      }
      if (raw === "part" || raw === "quit" || raw === "privmsg" || raw === "001") {
        h.message = e.params[1];
      }
      if (raw === "privmsg") {
        h.regExp = null;
      }
      return h;
    },
    _onprivmsg : function (options) {
      this._addListener("privmsg", function (h) {
        if ("location" in options && options.location !== h.location) {
          return;
        }
        if ("messageString" in options && options.messageString !== h.message) {
          return;
        }
        if ("messageRegExp" in options) {
          h.regExp = options.messageRegExp.exec(h.message);
          if (h.regExp === null) {
            return;
          }
        }
        options.callback.call(this, h);
      }.bind(this));
    },
    _onjoin : function (options) {
      this._addListener("join", function (h) {
        if ("channel" in options && options.channel !== h.location) {
          return;
        }
        options.callback.call(this, h);
      }.bind(this));
    },
    _onpart : function (options) {
      this._addListener("part", function (h) {
        if ("channel" in options && options.channel !== h.location) {
          return;
        }
        options.callback.call(this, h);
      }.bind(this));
    },
    /**
     * Does no trigger when client itself quits.
     */
    _onquit : function (options) {
      this._addListener("quit", function (h) {
        if (h.clientQuit) {
          return;
        }
        options.callback.call(this, h);
      }.bind(this));
    },
    _onclientquit : function (options) {
      this._addListener("quit", function (h) {
        if (!h.clientQuit) {
          return;
        }
        options.callback.call(this, h);
      }.bind(this));
    },
    getChannel : function (name) {
      if (!(name in this.channels)) {
        throw new Error("IrcWrapper:getChannel: No channel with name: " + name);
      }
      return this._getChannel(name);
    },
    _removeChannel : function (channel) {
      delete this.channels[channel.getName()];
    },
    _addChannel : function (channel) {
      this.channels[channel.getName()] = channel;
    },
    _getChannel : function (name) {
      return this.channels[name];
    },
    getPerson : function (nick) {
      if (!(nick in this.people)) {
        throw new Error("IrcWrapper:getPerson: No user with nick: " + nick);
      }
      return this._getPerson(nick);
    },
    _getPerson : function (nick) {
      return this.people[nick];
    },
    _personCreate : function (values) {
      if (this._getPerson(values.nick)) {
        var p = this._getPerson(values.nick);
        if (values.user) {
          p.setUser(values.user);
        }
        if (values.host) {
          p.setHost(values.host);
        }
        return p;
      } else {
        var p = new Person(values);
        this.people[p.getNick()] = p;
        return p;
      }
    },
    getMe : function () {
      return this.me;
    },
    _personMatchesMask : function (person, mask) {
      /^([^!]+)!([^@]+)@(.+?)$/.test(mask);
      var ps = [
        new Pair(person.getNick(), RegExp.$1),
        new Pair(person.getUser(), RegExp.$2),
        new Pair(person.getHost(), RegExp.$3)
      ];
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        var reg = new RegExp("^" + p.getSecond().replace(/\*/g, ".*") + "$");
        if (!reg.test(p.getFirst())) {
          return false;
        }
      }
      return true;
    },
    isAdmin : function (person) {
      return collection.some(this.admins, this._personMatchesMask.bind(this, person));
    },
    amsg : function (message) {
      for (var p in this.channels) if (this.channels.hasOwnProperty(p)) {
        var channel = this.channels[p];
        this.privmsg(channel.getName(), message);
      }
    },
    join : function (channel, password) {
      this.getIrc().join(channel, password);
    },
    nick : function (newNick) {
      this.getIrc().nick(newNick);
    },
    quit : function (message) {
      this.getIrc().quit(message);
    },
    privmsg : function (location, message) {
      this.getIrc().privmsg(location, message);
    }
  }
});

module.exports = IrcWrapper;
