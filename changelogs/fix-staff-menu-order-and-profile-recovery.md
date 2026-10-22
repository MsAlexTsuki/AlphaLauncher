## Fixed
- Fixed automatic Default profile creation so a newly added Default profile is immediately saved to disk and remains available after restarting the client.
- Removed the module Details panel from the Mods menu; the Profiles panel with Create, Edit, and Delete stays visible when selecting any module.
- Fixed profile switching so BHOP settings load from the same active profile as the Mods menu; BHOP settings are saved to the current profile before switching, preventing profiles from sharing or reverting settings.
- Staff rank folders now appear from lowest rank to highest rank, with General first and Founder last.
- W-Tap Assistance is restricted to the Founder folder and no longer appears in other staff-rank folders.
- Existing profiles are merged between both profile stores, including module settings and saved colors, instead of being hidden from the active Mods menu.
- Unreadable profile files are preserved as a backup before recovery is attempted, preventing silent replacement of profile data.

- Fixed legacy Gson compatibility by replacing inaccessible JSON deep-copy calls with a supported JSON copy helper.
- Fixed profile migration compilation by adding a case-insensitive duplicate-profile check in the legacy profile manager.
- Ordinary modules now appear only in their assigned rank folders; Owner and Founder retain rank-based access instead of showing duplicated ordinary modules in their own folders.
