//  server.js
//
//  Created by Darlingnotin in 2019.
//  Copyright 2019 Darlingnotin
//
//  Distributed under the ISC license.
//  See the accompanying file LICENSE or https://opensource.org/licenses/ISC

var http = require("http"),
  url = require("url"),
  path = require("path"),
  fs = require("fs")
port = process.argv[2] || 8081;

http.createServer(function (request, response) {

  var uri = url.parse(request.url).pathname
    , filename = path.join(process.cwd(), uri);

  var contentTypesByExtension = {
    '.html': "text/html",
    '.css': "text/css",
    '.js': "text/javascript"
  };

  var pageData;
  var pageInformation;

  switch (uri) {
    case "/goto.json":
      pageInformation = locationList;
      prepareInformation();
      return;
    case "/ip.json":
      // pageData = "{" + JSON.stringify("ip") + ": " + JSON.stringify(request.connection.remoteAddress.split(':')[3]) + "}";
      pageData = "{" + JSON.stringify("ip") + ": " + JSON.stringify(request.headers['x-forwarded-for']) + "}";
      sendPage();
      return;
  }

  function prepareInformation() {
    pageData = [];
    for (let i = 0; i < pageInformation.length; i++) {
      pageData[i] = {};
      pageData[i]["Domain Name"] = pageInformation[i]["Domain Name"];
      pageData[i].Owner = pageInformation[i].Owner;
      pageData[i].Visit = pageInformation[i].Visit;
      pageData[i].People = pageInformation[i].People;
    }
    pageData = JSON.stringify(pageData);
    sendPage();
  }

  function sendPage() {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write(pageData);
    response.end();
  }

  fs.exists(filename, function (exists) {
    if (!exists) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function (err, file) {
      if (err) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.write(err + "\n");
        response.end();
        return;
      }

      var headers = {};
      var contentType = contentTypesByExtension[path.extname(filename)];
      if (contentType) headers["Content-Type"] = contentType;
      response.writeHead(200, headers);
      response.write(file, "binary");
      response.end();
    });
  });
}).listen(parseInt(port, 10));

var locationList = [];
setInterval(() => {
  var time = Date.now();
  var nowLocationList = [];
  for (let i = 0; i < locationList.length; i++) {
    if (locationList[i].age <= time - 8000) {
    } else {
      nowLocationList[nowLocationList.length] = locationList[i];
    }
  }
  locationList = nowLocationList;
}, 8000);

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {
    var onBlockList = false;
    var messageData = JSON.parse(data);
    messageData.age = Date.now();
    var exist = false;
    let blockList = JSON.parse(fs.readFileSync('./blockList.json', 'utf-8'));
    for (let i = 0; i < blockList.length; i++) {
      if (blockList[i] == messageData.Visit.split('/')[2].split(':')[0]) {
        onBlockList = true;
      }
    }
    if (onBlockList) {
      return;
    }
    for (let i = 0; i < locationList.length; i++) {
      if (locationList[i].id == messageData.id) {
        locationList[i] = messageData;
        exist = true;
      }
    }
    if (!exist) {
      locationList[locationList.length] = messageData;
    }
  });
});

console.log("Decentralized GoTo server running at\n=> http://localhost:" + port + "/\nCTRL + C to shutdown");
