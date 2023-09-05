# SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
#
# SPDX-License-Identifier: GPL-3.0-or-later

ifeq ($(wildcard sdt/build),)
$(info Not initialized! Try running:)
$(info > git submodule update --init --remote --recursive --checkout sdt)
$(info )
$(info )
endif

include sdt/build/default.mk

SDT_MODULES := util injection
SDT_DIR := $(SRC_DIR)/modules/sdt
SDT_FILES := $(patsubst %,$(SDT_DIR)/%.js,$(SDT_MODULES))

SOURCE_FILES += $(SDT_FILES)
DEBUGMODE_MODULE := $(SDT_DIR)/util.js

$(SDT_FILES): $(SDT_DIR)/%.js: sdt/src/modules/%.js
	@mkdir -p $(@D)
	@cp $< $@

include sdt/build/gnome-extension.mk

distclean: clean
	-rm -r $(SDT_DIR)

.PHONY: distclean test
