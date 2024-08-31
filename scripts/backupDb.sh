#!/bin/bash

if [[ $(basename $PWD) != "fetch" ]]; then
  echo "Must be executed in 'fetch' directory!"
  exit 1
fi

set -a && source .env && set +a

if [[ -z $MONGO_URI ]]; then
  echo "MONGO_URI not set or not present in .env!"
  exit 1
fi

timestamp=$(date '+%Y-%m-%d_%H:%M:%S')
outDir=../dump/$timestamp

for coll in users sessions lists missingMedia emailVerificationTokens meta; do
  mongodump --uri="$MONGO_URI" --db=starwarstl -c=$coll --out=$outDir
done

cd ../dump
tar -czf "${timestamp}.tar.gz" "$timestamp" --force-local
rm -rf $timestamp

aws s3 cp ${timestamp}.tar.gz s3://starwarstl-db-backups
