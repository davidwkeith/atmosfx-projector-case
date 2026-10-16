# Schedule

## Weekly schedule

Pick an on and an off time for each weekday, or tick **At sunset** to switch on at sunset. Times are local to the Pi. An off time earlier than the on time means after midnight.

The schedule only acts at these times. If you switch on or off by hand, that holds until the next scheduled time.

## Sunset

Sunset is worked out on the Pi from **Latitude** and **Longitude** (north and east are positive, so west is negative). The **offset** moves the time: a negative number is before sunset. Days with no sunset, in polar summer or winter, get no on time.

**Use this device's location** fills both in from your phone or computer, rounded to about 1 km; press **Apply** to keep them. Browsers only share location with HTTPS pages, so on the Pi's own address the button is greyed out: read the numbers off a map app instead.

## The Pi's clock

The Pi has no battery clock. The schedule and quiet hours wait until it has the time from the network, and the Dashboard says so.

## Quiet hours

Quiet hours cap the volume (0 mutes) and can turn scares off during a window each day. An end earlier than the start runs past midnight. They apply whoever asks: this page, Home, the schedule, the motion sensor. DMX follows them too, unless **DMX ignores quiet hours** is ticked. Switching on and off is not affected.

Changes wait in the Apply bar until you press **Apply**.

Read more: [Schedule](../../docs/schedule.md), [Quiet hours](../../docs/schedule.md#quiet-hours)
