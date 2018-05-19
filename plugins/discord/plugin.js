'use strict';

const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const discordjs = require('discord.js');

const lib = require('./includes/util');

const unlinkAsync = promisify(fs.unlink);

class Discord {
	constructor() {
		this.name = "discord";
		this.author = "aixxe";
	}

	async register() {
		this.p1_score = null;
		this.p2_score = null;

		this.client = new discordjs.Client({autoReconnect: true});
		await this.client.login(this.config.client.token);

		Ameto.client.on('score', this.score.bind(this));
		Ameto.client.on('music', this.music.bind(this));
		Ameto.client.on('state', this.state.bind(this));
		Ameto.client.on('keypad', this.keypad.bind(this));
		Ameto.client.on('card.out', this.cardout.bind(this));
	}

	/* Fired when a score is received from the server. The score data is kept in
	   memory until it is submitted or overwritten by another score. */
	score(data) {
		if (data.players.p1)
			this.p1_score = {
				music: data.music, player: data.players.p1, timestamp: data.timestamp
			};
		
		if (data.players.p2)
			this.p2_score = {
				music: data.music, player: data.players.p2, timestamp: data.timestamp
			};
	}

	/* Set Discord game to the currently playing song using the 'LISTENING'
	   activity. Shows up as "Listening to: [music title]" in the user list. */
	music(data) {
		this.client.user.setPresence({
			game: { name: data.music.title, type: 'LISTENING' }
		});
	}

	/* Reset Discord presence text when state changes to 'idle'. */
	state(data) {
		if (data.state === 'idle')
			this.client.user.setPresence({game: null});
	}

	/* Post the previously saved score when 9 is pressed on the keypad. */
	keypad(data) {
		if (data.state[(this.config.client.hotkey || "0")] !== true)
			return;

		if (data.player === 0 && this.p1_score !== null) {
			this.submitAll(this.p1_score);
			this.p1_score = null;
		}

		if (data.player === 1 && this.p2_score !== null) {
			this.submitAll(this.p2_score);
			this.p2_score = null;
		}
	}

	cardout() {
		/* Clear previously saved scores. This prevents unintentional posting
		   of a score from a previous session. */
		this.p1_score = null;
		this.p2_score = null;
	}

	submitAll(data) {
		for (let i = this.config.client.channels.length - 1; i >= 0; i--) {
			let channel = this.config.client.channels[i];
			this.submit(channel.id, data);
		}
	}

