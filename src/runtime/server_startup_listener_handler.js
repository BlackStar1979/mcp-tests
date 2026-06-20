"use strict";

function startServer({
  server,
  host,
  port,
  onError,
  onListening,
}) {
  server.on("error", onError);
  server.listen(port, host, onListening);
  return server;
}

module.exports = {
  startServer,
};
