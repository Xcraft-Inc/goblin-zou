'use strict';

const path = require('path');
const Goblin = require('xcraft-core-goblin');
const ZouNet = require('./zou-net.js');

const goblinName = path.basename(module.parent.filename, '.js');

const logicState = {};
const logicHandlers = {};

Goblin.registerQuest(goblinName, 'sync', function* (quest, url, sku) {
  const zou = new ZouNet(quest);
  return yield zou.sync(url, sku);
});

Goblin.registerQuest(goblinName, 'shar', function* (quest, url, sku, mode) {
  const zou = new ZouNet(quest);
  return yield zou.shar(url, sku, mode);
});

Goblin.registerQuest(goblinName, 'vlast', function* (quest, url, sku) {
  const zou = new ZouNet(quest);
  return yield zou.vlast(url, sku);
});

Goblin.registerQuest(goblinName, 'vtable', function* (quest, url, tag) {
  const zou = new ZouNet(quest);
  return yield zou.vtable(url, tag);
});

Goblin.registerQuest(goblinName, 'ipub', function* (quest, url, sku) {
  const zou = new ZouNet(quest);
  return yield zou.ipub(url, sku);
});

// Singleton
module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
Goblin.createSingle(goblinName);
