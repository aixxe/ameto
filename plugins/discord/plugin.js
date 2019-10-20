'use strict';

const fs = require('fs').promises;
const path = require('path');
const discordjs = require('discord.js');

const lib = require('./includes/util');

class Discord {
	constructor() {
		this.name = "discord";
		this.author = "aixxe";
	}

	async register() {
		this.p1_score = null;
		this.p2_score = null;

		this.connect();

		Ameto.client.on('score', this.score.bind(this));
		Ameto.client.on('keypad', this.keypad.bind(this));
		Ameto.client.on('card.out', this.cardout.bind(this));

		if (this.config.presence.enabled === true) {
			Ameto.client.on('music', this.music.bind(this));
			Ameto.client.on('state', this.state.bind(this));
		}
	}

	async connect() {
		if (this.client) {
			console.log('Reconnecting to Discord..');
		} else {
			this.client = new discordjs.Client({autoReconnect: true});
			this.client.on('error', this.connect.bind(this));
		}

		try {
			await this.client.login(this.config.client.token);
		} catch (error) {
			console.log('Failed to connect to Discord, retrying in 30 seconds..');
			return setTimeout(this.connect.bind(this), 30000);
		}
	}

	/* Fired when a score is received from the server. The score data is kept in
	   memory until it is submitted or overwritten by another score. */
	score(data) {
		if (!data.players)
			return;
		
		if (data.players.p1 !== undefined)
			this.p1_score = {
				music: data.music, player: data.players.p1, timestamp: data.timestamp
			};
		
		if (data.players.p2 !== undefined)
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
		if (data.state[(this.config.hotkeys.submit || "0")] !== true)
			return;

		if (data.player === 0 && this.p1_score !== null) {
			this.submit(this.p1_score);
			this.p1_score = null;
		}

		if (data.player === 1 && this.p2_score !== null) {
			this.submit(this.p2_score);
			this.p2_score = null;
		}
	}

