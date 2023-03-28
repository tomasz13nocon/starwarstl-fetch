#!/bin/bash

[ -z $FETCH_DIR ] && echo "FETCH_DIR env var not set. Aborting." && exit 1
[ -z $MAIL_BOT_PASS ] && echo "MAIL_BOT_PASS env var not set. Aborting." && exit 1

cd $FETCH_DIR
rm -rf .cache
mkdir -p logs
timestamp=$(date '+%Y-%m-%d_%H:%M:%S')
log_file="logs/$timestamp"
log_file_err="${log_file}.err"

node src/fetch_timeline.js -c > "$log_file" 2> "$log_file_err"

if [ -s "$log_file_err" ]; then
  # TODO split
  curl --url "smtps://smtp.gmail.com:465" --ssl-reqd --mail-from "starwarstl13@gmail.com" --mail-rcpt "mail@starwarstl.com" --user "starwarstl13@gmail.com:$MAIL_BOT_PASS" -T <(echo -e "Subject: Errors during fetching timeline\n" | cat - "$log_file_err")
fi