	generateEmbed(data) {
		/* Construct the base embed information. */
		let embed = {
			"fields": [],
			"footer": {
				"text": "beatmania IIDX",
				"icon_url": "https://i.imgur.com/MRxcf6i.png"
			},
			"author": {
				"icon_url": "https://i.imgur.com/fD9oUz8.png"
			},
		};

		/* Shorthand variables for convenience. */
		let player = data.player;

		/* Main header text is set to the players DJ name and class. */
		embed.author.name = `dj ${player.dj_name}`;

		let classes = [];
		
		if (player.sp.class !== -1)
			classes.push(`SP ${lib.getClassText(player.sp.class)}`);

		if (player.dp.class !== -1)
			classes.push(`DP ${lib.getClassText(player.dp.class)}`);

		if (classes.length !== 0)
			embed.author.name = `${embed.author.name} — ${classes.join(' ／ ')}`;

		/* Show music title just below the player information. */
		embed.title = `${data.music.artist} - ${data.music.title}`;

		let bpm = player.chart.bpm_min;

		if (bpm != player.chart.bpm_max)
			bpm = `${player.chart.bpm_min} ~ ${player.chart.bpm_max}`;

		embed.description = `${player.chart.notes} NOTES, ${bpm} BPM`;
		
		/* Play style, chart difficulty and numeric rating. */
		let style = player.chart.play_style == 1 ? 'SP': 'DP';
		let difficulty = player.chart.difficulty.toUpperCase();
		let rating = player.chart.rating;
		
		embed.fields.push({
			"name": "PLAY STYLE",
			"value":  `${style} ${difficulty} ${rating}`,
			"inline": true
		});

		/* Current and best EX scores. */
		let ex_score_text = `${player.score.ex_score}`;

		if (player.score.ex_score != player.score.best_ex_score && player.score.best_ex_score !== 0) {
			let ex_score_improved = (player.score.ex_score > player.score.best_ex_score) ? '▴': '▾';
			let ex_score_difference = player.score.ex_score - player.score.best_ex_score;
			
			if (ex_score_difference > 0)
				ex_score_difference = `+${ex_score_difference}`;

			ex_score_text = `${player.score.best_ex_score} ${ex_score_improved} **${ex_score_text}** (${ex_score_difference})`;
		}
		
		embed.fields.push({
			"name": "EX SCORE",
			"value": ex_score_text,
			"inline": true
		});

		/* DJ level -- displayed as the letter grade, current percentage, and
		   percentage increased or decreased compared to best score. */
		let grade_letter_current = lib.getDJLevelString(player.score.dj_level);
		let grade_percentage_current = lib.getPercentage(
			player.score.ex_score, player.chart.notes
		);

		let dj_level_text = `${grade_letter_current}`;

		if (player.score.best_dj_level) {
			let grade_letter_best = lib.getDJLevelString(player.score.best_dj_level);
			let grade_percentage_diff = (
				((player.score.ex_score / (player.chart.notes * 2)) * 100) -
				((player.score.best_ex_score / (player.chart.notes * 2)) * 100)
			).toFixed(2);

			if (grade_letter_best != grade_letter_current) {
				let grade_improved = player.score.ex_score > player.score.best_ex_score ? '▴': '▾';
				dj_level_text = `${grade_letter_best} ${grade_improved} **${dj_level_text}**`;
			}

			if (grade_percentage_diff > 0)
				grade_percentage_diff = `+${grade_percentage_diff}`;

			dj_level_text = `${dj_level_text} (**${grade_percentage_current}**, ${grade_percentage_diff}%)`;
		} else {
			dj_level_text = `${dj_level_text} (**${grade_percentage_current}**)`;
		}
		
		embed.fields.push({
			"name": "DJ LEVEL",
			"value": dj_level_text,
			"inline": true
		});

		/* Get clear type string and embed color. */
		let clear_type = lib.clear_type_str(player.score.clear_type);
		let best_clear_type = player.score.best_clear_type !== undefined ?
			lib.clear_type_str(player.score.best_clear_type): null;

		embed.color = parseInt('0x' + clear_type.color);

		let clear_type_text = clear_type.text;
		let clear_type_improved = lib.isClearImprovement(
			player.score.clear_type, player.score.best_clear_type
		) ? '▴': '▾';
		
		if (best_clear_type && best_clear_type.text != clear_type.text)
			clear_type_text = `${best_clear_type.text} ${clear_type_improved} **${clear_type_text}**`;
		
		embed.fields.push({
			"name": "CLEAR TYPE",
			"value": clear_type_text,
			"inline": true
		});

		/* Maximum combo. */
		embed.fields.push({
			"name": "MAX COMBO",
			"value": player.score.max_combo,
			"inline": true
		});

		/* Miss count. */
		let miss_count_text = player.score.miss_count;
		if (player.score.miss_count != -1) {
			if (player.score.best_miss_count != -1 && player.score.best_miss_count != player.score.miss_count) {
				let miss_count_improved = (player.score.miss_count < player.score.best_miss_count) ? '▴': '▾';
				miss_count_text = `${player.score.best_miss_count} ${miss_count_improved} **${miss_count_text}**`;
			}

			embed.fields.push({"name": "MISS COUNT", "value": miss_count_text, "inline": true});
		}

		/* Combo break. */
		if (player.score.combo_break > 0) {
			embed.fields.push({
				"name": "COMBO BREAK",
				"value": player.score.combo_break,
				"inline": true
			});
		}

		/* Judgement counts ordered from best to worst. */
		embed.fields.push({
			"name": "JUDGEMENT",
			"value": [
				player.score.judgement.pgreat, player.score.judgement.great,
				player.score.judgement.good, player.score.judgement.bad,
				player.score.judgement.poor].join(' / '),
			"inline": true
		});

		/* Fast & slow counts. */
		embed.fields.push({
			"name": "TIMING",
			"value": `${player.score.timing.fast} FAST, ${player.score.timing.slow} SLOW`,
			"inline": true
		});

		/* "Dead" information -- only displayed if the chart was failed before
		   the end. (e.g. early quit or gauge depletion) */
		if (clear_type_text === "FAILED" && player.score.dead) {
			embed.fields.push({
				"name": "DEAD",
				"value": `MEASURE ${player.score.dead.measure}, NOTE ${player.score.dead.note}`,
				"inline": true
			});
		}

		/* Ranking data -- only present when using an e-AMUSEMENT PASS. May also
		   require enabling the rival options under "My Theme" on Arcana. */
		if (player.score.ranking !== undefined) {
			let ranking = player.score.ranking;
			let rival_ranking_text = `—`, shop_ranking_text = `—`;

			/* These can only go up. */
			if (ranking.rival_old !== undefined && ranking.rival_new !== undefined)
				if (ranking.rival_old !== ranking.rival_new)
					rival_ranking_text = `#${ranking.rival_old} ▴ **#${ranking.rival_new}**`;
				else if (ranking.rival_old === ranking.rival_new)
					rival_ranking_text = `**#${ranking.rival_new}**`;

			if (ranking.shop_old !== undefined && ranking.shop_new !== undefined)
				if (ranking.shop_old === -1 && ranking.shop_new !== -1)
					/* New play -- there's no old rank so just show the new. */
					shop_ranking_text = `**#${ranking.shop_new}**`;
				else if (ranking.shop_old !== -1 && ranking.shop_old !== ranking.shop_new)
					/* Shop rank improved. */
					shop_ranking_text = `#${ranking.shop_old} ▴ **#${ranking.shop_new}**`;
				else if (ranking.shop_old === ranking.shop_new)
					/* No change. */
					shop_ranking_text = `**#${ranking.shop_new}**`;

			embed.fields.push({
				"name": "RANKING",
				"value": `RIVAL: ${rival_ranking_text}, SHOP: ${shop_ranking_text}`,
				"inline": false
			});
		}

		/* List of known active modifiers. */
		if (player.score.modifiers && player.score.modifiers.length !== 0) {
			embed.fields.push({
				"name": "MODIFIERS",
				"value": player.score.modifiers.join(', '),
				"inline": false
			});
		}
		
		/* Append the score timestamp. */
		embed.timestamp = new Date(data.timestamp * 1000).toISOString();

		return new discordjs.RichEmbed(embed);
	}

	async submit(channel_id, data) {
		/* Ensure the target channel is valid. */
		let channel = this.client.channels.get(channel_id);

		if (!channel)
			return console.error(`Failed to find channel '${channel}'.`);

		/* Create a rich embed using the provided score data. */
		let message = this.generateEmbed(data);
		
		if (Ameto.plugins.scorecard !== undefined) {
			/* Store the image in the configured folder relative to the process
			   working directory, then attach it to the rich embed. */
			try {
				let style = this.config.scorecard.style;

				var cardimg = path.resolve(
					this.config.scorecard.output + path.sep + Date.now() + '.png'
				);

				await Ameto.plugins.scorecard.generate(style, data, cardimg);

				/* If 'scorecard_only' is defined, scrap all the current embed
				   data and only send the image. */
				if (this.config.embed.scorecard_only === true)
					message = new discordjs.Attachment(cardimg);
				else
					message.attachFile(cardimg);
			} catch (error) {
				console.error(`Failed to generate scorecard image. (${error})`);
			}
		}

		/* Finally, send the embed to the target channel. */
		await channel.send(message);

		if (cardimg !== undefined && this.config.scorecard.persistent !== true)
			await unlinkAsync(cardimg);
	}
}

module.exports = Discord;