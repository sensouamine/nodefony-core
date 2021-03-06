const Table = require('cli-table');
const asciify = require('asciify');
const inquirer = require('inquirer');
const commander = require('commander');

module.exports = nodefony.register("cli", function () {

  //const red   = clc.red.bold;
  //const cyan   = clc.cyan.bold;
  const blue = clc.blueBright.bold;
  const green = clc.green;
  //const yellow = clc.yellow.bold;
  const magenta = clc.magenta.bold;
  const reset = clc.reset; // '\x1b[0m';

  let processName = null;
  if (process.argv && process.argv[1]) {
    processName = path.basename(process.argv[1]);
  } else {
    processName =  process.title || "nodefony";
  }
  //const processName = path.basename (process.argv[1] ) || process.argv[1] || process.title ;

  const defaultTableCli = {
    style: {
      head: ['cyan'],
      border: ['grey']
    }
  };


  const defaultOptions = {
    processName: processName,
    autostart: true,
    asciify: true,
    clear: true,
    color: blue,
    commander: true,
    signals: true,
    autoLogger: true,
    resize: false,
    version: null,
    pid: false,
    promiseRejection: true
  };

  const CLI = class CLI extends nodefony.Service {

    constructor(name, container, notificationsCenter, options) {
      switch (arguments.length) {
      case 0:
        options = nodefony.extend({}, defaultOptions);
        name = options.processName;
        super(options.processName, null, null, options);
        break;
      case 1:
        if (typeof name === "object" && name !== null) {
          options = nodefony.extend({}, defaultOptions, name);
          name = options.processName;
          super(options.processName, null, null, options);
        } else {
          options = nodefony.extend({}, defaultOptions);
          name = name || options.processName;
          super(name, null, null, options);
        }
        break;
      case 2:
        if (container instanceof nodefony.Container) {
          options = nodefony.extend({}, defaultOptions);
          name = name || options.processName;
          super(name, container, null, options);
        } else {
          if (typeof container === "object" && container !== null) {
            options = nodefony.extend({}, defaultOptions, container);
            name = name || options.processName;
            super(name, null, null, options);
          } else {
            options = nodefony.extend({}, defaultOptions);
            name = name || options.processName;
            super(name, container, null, options);
          }
        }
        break;
      default:
        options = nodefony.extend({}, defaultOptions, options);
        name = name || options.processName;
        super(name, container, notificationsCenter, options);
      }
      process.title = this.name.replace(new RegExp("\\s", "gi"), "").toLowerCase();
      this.environment = process.env.NODE_ENV || "production";
      process.env.NODE_ENV = this.environment;
      this.unhandledRejections = new Map();
      this.pid = "";
      if (this.options.pid) {
        this.setPid();
      }
      this.wrapperLog = console.log;
      this.timers = {};
      if (this.options.autoLogger) {
        this.listenSyslog();
      }
      this.initUi();
      this.initCommander();

      /**
       *  @signals
       */
      if (this.options.signals) {
        process.on('SIGINT', () => {
          this.blankLine();
          this.wrapperLog = console.log;
          this.logger("SIGINT", "CRITIC");
          //this.clear();
          this.fire("onSignal", "SIGINT", this);
          this.terminate(0);
        });
        process.on('SIGTERM', () => {
          this.blankLine();
          this.wrapperLog = console.log;
          this.logger("SIGTERM", "CRITIC");
          this.fire("onSignal", "SIGTERM", this);
          this.terminate(0);
        });
        process.on('SIGHUP', () => {
          this.blankLine();
          this.wrapperLog = console.log;
          this.logger("SIGHUP", "CRITIC");
          this.fire("onSignal", "SIGHUP", this);
          this.terminate(0);
        });
        process.on('SIGQUIT', () => {
          this.blankLine();
          this.wrapperLog = console.log;
          this.logger("SIGQUIT", "CRITIC");
          //this.clear();
          this.fire("onSignal", "SIGQUIT", this);
          this.terminate(0);
        });
        process.on('uncaughtException', (err) => {
          this.logger(err, "CRITIC");
        });
      }
      /**
       *  @promiseRejection
       */
      if (this.options.promiseRejection) {
        this.listenRejection();
      }
      /**
       *    ASCIIFY
       */
      if (name && this.options.asciify) {
        this.asciify("      " + name, {
          font: this.options.font || "standard"
        }, (err, data) => {
          if (this.options.clear) {
            this.clear();
          }
          let color = this.options.color ||  blue;
          console.log(color(data));
          let version = this.commander ? this.commander.version() : (this.options.version || "1.0.1");
          if (this.options.version) {
            console.log("          Version : " + blue(version) + " Platform : " + green(process.platform) + " Process : " + green(process.title) + " PID : " + process.pid + "\n");
          }
          if (this.environment !== "production") {
            //console.log( this.logEnv() )
          }
          this.blankLine();
          if (err) {
            throw err;
          }
          if (this.options.autostart) {
            this.fire("onStart", this);
          }
        });
      } else {
        if (this.options.autostart) {
          this.fire("onStart", this);
        }
      }
    }

    listenRejection() {
      process.on('rejectionHandled', (promise) => {
        this.logger("PROMISE REJECTION EVENT ", "CRITIC");
        this.unhandledRejections.delete(promise);
      });
      process.on('unhandledRejection', (reason, promise) => {
        this.logger("WARNING  !!! PROMISE CHAIN BREAKING : " + reason, "WARNING");
        console.trace(promise);
        this.unhandledRejections.set(promise, reason);
      });
    }

    setPid() {
      this.pid = process.pid;
    }

    logEnv() {
      return blue("      \x1b " + this.name) + " NODE_ENV : " + magenta(this.environment);
    }

    initCommander() {
      if (this.options.commander) {
        this.commander = commander;
        if (this.options.version) {
          this.setCommandVersion(this.options.version);
        }
        this.on("onStart", () => {
          //this.commander.parse(process.argv);
        });
      }
    }

    initUi() {
      this.clc = clc;
      this.inquirer = inquirer;
      this.clui = require("clui");
      this.emoji = require("node-emoji");
      this.spinner = null;
      this.blankLine = function () {
        var myLine = new this.clui.Line().fill();
        return () => {
          myLine.output();
        };
      }.call(this);
      if (this.options.resize) {
        this.resize();
      }
    }

    getFonts() {
      asciify.getFonts((err, fonts) => {
        fonts.forEach(this.logger);
      });
    }

    listenSyslog(options) {
      let defaultOption = {
        severity: {
          operator: "<=",
          data: "7"
        }
      };
      return this.syslog.listenWithConditions(this, options || defaultOption, (pdu) => {
        return this.normalizeLog(pdu);
      });
    }

    asciify(txt, options, callback) {
      return asciify(txt, nodefony.extend({
        font: 'standard'
      }, options), callback);
    }

    parseCommand() {
      return this.commander.parse(process.argv);
    }
    setCommandOption(option, description, callback) {
      return this.commander.option(option, description, callback);
    }
    setCommandVersion(version) {
      if (typeof this.commander.version === "function") {
        return this.commander.version(version);
      }
    }
    setCommand(command, description, options) {
      return this.commander.command(command, description, options);
    }
    showHelp(quit, callback) {
      if (quit) {
        return this.commander.help(callback);
      }
      return this.commander.outputHelp(callback);
    }

    createProgress(size) {
      return new this.clui.Progress(size);
    }

    createSparkline(values, suffix) {
      if (values) {
        try {
          return this.clui.Sparkline(values, suffix || "");
        } catch (e) {
          this.logger(e, "ERROR");
          throw e;
        }
      }
    }

    getSpinner(message, design) {
      var countdown = new this.clui.Spinner(message, design || null);
      return countdown;
    }

    startSpinner(message, design) {
      this.spinner = new this.clui.Spinner(message, design ||  null);
      this.wrapperLog = this.spinner.message;
      this.spinner.start();
      return this.spinner;
    }
    stopSpinner( /*message, options*/ ) {
      this.spinner.stop();
      this.wrapperLog = console.log;
      delete this.spinner;
    }

    normalizeLog(pdu) {
      let date = new Date(pdu.timeStamp);
      if (pdu.payload === "" || pdu.payload === undefined) {
        console.error(date.toDateString() + " " + date.toLocaleTimeString() + " " + nodefony.Service.logSeverity(pdu.severityName) + " " + green(pdu.msgid) + " " + " : " + "logger message empty !!!!");
        console.trace(pdu);
        return;
      }
      let message = pdu.payload;
      switch (typeof message) {
      case "object":
        switch (true) {
          default: message = util.inspect(message);
        }
        break;
      default:
      }
      if (!this.wrapperLog) {
        this.wrapperLog = console.log;
      }
      return this.wrapperLog(this.pid + " " + date.toDateString() + " " + date.toLocaleTimeString() + " " + nodefony.Service.logSeverity(pdu.severityName) + " " + green(pdu.msgid) + " " + " : " + message);
    }

    displayTable(datas, options, syslog) {
      let table = new Table(options || defaultTableCli);
      if (datas) {
        for (var i = 0; i < datas.length; i++) {
          table.push(datas[i]);
        }
        if (syslog) {
          syslog.logger("\n" + table.toString());
        } else {
          console.log(table.toString());
        }
      }
      return table;
    }

    static niceBytes(x) {
      let units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        n = parseInt(x, 10) || 0,
        l = 0;
      while (n >= 1024) {
        n = n / 1024;
        l++;
      }
      return (n.toFixed(n >= 10 || l < 1 ? 0 : 1) + ' ' + units[l]);
    }

    getEmoji(name) {
      if (name) {
        return this.emoji.get(name);
      }
      return this.emoji.random().emoji;
    }

    clear() {
      this.clui.Clear();
    }

    reset() {
      process.stdout.write(reset);
    }

    resize() {
      process.stdout.on('resize', () => {
        this.fire("onResize", this);
      });
    }

    terminate(code) {
      process.exit(code);
    }

    quit(code) {
      process.exit(code);
    }

    startTimer(name) {
      if (name in this.timers) {
        throw new Error("Timer : " + name + " already exist !! stopTimer to clear");
      }
      try {
        this.logger("BEGIN TIMER : " + name, "INFO");
        this.timers[name] = name;
        return console.time(name);
      } catch (e) {
        if (name in this.timers) {
          delete this.timers[name];
        }
        throw e;
      }
    }

    stopTimer(name) {
      if (!name) {
        for (let timer in this.timers) {
          this.stopTimer(this.timers[timer]);
        }
      }
      try {
        if (name in this.timers) {
          this.logger("END TIMER : " + name, "INFO");
          delete this.timers[name];
          return console.timeEnd(name);
        }
        throw new Error("Timer : " + name + " not exist !! startTimer before");
      } catch (e) {
        if (name in this.timers) {
          delete this.timers[name];
        }
        throw e;
      }
    }
  };
  nodefony.niceBytes = CLI.niceBytes;
  return CLI;
});
