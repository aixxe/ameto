'use strict';

const fs = require('fs').promises;
const path = require('path');
const mkdirp = require('mkdirp');
const {promisify} = require('util');
const puppeteer = require('puppeteer');

const mkdirpAsync = promisify(mkdirp);

const ASSETS_BASEDIR = path.resolve(__dirname, 'assets');

class Scorecard {
	constructor() {
		this.name = "scorecard";
		this.author = "aixxe";
	}

	async generate(style, data, output, quality = 100) {
		/* Read the contents of the template HTML file once. */
		let basedir = path.resolve(ASSETS_BASEDIR, style);

		this.template = await fs.readFile(
			path.resolve(basedir, 'template.html'), 'utf8'
		);

		/* Generate a temporary file with the script placeholder replaced with
		   the actual score data. Allows us to use the 'load' event later. */
		let cardfile = path.resolve(basedir, Date.now() + '.html');
		let scoredata = JSON.stringify(data);

		let script = `let scoredata = ${scoredata}; setup(scoredata);`;
		
		await fs.writeFile(cardfile,
			this.template.replace('/* @script */', script), 'utf8');

		await mkdirpAsync(path.dirname(output));
		
		/* Start a new instance of Chromium. We're disabling the sandbox stuff
		   since we only load local files from disk and some Linux kernels don't
		   have these features enabled by default. */
		let browser = await puppeteer.launch({args: [
			'--no-sandbox', '--disable-setuid-sandbox'
		]});

		let page = await browser.newPage();

		/* Load the temporary scorecard HTML and take a screenshot. */
		await page.goto('file://'+ cardfile, {waitUntil: 'load'});

		/* Retrieve desired image width and height from attributes applied to
		   'body' element in the template file. */
		const width = parseInt(await page.evaluate(() =>
			document.querySelector('body').getAttribute('width')));
		
		const height = parseInt(await page.evaluate(() =>
			document.querySelector('body').getAttribute('height')));
		
		await page.setViewport({
			width: (!isNaN(width) && width > 0) ? width: 512,
			height: (!isNaN(height) && height > 0) ? height: 512,
		});

		await page.screenshot({
			path: output,
			quality: (quality === 100) ? undefined: quality,
			omitBackground: true
		});

		/* Remove the temporary scorecard HTML file and close the browser. */
		await fs.unlink(cardfile);
		await browser.close();

		return true;
	}
}

module.exports = Scorecard;