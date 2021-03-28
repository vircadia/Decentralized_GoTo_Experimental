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
    fs = require("fs"),
    crypto = require("crypto");

const DEFAULT_DIFFICULTY_MS = 100;

port = process.argv[2] || 8081;

let serverParams = JSON.parse(fs.readFileSync('./serverParams.json', 'utf-8'));

// We use a salt and a number of iterations to hash IP addresses.
// If either of those aren't defined, then they're generated here. The salt
// is randomly generated, and the number of iterations is obtained by benchmarking
// how many iterations we can do.
//
// Intentionally, neither result is given to the user. This ensures the hashes will
// be only valid for one run and IP addresses cannot be recovered from the hash.

if (!serverParams["salt"]) {
  serverParams["salt"] = crypto.randomBytes(32).toString('hex');
  console.log("Generated random salt");
}

if (!serverParams["difficulty"]) {
  var start = Date.now();
  var iterations = 0;
  while( Date.now() - start < DEFAULT_DIFFICULTY_MS ) {
    var hash = crypto.createHash("sha256");
    hash.update("Hello");
    hash.digest();
    iterations++;
  }

  serverParams["difficulty"] = iterations;
  console.log("Using benchmarked number of iterations");
}

var hashCache = {}

var hashAddress = function(address) {
  if (hashCache[address] !== undefined) {
    return hashCache[address];
  }

  var hash = crypto.createHash("sha256");
  hash.update(serverParams["salt"]);
  hash.update(address);
  var result = hash.digest();

  for(var i=0;i<serverParams["difficulty"];i++) {
    var hash = crypto.createHash("sha256");
    hash.update(result);
    result = hash.digest();
  }

  // We want text at the end, shorted for comfort
  result = crypto.createHash("sha256").update(result).digest("hex").substring(0, 32);
  hashCache[address] = result;

  return result;
}


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
			pageData[i].Platform = pageInformation[i].Platform;
			pageData[i].Version = pageInformation[i].Version;
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
var seenRequests = {};
var blockList = {
	addresses : { },
	words : { }
};


wss.on('connection', function connection(ws,req) {
  ws.on('message', function incoming(data) {

    let ipAddress = hashAddress(req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    let key = require("crypto").createHash("sha256").update(ipAddress + ":" + data).digest();

    if ( seenRequests[key] == undefined) {
      console.log("MSG FROM " + ipAddress + ": " + data);
      seenRequests[key]=1;
    }

    let messageData;
		try {
			messageData = JSON.parse(data);
		} catch( error ) {
			console.log("Error: " + error);
			console.log("Bad JSON received from " + ipAddress + ": " + data);
			ws.send(JSON.stringify({ error:  'Your JSON is bad, and you should feel bad.' }));
			return;
		}

		let newBlockList;
    try {
			newBlockList = JSON.parse(fs.readFileSync('./blockList.json', 'utf-8'));
			blockList = newBlockList;
		} catch ( error ) {
			console.log("Error: " + error);
			console.log("Failed to parse blockList.json, block list not updated.");
		}


    let visitAddress = messageData.Visit.split('/')[2].split(':')[0];
    let onBlockList = false;

    for (var banReason in blockList["addresses"]) {
      blockList["addresses"][banReason].forEach(function(banned) {
        if (banned == visitAddress || banned == ipAddress) {
          console.log("BAN: Matched " + banReason + ", address " + banned);
          onBlockList = true;
          return;
        }
      });
    }

    for(var banReason in blockList["words"]) {
      blockList["words"][banReason].forEach(function(banned) {
        var bannedLower = banned.toLowerCase();

        for (var key in messageData) {
          if ( typeof messageData[key] != "string" ) {
            continue;
          }
          if ( messageData[key].toLowerCase().includes(bannedLower)) {
            console.log("BAN: words matched " + banReason + ", field '" + key + "' value '" + messageData[key] + "' contains '" + banned + "'");
            onBlockList = true;
            return;
          }
        }
      });
    }

    if (onBlockList) {
      console.log("Blocked request from " + ipAddress);
      console.log("");
      return;
    }

    var exist = false;
    messageData.age = Date.now();
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


/* vim: set tabstop=2:softtabstop=2:shiftwidth=2:expandtab */
