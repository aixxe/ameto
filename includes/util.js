'use strict';

const fs = require('fs');
const jconv = require('jconv');

let util = {};

/* Helper function to throw a 'fatal error' and exit the program. */
util.fatal = text => {
	return console.error(`Error: ${text}`) && process.exit(1);
}

/* Converts music info encoding from Shift-JIS to UTF-8. Also performs a lookup
   in the music data object to fix bad titles. */
util.convertMusicInfo = (data) => {
	let id = data.entry_id;

	let title = Buffer.from(data.title);
	let artist = Buffer.from(data.artist);
	let genre = Buffer.from(data.genre);

	title = jconv.convert(title, 'SJIS', 'UTF8');
	artist = jconv.convert(artist, 'SJIS', 'UTF8');
	genre = jconv.convert(genre, 'SJIS', 'UTF8');

	data.title = title.toString('utf8');
	data.artist = artist.toString('utf8');
	data.genre = genre.toString('utf8');

	if (Ameto.data.music[id] !== undefined) {
		const override_data = Ameto.data.music[id];

		Object.keys(override_data).forEach(key => {
			data[key] = override_data[key];
		});
	}
}

module.exports = util;