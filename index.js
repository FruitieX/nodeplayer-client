#!/usr/bin/env node

var _ = require('underscore');
var request = require('request');
var fs = require('fs');

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
usageText += '  -a [ID]       append search result ID to the queue';
usageText += '  -p            list playlists';
usageText += '  -p [ID]       list contents of playlist ID';
usageText += '  -h            show this help and quit';

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
