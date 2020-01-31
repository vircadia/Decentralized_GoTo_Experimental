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

  if (uri == "/goto.json") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write(JSON.stringify(locationList));
    response.end();
    return;
  }

  if (uri == "/ip.json") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write("{" + JSON.stringify("ip") + ": " + JSON.stringify(request.connection.remoteAddress.split(':')[3]) + "}");
    response.end();
    return;
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
