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
    assert.eql(2, irc.getReceivedLog("nick").length);
    assert.eql("foo", irc.getReceivedLog("nick")[1].newNick);

    // !quit msg
    irc.sendPrivmsg("#chan", "!quit baz", mehash);
    assert.eql(1, irc.getReceivedLog("quit").length);
    assert.eql("baz", irc.getReceivedLog("quit")[0].message);

    // !quit
    irc.sendPrivmsg("#chan", "!quit", mehash);
    assert.eql(2, irc.getReceivedLog("quit").length);
    assert.eql("", irc.getReceivedLog("quit")[1].message);

    // !join #chan
    irc.sendPrivmsg("#chan", "!join #baz", mehash);
    assert.eql(1, irc.getReceivedLog("join").length);
    assert.eql("#baz", irc.getReceivedLog("join")[0].location);
    assert.eql("", irc.getReceivedLog("join")[0].password);
    // !join &chan
    irc.sendPrivmsg("#chan", "!join &baz", mehash);
    assert.eql(2, irc.getReceivedLog("join").length);
    assert.eql("&baz", irc.getReceivedLog("join")[1].location);
    // !join chan pass
    irc.sendPrivmsg("#chan", "!join #bax mypass", mehash);
    assert.eql(3, irc.getReceivedLog("join").length);
    assert.eql("#bax", irc.getReceivedLog("join")[2].location);
    assert.eql("mypass", irc.getReceivedLog("join")[2].password);

    // !part chan
    irc.sendPrivmsg("#chan", "!part #foo", mehash);
    assert.eql(1, irc.getReceivedLog("part").length);
    assert.eql("#foo", irc.getReceivedLog("part")[0].location);

    // Limit to admins.
    irc.sendPrivmsg("#chan", "!part #foo", otherhash);
    assert.eql(1, irc.getReceivedLog("part").length);
  }
};
