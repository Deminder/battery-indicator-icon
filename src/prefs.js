// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

const { Adw, Gio, Gtk, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain('battery-indicator-icon');
const _ = Gettext.gettext;

function init() {
  ExtensionUtils.initTranslations();
}

var BatIconPrefsPage = GObject.registerClass(
  class BatIconPrefsPage extends Adw.PreferencesPage {
    _init() {
      super._init();

      this._settings = ExtensionUtils.getSettings();
      this._dsettings = new Gio.Settings({
        schema_id: 'org.gnome.desktop.interface',
      });
      this._group = new Adw.PreferencesGroup();
      this.add(this._group);
      this._rows = {};

      this._addComboRow('style', _('Battery status icon style'), {
        bold: _('Bold'),
        slim: _('Slim'),
        plump: _('Plump'),
        plain: _('Plain'),
        circle: _('Circle'),
        text: _('Text'),
      });

      this._addComboRow('text', _('Battery percentage text'), {
        hidden: _('Hidden'),
        inside: _('Inside the icon'),
        insideVertical: _('Inside the icon (vertical)'),
        nextTo: _('Next to the icon'),
      });

      this._addComboRow('scale', _('Horizontal scale'), {
        square: _('Default'),
        golden: _('Wide'),
        double: _('Extra wide'),
      });

      this._addComboRow('orientation', _('Orientation'), {
        vertical: _('Vertical'),
        horizontal: _('Horizontal'),
      });

      this._settingsSignalIds = [
        'status-style',
        'show-battery-percentage',
        'icon-scale',
        'icon-orientation',
      ].map(prop =>
        this._settings.connect(`changed::${prop}`, this._sync.bind(this))
      );
      this.connect('destroy', this._disconnectSettings.bind(this));
      this._sync();
    }

    _disconnectSettings() {
      for (const sid of this._settingsSignalIds) {
        this.settings.disconnect(sid);
      }
      this._settingsSignalIds = [];
    }

    _sync() {
      // Setting update
      this.__syncing = 1;
      const s = this._settings.get_string('status-style');
      const styleOpt = s !== 'hidden' ? s : 'text';
      this.setComboOption('style', styleOpt);

      const showIcon = styleOpt !== 'text';
      const showText = this._settings.get_int('show-icon-text');
      this.setComboOption(
        'text',
        showText === 1
          ? 'inside'
          : showText === 2
          ? 'insideVertical'
          : this._dsettings.get_boolean('show-battery-percentage')
          ? 'nextTo'
          : 'hidden',
        showIcon
      );

      // Orientation
      this.setComboOption(
        'orientation',
        this._settings.get_string('icon-orientation'),
        showIcon && styleOpt !== 'circle'
      );

      // Horizontal scaling
      const scale = this._settings.get_double('icon-scale');
      this.setComboOption(
        'scale',
        scale === 1.618
          ? 'golden'
          : scale === 2
          ? 'double'
          : scale === 1
          ? 'square'
          : 'custom',
        showIcon
      );
      delete this.__syncing;
      this._updateSettings();
    }

    setComboOption(prop, opt, sensitive) {
      const [row, opts] = this._rows[prop];
      row.selected = Object.keys(opts).indexOf(opt);
      if (sensitive !== undefined) {
        row.sensitive = sensitive;
      }
    }

    _updateSettings() {
      if (this.__syncing) {
        // Skip updating settings during _sync
        return;
      }
      const [textOpt, styleOpt, scaleOpt, orientOpt] = [
        'text',
        'style',
        'scale',
        'orientation',
      ].map(prop => {
        const [row, comboOpts] = this._rows[prop];
        return Object.keys(comboOpts)[row.selected];
      });
      this._dsettings.set_boolean(
        'show-battery-percentage',
        textOpt === 'nextTo' || styleOpt === 'text'
      );
      this._settings.set_int(
        'show-icon-text',
        textOpt === 'inside' ? 1 : textOpt === 'insideVertical' ? 2 : 0
      );
      this._settings.set_string(
        'status-style',
        styleOpt !== 'text' ? styleOpt : 'hidden'
      );
      this._settings.set_string('icon-orientation', orientOpt);
      if (scaleOpt !== undefined) {
        this._settings.set_double(
          'icon-scale',
          scaleOpt === 'golden' ? 1.618 : scaleOpt === 'double' ? 2 : 1
        );
      }
    }

    _addComboRow(prop, title, options) {
      const model = new Gtk.StringList();
      for (const opt of Object.values(options)) {
        model.append(opt);
      }
      const row = new Adw.ComboRow({
        title,
        model,
        selected: 0,
      });
      this._rows[prop] = [row, options];
      row.connect('notify::selected', this._updateSettings.bind(this));
      this._group.add(row);
    }
  }
);

function fillPreferencesWindow(window) {
  const page = new BatIconPrefsPage();

  window.default_width = 500;
  window.default_height = 320;
  window.add(page);
}
