const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  entry: {
    bundle: "./js/effects/three-particles.js",
  },
  devtool: "source-map",
  output: {
    filename: "three-particles.js",
    path: path.resolve(__dirname, "build"),
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
};
