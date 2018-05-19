#!/bin/bash

if [ ! -x $(which node) ]; then
	echo "node.js runtime not found in path."
	exit 1
fi

if [ ! -x $(which npm) ]; then
	echo "npm not found in path."
	exit 1
fi

if [ ! -d "node_modules" ]; then
	npm install --no-bin-links --no-package-lock
	npm install --prefix ./plugins/discord ./plugins/discord --no-bin-links --no-package-lock
	npm install --prefix ./plugins/scorecard ./plugins/scorecard --no-bin-links --no-package-lock

	rm -rf ./plugins/discord/etc ./plugins/scorecard/etc
fi

node ameto.js