<!--
SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
-->

<h1 align="center">Battery Indicator Icon</h1>
<p align="center">
<img alt="Battery vertical bold" height="128" src="data/battery_icon.png"/>
<img alt="Battery vertical plain" height="128" src="data/battery_plain_icon.png"/>
<img alt="Battery circle" height="128" src="data/battery_circle_icon.png"/>
<a href="https://extensions.gnome.org/extension/5718/battery-indicator-icon/">
    <img alt="Get it on GNOME Extensions" width="228" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true"></img>
  </a>
 <a href="https://github.com/Deminder/battery-indicator-icon/actions/workflows/build.yml"><img alt="CI" src="https://github.com/Deminder/battery-indicator-icon/actions/workflows/build.yml/badge.svg"></img></a>
  <br/>
  <b>Replace the battery indicator icon with a circle or portrait.</b>
</p>


Addtionally, the battery percentage text may be shown next to or inside the icon.
The design is inspired by [LineageOS](https://github.com/LineageOS/android_frameworks_base/blob/lineage-20.0/packages/SettingsLib/src/com/android/settingslib/graph).

Moreover, the orientation and horizontal scale of the icon may be adjusted.
<p align="center">
<img alt="Battery horizontal slim" height="128" src="data/battery_slim_icon.png"/>
<img alt="Battery horizontal plump" height="128" src="data/battery_plump_icon.png"/>
</p>

## Manual Installation

Requires `gnome-shell-extensions` and `gettext`:
```(shell)
make install
```
OR automatically switch to the last supported release version before install `make supported-install`.
## Development

### Debug

Install via `$GUEST_SSHCMD` on a virtual/remote host `$GUEST_SSHADDR` for debugging:

```(shell)
GUEST_SSHCMD=ssh GUEST_SSHADDR=guest@vm make debug-guest
```

Install locally with a large debug icon overlay enabled:

```(shell)
make debug-install
```

### Update Translations

Extract transalable text from sources to template file `po/main.pot` and update `.po` files:

```(shell)
make translations
```
### References

- https://gjs.guide/extensions/
- https://gjs.guide/guides/
- https://gjs-docs.gnome.org/
- https://github.com/Deminder/osd-volume-number
- https://github.com/Deminder/ShutdownTimer
