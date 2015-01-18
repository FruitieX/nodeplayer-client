#!/usr/bin/env node

var _ = require('underscore');
var request = require('request');
var fs = require('fs');
var Duration = require('duration');

var mkdirp = require('mkdirp');
var root = process.env.HOME + '/.partyplay-client';
mkdirp.sync(root + '/temp');
mkdirp.sync(root + '/playlists');

var tempResultsPath = root + '/temp/searchresults.json';

var userConfig = require(process.env.HOME + '/.partyplayConfig.js');
var defaultConfig = require(__dirname + '/partyplayConfigDefaults.js');
var config = _.defaults(userConfig, defaultConfig);

var usageText = '';
usageText += 'show and manipulate the partyplay queue.\n\n';
usageText += 'commands:\n';
usageText += '  -l            show queue (default action)\n';
usageText += '  -s [QUERY]    perform search matching QUERY\n';
usageText += '  -a [ID]       append search result ID to the queue\n';
usageText += '  -p            list playlists\n';
usageText += '  -p [ID]       list contents of playlist ID\n';
usageText += '  -n            show now playing song\n';
usageText += '  -h            show this help and quit\n';

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

var url = config.hostname + ':' + config.port;

if (argv.h) {
    console.log(usageText);
} else if (argv.s) {
    request.post({
        url: url + '/search',
        json: {terms: argv._.join(' ')}
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

            fs.writeFileSync(tempResultsPath, JSON.stringify(results));
        } else {
            console.log('error: ' + err);
        }
    });
} else if (!_.isUndefined(argv.a)) {
    if(fs.existsSync(tempResultsPath)) {
        var tempResults = require(tempResultsPath);

        var id = 0;
        _.each(tempResults, function(song) {
            if(parseInt(argv.a) === id) {
                request.post({
                    url: url + '/queue',
                    json: {song: song}
                }, function(err, res, body) {
                    if(!err) {
                        process.stdout.write('song queued: ');
                        printSong(song);
                    } else {
                        console.log('error: ' + err);
                    }
                });
            }
            id++;
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
        fs.writeFileSync(tempResultsPath, JSON.stringify(playlist));
    }
} else if(argv.n) {
    var socket = require('socket.io-client')(config.hostname + ':' + config.port);
    var zpad = require('zpad');
    var npInterval = null;

    socket.on('playback', function(playbackInfo) {
        var playbackInfoTime = new Date().getTime();
        if(npInterval)
            clearInterval(npInterval);

        process.stdin.setRawMode(true); // hide input
        process.stdout.write('\x1b[?25l'); // hide cursor
        process.on('SIGINT', onexit);
        // q or ctrl-c pressed: run onexit
        process.stdin.on('data', function(key) {
            if(key == 'q' || key == '\u0003') onexit();
        });
        process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
        request.get(url + '/queue', function(err, res, queue) {
            queue = JSON.parse(queue);
            var nowPlaying = queue.shift();
            queue.reverse();

            var id = queue.length; // note we already shifted nowPlaying out
            _.each(queue, function(song) {
                printSong(song, id);
                id--;
            });
            console.log('--- Queue ---\n');

            process.stdout.write('Now playing: ');
            printSong(nowPlaying);

            var printSongTime = function() {
                var curTime = new Date().getTime();
                var position = new Duration(new Date(playbackInfoTime), new Date(curTime + (playbackInfo.position || 0)));
                var duration = new Duration(new Date(curTime), new Date(curTime + parseInt(playbackInfo.duration)));
                process.stdout.write('\r');
                process.stdout.write('\033[2K');

                process.stdout.write('[');
                process.stdout.write(String(position.minutes) + ':' + zpad(position.seconds % 60, 2));
                process.stdout.write('/');
                process.stdout.write(String(duration.minutes) + ':' + zpad(duration.seconds % 60, 2));
                process.stdout.write(']');
            };
            npInterval = setInterval(function() {
                printSongTime();
            }, 1000);
            printSongTime();
        });
    });
} else {
    request.get(url + '/queue', function(err, res, body) {
        console.log('Queue:');
        var id = 0;
        _.each(JSON.parse(body), function(song) {
            printSong(song, id);
            id++;
        });
    });
}
