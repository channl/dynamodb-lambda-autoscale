var path = require("path");
var webpack = require("webpack");
var StatsPlugin = require("stats-webpack-plugin");
var ContextReplacementPlugin = require("webpack/lib/ContextReplacementPlugin");

module.exports = function(options) {
	var entry = { 'index': './src/Index.js' };

  var loaders = [
    { test: /\.jsx$/, loader: options.hotComponents ? ["react-hot-loader", "babel-loader?stage=0"] : "babel-loader?stage=0"},
    { test: /\.js$/, loader: "babel-loader", include: path.join(__dirname, "src")},
    { test: /\.json$/, loader: 'json-loader' },
    { test: /\.md|markdown$/, loader: 'markdown-loader'}
  ];

	var alias = {};
	var aliasLoader = {};
	var externals = [
		{ 'aws-sdk': 'commonjs aws-sdk' },   // This is already available on the lambda server
		{ 'winston': 'commonjs winston' }    // Winston looks for its own package.json
  ];
	var modulesDirectories = ['node_modules', 'web_modules'];
	var extensions = ["", ".web.js", ".js", ".jsx", ".json"];
	var root = __dirname;

	var publicPath = options.devServer ?
			"http://localhost:2992/assets/" :
			"/assets/";

	var output = {
		path: path.join(__dirname, "dist"),
		publicPath,
		filename: "[name].js",
		chunkFilename: options.devServer ? "[id].js" : "[name].js",
		sourceMapFilename: "debugging/[file].map",
		pathinfo: options.debug,
		libraryTarget: 'umd'
	};

	var excludeFromStats = [
		/node_modules[\\\/]react(-router)?[\\\/]/,
		/node_modules[\\\/]items-store[\\\/]/
	];

	var plugins = [
    new StatsPlugin(path.join(__dirname, "build", "stats.json"), {
  		chunkModules: true,
  		exclude: excludeFromStats
  	}),
		new ContextReplacementPlugin(/moment\.js[\/\\]lang$/, /^\.\/(de|pl)$/)
	];

	if(options.minimize) {
		plugins.push(
			new webpack.optimize.UglifyJsPlugin({
				compressor: {
					warnings: false
				}
			}),
			new webpack.optimize.DedupePlugin()
		);
		plugins.push(
			new webpack.DefinePlugin({
				"process.env": {
					NODE_ENV: JSON.stringify("production")
				}
			}),
			new webpack.NoErrorsPlugin()
		);
	}

	return {
		entry: entry,
		output: output,
		target: 'node',
		module: { loaders: loaders },
		devtool: options.devtool,
		debug: options.debug,
		resolveLoader: {
			root: path.join(__dirname, "node_modules"),
			alias: aliasLoader
		},
		externals: externals,
		resolve: {
			root: root,
			modulesDirectories: modulesDirectories,
			extensions: extensions,
			alias: alias
		},
		plugins: plugins,
		devServer: {
			stats: {
				cached: false,
				exclude: excludeFromStats
			}
		}
	};
};
