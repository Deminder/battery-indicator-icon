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

DEBUGMODE_MODULE := $(SRC_DIR)/modules/sdt/util.js

include sdt/build/gnome-extension.mk

distclean: clean
	-rm -r $(SDT_DIR)

.PHONY: distclean test
