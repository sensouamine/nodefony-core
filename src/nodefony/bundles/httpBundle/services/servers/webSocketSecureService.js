/*
 * New node file
 */


//var WebSocketServer = require('websocket');
//var nodedomain = require('domain');

module.exports = nodefony.registerService("websocketSecure", function(){

	// https://github.com/Worlize/WebSocket-Node/wiki/Documentation

	var websocket = class websocket extends nodefony.Service {

		constructor ( httpKernel, security, options ){

			super( "SERVER WEBSOCKET SECURE", httpKernel.container, httpKernel.notificationsCenter , options  );

			this.httpKernel = httpKernel;
			this.port = this.httpKernel.kernel.httpsPort ;
			this.domain = this.httpKernel.kernel.settings.system.domain ;
			this.firewall =  security ;
			this.ready = false ;
			this.type = "WEBSOCKET SECURE";
		}

		createServer (http/*, settings*/){

			this.bundle.listen(this, "onServersReady", function(type){
				if ( type === "HTTPS"){
					try {
						this.settings = this.getParameters("bundles.http").websocketSecure || {} ;

						this.websocketServer =  new WebSocketServer.server(nodefony.extend({}, this.settings, {
							httpServer: http
						}));

						this.websocketServer.on('request', (request) => {
							return this.httpKernel.onWebsocketRequest(request, this.type);
						});

						this.listen(this, "onTerminate", () =>{
							if ( this.websocketServer && this.ready ){
								this.websocketServer.shutDown();
								this.logger(" SHUTDOWN WEBSOCKET SECURE Server is listening on DOMAIN : "+this.domain+"    PORT : "+this.port , "INFO");
							}
						});

						if ( this.websocketServer ){
							this.ready = true ;
							this.logger(" Server  is listening on DOMAIN : wss://"+this.domain+":"+this.port , "INFO");
						}
						this.bundle.fire("onServersReady", this.type, this);
						return this.websocketServer;
					}catch(e){
						this.logger(e);
						throw e ;
					}
				}
			});
		}
	};
	return websocket;
});
