nodefony.register.call(nodefony.context, "http", function () {

  const Http = class Http extends nodefony.Service {

    constructor(container, request, response, type) {
      super(type + " CONTEXT", container);
      this.type = type;
      this.set("context", this);
      this.kernelHttp = this.get("httpKernel");
      this.requestSettings = this.kernelHttp.bundleSettings.request;
      this.queryStringParser = this.kernelHttp.bundleSettings.queryString;
      this.isElectron = this.kernel.isElectron;
      //I18n
      this.translation = this.kernelHttp.translation.createTranslation(this);
      this.set("translation", this.translation);
      this.protocol = (type === "HTTP2") ? "2.0" : "1.1";
      this.scheme = (type === "HTTPS" || type === "HTTP2") ? "https" : "http";
      this.resolver = null;
      this.nbCallController = 0;
      this.uploadService = this.get("upload");
      this.pushAllowed = false;
      if (this.type === "HTTP2") {
        this.request = new nodefony.Request2(request, this);
        this.response = new nodefony.Response2(response, container);
      } else {
        this.request = new nodefony.Request(request, this);
        this.response = new nodefony.Response(response, container);
      }
      this.requestEnded = false;
      this.once("onRequestEnd", () => {
        this.requestEnded = true;
      });
      this.method = this.request.getMethod();
      this.isAjax = this.request.isAjax();
      this.isHtml = this.request.acceptHtml;
      this.isJson = false;
      this.setDefaultContentType();
      this.isRedirect = false;
      this.sended = false;
      this.secureArea = null;
      this.showDebugBar = true;
      this.timeoutExpired = false;
      this.domain = this.getHostName();
      this.router = this.get("router");
      this.url = url.format(this.request.url);
      this.profiling = null;
      if (this.request.url.port) {
        this.port = this.request.url.port;
      } else {
        this.port = this.scheme === "https" ? 443 : 80;
      }
      try {
        this.originUrl = url.parse(this.request.origin);
      } catch (e) {
        this.originUrl = url.parse(this.url);
      }
      this.validDomain = this.isValidDomain();
      this.crossDomain = null;
      this.logger("FROM : " + this.request.remoteAddress + " ORIGIN : " + this.originUrl.host + " URL : " + this.url, "INFO", (this.isAjax ? this.type + " REQUEST AJAX " + this.method : this.type + " REQUEST " + this.method));
      // session
      this.session = null;
      this.sessionService = this.get("sessions");
      this.sessionAutoStart = this.sessionService.sessionAutoStart;
      //parse cookies
      this.cookies = {};
      this.parseCookies();
      this.cookieSession = this.getCookieSession(this.sessionService.settings.name);
      this.security = null;
      this.user = null;
      this.remoteAddress = this.request.remoteAddress;
      this.promise = null;
      this.timeoutid = null;
      this.once("onRequest", this.handle.bind(this));
      this.once("onResponse", this.send.bind(this));
      this.once("onTimeout", () => {
        let error = new Error("Request Timeout");
        error.code = 408;
        this.fire("onError", this.container, error);
      });
      //case proxy
      this.proxy = null;
      if (request.headers["x-forwarded-for"]) {
        if (request.headers["x-forwarded-proto"]) {
          this.type = request.headers["x-forwarded-proto"].toUpperCase();
        }
        this.proxy = {
          proxyServer: request.headers["x-forwarded-server"],
          proxyProto: request.headers["x-forwarded-proto"],
          proxyPort: request.headers["x-forwarded-port"],
          proxyFor: request.headers["x-forwarded-for"],
          proxyHost: request.headers["x-forwarded-host"],
          proxyVia: request.headers.via
        };
        this.logger("PROXY REQUEST x-forwarded VIA : " + this.proxy.proxyVia, "DEBUG");
      }
      if (this.security) {
        this.crossDomain = this.isCrossDomain();
      }
    }
    /*fire(name) {
      console.log(name)
      return super.fire.apply(this, arguments);
    }*/

    getCookieSession(name) {
      if (this.cookies[name]) {
        return this.cookies[name];
      }
      return null;
    }

    isValidDomain() {
      return this.kernelHttp.isValidDomain(this);
    }

    isCrossDomain() {
      return this.kernelHttp.corsManager.isCrossDomain(this);
    }

    getRemoteAddress() {
      return this.request.getRemoteAddress();
    }

    getHost() {
      return this.request.getHost();
    }

    getHostName() {
      return this.request.getHostName();
    }

    getUserAgent() {
      return this.request.getUserAgent();
    }

    getMethod() {
      return this.request.getMethod();
    }


    flashTwig(key) {
      if (this.session) {
        return this.session.getFlashBag(key);
      }
      return null;
    }

    generateAbsoluteUrl(name, variables) {
      try {
        let host = this.request.url.protocol + "//" + this.request.url.host;
        return this.router.generatePath.call(this.router, name, variables, host);
      } catch (e) {
        throw e;
      }
    }

    controller(pattern, data) {
      let container = this.kernelHttp.container.enterScope("subRequest");
      container.set("context", this);
      container.set("translation", this.translation);
      let control = null;
      let resolver = null;
      try {
        resolver = this.router.resolveName(this, pattern);
      } catch (e) {
        return this.fire("onError", this.container, e);
      }
      if (!resolver.resolve) {
        let error = new Error(pattern);
        error.code = 404;
        return this.fire("onError", this.container, error);
      }
      try {
        control = resolver.newController(container, this); //new resolver.controller(container, this);
        if (this.type === "HTTP2") {
          control.response = new nodefony.Response2(null, container);
        } else {
          control.response = new nodefony.Response(null, container);
        }
        if (data) {
          Array.prototype.shift.call(arguments);
          for (let i = 0; i < arguments.length; i++) {
            resolver.variables.push(arguments[i]);
          }
        }
      } catch (e) {
        return this.fire("onError", this.container, e);
      }
      return {
        resolver: resolver,
        controller: control,
        response: resolver.action.apply(control, resolver.variables)
      };
    }

    render(subRequest) {
      this.removeListener("onView", subRequest.controller.response.setBody);
      this.kernelHttp.container.leaveScope(subRequest.controller.container);
      switch (true) {
      case subRequest.response instanceof nodefony.Response:
      case subRequest.response instanceof nodefony.Response2:
      case subRequest.response instanceof nodefony.wsResponse:
        return subRequest.response.body;
      case subRequest.response instanceof Promise:
      case subRequest.response instanceof BlueBird:
        if (subRequest.controller.response.body === "") {
          let txt = "nodefony TWIG function render can't resolve async Call in Twig Template ";
          this.logger(txt, "ERROR");
          return txt;
        }
        /*subRequest.response.then((result) =>{
        console.log(result)
        subRequest.controller.response.body = result ;
      });*/
        return subRequest.controller.response.body;
      case nodefony.typeOf(subRequest.response) === "object":
        if (subRequest.resolver.defaultView) {
          return this.render({
            resolver: subRequest.resolver,
            controller: subRequest.controller,
            response: subRequest.controller.render(subRequest.resolver.defaultView, subRequest.response)
          });
        } else {
          throw {
            status: 500,
            message: "default view not exist"
          };
        }
        break;
      case typeof subRequest.response === "string":
        return subRequest.response;
      default:
        this.logger("nodefony TWIG function render can't resolve async Call in Twig Template ", "WARNING");
        return this.response.body;
      }
    }

    handle(data) {
      this.setParameters("query.get", this.request.queryGet);
      if (this.request.queryPost) {
        this.setParameters("query.post", this.request.queryPost);
      }
      if (this.request.queryFile) {
        this.setParameters("query.files", this.request.queryFile);
      }
      this.setParameters("query.request", this.request.query);
      try {
        this.translation.handle();
        if (!this.resolver) {
          this.resolver = this.router.resolve(this);
        }
        //WARNING EVENT KERNEL
        this.kernel.fire("onRequest", this, this.resolver);
        if (this.resolver.resolve) {
          let ret = this.resolver.callController(data);
          // timeout response after  callController (to change timeout in action )
          if (this.response.response) {
            if (this.response.stream) {
              this.timeoutid = this.response.stream.setTimeout(this.response.timeout, () => {
                this.timeoutExpired = true;
                this.fire("onTimeout", this);
              });
              //console.log(this.timeoutid)
            } else {
              this.timeoutid = this.response.response.setTimeout(this.response.timeout, () => {
                this.timeoutExpired = true;
                this.fire("onTimeout", this);
              });
            }
          }
          return ret;
        }
        let error = new Error("");
        error.code = 404;
        throw error;
      } catch (e) {
        this.fire("onError", this.container, e);
      }
    }

    clean() {
      if (this.timeoutid !== null) {
        clearTimeout(this.timeoutid);
      }
      this.request.clean();
      this.response.clean();
      this.request = null;
      this.response = null;
      delete this.response;
      delete this.request;
      this.session = null;
      delete this.session;
      this.proxy = null;
      delete this.proxy;
      this.user = null;
      delete this.user;
      this.security = null;
      delete this.security;
      this.promise = null;
      delete this.promise;
      this.translation = null;
      delete this.translation;
      this.cookies = null;
      delete this.cookies;
      this.cookieSession = null;
      delete this.cookieSession;
      if (this.resolver) {
        this.resolver.clean();
      }
      this.resolver = null;
      delete this.resolver;
      this.kernelHttp = null;
      delete this.kernelHttp;
      this.router = null;
      delete this.router;
      this.uploadService = null;
      delete this.uploadService;
      super.clean();
    }

    getUser() {
      return this.user ||  null;
    }

    send( /*response, context*/ ) {
      if (this.sended) {
        return;
      }
      this.sended = true;
      // cookies
      this.response.setCookies();
      this.response.writeHead();
      this.fire("onSend", this.response, this);
      if (this.session) {
        this.once("onSaveSession", ( /*session*/ ) => {
          if ( !this.storage) {
            if (this.profiling) {
              this.fire("onSendMonitoring", this.response, this);
            }
            /*
             * WRITE RESPONSE
             */
            this.response.write();
            // END REQUEST
            return this.close();
          }
          this.fire("onSendMonitoring", this.response, this);
        });
        return;
      }
      if ( !this.storage) {
        if (this.profiling) {
          this.fire("onSendMonitoring", this.response, this);
        }
        this.response.write();
        // END REQUEST
        return this.close();
      }
      this.fire("onSendMonitoring", this.response, this);
    }

    flush(data, encoding) {
      return this.response.flush(data, encoding);
    }

    close() {
      this.fire("onClose", this);
      // END REQUEST
      this.response.end();
    }

    logger(pci, severity, msgid, msg) {
      if (!msgid) {
        msgid = this.type + " REQUEST";
      }
      return super.logger(pci, severity, msgid, msg);
    }

    getRequest() {
      return this.request;
    }

    getResponse() {
      return this.response;
    }

    redirect(Url, status, headers) {
      let res = null;
      if (typeof Url === "object") {
        res = this.response.redirect(url.format(Url), status, headers);
      } else {
        res = this.response.redirect(Url, status, headers);
      }
      this.isRedirect = true;
      this.send();
    }

    redirectHttps(status, headers) {
      if (this.session) {
        this.session.setFlashBag("redirect", "HTTPS");
      }
      let urlExtend = null;
      if (this.proxy) {
        urlExtend = {
          protocol: "https",
          href: "",
          host: ""
        };
      } else {
        urlExtend = {
          protocol: "https",
          port: this.kernelHttp.httpsPort || 443,
          href: "",
          host: ""
        };
      }
      let urlChange = nodefony.extend({}, this.request.url, urlExtend);
      let newUrl = url.format(urlChange);
      return this.redirect(newUrl, status, headers);
    }

    setXjson(xjson) {
      switch (nodefony.typeOf(xjson)) {
      case "object":
        this.response.setHeader("X-Json", JSON.stringify(xjson));
        return xjson;
      case "string":
        this.response.setHeader("X-Json", xjson);
        return JSON.parse(xjson);
      case "Error":
        if (typeof xjson.message === "object") {
          this.response.setHeader("X-Json", JSON.stringify(xjson.message));
          return xjson.message;
        } else {
          this.response.setHeader("X-Json", xjson.message);
          return {
            error: xjson.message
          };
        }
        break;
      }
    }

    setDefaultContentType() {
      if (this.isHtml) {
        this.response.setContentType("html", "utf-8");
      } else {
        if (this.request.accepts("json")) {
          this.isJson = true;
          this.response.setContentType("json", "utf-8");
        }
      }
    }

    addCookie(cookie) {
      if (cookie instanceof nodefony.cookies.cookie) {
        this.cookies[cookie.name] = cookie;
      } else {
        let error = new Error("addCookie cookie not valid !!");
        this.logger(cookie, "ERROR");
        throw error;
      }
    }

    parseCookies() {
      return nodefony.cookies.cookiesParser(this);
    }
  };
  return Http;
});