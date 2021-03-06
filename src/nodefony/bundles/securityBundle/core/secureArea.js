module.exports = nodefony.register("SecuredArea", function () {



  // context security
  const securedArea = class securedArea extends nodefony.Service {

    constructor(name, firewall) {
      super(name, firewall.container, firewall.notificationsCenter);
      this.firewall = firewall;
      this.router = this.get("router");
      this.sessionContext = "default";
      this.cors = null;
      this.pattern = /.*/;
      this.factory = null;
      this.provider = null;
      this.formLogin = null;
      this.checkLogin = null;
      this.redirect_Https = false;
      this.defaultTarget = null;
      this.alwaysUseDefaultTarget = false;
      this.stateLess = false;
      this.anonymous = false;
      this.once("onReady", () => {
        try {
          if (this.providerName in this.firewall.providers) {
            this.provider = this.firewall.providers[this.providerName].Class;
          }
          if (this.factory) {
            this.logger(" FACTORY : " + this.factory.name + " PROVIDER : " + this.provider.name + " PATTERN : " + this.pattern, "DEBUG");
          } else {
            if (this.anonymous) {
              this.setFactory("anonymous");
              if (!this.provider) {
                this.provider = this.firewall.providers.nodefony.Class;
              }
              this.logger(" FACTORY : " + this.factory.name + " PROVIDER : " + this.provider.name + " PATTERN : " + this.pattern, "DEBUG");
            }
            this.logger(" PATTERN : " + this.pattern, "DEBUG");
          }
        } catch (e) {
          this.logger(this.name + "  " + e, "ERROR");
          //throw e;
        }
      });
    }

    logger(pci, severity, msgid, msg) {
      if (!msgid) {
        msgid = "\x1b[36mCONTEXT SECURITY \x1b[31m" + this.name + " \x1b[0m";
      }
      return super.logger(pci, severity, msgid, msg);
    }

    handleCrossDomain(context) {
      let redirect = false;
      if (context.security.redirect_Https && context.protocol === "https" && context.originUrl.protocol === "http:") {
        redirect = "https";
      }
      if (context.crossDomain) {
        if (this.cors) {
          return this.cors.match(context, redirect);
        } else {
          if (redirect) {
            return null;
          }
          return 401;
        }
      }
    }

    handleError(context, e) {
      let error = null;
      switch (context.type) {
      case "HTTP":
      case "HTTPS":
      case "HTTP2":
        if (this.formLogin) {
          if (e.message) {
            this.logger(e.message, "DEBUG");
          } else {
            this.logger(e, "DEBUG");
          }
          if (e && e.status) {
            context.response.setStatusCode(e.code, e.message);
          } else {
            context.response.setStatusCode(401);
          }
          if (context.session && (context.request.url.pathname !== this.formLogin) && (context.request.url.pathname !== this.checkLogin) && (!this.alwaysUseDefaultTarget)) {
            let target_path = null;
            let area = context.session.getMetaBag("area");
            if (area && area !== this.name) {
              context.session.clearFlashBag("default_target_path");
            } else {
              target_path = context.session.getFlashBag("default_target_path");
            }
            if (!target_path) {
              context.session.setFlashBag("default_target_path", context.request.url.pathname);
            } else {
              context.session.setFlashBag("default_target_path", target_path);
            }
            context.session.setMetaBag("area", this.name);
          }
          try {
            context.resolver = this.overrideURL(context, this.formLogin);
          } catch (e) {
            error = new Error("Form Login route : " + this.formLogin + " this route not exist. Check Security config file");
            error.code =  500;
            context.fire("onError", context.container, error);
            return context;
          }
          if (!context.resolver.resolve) {
            error = new Error("Form Login route : " + this.formLogin + " this route not exist. Check Security config file");
            error.code =  500;
            context.fire("onError", context.container, error);
            return context;
          }
          if (!context.isAjax) {
            if (context.session && e.message !== "Unauthorized") {
              context.session.setFlashBag("session", {
                error: e.message
              });
            }
          } else {
            context.isJson = true;
            //context.setXjson(e);
            error = new Error(e.message);
            error.code = e.status;
            context.fire("onError", context.container, error);
            return context;
          }
          context.fire("onRequest");
          return context;
        } else {
          if (e.status) {
            error = new Error(e.message);
            error.code = e.status;
            context.fire("onError", context.container, error);
          } else {
            context.fire("onError", context.container, e);
          }
        }
        break;
      case "WEBSOCKET":
      case "WEBSOCKET SECURE":
        if (e.status) {
          error = new Error(e.message);
          error.code = e.status;
          context.fire("onError", context.container, error);
        } else {
          context.fire("onError", context.container, e);
        }
        break;
      }
      return context;
    }

    handle(context) {
      try {
        if (this.factory) {
          return this.factory.handle(context, (error, token) => {
            if (error) {
              return this.handleError(context, error);
            }
            this.token = token;
            context.session.migrate();
            let userFull = null;
            if (context.user.dataValues) {
              userFull = context.user.dataValues;
            } else {
              userFull = context.user;
            }
            delete userFull.password;
            context.session.setMetaBag("security", {
              firewall: this.name,
              user: context.user.username,
              userFull: userFull,
              factory: this.factory.name,
              tokenName: this.token.name
            });
            let target_path = context.session.getFlashBag("default_target_path");
            if (context.user.lang) {
              context.session.set("lang", context.user.lang);
            } else {
              context.session.set("lang", context.translation.defaultLocale);
            }
            let target = null;
            if (target_path) {
              target = target_path;
            } else {
              if (this.defaultTarget) {
                target = this.defaultTarget;
              }
            }
            context.resolver = this.overrideURL(context, target);
            if (context.isAjax) {
              context.isJson = true;
              return context.fire("onRequest");
            } else {
              return this.redirect(context, target);
            }
            context.fire("onRequest");
            return context;
          });
        } else {
          context.fire("onRequest");
          return context;
        }
      } catch (e) {
        return this.handleError(context, e);
      }
      return context;
    }

    // Factory
    setFactory(auth, options) {
      this.factoryName = auth;
      if (auth) {
        if (auth in nodefony.security.factory) {
          this.factory = new nodefony.security.factory[auth](this, options);
          //this.logger("FACTORY " + auth + " registered ", "DEBUG");
          return this.factory;
        } else {
          this.logger("FACTORY :" + auth + "NOT registered ", "ERROR");
          throw new Error("FACTORY :" + auth + "NOT registered ");
        }
      }
    }

    getFactory() {
      return this.factory;
    }

    setStateLess(state) {
      if (state === null) {
        return this.stateLess = true;
      }
      return this.stateLess = state || false;
    }

    setAnonymous(val) {
      if (val === null) {
        return this.anonymous = true;
      }
      return this.anonymous = val || false;
    }

    setProvider(provider, type) {
      this.providerName = provider;
      this.providerType = type;
    }

    overrideURL(context, myUrl) {
      if (myUrl) {
        context.method = "GET";
        context.request.url = url.parse(url.resolve(context.request.url, myUrl));
      }
      return this.router.resolve(context);
    }

    redirectHttps(context) {
      // no cache
      return context.redirectHttps(301, true);
    }

    redirect(context, url) {
      if (url) {
        // no cache
        return context.redirect(url, 301, true);
      }
      return context.redirect(context.request.url, 301, true);
    }

    match(context) {
      let url = context.request.url ? context.request.url.pathname : (context.request.resourceURL ? context.request.resourceURL.pathname : null);
      return this.pattern.exec(url);
    }

    setPattern(pattern) {
      this.regPartten = pattern;
      this.pattern = new RegExp(pattern);
    }

    setCors(crossSettings) {
      this.cors = this.firewall.corsManager.createCors(crossSettings);
      return this.cors;
    }

    setFormLogin(route) {
      this.formLogin = route;
    }

    setCheckLogin(route) {
      this.checkLogin = route;
    }

    setDefaultTarget(route) {
      this.defaultTarget = route;
    }

    setAlwaysUseDefaultTarget(data) {
      this.alwaysUseDefaultTarget = data;
    }

    setContextSession(context) {
      this.sessionContext = context;
    }

    setRedirectHttps(value) {
      this.redirect_Https = value ||  false;
    }
  };


  return securedArea;
});