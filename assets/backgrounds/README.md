# ReadFast Background Assets

Put production background videos in this directory before syncing to S3.

The app catalog currently uses these S3 object names:

- `abstract_6.mp4` - Neon Tunnel
- `abstract_4.mp4` - Particle Bloom
- `abstract_1.mp4` - Light Corridor
- `abstract_3_fast.mp4` - Wire Tunnel
- `abstract_mandala.mp4` - Mandala
- `space_4.mp4` - Galaxy Core
- `space_6.mp4` - Aurora Lake
- `space_2.mp4` - Nebula Cloud
- `space_1.mp4` - Deep Space
- `subway_surfer_1_fast.mp4` - Tunnel Run
- `subway_surfer_2_fast.mp4` - Classic Run
- `subway_surfer_3_fast.mp4` - Night Tracks
- `subway_surfer_4_fast.mp4` - Forest Rails
- `china_surfer_low_fast.mp4` - China Runner
- `minecraft_1.mp4`
- `minecraft_3.mp4`
- `minecraft_4.mp4`
- `minecraft_6_fast.mp4`
- `minecraft_night_bridge.mp4`
- `track_video.mp4` - Future Track
- `track.mp4` - Stadium Track
- `fortnite_1.mp4` - Ridge Drive
- `fortnite_2.mp4` - Green Corridor
- `fortnite_3.mp4` - Night Elims
- `fortnite_neon_dash.mp4` - Neon Dash
- `fortnite_4.mp4` - Build Run
- `ocean_coast.mp4` - Ocean Coast
- `leaf_macro.mp4` - Leaf Macro

Sync them with:

```sh
npm run backgrounds:sync
```

Verify the catalog objects are present with:

```sh
npm run backgrounds:check
```
