'use strict';

const fs = require('fs');
const path = require('path');
const {promisify} = require('util');

const util = require('./util');
const shuriken = require('./client');

const lstatAsync = promisify(fs.lstat);
const existsAsync = promisify(fs.exists);
const readdirAsync = promisify(fs.readdir);

/* Print more detailed errors on unhandled Promise rejection. */
process.on('unhandledRejection', console.error);

/* The global object which is made available to all plugins. */
let Ameto = { data: {}, config: {}, plugins: {} };

Ameto.init = async callback => {
	/* Parse the main files required for basic operation. */
	try {
		let config_filename = process.cwd() + path.sep + 'config.json';
		let musicdata_filename = process.cwd() + path.sep + 'data' + path.sep + 'music.json';
		
		console.log(`Reading configuration file '${config_filename}'..`);
		console.log(`Reading music data file '${config_filename}'..`);

		Ameto.config = require(config_filename);
		Ameto.data.music = require(musicdata_filename);
	} catch (error) {
		return util.fatal(`Failed to read core files. (${error})`);
	}

	/* Initialise the client instance. */
	if ('shuriken' in Ameto.config)
		Ameto.client = new shuriken(Ameto.config.shuriken);
	else
		return util.fatal('No server information in configuration file.');

	/* Iterate and initialise plugins. */
	let plugins = [];
	let basedir = process.cwd() + path.sep + 'plugins';

	try {
		plugins = await readdirAsync(basedir);

		if (plugins.length === 0)
			return util.fatal('No usable plugins found.');
	} catch (error) {
		return util.fatal(`Failed to read directory. (${basedir})`);
	}
	
	/* Enumerate each folder found in the plugins directory. */
	for (var i = plugins.length - 1; i >= 0; i--) {
		let plugin = null, config = null;
		let plugindir = basedir + path.sep + plugins[i];

		/* First ensure we're looking at a directory, then include the plugin
		   entry point file. */
		try {
			if (!(await lstatAsync(plugindir)).isDirectory())
				continue;

			plugin = require(plugindir + path.sep + 'plugin.js');
		} catch (error) {
			return util.fatal(
				`Failed to load plugin '${plugins[i]}'. (${error.message})`
			);
		}

		/* Attempt to include the plugin configuration, defaulting to an empty
		   object if the file does not exist or could not be read. */
		try {
			config = require(plugindir + path.sep + 'config.json');
		} catch (error) { /* Fall back to default config for this plugin.. */ }

		try {
			/* If there was no configuration file in the plugin directory then
			   we attempt to fallback to the main configuration file here. */
			let instance = new plugin();
			
			if (!config && Ameto.config.plugins[instance.name] !== undefined)
				config = Ameto.config.plugins[instance.name];
			
			instance.config = config || {};

			if (instance.register !== undefined)
				await instance.register();

			Ameto.plugins[instance.name] = instance;

			console.log(`Registered plugin '${instance.name}' successfully!`);
		} catch (error) {
			return util.fatal(
				`Failed to register plugin '${plugins[i]}'. (${error.message})`
			);
		}
	}

	return callback();
};

module.exports = Ameto;