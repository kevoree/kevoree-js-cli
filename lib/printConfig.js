var util = require('util');

module.exports = function printConfig(json) {
	var clonedJson = JSON.parse(JSON.stringify(json));
	if (clonedJson.user && clonedJson.user.password) {
		clonedJson.user.password = '******';
	}
	console.log(util.inspect(clonedJson, {
		depth: null,
		colors: true
	}))
};
