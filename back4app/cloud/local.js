'use strict';
// Local use: node --env-file=.env local.js. Back4App loads app.js instead.
const express = require('express');
const { initialize } = require('./runtime');
const app = express();
initialize(app);
app.listen(Number(process.env.PORT || 8080), '127.0.0.1');
