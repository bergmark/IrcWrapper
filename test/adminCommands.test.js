var adminCommands = require('../IrcWrapper').adminCommands;

module.exports = {
  test : function (assert) {
    var mehash = {
      nick : "menick",
      user : "meuser",
      host : "mehost"
    };
    var otherhash = {
      nick : "otherenick",
      user : "othereuser",
      host : "otherehost"
    };
    var nickAttempts = [];
    var quitAttempts = [];
    var joinAttempts = [];
    var partAttempts = [];
    IRCMock.serverListeners = [{
      raw : "nick",
      callback : function (n) {
        nickAttempts.push(n);
      }
    }, {
      raw : "quit",
      callback : function (n) {
        quitAttempts.push(n);
      }
    }, {
      raw : "join",
      callback : function (n) {
        joinAttempts.push(n);
      }
    }, {
      raw : "part",
      callback : function (n) {
        partAttempts.push(n);
      }
    }];
    var iw = new IrcWrapper({
      IRC : IRCMock,
      server : "my.server",
      nicks : [mehash.nick],
      joinChannels : ["#chan"],
      admins : ["menick!meuser@mehost"],
      bindings : adminCommands
    });
    var irc = iw.getIrc();
    irc.sendJoin("#chan", mehash);

    // !nick
    irc.sendPrivmsg("#chan", "!nick foo", mehash);
    assert.eql(2, nickAttempts.length);
    assert.eql("foo", nickAttempts[1].newNick);

    // !quit msg
    irc.sendPrivmsg("#chan", "!quit baz", mehash);
    assert.eql(1, quitAttempts.length);
    assert.eql("baz", quitAttempts[0].message);

    // !quit
    irc.sendPrivmsg("#chan", "!quit", mehash);
    assert.eql(2, quitAttempts.length);
    assert.eql("", quitAttempts[1].message);

    // !join #chan
    irc.sendPrivmsg("#chan", "!join #baz", mehash);
    assert.eql(1, joinAttempts.length);
    assert.eql("#baz", joinAttempts[0].location);
    assert.eql("", joinAttempts[0].password);
    // !join &chan
    irc.sendPrivmsg("#chan", "!join &baz", mehash);
    assert.eql(2, joinAttempts.length);
    assert.eql("&baz", joinAttempts[1].location);
    // !join chan pass
    irc.sendPrivmsg("#chan", "!join #bax mypass", mehash);
    assert.eql(3, joinAttempts.length);
    assert.eql("#bax", joinAttempts[2].location);
    assert.eql("mypass", joinAttempts[2].password);

    // !part chan
    irc.sendPrivmsg("#chan", "!part #foo", mehash);
    assert.eql(1, partAttempts.length);
    assert.eql("#foo", partAttempts[0].location);

    // Limit to admins.
    irc.sendPrivmsg("#chan", "!part #foo", otherhash);
    assert.eql(1, partAttempts.length);
  }
};
