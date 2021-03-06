'use strict';

const fs = require('fs');
const os = require('os');
const net = require('net');
const util = require('./util');
const {inspect} = require('util');
const EventEmitter = require('events');

const SHURIKEN_MSG_DELIMITER = '\n';

class Client extends EventEmitter {
	constructor(config) {
		super();

		this.host = config.host;
		this.port = config.port;
		this.log = config.log;

		this.buffer = "";

		this.reconnectTimer = false;
		this.initialConnection = true;

		this.socket = new net.Socket();
		this.socket.setEncoding('utf8');
		
		this.socket.on('data', this.recv.bind(this));
		
		this.socket.on('connect', this.connected.bind(this));
		this.socket.on('error', this.reconnect.bind(this));
		this.socket.on('close', this.reconnect.bind(this));
		this.socket.on('end', this.reconnect.bind(this));
	}

	connect() {
		this.socket.connect(this.port, this.host);
		
		if (this.reconnectTimer)
			return;

		console.log(`Connecting to shuriken server at ${this.host}:${this.port}..`);
	}

	connected() {
		console.log(`Connected to server successfully!`);

		if (false === this.reconnectTimer)
			return;

		clearInterval(this.reconnectTimer);
		this.reconnectTimer = false;

		this.emit('connected');
	}

	reconnect() {
		if (false !== this.reconnectTimer)
			return;

		if (this.initialConnection) {
			this.initialConnection = false;
		} else {
			console.log(`Connection to server lost, attempting to reconnect..`);
			this.emit('disconnected');
		}

		this.reconnectTimer = setInterval(this.connect.bind(this), 5000);
	}

	matchEventFilter(event, log) {
		if (!log.enabled)
			return false;

		/* Log everything if no explicit 'events' array is set. */
		if (log.events === undefined)
			return true;

		/* Ensure this event exists in the filter array. */
		return (log.events.indexOf(event) !== -1);
	}

	recv(data) {
		/* Append received data to the buffer. */
		this.buffer += data.toString();

		/* Attempt to process incoming data. */
		let delimiter = this.buffer.indexOf(SHURIKEN_MSG_DELIMITER);

		while (delimiter > -1) {
			try {
				/* Parse buffer data up to the position of the delimiter. */
				let ev = JSON.parse(this.buffer.substring(0, delimiter));

				/* For convenience, convert music data character arrays from
				   SHIFT-JIS to UTF-8 in place before emitting the event. */
				if (ev.data.music !== undefined)
					util.convertMusicInfo(ev.data.music);

				/* Handle event logging to file and/or stdout. */
				if (this.matchEventFilter(ev.event, this.log.stdout)) {
					console.log(inspect(ev, { colors: true, depth: null }));
				}

				if (this.matchEventFilter(ev.event, this.log.file)) {
					const timestamp = new Date().toISOString().split('T')[0];
					const event_json = JSON.stringify(ev, null, 4);

					fs.appendFileSync(`./logs/${timestamp}.log`, event_json + "\n");
				}

				/* Fire the event to be handled by plugins and so on. */
				this.emit(ev.event, ev.data);
			} catch (error) {
				console.log(`Network parse error: ${error}`);
			}

			/* Cuts off the processed chunk and looks for the new delimiter. */
			this.buffer = this.buffer.substring(delimiter + 1);
			delimiter = this.buffer.indexOf(SHURIKEN_MSG_DELIMITER);
		}
	}
}

module.exports = Client;