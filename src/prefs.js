// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

const { Adw, Gio, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain('battery-indicator-icon');
const _ = Gettext.gettext;

function init() {
  ExtensionUtils.initTranslations();
}

function createComboRow(title, options) {
  const model = new Gtk.StringList();
  for (const opt of Object.values(options)) {
    model.append(opt);
  }
  const row = new Adw.ComboRow({
    title,
    model,
    selected: 0,
  });
  return row;
}

function fillPreferencesWindow(window) {
  const settings = ExtensionUtils.getSettings();
  const dsettings = new Gio.Settings({
    schema_id: 'org.gnome.desktop.interface',
  });

  const page = new Adw.PreferencesPage();
  const group = new Adw.PreferencesGroup();
  page.add(group);

  const textOpts = {
    hidden: _('Hidden'),
    inside: _('Inside the icon'),
    insideVertical: _('Inside the icon (vertical)'),
    nextTo: _('Next to the icon'),
  };
  const textRow = createComboRow(_('Battery percentage text'), textOpts);

  const styleOpts = {
    bold: _('Bold'),
    slim: _('Slim'),
    plain: _('Plain'),
    circle: _('Circle'),
    text: _('Text'),
  };
  const styleRow = createComboRow(_('Battery status icon style'), styleOpts);

  const scaleOpts = {
    square: _('Default'),
    golden: _('Wide'),
    double: _('Extra wide'),
  };
  const scalingRow = createComboRow(_('Horizontal scale'), scaleOpts);

  const orientationOpts = {
    vertical: _('Vertical'),
    horizontal: _('Horizontal'),
  };
  const orientationRow = createComboRow(_('Orientation'), orientationOpts);

  const updateOpt = () => {
    // GUI update
    const textOpt = Object.keys(textOpts)[textRow.selected];
    const styleOpt = Object.keys(styleOpts)[styleRow.selected];
    const scaleOpt = Object.keys(scaleOpts)[scalingRow.selected];
    const orientOpt = Object.keys(orientationOpts)[orientationRow.selected];
    dsettings.set_boolean(
      'show-battery-percentage',
      textOpt === 'nextTo' || styleOpt === 'text'
    );
    settings.set_int(
      'show-icon-text',
      textOpt === 'inside' ? 1 : textOpt === 'insideVertical' ? 2 : 0
    );
    settings.set_string(
      'status-style',
      styleOpt !== 'text' ? styleOpt : 'hidden'
    );
    settings.set_string('icon-orientation', orientOpt);
    settings.set_double(
      'icon-scale',
      scaleOpt === 'golden' ? 1.618 : scaleOpt === 'double' ? 2 : 1
    );
  };
  const updateSetting = () => {
    // Setting update
    const s = settings.get_string('status-style');
    const styleOpt = s !== 'hidden' ? s : 'text';
    styleRow.selected = Object.keys(styleOpts).indexOf(styleOpt);

    const showIcon = styleOpt !== 'text';
    textRow.sensitive = showIcon;
    const textOpt =
      settings.get_int('show-icon-text') === 1
        ? 'inside'
        : settings.get_int('show-icon-text') === 2
        ? 'insideVertical'
        : dsettings.get_boolean('show-battery-percentage')
        ? 'nextTo'
        : 'hidden';
    textRow.selected = Object.keys(textOpts).indexOf(textOpt);

    // Orientation
    orientationRow.sensitive = showIcon && styleOpt !== 'circle';
    const orientOpt = settings.get_string('icon-orientation');
    orientationRow.selected = Object.keys(orientationOpts).indexOf(orientOpt);

    // Horizontal scaling
    scalingRow.sensitive = showIcon;
    const scale = settings.get_double('icon-scale');
    const scaleOpt =
      scale === 1.618 ? 'golden' : scale === 2 ? 'double' : 'square';
    scalingRow.selected = Object.keys(scaleOpts).indexOf(scaleOpt);
  };
  const handlerIds = [
    'status-style',
    'show-battery-percentage',
    'icon-scale',
    'icon-orientation',
  ].map(prop => settings.connect(`changed::${prop}`, updateSetting));
  updateSetting();
  for (const r of [styleRow, textRow, scalingRow, orientationRow]) {
    r.connect('notify::selected', updateOpt);
    group.add(r);
  }
  page.connect('destroy', () => {
    for (const hid of handlerIds) {
      settings.disconnect(hid);
    }
  });

  window.default_width = 500;
  window.default_height = 320;
  window.add(page);
}
