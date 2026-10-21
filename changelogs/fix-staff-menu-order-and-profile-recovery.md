## Fixed
- Staff rank folders now appear from lowest rank to highest rank, with General first and Founder last.
- W-Tap Assistance is restricted to the Founder folder and no longer appears in other staff-rank folders.
- Existing profiles are merged between both profile stores, including module settings and saved colors, instead of being hidden from the active Mods menu.
- Unreadable profile files are preserved as a backup before recovery is attempted, preventing silent replacement of profile data.

- Fixed legacy Gson compatibility by replacing inaccessible JSON deep-copy calls with a supported JSON copy helper.
- Fixed profile migration compilation by adding a case-insensitive duplicate-profile check in the legacy profile manager.
- Ordinary modules now appear only in their assigned rank folders; Owner and Founder retain rank-based access instead of showing duplicated ordinary modules in their own folders.
