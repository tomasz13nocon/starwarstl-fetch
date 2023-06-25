#!/bin/bash

# Script to be used from a cron job
# Runs the main script, logs to files, sends email in case of errors

[ -z $FETCH_DIR ] && echo "FETCH_DIR env var not set. Aborting." && exit 1
[ -z $MAILBOT_SERVER ] && echo "MAILBOT_SERVER env var not set. Aborting." && exit 1
[ -z $MAILBOT_FROM ] && echo "MAILBOT_FROM env var not set. Aborting." && exit 1
[ -z $MAILBOT_RCPT ] && echo "MAILBOT_RCPT env var not set. Aborting." && exit 1
[ -z $MAILBOT_PASS ] && echo "MAILBOT_PASS env var not set. Aborting." && exit 1

NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm use 19
echo "using node $(node -v)"

cd $FETCH_DIR
rm -rf .cache
mkdir -p logs
timestamp=$(date '+%Y-%m-%d_%H:%M:%S')
log_file="logs/$timestamp"
log_file_err="${log_file}.err"

node src/index.js -c > "$log_file" 2> "$log_file_err"

if [ -s "$log_file_err" ]; then
  curl --url "$MAILBOT_SERVER" \
       --ssl-reqd \
       --mail-from "$MAILBOT_FROM" \
       --mail-rcpt "$MAILBOT_RCPT" \
       --user "$MAILBOT_FROM:$MAILBOT_PASS" \
       -T <(echo -e "Subject: Errors during fetching timeline\n" | cat - "$log_file_err")
fi

