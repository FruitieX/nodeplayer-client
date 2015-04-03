#!/usr/bin/env node

var _ = require('underscore');
var request = require('request');
var fs = require('fs');
var Duration = require('duration');

var mkdirp = require('mkdirp');
var root = process.env.HOME + '/.nodeplayer-client';
mkdirp.sync(root + '/temp');
mkdirp.sync(root + '/playlists');

var tempResultsPath = root + '/temp/searchresults.json';

var nodeplayerConfig = require('nodeplayer-config');
var coreConfig = nodeplayerConfig.getConfig();
var defaultConfig = require('./default-config.js');
var config = require('nodeplayer-config').getConfig('client', defaultConfig);

var tlsOpts = {
    key: fs.readFileSync(config.key),
    cert: fs.readFileSync(config.cert),
    ca: fs.readFileSync(config.ca),
    rejectUnauthorized: config.rejectUnauthorized
};

var usageText = '';
usageText += 'show and manipulate the nodeplayer queue.\n\n';
usageText += 'commands\n';
usageText += '========\n';
usageText += 'search for songs:\n';
usageText += '  -l                  show queue (default action)\n';
usageText += '  -p                  list playlists\n';
usageText += '  -p [ID]             list contents of playlist ID\n';
usageText += '  -s [QUERY]          perform search matching QUERY\n';
usageText += 'manipulate playback/queue:\n';
usageText += '  -a ID [POS]         append song with ID\n';
usageText += '  -d ID               delete song with ID\n';
usageText += '  -m FROM TO [CNT]    move CNT songs FROM pos TO pos\n';
usageText += '  -g [CNT]            skip CNT songs, can be negative to go back\n';
usageText += '  -k [POS]            seek playback to POS seconds, left out to resume\n';
usageText += '  -u                  pause playback\n';
usageText += '  -z                  shuffle queue\n';
usageText += 'misc:\n';
usageText += '  -n                  show now playing song\n';
usageText += '  -w FILENAME         write current playlist into FILENAME\n';
usageText += '  -r ID               recalculate HMAC in playlist with ID\n';
usageText += '  -i ID               insert now playing into playlist with ID\n';
usageText += '  -h                  show this help and quit\n';

var yargs = require('yargs')
    .boolean('s');
var argv = yargs.argv;
if(argv.h) {
    console.log(usageText);
    process.exit(0);
}

var printSong = function(song, id) {
    if(!_.isUndefined(id)) {
        process.stdout.write('  ' + id + ': ');
    }
    console.log(song.artist + ' - ' + song.title + ' (' + song.album + ')');
};

var onexit = function() {
    process.stdout.write('\x1b[?25h'); // enable cursor
    process.exit();
};

var parseRange = function(str) {
    var res = str.match(/(\d*)\.\.(\d*)/);
    if(!res)
        return null;

    var range = [];

    range[0] = res[1] || 0;
    range[1] = res[2] || 9999999999999;

    return range;
};

var url = (config.tls ? 'https://' : 'http://') + config.hostname + ':' + config.port;

