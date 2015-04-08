var path = require('path');
var os = require('os');
var nodeplayerConfig = require('nodeplayer-config');

var defaultConfig = {};

defaultConfig.hostname = os.hostname();
defaultConfig.port = 8080;
defaultConfig.tls = false;
defaultConfig.key = nodeplayerConfig.getBaseDir() + path.sep + 'nodeplayer-key.pem';
defaultConfig.cert = nodeplayerConfig.getBaseDir() + path.sep + 'nodeplayer-cert.pem';
defaultConfig.ca = nodeplayerConfig.getBaseDir() + path.sep + 'nodeplayer-ca.pem';
defaultConfig.rejectUnauthorized = true;

defaultConfig.verifyMac = {};
defaultConfig.verifyMac.algorithm = 'sha256';
defaultConfig.verifyMac.key = nodeplayerConfig.getBaseDir() + path.sep + 'nodeplayer-key.pem';
defaultConfig.verifyMac.iterations = 1000;
defaultConfig.verifyMac.keyLen = 256;

defaultConfig.username = 'changeMe';
defaultConfig.password = 'keyboard cat';

module.exports = defaultConfig;
