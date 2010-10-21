require('../IrcWrapper');
module.exports = {
  "event binding test" : function (assert) {
    var person = {
      nick : 'thenick',
      user : 'theuser',
      host : 'thehost'
    };

    var triggers = 0;
    var msg3Msg = null;
    var fooTestHash = null;
    var locationHash = null;
    var hashes = {};
      var iw = new IrcWrapper({
        IRC : IRCMock,
        server : "irc.vassius.se",
        nicks : ["mediabot2"],
        joinChannels : ["#c-test"],
        bindings : {
          privmsg : [{
            messageString : "msg",
            callback : function (h) {
              triggers++;
              assert.eql("msg", h.message);
              assert.eql("#chan", h.location);
            }
          }, {
            messageString : "msg3",
            callback : function (h) {
              msg3Msg = h.message;
            }
          }, {
            messageRegExp : /(foo)/,
            callback : function (h) {
              fooTestHash = h;
            }
          }, {
            location : "#chan2",
            callback : function (h) {
              locationHash = h;
            }
          }, {
            location : "#chanx",
            messageString : "msgx",
            messageRegExp : /msgx/,
            callback : function (h) {
              hashes.x = h;
            }
          }],
          join : [{
            channel : "#joinchan",
            callback : function (h) {
              hashes.join = h;
            }
          }]
        }
      });

    // Match message.
    var irc = iw.getIrc();
    irc.sendPrivmsg("#chan", "msg", person);
    assert.eql(1, triggers);
    irc.sendPrivmsg("#chan", "msg2", person);
    assert.eql(1, triggers);

    assert.eql(null, msg3Msg);
    irc.sendPrivmsg("#chan", "msg3", person);
    assert.eql("msg3", msg3Msg);

    // Match message with regex.
    assert.eql(null, fooTestHash);
    irc.sendPrivmsg("#chan", "foo", person);
    assert.eql("foo", fooTestHash.message);
    irc.sendPrivmsg("#chan", "bar foo baz", person);
    assert.eql("bar foo baz", fooTestHash.message);
    assert.eql("foo", fooTestHash.regExp[1]);
    assert.ok(!(2 in fooTestHash.regExp));

    // Match with location.
    assert.isNull(locationHash);
    irc.sendPrivmsg("#chan2", "some msg", person);
    assert.eql("#chan2", locationHash.location);
    assert.eql("some msg", locationHash.message);

    assert.isUndefined(hashes.x);
    irc.sendPrivmsg("#chanx", "msgx msgx msgx", person); // messageString not matching
    assert.isUndefined(hashes.x);
    irc.sendPrivmsg("#chanxx", "msgx", person); // location not matching
    assert.isUndefined(hashes.x);
    irc.sendPrivmsg("#chanx", "msgx", person);
    assert.isDefined(hashes.x);

    // Listen for joins.
    irc.sendJoin("#joinchan", person);
    assert.isDefined(hashes.join);
    assert.eql("#joinchan", hashes.join.location);

    // Listen for arbitrary raws.
    assert.isUndefined(hashes.arbitrary);
    var triggered = false;
    iw._addListener("arbitrary", function () {
      triggered = true;
    });
    irc.sendRaw("arbitrary");
    assert.ok(triggered);

    // Listen for parts.
    var hash = null;
    iw._onpart({
      channel : "#partchan",
      callback : function (h) {
        hash = h;
      }
    });
    irc.sendJoin("#partchan", person);
    irc.sendPart("#partchan", person);
    assert.eql("#partchan", hash.location);
  },
  "admin privileges" : function (assert) {
    var mehash = {
      nick : "menick",
      user : "meuser",
      host : "mehost"
    };
    var admin2 = {
      nick : "admin2nick",
      user : "admin2user",
      host : "admin2host"
    };
    var otherhash = {
      nick : 'other',
      user : 'otheruser',
      host : 'otherhost'
    };
    var iw = new IrcWrapper({
      IRC : IRCMock,
      server : "my.server",
      nicks : [mehash.nick],
      joinChannels : ["#chan"],
      admins : ["menick!meuser@mehost"]
    });
    var irc = iw.getIrc();
    irc.sendJoin("#chan", mehash);
    irc.sendJoin("#chan", otherhash);
    var me = iw.getPerson(mehash.nick);
    assert.ok(iw.isAdmin(me));
    //assert.ok(!iw.isAdmin(iw.getPerson(otherhash.nick)));

    // Shall be able to use wildcards.
    assert.ok(iw._personMatchesMask(me, "menick!*@*"));
    assert.ok(iw._personMatchesMask(me, "*!meuser@*"));
    assert.ok(iw._personMatchesMask(me, "*!*@mehost"));
    assert.ok(iw._personMatchesMask(me, "*en*!*@*"));
    assert.ok(!iw._personMatchesMask(me, "*aoeu*!*@*"));
    assert.ok(!iw._personMatchesMask(me, "*ne*!*@*"));
    assert.ok(iw._personMatchesMask(me, "me*!me*@*host"));
  },
  "Channel management test" : function (assert) {
    var mehash = {
      nick : 'me',
      user : 'meuser',
      host : 'mehost'
    };
    var otherhash = {
      nick : 'other',
      user : 'otheruser',
      host : 'otherhost'
    };

    var iw = new IrcWrapper({
      IRC : IRCMock,
      server : "my.server",
      nicks : [mehash.nick],
      joinChannels : ["#my-join-chan"]
    });
    var irc = iw.getIrc();
    irc.send001(mehash.nick);

    // Join a channel and assert that IrcWrapper knows about it.
    irc.sendJoin("#my-join-chan", mehash);
    var chan = iw.getChannel('#my-join-chan');
    assert.eql("#my-join-chan", chan.getName());
    irc.sendJoin("#my-join-chan", otherhash);
    // Don't create several instances.
    assert.strictEqual(chan, iw.getChannel('#my-join-chan'));

    // Store users in channels.
    var chan = iw.getChannel('#my-join-chan');
    assert.eql(2, chan.getPeopleCount());
    assert.isNotNull(chan.getPeople()[0]);
    var me = iw.getPerson('me');
    var other = iw.getPerson('other');
    assert.ok(me !== other);
    irc.sendJoin('#chan2', mehash);
    var chan2 = iw.getChannel('#chan2');
    assert.ok(iw.getChannel('#chan2').hasPerson(me));
    assert.strictEqual(me, iw.getPerson('me'));
    assert.eql(2, iw.getPerson('me').getChannelCount());
    assert.ok(me.isInChannel(chan2));
    assert.ok(chan2.hasPerson(me));
    assert.ok(!other.isInChannel(chan2));
    assert.ok(!chan2.hasPerson(other));

    irc.sendPart('#my-join-chan', other);
    assert.ok(!chan.hasPerson(other));
    assert.ok(!other.isInChannel(chan));

    // Me.
    assert.ok(me === iw.getMe());
    // make sure user and host is set.
    assert.eql(mehash.user, iw.getMe().getUser());
    assert.eql(mehash.host, iw.getMe().getHost());

    // Don't keep channels on part.
    irc.sendJoin('#partchan', mehash);
    iw.getChannel('#partchan');
    irc.sendPart('#partchan', mehash);
    assert.throws(iw.getChannel.bind(iw, '#partchan'));

    // Remove users on part.
    irc.sendJoin('#partchan', mehash);
    irc.sendJoin('#partchan', otherhash);
    assert.ok(iw.getChannel('#partchan').hasPerson(other));
    irc.sendPart('#partchan', otherhash);
    assert.ok(!iw.getChannel('#partchan').hasPerson(other));

    // Remove users on quit.
    irc.sendJoin('#quitchan', mehash);
    irc.sendJoin('#quitchan', otherhash);
    assert.ok(iw.getChannel('#quitchan').hasPerson(other));
    irc.sendQuit(otherhash);
    assert.ok(!iw.getChannel('#quitchan').hasPerson(other));

    irc.sendNick(mehash, 'newnick');
    assert.eql('newnick', iw.getMe().getNick());

    // Client quit should not trigger Quit event.
    var quitTriggered = false;
    iw._onquit({
      callback : function () {
        quitTriggered = true;
      }
    });
    var clientQuitTriggered = false;
    iw._onclientquit({
      callback : function () {
        assert.strictEqual(iw, this);
        clientQuitTriggered = true;
      }
    });
    irc.sendClientQuit(mehash);
    assert.ok(!quitTriggered);
    assert.ok(clientQuitTriggered);

    // Events should be called in the scope of the IrcWrapper.
    iw._onjoin({
      callback : function () {
        assert.ok(iw === this);
      }
    });
    irc.sendJoin("#foo", mehash);
    // And for dynamically attached raws (no _onx method).
    iw._addListener("001", function () {
      assert.ok(iw === this);
    });
    irc.send001(mehash.nick);
  },
  "several on connect nicks" : function (assert) {
    var nickAttempts = [];
    IRCMock.serverListeners = [{
      raw : "nick",
      callback : function (n) {
        nickAttempts.push(n);
      }
    }];
    var iw = new IrcWrapper({
      IRC : IRCMock,
      server : "my.server",
      nicks : ["nick1", "nick2", "nick3"],
      joinChannels : ["#chan"]
    });
    var irc = iw.getIrc();
    irc.sendRaw("433", "my.server", "nick1");
    irc.sendRaw("433", "my.server", "nick2");
    irc.send001("nick3");
    assert.eql("nick1", nickAttempts[0].newNick);
    assert.eql("nick2", nickAttempts[1].newNick);
    assert.eql(3, nickAttempts.length);
    assert.eql("nick3", iw.getMe().getNick());

    // Fail to connect (not enough nicks).
    nickAttempts = [];
    var quitAttempt = null;
    IRCMock.serverListeners = [{
      raw : "nick",
      callback : function (n) {
        nickAttempts.push(n);
      }
    }, {
      raw : "quit",
      callback : function (n) {
        quitAttempt = n;
      }
    }];
    iw = new IrcWrapper({
      IRC : IRCMock,
      server : "my.server",
      nicks : ["nick1"],
      joinChannels : ["#chan"]
    });
    irc = iw.getIrc();
    irc.sendRaw("433", "my.server", "nick1");
    assert.ok(quitAttempt !== null);
  },
  "amsg command" : function (assert) {
    var mehash = {
      nick : 'me',
      user : 'meuser',
      host : 'mehost'
    };
    var privmsgAttempts = [];
    IRCMock.serverListeners = [{
      raw : "privmsg",
      callback : function (n) {
        privmsgAttempts.push(n);
      }
    }];
    var iw = new IrcWrapper({
      IRC : IRCMock,
      server : "my.server",
      nicks : [mehash.nick],
      joinChannels : ["#chan"]
    });
    var irc = iw.getIrc();
    irc.sendJoin("#chan1", mehash);
    irc.sendJoin("#chan2", mehash);
    iw.amsg("my amsg");
    assert.eql(2, privmsgAttempts.length);
    assert.eql("my amsg", privmsgAttempts[0].message);
    assert.eql("my amsg", privmsgAttempts[1].message);
    assert.eql("#chan1,#chan2", [privmsgAttempts[0].location, privmsgAttempts[1].location].sort().join(","));
  },
  "IRC proxy methods" : function (assert) {
    var iw = new IrcWrapper({
      IRC : IRCMock,
      server : "my.server",
      nicks : ["menick"],
      joinChannels : ["#chan"]
    });
    assert.ok(iw.join instanceof Function);
    assert.ok(iw.nick instanceof Function);
    assert.ok(iw.quit instanceof Function);
    assert.ok(iw.privmsg instanceof Function);
  }
};
