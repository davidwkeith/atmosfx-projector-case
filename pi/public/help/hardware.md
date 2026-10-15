# Hardware

These values cannot be changed here. Ports need root, and paths would let this page point the service anywhere. To change one, edit `/etc/default/videofx` over SSH and restart the service. Every key is listed in that file, commented.

## What is shown

- The Raspberry Pi model, detected from the board.
- The GPIO pins for the relay, the IR LED, the IR receiver and the Pi fan (with the temperature it starts at), and the pins reserved for the DigiAMP+.
- The web page and Matter ports, the media folder, the playlist file and the state folder.

Each row's (i) panel names the variable to set.

Read more: [GPIO pins and wiring](../../docs/wiring.md)
