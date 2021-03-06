const elasticsearch = require('elasticsearch');

/**
 *	The class is a **`documentation` BUNDLE** .
 *	@module App
 *	@main App
 *	@class documentation
 *	@constructor
 *	@param {class} kernel
 *	@param {class} container
 *
 */
module.exports = class documentationBundle extends nodefony.Bundle {

  constructor(name, kernel, container) {

    super(name, kernel, container);
    // load bundle library
    //this.autoLoader.loadDirectory(this.path+"/core");

    this.elasticReady = false;
    this.elastic = null;

    /*
     *	If you want kernel wait documentationBundle event <<onReady>>
     *
     *      this.waitBundleReady = true ;
     */

    if (this.settings.elasticSearch && this.settings.elasticSearch.host) {

      this.waitBundleReady = true;
      classElasticLog.prototype.logger = (pci, severity, msgid, msg) => {
        let syslog = this.container.get("syslog");
        if (!msgid) {
          msgid = "ELASTIC SEARCH ";
        }
        return syslog.logger(pci, severity, msgid, msg);
      };

      this.elastic = new elasticsearch.Client({
        host: this.settings.elasticSearch.host,
        log: classElasticLog.bind(this)
      });
      this.pingElastic((error) => {
        if (error) {
          this.logger(" elasticsearch cluster is down!", "ERROR");
          this.elasticReady = false;
          this.fire("onReady", this, this.elastic);
        } else {
          this.logger(" elasticsearch cluster is UP!", "DEBUG");
          this.elasticReady = true;
          this.fire("onReady", this, this.elastic);


          this.createIndexElastic((error /*, response*/ ) => {
            if (error) {
              return this.log(error);
            }
            this.elastic.transport.log.debug("INDEX DOCUMENTATION NODEFONY OK ");
            //this.elastic.transport.log("CREATE")
          });
        }
      });
    } else {
      //this.logger("ELASTIC SEARCH DISABLED : webcrawler search in memory !!  try to install elastic server  ", "WARNING");
    }
  }

  pingElastic(callback) {
    this.elastic.ping({
      requestTimeout: 3000,
    }, (error) => {
      callback(error);
    });
  }

  createIndexElastic(callback) {
    this.elastic.exists({
      index: 'nodefony',
      type: 'documentation',
      id: 1
    }, (error, exists) => {
      if (exists === true) {
        callback(null, exists);
      } else {
        this.elastic.create({
          index: 'nodefony',
          type: 'documentation',
          id: '1',
          body: {
            title: 'Documentation',
          }
        }, function (error, response) {
          callback(error, response);
        });
      }
    });
  }

  deleteIndexElastic(callback) {
    this.elastic.delete({
      index: 'nodefony',
      type: 'documentation',
      id: '1'
    }, function (error, response) {
      callback(error, response);
    });
  }
};

const classElasticLog = class classElasticLog {
  constructor( /*config*/ ) {
    this.logger("INIT SYSLOG ELASTIC ", "INFO");
  }

  error(data, ele) {
    let res = null;
    try {
      if (ele && ele !== "undefined") {
        try {
          let str = JSON.stringify(ele);
          res = data + " : " + str ? str : "";
        } catch (e) {
          res = data;
        }
      } else {
        res = data + " : " + JSON.stringify(ele);
      }
      return this.logger(res, "ERROR");
    } catch (e) {
      console.log(e);
    }
  }

  warning(data, ele) {
    let res = null;
    try {
      if (ele && ele !== "undefined") {
        try {
          let str = JSON.stringify(ele);
          res = data + " : " + str ? str : "";
        } catch (e) {
          res = data;
        }
      } else {
        res = data + " : " + JSON.stringify(ele);
      }
      return this.logger(res, "WARNING");
    } catch (e) {
      console.log(e);
    }
  }

  info(data, ele) {
    let res = null;
    try {
      if (ele && ele !== "undefined") {
        try {
          let str = JSON.stringify(ele);
          res = data + " : " + str ? str : "";
        } catch (e) {
          res = data;
        }
      } else {
        res = data + " : " + JSON.stringify(ele);
      }
      return this.logger(res, "INFO");
    } catch (e) {
      console.log(e);
    }
  }

  debug(data, ele) {
    let res = null;
    try {
      if (ele && ele !== "undefined") {
        try {
          let str = JSON.stringify(ele);
          res = data + " : " + str ? str : "";
        } catch (e) {
          res = data;
        }
      } else {
        res = data + " : " + JSON.stringify(ele);
      }
      return this.logger(res, "DEBUG");
    } catch (e) {
      console.log(e);
    }
  }

  trace(method, requestUrl, body /*, responseBody, responseStatus*/ ) {
    let res = null;
    try {
      let ele = {
        method: method,
        url: requestUrl,
        body: body
      };
      if (ele) {
        try {
          let str = JSON.stringify(ele);
          res = data + " : " + str ? str : "";
        } catch (e) {
          res = data;
        }
      } else {
        res = method + " : " + requestUrl;
      }
      return this.logger(res, "NOTICE");
    } catch (e) {
      console.log(e);
    }
  }
};
