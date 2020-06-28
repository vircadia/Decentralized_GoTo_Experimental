//  decentralizedGoToServerScript.js
//
//  Created by Darlingnotin in 2019.
//  Copyright 2019 Darlingnotin
//  Copyright 2020 Vircadia Contributors
//
//  Distributed under the ISC license.
//  See the accompanying file LICENSE or https://opensource.org/licenses/ISC

(function () {
    var ipJsonUrl = Script.resolvePath("ip.json");
    var webSocketUrl = ipJsonUrl.split("/")[2].split(":")[0];
    var webSocketPort = ""; // Leave empty if no specific port.
    var pathToWS = webSocketPort + "/interim/d-goto/ws";
    
    var _localStore = {};
    var CHECK_TIME = 6000;
    var ws;
    var wsReady = false;
    var shutdownBool = false;
    var WEB_SOCKET_URL = "ws://" + webSocketUrl + pathToWS;
    var entityE = {
        "owner": "Enter owner of place",
        "domainName": "Enter place name",
        "ipAddress": "",
        "port": "40102",
        "customPath": "",
        "avatarCountRadius": ""
    };
    var ipAddress = Script.require(ipJsonUrl + "?" + Date.now());

    connectWebSocket();
    this.preload = function(entityID) {
        if (!(entityID in _localStore)) {
            _localStore[entityID] = {};
        }
        var id = Uuid.generate();
        var local = _localStore[entityID];
        evalBeacon(entityID,id);
        local.refreshInterval = Script.setInterval(function() {
            evalBeacon(entityID,id);
        }, CHECK_TIME);
    };

    this.unload = function(entityID) {
        if (entityID in _localStore) {
            var local = _localStore[entityID];
            if (local.refreshInterval) {
                Script.clearInterval(local.refreshInterval);
            }
            delete _localStore[entityID];
        }
    };

    function evalBeacon(entityID,id) {
        var _entity = Entities.getEntityProperties(entityID, ["userData", "position", "rotation"]);
        var entity;
        
        try {
            entity = Object(JSON.parse(_entity.userData)); 
        } catch (e) {
            entity = entityE; fixUserData(); 
        }
        
        function fixUserData() {
            Entities.editEntity(entityID, {
                userData: JSON.stringify(entityE)
            });
        }
        
        var entityPosition = _entity;
        var addr = ipAddress.ip;   
        var avatars = AvatarList.getAvatarIdentifiers();

        if (entity.ipAddress && entity.ipAddress != "") {
            addr = entity.ipAddress;
        }
        
        var path = addr + ":" + entity.port + "/" + entityPosition.position.x + "," + entityPosition.position.y + "," + entityPosition.position.z + "/" + entityPosition.rotation.w + "," + entityPosition.rotation.x + "," + entityPosition.rotation.y + "," + entityPosition.rotation.z;

        if (entity.customPath && entity.customPath != "") {
            path = addr + ":" + entity.port + entity.customPath;
        }
        
        if (entity.avatarCountRadius && entity.avatarCountRadius != "") {
            avatars = AvatarList.getAvatarsInRange(entityPosition.position, entity.avatarCountRadius);
        }
        
        var list = {
            "Place Name": entity.domainName,
            "Owner": entity.owner,
            "Visit": "hifi://" + path,
            "id": id,
            "People": avatars.length
        };
        
        sendWS(list);
    }

    function sendWS(msg, timeout) {
        if (wsReady === true) {
            ws.send(JSON.stringify(msg));
        } else {
            timeout = timeout | 0;
            if (!shutdownBool) {
                if (timeout > (30 * 1000)) {
                    timeout = 30 * 1000;
                } else if (timeout < (30 * 1000)) {
                    timeout += 1000;
                }
                
                Script.setTimeout(function () {
                    if (wsReady === -1) {
                        connectWebSocket();
                    }
                    sendWS(msg, timeout);
                }, timeout);
            }
        }
    }

    function connectWebSocket(timeout) {
        ws = new WebSocket(WEB_SOCKET_URL);
        console.info("Connecting to WS:", WEB_SOCKET_URL);
        ws.onmessage = function incoming(_data) {
            var message = _data.data;
            var cmd = { FAILED: true };
            try {
                cmd = JSON.parse(message);
            } catch (e) {
                //
            }
            if (!cmd.FAILED) {
                // do stuff
            }
        };

        ws.onopen = function open() {
            wsReady = true;
        };

        ws.onclose = function close() {
            wsReady = false;
            console.log('disconnected');

            timeout = timeout | 0;
            if (!shutdownBool) {
                if (timeout > (30 * 1000)) {
                    timeout = 30 * 1000;
                } else if (timeout < (30 * 1000)) {
                    timeout += 1000;
                }
                Script.setTimeout(function () {
                    connectWebSocket(timeout);
                }, timeout);
            } else {
                wsReady = -1;
            }
        };
    }
});