	cardout() {
		/* Clear previously saved scores. This prevents unintentional posting
		   of a score from a previous session. */
		this.p1_score = null;
		this.p2_score = null;
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
		let parts = this.config.rich_embed.fields;

		/* Main header text is set to the players DJ name and class. */
		embed.author.name = `dj ${player.dj_name}`;

		let classes = [];
		
		if (parts.sp_class === true && player.sp.class !== -1)
			classes.push(`SP ${lib.getClassText(player.sp.class)}`);

		if (parts.dp_class === true && player.dp.class !== -1)
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
		
		if (parts.play_style === true)
			embed.fields.push({"name": "PLAY STYLE", "value":  `${style} ${difficulty} ${rating}`, "inline": true});

		/* Current and best EX scores. */
		let ex_score_text = `${player.score.ex_score}`;

		if (player.score.ex_score != player.score.best_ex_score && player.score.best_ex_score !== 0) {
			let ex_score_improved = (player.score.ex_score > player.score.best_ex_score) ? '▴': '▾';
			let ex_score_difference = player.score.ex_score - player.score.best_ex_score;
			
			if (ex_score_difference > 0)
				ex_score_difference = `+${ex_score_difference}`;

			ex_score_text = `${player.score.best_ex_score} ${ex_score_improved} **${ex_score_text}** (${ex_score_difference})`;
		}
		
		if (parts.ex_score === true)
			embed.fields.push({"name": "EX SCORE", "value": ex_score_text, "inline": true});

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
		
		if (parts.dj_level === true)
			embed.fields.push({"name": "DJ LEVEL", "value": dj_level_text, "inline": true});

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
		
		if (parts.clear_type === true)
			embed.fields.push({"name": "CLEAR TYPE", "value": clear_type_text, "inline": true});

		/* Maximum combo. */
		if (parts.max_combo === true)
			embed.fields.push({"name": "MAX COMBO", "value": player.score.max_combo, "inline": true});

		/* Miss count. */
		let miss_count_text = player.score.miss_count;
		
		if (parts.miss_count === true && player.score.miss_count != -1) {
			if (player.score.best_miss_count != -1 && player.score.best_miss_count != player.score.miss_count) {
				let miss_count_improved = (player.score.miss_count < player.score.best_miss_count) ? '▴': '▾';
				miss_count_text = `${player.score.best_miss_count} ${miss_count_improved} **${miss_count_text}**`;
			}

			embed.fields.push({"name": "MISS COUNT", "value": miss_count_text, "inline": true});
		}

		/* Combo break. */
		if (parts.combo_break === true && player.score.combo_break > 0)
			embed.fields.push({"name": "COMBO BREAK", "value": player.score.combo_break, "inline": true});

		/* Judgement counts ordered from best to worst. */
		if (parts.judgement === true)
			embed.fields.push({
				"name": "JUDGEMENT",
				"value": [ player.score.judgement.pgreat, player.score.judgement.great, player.score.judgement.good,
						   player.score.judgement.bad, player.score.judgement.poor ].join(' / '),
				"inline": true
			});

		/* Fast & slow counts. */
		if (parts.timing === true)
			embed.fields.push({
				"name": "TIMING",
				"value": `${player.score.timing.fast} FAST, ${player.score.timing.slow} SLOW`,
				"inline": true
			});

		/* "Dead" information -- only displayed if the chart was failed before
		   the end. (e.g. early quit or gauge depletion) */
		if (parts.dead === true && clear_type_text === "FAILED" && player.score.dead) {
			embed.fields.push({
				"name": "DEAD",
				"value": `MEASURE ${player.score.dead.measure}, NOTE ${player.score.dead.note}`,
				"inline": true
			});
		}

		/* Ranking data -- only present when using an e-AMUSEMENT PASS. May also
		   require enabling the rival options under "My Theme" on Arcana. */
		if (parts.ranking === true && player.score.ranking !== undefined) {
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

		/* Rival ranking information -- displays a list of your rivals and their
		   scores relative to your best. (does not show clear types yet..) */
		if (parts.rivals === true && player.score.rivals !== null) {
			let rival_text = '';

			for (let i = 0; i < player.score.rivals.length; i++) {
				let rival = player.score.rivals[i];
				let position = `${i + 1}.`;

				if (rival.dj_name !== player.dj_name) {
					let arrow = (rival.ex_score > player.score.ex_score) ? '▴': '▾';
					let score = `${rival.ex_score - player.score.ex_score}`;

					if (score >= 0)
						score = `+${score}`;

					rival_text += `${position} ${rival.dj_name} — ${rival.ex_score} **${arrow} ${score}**\n`;
				} else {
					rival_text += `**${position} ${rival.dj_name} ・ ${rival.ex_score}**\n`;
				}
			}

			embed.fields.push({"name": "RIVALS", "value": rival_text, "inline": false});
		}

		/* Pacemaker information. */
		let pacemaker_text = '', rivals = null;

		if (player.rivals)
			rivals = (player.chart.play_style === 1) ? player.rivals.sp: player.rivals.dp;

		switch (player.score.pacemaker.type) {
			case 'sg_pacemaker':
				pacemaker_text = `PACEMAKER ${player.score.pacemaker.custom}%`; break;
			case 'sg_riva1':
				pacemaker_text = `DJ ${rivals[0].dj_name}`; break;
			case 'sg_riva2':
				pacemaker_text = `DJ ${rivals[1].dj_name}`; break;
			case 'sg_riva3':
				pacemaker_text = `DJ ${rivals[2].dj_name}`; break;
			case 'sg_riva4':
				pacemaker_text = `DJ ${rivals[3].dj_name}`; break;
			case 'sg_riva5':
				pacemaker_text = `DJ ${rivals[4].dj_name}`; break;
			case 'sg_monly':
				pacemaker_text = `MY BEST`; break;
			case 'sg_pacemaker_next':
				pacemaker_text = 'PACEMAKER NEXT'; break;
			case 'sg_pacemaker_nextplus':
				pacemaker_text = 'PACEMAKER NEXT+'; break;
			case 'sg_pacemaker_aaa':
				pacemaker_text = 'LV. AAA'; break;
			case 'sg_pacemaker_aa':
				pacemaker_text = 'LV. AA'; break;
			case 'sg_pacemaker_a':
				pacemaker_text = 'LV. A'; break;
			case 'sg_riva_ave':
				pacemaker_text = 'RIVAL AVERAGE'; break;
			case 'sg_altop':
				pacemaker_text = 'GLOBAL BEST'; break;
			case 'sg_alave':
				pacemaker_text = 'GLOBAL AVERAGE'; break;
			case 'sg_dantp':
				pacemaker_text = 'CLASS BEST'; break;
			case 'sg_danav':
				pacemaker_text = 'CLASS AVERAGE'; break;
			case 'sg_lotop':
				pacemaker_text = 'REGION BEST'; break;
			case 'sg_loave':
				pacemaker_text = 'REGION AVERAGE'; break;
			case 'sg_shop_top':
				pacemaker_text = 'SHOP TOP'; break;
			case 'sg_shop_next':
				pacemaker_text = 'SHOP NEXT'; break;
		}

		/* Substitute 'RIVAL BEST' for the actual rival name. */
		if (player.score.pacemaker.type === 'sg_riva_top') {
			if (player.score.rivals !== undefined) {
				pacemaker_text = `DJ ${player.score.rivals[0].dj_name.toUpperCase()}`;
			} else {
				pacemaker_text = 'RIVAL BEST';
			}
		}

		if (parts.pacemaker === true && pacemaker_text !== '') {
			let pacemaker_diff = player.score.ex_score - player.score.pacemaker.target;
				pacemaker_diff = (pacemaker_diff >= 0) ? '+' + pacemaker_diff: pacemaker_diff;

			embed.fields.push({
				"name": "PACEMAKER",
				"value": `${pacemaker_text} **${pacemaker_diff}**`,
				"inline": false
			});
		}

		/* List of known active modifiers. */
		if (parts.modifiers === true && player.score.modifiers && player.score.modifiers.length !== 0)
			embed.fields.push({"name": "MODIFIERS", "value": player.score.modifiers.join(', '), "inline": false});
		
		/* Append the score timestamp. */
		embed.timestamp = new Date(data.timestamp * 1000).toISOString();

		/* Disable header and footer. */
		if (!parts.header) {
			delete embed.author;
		}

		if (!parts.music) {
			delete embed.title;
			delete embed.description;
		}

		if (!parts.footer) {
			delete embed.footer;
			delete embed.timestamp;
		}

		return new discordjs.RichEmbed(embed);
	}

	async submit(data) {
		/* Create a rich embed using the provided score data. */
		let message = this.config.rich_embed.enabled ? this.generateEmbed(data): undefined;
		
		if (Ameto.plugins.scorecard !== undefined && this.config.scorecard.enabled === true) {
			/* Store the image in the configured folder relative to the process
			   working directory, then attach it to the rich embed. */
			try {
				const basedir = this.config.scorecard.settings.directory;
				const style = this.config.scorecard.settings.style;

				/* Determine full path of local card image. */
				var cardimg = path.resolve(basedir + path.sep + Date.now());
				const quality = this.config.scorecard.settings.quality;

				if (this.config.scorecard.settings.quality < 100)
					cardimg += '.jpg';
				else
					cardimg += '.png';

				/* Append additional configuration for use in the scorecard. */
				data.options = this.config.scorecard.options || {};

				await Ameto.plugins.scorecard.generate(style, data, cardimg, quality);

				/* If 'scorecard_only' is defined, scrap all the current embed
				   data and only send the image. */
				if (message !== undefined) 
					message.attachFile(cardimg);
				else
					message = new discordjs.Attachment(cardimg);
			} catch (error) {
				console.error(`Failed to generate scorecard image. (${error})`);
			}
		}

		/* Finally, send the embed to the pre-defined channels. */
		for (let i = this.config.client.channels.length - 1; i >= 0; i--) {
			/* Ensure the target channel is valid. */
			let channel_id = this.config.client.channels[i].id;
			let channel = this.client.channels.get(channel_id);

			if (!channel || !message)
				continue;

			await channel.send(message);
		}

		if (cardimg !== undefined && this.config.scorecard.settings.persistent !== true)
			await fs.unlink(cardimg);
	}
}

module.exports = Discord;