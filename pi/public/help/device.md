# Device

## Device name

The name shown in Matter controllers and at the top of this page. Up to 32 characters.

## After a power cut

What the Pi does when power comes back: `last` returns to the state it was in, `on` always plays, `off` always stays off.

## How settings work

Every setting shows a label, a one-line description and a control. Press the (i) next to the label for where the value comes from, its default, and when a change takes effect. Changes are collected in the bar at the bottom; nothing is saved until you press **Apply**.

A value can come from three places, strongest first: set on this page, set in `/etc/default/videofx`, or the built-in default. **Reset to file value or default** in the (i) panel drops the value set here.

**Show advanced settings** reveals rarely needed rows. The search box finds any setting by name or description, advanced or not.

Read more: [Settings](../../docs/settings.md)
