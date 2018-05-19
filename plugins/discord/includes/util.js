/* String table of class ranks. */
const CLASS_RANKS = ['七級', '六級', '五級', '四級', '三級', '二級', '一級', '初段',
	'二段', '三段', '四段', '五段', '六段', '七段', '八段', '九段', '十段', '中伝', '皆伝'];

/* List of clear types ordered from best to worst. */
const CLEAR_RANKING = [
	'clear_fullcombo', 'clear_ex', 'clear_hard', 'clear_clear', 'clear_easy',
	'clear_assist', 'clear_failed', 'clear_noplay'
];

/* Translates a clear type (e.g. 'clear_easy', 'clear_hard') to 'human readable'
   text and color. Should make this configurable eventually. */
module.exports.clear_type_str = (type) => {
	switch (type) {
		case "clear_noplay":
			return {color: 'A3A3A3', text: "NO PLAY"};
		case "clear_failed":
			return {color: '5A5A5A', text: "FAILED"};
		case "clear_assist":
			return {color: 'BA79F6', text: "ASSIST CLEAR"};
		case "clear_easy":
			return {color: '52EEA6', text: "EASY CLEAR"};
		case "clear_clear":
			return {color: '52AFEE', text: "CLEAR"};
		case "clear_hard":
			return {color: 'FFFFFF', text: "HARD CLEAR"};
		case "clear_ex":
			return {color: 'EE5252', text: "EX HARD CLEAR"};
		case "clear_fullcombo":
			return {color: 'EFC650', text: "FULL COMBO"};
	}

	return {color: '000000', text: "???"};
};

/* Calculates the score percentage based on EX SCORE and total note count of the
   chart. In the case of 100% this function will return 'MAX' instead. */
module.exports.getPercentage = function(ex_score, note_count) {
	if (ex_score == note_count * 2)
		return 'MAX';

	return ((ex_score / (note_count * 2)) * 100).toFixed(2) + '%';
};

/* Compares two provided clear types, returning true if the first clear type is
   considered superior to the second clear type. */
module.exports.isClearImprovement = (a, b) => {
	return CLEAR_RANKING.indexOf(a) < CLEAR_RANKING.indexOf(b);
};

/* Convert raw DJ level string (e.g. 'level_s_aaa') to letter grade. */
module.exports.getDJLevelString = (text) => {
	return text.substr(text.lastIndexOf('_') + 1, text.length).toUpperCase();
};

/* Translate numeric class ID (0: 7th Kyu -> 18: Kaiden) to string. */
module.exports.getClassText = (i) => CLASS_RANKS[i];