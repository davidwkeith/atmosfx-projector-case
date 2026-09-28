#!/usr/bin/env node
// Tiny sACN (E1.31) sender for testing the VideoFX fixture by hand.
//
//   node tools/sacn-send.mjs --to 192.168.1.50 --universe 1 --address 1 \
//        --values 255,0,0,0,76,0,255,0 [--priority 100] [--seconds 10] [--rate 30]
//   node tools/sacn-send.mjs --universe 1 --values 255,255   (multicast 239.255.0.1)
//   node tools/sacn-send.mjs ... --pulse-trigger     (channel 4 goes 0 -> 255 once)
//
// Stops with a Stream_Terminated packet (Ctrl-C too), so control hands back after the hold time.

import { randomBytes } from "node:crypto";
import dgram from "node:dgram";
import { parseArgs } from "node:util";
import { buildPacket, multicastGroup } from "./sacn-packet.mjs";

const { values: o } = parseArgs({
  options: {
    to: { type: "string" },
    universe: { type: "string", default: "1" },
    address: { type: "string", default: "1" },
    values: { type: "string", default: "255" },
    priority: { type: "string", default: "100" },
    seconds: { type: "string", default: "10" },
    rate: { type: "string", default: "30" },
    name: { type: "string", default: "sacn-send" },
    "pulse-trigger": { type: "boolean", default: false },
  },
});

const universe = Number(o.universe);
const address = Number(o.address);
const ours = o.values.split(",").map(Number);
const levels = new Array(512).fill(0);
ours.forEach((v, i) => (levels[address - 1 + i] = v));
const host = o.to ?? multicastGroup(universe);
const cid = randomBytes(16);
const sock = dgram.createSocket("udp4");
let seq = 0;
let frames = 0;
const send = (extra = {}) =>
  new Promise((r) => sock.send(buildPacket({ universe, levels, sequence: seq++, priority: Number(o.priority), name: o.name, cid, ...extra }), 5568, host, r));

console.log(`sACN to ${host}:5568, universe ${universe}, channels ${address}-${address + ours.length - 1} = ${ours.join(",")}`);
const timer = setInterval(async () => {
  if (o["pulse-trigger"]) levels[address + 2] = frames > 5 && frames < 20 ? 255 : 0;
  frames++;
  await send();
}, 1000 / Number(o.rate));

const stop = async () => {
  clearInterval(timer);
  for (let i = 0; i < 3; i++) await send({ terminated: true }); // three, as ETC's reference source does
  sock.close();
  console.log(`sent ${frames} frames, then Stream_Terminated`);
};
setTimeout(stop, Number(o.seconds) * 1000);
process.once("SIGINT", stop);
