# Audio

## Volume and Mute

The starting volume and whether the speakers start muted. The Dashboard slider changes the same values. The slider sets the level at once; the value here is where it starts.

## Sound card

With the Raspberry Pi DigiAMP+, the card name is `DigiAMP` and the mixer control is `Digital`. Use the card's name, never its number: numbers can change between restarts. `aplay -l` on the Pi shows the names. Both rows are advanced.

Read more: [Audio](../../docs/audio.md)
