#!/usr/bin/env bash
cmake . &&
cmake --build . &&
ls -lh docs/dist | grep image_compressor | awk '{ print $5 "\t" $9 }'
