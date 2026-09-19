const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: "./add-in/src/index.tsx",
  output: {
    path: path.resolve(__dirname, "add-in"),
    filename: "taskpane.js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  plugins: [new MiniCssExtractPlugin({ filename: "taskpane.css" })],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: { configFile: "tsconfig.taskpane.json" },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
    ],
  },
  devtool: "source-map",
  performance: { hints: false },
};
