var write = require('fs').createWriteStream;
var fork = require('child_process').fork;
var through2 = require('through2');
var assign = require('object-assign');
var gutil = require('gulp-util');

var _spawnedProcess = null;

var spawnedProcesses = {};

var noop = function (chunk, enc, cb) {
	return cb(null, chunk);
}

var _spawn = function(_conf) {
	if (!_conf)
		throw new gutil.PluginError('gulp-server-fork', 'No config provided');

	if (!_conf.module)
		throw new gutil.PluginError('gulp-server-fork', 'No module to fork provided');

	var conf = assign({}, {
		id: Date.now(),
		timeout: 20 * 1000,
		env: {},
		logfile: null,
	}, _conf)

	return function(cb) {

		var spawnedProcess = fork(conf.module, {
			silent: true,
			env: assign({}, process.env, conf.env)
		});

		if (conf.logfile && conf.logfile.length > 0) {
			var logStream = write(conf.logfile);
			spawnedProcess.stdout.pipe(logStream);
			spawnedProcess.stderr.pipe(logStream);
		}

		var timerId = setTimeout(function() {
			gutil.log(gutil.colors.magenta(conf.timeout + ' ms'), 'passed without recieving a ready event from the forked process.', gutil.colors.cyan('Continuing...'));
			cb();
		}, conf.timeout);

		spawnedProcess.on('message', function(msg) {
			if (msg == 'ready') {
				clearTimeout(timerId);
				return cb();
			}
		})

		spawnedProcesses[conf.id] = spawnedProcess;
	}
}

var _kill = function(id) {
	return function(cb) {
		if (id) {
			if (spawnedProcesses[id])
				spawnedProcesses[id].kill();
		} else {
			Object.keys(spawnedProcesses).forEach(function(id) {
				spawnedProcesses[id].kill();
			})
		}
		cb();
	}
}

var spawn = function(conf) {
	return through2.obj(noop, _spawn(conf));
}

var kill  = function(id) {
	return through2.obj(noop, _kill(id));
}

module.exports = spawn;
module.exports.kill = kill;
