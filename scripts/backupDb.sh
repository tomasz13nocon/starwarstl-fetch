#!/bin/bash

[ -z $FETCH_DIR ] && echo "FETCH_DIR env var not set. Aborting." && exit 1
[ -z $DUMP_DIR ] && echo "DUMP_DIR env var not set. Aborting." && exit 1
[ -z $MONGO_URI ] && echo "MONGO_URI env var not set. Aborting." && exit 1

timestamp=$(date '+%Y-%m-%d_%H:%M:%S')
outDir=$DUMP_DIR$timestamp
cmd="mongodump"

if [[ $1 == "--docker" ]]; then
  outDir=/dump/$timestamp
  cmd="docker exec starwarstl-mongodb-1 mongodump"
fi

for coll in users sessions lists missingMedia emailVerificationTokens meta; do
  $cmd --uri="$MONGO_URI" --db=starwarstl -c=$coll --out=$outDir
done

cd $DUMP_DIR
tar -czf "${timestamp}.tar.gz" "$timestamp" --force-local
rm -rf $timestamp

aws s3 cp ${timestamp}.tar.gz s3://starwarstl-db-backups
