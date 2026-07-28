#!/usr/bin/env bash
set -euo pipefail

BUCKET="${READFAST_BACKGROUND_BUCKET:-readfast-live-backgrounds-598886662694}"
REGION="${AWS_REGION:-us-east-1}"
SOURCE_DIR="${READFAST_BACKGROUND_SOURCE_DIR:-assets/backgrounds}"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Background source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

shopt -s nullglob
files=("$SOURCE_DIR"/*.mp4 "$SOURCE_DIR"/*.webm "$SOURCE_DIR"/*.mov "$SOURCE_DIR"/*.m4v)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No video files found in $SOURCE_DIR" >&2
  exit 1
fi

for file in "${files[@]}"; do
  key="$(basename "$file")"
  case "${key##*.}" in
    mp4|m4v|mov) content_type="video/mp4" ;;
    webm) content_type="video/webm" ;;
    *) content_type="application/octet-stream" ;;
  esac

  aws s3 cp "$file" "s3://$BUCKET/$key" \
    --region "$REGION" \
    --content-type "$content_type" \
    --cache-control "public, max-age=31536000, immutable"
done

echo "Synced ${#files[@]} background file(s) to s3://$BUCKET/"
