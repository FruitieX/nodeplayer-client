#!/usr/bin/env node

var _ = require('underscore');
var request = require('request');
var fs = require('fs');
var tempResultsPath = process.env.HOME + '/.partyplay-client-searchresults.json';

var userConfig = require(process.env.HOME + '/.partyplayConfig.js');
var defaultConfig = require(__dirname + '/partyplayConfigDefaults.js');
var config = _.defaults(userConfig, defaultConfig);

var usageText = '';
usageText += 'show and manipulate the partyplay queue.\n\n';
usageText += 'Commands:\n';
usageText += '  -q            show queue\n';
usageText += '  -s [QUERY]    perform search matching QUERY\n';
usageText += '  -a [ID]       append search result ID to the queue';
usageText += '  -h            show this help and quit';

var yargs = require('yargs')
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
if(argv.q) {
    request.get(url + '/queue', function(err, res, body) {
        console.log(body);
    });
} else if (argv.s) {
    request.post({
        url: url + '/search',
        json: {terms: argv.s}
    }, function(err, res, body) {
        if(!err) {
            var id = 0;
            _.each(body, function(backend, backendName) {
                console.log(backendName + ':');
                _.each(backend.songs, function(song) {
                    printSong(song, id);
                    id++;
                });
            });
            fs.writeFileSync(tempResultsPath, JSON.stringify(body));
        } else {
            console.log('error: ' + err);
        }
    });
} else if (argv.a) {
    if(fs.existsSync(tempResultsPath)) {
        var tempResults = require(tempResultsPath);

        var id = 0;
        _.each(tempResults, function(backend, backendName) {
            _.each(backend.songs, function(song) {
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
        });
    } else {
        console.log('no search results');
    }
} else {
    console.log(usageText);
}
