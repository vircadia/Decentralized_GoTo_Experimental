// GoTo tester
//
// Created by Dale Glass in 2021
//

const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080/');
const fs = require("fs");


ws.on('open', function open() {
  ws.send('This is not JSON');
	ws.send(fs.readFileSync('./test_good.json', 'utf-8'));
	ws.send(fs.readFileSync('./test_bad.json', 'utf-8'));
  process.exit(0);
});

ws.on('message', function incoming(data) {
  console.log("REPLY: '" + data + "'");
});

/* vim: set tabstop=2:softtabstop=2:shiftwidth=2:expandtab */
