/*
 *
 *
 *
 */

module.exports = nodefony.registerCommand("Sequelize", function () {

  const sequelizeCmd = class sequelizeCmd extends nodefony.cliKernel {

    constructor(container, command, options) {

      super("Sequelize", container, container.get("notificationsCenter"), options);

      let cmd = command[0].split(":");
      let args = command[1];
      this.ormService = this.container.get("sequelize");
      switch (cmd[1]) {
      case "generate":
        switch (cmd[2]) {
        case "entities":
          var force = false;
          if (args[0] === "force") {
            force = true;
          }
          var tab = [];

          this.ormService.listen(this, "onReadyConnection", (connectionName, connection /*, service*/ ) => {
            this.logger("DATABASE  : " + connection.options.dialect + " CONNECTION : " + connectionName, "INFO");

            tab.push(new Promise((resolve, reject) => {
              this.logger("DATABASE SYNC : " + connectionName);
              switch (connection.options.dialect) {
              case "sqlite":
                connection.sync({
                  force: force,
                  logging: this.logger,
                  hooks: true
                }).then((db) => {
                  this.logger("DATABASE :" + db.config.database + " CONNECTION : " + connectionName + " CREATE ALL TABLES", "INFO");
                  resolve(connectionName);
                }).catch((error) => {
                  this.logger("DATABASE :" + connection.config.database + " CONNECTION : " + connectionName + " : " + error, "ERROR");
                  reject(error);
                });
                break;
              case "mysql":
                connection.query('SET FOREIGN_KEY_CHECKS = 0', null, {
                    raw: true
                  })
                  .then(() => {
                    connection.sync({
                      force: force,
                      logging: this.logger,
                      hooks: true
                    }).then((db) => {
                      this.logger("DATABASE :" + db.config.database + " CONNECTION : " + connectionName + " CREATE ALL TABLES", "INFO");
                      resolve(connectionName);
                    }).catch((error) => {
                      this.logger("DATABASE :" + connection.config.database + " CONNECTION : " + connectionName + " : " + error, "ERROR");
                      reject(error);
                    });
                  });
                break;
              }
            }));
          });
          this.ormService.listen(this, "onOrmReady", ( /*service*/ ) => {
            Promise.all(tab)
              .catch((e) => {
                this.logger(e, "ERROR");
                this.terminate(1);
              })
              .done(() => {
                this.terminate(0);
              });
          });
          break;
        }
        break;
      case "fixtures":
        switch (cmd[2]) {
        case 'load':
          this.ormService.listen(this, "onOrmReady", (service) => {
            let bundles = this.ormService.kernel.bundles;
            this.tabPromise = [];
            for (let bundle in bundles) {
              let fixtures = bundles[bundle].getFixtures();
              if (Object.keys(fixtures).length) {
                for (let fixture in fixtures) {
                  if (fixtures[fixture].type === "sequelize") {
                    this.logger("LOAD FIXTURES BUNDLE : " + bundles[bundle].name, "INFO");
                    service.getConnection(fixtures[fixture].connection);
                    service.getEntity(fixtures[fixture].entity);
                    var entityName = fixtures[fixture].entity;
                    var connectionName = fixtures[fixture].connection;
                    this.logger("LOAD FIXTURE ENTITY : " + entityName + " CONNECTIONS : " + connectionName, "INFO");
                    var toPush = fixtures[fixture].fixture.bind(this.ormService);
                    this.tabPromise.push(toPush);
                  }
                }
              }
            }
          });
          this.kernel.listen(this, "onPostReady", ( /*service*/ ) => {

            let actions = this.tabPromise.map(function (ele) {
              return new Promise(ele);
            });

            Promise.all(actions)
              .catch((e) => {
                this.logger(e, "ERROR");
                this.terminate(1);
              })
              .then(() => {
                this.logger("LOAD FIXTURE ENTITY :  SUCCESS");
                this.terminate(0);
              })
              .done(() => {
                this.terminate(1);
              });
          });
          break;
        default:
          this.showHelp();
        }
        break;
      case "query":
        this.ormService.listen(this, "onOrmReady", function ( /*service*/ ) {
          switch (cmd[2]) {
          case "sql":
            var db = args[0];
            var conn = this.ormService.getConnection(db);
            if (!conn) {
              this.logger("CONNECTION : " + db + " NOT FOUND", "ERROR");
              this.terminate(1);
              return;
            }
            var sql = args[1];
            this.logger("CONNECTION : " + db + " \nEXECUTE REQUEST  : " + sql, "INFO");
            conn.query(sql)
              .catch((error) => {
                this.logger(error, "ERROR");
                this.terminate(1);
              })
              .then((result) => {
                //console.log(result[0])
                var ele = JSON.stringify(result);
                console.log(ele);
              })
              .done(() => {
                this.terminate();
              });
            break;
          default:
            this.showHelp();
            this.terminate();
          }
        });
        break;
      case "entity":
        this.ormService.listen(this, "onOrmReady", function ( /*service*/ ) {
          switch (cmd[2]) {
          case "findAll":
            var entity = args[0];
            var conn = this.ormService.getEntity(entity);
            if (!conn) {
              this.logger("ENTITY : " + entity + " NOT FOUND", "ERROR");
              this.terminate(1);
              return;
            }
            this.logger("ENTITY :" + entity + " \nEXECUTE findAll   ", "INFO");
            conn.findAll()
              .catch((error) => {
                this.logger(error, "ERROR");
                this.terminate(1);
              })
              .then((result) => {
                //var attribute = result[0].$options.attributes ;
                var ele = JSON.stringify(result);
                console.log(ele);
              })
              .done(() => {
                this.terminate(0);
              });
            break;
          default:
            this.showHelp();
            this.terminate(0);
          }
        });
        break;
      default:
        this.showHelp();
        this.terminate(0);
      }
    }
  };

  return {
    name: "Sequelize",
    commands: {
      fixtures: ["Sequelize:fixtures:load", "Load data fixtures to your database"],
      //fixture:["Sequelize:fixture:load bundleName:fixtureName" ,"Load a specific data fixture to your database"],
      //entity:["Sequelize:generate:entity connectionName entityName" ,"Generate an Entity"],
      //entity2:["Sequelize:generate:bundleEntity bundleName:entityName" ,"Generate Bundle Entity"],
      entities: ["Sequelize:generate:entities [force]", "Generate All Entities force to delete table if exist  example : nodefony Sequelize:generate:entities force "],
      //create:["Sequelize:database:create" ,"Create a database"],
      //show:["Sequelize:entity:show" ,"show  Entities"],
      sql: ["Sequelize:query:sql connectionName SQL", "query sql in database connection  example : nodefony  Sequelize:query:sql nodefony  'select * from users'"],
      entity: ["Sequelize:entity:findAll entity ", "query findAll ENTITY"]
    },
    cli: sequelizeCmd
  };
});