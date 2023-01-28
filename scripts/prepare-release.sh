#!/bin/bash
# SPDX-FileCopyrightText: 2021 Deminder <tremminder@gmail.com>
# SPDX-License-Identifier: GPL-3.0-or-later

set -e

# release should be on main branch
[[ `git branch --show-current` == 'main' ]] || ( echo "Expected branch: main" >&2 && exit 1 )

# cd to the repo root
cd "$( cd "$( dirname "$0" )" && pwd )/.."

./scripts/update-pod.sh
npm run format

VPATTERN='^ *?\"version\": *?'
METADATA_FILE=src/metadata.json
VERSION=$(( 1 + `grep -oP "$VPATTERN"'\K(\d+)' "$METADATA_FILE"` ))
echo "New version: $VERSION"
sed -Ei "s/($VPATTERN)([0-9]+)(.*)/\1$VERSION\3/" "$METADATA_FILE"
git add "$METADATA_FILE"

reuse lint

git commit -am "Bump version to $VERSION"
git tag -a "v$VERSION" -m "Release version $VERSION"
