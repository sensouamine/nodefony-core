/*
 *	Token Basic
 */

nodefony.register.call(nodefony.security.tokens, "Basic", function () {

    const settingsBasic = {
        realm: "user@",
    };

    const parseAuthorization = function (str) {
        let ret = str.replace(/Basic /g, "");
        ret = ret.replace(/"/g, "");
        ret = ret.replace(/ /g, "");
        ret = new Buffer(ret, 'base64').toString('ascii');
        let res = ret.split(":");
        if (res && res.length === 2) {
            this.username = res[0];
            return {
                username: res[0],
                passwd: res[1]
            };
        }
        return null;
    };

    const Basic = class Basic {

        constructor(request, response, options) {
            this.name = "Basic";
            this.settings = nodefony.extend({}, settingsBasic, options);
            this.auth = false;
            this.authorization = request.headers.authorization || (request.query ? request.query.authorization : null);
            this.host = request.headers.host;
            this.secret = this.host + ":" + request.headers["user-agent"] + ":" + (request.headers.referer || request.remoteAddress);
            this.request = request;
            this.response = response;
            this.method = request.method;
        }

        generateResponse() {
            let line = "";
            let obj = {
                realm: this.settings.realm, //+this.host,
            };
            let length = Object.keys(obj).length - 1;
            for (let ele in obj) {
                if (length) {
                    line += ele + "=" + obj[ele] + ",";
                } else {
                    line += ele + "=" + obj[ele];
                }
                length -= 1;
            }
            //return  '"'+new Buffer(line).toString('base64')+'"';
            return this.name + ' ' + line;
        }

        checkResponse(getUserPassword, callback) {
            let ret = parseAuthorization.call(this, this.authorization);
            if (!ret) {
                callback({
                    status: 401,
                    message: "BAD Basic Response "
                }, null);
            }
            try {
                getUserPassword(ret.username, (error, userHashToCompare) => {
                    if (userHashToCompare === ret.passwd) {
                        this.auth = true;
                        callback(null, true);
                    } else {
                        callback({
                            status: 401,
                            message: "BAD Basic Response "
                        }, null);
                    }

                });
            } catch (e) {
                callback(e, null);
            }
        }

        generatePasswd(realm, username, passwd) {
            return username + ":" + passwd;
        }
    };

    return Basic;

});
