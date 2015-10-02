'use strict';

const envvar = require('envvar');
const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

const NETEGG_DB_URL = envvar.string('NETEGG_DB_URL');

mongoose.connect(NETEGG_DB_URL);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));


module.exports = db;