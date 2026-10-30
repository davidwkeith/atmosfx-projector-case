# Schedule

On the page: an on time and an off time per weekday. The on time can be **At sunset**, plus or minus an offset. An off time earlier than the on time means after midnight. Out of the box every day is sunset + 30 minutes to 22:00, with the schedule on. Sunset needs Schedule > Latitude/Longitude: until they are set, the Dashboard says so and only the 22:00 off acts.

- Sunset is computed on the Pi from Schedule > Latitude/Longitude, using NOAA's general solar position equations (tested within 5 minutes of published times). Days with no sunset (polar summer or winter) get no on event. The page shows each sunset day's next on time, worked out the same way in the Pi's time zone.
- Times use the Pi's time zone (`sudo raspi-config` > Localisation). Tested across both DST changes: a time in the spring-forward gap fires once, at 03:30; a time in the fall-back hour fires once.
- **The schedule only acts at its event times.** Switching on or off by hand (Home, the page) holds until the next scheduled event. The page shows the next event.
- **After a power cut** the "After a power cut" setting applies first. Then, once the clock is set, an event that passed while the power was out is caught up: a cut across "on at sunset" still gets you a show. A change you made by hand after the last event is left alone.
- A Pi has no real-time clock. Events more than 5 minutes stale, for example after NTP corrects the clock at boot, are skipped rather than replayed.
- While DMX is in control the schedule is paused. When DMX lets go, the schedule's current wish is applied.

## Quiet hours

Schedule > **Quiet hours**: per weekday, a window (an end earlier than the start runs past midnight; start = end means all day) during which:

- **the volume is capped** at a percentage (0 mutes). The cap applies to the web slider, the saved level at start-up, and DMX (unless **DMX ignores quiet hours** is on). The mixer is re-set when a window starts or ends;
- **scares are off** (optional), whatever the trigger: Home's Scare switch, the motion sensor, the web button, and DMX unless it bypasses.

Power on/off (Home, the schedule) isn't affected. Until the clock is synchronised, quiet hours count as active if any window is set, the neighbour-friendly guess.
