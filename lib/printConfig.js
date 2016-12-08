var util = require('util');

module.exports = function printConfig(json) {
	if (json.user && json.user.password) {
		json.user.password = '******';
	}
	console.log(util.inspect(json, {
		depth: null,
		colors: true
	}))
};
