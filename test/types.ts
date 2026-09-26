// Compiled by `tsc --noEmit`: the shapes a consumer relies on must type-check against index.d.ts
import Guacamole, { Client, type Status } from "../index.js";

const tunnel = new Guacamole.WebSocketTunnel(
  "wss://guacamole.example/websocket-tunnel",
);
const client: Guacamole.Client = new Client(tunnel);
client.sendMouseState(
  new Guacamole.Mouse.State(0, 0, false, false, false, false, false),
  true,
);

const unauthorized: Status.Code = Guacamole.Status.Code.CLIENT_UNAUTHORIZED;
const closed: Guacamole.Tunnel.State = Guacamole.Tunnel.State.CLOSED;
const reader = new Guacamole.StringReader(new Guacamole.InputStream(client, 0));
reader.ontext = (text: string) => text;

export { closed, reader, unauthorized };
