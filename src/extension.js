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
      // Extension already enabled
      return;
    }
    const settings = ExtensionUtils.getSettings();
    // Port legacy setting names
    const legacyProps = {
      portrait: 'bold',
      plainportrait: 'plain',
    };
    const stylePropName = settings.get_string('status-style');
    if (stylePropName in legacyProps) {
      settings.set_string('status-style', legacyProps[stylePropName]);
    }

    const sysIndicator = Main.panel.statusArea.quickSettings._system;
    const { powerToggle } = sysIndicator._systemItem;
    if (debugMode) {
      // Debug: Replace the PowerManagerProxy by a mock with cycling values
      powerToggle._proxy_real = powerToggle._proxy;
      powerToggle._proxy = new Me.imports.mock.PowerManagerProxyMock();
    }

    const proxy = powerToggle._proxy;
    this._proxy = proxy;
    this._theme = St.ThemeContext.get_for_stage(global.stage);

    const update = () => {
      if (this._proxy.IsPresent) {
        this._patch(sysIndicator, powerToggle);

        // Update properties of BatteryDrawIcons
        const height = this._theme.scaleFactor * Panel.PANEL_ICON_SIZE;
        const width = Math.round(height * settings.get_double('icon-scale'));
        let charging = this._proxy.State === UPower.DeviceState.CHARGING;
        let percentage = this._proxy.Percentage;
        const statusStyleStr = settings.get_string('status-style');

        const props = {
          height,
          width,
          percentage,
          statusStyle:
            statusStyleStr === 'bold'
              ? BStatusStyle.BOLD
              : statusStyleStr === 'slim'
              ? BStatusStyle.SLIM
              : statusStyleStr === 'plump'
              ? BStatusStyle.PLUMP
              : statusStyleStr === 'plain'
              ? BStatusStyle.PLAIN
              : BStatusStyle.CIRCLE,
          inner: charging
            ? BInner.CHARGING
            : settings.get_int('show-icon-text') === 1
            ? BInner.TEXT
            : settings.get_int('show-icon-text') === 2
            ? BInner.VTEXT
            : BInner.EMPTY,
          visible: statusStyleStr !== 'hidden',
          vertical: settings.get_string('icon-orientation') === 'vertical',
        };
        sysIndicator._drawicon.set(props);
        powerToggle._drawicon.set({
          ...props,
          // Percentage text is always shown next to powerToggle
          inner: charging ? BInner.CHARGING : BInner.EMPTY,
        });
        let style = '';
        if (statusStyleStr === 'hidden') {
          // Text only mode: Style existing percentage labels
          const colors = sysIndicator._drawicon.iconColors;
          const rgbaStr = color => {
            const c = color.to_pixel();
            const rgba = [
              (c >> 24) & 0xff,
              (c >> 16) & 0xff,
              (c >> 8) & 0xff,
              (c & 0xff) / 255.0,
            ].join(',');
            return `rgba(${rgba})`;
          };
          style = charging
            ? `border-top: solid 3px ${rgbaStr(
                colors.foreground
              )}; padding-bottom: 3px; border-radius: 3px;`
            : percentage > 15
            ? ''
            : percentage > 5
            ? `color: ${rgbaStr(colors.warning)};`
            : `color: ${rgbaStr(colors.error)};`;
        }
        sysIndicator._percentageLabel.set_style(style);
        powerToggle._title.set_style(style);

        if (debugMode) {
          // Debug: Ensure that text label is updated by the mocked _proxy
          powerToggle._sync();
          // Debug: Show a big debug icon on the primary monitor
          const dbgIcon = sysIndicator._drawicondbg;
          dbgIcon.set({
            ...props,
            inner: BInner.CHARGING,
            height: 256,
            width: 256 * settings.get_double('icon-scale'),
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
    this._proxyId = this._proxy.connect(
      'g-properties-changed',
      update.bind(this)
    );

    // Connect theme
    this._themeId = this._theme.connect(
      'notify::scale-factor',
      update.bind(this)
    );
    this._themeChangedId = this._theme.connect('changed', update.bind(this));

    // Connect settings
    this._dsettingsId = sysIndicator._desktopSettings.connect(
      'changed::show-battery-percentage',
      update.bind(this)
    );
    this._settingsIds = [
      'status-style',
      'show-icon-text',
      'icon-scale',
      'icon-orientation',
    ].map(prop => settings.connect(`changed::${prop}`, update.bind(this)));
    this._settings = settings;

    update();
  }

  disable() {
    // Unlock-dialog session-mode required:
    // since the battery indicator is also visible in the unlock-dialog.
    // The user most likely expects the custom icon to appear in the unlock-dialog.
    if (this._proxy === null) {
      // Extension already disabled
      return;
    }
    const sysIndicator = Main.panel.statusArea.quickSettings._system;
    const { powerToggle } = sysIndicator._systemItem;

    // Disconnect proxy
    this._proxy.disconnect(this._proxyId);
    if ('_proxy_real' in powerToggle) {
      powerToggle._proxy.destroy();
      powerToggle._proxy = powerToggle._proxy_real;
      delete powerToggle._proxy_real;
    }
    this._proxy = null;
    this._proxyId = null;

    // Disconnect theme
    this._theme.disconnect(this._themeId);
    this._theme.disconnect(this._themeChangedId);
    this._themeChangedId = null;
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

    this._unpatch(sysIndicator, powerToggle);
  }

  _patch(sysIndicator, powerToggle) {
    if (!('_drawicon' in sysIndicator)) {
      sysIndicator._drawicon = new BatteryDrawIcon({
        style_class: 'battery-indicator',
        idolWidget: sysIndicator._indicator,
      });

      sysIndicator.replace_child(
        sysIndicator._indicator,
        sysIndicator._drawicon
      );

      powerToggle._drawicon = new BatteryDrawIcon({
        style_class: 'battery-quick-toggle',
        idolWidget: powerToggle._icon,
      });
      powerToggle._box.replace_child(powerToggle._icon, powerToggle._drawicon);

      if (debugMode) {
        sysIndicator._drawicondbg = new BatteryDrawIcon({
          style_class: 'battery-indicator',
        });
        Main.uiGroup.add_actor(sysIndicator._drawicondbg);
      }
    }
  }

  _unpatch(sysIndicator, powerToggle) {
    if ('_drawicon' in sysIndicator) {
      // Remove color style from percentage label
      sysIndicator._percentageLabel.set_style('');
      powerToggle._title.set_style('');

      powerToggle._box.replace_child(powerToggle._drawicon, powerToggle._icon);
      powerToggle._drawicon.destroy();
      delete powerToggle['_drawicon'];

      sysIndicator.replace_child(
        sysIndicator._drawicon,
        sysIndicator._indicator
      );
      sysIndicator._drawicon.destroy();
      delete sysIndicator['_drawicon'];

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