if (argv.h) {
    console.log(usageText);
} else if (argv.s) {
    request.post({
        url: url + '/search',
        json: {terms: argv._.join(' ')},
        agentOptions: tlsOpts
    }, function(err, res, body) {
        if(!err) {
            var results = [];

            var id = 0;
            _.each(body, function(backend, backendName) {
                console.log(backendName + ':');
                _.each(backend.songs, function(song) {
                    printSong(song, id);
                    results.push(song);
                    id++;
                });
            });

            fs.writeFileSync(tempResultsPath, JSON.stringify(results, undefined, 4));
        } else {
            console.log('error: ' + err);
        }
    });
} else if (!_.isUndefined(argv.g)) {
    // "goto"
    if(argv.g === true)
        argv.g = 1;

    request.post({
        url: url + '/playctl',
        json: {
            action: 'skip',
            cnt: argv.g
        },
        agentOptions: tlsOpts
    }, function(err, res, body) {
        console.log(body);
    });
} else if (!_.isUndefined(argv.d)) {
    var cnt = 1;
    var range;
    var start = argv.d;
    if(argv.d === true)
        start = 0;

    if(_.isString(argv.d))
        range = parseRange(argv.d);
    if(range) {
        start = range[0];
        cnt = range[1] - range[0] + 1;
    }
    request.del({
        url: url + '/queue/' + start,
        json: {
            cnt: cnt
        },
        agentOptions: tlsOpts
    }, function(err, res, songs) {
        console.log("deleted songs:");
        _.each(songs, function(song) {
            printSong(song);
        });
    });
} else if (!_.isUndefined(argv.m)) {
    request.post({
        url: url + '/queue',
        json: {
            method: 'move',
            from: argv.m,
            to: argv._[0],
            cnt: argv._[1]
        },
        agentOptions: tlsOpts
    }, function(err, res, body) {
        if(!err) {
            console.log('songs moved:');
            _.each(body, function(song) {
                printSong(song);
            });
        } else {
            console.log('error: ' + err);
        }
    });
} else if (!_.isUndefined(argv.a)) {
    if(fs.existsSync(tempResultsPath)) {
        var tempResults = require(tempResultsPath);
        var matches = [];
        var range;

        if(_.isString(argv.a))
            range = parseRange(argv.a);

        if(argv.a === true) {
            // entire playlist
            matches = tempResults;
        } else if(range) {
            // x..y range
            matches = tempResults.filter(function(song, i) {
                return (i >= range[0] && i <= range[1]);
            });
        } else {
            // by id
            matches = [tempResults[argv.a]];
        }

        // TODO: check if host is running partyplay before doing this?
        for(var i = 0; i < matches.length; i++) {
            matches[i].userID = 'nodeplayer-client';
        }

        request.post({
            url: url + '/queue',
            json: {
                songs: matches,
                pos: argv._[0]
            },
            agentOptions: tlsOpts
        }, function(err, res, body) {
            if(!err) {
                console.log('songs queued:');
                _.each(matches, function(song) {
                    printSong(song);
                });
            } else {
                console.log('error: ' + err);
            }
        });
    } else {
        console.log('no search results');
    }
} else if(!_.isUndefined(argv.p)) {
    // without parameters: list all playlists
    if(argv.p === true) {
        var playlists = fs.readdirSync(root + '/playlists');
        playlists.sort();

        var id = 0;
        _.each(playlists, function(playlistName) {
            console.log('  ' + id + ': ' + playlistName);
            id++;
        });
    } else {
        var playlists = fs.readdirSync(root + '/playlists');
        playlists.sort();

        // loop over playlists to find the requested one
        var playlist;
        var id = 0;
        _.each(playlists, function(playlistName) {
            if(id === argv.p) {
                playlist = require(root + '/playlists/' + playlistName);
            }
            id++;
        });

        // loop over songs (in reverse order) and print them
        playlist.reverse();
        id = 0;
        _.each(playlist, function(song) {
            printSong(song, id);
            id++;
        });

        // store song list
        fs.writeFileSync(tempResultsPath, JSON.stringify(playlist, undefined, 4));
    }
} else if(argv.n) {
    var socket = require('socket.io-client')((config.tls ? 'https://' : 'http://') + config.hostname + ':' + config.port, tlsOpts);
    var zpad = require('zpad');
    var npInterval = null;
    var playbackInfo = {};
    var playbackInfoTime = 0;

    process.stdin.setRawMode(true); // hide input
    process.stdout.write('\x1b[?25l'); // hide cursor
    process.on('SIGINT', onexit);
    // q or ctrl-c pressed: run onexit
    process.stdin.on('data', function(key) {
        if(key == 'q' || key == '\u0003') onexit();
    });

    var printSongTime = function() {
        process.stdout.write('\r');
        process.stdout.write('\033[2K');

        if(!_.isEmpty(playbackInfo) && playbackInfo.playbackStart) {
            var curTime = new Date().getTime();
            var position = new Duration(new Date(playbackInfoTime), new Date(curTime + (playbackInfo.position || 0)));
            var duration = new Duration(new Date(curTime), new Date(curTime + parseInt(playbackInfo.duration)));

            process.stdout.write('[');
            process.stdout.write(String(position.minutes) + ':' + zpad(position.seconds % 60, 2));
            process.stdout.write('/');
            process.stdout.write(String(duration.minutes) + ':' + zpad(duration.seconds % 60, 2));
            process.stdout.write(']');
        } else {
            process.stdout.write('[0:00/0:00]');
        }
    };

    socket.on('playback', function(newPlaybackInfo) {
        playbackInfo = newPlaybackInfo;
        playbackInfoTime = new Date().getTime();
    });
    socket.on('queue', function(queue) {
        if(npInterval)
            clearInterval(npInterval);

        var nowPlaying = queue[0];
        queue.shift();
        queue.reverse();

        process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
        var id = queue.length; // note we already shifted nowPlaying out
        _.each(queue, function(song) {
            printSong(song, id);
            id--;
        });
        console.log('--- Queue ---\n');

        process.stdout.write('Now playing: ');
        if(nowPlaying)
            printSong(nowPlaying);

        if(queue.length || nowPlaying) {
            npInterval = setInterval(function() {
                printSongTime();
            }, 1000);
        }
        printSongTime();
    });
} else if(_.isString(argv.w)) {
    request.get({
        url: url + '/queue',
        agentOptions: tlsOpts
    }, function(err, res, body) {
        if(err) {
            console.log(err);
            return;
        }
        if(body) {
            var queue = body;
            // TODO: filter out unneeded song properties
            fs.writeFileSync(root + '/playlists/' + argv.w + '.json', JSON.stringify(queue, undefined, 4));
            console.log('playlist written into ' + argv.w + '.json');
        }
    });
} else if(!_.isUndefined(argv.i)) {
    request.get({
        url: url + '/queue',
        agentOptions: tlsOpts
    }, function(err, res, body) {
        if(err) {
            console.log(err);
            return;
        }
        if(body) {
            var queue = JSON.parse(body);
            var song = queue.shift();

            var playlists = fs.readdirSync(root + '/playlists');

            // loop over playlists to find the requested one
            var playlist;
            var playlistPath;
            var id = 0;
            _.each(playlists, function(playlistName) {
                if(id === argv.i) {
                    playlistPath = root + '/playlists/' + playlistName;
                    playlist = require(playlistPath);
                }
                id++;
            });

            playlist.unshift(song);
            // store song list
            // TODO: filter out unneeded song properties
            fs.writeFileSync(playlistPath, JSON.stringify(playlist, undefined, 4));
        }
    });
} else if(argv.u) {
    request.post({
        url: url + '/playctl',
        json: {
            action: 'pause'
        },
        agentOptions: tlsOpts
    }, function(err, res, body) {
        console.log(body);
    });
} else if(!_.isUndefined(argv.k)) {
    var pos;
    if(argv.k !== true)
        pos = argv.k * 1000;

    request.post({
        url: url + '/playctl',
        json: {
            action: 'play',
            position: pos
        },
        agentOptions: tlsOpts
    }, function(err, res, body) {
        console.log(body);
    });
} else if(!_.isUndefined(argv.r)) {
    var crypto = require('crypto');
    var key = fs.readFileSync(config.verifyMac.key);
    var derivedKey = crypto.pbkdf2Sync(key, key, config.verifyMac.iterations, config.verifyMac.keyLen);

    var calculateMac = function(str) {
        var hmac = crypto.createHmac(config.verifyMac.algorithm, derivedKey);
        hmac.update(str);
        return hmac.digest('hex');
    };
    var getSongHmac = function(song) {
        song.album = (song.album || "");
        song.artist = (song.artist || "");
        song.title = (song.title || "");

        return calculateMac(
            song.album.replace('|', '')                  + '|' +
            song.artist.replace('|', '')                 + '|' +
            song.title.replace('|', '')                  + '|' +
            song.backendName.replace('|', '')            + '|' +
            song.duration.toString().replace('|', '')    + '|' +
            song.format.replace('|', '')                 + '|' +
            song.songID.replace('|', '')                 + '|'
        );
    };

    var playlists = fs.readdirSync(root + '/playlists');
    playlists.sort();

    // loop over playlists to find the requested one
    var playlist;
    var playlistPath;
    var id = 0;
    _.each(playlists, function(playlistName) {
        if(id === argv.r) {
            playlist = require(root + '/playlists/' + playlistName);
            playlistPath = root + '/playlists/' + playlistName;
        }
        id++;
    });
    if(!playlist) {
        console.log('no playlist found');
        return;
    }

    // loop over songs and fix hmac
    for(var song in playlist) {
        playlist[song].hmac = getSongHmac(playlist[song]);
    }

    // store playlist
    fs.writeFileSync(playlistPath, JSON.stringify(playlist, undefined, 4));
    console.log('wrote playlist with recalculated HMACs: ' + playlistPath);
} else if(argv.z) {
    request.post({
        url: url + '/playctl',
        json: {
            action: 'shuffle'
        },
        agentOptions: tlsOpts
    }, function(err, res, body) {
        console.log(body);
    });
} else {
    request.get({
        url: url + '/queue',
        agentOptions: tlsOpts
    }, function(err, res, body) {
        if(err) {
            console.log(err);
            return;
        }
        console.log('Queue:');
        if(body) {
            var queue = JSON.parse(body);
            queue.reverse();
            var id = queue.length - 1;
            _.each(queue, function(song) {
                printSong(song, id);
                id--;
            });
        }
    });
}

// TODO: replace a lot of _.each() with _.find() or similar to prevent unnecessary loops
