/*
 *	PASSPORT ldapauth  FACTORY
 */
try {
    var passport = require('passport');
    var LdapStrategy = require('passport-ldapauth');
    var nodefonyPassport = require("passport-nodefony");
} catch (e) {
    this.logger(e);
}

nodefony.register.call(nodefony.security.factory, "passport-ldapauth", function () {

    const defaultWrapper = function () {
        return {
            username: '',
            name: '',
            surname: '',
            email: '',
            password: this.generatePassWd(),
            provider: "ldap",
            roles: "USER",
            displayName: '',
            url: '',
            image: ''
        };
    };


    const ISDefined = function (ele) {
        if (ele !== null && ele !== undefined) {
            return true;
        }
        return false;
    };

    const parseParameterString = function (str, value) {
        let ns = null;
        switch (nodefony.typeOf(str)) {
        case "string":
            return parseParameterString.call(this, str.split("."), value);
        case "array":
            switch (str.length) {
            case 1:
                ns = Array.prototype.shift.call(str);
                if (!this[ns]) {
                    this[ns] = value;
                } else {
                    if (ISDefined(value)) {
                        this[ns] = value;
                    } else {
                        return this[ns];
                    }
                }
                return value;
            default:
                ns = Array.prototype.shift.call(str);
                if (!this[ns] && ISDefined(value)) {
                    this[ns] = {};
                }
                return parseParameterString.call(this[ns], str, value);
            }
            break;
        default:
            return false;
        }
    };

    const Factory = class Factory {

        constructor(contextSecurity, settings) {
            this.name = this.getKey();
            this.contextSecurity = contextSecurity;
            this.settings = settings;

            this.passport = passport;

            this.passport.framework(nodefonyPassport(this));

            this.strategy = this.getStrategy(this.settings);

            this.passport.use(this.strategy);

            this.contextSecurity.container.get("kernel").listen(this, "onReady", function () {
                this.orm = this.contextSecurity.container.get("sequelize");
                this.User = this.orm.getEntity("user");
                this.connection = this.orm.getConnection("nodefony");
            });

            this.profileWrapper = this.settings.profile_wrapper;
        }

        wrapperLdap(profile) {

            let obj = {};
            for (let name in this.profileWrapper) {
                let res = parseParameterString.call({
                    profile: profile
                }, this.profileWrapper[name], null);
                if (res) {
                    obj[name] = res;
                } else {
                    obj[name] = "";
                }
            }
            return nodefony.extend(defaultWrapper.call(this), obj);
        }

        getStrategy(options) {

            return new LdapStrategy(options, (profile, done) => {
                this.contextSecurity.logger("TRY AUTHORISATION " + this.name + " : " + profile.uid, "DEBUG");
                let obj = null;
                if (profile) {
                    this.contextSecurity.logger("PROFILE AUTHORISATION " + this.name + " : " + profile.displayName, "DEBUG");
                    obj = this.wrapperLdap(profile);
                } else {
                    return done(new Error("Profile Ldap error"), null);
                }

                if (obj) {
                    this.User.findOrCreate({
                        where: {
                            username: obj.username
                        },
                        defaults: obj
                    }).then(function (user) {
                        if (nodefony.typeOf(user) === "array") {
                            done(null, user[0]);
                        } else {
                            done(null, user);
                        }
                    }).catch(function (e) {
                        done(e, null);
                    });
                    return;
                }
                done(new Error("Profile Ldap error"), null);
            });
        }

        generatePassWd() {
            //var date = new Date().getTime();
            let buf = crypto.randomBytes(256);
            let hash = crypto.createHash('md5');
            return hash.update(buf).digest("hex");
        }

        getKey() {
            return "passport-ldapauth";
        }

        getPosition() {
            return "http";
        }

        handle(context, callback) {
            this.contextSecurity.logger("HANDLE AUTHORISATION  " + this.getKey(), "DEBUG");
            return this.passport.authenticate('ldapauth', {
                session: false
            })(context, (error, res) => {
                if (error) {
                    return callback(error, null);
                }
                if (res) {
                    context.user = res;
                    this.contextSecurity.logger("AUTHORISATION " + this.name + " SUCCESSFULLY : " + res.username, "INFO");
                }
                let token = {
                    name: "ldap",
                    user: res
                };
                return callback(error, token);
            });
        }

        generatePasswd( /*realm, user, passwd*/ ) {}
    };
    return Factory;
});
