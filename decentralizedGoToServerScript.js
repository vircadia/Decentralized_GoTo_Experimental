(function () {
    var ws;
    var wsReady = false;
    var shutdownBool = false;
    var ipJsonUrl = Script.resolvePath("ip.json");
    var webSocketUrl = ipJsonUrl.split("/")[2].split(":")[0];
    var WEB_SOCKET_URL = "ws://" + webSocketUrl + ":8081/d-goto/ws/";
    var id = Uuid.generate();
    var entityID;
    var entity;
    var entityPosition;
    var entityE = {
        "owner": "Enter owner of domain",
        "domainName": "Enter domain name",
        "port": "40102"
    };
    connectWebSocket();
    this.preload = function (entityID) {
        var _entity = Entities.getEntityProperties(entityID, ["userData", "position"]);
        try { entity = Object(JSON.parse(_entity.userData)); } catch (e) { entity = entityE; fixUserData(); }
        function fixUserData() {
            Entities.editEntity(entityID, {
                userData: JSON.stringify(entityE)
            });
        }
        entityPosition = _entity;
    }
    var ipAddress = Script.require(ipJsonUrl + "?" + Date.now());
    var interval = Script.setInterval(function () {
        var avatars = AvatarList.getAvatarIdentifiers();
        var list = {
            "Domain Name": entity.domainName,
            "Owner": entity.owner,
            "Visit": "hifi://" + ipAddress.ip + ":" + entity.port + "/" + entityPosition.position.x + "," + entityPosition.position.y + "," + entityPosition.position.z + "/",
            "id": id,
            "People": avatars.length
        };

        sendWS(list);

    }, 6000);

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
