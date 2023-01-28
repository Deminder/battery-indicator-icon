// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

const { St, UPowerGlib: UPower } = imports.gi;
const Main = imports.ui.main;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { BatteryDrawIcon, BInner, BStatusStyle } = Me.imports.drawicon;

let debugMode = false;

class Extension {
  constructor() {
    ExtensionUtils.initTranslations();
    this._proxy = null;
  }

  enable() {
    if (this._proxy !== null) {
      // Already enabled
      return;
    }
    const settings = ExtensionUtils.getSettings();
    const sysIndicator = Main.panel.statusArea.quickSettings._system;
    const { powerToggle } = sysIndicator._systemItem;
    const proxy = powerToggle._proxy;
    this._proxy = proxy;
    this._theme = St.ThemeContext.get_for_stage(global.stage);

    const update = () => {
      if (this._proxy.IsPresent || debugMode) {
        this._patch(sysIndicator, powerToggle);

        // Update properties of BatteryDrawIcons
        const height = this._theme.scaleFactor * Panel.PANEL_ICON_SIZE;
        const width = height;
        let charging = this._proxy.State === UPower.DeviceState.CHARGING;
        let percentage = this._proxy.Percentage;
        if (debugMode) {
          charging = this._debugCounter % 7 === 0;
          percentage = this._debugCounter % 101;
        }
        const statusStyleStr = settings.get_string('status-style');

        const props = {
          height,
          width,
          percentage,
          statusStyle:
            statusStyleStr === 'portrait'
              ? BStatusStyle.PORTRAIT
              : statusStyleStr === 'plainportrait'
              ? BStatusStyle.PLAINPORTRAIT
              : BStatusStyle.CIRCLE,
          inner: charging
            ? BInner.CHARGING
            : settings.get_int('show-icon-text') === 1
            ? BInner.TEXT
            : settings.get_int('show-icon-text') === 2
            ? BInner.VTEXT
            : BInner.EMPTY,
          visible: statusStyleStr !== 'hidden',
        };
        sysIndicator._drawicon.set(props);
        powerToggle._drawicon.set({
          ...props,
          // Percentage text is always shown next to powerToggle
          inner: charging ? BInner.CHARGING : BInner.EMPTY,
          visible: true,
        });

        if (debugMode) {
          const dbgIcon = sysIndicator._drawicondbg;
          dbgIcon.set({
            ...props,
            inner: BInner.CHARGING,
            width: 512,
            height: 512,
          });
          const monitor = Main.layoutManager.primaryMonitor;
          dbgIcon.set_position(
            monitor.x + Math.floor(monitor.width / 2 - dbgIcon.width / 2),
            monitor.y + Math.floor(monitor.height / 2 - dbgIcon.height / 2)
          );
        }
      } else {
        this._unpatch(sysIndicator, powerToggle);
      }
    };
    // Connect proxy
    this._proxyId = this._proxy?.connect(
      'g-properties-changed',
      update.bind(this)
    );

    // Connect theme
    this._themeId = this._theme.connect(
      'notify::scale-factor',
      update.bind(this)
    );

    // Connect settings
    this._dsettingsId = sysIndicator._desktopSettings.connect(
      'changed::show-battery-percentage',
      update.bind(this)
    );
    this._settingsIds = [
      settings.connect('changed::status-style', update.bind(this)),
      settings.connect('changed::show-icon-text', update.bind(this)),
    ];
    this._settings = settings;

    if (debugMode) {
      // Start debug interval
      this._debugCounter = 0;
      this._debugIntervalId = setInterval(() => {
        this._debugCounter += 1;
        update();
      }, 200);
    }
    update();
  }

  disable() {
    if (this._proxy === null) {
      // Already disabled
      return;
    }
    const sysIndicator = Main.panel.statusArea.quickSettings._system;
    const { powerToggle } = sysIndicator._systemItem;

    // Disconnect proxy
    this._proxy.disconnect(this._proxyId);
    this._proxy = null;
    this._proxyId = null;

    // Disconnect theme
    this._theme.disconnect(this._themeId);
    this._themeId = null;
    this._theme = null;

    // Disconnect settings
    sysIndicator._desktopSettings.disconnect(this._dsettingsId);
    this._dsettingsId = null;
    for (const hid of this._settingsIds) {
      this._settings.disconnect(hid);
    }
    this._settingsIds = null;
    this._settings = null;

    if (debugMode && this._debugIntervalId) {
      // Stop debug interval
      clearInterval(this._debugIntervalId);
      this._debugIntervalId = null;
    }

    this._unpatch(sysIndicator, powerToggle);
  }

  _patch(sysIndicator, powerToggle) {
    if (!('_drawicon' in sysIndicator)) {
      sysIndicator.remove_all_children();
      sysIndicator._drawicon = new BatteryDrawIcon('battery-indicator');
      sysIndicator.add_child(sysIndicator._drawicon);
      sysIndicator.add_child(sysIndicator._percentageLabel);

      powerToggle._drawicon = new BatteryDrawIcon('battery-quick-toggle');
      const b = powerToggle._box;
      b.remove_all_children();
      b.add_child(powerToggle._drawicon);
      b.add_child(powerToggle._label);

      if (debugMode) {
        sysIndicator._drawicondbg = new BatteryDrawIcon('battery-indicator');
        Main.uiGroup.add_actor(sysIndicator._drawicondbg);
      }
    }
  }

  _unpatch(sysIndicator, powerToggle) {
    if ('_drawicon' in sysIndicator) {
      powerToggle._drawicon.destroy();
      delete powerToggle['_drawicon'];
      const b = powerToggle._box;
      b.remove_all_children();
      b.add_child(powerToggle._icon);
      b.add_child(powerToggle._label);

      sysIndicator._drawicon.destroy();
      delete sysIndicator['_drawicon'];
      sysIndicator.remove_all_children();
      sysIndicator.add_actor(sysIndicator._indicator);
      sysIndicator.add_child(sysIndicator._percentageLabel);

      powerToggle._sync();
      sysIndicator._sync();

      if (debugMode) {
        Main.uiGroup.remove_child(sysIndicator._drawicondbg);
        sysIndicator._drawicondbg.destroy();
        delete sysIndicator['_drawicondbg'];
      }
    }
  }
}

function init() {
  return new Extension();
}
