const Documentation = class Documentation {
  constructor(cli, builder) {
    this.cli = cli;
    this.type = builder.type;
    this.params = builder.params;
    this.bundleType = builder.bundleType;
    this.skeletonPath = builder.skeletonPath;
    this.name = "doc";
    this.skeletonDoc = path.resolve(this.skeletonPath, "readme.skeleton");
  }
  createBuilder() {
    return {
      name: this.name,
      type: "directory",
      childs: [{
        name: "default",
        type: "directory",
        childs: [{
          name: "readme.md",
          type: "file",
          skeleton: this.skeletonDoc,
          params: this.params
        }]
      }]
    };
  }
};

module.exports = Documentation;
