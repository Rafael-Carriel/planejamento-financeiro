'use strict';
Parse.Cloud.job('reconciliarMensalidades', async () => {
  // Runtime can be loaded independently of the Web Hosting worker.
  const express = require('express');
  return require('./runtime').initialize(express()).reconcile();
});
