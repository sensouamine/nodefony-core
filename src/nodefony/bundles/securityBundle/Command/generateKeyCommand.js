module.exports = nodefony.registerCommand("encoders", function () {

  const encoders = class encoders extends nodefony.cliKernel {

    constructor(container, command, options) {

      super("encoders", container, container.get("notificationsCenter"), options);

      let cmd = command[0].split(":");
      let args = command[1];
      var realm = null;
      switch (cmd[1]) {
      case "Digest":
        if (args[0] && args[1] && args[2]) {
          var security = this.container.get("security");
          var context = args[0];
          if (!security.securedAreas[context]) {
            this.logger("firewall " + context + " not exits", "ERROR");
            this.terminate(1);
            return;
          }
          var user = args[1];
          var passwd = args[2];
          if (args[3]) {
            realm = args[3];
          } else {
            realm = security.securedAreas[context].factory.settings.realm; //  //this.container.getParameters("kernel").system.domain+":"+this.container.getParameters("kernel").system.httpsPort;
          }
          this.logger("FIREWALL = " + security.securedAreas[context].name);
          this.logger("Authentification = " + security.securedAreas[context].factory.name);
          this.logger("REALM = " + security.securedAreas[context].factory.settings.realm);
          this.logger("HASH GENERATE = " + security.securedAreas[context].factory.generatePasswd(realm, user, passwd));
        } else {
          this.logger(new Error("encoders:MD5 must have login password arguments"), "ERROR");
        }
        break;
      }
      this.terminate(0);
    }
  };

  return {
    name: "encoders",
    commands: {
      md5: ["encoders:Digest firewall login password [realm]", "Generate encoding keys digest MD5 Example : nodefony encoders:Digest secured_area login password"],
    },
    cli: encoders
  };
});
