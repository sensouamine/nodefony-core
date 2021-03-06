module.exports = class mongoBundle extends nodefony.Bundle {

  constructor(name, kernel, container) {

    // Mother Class constructor
    super(name, kernel, container);

    // Load core bundle library
    this.autoLoader.loadDirectory(path.resolve(this.path, "src"));

    /*
     *	If you want kernel wait mongoBundle event <<onReady>>
     *
     *      this.waitBundleReady = true ;
     */
    this.waitBundleReady = true;
    let service = this.get("mongoose");
    service.listen(this, "onOrmReady", () => {
      this.fire("onReady", this, service);
    });

  }
};