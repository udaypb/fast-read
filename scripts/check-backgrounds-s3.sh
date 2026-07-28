#!/usr/bin/env bash
set -euo pipefail

BUCKET="${READFAST_BACKGROUND_BUCKET:-readfast-live-backgrounds-598886662694}"
REGION="${AWS_REGION:-us-east-1}"

expected=(
  abstract_6.mp4
  abstract_4.mp4
  abstract_1.mp4
  abstract_3_fast.mp4
  abstract_mandala.mp4
  space_4.mp4
  space_6.mp4
  space_2.mp4
  space_1.mp4
  subway_surfer_1_fast.mp4
  subway_surfer_2_fast.mp4
  subway_surfer_3_fast.mp4
  subway_surfer_4_fast.mp4
  china_surfer_low_fast.mp4
  minecraft_1.mp4
  minecraft_3.mp4
  minecraft_4.mp4
  minecraft_6_fast.mp4
  minecraft_night_bridge.mp4
  track_video.mp4
  track.mp4
  fortnite_1.mp4
  fortnite_2.mp4
  fortnite_3.mp4
  fortnite_neon_dash.mp4
  fortnite_4.mp4
  ocean_coast.mp4
  leaf_macro.mp4
)

missing=0
for key in "${expected[@]}"; do
  if aws s3api head-object --bucket "$BUCKET" --key "$key" --region "$REGION" >/dev/null 2>&1; then
    echo "OK      $key"
  else
    echo "MISSING $key"
    missing=$((missing + 1))
  fi
done

if [[ "$missing" -gt 0 ]]; then
  echo "$missing background object(s) missing from s3://$BUCKET/" >&2
  exit 1
fi

echo "All expected background objects are present."
