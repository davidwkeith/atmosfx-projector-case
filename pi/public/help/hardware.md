# Hardware

These values cannot be changed here. Ports need root, and paths would let this page point the service anywhere. To change one, edit `/etc/default/videofx` over SSH and restart the service. Every key is listed in that file, commented.

## What is shown

- The Raspberry Pi model, detected from the board.
- The GPIO pins for the relay, the IR LED and the IR receiver, with the pins reserved for the DigiAMP+.
- The web page and Matter ports, the media folder, the playlist file and the state folder.

Each row's (i) panel names the variable to set.

Read more: [GPIO pins and wiring](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#gpio-pins-and-wiring)
