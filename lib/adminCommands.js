Module("IrcWrapper", function (m) {
  m.adminCommands = {
    privmsg : [{
      messageRegExp : /^!nick (.+)$/i,
      callback : function (h) {
        if (!this.isAdmin(h.person)) {
          return;
        }
        this.getIrc().nick(h.regExp[1]);
      }
    }, {
      messageRegExp : /^!quit(?: (.+))?$/i,
      callback : function (h) {
        if (!this.isAdmin(h.person)) {
          return;
        }
        this.getIrc().quit(h.regExp[1] || "");
      }
    }, {
      messageRegExp : /^!join(?: ([&#]\S+))(?: (.+))?$/i,
      callback : function (h) {
        if (!this.isAdmin(h.person)) {
          return;
        }
        this.getIrc().join(h.regExp[1], h.regExp[2]);
      }
    }, {
      messageRegExp : /^!part ([&#].+)$/,
      callback : function (h) {
        if (!this.isAdmin(h.person)) {
          return;
        }
        this.getIrc().part(h.regExp[1]);
      }
    }]
  };
});
