// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

const { UPowerGlib: UPower } = imports.gi;
const Main = imports.ui.main;

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

    const update = () => {
      if (this._proxy.IsPresent || debugMode) {
        this._patch(sysIndicator, powerToggle);
        let charging = this._proxy.State === UPower.DeviceState.CHARGING;
        let percentage = this._proxy.Percentage;
        let statusStyleStr = settings.get_string('status-style');
        let statusStyle =
          statusStyleStr === 'portrait'
            ? BStatusStyle.PORTRAIT
            : statusStyleStr === 'plainportrait'
            ? BStatusStyle.PLAINPORTRAIT
            : BStatusStyle.CIRCLE;
        if (debugMode) {
          charging = this._debugCounter % 7 === 0;
          percentage = this._debugCounter % 101;
        }
        sysIndicator._drawicon.set({
          inner: charging
            ? BInner.CHARGING
            : settings.get_boolean('show-icon-text')
            ? BInner.TEXT
            : BInner.EMPTY,
          percentage,
          statusStyle,
          visible: statusStyleStr !== 'hidden',
        });

        powerToggle._drawicon.set({
          inner: charging ? BInner.CHARGING : BInner.EMPTY,
          percentage,
          statusStyle,
        });
      } else {
        this._unpatch(sysIndicator, powerToggle);
      }
    };
    if (debugMode) {
      this._debugCounter = 0;
      this._debugIntervalId = setInterval(() => {
        this._debugCounter += 1;
        update();
      }, 200);
    }
    this._proxyId = this._proxy?.connect(
      'g-properties-changed',
      update.bind(this)
    );
    this._dsettingsId = sysIndicator._desktopSettings.connect(
      'changed::show-battery-percentage',
      update.bind(this)
    );
    this._settingsIds = [
      settings.connect('changed::status-style', update.bind(this)),
      settings.connect('changed::icon-percentage-text', update.bind(this)),
    ];
    this._settings = settings;
    update();
  }

  disable() {
    if (this._proxy === null) {
      // Already disabled
      return;
    }
    const sysIndicator = Main.panel.statusArea.quickSettings._system;
    const { powerToggle } = sysIndicator._systemItem;

    if (debugMode && this._debugIntervalId) {
      clearInterval(this._debugIntervalId);
      this._debugIntervalId = null;
    }
    this._bolt_path = null;
    if (this._proxyId) {
      this._proxy?.disconnect(this._proxyId);
      this._proxy = null;
      this._proxyId = null;
    }
    if (this._dsettingsId) {
      sysIndicator._desktopSettings.disconnect(this._dsettingsId);
      this._dsettingsId = null;
    }
    if (this._settingsIds) {
      for (const hid of this._settingsIds) {
        this._settings.disconnect(hid);
      }
      this._settings = null;
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
    }
  }
}

function init() {
  return new Extension();
}
