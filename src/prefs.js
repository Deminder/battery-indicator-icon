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
    portrait: _('Icon portrait'),
    plainportrait: _('Plain icon portrait'),
    circle: _('Circle'),
    text: _('Text'),
  };
  const styleRow = createComboRow(_('Battery status icon style'), styleOpts);

  const updateOpt = () => {
    // GUI update
    const textOpt = Object.keys(textOpts)[textRow.selected];
    const styleOpt = Object.keys(styleOpts)[styleRow.selected];
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
  };
  const handlerIds = [
    settings.connect('changed::status-style', updateSetting),
    settings.connect('changed::show-battery-percentage', updateSetting),
  ];
  updateSetting();
  styleRow.connect('notify::selected', updateOpt);
  textRow.connect('notify::selected', updateOpt);

  group.add(styleRow);
  group.add(textRow);
  page.connect('destroy', () => {
    for (const hid of handlerIds) {
      settings.disconnect(hid);
    }
  });

  window.default_width = 500;
  window.default_height = 220;
  window.add(page);
}
